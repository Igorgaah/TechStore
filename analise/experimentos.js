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
const n0 = (x) => Math.round(x).toString();
const vezes = (a, b) => `${(a / b).toFixed(1).replace('.', ',')}×`;
const rota = (r, nome, campo = 'p95') => r.porRota[nome][campo];
const pastas = (r, prefixo) => r.pastas.map((p, i) => `[${i + 1}](${prefixo}resultados/${p}/resumo.txt)`).join(' ');
// "Ganho claro" em cada métrica = faixas das 3 execuções sem sobreposição (ver analise/medianas.md).
const claro = (r) => (r.ganho_claro_rps && r.ganho_claro_p95 ? 'Ganho claro em req/s e p95'
  : r.ganho_claro_rps ? 'Ganho claro em req/s (p95 sem ganho claro)'
    : r.ganho_claro_p95 ? 'Ganho claro em p95 (req/s sem ganho claro)' : 'Sem ganho claro');

const FONTES = {
  'pg-fk': '[PostgreSQL 16, §5.4.5](https://www.postgresql.org/docs/16/ddl-constraints.html)',
  yang: '[Yang et al., ICSE 2018](https://par.nsf.gov/servlets/purl/10067547)',
  'pg-multi': '[PostgreSQL 16, §11.3](https://www.postgresql.org/docs/16/indexes-multicolumn.html)',
  'pg-ordem': '[§11.4](https://www.postgresql.org/docs/16/indexes-ordering.html)',
  'pg-ios': '[PostgreSQL 16, §11.9](https://www.postgresql.org/docs/16/indexes-index-only-scans.html)',
  gitlab: '[GitLab, Pagination guidelines](https://docs.gitlab.com/development/database/pagination_guidelines/)',
  'pg-trigger': '[PostgreSQL 16, §43.10](https://www.postgresql.org/docs/16/plpgsql-trigger.html)',
  'pg-matview': '[PostgreSQL 16, §41.3](https://www.postgresql.org/docs/16/rules-materializedviews.html)',
  'pg-expr': '[PostgreSQL 16, §11.7](https://www.postgresql.org/docs/16/indexes-expressional.html)',
  'uil-datas': '[Winand, Use The Index, Luke!: datas](https://use-the-index-luke.com/sql/where-clause/obfuscation/dates) (descreve o problema do cast; recomenda reescrever como faixa)',
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
  'pg-lock': '[PostgreSQL 16, §13.3](https://www.postgresql.org/docs/16/explicit-locking.html)',
};
const f = (...ids) => ids.map((id) => FONTES[id]).join('; ');

