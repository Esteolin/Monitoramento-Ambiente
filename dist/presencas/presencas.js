"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class PresencasView {
    constructor() {
        this.usuario = null;
        this.alunos = [];
        this.aulas = [];
        this.presencaParaExcluir = null;
        this.timer = null;
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
        this.botao = (texto, classe) => {
            const elemento = document.createElement('button');
            elemento.type = 'button';
            elemento.className = classe;
            elemento.textContent = texto;
            return elemento;
        };
        this.dataBr = (valor) => {
            if (!valor)
                return '—';
            const [ano, mes, dia] = valor.slice(0, 10).split('-');
            return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
        };
        this.dataHoraBr = (valor) => {
            if (!valor)
                return '—';
            const [ano, mes, dia] = valor.slice(0, 10).split('-');
            const hora = valor.slice(11, 16);
            return ano && mes && dia ? `${dia}/${mes}/${ano}${hora ? ` ${hora}` : ''}` : valor;
        };
        this.hoje = () => {
            const agora = new Date();
            const mes = String(agora.getMonth() + 1).padStart(2, '0');
            const dia = String(agora.getDate()).padStart(2, '0');
            return `${agora.getFullYear()}-${mes}-${dia}`;
        };
        this.status = (texto, tipo = 'info') => {
            const el = this.el('status');
            el.textContent = texto;
            el.classList.toggle('erro', tipo === 'erro');
            el.classList.toggle('sucesso', tipo === 'sucesso');
        };
        this.filtro = () => {
            const entrada = {};
            const busca = this.el('busca').value.trim();
            const alunoId = Number(this.el('filtro-aluno').value || '0');
            const inicio = this.el('filtro-inicio').value;
            const fim = this.el('filtro-fim').value;
            const origem = this.el('filtro-origem').value;
            if (busca)
                entrada.busca = busca;
            if (alunoId)
                entrada.alunoId = alunoId;
            if (inicio)
                entrada.inicio = inicio;
            if (fim)
                entrada.fim = fim;
            if (origem)
                entrada.origem = origem;
            return entrada;
        };
        this.carregarOpcoes = async () => {
            try {
                const [alunos, aulas] = await Promise.all([
                    electron_1.ipcRenderer.invoke('alunos:listar', {}),
                    electron_1.ipcRenderer.invoke('aulas:listar', {})
                ]);
                this.alunos = (Array.isArray(alunos) ? alunos : []).map((aluno) => ({ id: aluno.id, nome: aluno.nome }));
                this.aulas = (Array.isArray(aulas) ? aulas : []).map((aula) => ({
                    id: aula.id,
                    nome: `${aula.titulo} — ${this.dataHoraBr(aula.dataHoraInicio)}`
                }));
                const filtroAluno = this.el('filtro-aluno');
                this.alunos.forEach((aluno) => {
                    const opcao = document.createElement('option');
                    opcao.value = String(aluno.id);
                    opcao.textContent = aluno.nome;
                    filtroAluno.append(opcao);
                });
                this.preencherSelect(this.el('form-aluno'), false);
                this.preencherSelect(this.el('form-aula'), true);
            }
            catch {
                this.status('Não foi possível carregar alunos e aulas.', 'erro');
            }
        };
        this.preencherSelect = (select, opcional) => {
            const atual = select.value;
            select.replaceChildren();
            if (opcional) {
                const vazio = document.createElement('option');
                vazio.value = '';
                vazio.textContent = 'Nenhuma';
                select.append(vazio);
            }
            const opcoes = opcional ? this.aulas : this.alunos;
            opcoes.forEach((opcao) => {
                const elemento = document.createElement('option');
                elemento.value = String(opcao.id);
                elemento.textContent = opcao.nome;
                select.append(elemento);
            });
            if (atual)
                select.value = atual;
        };
        this.criarLinha = (presenca) => {
            const tr = document.createElement('tr');
            const td = (texto, classe) => {
                const celula = document.createElement('td');
                celula.textContent = texto;
                if (classe)
                    celula.className = classe;
                return celula;
            };
            const acoes = this.criar('div', 'acoes-linha');
            const editar = this.botao('Editar', 'botao secundario pequeno');
            editar.addEventListener('click', () => void this.abrirEdicao(presenca.id, editar));
            const excluir = this.botao('Excluir', 'botao perigo pequeno');
            excluir.addEventListener('click', () => this.abrirExclusao(presenca));
            acoes.append(editar, excluir);
            const acoesTd = document.createElement('td');
            acoesTd.append(acoes);
            const origemTexto = {
                aula: 'Aula',
                livre: 'Livre',
                experimental: 'Experimental'
            };
            tr.append(td(presenca.alunoNome), td(presenca.aulaTitulo ?? '—'), td(this.dataBr(presenca.dataPresenca), 'col-data'), td(origemTexto[presenca.origem] ?? presenca.origem), td(this.dataHoraBr(presenca.criadoEm), 'col-data'), acoesTd);
            return tr;
        };
        this.carregar = async () => {
            try {
                const presencas = (await electron_1.ipcRenderer.invoke('presencas:listarTodos', this.filtro()));
                const corpo = this.el('corpo');
                corpo.replaceChildren();
                this.el('titulo').textContent = `Presenças (${Array.isArray(presencas) ? presencas.length : 0})`;
                if (Array.isArray(presencas))
                    presencas.forEach((presenca) => corpo.append(this.criarLinha(presenca)));
                this.status('');
            }
            catch {
                this.el('corpo').replaceChildren();
                this.status('Não foi possível carregar as presenças.', 'erro');
            }
        };
        this.agendar = () => {
            if (this.timer)
                clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.timer = null;
                void this.carregar();
            }, 300);
        };
        this.abrirFormulario = (presenca) => {
            this.el('formulario').reset();
            this.el('erro-formulario').textContent = '';
            const edicao = presenca !== null;
            this.el('presenca-id').value = edicao ? String(presenca.id) : '';
            this.el('titulo-formulario').textContent = edicao ? 'Editar presença' : 'Nova presença';
            this.el('salvar').textContent = edicao ? 'Salvar alterações' : 'Cadastrar';
            this.preencherSelect(this.el('form-aluno'), false);
            this.preencherSelect(this.el('form-aula'), true);
            this.el('form-data').value = edicao ? presenca.dataPresenca : this.hoje();
            this.el('form-origem').value = edicao ? presenca.origem : 'aula';
            this.el('form-aluno').value = edicao ? String(presenca.alunoId) : '';
            this.el('form-aula').value = edicao && presenca.aulaId ? String(presenca.aulaId) : '';
            this.abrirDialogo('dialogo-formulario');
        };
        this.abrirEdicao = async (id, botao) => {
            if (botao)
                botao.disabled = true;
            try {
                const presenca = (await electron_1.ipcRenderer.invoke('presencas:obter', id));
                if (!presenca) {
                    this.status('Presença não encontrada.', 'erro');
                    return;
                }
                this.abrirFormulario(presenca);
            }
            catch {
                this.status('Não foi possível carregar a presença.', 'erro');
            }
            finally {
                if (botao)
                    botao.disabled = false;
            }
        };
        this.fecharFormulario = () => {
            this.el('dialogo-formulario').close();
        };
        this.salvar = async (evento) => {
            evento.preventDefault();
            const erro = this.el('erro-formulario');
            const botao = this.el('salvar');
            const id = Number(this.el('presenca-id').value || '0');
            const alunoId = Number(this.el('form-aluno').value || '0');
            const aulaId = Number(this.el('form-aula').value || '0');
            const dataPresenca = this.el('form-data').value;
            const origem = this.el('form-origem').value;
            if (!alunoId) {
                erro.textContent = 'Selecione um aluno.';
                return;
            }
            if (!dataPresenca) {
                erro.textContent = 'Informe a data da presença.';
                return;
            }
            if (origem === 'aula' && !aulaId) {
                erro.textContent = 'Selecione a aula desta presença.';
                return;
            }
            botao.disabled = true;
            erro.textContent = '';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke(id ? 'presencas:atualizar' : 'presencas:criar', {
                    id: id || undefined,
                    alunoId,
                    aulaId: aulaId || null,
                    dataPresenca,
                    origem
                }));
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.fecharFormulario();
                await this.carregar();
                this.status(id ? 'Presença atualizada com sucesso.' : 'Presença registrada com sucesso.', 'sucesso');
            }
            catch {
                erro.textContent = 'Não foi possível salvar a presença.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.abrirExclusao = (presenca) => {
            this.presencaParaExcluir = presenca;
            this.el('texto-excluir').textContent =
                `Deseja excluir a presença de ${presenca.alunoNome} em ${this.dataBr(presenca.dataPresenca)}?`;
            this.el('erro-excluir').textContent = '';
            this.abrirDialogo('dialogo-excluir');
        };
        this.confirmarExclusao = async () => {
            if (!this.presencaParaExcluir)
                return;
            const botao = this.el('confirmar-excluir');
            botao.disabled = true;
            this.el('erro-excluir').textContent = '';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('presencas:excluir', this.presencaParaExcluir.id));
                if (!resultado.ok) {
                    this.el('erro-excluir').textContent = resultado.mensagem;
                    return;
                }
                this.el('dialogo-excluir').close();
                this.presencaParaExcluir = null;
                await this.carregar();
                this.status('Presença excluída com sucesso.', 'sucesso');
            }
            catch {
                this.el('erro-excluir').textContent = 'Não foi possível excluir a presença.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.limpar = async () => {
            this.el('busca').value = '';
            this.el('filtro-aluno').value = '';
            this.el('filtro-inicio').value = '';
            this.el('filtro-fim').value = '';
            this.el('filtro-origem').value = '';
            await this.carregar();
        };
        this.voltar = async () => {
            try {
                await electron_1.ipcRenderer.invoke('menu:voltar');
            }
            catch {
                this.status('Não foi possível voltar ao menu.', 'erro');
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
            if (!this.usuario || !['admin', 'instrutor'].includes(this.usuario.perfil)) {
                this.el('painel').classList.add('oculto');
                this.el('acesso-negado').classList.remove('oculto');
                return;
            }
            this.el('busca').addEventListener('input', this.agendar);
            this.el('filtro-aluno').addEventListener('change', () => void this.carregar());
            this.el('filtro-inicio').addEventListener('change', () => void this.carregar());
            this.el('filtro-fim').addEventListener('change', () => void this.carregar());
            this.el('filtro-origem').addEventListener('change', () => void this.carregar());
            this.el('limpar').addEventListener('click', () => void this.limpar());
            this.el('novo').addEventListener('click', () => this.abrirFormulario(null));
            this.el('cancelar').addEventListener('click', this.fecharFormulario);
            this.el('formulario').addEventListener('submit', (evento) => void this.salvar(evento));
            this.el('cancelar-excluir').addEventListener('click', () => this.el('dialogo-excluir').close());
            this.el('confirmar-excluir').addEventListener('click', () => void this.confirmarExclusao());
            await this.carregarOpcoes();
            await this.carregar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new PresencasView().iniciar();
});
