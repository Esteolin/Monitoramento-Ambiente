"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailServico = exports.sanitizarErroEmail = void 0;
require("dotenv/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Converte erros do Nodemailer em mensagens genéricas, evitando levar host,
 * usuário ou detalhes de autenticação para o histórico exibido na tela.
 */
const sanitizarErroEmail = (erro) => {
    const codigo = typeof erro === 'object' && erro !== null && 'code' in erro
        ? String(erro.code ?? '').toUpperCase()
        : '';
    const texto = erro instanceof Error ? erro.message.toLowerCase() : '';
    if (codigo === 'EAUTH' || /auth|credential|login|senha|password/.test(texto)) {
        return 'Falha de autenticação no servidor de e-mail.';
    }
    if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED'].includes(codigo) ||
        /connect|connection|timeout|timed out|socket/.test(texto)) {
        return 'Não foi possível conectar ao servidor de e-mail.';
    }
    if (['ENOTFOUND', 'EAI_AGAIN', 'EDNS'].includes(codigo) || /dns|not found/.test(texto)) {
        return 'Servidor de e-mail não encontrado.';
    }
    if (codigo === 'EENVELOPE' || /recipient|mailbox|address|destinat/.test(texto)) {
        return 'O servidor de e-mail recusou um destinatário.';
    }
    return 'Falha ao enviar o e-mail.';
};
exports.sanitizarErroEmail = sanitizarErroEmail;
class EmailServico {
    constructor(fabricaTransporte) {
        this.fabricaTransporte = fabricaTransporte;
        this.transporte = null;
        this.host = (process.env.SMTP_HOST ?? '').trim();
        this.porta = Number(process.env.SMTP_PORT ?? 587);
        this.usuario = (process.env.SMTP_USER ?? '').trim();
        this.senha = process.env.SMTP_PASS ?? '';
        this.remetente = (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '').trim();
        this.nomeRemetente = (process.env.SMTP_REMETENTE_NOME ?? 'Academia Cotil').trim();
        this.configurado = () => Boolean(this.host && this.usuario && this.senha && this.remetente);
        this.remetenteFormatado = () => {
            if (!this.configurado())
                return '';
            // SMTP_FROM pode vir como "Nome <email>"; nesse caso já é o remetente final.
            if (/<[^>]+>/.test(this.remetente))
                return this.remetente;
            return `${this.nomeRemetente} <${this.remetente}>`;
        };
        this.criarTransporte = () => {
            const porta = Number.isFinite(this.porta) ? this.porta : 587;
            const seguro = (process.env.SMTP_SECURE ?? '').toLowerCase() === 'true' || porta === 465;
            const exigirTls = (process.env.SMTP_REQUIRE_TLS ?? '').toLowerCase() === 'true';
            const validarCertificado = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !== 'false';
            return nodemailer_1.default.createTransport({
                host: this.host,
                port: porta,
                secure: seguro,
                requireTLS: exigirTls,
                auth: { user: this.usuario, pass: this.senha },
                pool: true,
                maxConnections: 3,
                maxMessages: 50,
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 20000,
                tls: { rejectUnauthorized: validarCertificado }
            });
        };
        this.obterTransporte = () => {
            if (!this.transporte) {
                this.transporte = this.fabricaTransporte ? this.fabricaTransporte() : this.criarTransporte();
            }
            return this.transporte;
        };
        this.fechar = () => {
            const transporte = this.transporte;
            transporte?.close?.();
            this.transporte = null;
        };
        this.enviar = async (destinatarios, assunto, texto) => {
            const lista = [...new Set(destinatarios.map((email) => email.trim().toLowerCase()).filter((email) => EMAIL_VALIDO.test(email)))];
            if (!this.configurado()) {
                return {
                    configurado: false,
                    total: lista.length,
                    enviados: 0,
                    falhas: [],
                    erroGeral: 'Envio por e-mail não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS no .env.'
                };
            }
            if (lista.length === 0) {
                return {
                    configurado: true,
                    total: 0,
                    enviados: 0,
                    falhas: [],
                    erroGeral: 'Nenhum aluno ativo possui e-mail cadastrado.'
                };
            }
            const transporte = this.obterTransporte();
            const fila = [...lista];
            const falhas = [];
            let enviados = 0;
            const consumir = async () => {
                for (;;) {
                    const email = fila.shift();
                    if (!email)
                        return;
                    try {
                        await transporte.sendMail({
                            from: this.remetenteFormatado(),
                            to: email,
                            subject: assunto,
                            text: texto
                        });
                        enviados++;
                    }
                    catch (erro) {
                        falhas.push({ email, erro: (0, exports.sanitizarErroEmail)(erro) });
                    }
                }
            };
            const conexoes = Math.min(4, lista.length);
            await Promise.all(Array.from({ length: conexoes }, () => consumir()));
            return {
                configurado: true,
                total: lista.length,
                enviados,
                falhas,
                erroGeral: enviados === 0
                    ? 'Nenhum e-mail pôde ser enviado. Verifique as configurações de SMTP.'
                    : undefined
            };
        };
    }
}
exports.EmailServico = EmailServico;
