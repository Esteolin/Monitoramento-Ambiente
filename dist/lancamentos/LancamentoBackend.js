"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LancamentoIpc = exports.LancamentoRepository = void 0;
const SegurancaIpc_1 = require("../SegurancaIpc");
const Banco_1 = require("../Banco");
const BancoErros_1 = require("../BancoErros");
const TIMEOUT = 15000;
const CATEGORIAS = ['aula', 'aluguel', 'outros'];
const dataISO = (valor) => String(valor ?? '').slice(0, 10);
const dataValida = (valor) => {
    if (typeof valor !== 'string')
        return null;
    const m = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m)
        return null;
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia)
        return null;
    if (ano < 1900 || ano > 2100)
        return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
};
const mapear = (linha) => ({
    id: Number(linha.id),
    categoria: String(linha.categoria),
    descricao: linha.descricao ? String(linha.descricao) : null,
    valor: Number(linha.valor),
    dataLancamento: dataISO(linha.data_lancamento)
});
class LancamentoRepository {
    constructor() {
        this.pool = Banco_1.Banco.pool;
        this.listar = async (filtro) => {
            const condicoes = [];
            const valores = [];
            if (filtro.categoria) {
                condicoes.push('categoria = ?');
                valores.push(filtro.categoria);
            }
            if (filtro.inicio) {
                condicoes.push('data_lancamento >= ?');
                valores.push(filtro.inicio);
            }
            if (filtro.fim) {
                condicoes.push('data_lancamento <= ?');
                valores.push(filtro.fim);
            }
            if (filtro.busca) {
                const termo = `%${filtro.busca.replace(/[\\%_]/g, '\\$&')}%`;
                condicoes.push('descricao LIKE ?');
                valores.push(termo);
            }
            const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
            const [linhas] = await this.pool.query({
                sql: `SELECT id, categoria, descricao, valor, data_lancamento
            FROM lancamentos
            ${where}
            ORDER BY data_lancamento DESC, id DESC
            LIMIT 500`,
                values: valores,
                timeout: TIMEOUT
            });
            return linhas.map(mapear);
        };
        this.obter = async (id) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT id, categoria, descricao, valor, data_lancamento
            FROM lancamentos WHERE id = ? LIMIT 1`,
                values: [id],
                timeout: TIMEOUT
            });
            return linhas.length ? mapear(linhas[0]) : null;
        };
        this.criar = async (dados) => {
            const [resultado] = await this.pool.query({
                sql: `INSERT INTO lancamentos (categoria, descricao, valor, data_lancamento)
            VALUES (?, ?, ?, ?)`,
                values: [dados.categoria, dados.descricao ?? null, dados.valor, dados.dataLancamento],
                timeout: TIMEOUT
            });
            return Number(resultado.insertId);
        };
        this.atualizar = async (dados) => {
            const [resultado] = await this.pool.query({
                sql: `UPDATE lancamentos
            SET categoria = ?, descricao = ?, valor = ?, data_lancamento = ?
            WHERE id = ?`,
                values: [dados.categoria, dados.descricao ?? null, dados.valor, dados.dataLancamento, dados.id],
                timeout: TIMEOUT
            });
            return resultado.affectedRows > 0;
        };
        this.excluir = async (id) => {
            const [resultado] = await this.pool.query({
                sql: 'DELETE FROM lancamentos WHERE id = ?',
                values: [id],
                timeout: TIMEOUT
            });
            return resultado.affectedRows > 0;
        };
    }
}
exports.LancamentoRepository = LancamentoRepository;
class LancamentoValidador {
    constructor() {
        this.id = (valor) => {
            const numero = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN;
            return Number.isInteger(numero) && numero > 0 ? numero : null;
        };
    }
    filtro(entrada) {
        if (typeof entrada !== 'object' || entrada === null)
            return {};
        const e = entrada;
        const filtro = {};
        if (typeof e.categoria === 'string' && CATEGORIAS.includes(e.categoria)) {
            filtro.categoria = e.categoria;
        }
        const inicio = dataValida(e.inicio);
        if (inicio)
            filtro.inicio = inicio;
        const fim = dataValida(e.fim);
        if (fim)
            filtro.fim = fim;
        if (typeof e.busca === 'string')
            filtro.busca = e.busca.trim().slice(0, 120);
        if (filtro.inicio && filtro.fim && filtro.inicio > filtro.fim)
            return {};
        return filtro;
    }
    validar(entrada) {
        if (typeof entrada !== 'object' || entrada === null)
            return { ok: false, mensagem: 'Dados inválidos.' };
        const e = entrada;
        let id;
        if (e.id !== undefined) {
            const idValido = this.id(e.id);
            if (idValido === null)
                return { ok: false, mensagem: 'Lançamento inválido.' };
            id = idValido;
        }
        if (typeof e.categoria !== 'string' || !CATEGORIAS.includes(e.categoria)) {
            return { ok: false, mensagem: 'Selecione uma categoria válida.' };
        }
        const descricaoTexto = typeof e.descricao === 'string' ? e.descricao.trim() : '';
        if (descricaoTexto.length > 160) {
            return { ok: false, mensagem: 'A descrição deve ter até 160 caracteres.' };
        }
        const descricao = descricaoTexto || null;
        const numero = typeof e.valor === 'number'
            ? e.valor
            : typeof e.valor === 'string' && /^\d+([.,]\d{1,2})?$/.test(e.valor.trim())
                ? Number(e.valor.trim().replace(',', '.'))
                : NaN;
        if (!Number.isFinite(numero) || numero <= 0 || numero > 99999999.99) {
            return { ok: false, mensagem: 'Informe um valor entre 0,01 e 99.999.999,99.' };
        }
        const dataLancamento = dataValida(e.dataLancamento);
        if (!dataLancamento)
            return { ok: false, mensagem: 'Informe uma data válida.' };
        return {
            ok: true,
            dados: {
                id,
                categoria: e.categoria,
                descricao,
                valor: Math.round(numero * 100) / 100,
                dataLancamento
            }
        };
    }
}
class LancamentoIpc {
    constructor(sessao, repositorio = new LancamentoRepository()) {
        this.sessao = sessao;
        this.repositorio = repositorio;
        this.validador = new LancamentoValidador();
        this.id = (valor) => {
            const numero = typeof valor === 'number' || typeof valor === 'string' ? Number(valor) : NaN;
            return Number.isInteger(numero) && numero > 0 ? numero : null;
        };
        this.erro = (contexto, erro, padrao) => {
            if (erro instanceof Error && erro.message === 'Acesso negado') {
                return { ok: false, mensagem: 'Acesso negado para esta operação.' };
            }
            console.error(`[${contexto}]`, erro);
            return { ok: false, mensagem: BancoErros_1.BancoErros.mensagem(erro, padrao) };
        };
        this.registrar = () => {
            (0, SegurancaIpc_1.registrarCanal)('lancamentos:listar', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                return this.repositorio.listar(this.validador.filtro(entrada));
            });
            (0, SegurancaIpc_1.registrarCanal)('lancamentos:obter', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const id = this.id(entrada);
                if (id === null)
                    throw new Error('Lançamento inválido.');
                return this.repositorio.obter(id);
            });
            (0, SegurancaIpc_1.registrarCanal)('lancamentos:criar', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const v = this.validador.validar(entrada);
                if (!v.ok)
                    return v;
                try {
                    const id = await this.repositorio.criar(v.dados);
                    return { ok: true, id };
                }
                catch (erro) {
                    return this.erro('lancamentos:criar', erro, 'Não foi possível criar o lançamento.');
                }
            });
            (0, SegurancaIpc_1.registrarCanal)('lancamentos:atualizar', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const v = this.validador.validar(entrada);
                if (!v.ok)
                    return v;
                if (v.dados.id === undefined)
                    return { ok: false, mensagem: 'Lançamento inválido.' };
                try {
                    const ok = await this.repositorio.atualizar(v.dados);
                    if (!ok)
                        return { ok: false, mensagem: 'Lançamento não encontrado.' };
                    return { ok: true, id: v.dados.id };
                }
                catch (erro) {
                    return this.erro('lancamentos:atualizar', erro, 'Não foi possível atualizar o lançamento.');
                }
            });
            (0, SegurancaIpc_1.registrarCanal)('lancamentos:excluir', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const id = this.id(entrada);
                if (id === null)
                    return { ok: false, mensagem: 'Lançamento inválido.' };
                try {
                    const ok = await this.repositorio.excluir(id);
                    if (!ok)
                        return { ok: false, mensagem: 'Lançamento não encontrado.' };
                    return { ok: true, id };
                }
                catch (erro) {
                    return this.erro('lancamentos:excluir', erro, 'Não foi possível excluir o lançamento.');
                }
            });
        };
    }
}
exports.LancamentoIpc = LancamentoIpc;
