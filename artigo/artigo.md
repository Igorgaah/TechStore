# O banco refazia trabalho a cada chamada: sem mais máquina, a API passou a atender 85× mais requisições

## 1. Resumo

A API de uma loja (Node.js + PostgreSQL) atendia 2,34 requisições por segundo (req/s), e 5% das respostas passavam de 27 s (o p95), com o banco saturado. O diagnóstico achou varreduras de tabela inteira por falta de índice, uma conexão por consulta, consultas em laço (N+1), consulta paralela num banco de 1 CPU e relatórios recalculados a cada chamada. Quatorze mudanças medidas uma a uma levaram a 199 req/s e p95 de 178 ms, com os mesmos recursos e respostas (790 URLs conferidas). Com metade da CPU do banco: 178 req/s (110, com muito ruído, na versão final).

## 2. Contexto e diagnóstico

A carga do desafio simula 20 usuários virtuais (VUs) que chamam, sem pausa, sete rotas de leitura da API. Na linha de base, o banco usava 95% da sua CPU, e a API usava 10% de 1 CPU, com limite de 50% ([analise/medianas.md](../analise/medianas.md)). Um coletor (`diagnostico/coletar.sh`) salva o plano de cada consulta e o que o banco executa sob a mesma carga. Na linha de base ([diagnostico/00-linha-de-base](../diagnostico/00-linha-de-base/)):

- só havia índices nas chaves primárias. A busca de itens por pedido tomava 40,5% do tempo do banco ([carga-consultas.txt](../diagnostico/00-linha-de-base/carga-consultas.txt)), e a tabela de itens foi lida inteira 152 vezes em ~70 s ([carga-tabelas.txt](../diagnostico/00-linha-de-base/carga-tabelas.txt));
- "pedidos do cliente" fazia 2 consultas fixas e mais uma por pedido e por item, cada uma com uma conexão nova: 17 para o cliente 42 ([consultas-por-rota.txt](../diagnostico/00-linha-de-base/consultas-por-rota.txt)). Uma conexão nova custava 5,9× uma reaproveitada ([custo-conexao.txt](../diagnostico/00-linha-de-base/custo-conexao.txt));
- top-produtos levava 3,9 s com o banco ocioso, e os planos usavam 2 processos paralelos num banco de 1 CPU ([explain.txt](../diagnostico/00-linha-de-base/explain.txt));
- havia em média 14 sessões disputando 1 CPU ([carga-atividade.txt](../diagnostico/00-linha-de-base/carga-atividade.txt)), e cada requisição gerava ~1,1 KB de log com nome e e-mail ([log-api.txt](../diagnostico/00-linha-de-base/log-api.txt)).

Hipótese de causa:

- falta de índice força varreduras completas;
- a conexão por consulta cria um processo novo no banco a cada consulta;
- o N+1 faz uma ida ao banco por item;
- os relatórios refazem a soma de 1,5 milhão de itens, e as contagens percorrem até 300 mil pedidos, a cada chamada;
- a consulta paralela, sem CPU livre, só acrescenta coordenação;
- o log com o corpo da resposta gasta CPU e grava dados pessoais.

## 3. Estado da arte

### Índices certos para cada consulta

Índice é uma estrutura auxiliar, como o índice remissivo de um livro, que evita ler a tabela inteira. Declarar uma chave estrangeira (FK) não cria índice na coluna que referencia [1]. Uma consulta com `lower(email) = ...` pode usar um índice sobre o resultado de `lower()`, mais caro de manter na escrita [2]. Um índice B-tree entrega as linhas ordenadas [3] e pode responder quase sem ler a tabela, o que compensa quando boa parte dela está marcada como visível para todas as transações [4]. O `pg_trgm` indexa trechos de 3 letras e atende `ILIKE '%termo%'`, busca de trecho sem diferenciar maiúsculas [5]. Num estudo de 12 aplicações web, índice ausente foi o problema mais relatado, embora raro nas versões recentes [6].

### Menos idas ao banco

