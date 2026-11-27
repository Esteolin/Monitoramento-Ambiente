"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssiduidadeIpc = exports.AssiduidadeRepository = void 0;
const SegurancaIpc_1 = require("../SegurancaIpc");
const Banco_1 = require("../Banco");
const AnaliseAssiduidade_1 = require("./AnaliseAssiduidade");
const TIMEOUT = 15000;
const dataStr = (valor) => String(valor ?? '').slice(0, 10);
const numeroOpcional = (valor) => {
    if (valor === null || valor === undefined || valor === '')
        return undefined;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
};
const mapearAvaliacao = (linha) => {
    const pesoKg = Number(linha.peso_kg ?? 0);
    const alturaCm = Number(linha.altura_cm ?? 0);
    const altura = alturaCm / 100;
    return {
        id: Number(linha.id),
        alunoId: Number(linha.aluno_id),
        alunoNome: String(linha.aluno_nome ?? ''),
        dataAvaliacao: dataStr(linha.data_avaliacao),
        pesoKg,
        alturaCm,
        imc: altura ? Math.round((pesoKg / (altura * altura)) * 100) / 100 : 0,
        percentualGordura: numeroOpcional(linha.percentual_gordura),
        cinturaCm: numeroOpcional(linha.cintura_cm)
    };
};
const mapearPresenca = (linha) => ({
    id: Number(linha.id),
    alunoId: Number(linha.aluno_id),
    alunoNome: String(linha.aluno_nome ?? ''),
    aulaId: linha.aula_id === null || linha.aula_id === undefined ? undefined : Number(linha.aula_id),
    aulaTitulo: linha.aula_titulo ? String(linha.aula_titulo) : undefined,
    dataPresenca: dataStr(linha.data_presenca),
    origem: String(linha.origem)
});
class AssiduidadeRepository {
    constructor() {
        this.pool = Banco_1.Banco.pool;
        this.analise = new AnaliseAssiduidade_1.AnaliseAssiduidadeEvolucao();
        this.alunos = async (alunoId) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT a.id, u.nome, a.ativo
            FROM alunos a
            INNER JOIN usuarios u ON u.id = a.usuario_id
            WHERE (? IS NULL OR a.id = ?)
            ORDER BY u.nome ASC, a.id ASC`,
                values: [alunoId, alunoId],
                timeout: TIMEOUT
            });
            return linhas.map((linha) => ({
                id: Number(linha.id),
                nome: String(linha.nome ?? ''),
                ativo: Boolean(linha.ativo)
            }));
        };
        this.avaliacoes = async (alunoId) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT av.id, av.aluno_id, u.nome AS aluno_nome, av.data_avaliacao,
                   av.peso_kg, av.altura_cm, av.percentual_gordura, av.cintura_cm
            FROM avaliacoes av
            INNER JOIN alunos al ON al.id = av.aluno_id
            INNER JOIN usuarios u ON u.id = al.usuario_id
            WHERE (? IS NULL OR av.aluno_id = ?)
            ORDER BY av.data_avaliacao ASC, av.id ASC
            LIMIT 2000`,
                values: [alunoId, alunoId],
                timeout: TIMEOUT
            });
            return linhas.map(mapearAvaliacao);
        };
        this.presencas = async (periodo, alunoId) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT p.id, p.aluno_id, u.nome AS aluno_nome, p.aula_id, a.titulo AS aula_titulo,
                   p.data_presenca, p.origem
            FROM presencas p
            INNER JOIN alunos al ON al.id = p.aluno_id
            INNER JOIN usuarios u ON u.id = al.usuario_id
            LEFT JOIN aulas a ON a.id = p.aula_id
            WHERE DATE(p.data_presenca) BETWEEN ? AND ?
              AND (? IS NULL OR p.aluno_id = ?)
            ORDER BY p.data_presenca ASC, p.id ASC
            LIMIT 5000`,
                values: [periodo.inicio, periodo.fim, alunoId, alunoId],
                timeout: TIMEOUT
            });
            return linhas.map(mapearPresenca);
        };
        this.relatorio = async (alunoId = null) => {
            const [alunos, avaliacoes] = await Promise.all([this.alunos(alunoId), this.avaliacoes(alunoId)]);
            const periodo = this.analise.periodoHistorico(avaliacoes);
            const presencas = await this.presencas(periodo, alunoId);
            const lista = alunos.map((aluno) => {
                const avaliacoesDoAluno = avaliacoes.filter((avaliacao) => avaliacao.alunoId === aluno.id);
                const presencasDoAluno = presencas.filter((presenca) => presenca.alunoId === aluno.id);
                const frequencia = this.analise.frequenciaAtual(aluno.id, aluno.nome, presencasDoAluno);
                return {
                    alunoId: aluno.id,
                    alunoNome: aluno.nome,
                    ativo: aluno.ativo,
                    frequencia,
                    analise: this.analise.calcular(frequencia, presencasDoAluno, avaliacoesDoAluno)
                };
            });
            const distribuicao = { baixa: 0, media: 0, alta: 0 };
            for (const item of lista)
                distribuicao[item.analise.faixaAtual]++;
            return {
                geradoEm: new Date().toISOString(),
                periodo,
                alunos: lista,
                distribuicao,
                frequenciaMedia: lista.length
                    ? Math.round((lista.reduce((soma, item) => soma + item.frequencia.percentual, 0) / lista.length) * 10) / 10
                    : 0,
                totalPresencas: lista.reduce((soma, item) => soma + item.frequencia.totalPresencas, 0),
                totalAvaliacoes: lista.reduce((soma, item) => soma + item.analise.totalAvaliacoes, 0)
            };
        };
    }
}
exports.AssiduidadeRepository = AssiduidadeRepository;
class AssiduidadeIpc {
    constructor(sessao, repositorio = new AssiduidadeRepository()) {
        this.sessao = sessao;
        this.repositorio = repositorio;
        this.id = (valor) => {
            if (valor === undefined || valor === null || valor === '')
                return null;
            const numero = typeof valor === 'number' ? valor : Number(valor);
            return Number.isInteger(numero) && numero > 0 ? numero : null;
        };
        this.registrar = () => {
            (0, SegurancaIpc_1.registrarCanal)('assiduidade:relatorio', async (_evento, entrada) => {
                this.sessao.exigir(['admin', 'instrutor']);
                const filtro = typeof entrada === 'object' && entrada !== null ? entrada : {};
                return this.repositorio.relatorio(this.id(filtro.alunoId));
            });
        };
    }
}
exports.AssiduidadeIpc = AssiduidadeIpc;
