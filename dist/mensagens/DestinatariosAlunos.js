"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlunoDestinatarios = void 0;
const Banco_1 = require("../Banco");
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
class AlunoDestinatarios {
    constructor() {
        this.pool = Banco_1.Banco.pool;
        this.idsValidos = (aulaIds) => [...new Set(aulaIds)].filter((id) => Number.isInteger(id) && id > 0);
        /**
         * Lista os alunos inscritos nas aulas informadas, mantendo o vínculo com cada
         * aula para que o aviso seja registrado em `notificacoes` com o `aula_id`.
         */
        this.listarPorAulas = async (aulaIds) => {
            const ids = this.idsValidos(aulaIds);
            if (ids.length === 0)
                return { ok: true, alunos: [] };
            const placeholders = ids.map(() => '?').join(', ');
            try {
                const [linhas] = await this.pool.query({
                    sql: `SELECT DISTINCT ia.aula_id, u.id AS usuario_id, u.email
                FROM inscricoes_aula ia
                INNER JOIN alunos a ON a.id = ia.aluno_id
                INNER JOIN usuarios u ON u.id = a.usuario_id
               WHERE ia.aula_id IN (${placeholders})
                 AND ia.status IN ('confirmada', 'presente')
                 AND a.ativo = 1
                 AND u.email IS NOT NULL
                 AND u.email <> ''
               ORDER BY ia.aula_id ASC, u.email ASC`,
                    values: ids,
                    timeout: 10000
                });
                const alunos = [];
                const vistos = new Set();
                for (const linha of linhas) {
                    const aulaId = Number(linha.aula_id);
                    const usuarioId = Number(linha.usuario_id);
                    const email = String(linha.email ?? '').trim().toLowerCase();
                    if (!Number.isInteger(aulaId) || aulaId <= 0)
                        continue;
                    if (!Number.isInteger(usuarioId) || usuarioId <= 0)
                        continue;
                    if (!EMAIL_VALIDO.test(email))
                        continue;
                    const chave = `${aulaId}|${email}`;
                    if (vistos.has(chave))
                        continue;
                    vistos.add(chave);
                    alunos.push({ aulaId, usuarioId, email });
                }
                return { ok: true, alunos };
            }
            catch {
                return { ok: false, mensagem: 'Não foi possível carregar os alunos inscritos nas aulas ao ar livre.' };
            }
        };
    }
}
exports.AlunoDestinatarios = AlunoDestinatarios;
