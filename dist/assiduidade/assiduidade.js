"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class AssiduidadeView {
    constructor() {
        this.faixas = {
            baixa: 'Baixa',
            media: 'Média',
            alta: 'Alta'
        };
        this.el = (id) => document.getElementById(id);
        this.criar = (tag, classe, texto) => {
            const elemento = document.createElement(tag);
            if (classe)
                elemento.className = classe;
            if (texto !== undefined)
                elemento.textContent = texto;
            return elemento;
        };
        this.numeroFmt = (valor, sufixo = '') => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${sufixo}`;
        this.variacaoFmt = (valor, sufixo = '') => valor === undefined ? '—' : `${valor > 0 ? '+' : ''}${this.numeroFmt(valor, sufixo)}`;
        this.dataBr = (valor) => {
            const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
            return ano && mes && dia ? `${dia}/${mes}/${ano}` : '—';
        };
        this.statusPagina = (texto, erro = false) => {
            const el = this.el('status');
            el.textContent = texto;
            el.classList.toggle('erro', erro);
        };
        this.carregarAlunos = async () => {
            try {
                const alunos = (await electron_1.ipcRenderer.invoke('alunos:listar', {}));
                const selecao = this.el('aluno');
                selecao.replaceChildren(this.criar('option', undefined, 'Todos os alunos'), ...alunos.map((aluno) => {
                    const opcao = document.createElement('option');
                    opcao.value = String(aluno.id);
                    opcao.textContent = aluno.nome;
                    return opcao;
                }));
                selecao.firstElementChild?.setAttribute('value', '');
            }
            catch (erro) {
                console.error(erro);
                this.statusPagina('Não foi possível carregar a lista de alunos.', true);
            }
        };
        this.renderizarKpis = (dados) => {
            const cartoes = [
                { rotulo: 'Alunos no relatório', valor: String(dados.alunos.length), detalhe: 'Alunos com cadastro ativo ou inativo' },
                { rotulo: 'Frequência média', valor: this.numeroFmt(dados.frequenciaMedia, '%'), detalhe: 'Média da presença em 90 dias' },
                { rotulo: 'Presenças', valor: String(dados.totalPresencas), detalhe: 'Registros na janela atual' },
                { rotulo: 'Avaliações', valor: String(dados.totalAvaliacoes), detalhe: 'Medidas usadas no cruzamento' },
                {
                    rotulo: 'Distribuição',
                    valor: `${dados.distribuicao.baixa} / ${dados.distribuicao.media} / ${dados.distribuicao.alta}`,
                    detalhe: 'Baixa / média / alta frequência'
                }
            ];
            this.el('kpis').replaceChildren(...cartoes.map(({ rotulo, valor, detalhe }) => {
                const cartao = this.criar('div', 'kpi');
                cartao.append(this.criar('span', undefined, rotulo), this.criar('strong', undefined, valor), this.criar('small', undefined, detalhe));
                return cartao;
            }));
        };
        this.linhaFaixa = (faixa) => {
            const item = document.createElement('li');
            const peso = faixa.pesoInicial !== undefined && faixa.pesoFinal !== undefined
                ? ` • peso ${this.numeroFmt(faixa.pesoInicial, ' kg')} → ${this.numeroFmt(faixa.pesoFinal, ' kg')}`
                : '';
            item.textContent =
                `${faixa.rotulo}: ${faixa.avaliacoes} avaliação(ões) • ` +
                    `presença média ${this.numeroFmt(faixa.frequenciaMedia, '%')}${peso} • ` +
                    `Δ peso ${this.variacaoFmt(faixa.variacaoPeso, ' kg')} • Δ IMC ${this.variacaoFmt(faixa.variacaoImc)}`;
            return item;
        };
        this.renderizarLinha = (item) => {
            const tr = document.createElement('tr');
            const tdAluno = document.createElement('td');
            tdAluno.append(this.criar('strong', undefined, item.alunoNome));
            const tdSituacao = document.createElement('td');
            tdSituacao.append(this.criar('span', item.ativo ? 'selo alta' : 'selo inativo', item.ativo ? 'Ativo' : 'Inativo'));
            const tdFaixa = document.createElement('td');
            const detalhes = document.createElement('details');
            const resumo = document.createElement('summary');
            const selo = this.criar('span', `selo ${item.analise.faixaAtual}`, this.faixas[item.analise.faixaAtual]);
            resumo.append(selo, document.createTextNode(` ${this.numeroFmt(item.frequencia.percentual, '%')}`));
            const lista = document.createElement('ul');
            const faixasComAvaliacao = item.analise.faixas.filter((faixa) => faixa.avaliacoes > 0);
            if (faixasComAvaliacao.length) {
                lista.append(...faixasComAvaliacao.map(this.linhaFaixa));
            }
            else {
                lista.append(this.criar('li', undefined, 'Sem avaliações para cruzar com as presenças.'));
            }
            detalhes.append(resumo, lista);
            tdFaixa.append(detalhes);
            const trLinha = [
                tdAluno,
                tdSituacao,
                tdFaixa,
                this.criar('td', 'destaque', this.numeroFmt(item.frequencia.percentual, '%')),
                this.criar('td', undefined, `${item.frequencia.totalPresencas} em ${item.frequencia.diasNoPeriodo} dias`),
                this.criar('td', undefined, String(item.analise.totalAvaliacoes)),
                this.criar('td', undefined, this.variacaoFmt(item.analise.variacaoPeso, ' kg')),
                this.criar('td', undefined, this.variacaoFmt(item.analise.variacaoImc))
            ];
            tr.append(...trLinha);
            return tr;
        };
        this.renderizar = (dados) => {
            this.el('periodo').textContent =
                `Histórico de ${this.dataBr(dados.periodo.inicio)} a ${this.dataBr(dados.periodo.fim)}`;
            this.renderizarKpis(dados);
            const corpo = this.el('corpo');
            if (!dados.alunos.length) {
                const linha = document.createElement('tr');
                const celula = this.criar('td', 'vazio', 'Nenhum aluno encontrado para este filtro.');
                celula.setAttribute('colspan', '8');
                linha.append(celula);
                corpo.replaceChildren(linha);
                return;
            }
            corpo.replaceChildren(...dados.alunos.map(this.renderizarLinha));
        };
        this.carregar = async () => {
            try {
                const valor = this.el('aluno').value;
                const dados = (await electron_1.ipcRenderer.invoke('assiduidade:relatorio', {
                    alunoId: valor ? Number(valor) : null
                }));
                this.renderizar(dados);
                this.statusPagina('');
            }
            catch (erro) {
                console.error(erro);
                this.statusPagina('Não foi possível carregar o relatório de assiduidade.', true);
            }
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
            let usuario = null;
            try {
                usuario = (await electron_1.ipcRenderer.invoke('auth:me'));
            }
            catch {
                usuario = null;
            }
            if (!usuario || !['admin', 'instrutor'].includes(usuario.perfil)) {
                this.statusPagina('Acesso negado para este perfil.', true);
                return;
            }
            this.el('voltar').addEventListener('click', () => void this.voltar());
            this.el('atualizar').addEventListener('click', () => void this.carregar());
            this.el('aluno').addEventListener('change', () => void this.carregar());
            await this.carregarAlunos();
            await this.carregar();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new AssiduidadeView().iniciar();
});
