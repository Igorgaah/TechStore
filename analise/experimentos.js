// Preenche as tabelas de experimentos.md e da seção 6 do artigo a partir de analise/medianas.json
// (que sai de resultados/). Os textos (fonte, hipótese, conclusão) estão abaixo; todo número de antes e
// depois e todo link de pasta vem dos resultados.
//   node analise/medianas.js && node analise/experimentos.js
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const resumos = JSON.parse(fs.readFileSync(path.join(__dirname, 'medianas.json'), 'utf8'));
const R = Object.fromEntries(resumos.map((r) => [r.rotulo, r]));

const ms = (x) => (x >= 100 ? Math.round(x).toLocaleString('pt-BR') : x.toFixed(1).replace('.', ','));
const n2 = (x) => x.toFixed(2).replace('.', ',');
const n1 = (x) => x.toFixed(1).replace('.', ',');
const vezes = (a, b) => `${(a / b).toFixed(1).replace('.', ',')}×`;
const rota = (r, nome, campo = 'p95') => r.porRota[nome][campo];
const pastas = (r, prefixo) => r.pastas.map((p, i) => `[${i + 1}](${prefixo}resultados/${p}/resumo.txt)`).join(' ');
const claro = (r) => (r.ganho_claro_rps && r.ganho_claro_p95 ? 'ganho claro em req/s e p95'
  : r.ganho_claro_rps ? 'ganho claro em req/s' : r.ganho_claro_p95 ? 'ganho claro em p95' : 'sem ganho claro');

const FONTES = {
  'pg-fk': '[PostgreSQL 16, §5.4.5](https://www.postgresql.org/docs/16/ddl-constraints.html)',
  yang: '[Yang et al., ICSE 2018](https://par.nsf.gov/servlets/purl/10067547)',
  'pg-ordem': '[PostgreSQL 16, §11.3–11.4](https://www.postgresql.org/docs/16/indexes-ordering.html)',
  'pg-ios': '[PostgreSQL 16, §11.9](https://www.postgresql.org/docs/16/indexes-index-only-scans.html)',
  gitlab: '[GitLab, Pagination guidelines](https://docs.gitlab.com/development/database/pagination_guidelines/)',
  'pg-trigger': '[PostgreSQL 16, §43.10](https://www.postgresql.org/docs/16/plpgsql-trigger.html)',
  'pg-matview': '[PostgreSQL 16, §41.3](https://www.postgresql.org/docs/16/rules-materializedviews.html)',
  'pg-expr': '[PostgreSQL 16, §11.7](https://www.postgresql.org/docs/16/indexes-expressional.html)',
  'uil-datas': '[Winand, Use The Index, Luke!: datas](https://use-the-index-luke.com/sql/where-clause/obfuscation/dates)',
  'uil-lower': '[Winand, Use The Index, Luke!: UPPER/LOWER](https://use-the-index-luke.com/sql/where-clause/functions/case-insensitive-search)',
  'nodepg-pool': '[node-postgres, Pooling](https://node-postgres.com/features/pooling)',
  'pg-conexao': '[PostgreSQL 16, §52.2](https://www.postgresql.org/docs/16/connect-estab.html)',
  freund: '[Freund, 2020](https://techcommunity.microsoft.com/blog/adforpostgresql/analyzing-the-limits-of-connection-scalability-in-postgres/1757266)',
  'wiki-count': '[PostgreSQL Wiki, Slow Counting](https://wiki.postgresql.org/wiki/Slow_Counting)',
  citus: '[Nelson, Citus Data, 2016](https://www.citusdata.com/blog/2016/10/12/count-performance/)',
  fastpage: '[Coutermarsh, PlanetScale, 2022](https://planetscale.com/blog/fastpage-faster-offset-pagination-for-rails-apps)',
  'uil-offset': '[Winand, No Offset](https://use-the-index-luke.com/no-offset)',
  chen: '[Chen et al., ICSE 2014](https://petertsehsun.github.io/papers/peter_icse2014.pdf)',
  rails: '[Rails Guides, N + 1](https://guides.rubyonrails.org/active_record_querying.html)',
  'pg-recursos': '[PostgreSQL 16, §20.4](https://www.postgresql.org/docs/16/runtime-config-resource.html)',
  cfs: '[Linux, CFS Bandwidth Control](https://docs.kernel.org/scheduler/sched-bwc.html)',
  trgm: '[PostgreSQL 16, pg_trgm](https://www.postgresql.org/docs/16/pgtrgm.html)',
  azure: '[Microsoft, pg_trgm no Azure](https://techcommunity.microsoft.com/t5/azure-database-for-postgresql/tips-for-tuning-postgres-like-amp-ilike-queries-via-pg-trgm-on/ba-p/4069179)',
  owasp: '[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)',
  lgpd: '[LGPD, art. 6º, III](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)',
  'node-io': '[Node.js 20, process I/O](https://nodejs.org/docs/latest-v20.x/api/process.html)',
  docker: '[Docker, Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)',
  fargate: '[AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)',
};
const f = (...ids) => ids.map((id) => FONTES[id]).join('; ');

