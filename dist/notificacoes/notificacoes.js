"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class NotificacoesView {
    constructor() {
        this.usuario = null;
        this.notificacoes = [];
        this.notificacaoParaExcluir = null;
        this.debounceBusca = null;
        this.el = (id) => document.getElementById(id);
        this.abrirDialogo = (id) => {
            const dialogo = this.el(id);
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.tipoTexto = {
            vencimento: 'Vencimento',
            chuva: 'Chuva',
            experimental: 'Experimental',
            geral: 'Geral'
        };
        this.statusTexto = {
            enviado: 'Enviado',
            falhou: 'Falhou',
            pendente: 'Pendente'
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
        this.dataHoraFmt = (valor) => {
            if (!valor)
                return '—';
            if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(valor)) {
                const data = new Date(valor);
                return Number.isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR');
            }
            const [data, hora] = String(valor).split(/[ T]/);
            const [ano, mes, dia] = (data ?? '').split('-');
            if (!ano || !mes || !dia)
                return valor;
            return hora ? `${dia}/${mes}/${ano} ${hora.slice(0, 5)}` : `${dia}/${mes}/${ano}`;
        };
        this.statusPagina = (texto, erro = false) => {
            const el = this.el('status');
            el.textContent = texto;
            el.classList.toggle('erro', erro);
        };
        this.carregarSituacao = async () => {
            try {
                const situacao = (await electron_1.ipcRenderer.invoke('notificacoes:situacao'));
                this.el('situacao-smtp').textContent = situacao.smtpConfigurado ? 'Configurado' : 'Não configurado';
                this.el('situacao-remetente').textContent = situacao.remetente ?? '';
                this.el('situacao-ultima').textContent = situacao.agendador?.ultimaExecucaoEm
                    ? this.dataHoraFmt(situacao.agendador.ultimaExecucaoEm)
                    : 'Nenhuma execução registrada';
                this.el('situacao-proxima').textContent = situacao.agendador?.proximaExecucaoEm
                    ? `Próxima: ${this.dataHoraFmt(situacao.agendador.proximaExecucaoEm)}`
                    : '';
                this.el('situacao-dias').textContent = `${situacao.agendador?.diasAntes ?? 7} dias`;
                this.el('situacao-hoje').textContent = `${situacao.enviadasHoje} registrada(s)`;
                this.el('situacao-falhas').textContent =
                    `${situacao.falhasHoje} falha(s) • ${situacao.pendentes} pendente(s)`;
                this.el('aviso-smtp').classList.toggle('oculto', situacao.smtpConfigurado);
            }
            catch (erro) {
                console.error(erro);
                this.el('situacao-smtp').textContent = 'Indisponível';
                this.el('situacao-ultima').textContent = 'Indisponível';
                this.el('situacao-dias').textContent = '—';
                this.el('situacao-hoje').textContent = '—';
            }
        };
        this.criarLinha = (notificacao) => {
            const tr = document.createElement('tr');
            const tdData = document.createElement('td');
            tdData.className = 'col-data';
            tdData.textContent = this.dataHoraFmt(notificacao.criadoEm);
            const tdDest = document.createElement('td');
            tdDest.className = 'col-dest';
            const nome = document.createElement('strong');
            nome.textContent = notificacao.usuarioNome || 'Destinatário';
            const email = document.createElement('small');
            email.textContent = notificacao.destinatarioEmail;
            tdDest.append(nome, email);
            const tdTipo = document.createElement('td');
            tdTipo.append(this.criar('span', `tipo${notificacao.tipo === 'vencimento' ? ' vencimento' : ''}`, this.tipoTexto[notificacao.tipo]));
            const tdAssunto = document.createElement('td');
            tdAssunto.className = 'col-assunto';
            const assunto = document.createElement('span');
            assunto.textContent = notificacao.assunto;
            assunto.title = notificacao.assunto;
            tdAssunto.append(assunto);
            const tdStatus = document.createElement('td');
            tdStatus.append(this.criar('span', `selo ${notificacao.status}`, this.statusTexto[notificacao.status]));
            const tdErro = document.createElement('td');
            tdErro.className = 'col-erro';
            if (notificacao.erro) {
                const erro = document.createElement('span');
                erro.textContent = notificacao.erro;
                erro.title = notificacao.erro;
                tdErro.append(erro);
            }
            else {
                tdErro.textContent = '—';
            }
            const tdAcoes = document.createElement('td');
            const acoes = document.createElement('div');
            acoes.className = 'acoes-linha';
            const btnVer = this.criarBotao('Ver', 'botao secundario pequeno');
            btnVer.addEventListener('click', () => this.abrirDetalhe(notificacao));
            const btnEditar = this.criarBotao('Editar', 'botao secundario pequeno');
            btnEditar.addEventListener('click', () => void this.abrirEdicao(notificacao.id, btnEditar));
            const btnExcluir = this.criarBotao('Excluir', 'botao perigo pequeno');
            btnExcluir.addEventListener('click', () => this.abrirExclusao(notificacao));
            acoes.append(btnVer, btnEditar, btnExcluir);
            tdAcoes.append(acoes);
            tr.append(tdData, tdDest, tdTipo, tdAssunto, tdStatus, tdErro, tdAcoes);
            return tr;
        };
        this.carregar = async () => {
            this.statusPagina('Carregando notificações...');
            try {
                const filtro = {};
                const tipo = this.el('filtro-tipo').value;
                const status = this.el('filtro-status').value;
                const busca = this.el('filtro-busca').value.trim();
                if (tipo)
                    filtro.tipo = tipo;
                if (status)
                    filtro.status = status;
                if (busca)
                    filtro.busca = busca;
                this.notificacoes = (await electron_1.ipcRenderer.invoke('notificacoes:listar', filtro));
                this.el('corpo').replaceChildren(...this.notificacoes.map(this.criarLinha));
                this.statusPagina(this.notificacoes.length ? '' : 'Nenhuma notificação encontrada para os filtros escolhidos.');
            }
            catch (erro) {
                console.error(erro);
                this.el('corpo').replaceChildren();
                this.statusPagina('Não foi possível carregar as notificações.', true);
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
        this.abrirDetalhe = (notificacao) => {
            this.el('titulo-detalhe').textContent = this.tipoTexto[notificacao.tipo];
            const dl = this.el('detalhes');
            dl.replaceChildren();
            this.detalheItem(dl, 'Destinatário', notificacao.usuarioNome);
            this.detalheItem(dl, 'E-mail', notificacao.destinatarioEmail);
            this.detalheItem(dl, 'Status', this.statusTexto[notificacao.status]);
            this.detalheItem(dl, 'Canal', notificacao.canal);
            this.detalheItem(dl, 'Criada em', this.dataHoraFmt(notificacao.criadoEm));
            this.detalheItem(dl, 'Enviada em', this.dataHoraFmt(notificacao.enviadoEm));
            if (notificacao.pagamentoId) {
                this.detalheItem(dl, 'Pagamento', `#${notificacao.pagamentoId}`);
            }
            if (notificacao.erro)
                this.detalheItem(dl, 'Erro', notificacao.erro, true);
            this.el('mensagem').textContent = notificacao.mensagem;
            const dialogo = this.el('dialogo-detalhe');
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.abrirFormulario = (notificacao) => {
            this.el('formulario-notificacao').reset();
            this.el('erro-formulario').textContent = '';
            const edicao = notificacao !== null;
            this.el('notificacao-id').value = edicao ? String(notificacao.id) : '';
            this.el('titulo-formulario').textContent = edicao ? 'Editar notificação' : 'Nova notificação';
            this.el('salvar-formulario').textContent = edicao ? 'Salvar alterações' : 'Cadastrar';
            this.el('form-email').value = edicao ? notificacao.destinatarioEmail : '';
            this.el('form-tipo').value = edicao ? notificacao.tipo : 'geral';
            this.el('form-canal').value = edicao ? notificacao.canal : 'sistema';
            this.el('form-assunto').value = edicao ? notificacao.assunto : '';
            this.el('form-mensagem').value = edicao ? notificacao.mensagem : '';
            this.el('form-status-notificacao').value = edicao ? notificacao.status : 'pendente';
            this.el('form-erro').value = edicao ? (notificacao.erro ?? '') : '';
            this.el('form-usuario-id').value = edicao && notificacao.usuarioId ? String(notificacao.usuarioId) : '';
            this.el('form-aula-id').value = edicao && notificacao.aulaId ? String(notificacao.aulaId) : '';
            this.el('form-pagamento-id').value =
                edicao && notificacao.pagamentoId ? String(notificacao.pagamentoId) : '';
            this.abrirDialogo('dialogo-formulario');
        };
        this.abrirEdicao = async (id, botao) => {
            if (botao)
                botao.disabled = true;
            try {
                const notificacao = (await electron_1.ipcRenderer.invoke('notificacoes:obter', id));
                if (!notificacao) {
                    this.statusPagina('Notificação não encontrada.', true);
                    return;
                }
                this.abrirFormulario(notificacao);
            }
            catch {
                this.statusPagina('Não foi possível carregar a notificação.', true);
            }
            finally {
                if (botao)
                    botao.disabled = false;
            }
        };
        this.fecharFormulario = () => {
            this.el('dialogo-formulario').close();
        };
        this.salvarFormulario = async (evento) => {
            evento.preventDefault();
            const erro = this.el('erro-formulario');
            const botao = this.el('salvar-formulario');
            const id = Number(this.el('notificacao-id').value || '0');
            const numeroOpcional = (idDoCampo) => {
                const valor = Number(this.el(idDoCampo).value || '0');
                return valor > 0 ? valor : null;
            };
            const entrada = {
                id: id || undefined,
                usuarioId: numeroOpcional('form-usuario-id'),
                aulaId: numeroOpcional('form-aula-id'),
                pagamentoId: numeroOpcional('form-pagamento-id'),
                destinatarioEmail: this.el('form-email').value,
                tipo: this.el('form-tipo').value,
                canal: this.el('form-canal').value,
                assunto: this.el('form-assunto').value,
                mensagem: this.el('form-mensagem').value,
                status: this.el('form-status-notificacao').value,
                erro: this.el('form-erro').value
            };
            if (!entrada.destinatarioEmail.trim() || !entrada.assunto.trim() || !entrada.mensagem.trim()) {
                erro.textContent = 'Preencha e-mail, assunto e mensagem.';
                return;
            }
            botao.disabled = true;
            erro.textContent = '';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke(id ? 'notificacoes:atualizar' : 'notificacoes:criar', entrada));
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.fecharFormulario();
                await this.carregar();
                await this.carregarSituacao();
                this.statusPagina(id ? 'Notificação atualizada.' : 'Notificação criada.');
            }
            catch {
                erro.textContent = 'Não foi possível salvar a notificação.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.abrirExclusao = (notificacao) => {
            this.notificacaoParaExcluir = notificacao;
            this.el('texto-excluir').textContent =
                `Deseja excluir a notificação "${notificacao.assunto}" enviada para ${notificacao.destinatarioEmail}?`;
            this.el('erro-excluir').textContent = '';
            this.abrirDialogo('dialogo-excluir');
        };
        this.confirmarExclusao = async () => {
            if (!this.notificacaoParaExcluir)
                return;
            const botao = this.el('confirmar-excluir');
            botao.disabled = true;
            this.el('erro-excluir').textContent = '';
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('notificacoes:excluir', this.notificacaoParaExcluir.id));
                if (!resultado.ok) {
                    this.el('erro-excluir').textContent = resultado.mensagem ?? 'Não foi possível excluir.';
                    return;
                }
                this.el('dialogo-excluir').close();
                await this.carregar();
                await this.carregarSituacao();
                this.statusPagina('Notificação excluída.');
            }
            catch (erro) {
                console.error(erro);
                this.el('erro-excluir').textContent = 'Não foi possível excluir a notificação.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.limparFiltros = () => {
            this.el('filtro-tipo').value = '';
            this.el('filtro-status').value = '';
            this.el('filtro-busca').value = '';
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
            if (this.usuario.perfil !== 'admin') {
                this.statusPagina('Acesso negado para este perfil.', true);
                return;
            }
            this.el('voltar').addEventListener('click', () => void this.voltar());
            this.el('atualizar').addEventListener('click', () => {
                void this.carregarSituacao();
                void this.carregar();
            });
            this.el('limpar-filtros').addEventListener('click', this.limparFiltros);
            this.el('nova-notificacao').addEventListener('click', () => this.abrirFormulario(null));
            this.el('cancelar-formulario').addEventListener('click', this.fecharFormulario);
            this.el('formulario-notificacao').addEventListener('submit', (evento) => void this.salvarFormulario(evento));
            this.el('filtro-tipo').addEventListener('change', () => void this.carregar());
            this.el('filtro-status').addEventListener('change', () => void this.carregar());
            this.el('filtro-busca').addEventListener('input', () => {
                if (this.debounceBusca !== null)
                    window.clearTimeout(this.debounceBusca);
                this.debounceBusca = window.setTimeout(() => void this.carregar(), 350);
            });
            this.el('fechar-detalhe').addEventListener('click', () => this.el('dialogo-detalhe').close());
            this.el('cancelar-excluir').addEventListener('click', () => this.el('dialogo-excluir').close());
            this.el('confirmar-excluir').addEventListener('click', () => void this.confirmarExclusao());
            await this.carregarSituacao();
            await this.carregar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new NotificacoesView().iniciar();
});
