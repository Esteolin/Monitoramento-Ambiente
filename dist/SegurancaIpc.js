"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarCanal = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const raizApp = path.resolve(__dirname);
const remetenteValido = (evento) => {
    const frame = evento.senderFrame;
    if (!frame || frame.parent)
        return false;
    try {
        const url = new URL(frame.url);
        if (url.protocol !== 'file:')
            return false;
        const caminho = decodeURIComponent(url.pathname);
        const caminhoNormalizado = process.platform === 'win32' ? caminho.replace(/^\//, '') : caminho;
        const destino = path.resolve(caminhoNormalizado);
        return destino === raizApp || destino.startsWith(raizApp + path.sep);
    }
    catch {
        return false;
    }
};
const registrarCanal = (canal, handler) => {
    electron_1.ipcMain.handle(canal, (evento, ...args) => {
        if (!remetenteValido(evento))
            throw new Error('Origem IPC não autorizada');
        return handler(evento, ...args);
    });
};
exports.registrarCanal = registrarCanal;
