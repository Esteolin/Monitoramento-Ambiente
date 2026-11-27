"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class RelatoriosView {
    constructor() {
        this.moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        this.moedaCurta = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0
        });
        this.svgNs = 'http://www.w3.org/2000/svg';
        this.nomeArquivo = 'relatorio';
        this.receitasAtuais = null;
        this.periodoAtualDados = null;
        this.categoriasAtuais = [];
        this.totalAtual = 0;
        this.rankingVisivel = false;
        this.classesCategoria = ['categoria-0', 'categoria-1', 'categoria-2', 'categoria-3'];
        this.rotuloFormato = {
            pdf: 'PDF',
            csv: 'CSV',
            json: 'JSON',
            png: 'PNG'
        };
        this.el = (id) => document.getElementById(id);
        this.dois = (numero) => String(numero).padStart(2, '0');
        this.criar = (tag, classe, texto) => {
            const elemento = document.createElement(tag);
            if (classe)
                elemento.className = classe;
            if (texto !== undefined)
                elemento.textContent = texto;
            return elemento;
        };
        this.percentual = (valor) => `${valor.toFixed(1).replace('.', ',')}%`;
        this.participacao = (valor, total) => total > 0 ? (valor / total) * 100 : 0;
        this.svg = (tag, atributos, texto) => {
            const elemento = document.createElementNS(this.svgNs, tag);
            Object.entries(atributos).forEach(([nome, valor]) => elemento.setAttribute(nome, String(valor)));
            if (texto !== undefined)
                elemento.textContent = texto;
            return elemento;
        };
        this.escala = (maximo) => {
            if (maximo <= 0)
                return 1;
            const base = Math.pow(10, Math.floor(Math.log10(maximo)));
            const fator = maximo / base;
            const arredondado = fator <= 1 ? 1 : fator <= 2 ? 2 : fator <= 5 ? 5 : 10;
            return arredondado * base;
        };
        this.distribuirBlocos = (categorias, total, quantidade) => {
            if (total <= 0)
                return categorias.map(() => 0);
            const exatas = categorias.map((categoria) => (categoria.valor / total) * quantidade);
            const bases = exatas.map((valor) => Math.floor(valor));
            const restante = quantidade - bases.reduce((soma, valor) => soma + valor, 0);
            const ordem = exatas
                .map((valor, indice) => ({ indice, fracao: valor - bases[indice] }))
                .sort((a, b) => b.fracao - a.fracao || a.indice - b.indice);
            for (let i = 0; i < restante; i++)
                bases[ordem[i % ordem.length].indice]++;
            return bases;
        };
        this.periodoAtual = () => {
            const tipo = this.el('periodo').value;
            if (tipo === 'mensal') {
                const [ano, mes] = this.el('mes').value.split('-').map(Number);
                return Number.isInteger(ano) && Number.isInteger(mes) ? { tipo, ano, mes } : null;
            }
            const ano = Number(this.el('ano').value);
            return Number.isInteger(ano) ? { tipo: 'anual', ano } : null;
        };
        this.titulo = (periodo) => {
            if (periodo.tipo === 'anual')
                return `Receita por categoria - ano de ${periodo.ano}`;
            const mes = new Date(periodo.ano, periodo.mes - 1, 1).toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric'
            });
            return `Receita por categoria - ${mes}`;
        };
        this.renderResumo = (categorias, total) => {
            const ordenadas = [...categorias].sort((a, b) => b.valor - a.valor);
            const lider = ordenadas[0];
            const participacao = lider ? this.participacao(lider.valor, total) : 0;
            const ativas = categorias.filter((categoria) => categoria.valor > 0).length;
            const media = categorias.length > 0 ? total / categorias.length : 0;
            const dados = [
                {
                    rotulo: 'Receita total',
                    valor: this.moeda.format(total),
                    detalhe: 'Soma de todas as categorias'
                },
                {
                    rotulo: 'Categoria líder',
                    valor: lider?.rotulo ?? '—',
                    detalhe: lider ? this.moeda.format(lider.valor) : 'Sem dados no período'
                },
                {
                    rotulo: 'Participação da líder',
                    valor: this.percentual(participacao),
                    detalhe: 'Do total recebido'
                },
                {
                    rotulo: 'Categorias ativas',
                    valor: `${ativas} de ${categorias.length}`,
                    detalhe: `Média de ${this.moeda.format(media)}`
                }
            ];
            const cartoes = dados.map(({ rotulo, valor, detalhe }) => {
                const cartao = this.criar('div', 'kpi');
                cartao.append(this.criar('span', undefined, rotulo), this.criar('strong', undefined, valor), this.criar('small', undefined, detalhe));
                return cartao;
            });
            this.el('kpis').replaceChildren(...cartoes);
        };
        this.renderRanking = (categorias, total) => {
            const ordenadas = [...categorias].sort((a, b) => b.valor - a.valor);
            const maximo = ordenadas[0]?.valor ?? 0;
            const itens = ordenadas.map((categoria, indice) => {
                const lider = indice === 0 && categoria.valor > 0;
                const item = this.criar('div', lider ? 'ranking-item lider' : 'ranking-item');
                const trilha = this.criar('div', 'ranking-trilha');
                const barra = this.criar('span', 'ranking-barra');
                barra.style.width = `${maximo > 0 ? (categoria.valor / maximo) * 100 : 0}%`;
                trilha.append(barra);
                const participacao = this.participacao(categoria.valor, total);
                const valor = `${this.moedaCurta.format(categoria.valor)} · ${this.percentual(participacao)}`;
                item.append(this.criar('span', undefined, `${indice + 1}. ${categoria.rotulo}`), trilha, this.criar('strong', undefined, valor));
                return item;
            });
            this.el('ranking').replaceChildren(...itens);
        };
        this.desenharBarras = (categorias, barras, total) => {
            const largura = 800;
            const altura = 380;
            const margemEsquerda = 90;
            const margemDireita = 20;
            const margemTopo = 30;
            const margemBase = 50;
            const areaLargura = largura - margemEsquerda - margemDireita;
            const areaAltura = altura - margemTopo - margemBase;
            const topo = this.escala(total);
            const passo = areaLargura / barras.length;
            const larguraBarra = passo * 0.5;
            const grafico = this.svg('svg', { viewBox: `0 0 ${largura} ${altura}`, role: 'img' });
            for (let i = 0; i <= 4; i++) {
                const y = margemTopo + areaAltura - (areaAltura * i) / 4;
                grafico.appendChild(this.svg('line', { x1: margemEsquerda, x2: largura - margemDireita, y1: y, y2: y, class: 'grade' }));
                grafico.appendChild(this.svg('text', { x: margemEsquerda - 10, y: y + 4, class: 'eixo', 'text-anchor': 'end' }, this.moedaCurta.format((topo * i) / 4)));
            }
            barras.forEach((barra, indice) => {
                const alturaBarra = (areaAltura * barra.valor) / topo;
                const x = margemEsquerda + passo * indice + (passo - larguraBarra) / 2;
                const y = margemTopo + areaAltura - alturaBarra;
                const centro = x + larguraBarra / 2;
                grafico.appendChild(this.svg('rect', {
                    x,
                    y,
                    width: larguraBarra,
                    height: alturaBarra,
                    rx: 4,
                    class: barra.destaque ? 'barra destaque' : 'barra'
                }));
                grafico.appendChild(this.svg('text', { x: centro, y: y - 8, class: 'valor', 'text-anchor': 'middle' }, this.moeda.format(barra.valor)));
                grafico.appendChild(this.svg('text', { x: centro, y: margemTopo + areaAltura + 24, class: 'rotulo', 'text-anchor': 'middle' }, barra.rotulo));
            });
            this.el('grafico').replaceChildren(grafico);
        };
        this.desenharBlocos = (categorias, total) => {
            const largura = 800;
            const altura = 380;
            const colunas = 20;
            const linhas = 5;
            const tamanho = 26;
            const espaco = 6;
            const passo = tamanho + espaco;
            const larguraGrade = colunas * passo - espaco;
            const alturaGrade = linhas * passo - espaco;
            const origemX = (largura - larguraGrade) / 2;
            const origemY = 42;
            const quantidades = this.distribuirBlocos(categorias, total, colunas * linhas);
            const grafico = this.svg('svg', {
                viewBox: `0 0 ${largura} ${altura}`,
                role: 'img',
                'aria-label': 'Gráfico de blocos com a participação de cada categoria'
            });
            let posicao = 0;
            categorias.forEach((categoria, indiceCategoria) => {
                for (let i = 0; i < quantidades[indiceCategoria]; i++) {
                    const atual = posicao++;
                    grafico.appendChild(this.svg('rect', {
                        x: origemX + (atual % colunas) * passo,
                        y: origemY + Math.floor(atual / colunas) * passo,
                        width: tamanho,
                        height: tamanho,
                        rx: 4,
                        class: `bloco ${this.classesCategoria[indiceCategoria]}`
                    }));
                }
            });
            for (; posicao < colunas * linhas; posicao++) {
                grafico.appendChild(this.svg('rect', {
                    x: origemX + (posicao % colunas) * passo,
                    y: origemY + Math.floor(posicao / colunas) * passo,
                    width: tamanho,
                    height: tamanho,
                    rx: 4,
                    class: 'bloco vazio'
                }));
            }
            const legendaY = origemY + alturaGrade + 38;
            categorias.forEach((categoria, indice) => {
                const x = origemX + (indice % 2) * (larguraGrade / 2);
                const y = legendaY + Math.floor(indice / 2) * 34;
                const texto = `${categoria.rotulo} · ${this.moedaCurta.format(categoria.valor)} · ${this.percentual(this.participacao(categoria.valor, total))}`;
                grafico.appendChild(this.svg('rect', { x, y: y - 13, width: 14, height: 14, rx: 3, class: `bloco ${this.classesCategoria[indice]}` }));
                grafico.appendChild(this.svg('text', { x: x + 22, y, class: 'legenda-texto' }, texto));
            });
            this.el('grafico').replaceChildren(grafico);
        };
        this.renderGrafico = () => {
            if (this.categoriasAtuais.length === 0)
                return;
            const tipo = this.el('tipo-grafico').value;
            if (tipo === 'blocos') {
                this.desenharBlocos(this.categoriasAtuais, this.totalAtual);
                return;
            }
            this.desenharBarras(this.categoriasAtuais, [...this.categoriasAtuais, { rotulo: 'Total', valor: this.totalAtual, destaque: true }], this.totalAtual);
        };
        this.desenhar = (receitas) => {
            const planos = Number(receitas.planos) || 0;
            const aulas = Number(receitas.aulas) || 0;
            const aluguel = Number(receitas.aluguel) || 0;
            const outros = Number(receitas.outros) || 0;
            const total = planos + aulas + aluguel + outros;
            const categorias = [
                { rotulo: 'Planos', valor: planos, destaque: false },
                { rotulo: 'Aulas', valor: aulas, destaque: false },
                { rotulo: 'Aluguel', valor: aluguel, destaque: false },
                { rotulo: 'Outros', valor: outros, destaque: false }
            ];
            this.categoriasAtuais = categorias;
            this.totalAtual = total;
            this.renderResumo(categorias, total);
            this.renderRanking(categorias, total);
            this.renderGrafico();
        };
        this.atualizar = async () => {
            const periodo = this.periodoAtual();
            const status = this.el('status');
            if (!periodo) {
                status.textContent = 'Selecione um período válido.';
                return;
            }
            this.nomeArquivo = periodo.tipo === 'anual' ? `relatorio-${periodo.ano}` : `relatorio-${periodo.ano}-${this.dois(periodo.mes)}`;
            this.el('titulo').textContent = this.titulo(periodo);
            try {
                const receitas = await electron_1.ipcRenderer.invoke('relatorios:receitas', periodo);
                this.receitasAtuais = receitas;
                this.periodoAtualDados = periodo;
                this.desenhar(receitas);
                status.textContent = '';
            }
            catch {
                this.receitasAtuais = null;
                this.periodoAtualDados = null;
                this.categoriasAtuais = [];
                this.totalAtual = 0;
                this.el('grafico').replaceChildren();
                this.el('kpis').replaceChildren();
                this.el('ranking').replaceChildren();
                status.textContent = 'Não foi possível carregar os dados.';
            }
        };
        this.alternarPeriodo = async () => {
            const mensal = this.el('periodo').value === 'mensal';
            this.el('campo-mes').hidden = !mensal;
            this.el('campo-ano').hidden = mensal;
            await this.atualizar();
        };
        this.alternarRanking = () => {
            this.rankingVisivel = !this.rankingVisivel;
            this.el('painel-ranking').hidden = !this.rankingVisivel;
            this.el('area-visualizacao').classList.toggle('sem-ranking', !this.rankingVisivel);
            const botao = this.el('alternar-ranking');
            botao.textContent = this.rankingVisivel ? 'Ocultar ranking' : 'Mostrar ranking';
            botao.setAttribute('aria-pressed', String(this.rankingVisivel));
        };
        this.exportar = async () => {
            const status = this.el('status');
            const formato = this.el('formato-exportacao').value;
            if (!this.receitasAtuais || !this.periodoAtualDados) {
                status.textContent = 'Carregue os dados do período antes de exportar.';
                return;
            }
            try {
                const caminho = await electron_1.ipcRenderer.invoke('relatorios:exportar', {
                    nome: this.nomeArquivo,
                    formato,
                    periodo: this.periodoAtualDados,
                    receitas: this.receitasAtuais
                });
                status.textContent = caminho
                    ? `${this.rotuloFormato[formato]} salvo em ${caminho}`
                    : 'Exportação cancelada.';
            }
            catch {
                status.textContent = 'Não foi possível exportar o relatório.';
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
        this.iniciar = async () => {
            const hoje = new Date();
            this.el('mes').value = `${hoje.getFullYear()}-${this.dois(hoje.getMonth() + 1)}`;
            this.el('ano').value = String(hoje.getFullYear());
            this.el('periodo').addEventListener('change', this.alternarPeriodo);
            this.el('mes').addEventListener('change', this.atualizar);
            this.el('ano').addEventListener('change', this.atualizar);
            this.el('tipo-grafico').addEventListener('change', this.renderGrafico);
            this.el('alternar-ranking').addEventListener('click', this.alternarRanking);
            this.el('exportar').addEventListener('click', this.exportar);
            this.el('voltar').addEventListener('click', this.voltar);
            await this.alternarPeriodo();
        };
    }
}
window.addEventListener('DOMContentLoaded', () => new RelatoriosView().iniciar());
