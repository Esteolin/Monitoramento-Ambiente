"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class MenuView {
    constructor() {
        this.perfis = {
            admin: 'Administrador',
            instrutor: 'Instrutor',
            aluno: 'Aluno'
        };
        this.svgNs = 'http://www.w3.org/2000/svg';
        this.moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        this.el = (id) => document.getElementById(id);
        this.criarGrupo = (titulo, opcoes) => {
            const secao = document.createElement('section');
            secao.className = 'grupo-modulos';
            const cabecalho = document.createElement('div');
            cabecalho.className = 'grupo-cabecalho';
            const nome = document.createElement('h3');
            nome.textContent = titulo;
            const quantidade = document.createElement('span');
            quantidade.textContent = `${opcoes.length} ${opcoes.length === 1 ? 'módulo' : 'módulos'}`;
            cabecalho.append(nome, quantidade);
            const linha = document.createElement('div');
            linha.className = 'linha-modulos';
            linha.append(...opcoes.map(this.criarOpcao));
            secao.append(cabecalho, linha);
            return secao;
        };
        this.criarOpcao = (opcao) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'opcao';
            botao.disabled = !opcao.disponivel;
            const icone = document.createElementNS(this.svgNs, 'svg');
            icone.setAttribute('class', 'opcao-icone');
            icone.setAttribute('aria-hidden', 'true');
            const referencia = document.createElementNS(this.svgNs, 'use');
            referencia.setAttribute('href', `#ico-${opcao.id}`);
            icone.append(referencia);
            const titulo = document.createElement('strong');
            titulo.textContent = opcao.titulo;
            const descricao = document.createElement('span');
            descricao.textContent = opcao.descricao;
            const acao = document.createElement('em');
            acao.textContent = opcao.disponivel ? 'Abrir' : 'Em breve';
            botao.append(icone, titulo, descricao, acao);
            botao.addEventListener('click', () => this.abrir(opcao.id));
            return botao;
        };
        this.dataBr = (valor) => {
            const [ano, mes, dia] = valor.split('-').map(Number);
            return ano && mes && dia ? `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}` : valor;
        };
        this.competenciaBr = (valor) => {
            const [ano, mes] = valor.split('-');
            return ano && mes ? `${mes}/${ano}` : valor;
        };
        this.carregarAlerta = async (perfil) => {
            const caixa = this.el('alerta-inadimplencia');
            caixa.hidden = true;
            if (perfil !== 'admin')
                return;
            try {
                const resumo = await electron_1.ipcRenderer.invoke('inadimplencia:resumo');
                if (!resumo.atrasados)
                    return;
                caixa.replaceChildren();
                const topo = document.createElement('div');
                topo.className = 'alerta-topo';
                const titulo = document.createElement('strong');
                titulo.textContent = `${resumo.atrasados} ${resumo.atrasados === 1 ? 'mensalidade em atraso' : 'mensalidades em atraso'}`;
                const detalhe = document.createElement('span');
                detalhe.textContent = `${resumo.totalAlunos} ${resumo.totalAlunos === 1 ? 'aluno' : 'alunos'} • ${this.moeda.format(resumo.valorTotal)}`;
                topo.append(titulo, detalhe);
                caixa.append(topo);
                if (resumo.itens.length) {
                    const detalhes = document.createElement('details');
                    const resumoDetalhes = document.createElement('summary');
                    resumoDetalhes.textContent = 'Ver detalhes';
                    const lista = document.createElement('ul');
                    for (const item of resumo.itens) {
                        const linha = document.createElement('li');
                        linha.textContent = `${item.alunoNome} — ${this.competenciaBr(item.competencia)} • vencida em ${this.dataBr(item.dataVencimento)} • ${this.moeda.format(item.valor)} • ${item.diasAtraso} ${item.diasAtraso === 1 ? 'dia' : 'dias'} em atraso`;
                        lista.append(linha);
                    }
                    detalhes.append(resumoDetalhes, lista);
                    caixa.append(detalhes);
                }
                caixa.hidden = false;
            }
            catch {
                caixa.hidden = true;
            }
        };
        this.abrir = async (id) => {
            try {
                await electron_1.ipcRenderer.invoke('menu:abrir', id);
                this.el('status').textContent = '';
            }
            catch {
                this.el('status').textContent = 'Não foi possível abrir esta tela.';
            }
        };
        this.sair = async () => {
            await electron_1.ipcRenderer.invoke('auth:sair');
        };
        this.iniciar = async () => {
            this.el('sair').addEventListener('click', this.sair);
            try {
                const dados = await electron_1.ipcRenderer.invoke('menu:carregar');
                const primeiroNome = dados.nome.trim().split(/\s+/)[0] ?? dados.nome;
                this.el('nome').textContent = dados.nome;
                this.el('perfil').textContent = this.perfis[dados.perfil] ?? dados.perfil;
                this.el('boas-vindas').textContent = `Olá, ${primeiroNome}!`;
                this.el('resumo-menu').textContent = `Você está como ${this.perfis[dados.perfil] ?? dados.perfil}. Escolha um módulo abaixo.`;
                this.el('total-opcoes').textContent = String(dados.opcoes.length);
                const grupos = new Map();
                for (const opcao of dados.opcoes) {
                    const lista = grupos.get(opcao.grupo) ?? [];
                    lista.push(opcao);
                    grupos.set(opcao.grupo, lista);
                }
                this.el('opcoes').replaceChildren(...Array.from(grupos, ([grupo, opcoes]) => this.criarGrupo(grupo, opcoes)));
                await this.carregarAlerta(dados.perfil);
            }
            catch {
                this.el('status').textContent = 'Sessão inválida. Faça login novamente.';
            }
        };
    }
}
window.addEventListener('DOMContentLoaded', () => new MenuView().iniciar());
