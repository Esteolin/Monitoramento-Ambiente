"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class UsuariosView {
    constructor() {
        this.perfis = {
            admin: 'Administrador',
            instrutor: 'Instrutor',
            aluno: 'Aluno'
        };
        this.timer = null;
        this.usuarioParaExcluir = null;
        this.el = (id) => document.getElementById(id);
        this.abrirDialogo = (id) => {
            const dialogo = this.el(id);
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.criarBotao = (texto, classe) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = classe;
            botao.textContent = texto;
            return botao;
        };
        this.dataHora = (valor) => {
            if (!valor)
                return '—';
            const [data, hora] = valor.split(' ');
            const [ano, mes, dia] = data.split('-');
            if (!ano || !mes || !dia)
                return valor;
            return hora ? `${dia}/${mes}/${ano} ${hora.slice(0, 5)}` : `${dia}/${mes}/${ano}`;
        };
        this.celula = (valor, classe) => {
            const celula = document.createElement('td');
            celula.textContent = valor;
            if (classe)
                celula.className = classe;
            return celula;
        };
        this.criarLinha = (usuario) => {
            const linha = document.createElement('tr');
            const perfil = document.createElement('td');
            perfil.textContent = this.perfis[usuario.perfil] ?? usuario.perfil;
            const status = document.createElement('td');
            const selo = document.createElement('span');
            selo.className = usuario.ativo ? 'selo ativo' : 'selo inativo';
            selo.textContent = usuario.ativo ? 'Ativo' : 'Inativo';
            status.append(selo);
            const acoesTd = document.createElement('td');
            const acoes = document.createElement('div');
            acoes.className = 'acoes-linha';
            const btnEditar = this.criarBotao('Editar', 'botao secundario pequeno');
            btnEditar.addEventListener('click', () => void this.abrirEdicao(usuario.id, btnEditar));
            const btnExcluir = this.criarBotao('Excluir', 'botao perigo pequeno');
            btnExcluir.addEventListener('click', () => this.abrirExclusao(usuario));
            acoes.append(btnEditar, btnExcluir);
            acoesTd.append(acoes);
            linha.append(this.celula(String(usuario.id), 'col-id'), this.celula(usuario.nome, 'col-nome'), this.celula(usuario.email), perfil, status, this.celula(this.dataHora(usuario.ultimoLogin), 'col-data'), this.celula(this.dataHora(usuario.criadoEm), 'col-data'), acoesTd);
            return linha;
        };
        this.atualizar = async () => {
            const status = this.el('status');
            const corpo = this.el('corpo');
            const busca = this.el('busca').value.trim();
            status.classList.remove('erro');
            status.textContent = 'Carregando usuários...';
            try {
                const usuarios = await electron_1.ipcRenderer.invoke('usuarios:listar', busca);
                corpo.replaceChildren(...usuarios.map(this.criarLinha));
                status.classList.remove('erro');
                status.textContent = usuarios.length
                    ? ''
                    : busca
                        ? 'Nenhum usuário encontrado para a busca informada.'
                        : 'Nenhum usuário cadastrado.';
            }
            catch {
                corpo.replaceChildren();
                status.classList.add('erro');
                status.textContent = 'Não foi possível carregar os usuários.';
            }
        };
        this.agendarBusca = () => {
            if (this.timer)
                clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.timer = null;
                void this.atualizar();
            }, 300);
        };
        this.limparFormulario = () => {
            this.el('formulario').reset();
            this.el('usuario-id').value = '';
            this.el('erro-formulario').textContent = '';
            this.el('titulo-dialogo').textContent = 'Novo usuário';
            this.el('salvar').textContent = 'Cadastrar';
            this.el('campo-senha').textContent = 'Senha';
            this.el('campo-confirmacao').textContent = 'Confirmar senha';
            this.el('campo-ativo').classList.add('oculto');
        };
        this.abrirFormulario = () => {
            this.limparFormulario();
            this.abrirDialogo('dialogo');
            this.el('nome').focus();
        };
        this.abrirEdicao = async (id, botao) => {
            if (botao)
                botao.disabled = true;
            try {
                const usuario = await electron_1.ipcRenderer.invoke('usuarios:obter', id);
                if (!usuario) {
                    this.el('status').textContent = 'Usuário não encontrado.';
                    return;
                }
                this.limparFormulario();
                this.el('usuario-id').value = String(usuario.id);
                this.el('nome').value = usuario.nome;
                this.el('email').value = usuario.email;
                this.el('perfil').value = usuario.perfil;
                this.el('ativo').value = usuario.ativo ? '1' : '0';
                this.el('titulo-dialogo').textContent = `Editar usuário — ${usuario.nome}`;
                this.el('salvar').textContent = 'Salvar alterações';
                this.el('campo-senha').textContent = 'Nova senha (opcional)';
                this.el('campo-confirmacao').textContent = 'Confirmar nova senha';
                this.el('campo-ativo').classList.remove('oculto');
                this.abrirDialogo('dialogo');
                this.el('nome').focus();
            }
            catch {
                this.el('status').textContent = 'Não foi possível carregar o usuário.';
            }
            finally {
                if (botao)
                    botao.disabled = false;
            }
        };
        this.fecharFormulario = () => {
            this.el('formulario').reset();
            this.el('dialogo').close();
        };
        this.salvar = async (evento) => {
            evento.preventDefault();
            const erro = this.el('erro-formulario');
            const botao = this.el('salvar');
            const id = Number(this.el('usuario-id').value || '0');
            const nome = this.el('nome').value.trim();
            const email = this.el('email').value.trim();
            const perfil = this.el('perfil').value;
            const senha = this.el('senha').value;
            const confirmacao = this.el('confirmacao').value;
            if (!nome || !email) {
                erro.textContent = 'Preencha nome e e-mail.';
                return;
            }
            if (id === 0 && !senha) {
                erro.textContent = 'Informe a senha do novo usuário.';
                return;
            }
            if (senha || confirmacao) {
                if (senha !== confirmacao) {
                    erro.textContent = 'A confirmação da senha não confere.';
                    return;
                }
            }
            botao.disabled = true;
            erro.textContent = '';
            try {
                const entrada = id === 0
                    ? { nome, email, senha, perfil }
                    : {
                        id,
                        nome,
                        email,
                        perfil,
                        ativo: this.el('ativo').value === '1',
                        novaSenha: senha || undefined
                    };
                const resultado = await electron_1.ipcRenderer.invoke(id === 0 ? 'usuarios:criar' : 'usuarios:atualizar', entrada);
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.fecharFormulario();
                await this.atualizar();
                this.el('status').classList.remove('erro');
                this.el('status').textContent = id === 0
                    ? `Usuário ${nome} cadastrado com sucesso.`
                    : `Usuário ${nome} atualizado com sucesso.`;
            }
            catch {
                erro.textContent = 'Não foi possível salvar o usuário.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.abrirExclusao = (usuario) => {
            this.usuarioParaExcluir = { id: usuario.id, nome: usuario.nome };
            this.el('texto-excluir').textContent = `Deseja excluir o usuário "${usuario.nome}"? Usuários com cadastro de aluno ou instrutor não podem ser excluídos.`;
            this.el('erro-excluir').textContent = '';
            this.abrirDialogo('dialogo-excluir');
        };
        this.confirmarExclusao = async () => {
            if (!this.usuarioParaExcluir)
                return;
            const botao = this.el('confirmar-excluir');
            botao.disabled = true;
            this.el('erro-excluir').textContent = '';
            try {
                const resultado = await electron_1.ipcRenderer.invoke('usuarios:excluir', this.usuarioParaExcluir.id);
                if (!resultado.ok) {
                    this.el('erro-excluir').textContent = resultado.mensagem;
                    return;
                }
                this.el('dialogo-excluir').close();
                this.usuarioParaExcluir = null;
                await this.atualizar();
                this.el('status').classList.remove('erro');
                this.el('status').textContent = 'Usuário excluído com sucesso.';
            }
            catch {
                this.el('erro-excluir').textContent = 'Não foi possível excluir o usuário.';
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
                this.el('status').textContent = 'Não foi possível voltar ao menu.';
            }
        };
        this.iniciar = () => {
            this.el('busca').addEventListener('input', this.agendarBusca);
            this.el('novo').addEventListener('click', this.abrirFormulario);
            this.el('voltar').addEventListener('click', this.voltar);
            this.el('cancelar').addEventListener('click', this.fecharFormulario);
            this.el('formulario').addEventListener('submit', this.salvar);
            this.el('cancelar-excluir').addEventListener('click', () => this.el('dialogo-excluir').close());
            this.el('confirmar-excluir').addEventListener('click', () => void this.confirmarExclusao());
            void this.atualizar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => new UsuariosView().iniciar());