Abrir uma conexão exige um *handshake* que pode levar 20–30 ms [7], e o PostgreSQL cria um processo por conexão [8]; um *pool* mantém conexões abertas e as reaproveita. No PgBouncer em modo *transaction*, `SET` e `PREPARE` em SQL não funcionam [9], e em geral esse modo impede recursos de sessão [10]. Chen et al. tratam o processamento "um a um" em laço (o N+1) como anti-padrão resolvido em lote; num dos sistemas, a avaliação deles estimou 20–32% a menos de tempo de resposta nas suítes com efeito significativo [11].

### Pré-calcular o que é muito lido e pouco escrito

Cada transação enxerga a sua versão das linhas (MVCC), então `count(*)` precisa visitar as linhas para saber quais contam [12]. Um *trigger*, código que o banco roda a cada escrita, pode manter uma tabela de resumo que responde certas consultas "often with vastly reduced run times" [13], com custo na escrita: num teste, inserções com trigger de contagem ficaram 50× mais lentas [14]. Uma *materialized view*, resultado salvo como tabela, fica desatualizada até o próximo refresh [15], e um cache-aside não garante consistência com o banco [16].

### Paginação

Como o `OFFSET` percorre e descarta as linhas puladas [17], buscar primeiro só os ids da página foi 2,7× mais rápido num caso em Rails; por fazer 2 consultas, deve ser um pouco mais lento nas primeiras páginas [18]. A paginação por *keyset* (a partir da última chave vista) evita o OFFSET, mas não salta para uma página qualquer [19].

### Recursos, custo e medição

Um limite de CPU no Docker é um teto: com 0,5, o container usa no máximo meia CPU por segundo [20]. O AWS Fargate, serviço de containers da AWS, cobra por vCPU e GB por segundo [21]. Uma consulta paralela pode usar várias vezes mais CPU no total [22]. Num gerador de carga fechado (usuários fixos, como aqui), a carga diminui quando o sistema demora; se o tráfego real for aberto, o tempo de resposta medido pode sair muito subestimado [23][24]. E três repetições não bastam para um intervalo de confiança [25].

## 4. Alternativas consideradas

| Alternativa | Custo | Desempenho | Risco | Esforço |
|---|---|---|---|---|
| Índices (FK, expressão, composto, trigramas) | Disco: o banco foi de 294 para ~410 MB com índices e resumos ([00](../diagnostico/00-linha-de-base/ambiente.txt), [15](../diagnostico/15-banco-meia-cpu/ambiente.txt)); escrita mais lenta (índices de expressão custam mais [2]) | Alto nas rotas filtradas | Baixo no contrato; em produção, sem `CONCURRENTLY` o índice bloqueia escritas enquanto é criado [26] | Baixo |
| Pool de conexões na API | Nenhum | Alto | Baixo | Baixo |
| PgBouncer como serviço novo | Mais um container | Opinião: parecido com o pool, com 1 instância da API | Médio: modo transaction limita recursos de sessão [9] | Médio |
| Reescrever consultas (JOIN no lugar do N+1, agregação no banco, ids da página pelo índice) | Nenhum | Alto nas rotas afetadas | Médio: precisa devolver exatamente o mesmo | Médio |
| Resumos mantidos por trigger | Escrita mais lenta [14]; linhas disputadas | Leitura de poucas linhas | Médio: defeito no trigger corrompe o resumo | Alto |
| Materialized view + refresh periódico | Refresh recalcula tudo | Leitura de poucas linhas | Dados atrasados [15] | Médio |
| Cache na API | Memória; invalidação | Opinião: alto só se as chaves se repetem | Inconsistência [16] | Baixo |
| Desligar a consulta paralela | Nenhum | Opinião: alto com 1 CPU e muitas sessões | Baixo | Muito baixo |
| Mais CPU e memória | Cresce com o recurso [21] | Opinião (não medido): o banco faria o mesmo trabalho mais rápido | Baixo | Baixo |
| Reduzir limites depois de otimizar | Menor | Cai se o limite ficar perto do uso | Médio: sem folga, varia mais | Baixo |
| Paginação por keyset | Nenhum | Opinião: alto em páginas distantes | Quebra o contrato (`pagina`) [19] | Médio |

