"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAS_ANTES_PADRAO = exports.NotificacaoIpc = exports.NotificacaoServico = void 0;
const SegurancaIpc_1 = require("../SegurancaIpc");
const Banco_1 = require("../Banco");
const BancoErros_1 = require("../BancoErros");
const EmailBackend_1 = require("../integracoes/EmailBackend");
const RegrasInadimplencia_1 = require("../inadimplencia/RegrasInadimplencia");
const TIMEOUT = 15000;
const DIAS_ANTES_PADRAO = 7;
exports.DIAS_ANTES_PADRAO = DIAS_ANTES_PADRAO;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIPOS = ['vencimento', 'chuva', 'experimental', 'geral'];
const STATUS = ['pendente', 'enviado', 'falhou'];
const dataStr = (valor) => String(valor ?? '').slice(0, 10);
const dataBr = (valor) => {
    const [ano, mes, dia] = dataStr(valor).split('-');
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
};
const competenciaBr = (valor) => {
    const [ano, mes] = dataStr(valor).split('-');
    return ano && mes ? `${mes}/${ano}` : valor;
};
const moedaBr = (valor) => Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mapear = (linha) => ({
    id: Number(linha.id),
    usuarioId: linha.usuario_id === null || linha.usuario_id === undefined ? undefined : Number(linha.usuario_id),
    usuarioNome: linha.usuario_nome ? String(linha.usuario_nome) : undefined,
    aulaId: linha.aula_id === null || linha.aula_id === undefined ? undefined : Number(linha.aula_id),
    pagamentoId: linha.pagamento_id === null || linha.pagamento_id === undefined ? undefined : Number(linha.pagamento_id),
    destinatarioEmail: String(linha.destinatario_email ?? ''),
    tipo: String(linha.tipo),
    canal: String(linha.canal),
    assunto: String(linha.assunto ?? ''),
    mensagem: String(linha.mensagem ?? ''),
    status: String(linha.status),
    erro: linha.erro ? String(linha.erro) : undefined,
    criadoEm: String(linha.criado_em ?? ''),
    enviadoEm: linha.enviado_em ? String(linha.enviado_em) : undefined
});
class NotificacaoRepository {
    constructor() {
        this.pool = Banco_1.Banco.pool;
        this.pagamentosVencendo = async (diasAntes) => {
            const tiposLongos = RegrasInadimplencia_1.TIPOS_PLANO_LONGO.map(() => '?').join(', ');
            const [linhas] = await this.pool.query({
                sql: `SELECT pg.id AS pagamento_id, al.id AS aluno_id, u.id AS usuario_id,
                   u.nome AS aluno_nome, u.email AS aluno_email, pl.nome AS plano_nome,
                   pl.tipo AS plano_tipo,
                   pg.competencia, pg.valor, pg.data_vencimento, pg.status AS status_pagamento
            FROM pagamentos pg
            INNER JOIN assinaturas a ON a.id = pg.assinatura_id
            INNER JOIN alunos al ON al.id = a.aluno_id
            INNER JOIN usuarios u ON u.id = al.usuario_id
            INNER JOIN planos pl ON pl.id = a.plano_id
            WHERE pg.status IN ('pendente', 'atrasado')
              AND al.ativo = 1
              AND u.ativo = 1
              AND pg.data_vencimento BETWEEN
                    DATE_SUB(CURDATE(), INTERVAL IF(LOWER(pl.tipo) IN (${tiposLongos}), 120, 30) DAY)
                    AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
              AND NOT EXISTS (
                SELECT 1 FROM notificacoes n
                WHERE n.pagamento_id = pg.id
                  AND n.tipo = 'vencimento'
                  AND n.status = 'enviado'
                  AND n.criado_em >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              )
            ORDER BY pg.data_vencimento ASC, u.nome ASC
            LIMIT 500`,
                values: [...RegrasInadimplencia_1.TIPOS_PLANO_LONGO, diasAntes],
                timeout: TIMEOUT
            });
            return linhas.map((linha) => ({
                pagamentoId: Number(linha.pagamento_id),
                alunoId: Number(linha.aluno_id),
                usuarioId: Number(linha.usuario_id),
                alunoNome: String(linha.aluno_nome ?? ''),
                email: String(linha.aluno_email ?? ''),
                planoNome: String(linha.plano_nome ?? ''),
                planoTipo: String(linha.plano_tipo ?? ''),
                competencia: dataStr(linha.competencia),
                valor: Number(linha.valor ?? 0),
                dataVencimento: dataStr(linha.data_vencimento),
                statusPagamento: String(linha.status_pagamento ?? 'pendente')
            }));
        };
        this.criar = async (dados) => {
            const [resultado] = await this.pool.query({
                sql: `INSERT INTO notificacoes
        (usuario_id, pagamento_id, destinatario_email, tipo, canal, assunto, mensagem, status, criado_em)
        VALUES (?, ?, ?, 'vencimento', ?, ?, ?, ?, NOW())`,
                values: [
                    dados.usuarioId,
                    dados.pagamentoId,
                    dados.destinatarioEmail,
                    dados.canal ?? 'email',
                    dados.assunto,
                    dados.mensagem,
                    dados.statusInicial ?? 'pendente'
                ],
                timeout: TIMEOUT
            });
            return Number(resultado.insertId);
        };
        this.atualizarStatus = async (id, status, erro) => {
            await this.pool.query({
                sql: `UPDATE notificacoes
            SET status = ?, erro = ?, enviado_em = CASE WHEN ? = 'enviado' THEN NOW() ELSE NULL END
            WHERE id = ?`,
                values: [status, erro ? erro.slice(0, 255) : null, status, id],
                timeout: TIMEOUT
            });
        };
        this.criarManual = async (dados) => {
            const [resultado] = await this.pool.query({
                sql: `INSERT INTO notificacoes
            (usuario_id, aula_id, pagamento_id, destinatario_email, tipo, canal,
             assunto, mensagem, status, erro, enviado_em, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'enviado' THEN NOW() ELSE NULL END, NOW())`,
                values: [
                    dados.usuarioId ?? null,
                    dados.aulaId ?? null,
                    dados.pagamentoId ?? null,
                    dados.destinatarioEmail,
                    dados.tipo,
                    dados.canal,
                    dados.assunto,
                    dados.mensagem,
                    dados.status,
                    dados.erro ?? null,
                    dados.status
                ],
                timeout: TIMEOUT
            });
            return Number(resultado.insertId);
        };
        this.atualizarManual = async (dados) => {
            const [resultado] = await this.pool.query({
                sql: `UPDATE notificacoes
            SET usuario_id = ?, aula_id = ?, pagamento_id = ?, destinatario_email = ?,
                tipo = ?, canal = ?, assunto = ?, mensagem = ?, status = ?, erro = ?,
                enviado_em = CASE
                  WHEN ? = 'enviado' AND enviado_em IS NULL THEN NOW()
                  WHEN ? = 'enviado' THEN enviado_em
                  ELSE NULL
                END
            WHERE id = ?`,
                values: [
                    dados.usuarioId ?? null,
                    dados.aulaId ?? null,
                    dados.pagamentoId ?? null,
                    dados.destinatarioEmail,
                    dados.tipo,
                    dados.canal,
                    dados.assunto,
                    dados.mensagem,
                    dados.status,
                    dados.erro ?? null,
                    dados.status,
                    dados.status,
                    dados.id
                ],
                timeout: TIMEOUT
            });
            return resultado.affectedRows > 0;
        };
        this.obter = async (id) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT n.*, u.nome AS usuario_nome
            FROM notificacoes n
            LEFT JOIN usuarios u ON u.id = n.usuario_id
            WHERE n.id = ?
            LIMIT 1`,
                values: [id],
                timeout: TIMEOUT
            });
            return linhas.length ? mapear(linhas[0]) : null;
        };
        this.listar = async (filtro) => {
            const condicoes = [];
            const valores = [];
            if (filtro.tipo) {
                condicoes.push('n.tipo = ?');
                valores.push(filtro.tipo);
            }
            if (filtro.status) {
                condicoes.push('n.status = ?');
                valores.push(filtro.status);
            }
            if (filtro.busca) {
                const termo = `%${filtro.busca.replace(/[\\%_]/g, '\\$&')}%`;
                condicoes.push('(n.destinatario_email LIKE ? OR n.assunto LIKE ? OR u.nome LIKE ?)');
                valores.push(termo, termo, termo);
            }
            const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
            const [linhas] = await this.pool.query({
                sql: `SELECT n.*, u.nome AS usuario_nome
            FROM notificacoes n
            LEFT JOIN usuarios u ON u.id = n.usuario_id
            ${where}
            ORDER BY n.criado_em DESC, n.id DESC
            LIMIT 500`,
                values: valores,
                timeout: TIMEOUT
            });
            return linhas.map(mapear);
        };
        this.minhas = async (usuarioId) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT n.*, u.nome AS usuario_nome
            FROM notificacoes n
            LEFT JOIN usuarios u ON u.id = n.usuario_id
            WHERE n.usuario_id = ?
            ORDER BY n.criado_em DESC, n.id DESC
            LIMIT 200`,
                values: [usuarioId],
                timeout: TIMEOUT
            });
            return linhas.map(mapear);
        };
        this.excluir = async (id) => {
            const [resultado] = await this.pool.query({
                sql: 'DELETE FROM notificacoes WHERE id = ?',
                values: [id],
                timeout: TIMEOUT
            });
            return resultado.affectedRows > 0;
        };
        this.contagens = async () => {
            const [linhas] = await this.pool.query({
                sql: `SELECT
              COALESCE(SUM(status = 'enviado' AND DATE(criado_em) = CURDATE()), 0) AS enviadas_hoje,
              COALESCE(SUM(status = 'falhou' AND DATE(criado_em) = CURDATE()), 0) AS falhas_hoje,
              COALESCE(SUM(status = 'pendente'), 0) AS pendentes
            FROM notificacoes
            WHERE tipo = 'vencimento'`,
                timeout: TIMEOUT
            });
            const linha = linhas[0] ?? {};
            return {
                enviadasHoje: Number(linha.enviadas_hoje ?? 0),
                falhasHoje: Number(linha.falhas_hoje ?? 0),
                pendentes: Number(linha.pendentes ?? 0)
            };
        };
        this.admins = async () => {
            const [linhas] = await this.pool.query({
                sql: `SELECT id, email, nome
            FROM usuarios
            WHERE perfil = ? AND ativo = 1
            ORDER BY id ASC`,
                values: ['admin'],
                timeout: TIMEOUT
            });
            return linhas.map((linha) => ({
                id: Number(linha.id),
                email: String(linha.email ?? ''),
                nome: String(linha.nome ?? '')
            }));
        };
        this.alertaInadimplenciaExiste = async (assunto) => {
            const [linhas] = await this.pool.query({
                sql: `SELECT 1
            FROM notificacoes
            WHERE tipo = 'geral'
              AND canal = 'sistema'
              AND assunto = ?
            LIMIT 1`,
                values: [assunto],
                timeout: TIMEOUT
            });
            return linhas.length > 0;
        };
    }
}
class NotificacaoServico {
    constructor(email = new EmailBackend_1.EmailServico(), repositorio, regras = new RegrasInadimplencia_1.RegrasInadimplencia()) {
        this.email = email;
        this.regras = regras;
        this.emailConfigurado = () => this.email.configurado();
        this.emailRemetente = () => this.email.remetenteFormatado();
        this.situacao = async () => {
            const contagens = await this.repositorio.contagens();
            return {
                smtpConfigurado: this.email.configurado(),
                remetente: this.email.configurado() ? this.email.remetenteFormatado() : undefined,
                ...contagens
            };
        };
        this.listar = async (filtro) => this.repositorio.listar(filtro);
        this.minhas = async (usuarioId) => this.repositorio.minhas(usuarioId);
        this.excluir = async (id) => this.repositorio.excluir(id);
        this.obter = async (id) => this.repositorio.obter(id);
        this.criarManual = async (dados) => this.repositorio.criarManual(dados);
        this.atualizarManual = async (dados) => this.repositorio.atualizarManual(dados);
        this.enviarVencimentos = async (diasAntes = DIAS_ANTES_PADRAO) => {
            const dias = Math.min(60, Math.max(1, Math.round(diasAntes)));
            const emailConfigurado = this.email.configurado();
            const pagamentos = await this.repositorio.pagamentosVencendo(dias);
            const falhas = [];
            const notificacoes = [];
            let enviados = 0;
            let semEmail = 0;
            for (const pagamento of pagamentos) {
                const email = pagamento.email.trim().toLowerCase();
                const emailValido = EMAIL_VALIDO.test(email);
                if (emailConfigurado && !emailValido) {
                    semEmail++;
                    continue;
                }
                const destinatario = emailValido ? email : 'Aviso interno';
                const competencia = competenciaBr(pagamento.competencia);
                const assunto = `Lembrete de vencimento — ${pagamento.planoNome} (${competencia})`;
                const situacao = pagamento.statusPagamento === 'atrasado' ? 'em atraso' : 'em aberto';
                const planoLongo = this.regras.planoLongo(pagamento.planoTipo);
                const mensagem = [
                    `Olá, ${pagamento.alunoNome}!`,
                    '',
                    `Este é um lembrete automático do seu plano ${pagamento.planoNome} na Academia Cotil.`,
                    '',
                    `Mensalidade: ${competencia}`,
                    `Valor: ${moedaBr(pagamento.valor)}`,
                    `Vencimento: ${dataBr(pagamento.dataVencimento)}`,
                    `Situação: ${situacao}`,
                    ...(planoLongo
                        ? [`Atenção: em planos semestrais e anuais, o controle do vencimento é ainda mais importante.`]
                        : []),
                    '',
                    'Se o pagamento já foi realizado, desconsidere este aviso.',
                    '',
                    'Academia Cotil'
                ].join('\n');
                const canal = emailConfigurado ? 'email' : 'sistema';
                const notificacaoId = await this.repositorio.criar({
                    usuarioId: pagamento.usuarioId,
                    pagamentoId: pagamento.pagamentoId,
                    destinatarioEmail: destinatario,
                    assunto,
                    mensagem,
                    canal,
                    statusInicial: emailConfigurado ? 'pendente' : 'enviado'
                });
                if (emailConfigurado) {
                    const resultado = await this.email.enviar([email], assunto, mensagem);
                    const enviado = resultado.enviados > 0;
                    const erro = enviado
                        ? null
                        : resultado.falhas[0]?.erro ?? resultado.erroGeral ?? 'Não foi possível enviar o e-mail.';
                    await this.repositorio.atualizarStatus(notificacaoId, enviado ? 'enviado' : 'falhou', erro);
                    if (enviado) {
                        enviados++;
                    }
                    else {
                        falhas.push({ notificacaoId, email, erro: erro ?? 'Falha ao enviar o e-mail.' });
                    }
                }
                else {
                    enviados++;
                }
                const criada = await this.repositorio.obter(notificacaoId);
                if (criada)
                    notificacoes.push(criada);
            }
            return {
                configurado: emailConfigurado,
                total: pagamentos.length,
                enviados,
                semEmail,
                falhas,
                notificacoes
            };
        };
        this.registrarAlertaInadimplencia = async (resumo) => {
            const haAtrasos = resumo.atrasadosLongos > 0 || resumo.atrasadosLeves > 0;
            if (!haAtrasos && resumo.emAberto <= 0)
                return 0;
            const assunto = `Alerta de inadimplência — ${new Date().toISOString().slice(0, 10)}`;
            if (await this.repositorio.alertaInadimplenciaExiste(assunto))
                return 0;
            const admins = await this.repositorio.admins();
            if (!admins.length)
                return 0;
            const destaquesAtraso = resumo.itens
                .slice(0, 5)
                .map((item) => `${item.alunoNome}: ${item.competencia} (${item.diasAtraso} dias em atraso)`);
            const destaquesAberto = resumo.itensEmAberto
                .slice(0, 5)
                .map((item) => `${item.alunoNome}: ${item.competencia} (em aberto)`);
            const detalhes = [...destaquesAtraso, ...destaquesAberto].slice(0, 5).join('; ');
            const valorAberto = Math.round((resumo.valorTotalAlerta - resumo.valorTotal) * 100) / 100;
            const alunosEmAberto = Math.max(0, resumo.totalAlunosAlerta - resumo.totalAlunos);
            const mensagem = [
                `Pagamentos em atraso: ${resumo.atrasados} envolvendo ${resumo.totalAlunos} aluno(s).`,
                resumo.atrasadosLongos > 0
                    ? `${resumo.atrasadosLongos} pagamento(s) com atraso superior a ${RegrasInadimplencia_1.DIAS_ALERTA_INADIMPLENCIA} dias.`
                    : '',
                resumo.atrasadosLeves > 0
                    ? `${resumo.atrasadosLeves} pagamento(s) com atraso de até ${RegrasInadimplencia_1.DIAS_ALERTA_INADIMPLENCIA} dias.`
                    : '',
                resumo.emAberto > 0
                    ? `${resumo.emAberto} pagamento(s) em aberto ainda não vencido(s) envolvendo ${alunosEmAberto} aluno(s).`
                    : '',
                `Valor em atraso: ${moedaBr(resumo.valorTotal)}.`,
                resumo.emAberto > 0 ? `Valor em aberto: ${moedaBr(valorAberto)}.` : '',
                detalhes ? `Destaques: ${detalhes}.` : ''
            ]
                .filter(Boolean)
                .join('\n');
            let criadas = 0;
            for (const admin of admins) {
                try {
                    await this.repositorio.criarManual({
                        usuarioId: admin.id,
                        aulaId: null,
                        pagamentoId: null,
                        destinatarioEmail: admin.email,
                        tipo: 'geral',
                        canal: 'sistema',
                        assunto,
                        mensagem,
                        status: 'enviado'
                    });
                    criadas++;
                }
                catch (erro) {
                    if (erro.code !== 'ER_DUP_ENTRY')
                        throw erro;
                }
            }
            return criadas;
        };
        this.repositorio = repositorio ?? new NotificacaoRepository();
    }
}
exports.NotificacaoServico = NotificacaoServico;
class NotificacaoValidador {
    id(valor) {
        const numero = typeof valor === 'number' ? valor : typeof valor === 'string' ? Number(valor) : NaN;
        return Number.isInteger(numero) && numero > 0 ? numero : null;
    }
    filtro(entrada) {
        if (typeof entrada !== 'object' || entrada === null)
            return {};
        const e = entrada;
        const filtro = {};
        if (typeof e.tipo === 'string' && TIPOS.includes(e.tipo)) {
            filtro.tipo = e.tipo;
        }
        if (typeof e.status === 'string' && STATUS.includes(e.status)) {
            filtro.status = e.status;
        }
        if (typeof e.busca === 'string') {
            const busca = e.busca.trim();
            if (busca)
                filtro.busca = busca.slice(0, 120);
        }
        return filtro;
    }
    canal(valor) {
        return valor === 'email' || valor === 'sistema' ? valor : null;
    }
    validar(entrada) {
        if (typeof entrada !== 'object' || entrada === null)
            return { ok: false, mensagem: 'Dados inválidos.' };
        const e = entrada;
        let id;
        if (e.id !== undefined) {
            const idValido = this.id(e.id);
            if (idValido === null)
                return { ok: false, mensagem: 'Notificação inválida.' };
            id = idValido;
        }
        const opcional = (valor) => {
            if (valor === undefined || valor === null || valor === '')
                return null;
            return this.id(valor);
        };
        const usuarioId = opcional(e.usuarioId);
        const aulaId = opcional(e.aulaId);
        const pagamentoId = opcional(e.pagamentoId);
        if ([usuarioId, aulaId, pagamentoId].some((valor) => valor !== null && !this.id(valor))) {
            return { ok: false, mensagem: 'Referência inválida.' };
        }
        const destinatarioEmail = typeof e.destinatarioEmail === 'string' ? e.destinatarioEmail.trim().toLowerCase() : '';
        if (!EMAIL_VALIDO.test(destinatarioEmail) || destinatarioEmail.length > 160) {
            return { ok: false, mensagem: 'Informe um e-mail válido.' };
        }
        if (typeof e.tipo !== 'string' || !TIPOS.includes(e.tipo)) {
            return { ok: false, mensagem: 'Selecione um tipo válido.' };
        }
        const canal = this.canal(e.canal);
        if (!canal)
            return { ok: false, mensagem: 'Selecione um canal válido.' };
        const assunto = typeof e.assunto === 'string' ? e.assunto.trim() : '';
        if (assunto.length < 3 || assunto.length > 160) {
            return { ok: false, mensagem: 'Informe um assunto com 3 a 160 caracteres.' };
        }
        const mensagem = typeof e.mensagem === 'string' ? e.mensagem.trim() : '';
        if (!mensagem || mensagem.length > 4000) {
            return { ok: false, mensagem: 'Informe a mensagem com até 4000 caracteres.' };
        }
        if (typeof e.status !== 'string' || !STATUS.includes(e.status)) {
            return { ok: false, mensagem: 'Selecione um status válido.' };
        }
        const erro = typeof e.erro === 'string' ? e.erro.trim().slice(0, 255) || null : null;
        return {
            ok: true,
            dados: {
                id,
                usuarioId,
                aulaId,
                pagamentoId,
                destinatarioEmail,
                tipo: e.tipo,
                canal,
                assunto,
                mensagem,
                status: e.status,
                erro
            }
        };
    }
    idValido(valor) {
        return this.id(valor);
    }
}
class NotificacaoIpc {
    constructor(sessao, agendador, servico = new NotificacaoServico()) {
        this.sessao = sessao;
        this.agendador = agendador;
        this.servico = servico;
        this.validador = new NotificacaoValidador();
        this.erro = (contexto, erro, padrao) => {
            console.error(`[${contexto}]`, erro);
            return { ok: false, mensagem: BancoErros_1.BancoErros.mensagem(erro, padrao) };
        };
        this.erroCadastro = (contexto, erro, padrao) => {
            console.error(`[${contexto}]`, erro);
            return { ok: false, mensagem: BancoErros_1.BancoErros.mensagem(erro, padrao) };
        };
        this.registrar = () => {
            (0, SegurancaIpc_1.registrarCanal)('notificacoes:listar', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                return this.servico.listar(this.validador.filtro(entrada));
            });
            (0, SegurancaIpc_1.registrarCanal)('notificacoes:obter', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const id = this.validador.idValido(entrada);
                if (id === null)
                    throw new Error('Notificação inválida.');
                return this.servico.obter(id);
            });
            (0, SegurancaIpc_1.registrarCanal)('notificacoes:criar', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const v = this.validador.validar(entrada);
                if (!v.ok)
                    return v;
                try {
                    const id = await this.servico.criarManual(v.dados);
                    return { ok: true, id };
                }
                catch (erro) {
                    return this.erroCadastro('notificacoes:criar', erro, 'Não foi possível criar a notificação.');
                }
            });
            (0, SegurancaIpc_1.registrarCanal)('notificacoes:atualizar', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const v = this.validador.validar(entrada);
                if (!v.ok)
                    return v;
                if (v.dados.id === undefined)
                    return { ok: false, mensagem: 'Notificação inválida.' };
                try {
                    const ok = await this.servico.atualizarManual(v.dados);
                    if (!ok)
                        return { ok: false, mensagem: 'Notificação não encontrada.' };
                    return { ok: true, id: v.dados.id };
                }
                catch (erro) {
                    return this.erroCadastro('notificacoes:atualizar', erro, 'Não foi possível atualizar a notificação.');
                }
            });
            (0, SegurancaIpc_1.registrarCanal)('notificacoes:minhas', async () => {
                const usuario = this.sessao.exigir(['aluno']);
                return this.servico.minhas(usuario.id);
            });
            (0, SegurancaIpc_1.registrarCanal)('notificacoes:situacao', async () => {
                this.sessao.exigir(['admin']);
                const situacao = await this.servico.situacao();
                return { ...situacao, agendador: this.agendador?.estado() };
            });
            (0, SegurancaIpc_1.registrarCanal)('notificacoes:excluir', async (_evento, entrada) => {
                this.sessao.exigir(['admin']);
                const id = this.validador.idValido(entrada);
                if (id === null)
                    return { ok: false, mensagem: 'Notificação inválida.' };
                try {
                    const ok = await this.servico.excluir(id);
                    return ok ? { ok: true } : { ok: false, mensagem: 'Notificação não encontrada.' };
                }
                catch (erro) {
                    return this.erro('notificacoes:excluir', erro, 'Não foi possível excluir a notificação.');
                }
            });
        };
    }
}
exports.NotificacaoIpc = NotificacaoIpc;