// curto = versão para a tabela do artigo
const META = [
  {
    rotulo: '01-indices-fk',
    mudanca: 'Índices nas FKs `itens_pedido(pedido_id)` e `pedidos(cliente_id)`',
    arquivos: '`banco/03-indices-chaves-estrangeiras.sql`',
    fonte: f('pg-fk', 'yang'),
    hipotese: 'As consultas de itens por pedido e de pedidos por cliente varrem a tabela inteira a cada chamada; com índice, viram buscas de poucas linhas.',
    curta: 'Varredura total nas FKs vira busca por índice',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `No banco, a consulta de itens por pedido caiu de 40,5% para 0,5% do tempo (diagnostico/00 → 01, carga-consultas.txt) e o p50 de pedidos-do-cliente de ${ms(rota(a, 'pedidos-do-cliente', 'p50'))} para ${ms(rota(r, 'pedidos-do-cliente', 'p50'))} ms. O req/s geral não saiu da faixa da linha de base: o banco seguiu saturado pelas outras varreduras (status, vendas-por-dia, top-produtos), e a fila só mudou de rota.`,
    curtaConclusao: 'Resolveu a consulta-alvo, mas o banco seguiu saturado pelas outras',
  },
  {
    rotulo: '02-indice-status',
    mudanca: 'Índice `pedidos(status, criado_em DESC, id DESC)`',
    arquivos: '`banco/04-indice-pedidos-status.sql`',
    fonte: f('pg-ordem', 'pg-ios', 'gitlab'),
    hipotese: 'A página ordena até 300 mil pedidos em disco e o count varre a tabela; com o índice na ordem do ORDER BY, a página percorre o índice e o count usa só o índice.',
    curta: 'Índice na ordem do ORDER BY da paginação',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de pedidos-por-status ${ms(rota(a, 'pedidos-por-status'))} → ${ms(rota(r, 'pedidos-por-status'))} ms; o count virou Index Only Scan (diagnostico/02-indice-status/explain.txt). Medida de novo no próprio commit c05803a (a 1ª série tinha 2 arquivos sem commit e foi descartada).`,
    curtaConclusao: 'Ganho na rota e no geral; count passou a usar só o índice',
  },
  {
    rotulo: '03-resumo-top-produtos',
    mudanca: 'Top-produtos lido de `receita_por_produto`, mantida por triggers',
    arquivos: '`banco/05-resumo-top-produtos.sql`, `api/src/rotas.js`',
    fonte: f('pg-trigger', 'pg-matview'),
    hipotese: 'Cada chamada agrega 1,5 milhão de itens; mantendo a soma por produto no momento da escrita (mesma transação), a rota lê ~10 linhas de um índice.',
    curta: 'Resumo por produto mantido por trigger (exato)',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `p95 de top-produtos ${ms(rota(a, 'top-produtos'))} → ${ms(rota(r, 'top-produtos'))} ms, mas o req/s geral ficou na mesma faixa: a rota é só 2% da carga e o "29% do tempo do banco" do pg_stat_statements era em boa parte espera por CPU (tempo de relógio), não trabalho. Triggers conferidos em diagnostico/03-resumo-top-produtos/teste-resumos.txt.`,
    curtaConclusao: 'Rota 20× mais rápida; peso pequeno na carga (2%)',
  },
  {
    rotulo: '04-indice-dia',
    mudanca: 'Índice de expressão `pedidos((criado_em::date))`',
    arquivos: '`banco/06-indice-pedidos-dia.sql`',
    fonte: f('pg-expr', 'uil-datas'),
    hipotese: 'O filtro criado_em::date BETWEEN não usa índice comum e varre os 500 mil pedidos (163 MB) a cada chamada; com índice na mesma expressão, lê só o período.',
    curta: 'Índice na expressão do filtro de data',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `p50 de vendas-por-dia ${ms(rota(a, 'vendas-por-dia', 'p50'))} → ${ms(rota(r, 'vendas-por-dia', 'p50'))} ms; o plano passou a Bitmap Index Scan no índice novo (diagnostico/05-pool-conexoes/explain.txt). No geral, faixas sobrepostas: esta série teve a maior dispersão de todas (${n2(r.rps_min)} a ${n2(r.rps_max)} req/s), com o host disputado.`,
    curtaConclusao: 'Plano certo, efeito geral escondido pelo ruído',
  },
  {
    rotulo: '05-pool-conexoes',
    mudanca: '`pg.Pool` (máx. 10) no lugar de uma conexão por consulta',
    arquivos: '`api/src/db.js`',
    fonte: f('nodepg-pool', 'pg-conexao', 'freund'),
    hipotese: 'Cada conexão nova custa um processo no PostgreSQL e um handshake (15 ms contra 2,5 ms reaproveitando, em custo-conexao.txt); reaproveitar conexões reduz CPU e latência.',
    curta: 'Reaproveitar conexões (pool)',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `CPU do banco por requisição ${ms(a.recursos.banco.cpu_ms_por_req)} → ${ms(r.recursos.banco.cpu_ms_por_req)} ms; conexões por chamada de pedidos-do-cliente 17 → 0 (diagnostico/05-pool-conexoes/consultas-por-rota.txt). O pool tem tratador de 'error' para não derrubar a API se o banco reiniciar.`,
    curtaConclusao: 'Maior salto até aqui; 17 → 0 conexões novas por requisição',
  },
  {
    rotulo: '06-indice-email',
    mudanca: 'Índice de expressão `clientes(lower(email))`',
    arquivos: '`banco/07-indice-email.sql`',
    fonte: f('pg-expr', 'uil-lower'),
    hipotese: 'A busca por e-mail varre os 100 mil clientes (36,6% do tempo do banco); com índice na mesma expressão do WHERE, lê só as linhas do e-mail, sem mudar o SQL.',
    curta: 'Índice em lower(email), SQL intacto',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de cliente-por-email ${ms(rota(a, 'cliente-por-email'))} → ${ms(rota(r, 'cliente-por-email'))} ms. A CPU da API chegou a ${n1(r.recursos.api.cpu_media)}% (perto do limite de 50%): o próximo gargalo começava a aparecer no Node.`,
    curtaConclusao: 'Ganho claro; API começa a encostar no limite',
  },
  {
    rotulo: '07-vendas-agregado-sql',
    mudanca: 'Vendas-por-dia agregado no SQL (GROUP BY dia)',
    arquivos: '`api/src/rotas.js`',
    fonte: f('yang'),
    hipotese: 'A rota traz ~13 mil linhas por chamada (com observacoes, que a resposta não usa) e agrega em JS; agregando no banco, voltam 7 linhas e a CPU da API cai.',
    curta: 'Agregar no banco em vez de no Node',
    status: 'Aplicada e medida (ganho em recurso, não em req/s)',
    conclusao: (r, a) => `CPU da API por requisição ${ms(a.recursos.api.cpu_ms_por_req)} → ${ms(r.recursos.api.cpu_ms_por_req)} ms (média ${n1(a.recursos.api.cpu_media)}% → ${n1(r.recursos.api.cpu_media)}%). O req/s não teve ganho claro porque o gargalo voltou a ser o banco, ainda saturado.`,
    curtaConclusao: 'CPU da API por requisição 3,4× menor; banco segue o gargalo',
  },
  {
    rotulo: '08-contagem-status',
    mudanca: 'Total por status lido de `pedidos_por_status`, mantida por trigger',
    arquivos: '`banco/08-resumo-pedidos-status.sql`, `api/src/rotas.js`',
    fonte: f('wiki-count', 'citus', 'pg-trigger'),
    hipotese: 'Mesmo com índice, o count(*) exato percorre até 300 mil entradas a cada chamada; mantendo a contagem na escrita, a rota lê 1 linha.',
    curta: 'Contagem exata mantida por trigger',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de pedidos-por-status ${ms(rota(a, 'pedidos-por-status'))} → ${ms(rota(r, 'pedidos-por-status'))} ms. Custo: toda inserção de pedido atualiza 1 de 4 linhas (linha quente; ver proximos-testes.md). Triggers conferidos em diagnostico/08-contagem-status/teste-resumos.txt.`,
    curtaConclusao: 'Dobrou o req/s; custo vai para a escrita',
  },
  {
    rotulo: '09-pagina-deferred-join',
    mudanca: 'Página de /pedidos por *deferred join* (ids pelo índice, depois 20 linhas)',
    arquivos: '`api/src/rotas.js`',
    fonte: f('fastpage', 'uil-offset', 'pg-ios'),
    hipotese: 'Com OFFSET de até ~20 mil, o Index Scan lê na tabela todas as linhas puladas; escolhendo os ids só pelo índice (Heap Fetches 0), a tabela é lida em 20 linhas.',
    curta: 'Ids da página só pelo índice',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `A rota-alvo melhorou (p95 de pedidos-por-status ${ms(rota(a, 'pedidos-por-status'))} → ${ms(rota(r, 'pedidos-por-status'))} ms), mas o req/s geral não: o banco saturado redistribuiu a capacidade liberada. A 1ª série foi descartada porque rodou com o cache do banco frio (memória ~190 MiB contra ~460); refeita com o banco recriado (commit 6c88411, mesmo código de f5d615a).`,
    curtaConclusao: 'Rota 2,9× melhor; geral dentro do ruído',
  },
  {
    rotulo: '10-pedidos-cliente-join',
    mudanca: 'Pedidos do cliente em uma consulta com JOIN (fim do N+1)',
    arquivos: '`api/src/rotas.js`',
    fonte: f('chen', 'yang', 'rails'),
    hipotese: 'A rota faz 17 idas sequenciais ao banco (1 por pedido + 1 por item) e cada uma espera na fila; com um JOIN, na mesma ordem, vira 1 ida.',
    curta: 'N+1 → uma consulta',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de pedidos-do-cliente ${ms(rota(a, 'pedidos-do-cliente'))} → ${ms(rota(r, 'pedidos-do-cliente'))} ms. Equivalência com o código original conferida em 790 URLs (diagnostico/10-pedidos-cliente-join/equivalencia.txt).`,
    curtaConclusao: 'p95 geral quase pela metade',
  },
  {
    rotulo: '11-sem-paralelismo',
    mudanca: '`max_parallel_workers_per_gather=0` no PostgreSQL',
    arquivos: '`docker-compose.yml`',
    fonte: f('pg-recursos', 'cfs'),
    hipotese: 'Com 1 CPU e 20 sessões, os workers paralelos não ganham CPU e só pagam coordenação (6,4% das amostras em IPC:MessageQueueReceive); sem eles, sobra CPU.',
    curta: 'Sem consulta paralela num banco de 1 CPU',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `CPU do banco por requisição ${ms(a.recursos.banco.cpu_ms_por_req)} → ${ms(r.recursos.banco.cpu_ms_por_req)} ms. Uma linha de configuração; o paralelismo é útil com CPU ociosa, que aqui não existe.`,
    curtaConclusao: 'Uma linha de configuração, ganho de ~1,8×',
  },
  {
    rotulo: '12-indice-trigramas',
    mudanca: 'Índice GIN `pg_trgm` em `produtos.nome`',
    arquivos: '`banco/09-indice-busca-produtos.sql`',
    fonte: f('trgm', 'azure'),
    hipotese: 'ILIKE \'%termo%\' não usa B-tree e varre os 20 mil produtos; com trigramas, o banco só confere os candidatos.',
    curta: 'Trigramas para ILIKE com curinga',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de busca-produtos ${ms(rota(a, 'busca-produtos'))} → ${ms(rota(r, 'busca-produtos'))} ms; mesmo operador ILIKE, mesmo resultado.`,
    curtaConclusao: 'Ganho claro e execuções estáveis',
  },
  {
    rotulo: '13-log-sem-corpo',
    mudanca: 'Log de acesso só com metadados (sem o corpo da resposta)',
    arquivos: '`api/src/server.js`',
    fonte: f('owasp', 'lgpd', 'node-io'),
    hipotese: 'Cada resposta era serializada duas vezes e "gravada de forma síncrona" no stdout; logar só método, URL, status e duração reduziria a CPU da API.',
    curta: 'Log sem corpo e sem dados pessoais',
    status: 'Aplicada, sem ganho',
    conclusao: (r, a) => `Sem ganho de desempenho (CPU da API por requisição ${n2(a.recursos.api.cpu_ms_por_req)} → ${n2(r.recursos.api.cpu_ms_por_req)} ms). Por quê: as respostas já eram pequenas depois das mudanças 07 e 10, e a premissa estava errada: no container o stdout é um pipe, assíncrono em POSIX segundo a doc do Node 20. Ganho real em outra dimensão: log de 1.147 → 84 bytes por requisição, sem nome e e-mail de clientes (diagnostico/00 e 13, log-api.txt).`,
    curtaConclusao: 'Log ~14× menor e sem dados pessoais',
  },
  {
    rotulo: '14-totais-pedido',
    mudanca: 'Vendas-por-dia lido de `totais_pedido` (totais por pedido mantidos por triggers)',
    arquivos: '`banco/10-totais-pedido.sql`, `api/src/rotas.js`',
    fonte: f('pg-trigger', 'pg-ios', 'citus'),
    hipotese: 'A rota ainda junta ~4,8 mil pedidos com ~13 mil itens por chamada (78,9% do tempo do banco); com totais por pedido, soma ~4,3 mil entradas contíguas de um índice parcial, sem JOIN.',
    curta: 'Totais por pedido (sem linha quente por dia)',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de vendas-por-dia ${ms(rota(a, 'vendas-por-dia'))} → ${ms(rota(r, 'vendas-por-dia'))} ms. O banco deixou de ser o gargalo (CPU média ${n1(a.recursos.banco.cpu_media)}% → ${n1(r.recursos.banco.cpu_media)}%); a API passou a usar todo o seu limite (${n1(r.recursos.api.cpu_media)}% de 50%). Uma linha por pedido, e não por dia, para não serializar as escritas do dia. Triggers conferidos em diagnostico/14-totais-pedido/teste-resumos.txt.`,
    curtaConclusao: 'Banco deixa de ser gargalo; a API vira o limite',
  },
  {
    rotulo: '15-banco-meia-cpu',
    mudanca: 'Limite de CPU do banco 1,0 → 0,5',
    arquivos: '`docker-compose.yml`',
    fonte: f('docker', 'fargate'),
    hipotese: 'O banco usa ~0,42 CPU e o gargalo é a API; com 0,5 CPU a reserva total cai de 1,5 para 1,0 vCPU (−33%) com perda pequena de req/s.',
    curta: 'Cortar CPU ociosa do banco (custo)',
    status: 'Aplicada e medida (troca custo × desempenho)',
    conclusao: (r, a) => `Req/s ${vezes(r.rps, a.rps)} do anterior e p95 ${ms(a.p95)} → ${ms(r.p95)} ms, com 33% menos CPU reservada; custo estimado por milhão de requisições US$ ${a.custo_milhao_req_usd.toFixed(4).replace('.', ',')} → ${r.custo_milhao_req_usd.toFixed(4).replace('.', ',')} (analise/medianas.md). Vale se a prioridade é custo; para latência mínima, fica a 14.`,
    curtaConclusao: '−33% de CPU reservada por −11% de req/s',
    prefixo: '**Troca custo × desempenho.** ',
  },
];

