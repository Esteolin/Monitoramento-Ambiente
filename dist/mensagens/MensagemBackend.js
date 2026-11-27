"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MensagemServico = exports.textoNotificacaoChuva = void 0;
const electron_1 = require("electron");
const ClimaBackend_1 = require("../integracoes/ClimaBackend");
const EmailBackend_1 = require("../integracoes/EmailBackend");
const DestinatariosAlunos_1 = require("./DestinatariosAlunos");
const AulasAmanha_1 = require("./AulasAmanha");
const NotificacaoChuva_1 = require("./NotificacaoChuva");
const DecisaoClima_1 = require("./DecisaoClima");
const chaveAviso = (aulaId, email) => `${aulaId}|${email.trim().toLowerCase()}`;
const textoNotificacaoChuva = (previsao) => {
    const [ano, mes, dia] = previsao.data.split('-');
    const data = ano && mes && dia ? `${dia}/${mes}/${ano}` : previsao.data;
    const janela = previsao.janela ? ` no horário das aulas (${previsao.janela})` : '';
    const percentual = Math.round(previsao.probabilidadeChuva);
    return (`Caro instrutor, a previsão para amanhã (${data}) indica ${percentual}% de chance de chuva${janela}. ` +
        'Por favor, avise os alunos: cada um poderá cancelar a aula ou movê-la para a área interna.');
};
exports.textoNotificacaoChuva = textoNotificacaoChuva;
class MensagemServico {
    constructor(clima = new ClimaBackend_1.OpenMeteoClient(), emails = new EmailBackend_1.EmailServico(), destinatarios = new DestinatariosAlunos_1.AlunoDestinatarios(), aulas = new AulasAmanha_1.AulasAmanha(), notificacoes = new NotificacaoChuva_1.NotificacaoChuvaRepositorio(), assinador = (0, DecisaoClima_1.obterAssinadorDecisao)()) {
        this.clima = clima;
        this.emails = emails;
        this.destinatarios = destinatarios;
        this.aulas = aulas;
        this.notificacoes = notificacoes;
        this.assinador = assinador;
        this.historico = [];
        this.datasAvisadas = new Set();
        this.proximoId = 1;
        this.marcarAvisoAnterior = (data) => {
            if (data)
                this.datasAvisadas.add(data);
        };
        this.emailConfigurado = () => this.emails.configurado();
        this.emailRemetente = () => this.emails.remetenteFormatado();
        this.testarEmail = async (destinatario) => this.emails.enviar([destinatario], 'Teste do bot de clima - Academia Cotil', 'Se você recebeu esta mensagem, o envio de e-mail do bot está funcionando.');
        this.dataBr = (iso) => {
            const [ano, mes, dia] = iso.split('-');
            return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
        };
        this.horarioAula = (aula) => {
            const hora = `${String(Math.floor(aula.inicioMin / 60)).padStart(2, '0')}:${String(aula.inicioMin % 60).padStart(2, '0')}`;
            return `${this.dataBr(aula.data)} às ${hora}`;
        };
        this.textoDoAviso = (previsao, aula) => {
            const janela = previsao.janela ? ` no horário das aulas (${previsao.janela})` : '';
            return (`Atenção aluno: a previsão para amanhã (${this.dataBr(previsao.data)}) indica chuva${janela} ` +
                `nas aulas ao ar livre. A aula "${aula.titulo}" de ${this.horarioAula(aula)} pode ser ` +
                'cancelada ou transferida para a área interna. A decisão vale para toda a turma.');
        };
        this.textoResumo = (previsao) => `Aviso de chuva para as aulas ao ar livre de amanhã (${this.dataBr(previsao.data)}). ` +
            'O e-mail enviado contém um link para cada aluno escolher entre cancelar a aula ou movê-la para a área interna; a decisão vale para toda a turma.';
        this.montarCorpoEmail = (previsao, itens) => {
            const linhas = itens.map((item) => {
                const link = this.assinador.gerarLink(item.id);
                return `- ${item.aula.titulo} (${this.horarioAula(item.aula)}): ${link}`;
            });
            return (`Atenção aluno: a previsão para amanhã (${this.dataBr(previsao.data)}) indica chuva nas aulas ao ar livre.\n\n` +
                'Escolha, para cada aula abaixo, se deseja cancelar a aula ou movê-la para a área interna. A decisão vale para toda a turma:\n\n' +
                `${linhas.join('\n')}\n\n` +
                'Se você não responder, a aula permanece como está.');
        };
        this.carregarAulasExternas = async () => {
            try {
                return { ok: true, aulas: await this.aulas.listar() };
            }
            catch {
                return { ok: false, mensagem: 'Não foi possível carregar as aulas ao ar livre de amanhã.' };
            }
        };
        this.enviarNotificacao = (assunto, texto) => {
            if (typeof electron_1.Notification === 'undefined' || !electron_1.Notification.isSupported()) {
                return { status: 'falhou', erro: 'Notificações do sistema não estão disponíveis.' };
            }
            try {
                new electron_1.Notification({ title: assunto, body: texto }).show();
                return { status: 'enviado' };
            }
            catch {
                return { status: 'falhou', erro: 'Falha ao enviar a notificação do sistema.' };
            }
        };
        this.montarMotivo = (emails, previsao) => {
            const quando = `para as aulas ao ar livre de amanhã (${this.dataBr(previsao.data)})`;
            if (!emails.configurado) {
                return `Previsão de chuva ${quando}, mas o envio por e-mail não está configurado.`;
            }
            if (emails.total === 0) {
                return `Previsão de chuva ${quando}, mas não há alunos inscritos nas aulas ao ar livre.`;
            }
            const alunos = emails.total === 1 ? 'aluno inscrito' : 'alunos inscritos';
            if (emails.enviados === emails.total) {
                return `Previsão de chuva ${quando}: aviso enviado por e-mail para ${emails.enviados} ${alunos}.`;
            }
            if (emails.enviados > 0) {
                return (`Previsão de chuva ${quando}: aviso enviado para ${emails.enviados} de ${emails.total} ${alunos}. ` +
                    `${emails.falhas.length} envio(s) falharam.`);
            }
            return (`Previsão de chuva ${quando}, mas nenhum e-mail pôde ser enviado. ` +
                (emails.erroGeral ?? 'Verifique as configurações de SMTP.'));
        };
        this.semEnvio = (local, previsao, hoje, motivo) => ({
            ok: true,
            local,
            previsao,
            hoje,
            enviada: false,
            consolidar: false,
            emails: {
                configurado: this.emails.configurado(),
                total: 0,
                enviados: 0,
                falhas: []
            },
            motivo,
            historico: this.listar()
        });
        this.listar = () => [...this.historico].sort((a, b) => b.id - a.id);
        this.verificar = async (limiarChuva = 50) => {
            const numeroLimiar = Number(limiarChuva);
            const limiar = Number.isFinite(numeroLimiar)
                ? Math.min(100, Math.max(0, Math.round(numeroLimiar)))
                : 50;
            const aulasResultado = await this.carregarAulasExternas();
            if (!aulasResultado.ok) {
                return { ok: false, mensagem: aulasResultado.mensagem, historico: this.listar() };
            }
            const aulas = aulasResultado.aulas;
            const resultado = await this.clima.buscar(limiar, aulas.length > 0 ? aulas : undefined);
            if (!resultado.ok) {
                return { ok: false, mensagem: resultado.mensagem, historico: this.listar() };
            }
            const { previsao, local, hoje } = resultado;
            if (aulas.length === 0) {
                return this.semEnvio(local, previsao, hoje, 'Não há aulas ao ar livre amanhã. Nenhum aviso foi enviado.');
            }
            if (!previsao.vaiChover) {
                return this.semEnvio(local, previsao, hoje, `Chance de chuva de ${Math.round(previsao.probabilidadeChuva)}%` +
                    (previsao.janela ? ` no horário das aulas ao ar livre (${previsao.janela})` : '') +
                    ` para amanhã (${this.dataBr(previsao.data)}) abaixo do mínimo configurado (${limiar}%). ` +
                    'Nenhuma mensagem foi enviada.');
            }
            const destinatarios = await this.destinatarios.listarPorAulas(aulas.map((aula) => aula.id));
            if (!destinatarios.ok) {
                return { ok: false, mensagem: destinatarios.mensagem, historico: this.listar() };
            }
            if (destinatarios.alunos.length === 0) {
                return this.semEnvio(local, previsao, hoje, `Previsão de chuva para amanhã (${this.dataBr(previsao.data)}), mas nenhum aluno está inscrito nas aulas ao ar livre. ` +
                    'Nenhum aviso foi enviado.');
            }
            const existentes = await this.notificacoes.existentes(aulas.map((aula) => aula.id));
            const pendentes = destinatarios.alunos.filter((aluno) => existentes.get(chaveAviso(aluno.aulaId, aluno.email))?.status !== 'enviado');
            if (pendentes.length === 0) {
                return {
                    ok: true,
                    local,
                    previsao,
                    hoje,
                    enviada: false,
                    consolidar: true,
                    emails: {
                        configurado: this.emails.configurado(),
                        total: destinatarios.alunos.length,
                        enviados: 0,
                        falhas: []
                    },
                    motivo: `Os avisos de chuva para as aulas ao ar livre de amanhã (${this.dataBr(previsao.data)}) ` +
                        'já foram enviados.',
                    historico: this.listar()
                };
            }
            if (!this.emails.configurado()) {
                return this.semEnvio(local, previsao, hoje, `Previsão de chuva para amanhã (${this.dataBr(previsao.data)}), mas o envio por e-mail não está configurado. ` +
                    'Defina SMTP_HOST, SMTP_USER e SMTP_PASS no .env. Nenhum aviso foi registrado como enviado.');
            }
            const assunto = 'Aulas ao ar livre de amanhã: risco de chuva';
            const aulasPorId = new Map(aulas.map((aula) => [aula.id, aula]));
            const preparados = [];
            for (const aluno of pendentes) {
                const aula = aulasPorId.get(aluno.aulaId);
                if (!aula)
                    continue;
                const existente = existentes.get(chaveAviso(aluno.aulaId, aluno.email));
                try {
                    const id = await this.notificacoes.preparar({
                        aulaId: aluno.aulaId,
                        usuarioId: aluno.usuarioId,
                        email: aluno.email,
                        assunto,
                        mensagem: this.textoDoAviso(previsao, aula)
                    }, existente);
                    if (id !== null) {
                        preparados.push({ id, aula, email: aluno.email.trim().toLowerCase() });
                    }
                }
                catch {
                    // Sem registro no banco não há link confiável: este aluno fica para a próxima tentativa.
                }
            }
            if (preparados.length === 0) {
                return {
                    ok: false,
                    mensagem: 'Não foi possível preparar os avisos de chuva no banco de dados.',
                    historico: this.listar()
                };
            }
            const preparacaoCompleta = preparados.length === pendentes.length;
            const porEmail = new Map();
            for (const item of preparados) {
                const lista = porEmail.get(item.email) ?? [];
                lista.push(item);
                porEmail.set(item.email, lista);
            }
            if (!this.datasAvisadas.has(previsao.data)) {
                this.enviarNotificacao(assunto, this.textoResumo(previsao));
            }
            const falhas = [];
            let enviados = 0;
            for (const [email, itens] of porEmail) {
                const corpo = this.montarCorpoEmail(previsao, itens);
                const resultado = await this.emails.enviar([email], assunto, corpo);
                if (resultado.enviados > 0) {
                    enviados += 1;
                    for (const item of itens) {
                        await this.notificacoes.atualizarResultado(item.id, 'enviado');
                    }
                }
                else {
                    const erro = resultado.falhas[0]?.erro ?? resultado.erroGeral ?? 'Falha ao enviar o e-mail.';
                    falhas.push({ email, erro });
                    for (const item of itens) {
                        await this.notificacoes.atualizarResultado(item.id, 'falhou', erro);
                    }
                }
            }
            const emails = {
                configurado: this.emails.configurado(),
                total: porEmail.size,
                enviados,
                falhas,
                erroGeral: enviados === 0 ? 'Nenhum e-mail pôde ser enviado. Verifique as configurações de SMTP.' : undefined
            };
            const consolidar = preparacaoCompleta && emails.total > 0 && emails.enviados === emails.total;
            const enviada = emails.enviados > 0;
            const status = enviada ? 'enviado' : 'falhou';
            const mensagem = {
                id: this.proximoId++,
                criadaEm: new Date().toISOString(),
                tipo: 'chuva',
                assunto,
                texto: this.textoResumo(previsao),
                status,
                erro: status === 'falhou' ? emails.erroGeral ?? falhas[0]?.erro : undefined,
                dataAula: previsao.data,
                previsao,
                emailConfigurado: emails.configurado,
                destinatarios: emails.total,
                emailsEnviados: emails.enviados,
                falhasEmail: falhas
            };
            this.historico.push(mensagem);
            if (consolidar)
                this.datasAvisadas.add(previsao.data);
            const motivoBase = this.montarMotivo(emails, previsao);
            return {
                ok: true,
                local,
                previsao,
                hoje,
                enviada,
                consolidar,
                emails,
                motivo: preparacaoCompleta
                    ? motivoBase
                    : `${motivoBase} Alguns avisos não puderam ser preparados e serão tentados novamente.`,
                mensagem,
                historico: this.listar()
            };
        };
    }
}
exports.MensagemServico = MensagemServico;