Fiquei com o que ataca a causa com baixo risco: índices, pool, consultas reescritas e paralelismo desligado. Os resumos, com esforço maior, entraram só onde a consulta não tinha como ficar barata, porque soma tudo a cada chamada. Ficaram de fora as opções que mudam o contrato (keyset) e as que mudam o que a API devolve depois de uma escrita (materialized view, cache). O cache tem ainda um problema específico deste teste: a carga sorteia só 12 termos de busca e 1 URL de top-produtos, então a taxa de acerto seria artificialmente alta e o ganho não representaria uso real. Opinião: recurso extra só faria o banco refazer o mesmo trabalho inútil mais depressa.

## 5. Solução escolhida e por quê

Tirei o trabalho desnecessário de onde ele acontecia, uma mudança por vez, na ordem que o diagnóstico apontava, sem serviço novo nem recurso extra. Para contagens e relatórios usei resumos mantidos por trigger, porque a pergunta-guia pede "sem mudar o que ela faz", e o trigger roda na mesma transação da escrita: o ROLLBACK de `testes/resumos.sql` desfaz também os resumos. Vendas-por-dia guarda totais **por pedido**, não por dia. Uma linha por dia faria todas as gravações de pedido do dia disputarem a mesma linha, e uma transação esperaria a outra [27]. Na contagem por status, aceitei essa disputa (4 linhas) por falta de alternativa exata barata e deixei o risco como o teste futuro 1. Opinião: com uma instância da API, o PgBouncer não acrescentaria nada ao pool.

Numa empresa como a T4H, isso iria para produção com `CREATE INDEX CONCURRENTLY` [26], com os resumos criados com o trigger já ativo e preenchidos em lotes. Cada mudança tem o seu commit; as que se sobrepõem (03, 08, 14 e 16; 07 e 14) teriam de ser revertidas juntas.

## 6. Experimento e resultado

"Antes" é a mudança anterior. p95 é o tempo abaixo do qual ficam 95% das respostas. Cada número é a mediana de 3 execuções; a CPU (% de 1 CPU) vem do `recursos.csv`. Há **ganho claro** numa métrica quando as faixas das 3 execuções não se sobrepõem (detalhes em [experimentos.md](../experimentos.md)).

