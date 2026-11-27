"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const AnaliseAssiduidade_1 = require("../assiduidade/AnaliseAssiduidade");
class PortalAlunoView {
    constructor() {
        this.usuario = null;
        this.aluno = null;
        this.analise = new AnaliseAssiduidade_1.AnaliseAssiduidadeEvolucao();
        this.el = (id) => document.getElementById(id);
        this.criar = (tag, classe, texto) => {
            const elemento = document.createElement(tag);
            if (classe)
                elemento.className = classe;
            if (texto !== undefined)
                elemento.textContent = texto;
            return elemento;
        };
        this.dataBr = (valor) => {
            if (!valor)
                return '—';
            const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
            return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
        };
        this.dataCurta = (valor) => {
            const [, mes, dia] = String(valor).slice(0, 10).split('-');
            return dia && mes ? `${dia}/${mes}` : valor;
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
        this.numeroFmt = (valor, sufixo = '') => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${sufixo}`;
        this.numeroOpcaoFmt = (valor, sufixo = '') => valor === undefined ? '—' : this.numeroFmt(valor, sufixo);
        this.variacaoFmt = (valor, sufixo = '') => valor === undefined ? '—' : `${valor > 0 ? '+' : ''}${this.numeroFmt(valor, sufixo)}`;
        this.cpfFmt = (cpf) => {
            const digitos = cpf.replace(/\D/g, '');
            if (digitos.length !== 11)
                return cpf || '—';
            return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
        };
        this.enderecoFmt = (endereco) => {
            const partes = [
                [endereco.logradouro, endereco.numero].filter(Boolean).join(', '),
                endereco.complemento,
                endereco.bairro,
                [endereco.cidade, endereco.estado].filter(Boolean).join(' - '),
                endereco.cep ? `CEP ${endereco.cep}` : ''
            ].filter((parte) => parte && String(parte).trim());
            return partes.length ? partes.join(' • ') : '—';
        };
        this.statusPagina = (texto, erro = false) => {
            const el = this.el('status');
            el.textContent = texto;
            el.classList.toggle('erro', erro);
        };
        this.carregarPerfil = async () => {
            try {
                const aluno = (await electron_1.ipcRenderer.invoke('alunos:meuPerfil'));
                if (!aluno) {
                    this.statusPagina('Seu usuário ainda não está vinculado a um cadastro de aluno.', true);
                    return false;
                }
                this.aluno = aluno;
                const primeiroNome = aluno.nome.split(' ')[0] || aluno.nome;
                this.el('nome-aluno').textContent = `Olá, ${primeiroNome}!`;
                this.el('email-aluno').textContent = aluno.email;
                const dl = this.el('dados-aluno');
                dl.replaceChildren();
                this.dado(dl, 'E-mail', aluno.email);
                this.dado(dl, 'Telefone', aluno.telefone);
                this.dado(dl, 'Nascimento', this.dataBr(aluno.dataNascimento));
                this.dado(dl, 'CPF', this.cpfFmt(aluno.cpf));
                this.dado(dl, 'Contato de emergência', aluno.contatoEmergencia);
                this.dado(dl, 'Endereço', this.enderecoFmt(aluno.endereco), true);
                return true;
            }
            catch (erro) {
                console.error(erro);
                this.statusPagina('Não foi possível carregar seus dados.', true);
                return false;
            }
        };
        this.dado = (dl, titulo, valor, span3 = false) => {
            const div = document.createElement('div');
            if (span3)
                div.className = 'span3';
            const dt = document.createElement('dt');
            dt.textContent = titulo;
            const dd = document.createElement('dd');
            dd.textContent = valor && valor.trim() ? valor : '—';
            div.append(dt, dd);
            dl.append(div);
        };
        this.carregarPlano = async () => {
            try {
                const plano = (await electron_1.ipcRenderer.invoke('assinaturas:minha'));
                const selo = this.el('plano-status');
                if (!plano) {
                    this.el('plano-nome').textContent = 'Nenhum plano ativo';
                    selo.classList.add('oculto');
                    this.el('plano-periodo').textContent = 'Procure a recepção para contratar um plano.';
                    return;
                }
                this.el('plano-nome').textContent = plano.planoNome;
                selo.textContent = plano.status;
                selo.className = `selo ${plano.status}`;
                this.el('plano-periodo').textContent =
                    `${this.dataBr(plano.dataInicio)} até ${this.dataBr(plano.dataFim)}`;
            }
            catch (erro) {
                console.error(erro);
                this.el('plano-nome').textContent = 'Indisponível';
            }
        };
        this.carregarFrequencia = async () => {
            try {
                const resumo = (await electron_1.ipcRenderer.invoke('presencas:minhaFrequencia'));
                this.el('freq-percentual').textContent = this.numeroFmt(resumo.percentual, '%');
                this.el('freq-barra').style.width = `${Math.min(100, Math.max(0, resumo.percentual))}%`;
                this.el('freq-total').textContent =
                    `${resumo.totalPresencas} presença(s) em ${resumo.diasNoPeriodo} dias` +
                        (resumo.ultimaPresenca ? ` • última em ${this.dataBr(resumo.ultimaPresenca)}` : '');
                return resumo;
            }
            catch (erro) {
                console.error(erro);
                this.el('freq-percentual').textContent = '—';
                return null;
            }
        };
        this.criarLinhaMedida = (avaliacao) => {
            const tr = document.createElement('tr');
            const tdData = document.createElement('td');
            tdData.textContent = this.dataBr(avaliacao.dataAvaliacao);
            const tdPeso = document.createElement('td');
            tdPeso.className = 'destaque';
            tdPeso.textContent = this.numeroFmt(avaliacao.pesoKg, ' kg');
            const tdImc = document.createElement('td');
            tdImc.textContent = this.numeroFmt(avaliacao.imc);
            const tdGordura = document.createElement('td');
            tdGordura.textContent = this.numeroOpcaoFmt(avaliacao.percentualGordura, '%');
            const tdCintura = document.createElement('td');
            tdCintura.textContent = this.numeroOpcaoFmt(avaliacao.cinturaCm, ' cm');
            tr.append(tdData, tdPeso, tdImc, tdGordura, tdCintura);
            return tr;
        };
        this.svg = (tag, atributos) => {
            const elemento = document.createElementNS('http://www.w3.org/2000/svg', tag);
            for (const [nome, valor] of Object.entries(atributos)) {
                elemento.setAttribute(nome, String(valor));
            }
            return elemento;
        };
        this.desenharGrafico = (avaliacoes) => {
            const container = this.el('grafico');
            container.replaceChildren();
            container.classList.remove('oculto');
            const pontos = [...avaliacoes]
                .sort((a, b) => a.dataAvaliacao.localeCompare(b.dataAvaliacao) || a.id - b.id)
                .map((avaliacao) => ({ data: avaliacao.dataAvaliacao, peso: avaliacao.pesoKg }));
            if (pontos.length < 2) {
                container.classList.add('oculto');
                return;
            }
            const largura = 900;
            const altura = 220;
            const margem = { esquerda: 56, direita: 24, topo: 20, base: 34 };
            const larguraUtil = largura - margem.esquerda - margem.direita;
            const alturaUtil = altura - margem.topo - margem.base;
            const pesos = pontos.map((ponto) => ponto.peso);
            let minimo = Math.min(...pesos);
            let maximo = Math.max(...pesos);
            if (minimo === maximo) {
                minimo -= 1;
                maximo += 1;
            }
            const folga = (maximo - minimo) * 0.15;
            minimo -= folga;
            maximo += folga;
            const x = (indice) => margem.esquerda + (indice / (pontos.length - 1)) * larguraUtil;
            const y = (valor) => margem.topo + (1 - (valor - minimo) / (maximo - minimo)) * alturaUtil;
            const svg = this.svg('svg', {
                viewBox: `0 0 ${largura} ${altura}`,
                role: 'img',
                'aria-label': 'Gráfico da evolução do seu peso'
            });
            for (let i = 0; i <= 4; i++) {
                const valor = minimo + ((maximo - minimo) * i) / 4;
                const linhaY = y(valor);
                svg.append(this.svg('line', {
                    x1: margem.esquerda,
                    x2: largura - margem.direita,
                    y1: linhaY,
                    y2: linhaY,
                    stroke: '#e5e7eb',
                    'stroke-width': 1
                }), this.svg('text', {
                    x: margem.esquerda - 10,
                    y: linhaY + 4,
                    'text-anchor': 'end',
                    'font-size': 11,
                    fill: '#6b7280'
                }));
                const rotulo = svg.lastElementChild;
                rotulo.textContent = valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
            }
            const pontosTexto = pontos.map((ponto, indice) => `${x(indice)},${y(ponto.peso)}`).join(' ');
            svg.append(this.svg('polyline', {
                points: pontosTexto,
                fill: 'none',
                stroke: '#059669',
                'stroke-width': 2.5,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
            }));
            const passo = pontos.length <= 6 ? 1 : Math.ceil(pontos.length / 6);
            pontos.forEach((ponto, indice) => {
                const circulo = this.svg('circle', {
                    cx: x(indice),
                    cy: y(ponto.peso),
                    r: 4,
                    fill: '#ffffff',
                    stroke: '#059669',
                    'stroke-width': 2
                });
                const titulo = this.svg('title', {});
                titulo.textContent = `${this.dataBr(ponto.data)} — ${this.numeroFmt(ponto.peso, ' kg')}`;
                circulo.append(titulo);
                svg.append(circulo);
                if (indice % passo === 0 || indice === pontos.length - 1) {
                    const rotulo = this.svg('text', {
                        x: x(indice),
                        y: altura - 12,
                        'text-anchor': 'middle',
                        'font-size': 11,
                        fill: '#6b7280'
                    });
                    rotulo.textContent = this.dataCurta(ponto.data);
                    svg.append(rotulo);
                }
            });
            container.append(svg);
        };
        this.carregarAvaliacoes = async () => {
            try {
                const avaliacoes = (await electron_1.ipcRenderer.invoke('avaliacoes:minhas'));
                const vazio = this.el('grafico-vazio');
                if (!avaliacoes.length) {
                    vazio.classList.remove('oculto');
                    this.el('grafico').classList.add('oculto');
                    this.el('ultima-peso').textContent = '—';
                    this.el('ultima-detalhe').textContent = 'Nenhuma avaliação registrada.';
                    this.el('ultima-data').textContent = '';
                    this.el('corpo-medidas').replaceChildren();
                    return [];
                }
                const ultima = avaliacoes[0];
                this.el('ultima-peso').textContent = this.numeroFmt(ultima.pesoKg, ' kg');
                this.el('ultima-detalhe').textContent =
                    `${this.numeroFmt(ultima.imc)} de IMC • ${this.numeroOpcaoFmt(ultima.percentualGordura, '% de gordura')}`;
                this.el('ultima-data').textContent = `Avaliação de ${this.dataBr(ultima.dataAvaliacao)}`;
                this.el('corpo-medidas').replaceChildren(...avaliacoes.map((avaliacao) => this.criarLinhaMedida(avaliacao)));
                vazio.classList.add('oculto');
                this.desenharGrafico(avaliacoes);
                return avaliacoes;
            }
            catch (erro) {
                console.error(erro);
                this.el('grafico-vazio').textContent = 'Não foi possível carregar suas avaliações.';
                this.el('grafico-vazio').classList.remove('oculto');
                return [];
            }
        };
        this.renderizarAnalise = (resumo) => {
            const painel = this.el('analise-assiduidade');
            painel.classList.remove('vazio');
            painel.replaceChildren();
            const rotuloAtual = {
                baixa: 'baixa',
                media: 'média',
                alta: 'alta'
            };
            painel.append(this.criar('p', 'analise-resumo', `Faixa atual: ${rotuloAtual[resumo.faixaAtual]} ` +
                `(${this.numeroFmt(resumo.percentualAtual, '%')} em ${resumo.diasNoPeriodo} dias, ` +
                `${resumo.totalPresencas} presença(s)). ` +
                `${resumo.totalAvaliacoes} avaliação(ões) no histórico • ` +
                `peso ${this.variacaoFmt(resumo.variacaoPeso, ' kg')} • ` +
                `IMC ${this.variacaoFmt(resumo.variacaoImc)}.`));
            if (!resumo.totalAvaliacoes) {
                painel.append(this.criar('p', 'vazio', 'Sem avaliações para cruzar com as presenças.'));
                return;
            }
            const tabela = document.createElement('table');
            const cabecalho = document.createElement('thead');
            const linhaCabecalho = document.createElement('tr');
            for (const titulo of ['Faixa de frequência', 'Avaliações', 'Presença média', 'Peso', 'Δ peso', 'Δ IMC']) {
                const th = document.createElement('th');
                th.textContent = titulo;
                linhaCabecalho.append(th);
            }
            cabecalho.append(linhaCabecalho);
            const corpo = document.createElement('tbody');
            for (const faixa of resumo.faixas) {
                const tr = document.createElement('tr');
                if (faixa.faixa === resumo.faixaAtual)
                    tr.className = 'faixa-atual';
                const tdFaixa = document.createElement('td');
                tdFaixa.append(this.criar('span', `selo ${faixa.faixa}`, faixa.rotulo));
                const tdAvaliacoes = this.criar('td', undefined, String(faixa.avaliacoes));
                const tdFrequencia = this.criar('td', undefined, faixa.avaliacoes ? this.numeroFmt(faixa.frequenciaMedia, '%') : '—');
                const tdPeso = this.criar('td', undefined, faixa.pesoInicial !== undefined && faixa.pesoFinal !== undefined
                    ? `${this.numeroFmt(faixa.pesoInicial, ' kg')} → ${this.numeroFmt(faixa.pesoFinal, ' kg')}`
                    : '—');
                const tdVariacaoPeso = this.criar('td', 'destaque', this.variacaoFmt(faixa.variacaoPeso, ' kg'));
                const tdVariacaoImc = this.criar('td', undefined, this.variacaoFmt(faixa.variacaoImc));
                tr.append(tdFaixa, tdAvaliacoes, tdFrequencia, tdPeso, tdVariacaoPeso, tdVariacaoImc);
                corpo.append(tr);
            }
            tabela.append(cabecalho, corpo);
            painel.append(tabela);
        };
        this.carregarAnaliseCruzada = async (frequencia, avaliacoes) => {
            const painel = this.el('analise-assiduidade');
            if (!frequencia) {
                painel.textContent = 'Não foi possível carregar a assiduidade.';
                return;
            }
            try {
                const presencas = (await electron_1.ipcRenderer.invoke('presencas:minhas', this.analise.periodoHistorico(avaliacoes)));
                this.renderizarAnalise(this.analise.calcular(frequencia, presencas, avaliacoes));
            }
            catch (erro) {
                console.error(erro);
                painel.textContent = 'Não foi possível cruzar presenças e avaliações.';
            }
        };
        this.carregarPresencas = async () => {
            try {
                const presencas = (await electron_1.ipcRenderer.invoke('presencas:minhas'));
                const vazio = this.el('presencas-vazio');
                if (!presencas.length) {
                    vazio.classList.remove('oculto');
                    this.el('corpo-presencas').replaceChildren();
                    return;
                }
                const origemTexto = {
                    aula: 'Aula',
                    livre: 'Livre',
                    experimental: 'Experimental'
                };
                const linhas = presencas.slice(0, 12).map((presenca) => {
                    const tr = document.createElement('tr');
                    const tdData = document.createElement('td');
                    tdData.textContent = this.dataBr(presenca.dataPresenca);
                    const tdAula = document.createElement('td');
                    tdAula.textContent = presenca.aulaTitulo ?? '—';
                    const tdOrigem = document.createElement('td');
                    tdOrigem.textContent = origemTexto[presenca.origem] ?? presenca.origem;
                    tr.append(tdData, tdAula, tdOrigem);
                    return tr;
                });
                this.el('corpo-presencas').replaceChildren(...linhas);
                vazio.classList.add('oculto');
            }
            catch (erro) {
                console.error(erro);
                this.el('presencas-vazio').textContent = 'Não foi possível carregar suas presenças.';
                this.el('presencas-vazio').classList.remove('oculto');
            }
        };
        this.carregarAvisos = async () => {
            try {
                const avisos = (await electron_1.ipcRenderer.invoke('notificacoes:minhas'));
                const vazio = this.el('avisos-vazio');
                const lista = this.el('lista-avisos');
                if (!avisos.length) {
                    lista.replaceChildren();
                    vazio.classList.remove('oculto');
                    return;
                }
                const statusTexto = {
                    enviado: 'Enviado',
                    falhou: 'Falhou',
                    pendente: 'Pendente'
                };
                const itens = avisos.slice(0, 20).map((aviso) => {
                    const item = document.createElement('article');
                    item.className = 'aviso';
                    const topo = document.createElement('div');
                    topo.className = 'aviso-topo';
                    const assunto = document.createElement('strong');
                    assunto.textContent = aviso.assunto;
                    const selo = document.createElement('span');
                    selo.className = `selo ${aviso.status}`;
                    selo.textContent = statusTexto[aviso.status];
                    topo.append(assunto, selo);
                    const data = document.createElement('small');
                    data.textContent = this.dataHoraFmt(aviso.enviadoEm ?? aviso.criadoEm);
                    const detalhes = document.createElement('details');
                    const resumo = document.createElement('summary');
                    resumo.textContent = 'Ver mensagem';
                    const texto = document.createElement('p');
                    texto.textContent = aviso.mensagem;
                    detalhes.append(resumo, texto);
                    item.append(topo, data, detalhes);
                    return item;
                });
                lista.replaceChildren(...itens);
                vazio.classList.add('oculto');
            }
            catch (erro) {
                console.error(erro);
                this.el('avisos-vazio').textContent = 'Não foi possível carregar seus avisos.';
                this.el('avisos-vazio').classList.remove('oculto');
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
            if (this.usuario.perfil !== 'aluno') {
                this.statusPagina('Acesso negado para este perfil.', true);
                return;
            }
            this.el('voltar').addEventListener('click', () => void this.voltar());
            const perfilOk = await this.carregarPerfil();
            if (!perfilOk)
                return;
            const [frequencia, avaliacoes] = await Promise.all([
                this.carregarFrequencia(),
                this.carregarAvaliacoes()
            ]);
            await Promise.all([
                this.carregarPlano(),
                this.carregarPresencas(),
                this.carregarAvisos(),
                this.carregarAnaliseCruzada(frequencia, avaliacoes)
            ]);
        };
    }
}
window.addEventListener('DOMContentLoaded', () => {
    void new PortalAlunoView().iniciar();
});
