"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegrasInadimplencia = exports.DIAS_ALERTA_INADIMPLENCIA = exports.TIPOS_PLANO_LONGO = void 0;
exports.TIPOS_PLANO_LONGO = ['semestral', 'anual'];
exports.DIAS_ALERTA_INADIMPLENCIA = 30;
class RegrasInadimplencia {
    constructor(agora = () => new Date()) {
        this.agora = agora;
        this.planoLongo = (tipo) => exports.TIPOS_PLANO_LONGO.some((item) => item === String(tipo ?? '').trim().toLowerCase());
        this.diasHistorico = (tipo) => (this.planoLongo(tipo) ? 120 : 30);
        this.atrasoExigeAlerta = (diasAtraso) => diasAtraso > exports.DIAS_ALERTA_INADIMPLENCIA;
        this.diasAtraso = (vencimento) => {
            const [ano, mes, dia] = String(vencimento ?? '')
                .slice(0, 10)
                .split('-')
                .map(Number);
            if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia))
                return 0;
            if (ano < 1900 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31)
                return 0;
            const venc = new Date(Date.UTC(ano, mes - 1, dia));
            if (venc.getUTCFullYear() !== ano ||
                venc.getUTCMonth() !== mes - 1 ||
                venc.getUTCDate() !== dia) {
                return 0;
            }
            const agora = this.agora();
            const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
            return Math.max(0, Math.round((hoje - venc.getTime()) / 86400000));
        };
    }
}
exports.RegrasInadimplencia = RegrasInadimplencia;