<!-- tabela-artigo:inicio -->
| Mudança | Hipótese | p95 antes → depois | req/s antes → depois | CPU/memória depois (banco · API; % de 1 CPU, MiB) | Pastas de resultados | Conclusão |
|---|---|---|---|---|---|---|
| 00-linha-de-base | – | – | – | 95% · 10%; 385 · 30 | [1](../resultados/20261107-015412-00-linha-de-base/resumo.txt) [2](../resultados/20261107-015607-00-linha-de-base/resumo.txt) [3](../resultados/20261107-015813-00-linha-de-base/resumo.txt) | Banco saturado, API ociosa |
| 01-indices-fk | FKs sem índice forçam varredura → índice reduz p95 e CPU | 27.087 → 26.252 ms | 2,34 → 2,40 | 104% · 14%; 368 · 37 | [1](../resultados/20261107-020845-01-indices-fk/resumo.txt) [2](../resultados/20261107-021059-01-indices-fk/resumo.txt) [3](../resultados/20261107-021309-01-indices-fk/resumo.txt) | **Sem ganho claro.** Resolveu a consulta-alvo, mas o banco seguiu saturado pelas outras |
| 02-indice-status | Ordenar 300 mil linhas em disco → índice ordenado reduz p95 da página | 26.252 → 18.355 ms | 2,40 → 3,85 | 102% · 19%; 432 · 34 | [1](../resultados/20261107-025201-02-indice-status/resumo.txt) [2](../resultados/20261107-025411-02-indice-status/resumo.txt) [3](../resultados/20261107-025629-02-indice-status/resumo.txt) | **Ganho claro em req/s nesta série; provável com a série descartada.** p95 da página 4× menor; ganho geral provável (ressalva em experimentos.md) |
| 03-resumo-top-produtos | Agregar 1,5 mi de itens por chamada → resumo reduz p95 de top-produtos | 18.355 → 16.565 ms | 3,85 → 3,99 | 107% · 22%; 444 · 34 | [1](../resultados/20261107-024245-03-resumo-top-produtos/resumo.txt) [2](../resultados/20261107-024438-03-resumo-top-produtos/resumo.txt) [3](../resultados/20261107-024630-03-resumo-top-produtos/resumo.txt) | **Sem ganho claro.** Rota 20× mais rápida; peso pequeno na carga (2%) |
| 04-indice-dia | Cast na coluna impede índice → índice na expressão reduz p95 de vendas | 16.565 → 17.877 ms | 3,99 → 4,10 | 110% · 23%; 412 · 33 | [1](../resultados/20261107-030242-04-indice-dia/resumo.txt) [2](../resultados/20261107-030438-04-indice-dia/resumo.txt) [3](../resultados/20261107-030630-04-indice-dia/resumo.txt) | **Sem ganho claro.** Plano certo, efeito geral escondido pelo ruído |
| 05-pool-conexoes | Conexão nova custa ~6× → pool reduz CPU por requisição | 17.877 → 7.084 ms | 4,10 → 10,68 | 101% · 37%; 463 · 35 | [1](../resultados/20261107-082338-05-pool-conexoes/resumo.txt) [2](../resultados/20261107-082533-05-pool-conexoes/resumo.txt) [3](../resultados/20261107-082725-05-pool-conexoes/resumo.txt) | **Ganho claro em req/s e p95.** Maior salto até aqui; 17 → 0 conexões novas em pedidos-do-cliente |
| 06-indice-email | lower(email) varre 100 mil linhas → índice de expressão reduz p95 | 7.084 → 4.804 ms | 10,68 → 16,52 | 87% · 43%; 460 · 33 | [1](../resultados/20261107-083735-06-indice-email/resumo.txt) [2](../resultados/20261107-083927-06-indice-email/resumo.txt) [3](../resultados/20261107-084117-06-indice-email/resumo.txt) | **Ganho claro em req/s (p95 sem ganho claro).** API começa a encostar no limite |
| 07-vendas-agregado-sql | ~13 mil linhas por chamada para o Node → GROUP BY reduz CPU da API | 4.804 → 3.702 ms | 16,52 → 19,89 | 103% · 16%; 457 · 25 | [1](../resultados/20261107-084436-07-vendas-agregado-sql/resumo.txt) [2](../resultados/20261107-084633-07-vendas-agregado-sql/resumo.txt) [3](../resultados/20261107-084825-07-vendas-agregado-sql/resumo.txt) | **Sem ganho claro.** CPU da API por requisição 3,4× menor; banco segue o gargalo |
| 08-contagem-status | count(*) percorre até 300 mil entradas → contagem pronta aumenta req/s | 3.702 → 1.856 ms | 19,89 → 40,84 | 101% · 24%; 464 · 27 | [1](../resultados/20261107-085516-08-contagem-status/resumo.txt) [2](../resultados/20261107-085655-08-contagem-status/resumo.txt) [3](../resultados/20261107-085835-08-contagem-status/resumo.txt) | **Ganho claro em req/s e p95.** Dobrou o req/s; o custo vai para a escrita |
| 09-pagina-deferred-join | OFFSET lê linhas descartadas → ids pelo índice reduzem p95 da página | 1.856 → 2.104 ms | 40,84 → 36,73 | 104% · 24%; 461 · 26 | [1](../resultados/20261107-092522-09-pagina-deferred-join/resumo.txt) [2](../resultados/20261107-092705-09-pagina-deferred-join/resumo.txt) [3](../resultados/20261107-092849-09-pagina-deferred-join/resumo.txt) | **Sem ganho claro.** Rota 2,9× melhor; geral dentro do ruído |
| 10-pedidos-cliente-join | 17 idas sequenciais ao banco → 1 consulta reduz p95 da rota | 2.104 → 1.130 ms | 36,73 → 45,10 | 104% · 16%; 470 · 26 | [1](../resultados/20261107-094122-10-pedidos-cliente-join/resumo.txt) [2](../resultados/20261107-094303-10-pedidos-cliente-join/resumo.txt) [3](../resultados/20261107-094444-10-pedidos-cliente-join/resumo.txt) | **Ganho claro em p95 (req/s sem ganho claro).** p95 geral quase pela metade |
| 11-sem-paralelismo | Workers paralelos sem CPU livre → desligar aumenta req/s | 1.130 → 595 ms | 45,10 → 82,98 | 104% · 23%; 482 · 27 | [1](../resultados/20261107-095534-11-sem-paralelismo/resumo.txt) [2](../resultados/20261107-095715-11-sem-paralelismo/resumo.txt) [3](../resultados/20261107-095855-11-sem-paralelismo/resumo.txt) | **Ganho claro em req/s e p95.** Uma linha de configuração, ~1,8× mais req/s |
| 12-indice-trigramas | ILIKE varre 20 mil nomes → trigramas reduzem p95 da busca | 595 → 391 ms | 82,98 → 130,47 | 103% · 38%; 477 · 27 | [1](../resultados/20261107-100352-12-indice-trigramas/resumo.txt) [2](../resultados/20261107-100528-12-indice-trigramas/resumo.txt) [3](../resultados/20261107-100705-12-indice-trigramas/resumo.txt) | **Ganho claro em req/s e p95.** Execuções estáveis |
| 13-log-sem-corpo | Log síncrono do corpo → sem corpo, menos CPU da API | 391 → 400 ms | 130,47 → 130,38 | 98% · 36%; 473 · 27 | [1](../resultados/20261107-101229-13-log-sem-corpo/resumo.txt) [2](../resultados/20261107-101412-13-log-sem-corpo/resumo.txt) [3](../resultados/20261107-101552-13-log-sem-corpo/resumo.txt) | **Sem ganho claro.** Hipótese refutada; log ~14× menor, sem o corpo das respostas |
| 14-totais-pedido | JOIN de ~13 mil itens por chamada → totais por pedido aumentam req/s | 400 → 178 ms | 130,38 → 199,07 | 42% · 49%; 459 · 27 | [1](../resultados/20261107-102849-14-totais-pedido/resumo.txt) [2](../resultados/20261107-103032-14-totais-pedido/resumo.txt) [3](../resultados/20261107-103211-14-totais-pedido/resumo.txt) | **Ganho claro em req/s e p95.** Banco deixa de ser gargalo; a API vira o limite |
| 15-banco-meia-cpu | Banco usa ~0,42 de 1 CPU → 0,5 CPU custa pouco req/s | 178 → 201 ms | 199,07 → 177,56 | 41% · 46%; 422 · 27 | [1](../resultados/20261107-103825-15-banco-meia-cpu/resumo.txt) [2](../resultados/20261107-104003-15-banco-meia-cpu/resumo.txt) [3](../resultados/20261107-104142-15-banco-meia-cpu/resumo.txt) | **Troca custo × desempenho (sem ganho claro).** −33% de CPU alocada por −11% de req/s |
| 16-triggers-corrigidos | Triggers só rodam em escrita → req/s e p95 não mudam | 201 → 429 ms | 177,56 → 109,57 | 50% · 27%; 372 · 27 | [1](../resultados/20261107-122052-16-triggers-corrigidos/resumo.txt) [2](../resultados/20261107-122232-16-triggers-corrigidos/resumo.txt) [3](../resultados/20261107-122417-16-triggers-corrigidos/resumo.txt) | **Sem diferença clara (era o esperado).** Corrige 3 defeitos de escrita; leitura igual (dentro do ruído) |
| **00 → 14** | Todas as mudanças de desempenho | **27.087 → 178 ms** | **2,34 → 199,07** | 95% · 10% → 42% · 49% | – | req/s 85,0×, p95 152,4× menor |
<!-- tabela-artigo:fim -->

