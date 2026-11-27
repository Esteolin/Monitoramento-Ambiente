"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotVencimentoServico = exports.ConfiguracaoVencimentoArquivo = void 0;
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = require("path");
const NotificacaoBackend_1 = require("./NotificacaoBackend");
const PagamentoBackend_1 = require("../pagamentos/PagamentoBackend");
const InadimplenciaBackend_1 = require("../inadimplencia/InadimplenciaBackend");
class ConfiguracaoVencimentoArquivo {
    constructor(caminho = (0, path_1.join)(electron_1.app.getPath('userData'), 'bot-vencimento.json')) {
        this.caminho = caminho;
        this.carregar = () => {
            try {
                const dados = JSON.parse((0, fs_1.readFileSync)(this.caminho, 'utf8'));
                const dias = Number(dados.diasAntes);
                return {
                    diasAntes: Number.isFinite(dias) && dias >= 1 && dias <= 60 ? Math.round(dias) : NotificacaoBackend_1.DIAS_ANTES_PADRAO,
                    ultimaExecucaoEm: typeof dados.ultimaExecucaoEm === 'string' ? dados.ultimaExecucaoEm : undefined
                };
            }
            catch {
                return { diasAntes: NotificacaoBackend_1.DIAS_ANTES_PADRAO };
            }
        };
        this.salvar = (configuracao) => {
            try {
                (0, fs_1.writeFileSync)(this.caminho, JSON.stringify(configuracao, null, 2), 'utf8');
            }
            catch {
            }
        };
    }
}
exports.ConfiguracaoVencimentoArquivo = ConfiguracaoVencimentoArquivo;
const INTERVALO_MS = 24 * 60 * 60 * 1000;
const diaLocal = (iso) => {
    if (!iso)
        return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso))
        return iso;
    const data = new Date(iso);
    if (Number.isNaN(data.getTime()))
        return iso.slice(0, 10);
    const pad = (n) => String(n).padStart(2, '0');
    return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
};
class BotVencimentoServico {
    constructor(servico = new NotificacaoBackend_1.NotificacaoServico(), configuracao = new ConfiguracaoVencimentoArquivo(), pagamentos = new PagamentoBackend_1.PagamentoRepository(), inadimplencia = new InadimplenciaBackend_1.InadimplenciaRepository()) {
        this.servico = servico;
        this.configuracao = configuracao;
        this.pagamentos = pagamentos;
        this.inadimplencia = inadimplencia;
        this.timer = null;
        this.executando = false;
        this.salvar = () => {
            this.configuracao.salvar({
                diasAntes: this.diasAntes,
                ultimaExecucaoEm: this.ultimaExecucaoEm
            });
        };
        this.agendar = () => {
            if (this.timer)
                clearInterval(this.timer);
            this.timer = null;
            this.proximaExecucaoEm = new Date(Date.now() + INTERVALO_MS).toISOString();
            this.timer = setInterval(() => {
                void this.executar();
            }, INTERVALO_MS);
            this.timer.unref?.();
        };
        this.iniciar = () => {
            this.agendar();
            void this.executar();
        };
        this.encerrar = () => {
            if (this.timer)
                clearInterval(this.timer);
            this.timer = null;
            this.proximaExecucaoEm = undefined;
        };
        this.estado = () => ({
            ativo: this.timer !== null,
            diasAntes: this.diasAntes,
            executando: this.executando,
            ultimaExecucaoEm: this.ultimaExecucaoEm,
            proximaExecucaoEm: this.proximaExecucaoEm,
            ultimoResultado: this.ultimoResultado
        });
        this.executar = async () => {
            if (this.executando)
                return this.estado();
            const hoje = diaLocal(new Date().toISOString());
            if (diaLocal(this.ultimaExecucaoEm) === hoje) {
                this.agendar();
                return this.estado();
            }
            this.executando = true;
            try {
                await this.pagamentos.marcarAtrasados();
                const resultado = await this.servico.enviarVencimentos(this.diasAntes);
                try {
                    await this.servico.registrarAlertaInadimplencia(await this.inadimplencia.resumo());
                }
                catch (erro) {
                    console.error('[bot-vencimento] não foi possível registrar o alerta de inadimplência:', erro);
                }
                this.ultimoResultado = resultado;
                if (resultado.configurado) {
                    this.ultimaExecucaoEm = new Date().toISOString();
                    this.salvar();
                }
            }
            catch (erro) {
                console.error('[bot-vencimento]', erro);
                this.ultimoResultado = {
                    configurado: this.servico.emailConfigurado(),
                    total: 0,
                    enviados: 0,
                    semEmail: 0,
                    falhas: [],
                    notificacoes: []
                };
            }
            finally {
                this.executando = false;
                this.agendar();
            }
            return this.estado();
        };
        const salva = this.configuracao.carregar();
        this.diasAntes = salva.diasAntes;
        this.ultimaExecucaoEm = salva.ultimaExecucaoEm;
    }
}
exports.BotVencimentoServico = BotVencimentoServico;