function substituir(arquivo, marcador, conteudo) {
  const caminho = path.join(RAIZ, arquivo);
  const texto = fs.readFileSync(caminho, 'utf8');
  const ini = `<!-- ${marcador}:inicio -->`;
  const fim = `<!-- ${marcador}:fim -->`;
  const re = new RegExp(`${ini}[\\s\\S]*?${fim}`);
  if (!re.test(texto)) throw new Error(`marcador ${marcador} não encontrado em ${arquivo}`);
  fs.writeFileSync(caminho, texto.replace(re, `${ini}\n${conteudo}\n${fim}`));
  console.log(`${arquivo}: ${marcador} atualizado`);
}

// experimentos.md
const anterior = (i) => resumos[resumos.findIndex((r) => r.rotulo === META[i].rotulo) - 1];
const linhas = [];
linhas.push('| # | Mudança (arquivo) | Fonte da ideia | Status | Antes: req/s · p95 | Depois: req/s · p95 | CPU/req banco · API (ms) | Pastas (antes → depois) | Conclusão |');
linhas.push('|---|---|---|---|---|---|---|---|---|');
const b = resumos[0];
linhas.push(`| 00 | Aplicação original | – | Linha de base | – | ${n2(b.rps)} · ${ms(b.p95)} ms | ${ms(b.recursos.banco.cpu_ms_por_req)} · ${ms(b.recursos.api.cpu_ms_por_req)} | ${pastas(b, '')} | Banco saturado, API ociosa |`);
META.forEach((m, i) => {
  const r = R[m.rotulo];
  const a = anterior(i);
  linhas.push(`| ${m.rotulo.slice(0, 2)} | ${m.mudanca} (${m.arquivos}) | ${m.fonte} | ${m.status} | ${n2(a.rps)} · ${ms(a.p95)} ms | ${n2(r.rps)} · ${ms(r.p95)} ms | ${ms(a.recursos.banco.cpu_ms_por_req)} → ${ms(r.recursos.banco.cpu_ms_por_req)} · ${ms(a.recursos.api.cpu_ms_por_req)} → ${ms(r.recursos.api.cpu_ms_por_req)} | ${a.rotulo.slice(0, 2)}: ${pastas(a, '')} → ${pastas(r, '')} | ${claro(r)}: ${m.conclusao(r, a)} |`);
});
substituir('experimentos.md', 'tabela-experimentos', linhas.join('\n'));

