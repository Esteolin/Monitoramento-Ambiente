"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificacaoChuvaRepositorio = void 0;
const Banco_1 = require("../Banco");
const TIMEOUT = 10000;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const chave = (aulaId, email) => `${aulaId}|${email.trim().toLowerCase()}`;
const idsValidos = (aulaIds) => [...new Set(aulaIds)].filter((id) => Number.isInteger(id) && id > 0);
const emailValido = (email) => EMAIL_VALIDO.test(email.trim().toLowerCase());
/**
 * Persiste os avisos de chuva na tabela `notificacoes` e controla o reenvio.
 * Avisos de e-mail usam `canal = 'email'`; as decisões dos alunos usam
 * `canal = 'sistema'` e são gravadas em outro repositório.
 */
class NotificacaoChuvaRepositorio {
    constructor() {
        this.pool = Banco_1.Banco.pool;
        this.existentes = async (aulaIds) => {
            const ids = idsValidos(aulaIds);
            const resultado = new Map();
            if (ids.length === 0)
                return resultado;
            const placeholders = ids.map(() => '?').join(', ');
            const [linhas] = await this.pool.query({
                sql: `SELECT id, aula_id, destinatario_email, status
              FROM notificacoes
             WHERE tipo = 'chuva'
               AND canal = 'email'
               AND aula_id IN (${placeholders})
             ORDER BY id DESC`,
                values: ids,
                timeout: TIMEOUT
            });
            for (const linha of linhas) {
                const aulaId = Number(linha.aula_id);
                const email = String(linha.destinatario_email ?? '').trim().toLowerCase();
                if (!Number.isInteger(aulaId) || aulaId <= 0 || !emailValido(email))
                    continue;
                const status = String(linha.status);
                if (status !== 'pendente' && status !== 'enviado' && status !== 'falhou')
                    continue;
                const chaveRegistro = chave(aulaId, email);
                if (!resultado.has(chaveRegistro)) {
                    resultado.set(chaveRegistro, { id: Number(linha.id), status });
                }
            }
            return resultado;
        };
        /**
         * Garante uma linha de aviso de e-mail para o par aula/aluno. Reaproveita uma
         * linha pendente ou com falha em vez de criar duplicatas a cada tentativa.
         */
        this.preparar = async (registro, existente) => {
            if (!Number.isInteger(registro.aulaId) ||
                registro.aulaId <= 0 ||
                !Number.isInteger(registro.usuarioId) ||
                registro.usuarioId <= 0 ||
                !emailValido(registro.email)) {
                return null;
            }
            const email = registro.email.trim().toLowerCase();
            const assunto = registro.assunto.trim().slice(0, 160);
            const mensagem = registro.mensagem;
            if (existente) {
                await this.pool.query({
                    sql: `UPDATE notificacoes
                 SET assunto = ?, mensagem = ?, status = 'pendente', erro = NULL, enviado_em = NULL
               WHERE id = ? AND tipo = 'chuva' AND canal = 'email'`,
                    values: [assunto, mensagem, existente.id],
                    timeout: TIMEOUT
                });
                return existente.id;
            }
            const [resultado] = await this.pool.query({
                sql: `INSERT INTO notificacoes
        (usuario_id, aula_id, destinatario_email, tipo, canal, assunto, mensagem, status, criado_em)
        VALUES (?, ?, ?, 'chuva', 'email', ?, ?, 'pendente', NOW())`,
                values: [registro.usuarioId, registro.aulaId, email, assunto, mensagem],
                timeout: TIMEOUT
            });
            return Number(resultado.insertId);
        };
        this.atualizarResultado = async (id, status, erro) => {
            try {
                await this.pool.query({
                    sql: `UPDATE notificacoes
                 SET status = ?,
                     erro = ?,
                     enviado_em = CASE WHEN ? = 'enviado' THEN NOW() ELSE NULL END
               WHERE id = ? AND tipo = 'chuva' AND canal = 'email'`,
                    values: [status, erro ? erro.slice(0, 255) : null, status, id],
                    timeout: TIMEOUT
                });
                return true;
            }
            catch (falha) {
                console.error('[bot-clima] Não foi possível atualizar o aviso de chuva.', falha);
                return false;
            }
        };
    }
}
exports.NotificacaoChuvaRepositorio = NotificacaoChuvaRepositorio;
