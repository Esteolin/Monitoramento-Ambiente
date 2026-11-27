"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class ExerciciosView {
    constructor() {
        this.exercicios = [];
        this.usuario = null;
        this.consulta = 0;
        this.detalhando = false;
        this.debounce = null;
        this.el = (id) => document.getElementById(id);
        this.abrirDialogo = (id) => {
            const dialogo = this.el(id);
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.criar = (tag, classe, texto) => {
            const elemento = document.createElement(tag);
            if (classe)
                elemento.className = classe;
            if (texto !== undefined)
                elemento.textContent = texto;
            return elemento;
        };
        this.criarImagem = (exercicio, classe) => {
            if (!exercicio.imagemUrl)
                return null;
            const imagem = new Image();
            imagem.className = classe;
            imagem.src = exercicio.imagemUrl;
            imagem.alt = exercicio.nome;
            imagem.loading = 'lazy';
            imagem.referrerPolicy = 'no-referrer';
            return imagem;
        };
        this.statusPagina = (texto, erro = false) => {
            const elemento = this.el('status');
            elemento.textContent = texto;
            elemento.classList.toggle('erro', erro);
        };
        this.criarCartao = (exercicio) => {
            const cartao = this.criar('article', 'cartao');
            const titulo = this.criar('h3', 'cartao-titulo', exercicio.nome);
            const metadados = this.criar('div', 'metadados');
            if (exercicio.musculos.length) {
                metadados.append(this.criar('span', 'etiqueta', `Músculos: ${exercicio.musculos.slice(0, 4).join(', ')}`));
            }
            if (exercicio.equipamento.length) {
                metadados.append(this.criar('span', 'etiqueta', `Equipamento: ${exercicio.equipamento.slice(0, 3).join(', ')}`));
            }
            const resumo = this.criar('p', 'resumo', exercicio.descricao || 'Sem descrição disponível na API Wger.');
            const acoes = this.criar('div', 'cartao-acoes');
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'botao pequeno';
            botao.textContent = 'Ver detalhes';
            botao.addEventListener('click', () => void this.abrirDetalhe(exercicio.id));
            acoes.append(botao);
            const imagem = this.criarImagem(exercicio, 'cartao-imagem');
            cartao.append(titulo);
            if (imagem)
                cartao.append(imagem);
            cartao.append(metadados, resumo, acoes);
            return cartao;
        };
        this.renderizar = () => {
            const lista = this.el('lista');
            if (!this.exercicios.length) {
                lista.replaceChildren(this.criar('div', 'vazio', 'Nenhum exercício encontrado para esta busca.'));
            }
            else {
                lista.replaceChildren(...this.exercicios.map(this.criarCartao));
            }
            this.el('contador').textContent = `${this.exercicios.length} exercício(s) encontrado(s) no Wger.`;
        };
        this.buscar = async () => {
            const sequencia = ++this.consulta;
            const termo = this.el('termo').value.trim().slice(0, 80);
            const limite = Number(this.el('limite').value);
            const botao = this.el('buscar');
            botao.disabled = true;
            this.statusPagina('Consultando o catálogo Wger...');
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('exercicios:buscar', {
                    termo,
                    limite: Number.isInteger(limite) ? limite : 20
                }));
                if (sequencia !== this.consulta)
                    return;
                if (!resultado.ok) {
                    this.exercicios = [];
                    this.renderizar();
                    this.statusPagina(resultado.mensagem, true);
                    return;
                }
                this.exercicios = resultado.exercicios;
                this.renderizar();
                this.statusPagina(termo ? `Resultados para "${termo}".` : 'Catálogo carregado da API Wger.');
            }
            catch (erro) {
                console.error(erro);
                if (sequencia === this.consulta) {
                    this.exercicios = [];
                    this.renderizar();
                    this.statusPagina('Não foi possível consultar o catálogo de exercícios.', true);
                }
            }
            finally {
                if (sequencia === this.consulta)
                    botao.disabled = false;
            }
        };
        this.preencherDetalhe = (exercicio) => {
            this.el('detalhe-titulo').textContent = exercicio.nome;
            this.el('detalhe-id').textContent = `#${exercicio.id}`;
            this.el('detalhe-musculos').textContent = exercicio.musculos.length
                ? exercicio.musculos.join(', ')
                : 'Não informado';
            this.el('detalhe-equipamento').textContent = exercicio.equipamento.length
                ? exercicio.equipamento.join(', ')
                : 'Não informado';
            this.el('detalhe-descricao').textContent = exercicio.descricao || 'Sem descrição disponível na API Wger.';
            const imagem = this.el('detalhe-imagem');
            imagem.alt = exercicio.nome;
            imagem.hidden = !exercicio.imagemUrl;
            if (exercicio.imagemUrl)
                imagem.src = exercicio.imagemUrl;
            else
                imagem.removeAttribute('src');
        };
        this.abrirDetalhe = async (id) => {
            if (this.detalhando)
                return;
            const dialogo = this.el('dialogo-detalhe');
            const areaErro = this.el('detalhe-erro');
            areaErro.textContent = '';
            this.el('detalhe-titulo').textContent = 'Carregando exercício...';
            this.el('detalhe-id').textContent = '—';
            this.el('detalhe-musculos').textContent = '—';
            this.el('detalhe-equipamento').textContent = '—';
            this.el('detalhe-descricao').textContent = '';
            const imagem = this.el('detalhe-imagem');
            imagem.hidden = true;
            imagem.removeAttribute('src');
            if (!dialogo.open)
                dialogo.showModal();
            this.detalhando = true;
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('exercicios:obter', { id }));
                if (!resultado.ok) {
                    this.el('detalhe-titulo').textContent = 'Exercício';
                    areaErro.textContent = resultado.mensagem;
                    this.statusPagina(resultado.mensagem, true);
                    return;
                }
                this.preencherDetalhe(resultado.exercicio);
                this.statusPagina('');
            }
            catch (erro) {
                console.error(erro);
                this.el('detalhe-titulo').textContent = 'Exercício';
                areaErro.textContent = 'Não foi possível carregar os detalhes do exercício.';
                this.statusPagina('Não foi possível carregar os detalhes do exercício.', true);
            }
            finally {
                this.detalhando = false;
            }
        };
        this.limpar = () => {
            if (this.debounce !== null)
                window.clearTimeout(this.debounce);
            this.el('termo').value = '';
            this.el('limite').value = '20';
            void this.buscar();
        };
        this.voltar = async () => {
            try {
                await electron_1.ipcRenderer.invoke('menu:voltar');
            }
            catch (erro) {
                console.error(erro);
                this.statusPagina('Não foi possível voltar ao menu.', true);
            }
        };
        this.iniciar = async () => {
            try {
                this.usuario = (await electron_1.ipcRenderer.invoke('auth:me'));
            }
            catch (erro) {
                console.error(erro);
                this.usuario = null;
            }
            const perfis = ['admin', 'instrutor'];
            if (!this.usuario || !perfis.includes(this.usuario.perfil)) {
                this.statusPagina('Acesso negado para este perfil.', true);
                return;
            }
            this.el('buscar').addEventListener('click', () => void this.buscar());
            this.el('termo').addEventListener('keydown', (evento) => {
                if (evento.key === 'Enter')
                    void this.buscar();
            });
            this.el('termo').addEventListener('input', () => {
                if (this.debounce !== null)
                    window.clearTimeout(this.debounce);
                this.debounce = window.setTimeout(() => void this.buscar(), 400);
            });
            this.el('limite').addEventListener('change', () => void this.buscar());
            this.el('limpar').addEventListener('click', this.limpar);
            this.el('fechar-detalhe').addEventListener('click', () => this.el('dialogo-detalhe').close());
            this.el('voltar').addEventListener('click', () => void this.voltar());
            await this.buscar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new ExerciciosView().iniciar();
});
