// Calcula, a partir dos arquivos gerados pelo scripts/medir.sh, a mediana das execuções de cada rótulo
// e a comparação de cada mudança com a anterior e com a linha de base. Nenhum número é digitado à mão:
// tudo sai de resultados/<pasta>/{contexto.txt, resumo-k6.json, recursos.csv, contrato.txt}.
//
//   node analise/medianas.js            -> escreve analise/medianas.md e analise/medianas.json
//
// Observações:
// - O máximo de CPU/memória é recalculado do recursos.csv: o recursos.txt do medir.sh compara os valores
//   como texto no awk (ex.: "98.7" > "104.5"), então o cpu_max dele pode sair menor que a média.
// - "CPU por requisição" = CPU média do container (em CPUs) x duração real da carga (state.testRunDurationMs
//   do k6, a mesma base do req/s; passa de 60 s quando há requisições lentas no fim) / requisições da carga.
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
  const dur = k6.state && k6.state.testRunDurationMs ? k6.state.testRunDurationMs / 1000 : segundos(ctx.duracao);
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
    duracao_s: dur,
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
    erros_max: Math.max(...execucoes.map((e) => e.erros)),
    execucoes_com_erro: execucoes.filter((e) => e.erros > 0).length,
    duracao_s: mediana(execucoes.map((e) => e.duracao_s)),
    amostras: mediana(execucoes.map((e) => Math.max(...Object.values(e.recursos).map((x) => x.amostras)))),
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
md.push('| Rótulo | Exec. | Commit | req/s | p95 (ms) | p50 (ms) | Erros (mediana; máx) | vs anterior (req/s, p95) | Ganho claro vs anterior? (req/s; p95) | vs linha de base (req/s, p95) | Contrato |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|');
resumos.forEach((r, i) => {
  const ant = resumos[i - 1];
  const vsAnt = ant ? `${fmt.vezes(r.rps, ant.rps)} req/s, ${fmt.vezes(ant.p95, r.p95)} menor` : '-';
  // Ganho claro = faixas sem sobreposição: a pior execução depois é melhor que a melhor execução antes.
  r.ganho_claro_rps = ant ? r.rps_min > ant.rps_max : null;
  r.ganho_claro_p95 = ant ? r.p95_max < ant.p95_min : null;
  r.piora_clara_rps = ant ? r.rps_max < ant.rps_min : null;
  const marca = (g, p) => (g ? 'sim' : p ? 'piora' : 'não');
  const claro = ant ? `${marca(r.ganho_claro_rps, r.piora_clara_rps)}; ${marca(r.ganho_claro_p95, r.p95_min > ant.p95_max)}` : '-';
  const vsBase = i ? `${fmt.vezes(r.rps, base.rps)} req/s, ${fmt.vezes(base.p95, r.p95)} menor` : '-';
  md.push(`| ${r.rotulo} | ${r.n} | ${r.commits.join(', ')} | ${fmt.n(r.rps, 2)} [${fmt.n(r.rps_min, 2)}–${fmt.n(r.rps_max, 2)}] | ${fmt.ms(r.p95)} [${fmt.ms(r.p95_min)}–${fmt.ms(r.p95_max)}] | ${fmt.ms(r.p50)} | ${fmt.pct(r.erros)}; ${fmt.pct(r.erros_max)}${r.execucoes_com_erro ? ` (${r.execucoes_com_erro} exec.)` : ''} | ${vsAnt} | ${claro} | ${vsBase} | ${r.contratoMantido ? 'mantido' : '**QUEBRADO**'} |`);
});
md.push('');
md.push('"2.0x req/s" = o dobro de requisições por segundo; "3.0x menor" = p95 três vezes menor. Erros = requisições que falharam (no k6, timeout de 60 s); quando uma execução tem erro, o p95/p99 dela fica truncado no timeout.');
md.push('"Ganho claro" = as faixas das execuções não se sobrepõem: a pior execução depois da mudança é melhor que a melhor execução antes dela. Com 3 execuções e variação acima de 30% entre elas, uma mediana melhor sem isso pode ser ruído.');
md.push('');
md.push('## Recursos (CPU e memória durante a carga) e custo');
md.push('');
md.push('CPU em % de 1 CPU (100% = 1 CPU). "CPU/req" = milissegundos de CPU gastos por requisição. Limites = soma dos limites de CPU e memória do `docker-compose.yml` (teto que o container pode usar). "Amostras" = leituras do `docker stats` durante a carga (mediana): cada leitura leva ~1 s com o host livre, então menos amostras indicam host mais disputado. "Duração" = duração real da carga (k6), base do CPU/req.');
md.push('');
const servicos = [...new Set(resumos.flatMap((r) => Object.keys(r.recursos)))].sort();
md.push(`| Rótulo | Amostras | Duração (s) | ${servicos.map((s) => `${s}: CPU média / máx`).join(' | ')} | ${servicos.map((s) => `${s}: memória média / máx (MiB)`).join(' | ')} | ${servicos.map((s) => `${s}: CPU/req (ms)`).join(' | ')} | Limites (CPU / memória) |`);
md.push(`|---|---|---|${servicos.map(() => '---').join('|')}|${servicos.map(() => '---').join('|')}|${servicos.map(() => '---').join('|')}|---|`);
for (const r of resumos) {
  const cpu = servicos.map((s) => `${fmt.n(r.recursos[s]?.cpu_media)}% / ${fmt.n(r.recursos[s]?.cpu_max)}%`);
  const mem = servicos.map((s) => `${fmt.n(r.recursos[s]?.mem_media)} / ${fmt.n(r.recursos[s]?.mem_max)}`);
  const cpr = servicos.map((s) => fmt.n(r.recursos[s]?.cpu_ms_por_req, 2));
  const lim = Object.entries(r.limites).map(([s, l]) => `${s} ${l.cpus} CPU/${l.memoria_mib} MiB`).join('; ');
  md.push(`| ${r.rotulo} | ${fmt.n(r.amostras, 0)} | ${fmt.n(r.duracao_s, 1)} | ${cpu.join(' | ')} | ${mem.join(' | ')} | ${cpr.join(' | ')} | ${fmt.n(r.limite_cpu_total, 2)} CPU / ${fmt.n(r.limite_mem_total, 0)} MiB (${lim}) |`);
}
md.push('');
// Custo: proxy linear com as tarifas por segundo publicadas na página de preços do AWS Fargate
// (Linux/x86, US East - N. Virginia, consultada em 2026-11-07). Não é uma cotação: o Fargate só aceita
// combinações fixas de CPU e memória por tarefa, e o banco ali seria outro serviço (ex.: RDS).
const PRECO = { vcpu_s: 0.000011244, gb_s: 0.000001235 };
md.push('## Custo estimado (proxy)');
md.push('');
md.push('Tarifas por segundo do [AWS Fargate](https://aws.amazon.com/fargate/pricing/) (Linux/x86, US East, consultadas em 2026-11-07): US$ 0,000011244 por vCPU e US$ 0,000001235 por GB. Custo = os **limites** de CPU e memória do compose cobrados como se fossem o tamanho contratado (modelo linear, um *proxy*: o Fargate só aceita combinações fixas de CPU e memória, e o banco ali seria outro serviço), não o consumo. Com os mesmos limites, o custo por hora não muda de 00 a 14; só a 15 o reduz. "Por milhão de requisições" usa o req/s mediano da carga, em que o sistema está sempre no limite: é uma medida de eficiência, não uma fatura.');
md.push('');
md.push('| Rótulo | Limite de CPU (vCPU) | Limite de memória (GB) | US$/hora | US$ por milhão de requisições | vs linha de base |');
md.push('|---|---|---|---|---|---|');
const custoPorSegundo = (r) => r.limite_cpu_total * PRECO.vcpu_s + (r.limite_mem_total / 1024) * PRECO.gb_s;
const custoMilhao = (r) => (custoPorSegundo(r) / r.rps) * 1e6;
for (const r of resumos) {
  md.push(`| ${r.rotulo} | ${fmt.n(r.limite_cpu_total, 2)} | ${fmt.n(r.limite_mem_total / 1024, 2)} | ${(custoPorSegundo(r) * 3600).toFixed(4)} | ${custoMilhao(r).toFixed(4)} | ${fmt.vezes(custoMilhao(base), custoMilhao(r))} menor |`);
  r.custo_hora_usd = custoPorSegundo(r) * 3600;
  r.custo_milhao_req_usd = custoMilhao(r);
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
md.push('## p50 (mediana) por rota (ms, mediana das execuções)');
md.push('');
md.push(`| Rótulo | ${ROTAS.join(' | ')} |`);
md.push(`|---|${ROTAS.map(() => '---').join('|')}|`);
for (const r of resumos) md.push(`| ${r.rotulo} | ${ROTAS.map((rota) => fmt.ms(r.porRota[rota].p50)).join(' | ')} |`);
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
