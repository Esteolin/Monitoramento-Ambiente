"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const AssiduidadeBackend_1 = require("./assiduidade/AssiduidadeBackend");
const JanelaApp_1 = require("./JanelaApp");
const Sessao_1 = require("./Sessao");
const AlunoBackend_1 = require("./alunos/AlunoBackend");
const AulaBackend_1 = require("./aulas/AulaBackend");
const AvaliacaoBackend_1 = require("./avaliacoes/AvaliacaoBackend");
const AutenticacaoBackend_1 = require("./autenticacao/AutenticacaoBackend");
const FuncionarioBackend_1 = require("./funcionarios/FuncionarioBackend");
const InadimplenciaBackend_1 = require("./inadimplencia/InadimplenciaBackend");
const LancamentoBackend_1 = require("./lancamentos/LancamentoBackend");
const CepBackend_1 = require("./integracoes/CepBackend");
const ClimaBackend_1 = require("./integracoes/ClimaBackend");
const FeriadosBackend_1 = require("./integracoes/FeriadosBackend");
const WgerBackend_1 = require("./integracoes/WgerBackend");
const BotClima_1 = require("./mensagens/BotClima");
const DecisaoClima_1 = require("./mensagens/DecisaoClima");
const MenuBackend_1 = require("./menu/MenuBackend");
const BotVencimento_1 = require("./notificacoes/BotVencimento");
const NotificacaoBackend_1 = require("./notificacoes/NotificacaoBackend");
const PagamentoBackend_1 = require("./pagamentos/PagamentoBackend");
const PlanosBackend_1 = require("./planos/PlanosBackend");
const PresencaBackend_1 = require("./presencas/PresencaBackend");
const RelatorioBackend_1 = require("./relatorios/RelatorioBackend");
const UsuarioBackend_1 = require("./usuarios/UsuarioBackend");
const VisitanteBackend_1 = require("./visitantes/VisitanteBackend");
const CSP = [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src 'self' data: file: https://wger.de",
    "font-src 'self'",
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
].join('; ');
class Aplicacao {
    constructor() {
        this.sessao = new Sessao_1.Sessao();
        this.visivel = null;
        this.encerrando = false;
        this.login = new JanelaApp_1.JanelaApp({
            pasta: 'autenticacao',
            nome: 'login',
            largura: 1200,
            altura: 760,
            redimensionavel: false
        });
        this.menu = new JanelaApp_1.JanelaApp({ pasta: 'menu', nome: 'menu', largura: 1000, altura: 700 });
        this.mostrar = (janela) => {
            if (this.visivel && this.visivel !== janela)
                this.visivel.ocultar();
            janela.abrir();
            this.visivel = janela;
        };
        this.abrirModulo = (janela) => () => {
            this.mostrar(janela);
        };
        this.aoFecharModulo = () => {
            if (this.encerrando)
                return;
            this.visivel = null;
            this.mostrar(this.menu);
        };
        this.aoEntrar = () => {
            this.login.ocultar();
            this.mostrar(this.menu);
            this.login.fechar();
        };
        this.aoSair = () => {
            this.encerrando = true;
            Object.values(this.modulos).forEach((janela) => janela.fechar());
            this.menu.fechar();
            this.visivel = null;
            this.encerrando = false;
            this.mostrar(this.login);
        };
        this.aoVoltar = (origem) => {
            if (origem && !origem.isDestroyed())
                origem.close();
            this.mostrar(this.menu);
        };
        this.abrirInicial = () => {
            if (this.visivel) {
                this.visivel.abrir();
                return;
            }
            this.mostrar(this.sessao.usuario() ? this.menu : this.login);
        };
        this.configurarSeguranca = () => {
            electron_1.session.defaultSession.setPermissionRequestHandler((_conteudo, _permissao, callback) => callback(false));
            electron_1.session.defaultSession.setPermissionCheckHandler(() => false);
            electron_1.session.defaultSession.webRequest.onHeadersReceived((detalhes, callback) => {
                callback({
                    responseHeaders: {
                        ...detalhes.responseHeaders,
                        'Content-Security-Policy': [CSP]
                    }
                });
            });
        };
        this.registrarIpc = (botClima, decisaoClima, notificacaoServico, botVencimento) => {
            new AutenticacaoBackend_1.AutenticacaoIpc(new AutenticacaoBackend_1.AutenticacaoServico(), this.sessao, this.aoEntrar, this.aoSair).registrar();
            new CepBackend_1.CepIpc(this.sessao).registrar();
            new ClimaBackend_1.ClimaIpc(this.sessao).registrar();
            new FeriadosBackend_1.FeriadosIpc(this.sessao).registrar();
            new WgerBackend_1.WgerIpc(this.sessao).registrar();
            new BotClima_1.BotClimaIpc(this.sessao, botClima).registrar();
            new AlunoBackend_1.AlunoIpc(this.sessao).registrar();
            new AulaBackend_1.AulaIpc(this.sessao).registrar();
            new AvaliacaoBackend_1.AvaliacaoIpc(this.sessao).registrar();
            new PresencaBackend_1.PresencaResumoIpc(this.sessao).registrar();
            new PresencaBackend_1.PresencaCrudIpc(this.sessao).registrar();
            new PlanosBackend_1.PlanoIpc(this.sessao).registrar();
            new PlanosBackend_1.AssinaturaIpc(this.sessao).registrar();
            new PagamentoBackend_1.PagamentoIpc(this.sessao).registrar();
            new InadimplenciaBackend_1.InadimplenciaIpc(this.sessao).registrar();
            new LancamentoBackend_1.LancamentoIpc(this.sessao).registrar();
            new VisitanteBackend_1.VisitanteIpc(this.sessao).registrar();
            new NotificacaoBackend_1.NotificacaoIpc(this.sessao, botVencimento, notificacaoServico).registrar();
            new FuncionarioBackend_1.FuncionarioIpc(this.sessao).registrar();
            new FuncionarioBackend_1.ModalidadeIpc(this.sessao).registrar();
            new RelatorioBackend_1.RelatorioIpc(this.sessao).registrar();
            new AssiduidadeBackend_1.AssiduidadeIpc(this.sessao).registrar();
            new UsuarioBackend_1.UsuarioIpc(this.sessao).registrar();
            const telas = {};
            for (const id of Object.keys(this.modulos)) {
                telas[id] = this.abrirModulo(this.modulos[id]);
            }
            new MenuBackend_1.MenuIpc(this.sessao, telas, this.aoVoltar).registrar();
        };
        this.iniciar = () => {
            electron_1.app.whenReady().then(() => {
                if (process.platform === 'win32')
                    electron_1.app.setAppUserModelId('com.cotil.academia');
                this.configurarSeguranca();
                const botClima = new BotClima_1.BotClimaServico();
                const decisaoClima = new DecisaoClima_1.ServidorDecisaoClima();
                const notificacaoServico = new NotificacaoBackend_1.NotificacaoServico();
                const botVencimento = new BotVencimento_1.BotVencimentoServico(notificacaoServico);
                this.registrarIpc(botClima, decisaoClima, notificacaoServico, botVencimento);
                this.abrirInicial();
                botClima.iniciar();
                decisaoClima.iniciar();
                botVencimento.iniciar();
                electron_1.app.on('before-quit', () => {
                    botClima.encerrar();
                    decisaoClima.encerrar();
                    botVencimento.encerrar();
                });
                electron_1.app.on('activate', this.abrirInicial);
            });
            electron_1.app.on('window-all-closed', () => {
                if (process.platform !== 'darwin')
                    electron_1.app.quit();
            });
        };
        const criarModulo = (pasta, largura, altura, nome = pasta) => new JanelaApp_1.JanelaApp({
            pasta,
            nome,
            largura,
            altura,
            aoFechar: () => this.aoFecharModulo()
        });
        this.modulos = {
            relatorios: criarModulo('relatorios', 1000, 700),
            assiduidade: criarModulo('assiduidade', 1280, 860),
            usuarios: criarModulo('usuarios', 1000, 700),
            funcionarios: criarModulo('funcionarios', 1200, 760),
            alunos: criarModulo('alunos', 1200, 760),
            aulas: criarModulo('aulas', 1280, 800),
            planos: criarModulo('planos', 1280, 800),
            pagamentos: criarModulo('pagamentos', 1280, 820),
            lancamentos: criarModulo('lancamentos', 1100, 760),
            visitantes: criarModulo('visitantes', 1280, 800),
            avaliacoes: criarModulo('avaliacoes', 1280, 820),
            notificacoes: criarModulo('notificacoes', 1280, 820),
            presencas: criarModulo('presencas', 1280, 800),
            inscricoes: criarModulo('inscricoes', 1280, 800),
            feriados: criarModulo('feriados', 1100, 760),
            exercicios: criarModulo('exercicios', 1200, 820),
            portal: criarModulo('portal', 1280, 900),
            bot: criarModulo('mensagens', 1000, 820)
        };
    }
}
new Aplicacao().iniciar();
