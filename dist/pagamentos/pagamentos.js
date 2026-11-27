"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class PagamentosView {
    constructor() {
        this.usuario = null;
        this.pagamentos = [];
        this.pagamentoSelecionado = null;
        this.acaoConfirmar = null;
        this.timerBusca = null;
        this.el = (id) => document.getElementById(id);
        this.abrirDialogo = (id) => {
            const dialogo = this.el(id);
            if (!dialogo.open)
                dialogo.showModal();
        };
        this.admin = () => this.usuario?.perfil === 'admin';
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
        this.criarSelo = (status) => {
            const selo = document.createElement('span');
            selo.className = `selo ${status}`;
            selo.textContent = this.statusTexto[status];
            return selo;
        };
        this.statusTexto = {
            pendente: 'Pendente',
            pago: 'Pago',
            atrasado: 'Atrasado',
            cancelado: 'Cancelado'
        };
        this.metodoTexto = {
            dinheiro: 'Dinheiro',
            pix: 'PIX',
            cartao: 'Cartão',
            boleto: 'Boleto',
            transferencia: 'Transferência'
        };
        this.moeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        this.dataBr = (valor) => {
            if (!valor)
                return '—';
            const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
            return ano && mes && dia ? `${dia}/${mes}/${ano}` : String(valor);
        };
        this.competenciaTexto = (valor) => {
            const [ano, mes] = valor.slice(0, 7).split('-');
            return ano && mes ? `${mes}/${ano}` : valor;
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
        this.filtroAtual = () => {
            const filtro = {};
            const status = this.el('filtro-status').value;
            const busca = this.el('busca').value.trim();
            const competencia = this.el('filtro-competencia').value;
            if (status)
                filtro.status = status;
            if (busca)
                filtro.busca = busca;
            if (/^\d{4}-\d{2}$/.test(competencia))
                filtro.competencia = competencia;
            return filtro;
        };
        this.preencherResumo = (resumo) => {
            this.el('resumo-pendente').textContent = this.moeda(Number(resumo.totalPendente) || 0);
            this.el('qtd-pendente').textContent = `${resumo.pendentes} pagamento(s)`;
            this.el('resumo-pago').textContent = this.moeda(Number(resumo.totalPago) || 0);
            this.el('qtd-pago').textContent = `${resumo.pagos} pagamento(s)`;
            this.el('resumo-atrasado').textContent = this.moeda(Number(resumo.totalAtrasado) || 0);
            this.el('qtd-atrasado').textContent = `${resumo.atrasados} pagamento(s)`;
        };
        this.criarLinha = (pagamento) => {
            const tr = document.createElement('tr');
            if (pagamento.status === 'cancelado')
                tr.className = 'linha-cancelada';
            const td = (texto, classe) => {
                const cel = document.createElement('td');
                cel.textContent = texto;
                if (classe)
                    cel.className = classe;
                return cel;
            };
            const tituloTd = document.createElement('td');
            tituloTd.className = 'col-titulo';
            const aluno = document.createElement('strong');
            aluno.textContent = pagamento.alunoNome;
            const plano = document.createElement('small');
            plano.textContent = pagamento.planoNome;
            tituloTd.append(aluno, plano);
            const competenciaTd = td(this.competenciaTexto(pagamento.competencia), 'col-data');
            const vencimentoTd = document.createElement('td');
            vencimentoTd.className = 'col-data';
            vencimentoTd.textContent = this.dataBr(pagamento.dataVencimento);
            const valorTd = td(this.moeda(pagamento.valor), 'col-valor');
            const statusTd = document.createElement('td');
            statusTd.append(this.criarSelo(pagamento.status));
            const pagamentoTd = document.createElement('td');
            pagamentoTd.className = 'col-data';
            if (pagamento.dataPagamento) {
                const data = document.createElement('span');
                data.textContent = this.dataBr(pagamento.dataPagamento);
                const metodo = document.createElement('small');
                metodo.textContent = pagamento.metodo ? this.metodoTexto[pagamento.metodo] : '—';
                pagamentoTd.append(data, metodo);
                if (pagamento.observacao)
                    pagamentoTd.title = pagamento.observacao;
            }
            else {
                pagamentoTd.textContent = '—';
            }
            const acoesTd = document.createElement('td');
            const acoes = document.createElement('div');
            acoes.className = 'acoes-linha';
            const podeValidar = pagamento.status === 'pendente' || pagamento.status === 'atrasado';
            if (podeValidar) {
                const btnValidar = this.criarBotao('Validar', 'botao verde pequeno');
                btnValidar.addEventListener('click', () => this.abrirValidacao(pagamento));
                acoes.append(btnValidar);
                const btnCancelar = this.criarBotao('Cancelar', 'botao secundario pequeno');
                btnCancelar.addEventListener('click', () => this.cancelarPagamento(pagamento));
                acoes.append(btnCancelar);
            }
            else if (pagamento.status === 'pago') {
                const btnCancelar = this.criarBotao('Cancelar', 'botao secundario pequeno');
                btnCancelar.disabled = true;
                btnCancelar.title = 'Pagamentos já validados não podem ser cancelados.';
                acoes.append(btnCancelar);
            }
            const btnEditar = this.criarBotao('Editar', 'botao secundario pequeno');
            btnEditar.addEventListener('click', () => void this.abrirEdicao(pagamento.id, btnEditar));
            const btnExcluir = this.criarBotao('Excluir', 'botao perigo pequeno');
            if (pagamento.status === 'pago') {
                btnExcluir.disabled = true;
                btnExcluir.title = 'Pagamentos já validados não podem ser excluídos.';
            }
            else {
                btnExcluir.addEventListener('click', () => this.excluirPagamento(pagamento));
            }
            acoes.append(btnEditar, btnExcluir);
            acoesTd.append(acoes);
            tr.append(tituloTd, competenciaTd, vencimentoTd, valorTd, statusTd, pagamentoTd, acoesTd);
            return tr;
        };
        this.renderizar = () => {
            const corpo = this.el('corpo');
            corpo.replaceChildren();
            this.el('titulo').textContent =
                this.pagamentos.length === 1 ? 'Pagamentos (1)' : `Pagamentos (${this.pagamentos.length})`;
            if (!this.pagamentos.length) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 7;
                td.textContent = 'Nenhum pagamento encontrado. Use "Gerar mensalidades" para criar as parcelas das assinaturas ativas.';
                td.style.textAlign = 'center';
                td.style.padding = '24px 14px';
                td.style.color = 'var(--primaria-500)';
                tr.append(td);
                corpo.append(tr);
                return;
            }
            this.pagamentos.forEach((pagamento) => corpo.append(this.criarLinha(pagamento)));
        };
        this.carregar = async () => {
            const filtro = this.filtroAtual();
            try {
                const [pagamentos, resumo] = await Promise.all([
                    electron_1.ipcRenderer.invoke('pagamentos:listar', filtro),
                    electron_1.ipcRenderer.invoke('pagamentos:resumo', filtro)
                ]);
                this.pagamentos = Array.isArray(pagamentos) ? pagamentos : [];
                this.preencherResumo(resumo);
                this.renderizar();
                this.status('');
            }
            catch {
                this.pagamentos = [];
                this.renderizar();
                this.status('Não foi possível carregar os pagamentos.', 'erro');
            }
        };
        this.agendarBusca = () => {
            if (this.timerBusca)
                clearTimeout(this.timerBusca);
            this.timerBusca = setTimeout(() => void this.carregar(), 300);
        };
        this.carregarAssinaturas = async (selecionada) => {
            const select = this.el('form-assinatura');
            try {
                const assinaturas = (await electron_1.ipcRenderer.invoke('assinaturas:listar', {}));
                select.replaceChildren();
                const vazio = document.createElement('option');
                vazio.value = '';
                vazio.textContent = 'Selecione uma assinatura';
                select.append(vazio);
                (Array.isArray(assinaturas) ? assinaturas : []).forEach((assinatura) => {
                    const opcao = document.createElement('option');
                    opcao.value = String(assinatura.id);
                    opcao.textContent = `${assinatura.alunoNome} — ${assinatura.planoNome} (${assinatura.status})`;
                    select.append(opcao);
                });
                if (selecionada)
                    select.value = String(selecionada);
            }
            catch {
                select.replaceChildren();
                const opcao = document.createElement('option');
                opcao.value = '';
                opcao.textContent = 'Não foi possível carregar as assinaturas';
                select.append(opcao);
            }
        };
        this.abrirFormulario = async (pagamento) => {
            this.el('formulario-pagamento').reset();
            this.el('erro-formulario').textContent = '';
            const edicao = pagamento !== null;
            this.el('pagamento-id').value = edicao ? String(pagamento.id) : '';
            this.el('titulo-formulario').textContent = edicao ? 'Editar pagamento' : 'Novo pagamento';
            this.el('salvar-formulario').textContent = edicao ? 'Salvar alterações' : 'Cadastrar';
            await this.carregarAssinaturas(edicao ? pagamento.assinaturaId : undefined);
            this.el('form-assinatura').disabled = edicao;
            this.el('form-competencia').value = edicao ? pagamento.competencia.slice(0, 7) : '';
            const valor = this.el('form-valor');
            valor.value = edicao ? String(pagamento.valor) : '';
            this.el('form-vencimento').value = edicao ? pagamento.dataVencimento : this.hoje();
            this.el('form-status').value = edicao ? pagamento.status : 'pendente';
            this.el('form-status').disabled = !edicao;
            this.el('form-data-pagamento').value = edicao ? (pagamento.dataPagamento ?? '') : '';
            this.el('form-data-pagamento').disabled = !edicao;
            this.el('form-metodo').value = edicao ? (pagamento.metodo ?? '') : '';
            this.el('form-metodo').disabled = !edicao;
            this.el('form-observacao').value = edicao ? (pagamento.observacao ?? '') : '';
            this.abrirDialogo('dialogo-formulario');
        };
        this.abrirEdicao = async (id, botao) => {
            if (botao)
                botao.disabled = true;
            try {
                const pagamento = (await electron_1.ipcRenderer.invoke('pagamentos:obter', id));
                if (!pagamento) {
                    this.status('Pagamento não encontrado.', 'erro');
                    return;
                }
                await this.abrirFormulario(pagamento);
            }
            catch {
                this.status('Não foi possível carregar o pagamento.', 'erro');
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
            const id = Number(this.el('pagamento-id').value || '0');
            const assinaturaId = Number(this.el('form-assinatura').value || '0');
            const competencia = this.el('form-competencia').value;
            const valor = Number(this.el('form-valor').value);
            const dataVencimento = this.el('form-vencimento').value;
            const statusPagamento = this.el('form-status').value;
            const dataPagamento = this.el('form-data-pagamento').value || null;
            const metodo = this.el('form-metodo').value || null;
            const observacao = this.el('form-observacao').value;
            if (!id && !assinaturaId) {
                erro.textContent = 'Selecione uma assinatura.';
                return;
            }
            if (!/^\d{4}-\d{2}$/.test(competencia)) {
                erro.textContent = 'Informe a competência no formato AAAA-MM.';
                return;
            }
            if (!Number.isFinite(valor) || valor <= 0) {
                erro.textContent = 'Informe um valor maior que zero.';
                return;
            }
            if (!dataVencimento) {
                erro.textContent = 'Informe a data de vencimento.';
                return;
            }
            if (statusPagamento === 'pago' && (!dataPagamento || !metodo)) {
                erro.textContent = 'Para pagamentos pagos, informe a data e o método de pagamento.';
                return;
            }
            botao.disabled = true;
            erro.textContent = '';
            const entrada = id
                ? {
                    id,
                    competencia,
                    valor,
                    dataVencimento,
                    status: statusPagamento,
                    dataPagamento: statusPagamento === 'pago' ? dataPagamento : null,
                    metodo: statusPagamento === 'pago' ? metodo : null,
                    observacao
                }
                : { assinaturaId, competencia, valor, dataVencimento };
            try {
                const resultado = (await electron_1.ipcRenderer.invoke(id ? 'pagamentos:atualizar' : 'pagamentos:criar', entrada));
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.fecharFormulario();
                await this.carregar();
                this.status(id ? 'Pagamento atualizado com sucesso.' : 'Pagamento cadastrado com sucesso.', 'sucesso');
            }
            catch {
                erro.textContent = 'Não foi possível salvar o pagamento.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.excluirPagamento = (pagamento) => {
            this.abrirConfirmacao('Excluir pagamento', `Deseja excluir a cobrança de ${this.moeda(pagamento.valor)} de ${pagamento.alunoNome} referente a ${this.competenciaTexto(pagamento.competencia)}?`, 'Excluir', true, async () => {
                const resultado = (await electron_1.ipcRenderer.invoke('pagamentos:excluir', pagamento.id));
                if (!resultado.ok)
                    throw new Error(resultado.mensagem);
                await this.carregar();
                this.status(resultado.aviso
                    ? `Pagamento excluído. ${resultado.aviso}`
                    : 'Pagamento excluído com sucesso.', 'sucesso');
            });
        };
        this.abrirValidacao = (pagamento) => {
            this.pagamentoSelecionado = pagamento;
            this.el('resumo-validar').textContent =
                `${pagamento.alunoNome} • ${pagamento.planoNome} • competência ${this.competenciaTexto(pagamento.competencia)} • ${this.moeda(pagamento.valor)}`;
            this.el('validar-data').value = this.hoje();
            this.el('validar-metodo').value = 'pix';
            this.el('validar-observacao').value = '';
            this.el('erro-validar').textContent = '';
            this.abrirDialogo('dialogo-validar');
        };
        this.salvarValidacao = async (evento) => {
            evento.preventDefault();
            if (!this.pagamentoSelecionado)
                return;
            const botao = this.el('salvar-validar');
            const erro = this.el('erro-validar');
            erro.textContent = '';
            const dados = {
                id: this.pagamentoSelecionado.id,
                dataPagamento: this.el('validar-data').value,
                metodo: this.el('validar-metodo').value,
                observacao: this.el('validar-observacao').value
            };
            if (!dados.dataPagamento) {
                erro.textContent = 'Informe a data do pagamento.';
                return;
            }
            botao.disabled = true;
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('pagamentos:registrar', dados));
                if (!resultado.ok) {
                    erro.textContent = resultado.mensagem;
                    return;
                }
                this.pagamentoSelecionado = null;
                this.el('dialogo-validar').close();
                await this.carregar();
                this.status('Pagamento validado com sucesso.', 'sucesso');
            }
            catch {
                erro.textContent = 'Não foi possível validar o pagamento.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.abrirConfirmacao = (titulo, texto, rotulo, perigo, acao) => {
            this.acaoConfirmar = acao;
            this.el('titulo-confirmar').textContent = titulo;
            this.el('texto-confirmar').textContent = texto;
            this.el('erro-confirmar').textContent = '';
            const botao = this.el('confirmar-acao');
            botao.textContent = rotulo;
            botao.className = perigo ? 'botao perigo' : 'botao';
            this.abrirDialogo('dialogo-confirmar');
        };
        this.executarConfirmacao = async () => {
            if (!this.acaoConfirmar)
                return;
            const botao = this.el('confirmar-acao');
            botao.disabled = true;
            this.el('erro-confirmar').textContent = '';
            try {
                await this.acaoConfirmar();
                this.acaoConfirmar = null;
                this.el('dialogo-confirmar').close();
            }
            catch (erro) {
                this.el('erro-confirmar').textContent =
                    erro instanceof Error ? erro.message : 'Não foi possível concluir a ação.';
            }
            finally {
                botao.disabled = false;
            }
        };
        this.cancelarPagamento = (pagamento) => {
            this.abrirConfirmacao('Cancelar pagamento', `Deseja cancelar a cobrança de ${this.moeda(pagamento.valor)} de ${pagamento.alunoNome} referente a ${this.competenciaTexto(pagamento.competencia)}?`, 'Cancelar cobrança', true, async () => {
                const resultado = (await electron_1.ipcRenderer.invoke('pagamentos:cancelar', pagamento.id));
                if (!resultado.ok)
                    throw new Error(resultado.mensagem);
                await this.carregar();
                this.status('Cobrança cancelada.', 'sucesso');
            });
        };
        this.gerar = async () => {
            const botao = this.el('gerar');
            botao.disabled = true;
            this.status('Gerando mensalidades...');
            try {
                const resultado = (await electron_1.ipcRenderer.invoke('pagamentos:gerar'));
                if (!resultado.ok) {
                    this.status(resultado.mensagem, 'erro');
                    return;
                }
                await this.carregar();
                const criados = resultado.criados ?? 0;
                const ignorados = resultado.ignorados ?? 0;
                this.status(criados > 0
                    ? `${criados} mensalidade(s) gerada(s)${ignorados > 0 ? ` • ${ignorados} já existente(s)` : ''}.`
                    : 'Nenhuma mensalidade nova. As parcelas das assinaturas ativas já estão geradas.', 'sucesso');
            }
            catch {
                this.status('Não foi possível gerar as mensalidades.', 'erro');
            }
            finally {
                botao.disabled = false;
            }
        };
        this.limpar = async () => {
            this.el('busca').value = '';
            this.el('filtro-status').value = '';
            this.el('filtro-competencia').value = '';
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
        this.configurarEventos = () => {
            this.el('busca').addEventListener('input', this.agendarBusca);
            this.el('filtro-status').addEventListener('change', () => void this.carregar());
            this.el('filtro-competencia').addEventListener('change', () => void this.carregar());
            this.el('limpar').addEventListener('click', () => void this.limpar());
            this.el('gerar').addEventListener('click', () => void this.gerar());
            this.el('novo').addEventListener('click', () => void this.abrirFormulario(null));
            this.el('cancelar-formulario').addEventListener('click', this.fecharFormulario);
            this.el('formulario-pagamento').addEventListener('submit', (evento) => void this.salvarFormulario(evento));
            this.el('cancelar-validar').addEventListener('click', () => this.el('dialogo-validar').close());
            this.el('formulario-validar').addEventListener('submit', (evento) => void this.salvarValidacao(evento));
            this.el('cancelar-confirmar').addEventListener('click', () => this.el('dialogo-confirmar').close());
            this.el('confirmar-acao').addEventListener('click', () => void this.executarConfirmacao());
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
                this.el('painel-pagamentos').classList.add('oculto');
                this.el('acesso-negado').classList.remove('oculto');
                return;
            }
            this.configurarEventos();
            await this.carregar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new PagamentosView().iniciar();
});
