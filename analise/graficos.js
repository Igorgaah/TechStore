// Gera os gráficos do artigo (SVG) a partir de analise/medianas.json, que sai de resultados/.
//   node analise/medianas.js && node analise/graficos.js
// Barras horizontais em escala logarítmica, uma por rótulo, com o valor da mediana na ponta.
// Azul = ganho claro sobre a mudança anterior (faixas das execuções sem sobreposição); cinza claro = não;
// cinza escuro = linha de base.
// O SVG traz as cores do modo claro e do escuro (prefers-color-scheme).
const fs = require('node:fs');
const path = require('node:path');

const resumos = JSON.parse(fs.readFileSync(path.join(__dirname, 'medianas.json'), 'utf8'));
const SAIDA = path.join(__dirname, '..', 'artigo', 'img');
fs.mkdirSync(SAIDA, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const numero = (x) => (x >= 100 ? Math.round(x).toLocaleString('pt-BR') : x.toFixed(1).replace('.', ','));
const tick = (x) => Math.round(x).toLocaleString('pt-BR');

function grafico({ arquivo, titulo, subtitulo, valor, ganho, ticks, unidade, descricao }) {
  const largura = 760;
  const esquerda = 220;
  const direita = 70;
  const topo = 78;
  const linha = 26;
  const altura = topo + resumos.length * linha + 56;
  const [min, max] = [ticks[0], ticks[ticks.length - 1]];
  const x = (v) => esquerda + ((Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * (largura - esquerda - direita);

  const partes = [];
  partes.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-labelledby="t d">`);
  partes.push(`<title id="t">${esc(titulo)}</title><desc id="d">${esc(descricao)}</desc>`);
  partes.push(`<style>
    .fundo { fill: #fcfcfb } .t1 { fill: #0b0b0b } .t2 { fill: #52514e } .t3 { fill: #898781 }
    .grade { stroke: #e4e3df } .ganho { fill: #2a78d6 } .neutro { fill: #b8b6af } .base { fill: #6b6a65 }
    @media (prefers-color-scheme: dark) {
      .fundo { fill: #1a1a19 } .t1 { fill: #f0efec } .t2 { fill: #c3c2b7 } .t3 { fill: #898781 }
      .grade { stroke: #383835 } .ganho { fill: #3987e5 } .neutro { fill: #5f5e59 } .base { fill: #9a988f }
    }
    text { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif }
  </style>`);
  partes.push(`<rect class="fundo" x="0" y="0" width="${largura}" height="${altura}" rx="8"/>`);
  partes.push(`<text class="t1" x="20" y="30" font-size="17" font-weight="600">${esc(titulo)}</text>`);
  partes.push(`<text class="t2" x="20" y="52" font-size="12.5">${esc(subtitulo)}</text>`);

  for (const t of ticks) {
    partes.push(`<line class="grade" x1="${x(t)}" x2="${x(t)}" y1="${topo - 6}" y2="${topo + resumos.length * linha}" stroke-width="1"/>`);
    partes.push(`<text class="t3" x="${x(t)}" y="${topo + resumos.length * linha + 18}" font-size="11.5" text-anchor="middle">${tick(t)}${unidade}</text>`);
  }

  resumos.forEach((r, i) => {
    const y = topo + i * linha;
    const v = valor(r);
    const classe = i === 0 ? 'base' : ganho(r) ? 'ganho' : 'neutro';
    const fim = Math.max(x(v), esquerda + 2);
    partes.push(`<text class="t2" x="${esquerda - 10}" y="${y + 17}" font-size="12" text-anchor="end">${esc(r.rotulo)}</text>`);
    // barra com a ponta de dados arredondada (4 px) e a base reta no eixo
    partes.push(`<path class="${classe}" d="M${esquerda},${y + 5} H${fim - 4} a4,4 0 0 1 4,4 V${y + 17} a4,4 0 0 1 -4,4 H${esquerda} Z"/>`);
    partes.push(`<text class="t1" x="${fim + 6}" y="${y + 17}" font-size="12">${numero(v)}</text>`);
  });

  const yl = altura - 16;
  const legenda = [['base', 'linha de base'], ['ganho', 'ganho claro sobre a anterior'], ['neutro', 'sem ganho claro (faixas se sobrepõem)']];
  let xl = 20;
  for (const [classe, texto] of legenda) {
    partes.push(`<rect class="${classe}" x="${xl}" y="${yl - 10}" width="12" height="12" rx="3"/>`);
    partes.push(`<text class="t2" x="${xl + 18}" y="${yl}" font-size="12">${esc(texto)}</text>`);
    xl += 18 + texto.length * 6.6 + 22;
  }
  partes.push('</svg>');
  fs.writeFileSync(path.join(SAIDA, arquivo), `${partes.join('\n')}\n`);
  console.log(`artigo/img/${arquivo}`);
}

grafico({
  arquivo: 'req-por-segundo.svg',
  titulo: 'Requisições por segundo a cada mudança',
  subtitulo: 'Mediana de 3 execuções do scripts/medir.sh (20 VUs, 60 s). Escala logarítmica: maior é melhor.',
  valor: (r) => r.rps,
  ganho: (r) => r.ganho_claro_rps === true,
  ticks: [1, 10, 100, 1000],
  unidade: '',
  descricao: resumos.map((r) => `${r.rotulo}: ${r.rps.toFixed(2)} req/s`).join('; '),
});

grafico({
  arquivo: 'p95.svg',
  titulo: 'Tempo de resposta p95 a cada mudança',
  subtitulo: 'Mediana de 3 execuções, todas as rotas juntas. Escala logarítmica: menor é melhor.',
  valor: (r) => r.p95,
  ganho: (r) => r.ganho_claro_p95 === true,
  ticks: [100, 1000, 10000, 100000],
  unidade: ' ms',
  descricao: resumos.map((r) => `${r.rotulo}: p95 ${Math.round(r.p95)} ms`).join('; '),
});