const fichas = [];
META.forEach((m, i) => {
  const r = R[m.rotulo];
  const a = anterior(i);
  fichas.push(`### ${m.rotulo}`);
  fichas.push('');
  fichas.push(`- **Mudança:** ${m.mudanca} (${m.arquivos}), commit medido ${r.commits.join(', ')}.`);
  fichas.push(`- **Hipótese:** ${m.hipotese}`);
  fichas.push(`- **Fonte da ideia:** ${m.fonte}`);
  fichas.push(`- **Antes (${a.rotulo}):** ${n2(a.rps)} req/s [${n2(a.rps_min)}–${n2(a.rps_max)}], p95 ${ms(a.p95)} ms [${ms(a.p95_min)}–${ms(a.p95_max)}], CPU média banco ${n1(a.recursos.banco.cpu_media)}% · API ${n1(a.recursos.api.cpu_media)}%, memória média banco ${ms(a.recursos.banco.mem_media)} MiB · API ${ms(a.recursos.api.mem_media)} MiB.`);
  fichas.push(`- **Depois:** ${n2(r.rps)} req/s [${n2(r.rps_min)}–${n2(r.rps_max)}], p95 ${ms(r.p95)} ms [${ms(r.p95_min)}–${ms(r.p95_max)}], CPU média banco ${n1(r.recursos.banco.cpu_media)}% · API ${n1(r.recursos.api.cpu_media)}%, memória média banco ${ms(r.recursos.banco.mem_media)} MiB · API ${ms(r.recursos.api.mem_media)} MiB.`);
  fichas.push(`- **Resultado:** ${claro(r)} (req/s ${vezes(r.rps, a.rps)}, p95 ${vezes(a.p95, r.p95)} menor; contra a linha de base: req/s ${vezes(r.rps, b.rps)}, p95 ${vezes(b.p95, r.p95)} menor). Contrato: ${r.contratoMantido ? 'mantido nas 3 execuções' : '**quebrado**'}.`);
  fichas.push(`- **Conclusão:** ${m.conclusao(r, a)}`);
  fichas.push(`- **Pastas:** antes ${pastas(a, '')}; depois ${pastas(r, '')}.`);
  fichas.push('');
});
substituir('experimentos.md', 'fichas', fichas.join('\n'));