// curta = hipótese na tabela do artigo (causa → efeito esperado); curtaConclusao = conclusão na tabela do artigo
const META = [
  {
    rotulo: '01-indices-fk',
    mudanca: 'Índices nas FKs `itens_pedido(pedido_id)` e `pedidos(cliente_id)`',
    arquivos: '`banco/03-indices-chaves-estrangeiras.sql`',
    fonte: f('pg-fk', 'yang'),
    hipotese: 'As consultas de itens por pedido e de pedidos por cliente varrem a tabela inteira a cada chamada; com índice, viram buscas de poucas linhas, e o p95 de pedidos-do-cliente e a CPU do banco por requisição caem.',
    curta: 'FKs sem índice forçam varredura → índice reduz p95 e CPU',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `No banco, a consulta de itens por pedido caiu de 40,5% para 0,5% do tempo (diagnostico/00 → 01, carga-consultas.txt) e o p50 de pedidos-do-cliente de ${ms(rota(a, 'pedidos-do-cliente', 'p50'))} para ${ms(rota(r, 'pedidos-do-cliente', 'p50'))} ms. O req/s geral e a CPU por requisição não saíram da faixa da linha de base: o banco seguiu saturado pelas outras varreduras (status, vendas-por-dia, top-produtos). A execução mediana desta série teve ${(r.erros_max * 100).toFixed(2).replace('.', ',')}% de erros (timeout de 60 s em top-produtos), o que trunca o p95 dela.`,
    curtaConclusao: 'Resolveu a consulta-alvo, mas o banco seguiu saturado pelas outras',
  },
  {
    rotulo: '02-indice-status',
    mudanca: 'Índice `pedidos(status, criado_em DESC, id DESC)`',
    arquivos: '`banco/04-indice-pedidos-status.sql`',
    fonte: f('pg-multi', 'pg-ordem', 'pg-ios', 'gitlab'),
    hipotese: 'A página ordena até 300 mil pedidos em disco e o count varre a tabela; com o índice na ordem do ORDER BY, a página percorre o índice e o count usa só o índice, e o p95 de pedidos-por-status cai.',
    curta: 'Ordenar 300 mil linhas em disco → índice ordenado reduz p95 da página',
    status: 'Aplicada e medida (ganho provável em req/s)',
    prefixo: '**Ganho claro em req/s nesta série; provável com a série descartada.** ',
    conclusao: (r, a) => `p95 de pedidos-por-status ${ms(rota(a, 'pedidos-por-status'))} → ${ms(rota(r, 'pedidos-por-status'))} ms; o count virou Index Only Scan (diagnostico/02-indice-status/explain.txt). Ressalva: a 1ª série com o **mesmo código** (descartada por 2 relatórios sem commit; commit 5198b26) deu 2,10 / 2,93 / 3,49 req/s, faixa que se sobrepõe à da 01; a série que ficou foi refeita no commit c05803a, depois da série da 03. Com as 6 execuções, o ganho em req/s é provável, não claro.`,
    curtaConclusao: 'p95 da página 4× menor; ganho geral provável (ver ressalva)',
  },
  {
    rotulo: '03-resumo-top-produtos',
    mudanca: 'Top-produtos lido de `receita_por_produto`, mantida por triggers',
    arquivos: '`banco/05-resumo-top-produtos.sql`, `api/src/rotas.js`',
    fonte: f('pg-trigger', 'pg-matview'),
    hipotese: 'Cada chamada agrega 1,5 milhão de itens; mantendo a soma por produto no momento da escrita (mesma transação), a rota lê ~10 linhas de um índice e o req/s geral sobe.',
    curta: 'Agregar 1,5 mi de itens por chamada → resumo reduz p95 de top-produtos',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `p95 de top-produtos ${ms(rota(a, 'top-produtos'))} → ${ms(rota(r, 'top-produtos'))} ms, mas o req/s geral ficou na mesma faixa: a rota é só 2% da carga e os "29% do tempo do banco" do pg_stat_statements eram em boa parte espera por CPU (tempo de relógio), não trabalho. Os triggers tinham 2 defeitos que só aparecem com escrita (corrida com cancelamento e overflow), corrigidos na 16.`,
    curtaConclusao: 'Rota 20× mais rápida; peso pequeno na carga (2%)',
  },
  {
    rotulo: '04-indice-dia',
    mudanca: 'Índice de expressão `pedidos((criado_em::date))`',
    arquivos: '`banco/06-indice-pedidos-dia.sql`',
    fonte: f('pg-expr', 'uil-datas'),
    hipotese: 'O filtro criado_em::date BETWEEN não usa índice comum e varre os 500 mil pedidos (163 MB) a cada chamada; com índice na mesma expressão, lê só o período e o p95 de vendas-por-dia cai.',
    curta: 'Cast na coluna impede índice → índice na expressão reduz p95 de vendas',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `p50 de vendas-por-dia ${ms(rota(a, 'vendas-por-dia', 'p50'))} → ${ms(rota(r, 'vendas-por-dia', 'p50'))} ms; o plano passou a Bitmap Index Scan no índice novo (diagnostico/05-pool-conexoes/explain.txt). No geral, faixas sobrepostas, numa das séries mais dispersas (${n2(r.rps_min)} a ${n2(r.rps_max)} req/s).`,
    curtaConclusao: 'Plano certo, efeito geral escondido pelo ruído',
  },
  {
    rotulo: '05-pool-conexoes',
    mudanca: '`pg.Pool` (máx. 10) no lugar de uma conexão por consulta',
    arquivos: '`api/src/db.js`',
    fonte: f('nodepg-pool', 'pg-conexao', 'freund'),
    hipotese: 'Cada conexão nova custa um processo no PostgreSQL e um handshake (15 ms contra 2,5 ms reaproveitando, em custo-conexao.txt); reaproveitando conexões, a CPU por requisição do banco e da API cai e o req/s sobe.',
    curta: 'Conexão nova custa ~6× → pool reduz CPU por requisição',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `CPU do banco por requisição ${ms(a.recursos.banco.cpu_ms_por_req)} → ${ms(r.recursos.banco.cpu_ms_por_req)} ms; numa chamada de pedidos-do-cliente, conexões novas 17 → 0 (diagnostico/05-pool-conexoes/consultas-por-rota.txt; 3 das 7 rotas ainda abriram 1, ao repor conexões do pool). O pool tem tratador de 'error' para não derrubar a API se o banco reiniciar.`,
    curtaConclusao: 'Maior salto até aqui; 17 → 0 conexões novas em pedidos-do-cliente',
  },
  {
    rotulo: '06-indice-email',
    mudanca: 'Índice de expressão `clientes(lower(email))`',
    arquivos: '`banco/07-indice-email.sql`',
    fonte: f('pg-expr', 'uil-lower'),
    hipotese: 'A busca por e-mail varre os 100 mil clientes (36,6% do tempo do banco); com índice na mesma expressão do WHERE, lê só as linhas do e-mail, sem mudar o SQL, e o req/s sobe.',
    curta: 'lower(email) varre 100 mil linhas → índice de expressão reduz p95',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de cliente-por-email ${ms(rota(a, 'cliente-por-email'))} → ${ms(rota(r, 'cliente-por-email'))} ms. A CPU da API chegou a ${n1(r.recursos.api.cpu_media)}% (perto do limite de 50%): o próximo gargalo começava a aparecer no Node.`,
    curtaConclusao: 'API começa a encostar no limite',
  },
  {
    rotulo: '07-vendas-agregado-sql',
    mudanca: 'Vendas-por-dia agregado no SQL (GROUP BY dia)',
    arquivos: '`api/src/rotas.js`',
    fonte: f('yang'),
    hipotese: 'A rota traz ~13 mil linhas por chamada (com observacoes, que a resposta não usa) e agrega em JS; agregando no banco, voltam 7 linhas e a CPU da API por requisição cai.',
    curta: '~13 mil linhas por chamada para o Node → GROUP BY reduz CPU da API',
    status: 'Aplicada e medida (ganho em recurso, não em req/s)',
    conclusao: (r, a) => `CPU da API por requisição ${ms(a.recursos.api.cpu_ms_por_req)} → ${ms(r.recursos.api.cpu_ms_por_req)} ms (média ${n1(a.recursos.api.cpu_media)}% → ${n1(r.recursos.api.cpu_media)}%). O req/s não teve ganho claro porque o gargalo voltou a ser o banco, ainda saturado.`,
    curtaConclusao: 'CPU da API por requisição 3,4× menor; banco segue o gargalo',
  },
  {
    rotulo: '08-contagem-status',
    mudanca: 'Total por status lido de `pedidos_por_status`, mantida por trigger',
    arquivos: '`banco/08-resumo-pedidos-status.sql`, `api/src/rotas.js`',
    fonte: f('wiki-count', 'citus', 'pg-trigger'),
    hipotese: 'Mesmo com índice, o count(*) exato percorre até 300 mil entradas a cada chamada; mantendo a contagem na escrita, a rota lê 1 linha e o req/s sobe.',
    curta: 'count(*) percorre até 300 mil entradas → contagem pronta aumenta req/s',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de pedidos-por-status ${ms(rota(a, 'pedidos-por-status'))} → ${ms(rota(r, 'pedidos-por-status'))} ms. Custo: toda inserção de pedido atualiza 1 de 4 linhas (linha quente), e trocas de status em ordens opostas podem dar deadlock (ver proximos-testes.md). Triggers conferidos em diagnostico/08-contagem-status/teste-resumos.txt.`,
    curtaConclusao: 'Dobrou o req/s; o custo vai para a escrita',
  },
  {
    rotulo: '09-pagina-deferred-join',
    mudanca: 'Página de /pedidos por *deferred join* (ids pelo índice, depois 20 linhas)',
    arquivos: '`api/src/rotas.js`',
    fonte: f('fastpage', 'uil-offset', 'pg-ios'),
    hipotese: 'Com OFFSET de até ~20 mil, o Index Scan lê na tabela todas as linhas puladas; escolhendo os ids só pelo índice (Heap Fetches 0), a tabela é lida em 20 linhas e o p95 de pedidos-por-status cai.',
    curta: 'OFFSET lê linhas descartadas → ids pelo índice reduzem p95 da página',
    status: 'Aplicada, sem ganho geral claro',
    conclusao: (r, a) => `A rota-alvo melhorou (p95 de pedidos-por-status ${ms(rota(a, 'pedidos-por-status'))} → ${ms(rota(r, 'pedidos-por-status'))} ms), mas o req/s geral não: o banco saturado redistribuiu a capacidade liberada. A 1ª série foi descartada porque rodou com o cache do banco frio (memória média ~190 MiB contra ${n0(a.recursos.banco.mem_media)} MiB na 08; commit 450be9a); refeita com o banco recriado (commit 6c88411, mesmo código de f5d615a).`,
    curtaConclusao: 'Rota 2,9× melhor; geral dentro do ruído',
  },
  {
    rotulo: '10-pedidos-cliente-join',
    mudanca: 'Pedidos do cliente em uma consulta com JOIN (fim do N+1)',
    arquivos: '`api/src/rotas.js`',
    fonte: f('chen', 'yang', 'rails'),
    hipotese: 'A rota faz 1 + uma consulta por pedido e por item (17 idas para o cliente 42), em sequência, e cada uma espera na fila; com um JOIN, na mesma ordem, vira 1 ida e o p95 da rota cai.',
    curta: '17 idas sequenciais ao banco → 1 consulta reduz p95 da rota',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de pedidos-do-cliente ${ms(rota(a, 'pedidos-do-cliente'))} → ${ms(rota(r, 'pedidos-do-cliente'))} ms. Equivalência com o código original conferida em 790 URLs (diagnostico/10-pedidos-cliente-join/equivalencia.txt).`,
    curtaConclusao: 'p95 geral quase pela metade',
  },
  {
    rotulo: '11-sem-paralelismo',
    mudanca: '`max_parallel_workers_per_gather=0` no PostgreSQL',
    arquivos: '`docker-compose.yml`',
    fonte: f('pg-recursos', 'cfs'),
    hipotese: 'Com 1 CPU e 20 sessões, os workers paralelos não ganham CPU e só pagam coordenação (6,4% das amostras em IPC:MessageQueueReceive); sem eles, sobra CPU e o req/s sobe.',
    curta: 'Workers paralelos sem CPU livre → desligar aumenta req/s',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `CPU do banco por requisição ${ms(a.recursos.banco.cpu_ms_por_req)} → ${ms(r.recursos.banco.cpu_ms_por_req)} ms. Uma linha de configuração; o paralelismo ajuda quando há CPU ociosa, que aqui não havia.`,
    curtaConclusao: 'Uma linha de configuração, ~1,8× mais req/s',
  },
  {
    rotulo: '12-indice-trigramas',
    mudanca: 'Índice GIN `pg_trgm` em `produtos.nome`',
    arquivos: '`banco/09-indice-busca-produtos.sql`',
    fonte: f('trgm', 'azure'),
    hipotese: 'ILIKE \'%termo%\' não usa B-tree e varre os 20 mil produtos; com trigramas, o banco só confere os candidatos e o p95 da busca cai.',
    curta: 'ILIKE varre 20 mil nomes → trigramas reduzem p95 da busca',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de busca-produtos ${ms(rota(a, 'busca-produtos'))} → ${ms(rota(r, 'busca-produtos'))} ms; mesmo operador ILIKE, mesmo resultado.`,
    curtaConclusao: 'Execuções estáveis',
  },
  {
    rotulo: '13-log-sem-corpo',
    mudanca: 'Log de acesso só com metadados (sem o corpo da resposta)',
    arquivos: '`api/src/server.js`',
    fonte: f('owasp', 'lgpd', 'node-io'),
    hipotese: 'Cada resposta era serializada duas vezes e "gravada de forma síncrona" no stdout; logando só método, URL, status e duração, a CPU da API por requisição cai.',
    curta: 'Log síncrono do corpo → sem corpo, menos CPU da API',
    status: 'Aplicada, sem ganho (hipótese refutada)',
    conclusao: (r, a) => `Sem ganho de desempenho (CPU da API por requisição ${n2(a.recursos.api.cpu_ms_por_req)} → ${n2(r.recursos.api.cpu_ms_por_req)} ms). A premissa estava errada: o stdout do container é um pipe (diagnostico/ambiente-host.txt: \`/proc/1/fd/1 -> pipe:[...]\`, Tty=false), e a doc do Node 20 diz que escrita em pipe é assíncrona em POSIX. Ganho real em outra dimensão: log de 1.147 → 84 bytes por requisição, sem nome e e-mail de clientes (diagnostico/00 e 13, log-api.txt).`,
    curtaConclusao: 'Hipótese refutada; log ~14× menor e sem dados pessoais',
  },
  {
    rotulo: '14-totais-pedido',
    mudanca: 'Vendas-por-dia lido de `totais_pedido` (totais por pedido mantidos por triggers)',
    arquivos: '`banco/10-totais-pedido.sql`, `api/src/rotas.js`',
    fonte: f('pg-trigger', 'pg-ios', 'citus'),
    hipotese: 'A rota ainda junta ~4,8 mil pedidos com ~13 mil itens por chamada (137 ms com o banco ocioso, contra no máximo 11 ms de cada outra consulta, em diagnostico/13-log-sem-corpo/explain.txt); com totais por pedido, soma ~4,3 mil entradas contíguas de um índice parcial, sem JOIN, e o req/s sobe.',
    curta: 'JOIN de ~13 mil itens por chamada → totais por pedido aumentam req/s',
    status: 'Aplicada e medida',
    conclusao: (r, a) => `p95 de vendas-por-dia ${ms(rota(a, 'vendas-por-dia'))} → ${ms(rota(r, 'vendas-por-dia'))} ms. O banco deixou de ser o gargalo (CPU média ${n1(a.recursos.banco.cpu_media)}% → ${n1(r.recursos.banco.cpu_media)}%); a API passou a usar todo o seu limite (${n1(r.recursos.api.cpu_media)}% de 50%). Uma linha por pedido, e não por dia, para não serializar as escritas do dia. O "78,9% do tempo do banco" do diagnóstico 13 foi medido com a consulta paralela ligada (defeito do override, corrigido depois) e é só indicativo; o EXPLAIN do mesmo diagnóstico rodou com a configuração certa.`,
    curtaConclusao: 'Banco deixa de ser gargalo; a API vira o limite',
  },
  {
    rotulo: '15-banco-meia-cpu',
    mudanca: 'Limite de CPU do banco 1,0 → 0,5',
    arquivos: '`docker-compose.yml`',
    fonte: f('docker', 'fargate'),
    hipotese: 'O banco usa ~0,42 CPU e o gargalo é a API; com limite de 0,5 CPU, o total de CPU alocada cai de 1,5 para 1,0 (−33%) e o req/s cai pouco.',
    curta: 'Banco usa ~0,42 de 1 CPU → 0,5 CPU custa pouco req/s',
    status: 'Aplicada e medida (troca custo × desempenho)',
    prefixo: '**Troca custo × desempenho (sem ganho claro).** ',
    conclusao: (r, a) => `Req/s ${vezes(r.rps, a.rps)} do anterior e p95 ${ms(a.p95)} → ${ms(r.p95)} ms, com 33% menos CPU alocada; custo estimado por milhão de requisições US$ ${a.custo_milhao_req_usd.toFixed(4).replace('.', ',')} → ${r.custo_milhao_req_usd.toFixed(4).replace('.', ',')} (analise/medianas.md). Ressalva: com 0,5 CPU o banco fica sem folga, e a série 16 (mesmo caminho de leitura) variou 3,6×. Vale se a prioridade é custo; para latência, fica a 14.`,
    curtaConclusao: '−33% de CPU alocada por −11% de req/s',
  },
  {
    rotulo: '16-triggers-corrigidos',
    mudanca: 'Correções nos triggers dos resumos: FOR SHARE na leitura do status, upsert em qualquer ordem, contas em bigint',
    arquivos: '`banco/11-correcoes-triggers.sql`',
    fonte: f('pg-lock', 'pg-trigger'),
    hipotese: 'Os triggers só rodam em escritas e a carga só lê: req/s e p95 não mudam; o que muda é a corretude sob escrita.',
    curta: 'Triggers só rodam em escrita → req/s e p95 não mudam',
    status: 'Aplicada (corretude); desempenho sem diferença clara',
    prefixo: '**Sem diferença clara (era o esperado).** ',
    conclusao: (r, a) => `Faixas sobrepostas com a 15 (${n2(r.rps_min)} a ${n2(r.rps_max)} req/s, contra ${n2(a.rps_min)} a ${n2(a.rps_max)}). A dispersão de 3,6× dentro da série, com o mesmo caminho de leitura da 15, é ruído: duas séries descartadas do mesmo caminho de leitura deram medianas de 182,73 e 104,01 req/s (commits 9e0098f, 1ª versão com defeito, e 663a2ef, com 1 arquivo sem commit). Corretude: a corrida com cancelamento falhava antes e passa depois (diagnostico/16-triggers-corrigidos/concorrencia-antes-da-correcao.txt e concorrencia.txt); testes/resumos.sql passa nos 20 passos; 790 URLs idênticas ao original.`,
    curtaConclusao: 'Corrige 3 defeitos de escrita; leitura igual (dentro do ruído)',
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

const anterior = (i) => resumos[resumos.findIndex((r) => r.rotulo === META[i].rotulo) - 1];
const b = resumos[0];
const prefixoDe = (m, r) => m.prefixo ?? `**${claro(r)}.** `;

// experimentos.md: tabela
const linhas = [];
linhas.push('| # | Mudança (arquivo) | Fonte da ideia | Status | Antes: req/s · p95 | Depois: req/s · p95 | CPU/req banco · API (ms) | Pastas (antes → depois) | Conclusão |');
linhas.push('|---|---|---|---|---|---|---|---|---|');
linhas.push(`| 00 | Aplicação original | – | Linha de base | – | ${n2(b.rps)} · ${ms(b.p95)} ms | ${ms(b.recursos.banco.cpu_ms_por_req)} · ${ms(b.recursos.api.cpu_ms_por_req)} | ${pastas(b, '')} | Banco saturado, API ociosa; 1 das 3 execuções com timeout em top-produtos |`);
META.forEach((m, i) => {
  const r = R[m.rotulo];
  const a = anterior(i);
  linhas.push(`| ${m.rotulo.slice(0, 2)} | ${m.mudanca} (${m.arquivos}) | ${m.fonte} | ${m.status} | ${n2(a.rps)} · ${ms(a.p95)} ms | ${n2(r.rps)} · ${ms(r.p95)} ms | ${ms(a.recursos.banco.cpu_ms_por_req)} → ${ms(r.recursos.banco.cpu_ms_por_req)} · ${ms(a.recursos.api.cpu_ms_por_req)} → ${ms(r.recursos.api.cpu_ms_por_req)} | ${a.rotulo.slice(0, 2)}: ${pastas(a, '')} → ${pastas(r, '')} | ${prefixoDe(m, r)}${m.conclusao(r, a)} |`);
});
substituir('experimentos.md', 'tabela-experimentos', linhas.join('\n'));

// experimentos.md: fichas
const fichas = [];
META.forEach((m, i) => {
  const r = R[m.rotulo];
  const a = anterior(i);
  const erros = (x) => (x.execucoes_com_erro ? `; ${x.execucoes_com_erro} execução(ões) com erro (máx. ${(x.erros_max * 100).toFixed(2).replace('.', ',')}%)` : '');
  fichas.push(`### ${m.rotulo}`);
  fichas.push('');
  fichas.push(`- **Mudança:** ${m.mudanca} (${m.arquivos}), commit medido ${r.commits.join(', ')}.`);
  fichas.push(`- **Hipótese:** ${m.hipotese}`);
  fichas.push(`- **Fonte da ideia:** ${m.fonte}`);
  fichas.push(`- **Antes (${a.rotulo}):** ${n2(a.rps)} req/s [${n2(a.rps_min)}–${n2(a.rps_max)}], p95 ${ms(a.p95)} ms [${ms(a.p95_min)}–${ms(a.p95_max)}], CPU média banco ${n1(a.recursos.banco.cpu_media)}% · API ${n1(a.recursos.api.cpu_media)}%, memória média banco ${ms(a.recursos.banco.mem_media)} MiB · API ${ms(a.recursos.api.mem_media)} MiB${erros(a)}.`);
  fichas.push(`- **Depois:** ${n2(r.rps)} req/s [${n2(r.rps_min)}–${n2(r.rps_max)}], p95 ${ms(r.p95)} ms [${ms(r.p95_min)}–${ms(r.p95_max)}], CPU média banco ${n1(r.recursos.banco.cpu_media)}% · API ${n1(r.recursos.api.cpu_media)}%, memória média banco ${ms(r.recursos.banco.mem_media)} MiB · API ${ms(r.recursos.api.mem_media)} MiB${erros(r)}.`);
  fichas.push(`- **Resultado:** ${claro(r).toLowerCase()} (req/s ${vezes(r.rps, a.rps)}, p95 ${vezes(a.p95, r.p95)} menor; contra a linha de base: req/s ${vezes(r.rps, b.rps)}, p95 ${vezes(b.p95, r.p95)} menor). Contrato: ${r.contratoMantido ? 'mantido nas 3 execuções' : '**quebrado**'}.`);
  fichas.push(`- **Conclusão:** ${m.conclusao(r, a)}`);
  fichas.push(`- **Pastas:** antes ${pastas(a, '')}; depois ${pastas(r, '')}.`);
  fichas.push('');
});
substituir('experimentos.md', 'fichas', fichas.join('\n'));

// artigo/artigo.md (seção 6)
const mem = (x) => `${n0(x.recursos.banco.mem_media)} · ${n0(x.recursos.api.mem_media)}`;
const cpu = (x) => `${n0(x.recursos.banco.cpu_media)}% · ${n0(x.recursos.api.cpu_media)}%`;
const art = [];
art.push('| Mudança | Hipótese | p95 antes → depois | req/s antes → depois | CPU/memória depois (banco · API; % de 1 CPU, MiB) | Pastas de resultados | Conclusão |');
art.push('|---|---|---|---|---|---|---|');
art.push(`| 00-linha-de-base | – | – | – | ${cpu(b)}; ${mem(b)} | ${pastas(b, '../')} | Banco saturado, API ociosa |`);
META.forEach((m, i) => {
  const r = R[m.rotulo];
  const a = anterior(i);
  art.push(`| ${m.rotulo} | ${m.curta} | ${ms(a.p95)} → ${ms(r.p95)} ms | ${n2(a.rps)} → ${n2(r.rps)} | ${cpu(r)}; ${mem(r)} | ${pastas(r, '../')} | ${prefixoDe(m, r)}${m.curtaConclusao} |`);
});
const fim = R['14-totais-pedido'];
art.push(`| **00 → 14** | Todas as mudanças de desempenho | **${ms(b.p95)} → ${ms(fim.p95)} ms** | **${n2(b.rps)} → ${n2(fim.rps)}** | ${cpu(b)} → ${cpu(fim)} | – | req/s ${vezes(fim.rps, b.rps)}, p95 ${vezes(b.p95, fim.p95)} menor |`);
substituir('artigo/artigo.md', 'tabela-artigo', art.join('\n'));
