"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitanteIpc = void 0;
const SegurancaIpc_1 = require("../SegurancaIpc");
const Banco_1 = require("../Banco");
const BancoErros_1 = require("../BancoErros");
const RegrasAula_1 = require("../aulas/RegrasAula");
const TIMEOUT = 15000;
const TIPOS = ['experimental', 'visitante'];
const STATUS = ['agendado', 'compareceu', 'faltou', 'convertido'];
class ErroVisitante extends Error {
}
const dataStr = (valor) => String(valor ?? '').slice(0, 10);
class VisitanteValidador {
    texto(valor, max) {
        if (typeof valor !== 'string')
            return null;
        const limpo = valor.trim();
        return limpo.length <= max ? limpo : null;
    }
    nome(valor) {
        const nome = this.texto(valor, 120);
        return nome && nome.length >= 2 ? nome : null;
    }
    telefone(valor) {
        const telefone = this.texto(valor, 20);
        return telefone && telefone.replace(/\D/g, '').length >= 8 ? telefone : null;
    }
    email(valor) {
        const email = this.texto(valor, 160)?.toLowerCase() ?? null;
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    }
    emailOpcional(valor) {
        if (valor === undefined || valor === null || valor === '')
            return undefined;
        return this.email(valor);
    }
    id(valor) {
        if (valor === undefined || valor === null || valor === '')
            return null;
        const id = Number(valor);
        return Number.isInteger(id) && id > 0 ? id : null;
    }
    data(valor) {
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
    }
    tipo(valor) {
        return typeof valor === 'string' && TIPOS.includes(valor) ? valor : null;
    }
    status(valor) {
        return typeof valor === 'string' && STATUS.includes(valor) ? valor : null;
    }
    observacoes(valor) {
        if (valor === undefined || valor === null || valor === '')
            return undefined;
        return this.texto(valor, 255);
    }
    validarCriacao(entrada) {
        if (typeof entrada !== 'object' || entrada === null)
            return { ok: false, mensagem: 'Dados inválidos.' };
        const e = entrada;
        const nome = this.nome(e.nome);
        if (!nome)
            return { ok: false, mensagem: 'Informe o nome do visitante com 2 a 120 caracteres.' };
        const telefone = this.telefone(e.telefone);
        if (!telefone)
            return { ok: false, mensagem: 'Informe um telefone válido.' };
        const email = this.emailOpcional(e.email);
        if (email === null)
            return { ok: false, mensagem: 'Informe um e-mail válido ou deixe o campo vazio.' };
        const dataVisita = this.data(e.dataVisita);
        if (!dataVisita)
            return { ok: false, mensagem: 'Informe uma data de visita válida.' };
        const tipo = this.tipo(e.tipo);
        if (!tipo)
            return { ok: false, mensagem: 'Selecione o tipo de visita.' };
        const observacoes = this.observacoes(e.observacoes);
        if (observacoes === null)
            return { ok: false, mensagem: 'As observações devem ter no máximo 255 caracteres.' };
        let aulaId;
        if (e.aulaId !== undefined && e.aulaId !== null && e.aulaId !== '') {
            const id = this.id(e.aulaId);
            if (id === null)
                return { ok: false, mensagem: 'Selecione uma aula válida.' };
            aulaId = id;
        }
        return { ok: true, dados: { nome, telefone, email, aulaId, dataVisita, tipo, observacoes } };
    }
    validarAtualizacao(entrada) {
        if (typeof entrada !== 'object' || entrada === null)
            return { ok: false, mensagem: 'Dados inválidos.' };
        const e = entrada;
        const id = this.id(e.id);
        if (id === null)
            return { ok: false, mensagem: 'Visitante inválido.' };
        const dados = { id };
        if (e.nome !== undefined) {
            const nome = this.nome(e.nome);
            if (!nome)
                return { ok: false, mensagem: 'Nome inválido.' };
            dados.nome = nome;
        }
        if (e.telefone !== undefined) {
            const telefone = this.telefone(e.telefone);
            if (!telefone)
                return { ok: false, mensagem: 'Telefone inválido.' };
            dados.telefone = telefone;
        }
        if (e.email !== undefined) {
            if (e.email === null || e.email === '') {
                dados.email = null;
            }
            else {
                const email = this.email(e.email);
                if (!email)
                    return { ok: false, mensagem: 'E-mail inválido.' };
                dados.email = email;
            }
        }
        if (e.aulaId !== undefined) {
            if (e.aulaId === null || e.aulaId === '') {
                dados.aulaId = null;
            }
            else {
                const aulaId = this.id(e.aulaId);
                if (aulaId === null)
                    return { ok: false, mensagem: 'Aula inválida.' };
                dados.aulaId = aulaId;
            }
        }
        if (e.dataVisita !== undefined) {
            const dataVisita = this.data(e.dataVisita);
            if (!dataVisita)
                return { ok: false, mensagem: 'Data de visita inválida.' };
            dados.dataVisita = dataVisita;
        }
        if (e.tipo !== undefined) {
            const tipo = this.tipo(e.tipo);
            if (!tipo)
                return { ok: false, mensagem: 'Tipo de visita inválido.' };
            dados.tipo = tipo;
        }
        if (e.status !== undefined) {
            const status = this.status(e.status);
            if (!status)
                return { ok: false, mensagem: 'Status inválido.' };
            dados.status = status;
        }
        if (e.observacoes !== undefined) {
            if (e.observacoes === null || e.observacoes === '') {
                dados.observacoes = null;
            }
            else {
                const observacoes = this.texto(e.observacoes, 255);
                if (observacoes === null)
                    return { ok: false, mensagem: 'Observações inválidas.' };
                dados.observacoes = observacoes;
            }
        }
        return { ok: true, dados };
    }
    filtro(entrada) {
        if (typeof entrada !== 'object' || entrada === null)
            return {};
        const e = entrada;
        const filtro = {};
        if (typeof e.data === 'string') {
            const data = this.data(e.data);
            if (data)
                filtro.data = data;
        }
        if (typeof e.tipo === 'string') {
            const tipo = this.tipo(e.tipo);
            if (tipo)
                filtro.tipo = tipo;
        }
        if (typeof e.status === 'string') {
            const status = this.status(e.status);
            if (status)
                filtro.status = status;
        }
        if (typeof e.busca === 'string') {
            const busca = e.busca.trim().slice(0, 120);
            if (busca)
                filtro.busca = busca;
        }
        return filtro;
    }
}
const mapear = (linha) => ({
    id: Number(linha.id),
    nome: String(linha.nome ?? ''),
    telefone: String(linha.telefone ?? ''),
    email: linha.email ? String(linha.email) : undefined,
    aulaId: linha.aula_id === null || linha.aula_id === undefined ? undefined : Number(linha.aula_id),
    aulaTitulo: linha.aula_titulo ? String(linha.aula_titulo) : undefined,
    aulaDataHoraInicio: linha.aula_data_hora_inicio ? String(linha.aula_data_hora_inicio) : undefined,
    dataVisita: dataStr(linha.data_visita),
    tipo: String(linha.tipo),
    status: String(linha.status),
    observacoes: linha.observacoes ? String(linha.observacoes) : undefined,
    criadoEm: String(linha.criado_em ?? ''),
    atualizadoEm: String(linha.atualizado_em ?? '')
});
class VisitanteRepository {
    constructor(regras = new RegrasAula_1.RegrasAulaService(Banco_1.Banco.pool)) {
        this.regras = regras;
        this.pool = Banco_1.Banco.pool;
        this.campos = `
    v.id, v.nome, v.telefone, v.email, v.aula_id,
    a.titulo AS aula_titulo, a.data_hora_inicio AS aula_data_hora_inicio,
    v.data_visita, v.tipo, v.status, v.observacoes, v.criado_em, v.atualizado_em`;
        this.listar = async (filtro) => {
            const condicoes = [];
            const valores = [];
            if (filtro.data) {
                condicoes.push('v.data_visita = ?');
                valores.push(filtro.data);
            }
            if (filtro.tipo) {
                condicoes.push('v.tipo = ?');
                valores.push(filtro.tipo);
            }
            if (filtro.status) {
                condicoes.push('v.status = ?');
                valores.push(filtro.status);
            }
            if (filtro.busca) {
                const termo = `%${filtro.busca.replace(/[\\%_]/g, '\\$&')}%`;
                condicoes.push('(v.nome LIKE ? OR v.telefone LIKE ?)');
                valores.push(termo, termo);
            }
            const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
            const [linhas] = await this.pool.query({
                sql: `SELECT ${this.campos}
            FROM visitantes v
            LEFT JOIN aulas a ON a.id = v.aula_id
            ${where}
            ORDER BY v.data_visita DESC, v.nome ASC`,
                values: valores,
                timeout: TIMEOUT
            });
            return linhas.map(mapear);
        };
        this.obter = async (id) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT ${this.campos}
            FROM visitantes v
            LEFT JOIN aulas a ON a.id = v.aula_id
            WHERE v.id = ?
            LIMIT 1`,
                values: [id],
                timeout: TIMEOUT
            });
            return linhas.length ? mapear(linhas[0]) : null;
        };
        this.travarAulaVisitante = async (conexao, aulaId) => {
            try {
                return await this.regras.travarAula(conexao, aulaId);
            }
            catch (erro) {
                if (erro instanceof RegrasAula_1.ErroAula) {
                    throw new ErroVisitante('A aula selecionada não existe mais. Escolha outra aula.');
                }
                throw erro;
            }
        };
        this.criar = async (dados) => this.regras.executarTransacao(async (conexao) => {
            await this.regras.validarVisitanteUnicoPorDia(conexao, {
                nome: dados.nome,
                telefone: dados.telefone,
                email: dados.email,
                dataVisita: dados.dataVisita,
                aulaId: dados.aulaId ?? null
            });
            if (dados.aulaId !== undefined) {
                const aula = await this.travarAulaVisitante(conexao, dados.aulaId);
                await this.regras.validarCapacidade(conexao, dados.aulaId, aula.capacidadeMax, 1);
            }
            const [resultado] = await conexao.query({
                sql: `INSERT INTO visitantes
          (nome, telefone, email, aula_id, data_visita, tipo, status, observacoes, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, 'agendado', ?, NOW(), NOW())`,
                values: [
                    dados.nome,
                    dados.telefone,
                    dados.email ?? null,
                    dados.aulaId ?? null,
                    dados.dataVisita,
                    dados.tipo,
                    dados.observacoes ?? null
                ],
                timeout: TIMEOUT
            });
            return Number(resultado.insertId);
        });
        this.atualizar = async (dados) => this.regras.executarTransacao(async (conexao) => {
            const [existentes] = await conexao.query({
                sql: `SELECT id, nome, telefone, email, aula_id, data_visita, status
              FROM visitantes WHERE id = ? LIMIT 1 FOR UPDATE`,
                values: [dados.id],
                timeout: TIMEOUT
            });
            if (!existentes.length)
                return false;
            const atual = existentes[0];
            await this.regras.validarVisitanteUnicoPorDia(conexao, {
                nome: dados.nome ?? String(atual.nome),
                telefone: dados.telefone ?? String(atual.telefone),
                email: dados.email === undefined ? atual.email ?? null : dados.email,
                dataVisita: dados.dataVisita ?? dataStr(atual.data_visita),
                aulaId: dados.aulaId !== undefined
                    ? dados.aulaId
                    : atual.aula_id === null || atual.aula_id === undefined
                        ? null
                        : Number(atual.aula_id),
                ignorarVisitanteId: dados.id
            });
            const aulaId = dados.aulaId !== undefined
                ? dados.aulaId
                : atual.aula_id === null || atual.aula_id === undefined
                    ? null
                    : Number(atual.aula_id);
            const status = dados.status ?? String(atual.status);
            const ocupava = ['agendado', 'compareceu'].includes(String(atual.status));
            const ocupara = status === 'agendado' || status === 'compareceu';
            if (aulaId !== null) {
                const aula = await this.travarAulaVisitante(conexao, aulaId);
                if (ocupara) {
                    const mesmaAula = aulaId === Number(atual.aula_id);
                    await this.regras.validarCapacidade(conexao, aulaId, aula.capacidadeMax, ocupava && mesmaAula ? 0 : 1);
                }
            }
            const campos = [];
            const valores = [];
            const set = (coluna, valor) => {
                campos.push(`${coluna} = ?`);
                valores.push(valor);
            };
            if (dados.nome !== undefined)
                set('nome', dados.nome);
            if (dados.telefone !== undefined)
                set('telefone', dados.telefone);
            if (dados.email !== undefined)
                set('email', dados.email);
            if (dados.aulaId !== undefined)
                set('aula_id', dados.aulaId);
            if (dados.dataVisita !== undefined)
                set('data_visita', dados.dataVisita);
            if (dados.tipo !== undefined)
                set('tipo', dados.tipo);
            if (dados.status !== undefined)
                set('status', dados.status);
            if (dados.observacoes !== undefined)
                set('observacoes', dados.observacoes);
            if (!campos.length)
                return true;
            campos.push('atualizado_em = NOW()');
            await conexao.query({
                sql: `UPDATE visitantes SET ${campos.join(', ')} WHERE id = ?`,
                values: [...valores, dados.id],
                timeout: TIMEOUT
            });
            return true;
        });
        this.excluir = async (id) => {
            const [resultado] = await this.pool.query({
                sql: 'DELETE FROM visitantes WHERE id = ?',
                values: [id],
                timeout: TIMEOUT
            });
            return resultado.affectedRows > 0;
        };
    }
}
class VisitanteIpc {
    constructor(sessao, repositorio = new VisitanteRepository()) {
        this.sessao = sessao;
        this.repositorio = repositorio;
        this.validador = new VisitanteValidador();
        this.erro = (contexto, erro, padrao) => {
            if (erro instanceof ErroVisitante || erro instanceof RegrasAula_1.ErroAula)
                return { ok: false, mensagem: erro.message };
            console.error(`[${contexto}]`, erro);
            return { ok: false, mensagem: BancoErros_1.BancoErros.mensagem(erro, padrao) };
        };
        this.registrar = () => {
            (0, SegurancaIpc_1.registrarCanal)('visitantes:listar', async (_evento, entrada) => {
                this.sessao.exigir(['admin', 'instrutor']);
                return this.repositorio.listar(this.validador.filtro(entrada));
            });
            (0, SegurancaIpc_1.registrarCanal)('visitantes:obter', async (_evento, entrada) => {
                this.sessao.exigir(['admin', 'instrutor']);
                const id = this.idValido(entrada);
                if (id === null)
                    throw new Error('Visitante inválido.');
                return this.repositorio.obter(id);
            });
            (0, SegurancaIpc_1.registrarCanal)('visitantes:criar', async (_evento, entrada) => {
                this.sessao.exigir(['admin', 'instrutor']);
                const v = this.validador.validarCriacao(entrada);
                if (!v.ok)
                    return v;
                try {
                    const id = await this.repositorio.criar(v.dados);
                    return { ok: true, id };
                }
                catch (erro) {
                    return this.erro('visitantes:criar', erro, 'Não foi possível cadastrar o visitante.');
                }
            });
            (0, SegurancaIpc_1.registrarCanal)('visitantes:atualizar', async (_evento, entrada) => {
                this.sessao.exigir(['admin', 'instrutor']);
                const v = this.validador.validarAtualizacao(entrada);
                if (!v.ok)
                    return v;
                try {
                    const ok = await this.repositorio.atualizar(v.dados);
                    if (!ok)
                        return { ok: false, mensagem: 'Visitante não encontrado.' };
                    return { ok: true, id: v.dados.id };
                }
                catch (erro) {
                    return this.erro('visitantes:atualizar', erro, 'Não foi possível atualizar o visitante.');
                }
            });
            (0, SegurancaIpc_1.registrarCanal)('visitantes:excluir', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const id = this.idValido(entrada);
                if (id === null)
                    return { ok: false, mensagem: 'Visitante inválido.' };
                try {
                    const ok = await this.repositorio.excluir(id);
                    if (!ok)
                        return { ok: false, mensagem: 'Visitante não encontrado.' };
                    return { ok: true, id };
                }
                catch (erro) {
                    return this.erro('visitantes:excluir', erro, 'Não foi possível excluir o visitante.');
                }
            });
        };
    }
    idValido(valor) {
        const id = typeof valor === 'number' ? valor : typeof valor === 'string' ? Number(valor) : NaN;
        return Number.isInteger(id) && id > 0 ? id : null;
    }
}
exports.VisitanteIpc = VisitanteIpc;
