# Próximos testes

Ideias que apareceram na pesquisa e **não foram testadas**, por falta de tempo ou porque não dá para testar com a carga deste desafio. Não há resultado de nenhuma delas: o que está em "o que eu acredito que ganharia" é opinião, para ser confirmada ou derrubada pelo teste descrito. As citações literais de cada fonte estão em [pesquisa/fontes.md](pesquisa/fontes.md); o que foi aplicado e medido está em [experimentos.md](experimentos.md).

Ordem: primeiro o que pode **derrubar** a conclusão do artigo, depois o que pode melhorar o resultado.

## Testes que podem derrubar a conclusão

### 1. Custo dos triggers numa carga com escrita

- **De onde veio:** [Nelson, Citus Data, "Faster PostgreSQL Counting"](https://www.citusdata.com/blog/2016/10/12/count-performance/): contagem por trigger "shifts overhead to inserts and deletes", e no teste deles as inserções ficaram 50× mais lentas. [PostgreSQL 16, 13.3 Explicit Locking](https://www.postgresql.org/docs/16/explicit-locking.html): o UPDATE de uma linha bloqueia outras transações que tentam alterar a mesma linha até o fim da transação.
- **O que eu acredito que ganharia:** a resposta à maior dúvida da solução. Opinião: `totais_pedido` (uma linha por pedido) e `receita_por_produto` (20 mil linhas) devem ter custo moderado. A `pedidos_por_status` é uma linha quente: toda inserção de pedido atualiza uma de só 4 linhas, então transações de checkout concorrentes devem se enfileirar nela.
- **Como testaria:** um script `pgbench` que cria pedidos com 1 a 5 itens (como o `02-dados.sql`) com 1, 8 e 32 clientes simultâneos, medindo TPS e latência com e sem os três triggers (banco recriado com e sem os arquivos `05`, `08` e `10`). Se a linha quente pesar, testar contadores particionados: N linhas por status, uma escolhida por transação, somadas na leitura.
- **O que precisaria:** um perfil de escrita da loja real (pedidos por segundo no pico) para escolher a concorrência; o `pgbench` já vem na imagem do PostgreSQL.

### 2. Carga em modelo aberto (taxa de chegada fixa)

- **De onde veio:** [Schroeder, Wierman e Harchol-Balter, "Open Versus Closed: A Cautionary Tale", NSDI 2006](https://www.usenix.org/legacy/events/nsdi06/tech/full_papers/schroeder/schroeder_html/index.html); [k6, Open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/) e [executor constant-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/).
- **O que eu acredito que ganharia:** uma latência mais próxima do que um usuário real veria. Com 20 VUs fixos, quando a API demora, a carga diminui junto (*coordinated omission*), e o p95 medido sai otimista.
- **Como testaria:** um cenário novo fora de `carga/` (a régua não muda), com `constant-arrival-rate` em 50, 100 e 150 req/s e os mesmos pesos de rota, nos estados 00, 08 e 14. Medir p95 e iterações descartadas.
- **O que precisaria:** só tempo de máquina. Acima da capacidade, a fila cresce sem limite, então é preciso começar abaixo do req/s medido aqui.

### 3. Medir de novo numa máquina quieta, com mais repetições

- **De onde veio:** [Uta et al., NSDI 2020](https://www.usenix.org/system/files/nsdi20-paper-uta.pdf): "Three repetitions are insufficient to calculate CIs"; [Papadopoulos et al., SPEC RG 2019 / IEEE TSE 2021](https://research.spec.org/fileadmin/user_upload/documents/rg_cloud/endorsed_publications/SPEC_RG_2019_Methodological_Principles_for_Reproducible_Performance_Evaluation_in_Cloud_Computing.pdf).
- **O que eu acredito que ganharia:** saber se as mudanças "sem ganho claro" (01, 03, 04, 07, 09, 10) não ajudam de fato no req/s ou se o efeito foi escondido pelo ruído. As medições foram feitas com um jogo usando ~2 dos 4 núcleos do host ([diagnostico/host-cpu.txt](diagnostico/host-cpu.txt)).
- **Como testaria:** Linux nativo, sem outros programas, 10 execuções por estado com o `medir.sh` e intervalo de confiança da mediana por *bootstrap*. Alternar a ordem dos estados (00, 14, 01, 13...) para não confundir o efeito com o tempo.
- **O que precisaria:** uma máquina dedicada por ~4 horas.

### 4. Ordem das mudanças

- **De onde veio:** do próprio diagnóstico ([experimentos.md](experimentos.md), seção Diagnóstico): o `pg_stat_statements` mede tempo de relógio, e num banco saturado isso superestima a fatia de consultas longas.
- **O que eu acredito que ganharia:** mostrar quanto cada mudança vale sozinha. Opinião: a 11 (sem paralelismo) e a 05 (pool) dariam ganho grande em qualquer ordem; 03 e 09 dariam ganho maior se aplicadas depois que o banco deixa de estar saturado.
- **Como testaria:** partir do estado final e desfazer uma mudança por vez (*ablation*), medindo cada estado.
- **O que precisaria:** ~15 séries de medição.

## Testes que podem melhorar o resultado

### 5. Log assíncrono com Pino

- **De onde veio:** [Express, Production best practices](https://expressjs.com/en/advanced/best-practice-performance.html) recomenda Pino no lugar de `console.log`; [README do Pino](https://raw.githubusercontent.com/pinojs/pino/main/README.md) e [Asynchronous Logging](https://raw.githubusercontent.com/pinojs/pino/main/docs/asynchronous.md) (o buffer assíncrono pode perder as últimas linhas numa queda do sistema).
- **O que eu acredito que ganharia:** pouco, mas agora a API é o gargalo (~49% de CPU com limite de 50% na mudança 14), então cada fração de milissegundo por requisição conta. A mudança 13 mostrou que o log por si só pesava pouco.
- **Como testaria:** trocar o `console.log` do middleware por `pino` com `pino.destination({ sync: false })` e medir CPU/req da API.
- **O que precisaria:** uma dependência nova.

### 6. Perfil de CPU da API e *prepared statements* nomeados

- **De onde veio:** [Node.js, Don't Block the Event Loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop); [node-postgres, Queries](https://node-postgres.com/features/queries): com `name` na consulta, o plano é preparado uma vez por conexão.
- **O que eu acredito que ganharia:** descobrir para onde vão os ~2,4 ms de CPU por requisição da API (parse do protocolo do `pg`, Express, JSON). Os *prepared statements* nomeados reduzem o trabalho de *parse* e planejamento no banco.
- **Como testaria:** `node --cpu-prof` durante a carga (override do compose só para o diagnóstico), resumir as funções com mais tempo e atacar a maior; depois, `name` nas consultas mais frequentes.
- **O que precisaria:** um script que resuma o `.cpuprofile`.

### 7. Ajustar a memória ao uso (API e banco)

- **De onde veio:** [Docker, Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/): "Perform tests to understand the memory requirements of your application before placing it into production", e o kernel mata o processo em OOM; [Node.js 20, --max-old-space-size](https://nodejs.org/docs/latest-v20.x/api/cli.html); [PostgreSQL 16, 20.4](https://www.postgresql.org/docs/16/runtime-config-resource.html).
- **O que eu acredito que ganharia:** a API usa ~27 MiB de 256 MiB; com 128 MiB, a reserva cai sem efeito no desempenho. No banco eu **não** reduziria: o cache do sistema conta na memória do container, e o diagnóstico 15 mostrou 56% de espera por disco com o cache frio. Para reduzir, primeiro medir com 384 MiB.
- **Como testaria:** limite da API em 128 MiB (e `--max-old-space-size` coerente), 3 medições, conferir OOM em `docker inspect`.
- **O que precisaria:** nada além de tempo de máquina. No Fargate, 0,5 vCPU já exige pelo menos 1 GB por tarefa ([AWS ECS, Fargate task CPU and memory](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html)), então esse ganho depende de onde a aplicação roda.

### 8. PgBouncer, se houver mais de uma instância da API

- **De onde veio:** [PgBouncer, Features](https://www.pgbouncer.org/features.html) (o modo *transaction* "breaks client expectations of the server by design"); [Freund, 2020](https://techcommunity.microsoft.com/blog/adforpostgresql/analyzing-the-limits-of-connection-scalability-in-postgres/1757266).
- **O que eu acredito que ganharia:** nada com uma instância (o `pg.Pool` já reaproveita conexões). Com várias instâncias, limitaria o total de conexões no banco.
- **Como testaria:** serviço `pgbouncer` no compose em modo *transaction*, duas réplicas da API, medir com o custo do container novo somado.
- **O que precisaria:** decidir se a T4H rodaria mais de uma instância.

### 9. Cache-aside para busca e top-produtos

- **De onde veio:** [Microsoft, Cache-Aside pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside); [AWS, Caching Best Practices](https://aws.amazon.com/caching/best-practices/); [Nishtala et al., "Scaling Memcache at Facebook", NSDI 2013](https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf).
- **O que eu acredito que ganharia:** nesta carga, um número enganoso: só 12 termos de busca e 1 URL de top-produtos, ou seja, quase 100% de acerto. Com uma distribuição de termos de cauda longa, o ganho deve ser bem menor, e o cache traz dados desatualizados e invalidação para resolver.
- **Como testaria:** gerar termos com distribuição de Zipf num cenário de carga separado e comparar acerto, req/s e p95, com e sem cache.
- **O que precisaria:** uma amostra de termos reais de busca para calibrar a distribuição.

### 10. Materialized view no lugar dos triggers, para relatórios que aceitam atraso

- **De onde veio:** [PostgreSQL 16, 41.3 Materialized Views](https://www.postgresql.org/docs/16/rules-materializedviews.html) e [REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/16/sql-refreshmaterializedview.html) (`CONCURRENTLY` exige índice único).
- **O que eu acredito que ganharia:** a mesma leitura rápida, sem custo na escrita, em troca de dados com até N minutos de atraso. Só vale se o negócio aceitar esse atraso no relatório, o que muda o que a API devolve logo depois de uma venda.
- **Como testaria:** MV para top-produtos e vendas-por-dia, `REFRESH ... CONCURRENTLY` a cada 5 min, medir o custo do refresh e comparar com o teste 1.
- **O que precisaria:** a decisão de negócio sobre o atraso aceitável.

### 11. Triggers por comando (*transition tables*) para escritas em lote

- **De onde veio:** [PostgreSQL 16, 43.10](https://www.postgresql.org/docs/16/plpgsql-trigger.html): "This can be significantly faster than the row-trigger approach when the invoking statement has modified many rows."
- **O que eu acredito que ganharia:** cargas e cancelamentos em massa mais rápidos que com os triggers por linha usados aqui.
- **Como testaria:** reescrever os triggers com `REFERENCING NEW TABLE`, rodar o `testes/resumos.sql` e medir uma inserção de 10 mil itens com cada versão.
- **O que precisaria:** só tempo.

### 12. Paginação por *keyset* numa versão nova da API

- **De onde veio:** [Winand, No Offset](https://use-the-index-luke.com/no-offset); [GitLab, Pagination guidelines](https://docs.gitlab.com/development/database/pagination_guidelines/).
- **O que eu acredito que ganharia:** páginas de custo constante, mesmo as distantes. **Muda o contrato** (troca `pagina` por um cursor), então não cabe neste desafio; seria uma rota nova, com a antiga mantida.
- **Como testaria:** `GET /v2/pedidos?status=&depois_de=` com `WHERE (criado_em, id) < ($1, $2)`, medir páginas 1 e 1000.
- **O que precisaria:** acordo com quem consome a API.

### 13. E-mail ainda aparece no log (na URL)

- **De onde veio:** [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html); [LGPD, art. 6º, III](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
- **O que eu acredito que ganharia:** não é desempenho. A mudança 13 tirou o corpo do log, mas `GET /clientes?email=...` ainda grava o e-mail na URL.
- **Como testaria:** mascarar a query string das rotas com dados pessoais no middleware e conferir uma amostra de `docker compose logs api`.
- **O que precisaria:** nada.

## Descartadas com evidência

- **JIT do PostgreSQL** ([PostgreSQL 16, 32.2 When to JIT?](https://www.postgresql.org/docs/16/jit-decision.html)): nenhum plano da linha de base teve seção JIT. O maior custo estimado entre as consultas foi 62.594 (top-produtos, 57.087), abaixo do `jit_above_cost` padrão de 100000 ([diagnostico/00-linha-de-base/explain.txt](diagnostico/00-linha-de-base/explain.txt) e [ambiente.txt](diagnostico/00-linha-de-base/ambiente.txt)), então desligar o JIT não mudaria nada.
- **Cluster de processos Node** ([Node.js, Cluster](https://nodejs.org/api/cluster.html)): o limite da API é 0,5 CPU; mais processos disputariam a mesma fatia. Só faria sentido junto com mais CPU, o que é custo.
- **Busca full-text (`tsvector`)** ([PostgreSQL 16, 12.1](https://www.postgresql.org/docs/16/textsearch-intro.html)): casa por palavra normalizada, não por substring, então mudaria o resultado de `ILIKE '%termo%'` e quebraria o contrato.
