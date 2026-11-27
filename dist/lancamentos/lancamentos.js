"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class LancamentosView {
    constructor() {
        this.usuario = null;
        this.editandoId = null;
        this.excluindoId = null;
        this.timer = null;
        this.categorias = {
            aula: 'Aulas',
            aluguel: 'Aluguel',
            outros: 'Outros'
        };
        this.moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        this.el = (id) => document.getElementById(id);
        this.abrirDialogo = (id) => {
            const dialogo = this.el(id);
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.admin = () => this.usuario?.perfil === 'admin';
        this.status = (mensagem, erro = false) => {
            const elemento = this.el('status');
            elemento.textContent = mensagem;
            elemento.classList.toggle('erro', erro);
        };
        this.data = (valor) => {
            const [ano, mes, dia] = valor.split('-');
            return dia && mes && ano ? `${dia}/${mes}/${ano}` : valor;
        };
        this.hoje = () => {
            const agora = new Date();
            const dois = (numero) => String(numero).padStart(2, '0');
            return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
        };
        this.celula = (texto, classe) => {
            const celula = document.createElement('td');
            celula.textContent = texto;
            if (classe)
                celula.className = classe;
            return celula;
        };
        this.botao = (texto, classe, acao) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = `pequeno ${classe}`;
            botao.textContent = texto;
            botao.addEventListener('click', acao);
            return botao;
        };
        this.criarLinha = (lancamento) => {
            const linha = document.createElement('tr');
            const categoria = document.createElement('td');
            const selo = document.createElement('span');
            selo.className = `selo ${lancamento.categoria}`;
            selo.textContent = this.categorias[lancamento.categoria] ?? lancamento.categoria;
            categoria.append(selo);
            const acoes = document.createElement('td');
            acoes.className = 'col-acoes';
            const grupo = document.createElement('div');
            grupo.className = 'acoes-linha';
            grupo.append(this.botao('Editar', 'secundario', () => this.abrirFormulario(lancamento)), this.botao('Excluir', 'perigo', () => this.abrirExclusao(lancamento)));
            acoes.append(grupo);
            linha.append(this.celula(String(lancamento.id), 'col-id'), categoria, this.celula(lancamento.descricao ?? '—'), this.celula(this.moeda.format(lancamento.valor), 'col-valor'), this.celula(this.data(lancamento.dataLancamento), 'col-data'), acoes);
            return linha;
        };
        this.carregar = async () => {
            const corpo = this.el('corpo');
            const filtro = {
                categoria: this.el('filtro-categoria').value,
                inicio: this.el('filtro-inicio').value,
                fim: this.el('filtro-fim').value,
                busca: this.el('busca').value.trim()
            };
            this.status('Carregando lançamentos...');
            try {
                const lancamentos = await electron_1.ipcRenderer.invoke('lancamentos:listar', filtro);
                corpo.replaceChildren(...lancamentos.map(this.criarLinha));
                if (lancamentos.length === 0) {
                    const vazio = document.createElement('tr');
                    const celula = document.createElement('td');
                    celula.colSpan = 6;
                    celula.className = 'vazio';
                    celula.textContent = 'Nenhum lançamento encontrado para os filtros informados.';
                    vazio.append(celula);
                    corpo.replaceChildren(vazio);
                }
                this.status('');
            }
            catch (erro) {
                console.error('[lancamentos:listar]', erro);
                corpo.replaceChildren();
                const mensagem = erro instanceof Error && erro.message ? erro.message : 'Não foi possível carregar os lançamentos.';
                this.status(mensagem, true);
            }
        };
        this.agendarBusca = () => {
            if (this.timer)
                clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.timer = null;
                void this.carregar();
            }, 300);
        };
        this.abrirFormulario = (lancamento) => {
            this.editandoId = lancamento?.id ?? null;
            this.el('formulario').reset();
            this.el('erro-formulario').textContent = '';
            this.el('titulo-form').textContent = lancamento ? 'Editar lançamento' : 'Novo lançamento';
            this.el('salvar').textContent = lancamento ? 'Salvar alterações' : 'Cadastrar';
            this.el('categoria').value = lancamento?.categoria ?? 'aula';
            this.el('descricao').value = lancamento?.descricao ?? '';
            this.el('valor').value = lancamento ? String(lancamento.valor) : '';
            this.el('data').value = lancamento?.dataLancamento ?? this.hoje();
            this.abrirDialogo('dialogo-form');
            this.el('descricao').focus();
        };
        this.fecharFormulario = () => {
            this.el('dialogo-form').close();
            this.editandoId = null;
        };
        this.salvar = async (evento) => {
            evento.preventDefault();
            const erro = this.el('erro-formulario');
            const botao = this.el('salvar');
            const categoria = this.el('categoria').value;
            const descricao = this.el('descricao').value.trim();
            const valorTexto = this.el('valor').value;
            const dataLancamento = this.el('data').value;
            const valor = Number(valorTexto);
            const eraEdicao = this.editandoId !== null;
            if (!categoria || !valorTexto || !dataLancamento || !Number.isFinite(valor) || valor <= 0) {
                erro.textContent = 'Preencha categoria, valor e data do lançamento.';
                return;
            }
            botao.disabled = true;
            erro.textContent = '';
            const dados = { categoria, descricao, valor, dataLancamento };
            try {
                const resultado = this.editandoId === null
                    ? await electron_1.ipcRenderer.invoke('lancamentos:criar', dados)
                    : await electron_1.ipcRenderer.invoke('lancamentos:atualizar', { id: this.editandoId, ...dados });
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.fecharFormulario();
                await this.carregar();
                this.status(eraEdicao ? 'Lançamento atualizado com sucesso.' : 'Lançamento cadastrado com sucesso.');
            }
            catch (erroIpc) {
                console.error('[lancamentos:salvar]', erroIpc);
                erro.textContent = 'Não foi possível salvar o lançamento.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.abrirExclusao = (lancamento) => {
            this.excluindoId = lancamento.id;
            this.el('texto-excluir').textContent =
                `Excluir o lançamento "${lancamento.descricao || this.categorias[lancamento.categoria]}" de ${this.data(lancamento.dataLancamento)}?`;
            this.el('erro-excluir').textContent = '';
            this.abrirDialogo('dialogo-excluir');
        };
        this.confirmarExclusao = async () => {
            if (this.excluindoId === null)
                return;
            const botao = this.el('confirmar-excluir');
            botao.disabled = true;
            this.el('erro-excluir').textContent = '';
            try {
                const resultado = await electron_1.ipcRenderer.invoke('lancamentos:excluir', this.excluindoId);
                if (!resultado.ok) {
                    this.el('erro-excluir').textContent = resultado.mensagem;
                    return;
                }
                this.el('dialogo-excluir').close();
                this.excluindoId = null;
                await this.carregar();
                this.status('Lançamento excluído. Os relatórios foram atualizados.');
            }
            catch (erroIpc) {
                console.error('[lancamentos:excluir]', erroIpc);
                this.el('erro-excluir').textContent = 'Não foi possível excluir o lançamento.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.voltar = async () => {
            try {
                await electron_1.ipcRenderer.invoke('menu:voltar');
            }
            catch {
                this.status('Não foi possível voltar ao menu.', true);
            }
        };
        this.iniciar = async () => {
            try {
                this.usuario = (await electron_1.ipcRenderer.invoke('auth:me'));
            }
            catch {
                this.usuario = null;
            }
            this.el('voltar').addEventListener('click', () => void this.voltar());
            if (!this.admin()) {
                this.el('painel-lancamentos').hidden = true;
                this.el('acesso-negado').hidden = false;
                return;
            }
            this.el('novo').addEventListener('click', () => this.abrirFormulario());
            this.el('filtro-categoria').addEventListener('change', () => void this.carregar());
            this.el('filtro-inicio').addEventListener('change', () => void this.carregar());
            this.el('filtro-fim').addEventListener('change', () => void this.carregar());
            this.el('busca').addEventListener('input', this.agendarBusca);
            this.el('formulario').addEventListener('submit', (evento) => void this.salvar(evento));
            this.el('cancelar-form').addEventListener('click', this.fecharFormulario);
            this.el('cancelar-excluir').addEventListener('click', () => {
                this.el('dialogo-excluir').close();
                this.excluindoId = null;
            });
            this.el('confirmar-excluir').addEventListener('click', () => void this.confirmarExclusao());
            await this.carregar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new LancamentosView().iniciar();
});