![Requisições por segundo a cada mudança, mediana de 3 execuções, escala logarítmica](img/req-por-segundo.svg)

![Tempo de resposta p95 a cada mudança, mediana de 3 execuções, escala logarítmica](img/p95.svg)

Nas mudanças 01, 03, 04 e 09, a rota-alvo melhorou (p50 na 01, p95 nas outras, em [analise/medianas.md](../analise/medianas.md)), mas o req/s geral não: com o banco saturado, a fila passava para a próxima consulta pesada. A fatia de tempo do `pg_stat_statements`, que inclui espera por CPU, não previu esses efeitos. Desde a 10, pesei também o custo de cada consulta com o banco ocioso. A 07 cortou a CPU da API, não o req/s. A 13 refutou a premissa de escrita síncrona: o stdout do container é um *pipe* ([ambiente-host.txt](../diagnostico/ambiente-host.txt)), assíncrono em POSIX [28]. Ela ficou porque tira do log o corpo das respostas, com nomes e e-mails [29][30]. A 16 corrigiu três defeitos dos triggers que só aparecem com escrita.

Pelas tarifas do Fargate [21], o custo estimado por milhão de requisições cai de US$ 7,60 para US$ 0,09 (14) e US$ 0,07 (15). É eficiência, não fatura: com os mesmos limites, a hora custa o mesmo de 00 a 14, e só a 15 a reduz, em 32%.

