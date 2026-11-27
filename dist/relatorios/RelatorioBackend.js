"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelatorioIpc = exports.RelatorioExportador = exports.RelatorioRepository = void 0;
const electron_1 = require("electron");
const SegurancaIpc_1 = require("../SegurancaIpc");
const promises_1 = require("fs/promises");
const Banco_1 = require("../Banco");
const FORMATOS = {
    pdf: { extensao: 'pdf', rotulo: 'PDF' },
    csv: { extensao: 'csv', rotulo: 'CSV para Excel' },
    json: { extensao: 'json', rotulo: 'JSON' },
    png: { extensao: 'png', rotulo: 'Imagem PNG' }
};
class RelatorioRepository {
    constructor() {
        this.pool = Banco_1.Banco.pool;
        this.sqlReceitas = `
    SELECT
      GREATEST(
        (SELECT COALESCE(SUM(p.valor), 0)
          FROM assinaturas a
          INNER JOIN planos p ON p.id = a.plano_id
          WHERE a.status <> 'cancelada'
            AND a.data_inicio >= ? AND a.data_inicio < ?)
        -
        (SELECT COALESCE(SUM(pg.valor), 0)
          FROM pagamentos pg
          INNER JOIN assinaturas a ON a.id = pg.assinatura_id
          WHERE pg.status = 'cancelado'
            AND a.status <> 'cancelada'
            AND a.data_inicio >= ? AND a.data_inicio < ?),
        0
      ) AS planos,
      COALESCE(SUM(CASE WHEN categoria = 'aula' THEN valor END), 0) AS aulas,
      COALESCE(SUM(CASE WHEN categoria = 'aluguel' THEN valor END), 0) AS aluguel,
      COALESCE(SUM(CASE WHEN categoria = 'outros' THEN valor END), 0) AS outros
    FROM lancamentos
    WHERE data_lancamento >= ? AND data_lancamento < ?`;
        this.dois = (numero) => String(numero).padStart(2, '0');
        this.intervalo = (periodo) => {
            const { ano } = periodo;
            if (periodo.tipo === 'anual')
                return [`${ano}-01-01`, `${ano + 1}-01-01`];
            const anoSeguinte = periodo.mes === 12 ? ano + 1 : ano;
            const mesSeguinte = periodo.mes === 12 ? 1 : periodo.mes + 1;
            return [`${ano}-${this.dois(periodo.mes)}-01`, `${anoSeguinte}-${this.dois(mesSeguinte)}-01`];
        };
        this.periodoValido = (periodo) => {
            if (typeof periodo !== 'object' || periodo === null)
                return false;
            const { tipo, ano, mes } = periodo;
            const anoValido = Number.isInteger(ano) && ano >= 2000 && ano <= 2100;
            if (tipo === 'anual')
                return anoValido;
            return tipo === 'mensal' && anoValido && Number.isInteger(mes) && mes >= 1 && mes <= 12;
        };
        this.receitas = async (periodo) => {
            const [inicio, fim] = this.intervalo(periodo);
            const [linhas] = await this.pool.query(this.sqlReceitas, [
                inicio,
                fim,
                inicio,
                fim,
                inicio,
                fim
            ]);
            const linha = linhas[0];
            return {
                planos: Number(linha.planos),
                aulas: Number(linha.aulas),
                aluguel: Number(linha.aluguel),
                outros: Number(linha.outros)
            };
        };
    }
}
exports.RelatorioRepository = RelatorioRepository;
class RelatorioExportador {
    constructor(repositorio) {
        this.repositorio = repositorio;
        this.dois = (numero) => String(numero).padStart(2, '0');
        this.decimal = (valor) => valor.toFixed(2).replace('.', ',');
        this.percentual = (valor) => valor.toFixed(1).replace('.', ',');
        this.celulaCsv = (valor) => {
            const texto = String(valor);
            return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
        };
        this.periodoTexto = (periodo) => periodo.tipo === 'anual' ? `Ano ${periodo.ano}` : `${this.dois(periodo.mes)}/${periodo.ano}`;
        this.total = (receitas) => receitas.planos + receitas.aulas + receitas.aluguel + receitas.outros;
        this.participacoes = (receitas) => {
            const total = this.total(receitas);
            const parte = (valor) => (total > 0 ? (valor / total) * 100 : 0);
            return {
                planos: parte(receitas.planos),
                aulas: parte(receitas.aulas),
                aluguel: parte(receitas.aluguel),
                outros: parte(receitas.outros)
            };
        };
        this.lider = (receitas) => {
            const itens = [
                { rotulo: 'Planos', valor: receitas.planos },
                { rotulo: 'Aulas', valor: receitas.aulas },
                { rotulo: 'Aluguel', valor: receitas.aluguel },
                { rotulo: 'Outros', valor: receitas.outros }
            ];
            return itens.reduce((atual, item) => (item.valor > atual.valor ? item : atual), itens[0]);
        };
        this.csv = (pedido) => {
            const total = this.total(pedido.receitas);
            const partes = this.participacoes(pedido.receitas);
            const linhas = [
                ['Relatório de receitas - Academia Cotil'],
                ['Período', this.periodoTexto(pedido.periodo)],
                [],
                ['Categoria', 'Valor (R$)', 'Participação (%)'],
                ['Planos', this.decimal(pedido.receitas.planos), this.percentual(partes.planos)],
                ['Aulas', this.decimal(pedido.receitas.aulas), this.percentual(partes.aulas)],
                ['Aluguel', this.decimal(pedido.receitas.aluguel), this.percentual(partes.aluguel)],
                ['Outros', this.decimal(pedido.receitas.outros), this.percentual(partes.outros)],
                ['Total', this.decimal(total), '100,0']
            ];
            return '\uFEFF' + linhas.map((linha) => linha.map(this.celulaCsv).join(';')).join('\r\n');
        };
        this.json = (pedido) => {
            const total = this.total(pedido.receitas);
            const partes = this.participacoes(pedido.receitas);
            const lider = this.lider(pedido.receitas);
            return JSON.stringify({
                sistema: 'Academia Cotil',
                periodo: pedido.periodo,
                periodoTexto: this.periodoTexto(pedido.periodo),
                geradoEm: new Date().toISOString(),
                receitas: pedido.receitas,
                total,
                participacoesPercentuais: partes,
                categoriaLider: lider.rotulo,
                valorCategoriaLider: lider.valor,
                participacaoLiderPercentual: total > 0 ? (lider.valor / total) * 100 : 0
            }, null, 2);
        };
        this.escolherDestino = async (janela, nome, formato) => {
            const config = FORMATOS[formato];
            const base = nome.replace(/[^\w-]/g, '').slice(0, 60) || 'relatorio';
            const { canceled, filePath } = await electron_1.dialog.showSaveDialog(janela, {
                defaultPath: `${base}.${config.extensao}`,
                filters: [{ name: config.rotulo, extensions: [config.extensao] }]
            });
            if (canceled || !filePath)
                return null;
            return filePath.toLowerCase().endsWith(`.${config.extensao}`)
                ? filePath
                : `${filePath}.${config.extensao}`;
        };
        this.salvarPdf = async (janela, nome) => {
            const destino = await this.escolherDestino(janela, nome, 'pdf');
            if (!destino)
                return null;
            const conteudo = await janela.webContents.printToPDF({ printBackground: true, landscape: true, pageSize: 'A4' });
            await (0, promises_1.writeFile)(destino, conteudo);
            return destino;
        };
        this.salvar = async (janela, pedido) => {
            if (pedido.formato === 'pdf')
                return this.salvarPdf(janela, pedido.nome);
            const destino = await this.escolherDestino(janela, pedido.nome, pedido.formato);
            if (!destino)
                return null;
            if (pedido.formato === 'png') {
                const imagem = await janela.webContents.capturePage();
                await (0, promises_1.writeFile)(destino, imagem.toPNG());
                return destino;
            }
            const conteudo = pedido.formato === 'csv' ? this.csv(pedido) : this.json(pedido);
            await (0, promises_1.writeFile)(destino, conteudo, 'utf8');
            return destino;
        };
        this.validar = (entrada) => {
            if (typeof entrada !== 'object' || entrada === null)
                return null;
            const { nome, formato, periodo, receitas } = entrada;
            if (typeof nome !== 'string' || !Object.prototype.hasOwnProperty.call(FORMATOS, formato))
                return null;
            if (!this.repositorio.periodoValido(periodo))
                return null;
            if (typeof receitas !== 'object' || receitas === null)
                return null;
            const valores = receitas;
            const numero = (valor) => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null;
            const planos = numero(valores.planos);
            const aulas = numero(valores.aulas);
            const aluguel = numero(valores.aluguel);
            const outros = numero(valores.outros);
            if (planos === null || aulas === null || aluguel === null || outros === null)
                return null;
            return {
                nome: nome.slice(0, 60),
                formato: formato,
                periodo: periodo,
                receitas: { planos, aulas, aluguel, outros }
            };
        };
    }
}
exports.RelatorioExportador = RelatorioExportador;
class RelatorioIpc {
    constructor(sessao, repositorio = new RelatorioRepository()) {
        this.sessao = sessao;
        this.repositorio = repositorio;
        this.registrar = () => {
            (0, SegurancaIpc_1.registrarCanal)('relatorios:receitas', (_evento, periodo) => {
                this.sessao.exigir(['admin']);
                if (!this.repositorio.periodoValido(periodo))
                    throw new Error('Período inválido');
                return this.repositorio.receitas(periodo);
            });
            (0, SegurancaIpc_1.registrarCanal)('relatorios:exportar', async (evento, entrada) => {
                this.sessao.exigir(['admin']);
                const pedido = this.exportador.validar(entrada);
                if (!pedido)
                    throw new Error('Dados de exportação inválidos');
                const janela = electron_1.BrowserWindow.fromWebContents(evento.sender);
                if (!janela)
                    throw new Error('Janela não encontrada');
                return this.exportador.salvar(janela, pedido);
            });
            (0, SegurancaIpc_1.registrarCanal)('relatorios:exportar-pdf', async (evento, nome) => {
                this.sessao.exigir(['admin']);
                const janela = electron_1.BrowserWindow.fromWebContents(evento.sender);
                if (!janela)
                    throw new Error('Janela não encontrada');
                return this.exportador.salvarPdf(janela, typeof nome === 'string' ? nome : 'relatorio');
            });
        };
        this.exportador = new RelatorioExportador(this.repositorio);
    }
}
exports.RelatorioIpc = RelatorioIpc;
