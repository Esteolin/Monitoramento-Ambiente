"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class InscricoesView {
    constructor() {
        this.usuario = null;
        this.alunos = [];
        this.aulas = [];
        this.inscricaoParaExcluir = null;
        this.timer = null;
        this.el = (id) => document.getElementById(id);
        this.abrirDialogo = (id) => {
            const dialogo = this.el(id);
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.botao = (texto, classe) => {
            const elemento = document.createElement('button');
            elemento.type = 'button';
            elemento.className = classe;
            elemento.textContent = texto;
            return elemento;
        };
        this.dataHoraBr = (valor) => {
            if (!valor)
                return '—';
            const [ano, mes, dia] = valor.slice(0, 10).split('-');
            const hora = valor.slice(11, 16);
            return ano && mes && dia ? `${dia}/${mes}/${ano}${hora ? ` ${hora}` : ''}` : valor;
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
            const aulaId = Number(this.el('filtro-aula').value || '0');
            const alunoId = Number(this.el('filtro-aluno').value || '0');
            const status = this.el('filtro-status').value;
            if (busca)
                entrada.busca = busca;
            if (aulaId)
                entrada.aulaId = aulaId;
            if (alunoId)
                entrada.alunoId = alunoId;
            if (status)
                entrada.status = status;
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
                for (const [id, opcoes] of [['filtro-aluno', this.alunos], ['filtro-aula', this.aulas]]) {
                    const select = this.el(id);
                    opcoes.forEach((opcao) => {
                        const elemento = document.createElement('option');
                        elemento.value = String(opcao.id);
                        elemento.textContent = opcao.nome;
                        select.append(elemento);
                    });
                }
                this.preencherSelect(this.el('form-aluno'), this.alunos);
                this.preencherSelect(this.el('form-aula'), this.aulas);
            }
            catch {
                this.status('Não foi possível carregar alunos e aulas.', 'erro');
            }
        };
        this.preencherSelect = (select, opcoes) => {
            select.replaceChildren();
            opcoes.forEach((opcao) => {
                const elemento = document.createElement('option');
                elemento.value = String(opcao.id);
                elemento.textContent = opcao.nome;
                select.append(elemento);
            });
        };
        this.criarLinha = (inscricao) => {
            const tr = document.createElement('tr');
            const td = (texto, classe) => {
                const celula = document.createElement('td');
                celula.textContent = texto;
                if (classe)
                    celula.className = classe;
                return celula;
            };
            const selo = document.createElement('span');
            selo.className = `selo ${inscricao.status}`;
            const statusTexto = {
                confirmada: 'Confirmada',
                cancelada: 'Cancelada',
                presente: 'Presente',
                falta: 'Falta'
            };
            selo.textContent = statusTexto[inscricao.status] ?? inscricao.status;
            const statusTd = document.createElement('td');
            statusTd.append(selo);
            const acoes = document.createElement('div');
            acoes.className = 'acoes-linha';
            const editar = this.botao('Editar', 'botao secundario pequeno');
            editar.addEventListener('click', () => void this.abrirEdicao(inscricao.id, editar));
            const excluir = this.botao('Excluir', 'botao perigo pequeno');
            if (inscricao.status === 'presente') {
                excluir.disabled = true;
                excluir.title = 'Não é possível excluir inscrição com presença registrada.';
            }
            else {
                excluir.addEventListener('click', () => this.abrirExclusao(inscricao));
            }
            acoes.append(editar, excluir);
            const acoesTd = document.createElement('td');
            acoesTd.append(acoes);
            tr.append(td(inscricao.alunoNome), td(inscricao.aulaTitulo), td(this.dataHoraBr(inscricao.dataHoraInicio), 'col-data'), statusTd, acoesTd);
            return tr;
        };
        this.carregar = async () => {
            try {
                const inscricoes = (await electron_1.ipcRenderer.invoke('inscricoes:listar', this.filtro()));
                const corpo = this.el('corpo');
                corpo.replaceChildren();
                this.el('titulo').textContent = `Inscrições (${Array.isArray(inscricoes) ? inscricoes.length : 0})`;
                if (Array.isArray(inscricoes))
                    inscricoes.forEach((inscricao) => corpo.append(this.criarLinha(inscricao)));
                this.status('');
            }
            catch {
                this.el('corpo').replaceChildren();
                this.status('Não foi possível carregar as inscrições.', 'erro');
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
        this.abrirFormulario = (inscricao) => {
            this.el('formulario').reset();
            this.el('erro-formulario').textContent = '';
            const edicao = inscricao !== null;
            this.el('inscricao-id').value = edicao ? String(inscricao.id) : '';
            this.el('titulo-formulario').textContent = edicao ? 'Editar inscrição' : 'Nova inscrição';
            this.el('salvar').textContent = edicao ? 'Salvar alterações' : 'Cadastrar';
            this.preencherSelect(this.el('form-aluno'), this.alunos);
            this.preencherSelect(this.el('form-aula'), this.aulas);
            this.el('form-aluno').value = edicao ? String(inscricao.alunoId) : '';
            this.el('form-aula').value = edicao ? String(inscricao.aulaId) : '';
            this.el('form-status').value = edicao ? inscricao.status : 'confirmada';
            this.el('form-aluno').disabled = edicao;
            this.el('form-aula').disabled = edicao;
            this.el('form-status').disabled = !edicao;
            this.abrirDialogo('dialogo-formulario');
        };
        this.abrirEdicao = async (id, botao) => {
            if (botao)
                botao.disabled = true;
            try {
                const inscricao = (await electron_1.ipcRenderer.invoke('inscricoes:obter', id));
                if (!inscricao) {
                    this.status('Inscrição não encontrada.', 'erro');
                    return;
                }
                this.abrirFormulario(inscricao);
            }
            catch {
                this.status('Não foi possível carregar a inscrição.', 'erro');
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
            const id = Number(this.el('inscricao-id').value || '0');
            const alunoId = Number(this.el('form-aluno').value || '0');
            const aulaId = Number(this.el('form-aula').value || '0');
            const status = this.el('form-status').value;
            if (!id && (!alunoId || !aulaId)) {
                erro.textContent = 'Selecione um aluno e uma aula.';
                return;
            }
            if (id && !status) {
                erro.textContent = 'Selecione um status.';
                return;
            }
            botao.disabled = true;
            erro.textContent = '';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke(id ? 'inscricoes:atualizar' : 'inscricoes:criar', id ? { id, status } : { alunoId, aulaId }));
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.fecharFormulario();
                await this.carregar();
                this.status(id ? 'Inscrição atualizada com sucesso.' : 'Inscrição criada com sucesso.', 'sucesso');
            }
            catch {
                erro.textContent = 'Não foi possível salvar a inscrição.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.abrirExclusao = (inscricao) => {
            this.inscricaoParaExcluir = inscricao;
            this.el('texto-excluir').textContent =
                `Deseja excluir a inscrição de ${inscricao.alunoNome} na aula "${inscricao.aulaTitulo}"?`;
            this.el('erro-excluir').textContent = '';
            this.abrirDialogo('dialogo-excluir');
        };
        this.confirmarExclusao = async () => {
            if (!this.inscricaoParaExcluir)
                return;
            const botao = this.el('confirmar-excluir');
            botao.disabled = true;
            this.el('erro-excluir').textContent = '';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('inscricoes:excluir', this.inscricaoParaExcluir.id));
                if (!resultado.ok) {
                    this.el('erro-excluir').textContent = resultado.mensagem;
                    return;
                }
                this.el('dialogo-excluir').close();
                this.inscricaoParaExcluir = null;
                await this.carregar();
                this.status('Inscrição excluída com sucesso.', 'sucesso');
            }
            catch {
                this.el('erro-excluir').textContent = 'Não foi possível excluir a inscrição.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.limpar = async () => {
            this.el('busca').value = '';
            this.el('filtro-aula').value = '';
            this.el('filtro-aluno').value = '';
            this.el('filtro-status').value = '';
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
            this.el('filtro-aula').addEventListener('change', () => void this.carregar());
            this.el('filtro-aluno').addEventListener('change', () => void this.carregar());
            this.el('filtro-status').addEventListener('change', () => void this.carregar());
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
    void new InscricoesView().iniciar();
});