## 7. Limites e testes futuros

- **Ruído:** um jogo ocupava ~2 dos 4 núcleos do host (amostra às 11:00, entre as séries 15 e 16: [host-cpu.txt](../diagnostico/host-cpu.txt)). Uma mesma configuração chegou a variar 3,6× (16), então ganhos pequenos podem ser ruído [25].
- **Escrita não medida:** a carga só lê. Os triggers podem atrasar gravações e dar deadlock ([deadlock.txt](../diagnostico/16-triggers-corrigidos/deadlock.txt)), e um DELETE de pedido junto com os itens no mesmo comando não é descontado de top-produtos. O e-mail ainda aparece no log, na URL.
- **Modelo fechado:** com chegadas abertas, a latência na mesma vazão pode ser pior [23].
- **Memória e folga:** logo após um reinício, 39,5% do tempo ativo do banco era espera por disco ([carga-atividade.txt](../diagnostico/16-triggers-corrigidos/carga-atividade.txt)); com 0,5 CPU, o banco fica sem folga.

O que derrubaria a conclusão: gravações reais em que os triggers atrasem pedidos (teste 1), um p95 inaceitável com chegadas abertas perto de 150 req/s (teste 2), ou a linha de base com mais CPU chegando perto de 199 req/s (teste 17). Esses testes e as ideias não testadas (log assíncrono, perfil de CPU da API, memória, PgBouncer, cache, keyset) estão em [proximos-testes.md](../proximos-testes.md).

## 8. Referências

Citações literais e a verificação de cada fonte estão em [pesquisa/fontes.md](../pesquisa/fontes.md).

1. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 5.4. Constraints (5.4.5 Foreign Keys)*. https://www.postgresql.org/docs/16/ddl-constraints.html. Acesso em: 07/11/2026.
2. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 11.7. Indexes on Expressions*. https://www.postgresql.org/docs/16/indexes-expressional.html. Acesso em: 07/11/2026.
3. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 11.4. Indexes and ORDER BY*. https://www.postgresql.org/docs/16/indexes-ordering.html. Acesso em: 07/11/2026.
4. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 11.9. Index-Only Scans and Covering Indexes*. https://www.postgresql.org/docs/16/indexes-index-only-scans.html. Acesso em: 07/11/2026.
5. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, F.35. pg_trgm*. https://www.postgresql.org/docs/16/pgtrgm.html. Acesso em: 07/11/2026.
6. Yang, J.; Subramaniam, P.; Lu, S.; Yan, C.; Cheung, A. *How not to structure your database-backed web applications: a study of performance bugs in the wild*. ICSE 2018, p. 800–810. DOI 10.1145/3180155.3180194. https://par.nsf.gov/servlets/purl/10067547. Acesso em: 07/11/2026.
7. Carlson, B. (node-postgres). *Pooling*. https://node-postgres.com/features/pooling. Acesso em: 07/11/2026.
8. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 52.2. How Connections Are Established*. https://www.postgresql.org/docs/16/connect-estab.html. Acesso em: 07/11/2026.
9. PgBouncer. *PgBouncer features*. https://www.pgbouncer.org/features.html. Acesso em: 07/11/2026.
10. Freund, A. *Analyzing the Limits of Connection Scalability in Postgres*. Microsoft Tech Community, 2020. https://techcommunity.microsoft.com/blog/adforpostgresql/analyzing-the-limits-of-connection-scalability-in-postgres/1757266. Acesso em: 07/11/2026.
11. Chen, T.-H.; Shang, W.; Jiang, Z. M.; Hassan, A. E.; Nasser, M.; Flora, P. *Detecting Performance Anti-patterns for Applications Developed using Object-Relational Mapping*. ICSE 2014, p. 1001–1012. DOI 10.1145/2568225.2568259. https://petertsehsun.github.io/papers/peter_icse2014.pdf. Acesso em: 07/11/2026.
12. PostgreSQL Wiki. *Slow Counting*. https://wiki.postgresql.org/wiki/Slow_Counting. Acesso em: 07/11/2026.
13. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 43.10. Trigger Functions*. https://www.postgresql.org/docs/16/plpgsql-trigger.html. Acesso em: 07/11/2026.
14. Nelson, J. *Faster PostgreSQL Counting*. Citus Data, 2016. https://www.citusdata.com/blog/2016/10/12/count-performance/. Acesso em: 07/11/2026.
15. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 41.3. Materialized Views*. https://www.postgresql.org/docs/16/rules-materializedviews.html. Acesso em: 07/11/2026.
16. Microsoft. *Cache-Aside pattern*. Azure Architecture Center. https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside. Acesso em: 07/11/2026.
17. GitLab. *Pagination guidelines*. https://docs.gitlab.com/development/database/pagination_guidelines/. Acesso em: 07/11/2026.
18. Coutermarsh, M. *Introducing FastPage: Faster offset pagination for Rails apps*. PlanetScale, 2022. https://planetscale.com/blog/fastpage-faster-offset-pagination-for-rails-apps. Acesso em: 07/11/2026.
19. Winand, M. *We need tool support for keyset pagination (No Offset)*. Use The Index, Luke! https://use-the-index-luke.com/no-offset. Acesso em: 07/11/2026.
20. Docker Inc. *Resource constraints*. https://docs.docker.com/engine/containers/resource_constraints/. Acesso em: 07/11/2026.
21. Amazon Web Services. *AWS Fargate Pricing* (Linux/x86, US East). https://aws.amazon.com/fargate/pricing/. Acesso em: 07/11/2026.
22. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 20.4. Resource Consumption*. https://www.postgresql.org/docs/16/runtime-config-resource.html. Acesso em: 07/11/2026.
23. Schroeder, B.; Wierman, A.; Harchol-Balter, M. *Open Versus Closed: A Cautionary Tale*. USENIX NSDI 2006. https://www.usenix.org/legacy/events/nsdi06/tech/full_papers/schroeder/schroeder_html/index.html. Acesso em: 07/11/2026.
24. Grafana Labs. *Open and closed models* (k6). https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/. Acesso em: 07/11/2026.
25. Uta, A. et al. *Is Big Data Performance Reproducible in Modern Cloud Networks?* USENIX NSDI 2020. https://www.usenix.org/system/files/nsdi20-paper-uta.pdf. Acesso em: 07/11/2026.
26. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, CREATE INDEX (Building Indexes Concurrently)*. https://www.postgresql.org/docs/16/sql-createindex.html. Acesso em: 07/11/2026.
27. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation, 13.3. Explicit Locking (13.3.2 Row-Level Locks)*. https://www.postgresql.org/docs/16/explicit-locking.html. Acesso em: 07/11/2026.
28. OpenJS Foundation. *Node.js v20 Documentation, Process: A note on process I/O*. https://nodejs.org/docs/latest-v20.x/api/process.html. Acesso em: 07/11/2026.
29. OWASP. *Logging Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html. Acesso em: 07/11/2026.
30. Brasil. *Lei nº 13.709, de 14 de agosto de 2018 (LGPD)*, art. 6º, III. https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm. Acesso em: 07/11/2026.

## 9. Uso de IA

O Claude Code (Anthropic, Claude Opus 5.5) rodou as medições, escreveu o código e redigiu os textos sob minha direção; dois agentes por tema pesquisaram as fontes e conferiram as citações. Verificação: números gerados por script a partir de `resultados/`, respostas conferidas pelo contrato e em 790 URLs, citações checadas em [pesquisa/fontes.md](../pesquisa/fontes.md).