// artigo/artigo.md (seção 6)
const art = [];
art.push('| Mudança | Hipótese | p95 antes → depois | req/s antes → depois | CPU média banco · API | Pastas de resultados | Conclusão |');
art.push('|---|---|---|---|---|---|---|');
META.forEach((m, i) => {
  const r = R[m.rotulo];
  const a = anterior(i);
  art.push(`| ${m.rotulo} | ${m.curta} | ${ms(a.p95)} → ${ms(r.p95)} ms | ${n2(a.rps)} → ${n2(r.rps)} | ${Math.round(a.recursos.banco.cpu_media)}→${Math.round(r.recursos.banco.cpu_media)}% · ${Math.round(a.recursos.api.cpu_media)}→${Math.round(r.recursos.api.cpu_media)}% | ${pastas(r, '../')} | ${m.prefixo ?? (claro(r) === 'sem ganho claro' ? '**Sem ganho claro.** ' : '')}${m.curtaConclusao} |`);
});
const fim = R['14-totais-pedido'];
art.push(`| **00 → 14** | Todas as mudanças de desempenho | **${ms(b.p95)} → ${ms(fim.p95)} ms** | **${n2(b.rps)} → ${n2(fim.rps)}** | ${Math.round(b.recursos.banco.cpu_media)}→${Math.round(fim.recursos.banco.cpu_media)}% · ${Math.round(b.recursos.api.cpu_media)}→${Math.round(fim.recursos.api.cpu_media)}% | ${pastas(b, '../')} → ${pastas(fim, '../')} | req/s ${vezes(fim.rps, b.rps)}, p95 ${vezes(b.p95, fim.p95)} menor |`);
substituir('artigo/artigo.md', 'tabela-artigo', art.join('\n'));
