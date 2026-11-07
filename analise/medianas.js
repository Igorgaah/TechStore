// Calcula, a partir dos arquivos gerados pelo scripts/medir.sh, a mediana das execuções de cada rótulo
// e a comparação de cada mudança com a anterior e com a linha de base. Nenhum número é digitado à mão:
// tudo sai de resultados/<pasta>/{contexto.txt, resumo-k6.json, recursos.csv, contrato.txt}.
//
//   node analise/medianas.js            -> escreve analise/medianas.md e analise/medianas.json
//
// Observações:
// - O máximo de CPU/memória é recalculado do recursos.csv: o recursos.txt do medir.sh compara os valores
//   como texto no awk (ex.: "98.7" > "104.5"), então o cpu_max dele pode sair menor que a média.
// - "CPU por requisição" = CPU média do container (em CPUs) x duração da carga / requisições da carga.
//   É uma medida de eficiência: quanto de CPU cada requisição custou, independente do limite.
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const PASTA_RESULTADOS = path.join(RAIZ, 'resultados');
const ROTAS = ['cliente', 'cliente-por-email', 'pedidos-do-cliente', 'pedidos-por-status', 'busca-produtos', 'vendas-por-dia', 'top-produtos'];

function mediana(valores) {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

function lerContexto(texto) {
  const ctx = { limites: {} };
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^([a-z ]+): (.*)$/);
    if (m && !linha.startsWith('  ')) ctx[m[1].trim()] = m[2].trim();
    const l = linha.match(/^\s+([\w-]+): cpus=(\d+).*memoria=(\d+)/);
    if (l) ctx.limites[l[1]] = { cpus: Number(l[2]) / 1e9, memoria_mib: Number(l[3]) / 1048576 };
  }
  return ctx;
}

