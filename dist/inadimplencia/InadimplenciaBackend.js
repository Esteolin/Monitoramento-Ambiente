"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InadimplenciaIpc = exports.InadimplenciaRepository = void 0;
const SegurancaIpc_1 = require("../SegurancaIpc");
const PagamentoBackend_1 = require("../pagamentos/PagamentoBackend");
const RegrasInadimplencia_1 = require("./RegrasInadimplencia");
const dataISO = (valor) => String(valor ?? '').slice(0, 10);
class InadimplenciaRepository {
    constructor(pagamentos = new PagamentoBackend_1.PagamentoRepository(), regras = new RegrasInadimplencia_1.RegrasInadimplencia()) {
        this.pagamentos = pagamentos;
        this.regras = regras;
        this.resumo = async () => {
            const lista = (await this.pagamentos.listar({}))
                .filter((pagamento) => pagamento.status === 'atrasado' || pagamento.status === 'pendente')
                .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.alunoNome.localeCompare(b.alunoNome));
            const atrasados = lista.filter((pagamento) => pagamento.status === 'atrasado');
            const emAberto = lista.filter((pagamento) => pagamento.status === 'pendente');
            const mapear = (pagamento) => ({
                pagamentoId: pagamento.id,
                alunoId: pagamento.alunoId,
                alunoNome: pagamento.alunoNome,
                competencia: dataISO(pagamento.competencia).slice(0, 7),
                valor: pagamento.valor,
                dataVencimento: dataISO(pagamento.dataVencimento),
                diasAtraso: this.regras.diasAtraso(pagamento.dataVencimento),
                status: pagamento.status === 'pendente' ? 'pendente' : 'atrasado'
            });
            const itens = atrasados.map(mapear);
            const itensEmAberto = emAberto.map(mapear);
            const somar = (valores) => Math.round(valores.reduce((total, item) => total + item.valor, 0) * 100) / 100;
            const graves = itens.filter((item) => this.regras.atrasoExigeAlerta(item.diasAtraso));
            return {
                geradoEm: new Date().toISOString(),
                atrasados: atrasados.length,
                atrasadosLongos: graves.length,
                atrasadosLeves: itens.length - graves.length,
                emAberto: emAberto.length,
                valorTotal: somar(itens),
                valorTotalAlerta: somar([...itens, ...itensEmAberto]),
                totalAlunos: new Set(atrasados.map((pagamento) => pagamento.alunoId)).size,
                totalAlunosAlerta: new Set(lista.map((pagamento) => pagamento.alunoId)).size,
                itens: itens.slice(0, 10),
                itensEmAberto: itensEmAberto.slice(0, 10)
            };
        };
    }
}
exports.InadimplenciaRepository = InadimplenciaRepository;
class InadimplenciaIpc {
    constructor(sessao, repositorio = new InadimplenciaRepository()) {
        this.sessao = sessao;
        this.repositorio = repositorio;
        this.registrar = () => {
            (0, SegurancaIpc_1.registrarCanal)('inadimplencia:resumo', async () => {
                this.sessao.exigir(['admin']);
                return this.repositorio.resumo();
            });
        };
    }
}
exports.InadimplenciaIpc = InadimplenciaIpc;
