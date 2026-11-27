"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class VisitantesView {
    constructor() {
        this.usuario = null;
        this.visitantes = [];
        this.detalheAtual = null;
        this.visitanteParaExcluir = null;
        this.buscaTimer = null;
        this.el = (id) => document.getElementById(id);
        this.abrirDialogo = (id) => {
            const dialogo = this.el(id);
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.admin = () => this.usuario?.perfil === 'admin';
        this.gestor = () => this.usuario?.perfil === 'admin' || this.usuario?.perfil === 'instrutor';
        this.tipoTexto = {
            experimental: 'Aula experimental',
            visitante: 'Visitante'
        };
        this.statusTexto = {
            agendado: 'Agendado',
            compareceu: 'Compareceu',
            faltou: 'Faltou',
            convertido: 'Convertido'
        };
        this.criar = (tag, classe, texto) => {
            const elemento = document.createElement(tag);
            if (classe)
                elemento.className = classe;
            if (texto !== undefined)
                elemento.textContent = texto;
            return elemento;
        };
        this.criarBotao = (texto, classe) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = classe;
            botao.textContent = texto;
            return botao;
        };
        this.criarOpcao = (valor, texto) => {
            const opcao = document.createElement('option');
            opcao.value = valor;
            opcao.textContent = texto;
            return opcao;
        };
        this.criarSelo = (status) => {
            const selo = document.createElement('span');
            selo.className = `selo ${status}`;
            selo.textContent = this.statusTexto[status];
            return selo;
        };
        this.dataBr = (valor) => {
            if (!valor)
                return '—';
            const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
            return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
        };
        this.dataHoraFmt = (valor) => {
            if (!valor)
                return '—';
            const [data, hora] = String(valor).split(/[ T]/);
            const [ano, mes, dia] = data.split('-');
            if (!ano || !mes || !dia)
                return valor;
            return hora ? `${dia}/${mes}/${ano} ${hora.slice(0, 5)}` : `${dia}/${mes}/${ano}`;
        };
        this.hoje = () => {
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };
        this.statusPagina = (texto, erro = false) => {
            const el = this.el('status');
            el.textContent = texto;
            el.classList.toggle('erro', erro);
        };
        this.criarLinha = (visitante) => {
            const tr = document.createElement('tr');
            const tdNome = document.createElement('td');
            tdNome.className = 'col-nome';
            const nome = document.createElement('strong');
            nome.textContent = visitante.nome;
            const email = document.createElement('small');
            email.textContent = visitante.email || 'Sem e-mail';
            tdNome.append(nome, email);
            const tdTelefone = document.createElement('td');
            tdTelefone.textContent = visitante.telefone || '—';
            const tdData = document.createElement('td');
            tdData.className = 'col-data';
            tdData.textContent = this.dataBr(visitante.dataVisita);
            const tdAula = document.createElement('td');
            tdAula.className = 'col-aula';
            if (visitante.aulaTitulo) {
                const titulo = document.createElement('strong');
                titulo.textContent = visitante.aulaTitulo;
                const horario = document.createElement('small');
                horario.textContent = this.dataHoraFmt(visitante.aulaDataHoraInicio);
                tdAula.append(titulo, horario);
            }
            else {
                const vazio = document.createElement('small');
                vazio.textContent = visitante.aulaId ? 'Aula não encontrada' : 'Sem aula vinculada';
                tdAula.append(vazio);
            }
            const tdTipo = document.createElement('td');
            tdTipo.append(this.criar('span', `tipo${visitante.tipo === 'experimental' ? ' experimental' : ''}`, this.tipoTexto[visitante.tipo]));
            const tdStatus = document.createElement('td');
            tdStatus.append(this.criarSelo(visitante.status));
            const tdAcoes = document.createElement('td');
            const acoes = document.createElement('div');
            acoes.className = 'acoes-linha';
            const btnVer = this.criarBotao('Ver', 'botao secundario pequeno');
            btnVer.addEventListener('click', () => void this.abrirDetalhe(visitante.id));
            const btnEditar = this.criarBotao('Editar', 'botao secundario pequeno');
            btnEditar.addEventListener('click', () => void this.abrirEdicao(visitante.id, btnEditar));
            acoes.append(btnVer, btnEditar);
            if (this.admin()) {
                const btnExcluir = this.criarBotao('Excluir', 'botao perigo pequeno');
                btnExcluir.addEventListener('click', () => this.abrirExclusao(visitante));
                acoes.append(btnExcluir);
            }
            tdAcoes.append(acoes);
            tr.append(tdNome, tdTelefone, tdData, tdAula, tdTipo, tdStatus, tdAcoes);
            return tr;
        };
        this.carregar = async () => {
            this.statusPagina('Carregando visitantes...');
            try {
                const filtro = {};
                const busca = this.el('filtro-busca').value.trim();
                const data = this.el('filtro-data').value;
                const tipo = this.el('filtro-tipo').value;
                const status = this.el('filtro-status').value;
                if (busca)
                    filtro.busca = busca;
                if (data)
                    filtro.data = data;
                if (tipo)
                    filtro.tipo = tipo;
                if (status)
                    filtro.status = status;
                this.visitantes = (await electron_1.ipcRenderer.invoke('visitantes:listar', filtro));
                this.el('corpo').replaceChildren(...this.visitantes.map(this.criarLinha));
                this.statusPagina(this.visitantes.length ? '' : 'Nenhum visitante encontrado para os filtros escolhidos.');
            }
            catch (erro) {
                console.error(erro);
                this.el('corpo').replaceChildren();
                this.statusPagina('Não foi possível carregar os visitantes.', true);
            }
        };
        this.carregarAuxiliares = async () => {
            const select = this.el('aula');
            try {
                const aulas = (await electron_1.ipcRenderer.invoke('aulas:listar', {}));
                const opcoes = [this.criarOpcao('', 'Sem aula vinculada')];
                for (const aula of aulas) {
                    opcoes.push(this.criarOpcao(String(aula.id), `${aula.titulo} — ${this.dataHoraFmt(aula.dataHoraInicio)}`));
                }
                select.replaceChildren(...opcoes);
            }
            catch (erro) {
                console.error(erro);
                select.replaceChildren(this.criarOpcao('', 'Não foi possível carregar as aulas'));
            }
        };
        this.limparForm = () => {
            this.el('formulario').reset();
            this.el('visitante-id').value = '';
            this.el('erro-formulario').textContent = '';
            this.el('data-visita').value = this.hoje();
            this.el('tipo').value = 'experimental';
            this.el('aula').value = '';
        };
        this.abrirNovo = () => {
            if (!this.gestor())
                return;
            this.limparForm();
            this.el('titulo-form').textContent = 'Novo visitante';
            this.el('salvar').textContent = 'Cadastrar';
            this.el('campo-status').classList.add('oculto');
            this.abrirDialogo('dialogo-form');
            this.el('nome').focus();
        };
        this.preencherForm = (visitante) => {
            this.limparForm();
            this.el('visitante-id').value = String(visitante.id);
            this.el('nome').value = visitante.nome;
            this.el('telefone').value = visitante.telefone;
            this.el('email').value = visitante.email ?? '';
            this.el('data-visita').value = visitante.dataVisita;
            this.el('tipo').value = visitante.tipo;
            const selectAula = this.el('aula');
            if (visitante.aulaId &&
                !Array.from(selectAula.options).some((opcao) => opcao.value === String(visitante.aulaId))) {
                const rotulo = visitante.aulaTitulo
                    ? `${visitante.aulaTitulo} — ${this.dataHoraFmt(visitante.aulaDataHoraInicio)}`
                    : `Aula #${visitante.aulaId}`;
                selectAula.append(this.criarOpcao(String(visitante.aulaId), rotulo));
            }
            selectAula.value = visitante.aulaId ? String(visitante.aulaId) : '';
            this.el('observacoes').value = visitante.observacoes ?? '';
            this.el('visitante-status').value = visitante.status;
        };
        this.abrirEdicao = async (id, botao) => {
            if (botao)
                botao.disabled = true;
            try {
                const visitante = (await electron_1.ipcRenderer.invoke('visitantes:obter', id));
                if (!visitante) {
                    this.statusPagina('Visitante não encontrado.', true);
                    return;
                }
                this.preencherForm(visitante);
                this.el('titulo-form').textContent = `Editar visitante — ${visitante.nome}`;
                this.el('salvar').textContent = 'Salvar alterações';
                this.el('campo-status').classList.remove('oculto');
                this.abrirDialogo('dialogo-form');
            }
            catch (erro) {
                console.error(erro);
                this.statusPagina('Não foi possível carregar o visitante.', true);
            }
            finally {
                if (botao)
                    botao.disabled = false;
            }
        };
        this.salvar = async (evento) => {
            evento.preventDefault();
            const erro = this.el('erro-formulario');
            const botao = this.el('salvar');
            erro.textContent = '';
            const id = Number(this.el('visitante-id').value || '0');
            const nome = this.el('nome').value.trim();
            const telefone = this.el('telefone').value.trim();
            const email = this.el('email').value.trim();
            const dataVisita = this.el('data-visita').value;
            const tipo = this.el('tipo').value;
            const aulaValor = this.el('aula').value;
            const aulaId = aulaValor ? Number(aulaValor) : undefined;
            const observacoes = this.el('observacoes').value.trim();
            if (nome.length < 2) {
                erro.textContent = 'Informe o nome do visitante com pelo menos 2 caracteres.';
                return;
            }
            if (telefone.replace(/\D/g, '').length < 8) {
                erro.textContent = 'Informe um telefone válido com pelo menos 8 dígitos.';
                return;
            }
            if (!dataVisita) {
                erro.textContent = 'Informe a data da visita.';
                return;
            }
            botao.disabled = true;
            try {
                let resultado;
                if (id > 0) {
                    resultado = (await electron_1.ipcRenderer.invoke('visitantes:atualizar', {
                        id,
                        nome,
                        telefone,
                        email: email || null,
                        aulaId: aulaId ?? null,
                        dataVisita,
                        tipo,
                        status: this.el('visitante-status').value,
                        observacoes: observacoes || null
                    }));
                }
                else {
                    resultado = (await electron_1.ipcRenderer.invoke('visitantes:criar', {
                        nome,
                        telefone,
                        email: email || undefined,
                        aulaId,
                        dataVisita,
                        tipo,
                        observacoes: observacoes || undefined
                    }));
                }
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.el('dialogo-form').close();
                await this.carregar();
                if (this.detalheAtual?.id === id)
                    await this.atualizarDetalhe();
                this.statusPagina(id > 0 ? 'Visitante atualizado com sucesso.' : 'Visitante cadastrado com sucesso.');
            }
            catch (e) {
                console.error(e);
                erro.textContent = 'Não foi possível salvar o visitante.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.detalheItem = (dl, titulo, valor, span2 = false) => {
            const div = document.createElement('div');
            if (span2)
                div.className = 'span2';
            const dt = document.createElement('dt');
            dt.textContent = titulo;
            const dd = document.createElement('dd');
            dd.textContent = valor && valor.trim() ? valor : '—';
            div.append(dt, dd);
            dl.append(div);
        };
        this.preencherDetalhe = (visitante) => {
            this.el('titulo-detalhe').textContent = visitante.nome;
            const dl = this.el('detalhes');
            dl.replaceChildren();
            this.detalheItem(dl, 'Telefone', visitante.telefone);
            this.detalheItem(dl, 'E-mail', visitante.email);
            this.detalheItem(dl, 'Data da visita', this.dataBr(visitante.dataVisita));
            this.detalheItem(dl, 'Tipo', this.tipoTexto[visitante.tipo]);
            this.detalheItem(dl, 'Status', this.statusTexto[visitante.status]);
            this.detalheItem(dl, 'Aula', visitante.aulaTitulo);
            this.detalheItem(dl, 'Horário da aula', this.dataHoraFmt(visitante.aulaDataHoraInicio));
            this.detalheItem(dl, 'Observações', visitante.observacoes, true);
            this.detalheItem(dl, 'Cadastrado em', this.dataHoraFmt(visitante.criadoEm));
            const convertido = visitante.status === 'convertido';
            this.el('marcar-compareceu').classList.toggle('oculto', convertido || visitante.status === 'compareceu');
            this.el('marcar-faltou').classList.toggle('oculto', convertido || visitante.status === 'faltou');
            this.el('marcar-agendado').classList.toggle('oculto', convertido || visitante.status === 'agendado');
            const msg = this.el('msg-presenca');
            msg.className = 'msg-info';
            msg.textContent = convertido ? 'Este visitante foi convertido em aluno.' : '';
        };
        this.abrirDetalhe = async (id) => {
            try {
                const visitante = (await electron_1.ipcRenderer.invoke('visitantes:obter', id));
                if (!visitante) {
                    this.statusPagina('Visitante não encontrado.', true);
                    return;
                }
                this.detalheAtual = visitante;
                this.preencherDetalhe(visitante);
                const dialogo = this.el('dialogo-detalhe');
                if (!dialogo.open)
                    dialogo.showModal();
            }
            catch (erro) {
                console.error(erro);
                this.statusPagina('Não foi possível carregar o visitante.', true);
            }
        };
        this.atualizarDetalhe = async () => {
            if (!this.detalheAtual)
                return;
            try {
                const visitante = (await electron_1.ipcRenderer.invoke('visitantes:obter', this.detalheAtual.id));
                if (!visitante)
                    return;
                this.detalheAtual = visitante;
                this.preencherDetalhe(visitante);
            }
            catch (erro) {
                console.error(erro);
            }
        };
        this.marcarStatus = async (status) => {
            const visitante = this.detalheAtual;
            if (!visitante)
                return;
            const msg = this.el('msg-presenca');
            msg.className = 'msg-info';
            msg.textContent = 'Atualizando presença...';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('visitantes:atualizar', {
                    id: visitante.id,
                    status
                }));
                if (!resultado.ok) {
                    msg.className = 'msg-info erro';
                    msg.textContent = resultado.mensagem;
                    return;
                }
                await this.carregar();
                await this.atualizarDetalhe();
                const atualizada = this.el('msg-presenca');
                atualizada.className = 'msg-info sucesso';
                atualizada.textContent = `Status atualizado para "${this.statusTexto[status]}".`;
            }
            catch (erro) {
                console.error(erro);
                msg.className = 'msg-info erro';
                msg.textContent = 'Não foi possível atualizar a presença.';
            }
        };
        this.abrirExclusao = (visitante) => {
            if (!this.admin())
                return;
            this.visitanteParaExcluir = visitante;
            this.el('texto-excluir').textContent = `Deseja excluir o visitante "${visitante.nome}" da visita de ${this.dataBr(visitante.dataVisita)}?`;
            this.el('erro-excluir').textContent = '';
            this.abrirDialogo('dialogo-excluir');
        };
        this.confirmarExclusao = async () => {
            if (!this.visitanteParaExcluir)
                return;
            const botao = this.el('confirmar-excluir');
            botao.disabled = true;
            this.el('erro-excluir').textContent = '';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('visitantes:excluir', this.visitanteParaExcluir.id));
                if (!resultado.ok) {
                    this.el('erro-excluir').textContent = resultado.mensagem;
                    return;
                }
                const excluido = this.visitanteParaExcluir;
                this.el('dialogo-excluir').close();
                if (this.detalheAtual?.id === excluido.id) {
                    this.el('dialogo-detalhe').close();
                    this.detalheAtual = null;
                }
                await this.carregar();
                this.statusPagina(`Visitante "${excluido.nome}" excluído.`);
            }
            catch (erro) {
                console.error(erro);
                this.el('erro-excluir').textContent = 'Não foi possível excluir o visitante.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.limparFiltros = () => {
            if (this.buscaTimer)
                clearTimeout(this.buscaTimer);
            this.el('filtro-busca').value = '';
            this.el('filtro-data').value = '';
            this.el('filtro-tipo').value = '';
            this.el('filtro-status').value = '';
            void this.carregar();
        };
        this.voltar = async () => {
            try {
                await electron_1.ipcRenderer.invoke('menu:voltar');
            }
            catch {
                this.statusPagina('Não foi possível voltar ao menu.', true);
            }
        };
        this.iniciar = async () => {
            try {
                this.usuario = (await electron_1.ipcRenderer.invoke('auth:me'));
            }
            catch {
                this.usuario = null;
            }
            if (!this.usuario) {
                this.statusPagina('Sessão inválida. Faça login novamente.', true);
                return;
            }
            if (!this.gestor()) {
                this.statusPagina('Acesso negado para este perfil.', true);
                return;
            }
            this.el('novo').classList.remove('oculto');
            this.el('voltar').addEventListener('click', () => void this.voltar());
            this.el('novo').addEventListener('click', this.abrirNovo);
            this.el('limpar-filtros').addEventListener('click', this.limparFiltros);
            this.el('filtro-busca').addEventListener('input', () => {
                if (this.buscaTimer)
                    clearTimeout(this.buscaTimer);
                this.buscaTimer = setTimeout(() => void this.carregar(), 300);
            });
            this.el('filtro-data').addEventListener('change', () => void this.carregar());
            this.el('filtro-tipo').addEventListener('change', () => void this.carregar());
            this.el('filtro-status').addEventListener('change', () => void this.carregar());
            this.el('formulario').addEventListener('submit', (evento) => void this.salvar(evento));
            this.el('cancelar-form').addEventListener('click', () => this.el('dialogo-form').close());
            this.el('fechar-detalhe').addEventListener('click', () => this.el('dialogo-detalhe').close());
            this.el('editar-detalhe').addEventListener('click', () => {
                if (!this.detalheAtual)
                    return;
                this.el('dialogo-detalhe').close();
                void this.abrirEdicao(this.detalheAtual.id, this.el('editar-detalhe'));
            });
            this.el('marcar-compareceu').addEventListener('click', () => void this.marcarStatus('compareceu'));
            this.el('marcar-faltou').addEventListener('click', () => void this.marcarStatus('faltou'));
            this.el('marcar-agendado').addEventListener('click', () => void this.marcarStatus('agendado'));
            this.el('cancelar-excluir').addEventListener('click', () => this.el('dialogo-excluir').close());
            this.el('confirmar-excluir').addEventListener('click', () => void this.confirmarExclusao());
            await this.carregarAuxiliares();
            await this.carregar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new VisitantesView().iniciar();
});