function mib(valor) {
  const m = String(valor).trim().match(/^([\d.]+)\s*([KMG]?i?B)$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  return { B: n / 1048576, KiB: n / 1024, MiB: n, GiB: n * 1024 }[m[2]] ?? NaN;
}

function lerRecursos(texto) {
  const porServico = {};
  for (const linha of texto.split(/\r?\n/).slice(1)) {
    if (!linha.trim()) continue;
    const [, container, cpu, memoria] = linha.split(',');
    const servico = container.replace(/^desafio-performance-/, '').replace(/-\d+$/, '');
    const s = (porServico[servico] ||= { cpu: [], mem: [] });
    s.cpu.push(Number(cpu.replace('%', '')));
    s.mem.push(mib(memoria.split(' / ')[0]));
  }
  const saida = {};
  for (const [servico, s] of Object.entries(porServico)) {
    const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    saida[servico] = { amostras: s.cpu.length, cpu_media: media(s.cpu), cpu_max: Math.max(...s.cpu), mem_media: media(s.mem), mem_max: Math.max(...s.mem) };
  }
  return saida;
}

function segundos(duracao) {
  const m = String(duracao).match(/^(\d+)(s|m)$/);
  return m ? Number(m[1]) * (m[2] === 'm' ? 60 : 1) : NaN;
}

function lerExecucao(pasta) {
  const ler = (arquivo) => fs.readFileSync(path.join(PASTA_RESULTADOS, pasta, arquivo), 'utf8');
  const ctx = lerContexto(ler('contexto.txt'));
  const k6 = JSON.parse(ler('resumo-k6.json'));
  const recursos = lerRecursos(ler('recursos.csv'));
  const contrato = ler('contrato.txt').trim().split(/\r?\n/).pop();
  const m = k6.metrics;
  const porRota = {};
  for (const rota of ROTAS) {
    const d = m[`http_req_duration{rota:${rota}}`];
    if (d) porRota[rota] = { req: d.values.count, p50: d.values.med, p95: d.values['p(95)'] };
  }
  const requisicoes = m.http_reqs.values.count;
  const dur = segundos(ctx.duracao);
  for (const r of Object.values(recursos)) r.cpu_ms_por_req = ((r.cpu_media / 100) * dur * 1000) / requisicoes;
  return {
    pasta,
    rotulo: ctx.rotulo,
    commit: ctx.commit,
    sujo: ctx['arquivos alterados sem commit'],
    parametros: `${ctx.vus} VUs, ${ctx.duracao}, semente ${ctx.semente}`,
    limites: ctx.limites,
    requisicoes,
    rps: m.http_reqs.values.rate,
    p50: m.http_req_duration.values.med,
    p95: m.http_req_duration.values['p(95)'],
    p99: m.http_req_duration.values['p(99)'],
    erros: m.http_req_failed.values.rate,
    recursos,
    porRota,
    contratoMantido: contrato.startsWith('Contrato mantido'),
  };
}

function resumir(execucoes) {
  const servicos = [...new Set(execucoes.flatMap((e) => Object.keys(e.recursos)))].sort();
  const r = {
    rotulo: execucoes[0].rotulo,
    n: execucoes.length,
    pastas: execucoes.map((e) => e.pasta),
    commits: [...new Set(execucoes.map((e) => e.commit))],
    sujos: [...new Set(execucoes.map((e) => e.sujo))],
    parametros: [...new Set(execucoes.map((e) => e.parametros))],
    limites: execucoes[0].limites,
    contratoMantido: execucoes.every((e) => e.contratoMantido),
    rps: mediana(execucoes.map((e) => e.rps)),
    rps_min: Math.min(...execucoes.map((e) => e.rps)),
    rps_max: Math.max(...execucoes.map((e) => e.rps)),
    p95: mediana(execucoes.map((e) => e.p95)),
    p95_min: Math.min(...execucoes.map((e) => e.p95)),
    p95_max: Math.max(...execucoes.map((e) => e.p95)),
    p50: mediana(execucoes.map((e) => e.p50)),
    p99: mediana(execucoes.map((e) => e.p99)),
    erros: mediana(execucoes.map((e) => e.erros)),
    recursos: {},
    porRota: {},
  };
  for (const s of servicos) {
    const campo = (c) => mediana(execucoes.map((e) => e.recursos[s]?.[c]));
    r.recursos[s] = { cpu_media: campo('cpu_media'), cpu_max: campo('cpu_max'), mem_media: campo('mem_media'), mem_max: campo('mem_max'), cpu_ms_por_req: campo('cpu_ms_por_req') };
  }
  for (const rota of ROTAS) {
    r.porRota[rota] = { p50: mediana(execucoes.map((e) => e.porRota[rota]?.p50)), p95: mediana(execucoes.map((e) => e.porRota[rota]?.p95)), req: mediana(execucoes.map((e) => e.porRota[rota]?.req)) };
  }
  r.limite_cpu_total = Object.values(r.limites).reduce((a, l) => a + l.cpus, 0);
  r.limite_mem_total = Object.values(r.limites).reduce((a, l) => a + l.memoria_mib, 0);
  return r;
}

const fmt = {
  ms: (x) => (Number.isFinite(x) ? (x >= 100 ? x.toFixed(0) : x.toFixed(1)) : '-'),
  n: (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-'),
  pct: (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(2)}%` : '-'),
  vezes: (antes, depois) => (Number.isFinite(antes) && Number.isFinite(depois) && depois > 0 ? `${(antes / depois).toFixed(1)}x` : '-'),
};

const pastas = fs.readdirSync(PASTA_RESULTADOS).filter((p) => fs.existsSync(path.join(PASTA_RESULTADOS, p, 'resumo-k6.json'))).sort();
const porRotulo = new Map();
for (const pasta of pastas) {
  const e = lerExecucao(pasta);
  if (!porRotulo.has(e.rotulo)) porRotulo.set(e.rotulo, []);
  porRotulo.get(e.rotulo).push(e);
}
const rotulos = [...porRotulo.keys()].sort();
const resumos = rotulos.map((r) => resumir(porRotulo.get(r)));
const base = resumos[0];

const md = [];
md.push('# Medianas das medições');
md.push('');
md.push('Gerado por `node analise/medianas.js` a partir de `resultados/` (não editar à mão). Cada linha é a **mediana** das execuções do rótulo; entre colchetes, o menor e o maior valor das execuções.');
md.push('"Antes" de cada mudança é o rótulo anterior na ordem numérica; a última coluna compara também com a linha de base.');
md.push('');
md.push('## Geral');
md.push('');
md.push('| Rótulo | Exec. | Commit | req/s | p95 (ms) | p50 (ms) | Erros | vs anterior (req/s, p95) | vs linha de base (req/s, p95) | Contrato |');
md.push('|---|---|---|---|---|---|---|---|---|---|');
resumos.forEach((r, i) => {
  const ant = resumos[i - 1];
  const vsAnt = ant ? `${fmt.vezes(r.rps, ant.rps)} req/s, ${fmt.vezes(ant.p95, r.p95)} menor` : '-';
  const vsBase = i ? `${fmt.vezes(r.rps, base.rps)} req/s, ${fmt.vezes(base.p95, r.p95)} menor` : '-';
  md.push(`| ${r.rotulo} | ${r.n} | ${r.commits.join(', ')} | ${fmt.n(r.rps, 2)} [${fmt.n(r.rps_min, 2)}–${fmt.n(r.rps_max, 2)}] | ${fmt.ms(r.p95)} [${fmt.ms(r.p95_min)}–${fmt.ms(r.p95_max)}] | ${fmt.ms(r.p50)} | ${fmt.pct(r.erros)} | ${vsAnt} | ${vsBase} | ${r.contratoMantido ? 'mantido' : '**QUEBRADO**'} |`);
});
md.push('');
md.push('"2.0x req/s" = o dobro de requisições por segundo; "3.0x menor" = p95 três vezes menor.');
md.push('');
md.push('## Recursos (CPU e memória durante a carga) e custo');
md.push('');
md.push('CPU em % de 1 CPU (100% = 1 CPU). "CPU/req" = milissegundos de CPU gastos por requisição. Limites = soma do que o `docker-compose.yml` reserva para os containers (o custo de rodar).');
md.push('');
const servicos = [...new Set(resumos.flatMap((r) => Object.keys(r.recursos)))].sort();
md.push(`| Rótulo | ${servicos.map((s) => `${s}: CPU média / máx`).join(' | ')} | ${servicos.map((s) => `${s}: memória média / máx (MiB)`).join(' | ')} | ${servicos.map((s) => `${s}: CPU/req (ms)`).join(' | ')} | Limites (CPU / memória) |`);
md.push(`|---|${servicos.map(() => '---').join('|')}|${servicos.map(() => '---').join('|')}|${servicos.map(() => '---').join('|')}|---|`);
for (const r of resumos) {
  const cpu = servicos.map((s) => `${fmt.n(r.recursos[s]?.cpu_media)}% / ${fmt.n(r.recursos[s]?.cpu_max)}%`);
  const mem = servicos.map((s) => `${fmt.n(r.recursos[s]?.mem_media)} / ${fmt.n(r.recursos[s]?.mem_max)}`);
  const cpr = servicos.map((s) => fmt.n(r.recursos[s]?.cpu_ms_por_req, 2));
  const lim = Object.entries(r.limites).map(([s, l]) => `${s} ${l.cpus} CPU/${l.memoria_mib} MiB`).join('; ');
  md.push(`| ${r.rotulo} | ${cpu.join(' | ')} | ${mem.join(' | ')} | ${cpr.join(' | ')} | ${fmt.n(r.limite_cpu_total, 2)} CPU / ${fmt.n(r.limite_mem_total, 0)} MiB (${lim}) |`);
}
md.push('');
md.push('## p95 por rota (ms, mediana das execuções)');
md.push('');
md.push(`| Rótulo | ${ROTAS.join(' | ')} |`);
md.push(`|---|${ROTAS.map(() => '---').join('|')}|`);
for (const r of resumos) md.push(`| ${r.rotulo} | ${ROTAS.map((rota) => fmt.ms(r.porRota[rota].p95)).join(' | ')} |`);
md.push('');
md.push('Nas medições em que uma rota tem poucas requisições (veja a tabela abaixo), o p95 dela oscila muito: compare pelo resultado geral.');
md.push('');
md.push('## Requisições por rota (mediana das execuções)');
md.push('');
md.push(`| Rótulo | ${ROTAS.join(' | ')} |`);
md.push(`|---|${ROTAS.map(() => '---').join('|')}|`);
for (const r of resumos) md.push(`| ${r.rotulo} | ${ROTAS.map((rota) => fmt.n(r.porRota[rota].req, 0)).join(' | ')} |`);
md.push('');
md.push('## Pastas de cada rótulo');
md.push('');
for (const r of resumos) {
  md.push(`- **${r.rotulo}** (${r.parametros.join('; ')}; arquivos alterados sem commit: ${r.sujos.join(', ')}): ${r.pastas.map((p) => `[${p}](../resultados/${p}/resumo.txt)`).join(', ')}`);
}
md.push('');

fs.writeFileSync(path.join(__dirname, 'medianas.md'), md.join('\n'));
fs.writeFileSync(path.join(__dirname, 'medianas.json'), `${JSON.stringify(resumos, null, 2)}\n`);
console.log(md.slice(0, 8 + resumos.length).join('\n'));
