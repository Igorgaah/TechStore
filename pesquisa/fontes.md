# Fontes pesquisadas

Todas as fontes abaixo foram abertas em 2026-11-07. A pesquisa foi feita com agentes de IA (Claude Code) em duas etapas independentes: um agente abria cada fonte e copiava trechos **literais**; um segundo agente, instruído a refutar, abria de novo cada URL e conferia título, autor e cada citação. Só entram aqui fontes confirmadas; quando o verificador encontrou diferença (título, trecho cortado, contexto), a correção dele aparece logo abaixo e é o texto que vale. Fontes que não abriram (HTTP 403, PDF ilegível) foram descartadas ou trocadas.

O artigo cita um subconjunto destas fontes. Fato (o que a fonte diz) fica nas citações; a avaliação de aplicabilidade é opinião e está marcada como tal.

Total: 81 fontes distintas (52 de documentação oficial, 10 de técnica primária, 7 de acadêmica, 6 de blog técnico, 6 de caso de mercado).

## 1. Índices, consultas e paginação

### PostgreSQL 16 Documentation - 5.4. Constraints (5.4.5 Foreign Keys)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/ddl-constraints.html>
- **Sustenta:** Criar índice na coluna que referencia (FK) explicitamente, porque o PostgreSQL não cria esse índice ao declarar a FOREIGN KEY.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Since a DELETE of a row from the referenced table or an UPDATE of a referenced column will require a scan of the referencing table for rows matching the old value, it is often a good idea to index the referencing columns too." (5.4.5 Foreign Keys): A coluna referenciada sempre tem índice (PK/UNIQUE), mas a coluna que referencia não; DELETE/UPDATE na tabela referenciada exige varrer a tabela que referencia, e por isso costuma valer a pena indexá-la.
  - "Because this is not always needed, and there are many choices available on how to index, the declaration of a foreign key constraint does not automatically create an index on the referencing columns." (5.4.5 Foreign Keys): Declarar uma FK não cria índice automaticamente na coluna que referencia.
- **Custo ou risco segundo a fonte:** A doc diz que o índice nem sempre é necessário e que há várias formas de indexar; a escolha fica com o projetista.
- **Opinião (aplicabilidade aqui):** aplica-se diretamente. pedidos.cliente_id (filtro de /clientes/:id/pedidos) e itens_pedido.pedido_id (busca dos itens e JOIN dos relatórios) estão sem índice. É a correção de maior retorno e menor risco do grupo, e não mexe no contrato.

### PostgreSQL 16 Documentation - 11.7. Indexes on Expressions

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/indexes-expressional.html>
- **Sustenta:** Índice de expressão (ex.: lower(col)) para comparações case-insensitive ou expressões sobre a coluna, sem reescrever a consulta.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "This query can use an index if one has been defined on the result of the lower(col1) function" (11.7): Uma consulta com WHERE lower(col1) = 'value' pode usar um índice definido sobre lower(col1).
  - "Index expressions are relatively expensive to maintain, because the derived expression(s) must be computed for each row insertion and non-HOT update." (11.7): Índices de expressão custam mais para manter: a expressão é recalculada a cada INSERT e a cada UPDATE não-HOT, mas não durante a busca.
  - "Thus, indexes on expressions are useful when retrieval speed is more important than insertion and update speed." (11.7): Valem a pena quando a velocidade de leitura importa mais que a de escrita.
- **Custo ou risco segundo a fonte:** Manutenção mais cara a cada inserção e UPDATE não-HOT.
- **Opinião (aplicabilidade aqui):** é a solução de menor esforço para GET /clientes?email=. Basta CREATE INDEX ON clientes (lower(email)), sem tocar no SQL, porque a consulta já usa lower(email) = lower($1). A API não escreve, então o custo de escrita é irrelevante aqui.

### Case-insensitive search using UPPER or LOWER (Use The Index, Luke!)

- **Autor/organização:** Markus Winand (Use The Index, Luke! / SQL Performance Explained) (s.d. (livro online))
- **Tipo:** blog técnico
- **Link:** <https://use-the-index-luke.com/sql/where-clause/functions/case-insensitive-search>
- **Sustenta:** Índice baseado em função (function-based index) com exatamente a mesma expressão usada no WHERE.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Although there is an index on LAST_NAME, it is unusable—because the search is not on LAST_NAME but on UPPER(LAST_NAME)." (Case-insensitive search): Um índice comum na coluna não serve quando a busca aplica uma função sobre ela.
  - "The database can use a function-based index if the exact expression of the index definition appears in an SQL statement." (Case-insensitive search): O índice de função guarda o resultado da função, e o banco só o usa se a expressão exata aparecer na consulta.
- **Custo ou risco segundo a fonte:** A expressão da consulta tem de ser idêntica à do índice; caso contrário o índice é ignorado.
- **Correção do verificador:** Título da página: 'Case-Insensitive Search in SQL' (seção 'Case-Insensitive Search Using UPPER or LOWER'). Frase completa: 'The database can use a function-based index if the exact expression of the index definition appears in an SQL statement—like in the example above.'
- **Opinião (aplicabilidade aqui):** confirma o índice em lower(email) e lembra que, se alguém trocar lower por upper ou acrescentar trim no SQL, o índice deixa de servir.

### PostgreSQL 16 Documentation - F.10. citext — a case-insensitive character string type

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/citext.html>
- **Sustenta:** Alternativa ao lower(): tipo citext com índice B-tree comum.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "It won't use an index, unless you create a functional index using lower." (F.10.1 Rationale): A abordagem com lower() não usa índice sem um índice funcional em lower.
  - "citext is not as efficient as text because the operator functions and the B-tree comparison functions must make copies of the data and convert it to lower case for comparisons. Also, only text can support B-Tree deduplication. However, citext is slightly more efficient than using lower to get case-insensitive matching." (F.10.4 Limitations): citext é menos eficiente que text, não tem deduplicação B-tree, mas é um pouco mais eficiente que usar lower.
  - "citext's case-folding behavior depends on the LC_CTYPE setting of your database." (F.10.4 Limitations): O case-folding do citext depende do LC_CTYPE do banco.
- **Custo ou risco segundo a fonte:** Depende do LC_CTYPE, não é case-insensitive no sentido Unicode, é menos eficiente que text e perde a deduplicação B-tree.
- **Opinião (aplicabilidade aqui):** exige mudar o schema e a consulta. Ganha pouco sobre o índice de expressão e traz risco semântico, já que o fold do citext pode diferir do lower() em casos não ASCII. Fica como alternativa inferior.

### PostgreSQL 16 Documentation - 5.3. Generated Columns

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/ddl-generated-columns.html>
- **Sustenta:** Coluna gerada armazenada (ex.: lower(email)) com índice B-tree comum, alternativa ao índice de expressão.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "A stored generated column is computed when it is written (inserted or updated) and occupies storage as if it were a normal column." (5.3): A coluna gerada armazenada é calculada na escrita e ocupa espaço como uma coluna normal.
  - "The generation expression can only use immutable functions and cannot use subqueries or reference anything other than the current row in any way." (5.3): A expressão de geração só pode usar funções imutáveis e referenciar a própria linha.
- **Custo ou risco segundo a fonte:** Ocupa armazenamento como uma coluna normal e não pode ser escrita diretamente.
- **Opinião (aplicabilidade aqui):** funciona, mas guarda o dado em duplicidade e obriga a mudar o SQL. Também faz SELECT * trazer uma coluna extra, que a rota descarta porque formatarCliente só mapeia os campos do contrato. Não traz vantagem sobre o índice de expressão neste caso.

### PostgreSQL 16 Documentation - 11.4. Indexes and ORDER BY

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/indexes-ordering.html>
- **Sustenta:** Índice B-tree cuja ordem casa com o ORDER BY, permitindo devolver as primeiras n linhas sem ordenar tudo (ORDER BY + LIMIT).
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "An important special case is ORDER BY in combination with LIMIT n: an explicit sort will have to process all the data to identify the first n rows, but if there is an index matching the ORDER BY, the first n rows can be retrieved directly, without scanning the remainder at all." (11.4): Com ORDER BY + LIMIT n, um índice que casa com o ORDER BY permite pegar as n primeiras linhas sem processar o resto; sem ele, a ordenação explícita processa todos os dados.
  - "Consider a two-column index on (x, y): this can satisfy ORDER BY x, y if we scan forward, or ORDER BY x DESC, y DESC if we scan backward." (11.4): Um índice (x, y) atende ORDER BY x DESC, y DESC varrendo de trás para frente.
  - "Of the index types currently supported by PostgreSQL, only B-tree can produce sorted output" (11.4): Dos tipos de índice do PostgreSQL, só o B-tree produz saída ordenada.
- **Custo ou risco segundo a fonte:** A doc chama ordenações não padrão de recurso especializado. Índices GIN/GiST não devolvem saída ordenada.
- **Correção do verificador:** Frase completa: 'Of the index types currently supported by PostgreSQL, only B-tree can produce sorted output — the other index types return matching rows in an unspecified, implementation-dependent order.'
- **Opinião (aplicabilidade aqui):** justifica índices em (status, criado_em, id) e (cliente_id, criado_em, id). Como todas as colunas do ORDER BY são DESC, um índice ASC varrido de trás para frente também serve. Importante para (d): um GIN de pg_trgm não elimina o Sort de ORDER BY nome, id.

### PostgreSQL 16 Documentation - 11.3. Multicolumn Indexes

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/indexes-multicolumn.html>
- **Sustenta:** Índice composto com a coluna de igualdade à esquerda (status ou cliente_id) e as colunas de ordenação em seguida.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "The exact rule is that equality constraints on leading columns, plus any inequality constraints on the first column that does not have an equality constraint, will be used to limit the portion of the index that is scanned." (11.3): Igualdades nas colunas iniciais, mais uma desigualdade na primeira coluna sem igualdade, limitam o trecho do índice varrido.
  - "Multicolumn indexes should be used sparingly. In most situations, an index on a single column is sufficient and saves space and time." (11.3): Índices multicoluna devem ser usados com parcimônia.
- **Custo ou risco segundo a fonte:** Índices com muitas colunas raramente ajudam e gastam espaço e tempo; a doc recomenda moderação.
- **Opinião (aplicabilidade aqui):** (status, criado_em DESC, id DESC) tem 3 colunas, dentro do limite que a doc considera útil. O status de igualdade fica na frente.

### PostgreSQL 16 Documentation - 11.9. Index-Only Scans and Covering Indexes

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/indexes-index-only-scans.html>
- **Sustenta:** Index-only scan e índices de cobertura (INCLUDE), que evitam visitar o heap; dependem do visibility map.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "The query must reference only columns stored in the index." (11.9): O index-only scan exige que a consulta referencie só colunas guardadas no índice.
  - "In short, while an index-only scan is possible given the two fundamental requirements, it will be a win only if a significant fraction of the table's heap pages have their all-visible map bits set." (11.9): Só compensa se boa parte das páginas do heap estiver marcada all-visible no visibility map; sem o bit, o heap é visitado de qualquer jeito.
  - "In any case, non-key columns duplicate data from the index's table and bloat the size of the index, thus potentially slowing searches." (11.9): Colunas INCLUDE duplicam dados e incham o índice, o que pode deixar as buscas mais lentas.
- **Custo ou risco segundo a fonte:** O índice fica maior. Se a tupla do índice passar do tamanho máximo, a inserção falha. Não há ganho se a tabela muda muito, porque o heap acaba visitado mesmo assim.
- **Opinião (aplicabilidade aqui):** muito relevante para /pedidos?status=. A rota só devolve id, cliente_id, status e criado_em. Projetando só essas colunas no SQL (em vez de SELECT *, que traz observacoes) e criando (status, criado_em DESC, id DESC) INCLUDE (cliente_id), tanto o count(*) quanto a página com OFFSET podem virar index-only scans. Como a API só lê, o visibility map fica estável depois de um VACUUM pós-carga.

### PostgreSQL 16 Documentation - 25.1. Routine Vacuuming (25.1.4 Updating the Visibility Map; 25.1.6 The Autovacuum Daemon)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/routine-vacuuming.html>
- **Sustenta:** Rodar VACUUM (ANALYZE) depois da carga em massa para preencher o visibility map e as estatísticas, viabilizando index-only scans.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Vacuum maintains a visibility map for each table to keep track of which pages contain only tuples that are known to be visible to all active transactions (and all future transactions, until the page is again modified)." (25.1.4 Updating the Visibility Map): O VACUUM mantém o visibility map, que marca as páginas com tuplas visíveis a todas as transações.
  - "An index-only scan, on the other hand, checks the visibility map first. If it's known that all tuples on the page are visible, the heap fetch can be skipped." (25.1.4 Updating the Visibility Map): O index-only scan consulta o visibility map primeiro e pula o heap quando a página é all-visible.
  - "Such vacuums may allow portions of the table to be marked as all visible and also allow tuples to be frozen, which can reduce the work required in subsequent vacuums." (25.1.6 The Autovacuum Daemon): O autovacuum também roda por limiar de inserções, o que pode marcar páginas como all visible.
- **Custo ou risco segundo a fonte:** A marcação all-visible vale até a página ser modificada de novo.
- **Opinião (aplicabilidade aqui):** depois do 02-dados.sql, um 'VACUUM ANALYZE' explícito evita depender do momento em que o autovacuum roda. Sem isso, a primeira rodada do k6 pode medir index scans com acesso ao heap e não index-only scans, o que aumenta a variação entre execuções (h).

### PostgreSQL 16 Documentation - CREATE INDEX

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/sql-createindex.html>
- **Sustenta:** Regras de criação de índices: imutabilidade de expressões, INCLUDE e CONCURRENTLY.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "All functions and operators used in an index definition must be “immutable”, that is, their results must depend only on their arguments and never on any outside influence (such as the contents of another table or the current time)." (Notes / Description): Funções e operadores em um índice de expressão precisam ser imutáveis.
  - "However, an index-only scan can return the contents of non-key columns without having to visit the index's table, since they are available directly from the index entry." (Parameters - INCLUDE): Com INCLUDE, o index-only scan devolve colunas não-chave sem visitar a tabela.
  - "Other transactions can still read the table, but if they try to insert, update, or delete rows in the table they will block until the index build is finished." (Building Indexes Concurrently; aberta de novo em 2026-11-07): o CREATE INDEX normal bloqueia escritas até terminar.
  - "PostgreSQL supports building indexes without locking out writes." (Building Indexes Concurrently; aberta de novo em 2026-11-07): com CONCURRENTLY, as escritas continuam.
  - "Thus this method requires more total work than a standard index build and takes significantly longer to complete." (Building Indexes Concurrently): CREATE INDEX CONCURRENTLY não bloqueia escritas, mas dá mais trabalho, leva bem mais tempo e, se falhar, deixa um índice inválido.
- **Custo ou risco segundo a fonte:** CONCURRENTLY faz duas varreduras e espera transações, e pode deixar um índice inválido. Expressões não imutáveis são rejeitadas.
- **Opinião (aplicabilidade aqui):** como criado_em é timestamp SEM fuso, o cast criado_em::date é imutável e o índice de expressão ((criado_em::date)) é permitido. Com timestamptz não seria, porque o resultado depende do TimeZone. Em ambiente de desafio sem escrita concorrente, CONCURRENTLY é desnecessário.

### PostgreSQL 16 Documentation - 11.1. Introduction (Indexes)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/indexes-intro.html>
- **Sustenta:** Custo geral dos índices: manutenção em escrita, tempo de criação, bloqueio de escrita e efeito sobre HOT.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "After an index is created, the system has to keep it synchronized with the table. This adds overhead to data manipulation operations." (11.1): Índices precisam ser mantidos sincronizados, o que pesa nas operações de escrita.
  - "Indexes can also prevent the creation of heap-only tuples." (11.1): Índices podem impedir atualizações HOT (heap-only tuples).
  - "Therefore indexes that are seldom or never used in queries should be removed." (11.1): Índices pouco ou nunca usados devem ser removidos.
- **Custo ou risco segundo a fonte:** Overhead em INSERT/UPDATE/DELETE, criação demorada em tabelas grandes e escritas bloqueadas durante o build padrão.
- **Opinião (aplicabilidade aqui):** a API só lê, então o custo de escrita é baixo aqui. Mesmo assim, cada índice ocupa RAM e cache num banco de 512 MB. Convém criar só os índices que o EXPLAIN mostrar em uso e justificar cada um.

### PostgreSQL 16 Documentation - 14.1. Using EXPLAIN

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/using-explain.html>
- **Sustenta:** Validar cada índice com EXPLAIN (ANALYZE, BUFFERS) antes e depois.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "With this option, EXPLAIN actually executes the query, and then displays the true row counts and true run time accumulated within each plan node, along with the same estimates that a plain EXPLAIN shows." (14.1.2 EXPLAIN ANALYZE): EXPLAIN ANALYZE executa a consulta e mostra linhas e tempos reais por nó, ao lado das estimativas.
  - "The numbers provided by BUFFERS help to identify which parts of the query are the most I/O-intensive." (14.1.2 EXPLAIN ANALYZE): BUFFERS mostra quais partes da consulta fazem mais I/O.
  - "First, since no output rows are delivered to the client, network transmission costs and I/O conversion costs are not included. Second, the measurement overhead added by EXPLAIN ANALYZE can be significant, especially on machines with slow gettimeofday() operating-system calls." (14.1.4 Caveats): O tempo do EXPLAIN ANALYZE difere da execução normal: não conta rede nem conversão de saída, e a instrumentação adiciona overhead.
- **Custo ou risco segundo a fonte:** Executa a consulta de verdade, com efeitos colaterais. O tempo medido não é o tempo ponta a ponta.
- **Opinião (aplicabilidade aqui):** use EXPLAIN (ANALYZE, BUFFERS) para provar que cada índice é usado (Index Only Scan, Heap Fetches: 0, sem Sort). O resultado do k6 continua sendo a métrica final, porque o EXPLAIN não mede rede nem serialização.

### Slow Counting (PostgreSQL Wiki)

- **Autor/organização:** PostgreSQL community (wiki.postgresql.org) (s.d. (wiki))
- **Tipo:** técnica primária
- **Link:** <https://wiki.postgresql.org/wiki/Slow_Counting>
- **Sustenta:** Explica por que count(*) é caro (MVCC) e aponta index-only scans e estimativas como alternativas.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "The reason is related to the MVCC implementation in PostgreSQL." (Slow Counting): count(*) é lento por causa do MVCC.
  - "This normally results in a sequential scan reading information about every row in the table." (Slow Counting): Isso normalmente leva a uma varredura sequencial sobre todas as linhas.
- **Custo ou risco segundo a fonte:** Estimativas (reltuples) são rápidas, mas aproximadas.
- **Correção do verificador:** Ano: última edição em 2021-04-10.
- **Opinião (aplicabilidade aqui):** o total por status precisa ser exato porque faz parte do contrato, então estimativas estão fora. Restam o index-only scan sobre o índice por status ou um contador pré-calculado (só 4 status, API só de leitura).

### Date Types: Obfuscated Conditions (Use The Index, Luke!)

- **Autor/organização:** Markus Winand (Use The Index, Luke!) (s.d. (livro online))
- **Tipo:** blog técnico
- **Link:** <https://use-the-index-luke.com/sql/where-clause/obfuscation/dates>
- **Sustenta:** Reescrever o filtro por data como faixa explícita (>= início e < dia seguinte) em vez de aplicar função ou cast à coluna.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "TRUNC(sale_date) is something entirely different from SALE_DATE—functions are black boxes to the database." (Dates): Funções sobre a coluna de data são caixas-pretas para o banco e impedem o uso do índice da coluna.
  - "Always consider using an explicit range condition when comparing dates." (Dates): Recomenda-se comparar datas com condição de faixa explícita.
- **Custo ou risco segundo a fonte:** A fonte alerta que é fácil introduzir bug de limite quando a coluna tem componente de hora, e que é preciso usar limite superior exclusivo.
- **Correção do verificador:** Título: 'Date Types' (capítulo The Where Clause › Obfuscated Conditions); título da página: 'Date and time conditions causing SQL performance problems'.
- **Opinião (aplicabilidade aqui):** para timestamp sem fuso, 'criado_em::date BETWEEN $1 AND $2' equivale a 'criado_em >= $1::date AND criado_em < $2::date + 1'. Assim fica sargável com um índice B-tree em pedidos(criado_em). Atenção ao limite superior exclusivo, para não perder o último dia.

### LIKE performance tuning (Use The Index, Luke!)

- **Autor/organização:** Markus Winand (Use The Index, Luke!) (s.d. (livro online))
- **Tipo:** blog técnico
- **Link:** <https://use-the-index-luke.com/sql/where-clause/searching-for-ranges/like-performance-tuning>
- **Sustenta:** Explica por que LIKE com curinga inicial não usa B-tree e cita full-text como alternativa.
- **Verificação:** confirmada-com-correcao (3/3 citações encontradas na página)
- **Citações (literais):**
  - "LIKE filters can only use the characters before the first wild card during tree traversal." (LIKE): Só os caracteres antes do primeiro curinga são usados na travessia da árvore.
  - "Avoid LIKE expressions with leading wildcards (e.g., '%TERM')." (LIKE): Deve-se evitar LIKE com curinga inicial.
  - "PostgreSQL offers the @@ operator to implement full-text searches." (LIKE): O PostgreSQL oferece o operador @@ para full-text.
- **Custo ou risco segundo a fonte:** Sem outro predicado de acesso, o banco varre a tabela inteira.
- **Correção do verificador:** Título: 'Indexing LIKE Filters' (Use The Index, Luke! › The Where Clause › Searching for Ranges); título da página: 'Tuning SQL LIKE using indexes'.
- **Opinião (aplicabilidade aqui):** explica por que '%termo%' não aproveita um B-tree em nome. A página não fala de pg_trgm; quem documenta o pg_trgm é a doc oficial.

### PostgreSQL 16 Documentation - pg_trgm — support for similarity of text using trigram matching

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/pgtrgm.html>
- **Sustenta:** Índice GIN (gin_trgm_ops) ou GiST (gist_trgm_ops) de trigramas para acelerar LIKE/ILIKE com curinga em qualquer posição.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "These index types support the above-described similarity operators, and additionally support trigram-based index searches for LIKE, ILIKE, ~, ~* and = queries." (Index Support): Os índices GIN/GiST do pg_trgm aceleram LIKE, ILIKE, ~, ~* e =.
  - "The index search works by extracting trigrams from the search string and then looking these up in the index. The more trigrams in the search string, the more effective the index search is. Unlike B-tree based searches, the search string need not be left-anchored." (Index Support): A busca extrai trigramas do padrão; quanto mais trigramas, mais eficiente. O padrão não precisa ser ancorado à esquerda.
  - "For both LIKE and regular-expression searches, keep in mind that a pattern with no extractable trigrams will degenerate to a full-index scan." (Index Support): Padrão sem trigramas extraíveis degenera em varredura do índice inteiro.
- **Custo ou risco segundo a fonte:** Para igualdade pode ser menos eficiente que B-tree. Padrões curtos ou sem trigramas viram varredura do índice inteiro. No GiST, assinatura maior dá busca mais precisa com índice maior.
- **Correção do verificador:** Título completo: 'F.35. pg_trgm — support for similarity of text using trigram matching'.
- **Opinião (aplicabilidade aqui):** é a solução padrão para (d) e mantém a semântica, porque o operador ILIKE continua o mesmo e o índice só filtra candidatos. A API já rejeita termos com menos de 3 caracteres, o que garante trigramas. Ressalva: termos frequentes ('cadeira', 'sem fio') podem casar milhares de linhas, e aí o GIN ainda precisa de Sort para ORDER BY nome, id. Conferir com EXPLAIN.

### PostgreSQL 16 Documentation - 70.5. GIN Tips and Tricks

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/gin-tips.html>
- **Sustenta:** Custos de construção e manutenção de índices GIN, como o de pg_trgm.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Insertion into a GIN index can be slow due to the likelihood of many keys being inserted for each item. So, for bulk insertions into a table it is advisable to drop the GIN index and recreate it after finishing bulk insertion." (70.5): Inserir em GIN pode ser lento, e para cargas em massa recomenda-se criar o índice depois.
  - "Build time for a GIN index is very sensitive to the maintenance_work_mem setting; it doesn't pay to skimp on work memory during index creation." (70.5): O tempo de construção do GIN é muito sensível a maintenance_work_mem.
- **Custo ou risco segundo a fonte:** Inserção lenta. Com fastupdate, a limpeza da pending list em primeiro plano causa picos de latência.
- **Opinião (aplicabilidade aqui):** crie o GIN num 03-indices.sql depois da carga, e não no 01-estrutura.sql. Com 512 MB no banco, um maintenance_work_mem moderado só durante o build é razoável.

### Tips for tuning Postgres LIKE & ILIKE queries via pg_trgm on Azure

- **Autor/organização:** Sarat Balijepalli (Microsoft, Azure Database for PostgreSQL Blog) (2024-03-04 (atualizado em 2024-09-10))
- **Tipo:** caso de mercado
- **Link:** <https://techcommunity.microsoft.com/t5/azure-database-for-postgresql/tips-for-tuning-postgres-like-amp-ilike-queries-via-pg-trgm-on/ba-p/4069179>
- **Sustenta:** Índice GIN pg_trgm para LIKE/ILIKE com curinga inicial, medido em uma tabela grande.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "load 80 million records into the table and VACUUM ANALYZE the table after the data load is complete." (Setup): No experimento, o autor carregou 80 milhões de linhas e rodou VACUUM ANALYZE depois da carga.
  - "The performance of the query has improved from ~2.5 seconds to 1 second and the optimizer uses newly created index" (LIKE with leading wildcard): Com o índice GIN de trigramas, a consulta LIKE '%testp123' caiu de cerca de 2,5 s para 1 s.
- **Custo ou risco segundo a fonte:** O artigo não discute tamanho do índice, overhead de escrita nem padrões curtos.
- **Correção do verificador:** Frase completa: 'The performance of the query has improved from ~2.5 seconds to 1 second and the optimizer uses newly created index %test_like_ix2.' (nome do índice como devolvido pela página).
- **Opinião (aplicabilidade aqui):** é evidência de mercado de que o padrão funciona, mas numa escala (80M linhas) muito diferente da tabela de produtos (20 mil). Aqui o ganho deve vir mais de CPU do banco do que de I/O. Não extrapolar os números.

### PostgreSQL 16 Documentation - 12.1. Introduction (Full Text Search)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/textsearch-intro.html>
- **Sustenta:** Full-text search (tsvector/tsquery com GIN) como alternativa ao ILIKE. A semântica é diferente: lexemas, stemming e stop words.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "They tend to be slow because there is no index support, so they must process all documents for every search." (12.1): LIKE/ILIKE não têm suporte linguístico, ranking nem índice nativo.
  - "For example, normalization almost always includes folding upper-case letters to lower-case, and often involves removal of suffixes (such as s or es in English)." (12.1): O FTS normaliza tokens em lexemas: minúsculas e remoção de sufixos.
  - "Also, this step typically eliminates stop words, which are words that are so common that they are useless for searching." (12.1): O FTS normalmente elimina stop words.
- **Custo ou risco segundo a fonte:** A doc não trata o FTS como substituto exato de substring. A correspondência é por lexema normalizado.
- **Opinião (aplicabilidade aqui):** muda o contrato. Termos do k6 como 'lumin' e 'ergo' (pedaços de palavra) e 'modelo 12' (substring com espaço) não casariam da mesma forma por lexema, e stemming e stop words alteram o conjunto de resultados. Descartar para este desafio.

### We need tool support for keyset pagination (No Offset)

- **Autor/organização:** Markus Winand (Use The Index, Luke!) (s.d.)
- **Tipo:** blog técnico
- **Link:** <https://use-the-index-luke.com/no-offset>
- **Sustenta:** Paginação por keyset (seek method) em vez de OFFSET.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "The only thing the database can do with this number is fetching and dropping that many rows." (No Offset): Com OFFSET, o banco só pode buscar e descartar aquele número de linhas.
  - "As it turns out, living without offset is quite simple: just use a where clause that selects only data you haven’t seen yet." (No Offset): Keyset: um WHERE que seleciona só os dados ainda não vistos.
  - "keyset pagination has some limitations: most notably that you cannot directly navigate to arbitrary pages" (No Offset): Limitação: não dá para ir direto a uma página arbitrária.
- **Custo ou risco segundo a fonte:** Não permite pular para uma página arbitrária, e o cliente precisa devolver as chaves.
- **Correção do verificador:** Frase completa: 'On slide 43 you can also see that keyset pagination has some limitations: most notably that you cannot directly navigate to arbitrary pages.'
- **Opinião (aplicabilidade aqui):** keyset é o estado da arte, mas aqui VIOLA o contrato, porque o parâmetro pagina e o salto para a página 1000 fazem parte dele. Serve só para justificar no relatório por que OFFSET é caro e por que foi mantido.

### Pagination guidelines (GitLab Development Docs)

- **Autor/organização:** GitLab (s.d. (doc viva, consultada em 2026-11-07))
- **Tipo:** caso de mercado
- **Link:** <https://docs.gitlab.com/development/database/pagination_guidelines/>
- **Sustenta:** Caso de mercado sobre o custo de OFFSET e de COUNT, e as limitações do keyset.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "This is due to the OFFSET clause that seeks through the rows and skips N rows." (Offset pagination): O OFFSET percorre e pula N linhas, e isso degrada em páginas profundas.
  - "Count queries can be quite expensive for a large table." (Offset pagination): Consultas de contagem podem ser caras em tabelas grandes.
  - "Keyset pagination cannot provide page numbers because the paging logic might depend on different columns." (Keyset pagination): Keyset não fornece números de página.
- **Custo ou risco segundo a fonte:** Keyset só oferece próxima, anterior, primeira e última página, e complica a lógica com chaves multicoluna ou nulas.
- **Opinião (aplicabilidade aqui):** confirma, com caso real, que tanto o count(*) quanto o OFFSET da rota /pedidos são gargalos conhecidos. Como o contrato exige total e pagina, o caminho é tornar ambos baratos (index-only scan, contagem pré-calculada) sem trocar o modelo de paginação.

### FastPage: Faster offset pagination for Rails apps

- **Autor/organização:** Mike Coutermarsh (PlanetScale) (2022-08-16)
- **Tipo:** caso de mercado
- **Link:** <https://planetscale.com/blog/fastpage-faster-offset-pagination-for-rails-apps>
- **Sustenta:** Deferred join: paginar com OFFSET só sobre os IDs (pelo índice) e depois buscar as linhas completas. Mantém a paginação por OFFSET.
- **Verificação:** confirmada-com-correcao (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Notice that we first select the ID of all the rows we want to show, then the data for those rows." (How it works): Primeiro se selecionam os IDs da página e só depois os dados dessas linhas.
  - "We add .fast_page to the query and now it's 2.7× faster!" (Results): No exemplo do artigo, a consulta ficou 2,7 vezes mais rápida.
  - "Because fast_page runs 2 queries instead of 1, it is very likely a bit slower for early pages." (Caveats): Por fazer 2 consultas, tende a ser um pouco mais lento nas primeiras páginas.
- **Custo ou risco segundo a fonte:** Mais lento nas primeiras páginas, funciona melhor com ORDER BY, e o autor recomenda medir nos próprios dados.
- **Correção do verificador:** Título: 'Introducing FastPage: Faster offset pagination for Rails apps'.
- **Opinião (aplicabilidade aqui):** o caso é MySQL. No PostgreSQL o equivalente seria uma subconsulta 'SELECT id ... ORDER BY ... LIMIT 20 OFFSET k' via index-only scan sobre (status, criado_em, id), seguida de JOIN em pedidos e reordenação. Só compensa se a projeção não couber num índice de cobertura; aqui ela cabe, já que a rota usa só 4 colunas. Por isso fica como alternativa secundária.

### Top-N Queries: Querying the Top-N Rows (Use The Index, Luke!)

- **Autor/organização:** Markus Winand (Use The Index, Luke!) (s.d. (livro online))
- **Tipo:** blog técnico
- **Link:** <https://use-the-index-luke.com/sql/partial-results/top-n-queries>
- **Sustenta:** Top-N em pipeline com ORDER BY indexado; sem índice adequado, o banco lê e ordena tudo.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "For efficient execution, the ranking must be done with a pipelined order by." (Top-N Queries): Top-N eficiente exige ORDER BY em pipeline.
  - "If there is no suitable index on SALE_DATE for a pipelined order by, the database must read and sort the entire table." (Top-N Queries): Sem índice adequado, o banco lê e ordena a tabela inteira, e a primeira linha só sai depois de ler a última.
- **Custo ou risco segundo a fonte:** Sem índice em pipeline, a resposta só começa depois de ler a última linha.
- **Correção do verificador:** Título: 'Querying Top-N Rows' (título da página: 'Top-N queries: fetch only the first N rows').
- **Opinião (aplicabilidade aqui):** em top-produtos o ORDER BY é sobre um agregado (receita), que nenhum índice da tabela base consegue fornecer. Por isso, só pré-agregação (materialized view ou tabela de resumo com índice em receita DESC, id) torna esse top-N barato.

### PostgreSQL 16 Documentation - 41.3. Materialized Views

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/rules-materializedviews.html>
- **Sustenta:** Pré-agregação persistida (materialized view) atualizada com REFRESH, para relatórios como top-produtos, vendas por dia e contagem por status.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Materialized views in PostgreSQL use the rule system like views do, but persist the results in a table-like form." (41.3): Materialized views persistem o resultado em forma de tabela.
  - "While access to the data stored in a materialized view is often much faster than accessing the underlying tables directly or through a view, the data is not always current; yet sometimes current data is not needed." (41.3): O acesso costuma ser muito mais rápido, mas os dados nem sempre estão atualizados.
- **Custo ou risco segundo a fonte:** Dados podem ficar obsoletos até o REFRESH MATERIALIZED VIEW. Não é possível atualizar a view diretamente.
- **Opinião (aplicabilidade aqui):** como a API só lê e os dados vêm de uma carga fixa, uma materialized view criada e atualizada logo depois do 02-dados.sql devolve valores idênticos aos da consulta original. O risco é alguém escrever direto no banco sem REFRESH, e isso deve ser declarado como premissa no relatório.

### How not to structure your database-backed web applications: a study of performance bugs in the wild

- **Autor/organização:** Junwen Yang, Pranav Subramaniam, Shan Lu (University of Chicago); Cong Yan, Alvin Cheung (University of Washington) (2018 - ICSE '18 (40th International Conference on Software Engineering), pp. 800-810)
- **Tipo:** acadêmica
- **Link:** <https://par.nsf.gov/servlets/purl/10067547> · DOI: 10.1145/3180155.3180194
- **Sustenta:** Estudo empírico com 12 aplicações ORM, mais de 200 issues, 9 anti-padrões e 64 correções (mediana de 2x, máximo de 39x). Índices ausentes, N+1 e mover computação para o SGBD são correções de poucas linhas.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "As shown in Table 6, missing index is the most common performance problem reported in ORM application's bug tracking systems. However, it only appears in three out of the 40 problematic actions in latest versions." (5.2.2 Missing Database Indexes (MI)): Índice ausente é o problema de performance mais relatado nos bug trackers das aplicações ORM, embora apareça em só 3 das 40 ações problemáticas das versões mais recentes. Os autores supõem que os índices são adicionados aos poucos, depois do deploy.
  - "This is known as the "N+1" query problem. While prior work has studied this problem [7, 18, 28], we find it still prevalent: it appears in 15 problematic actions and 9 performance issues in our study." (5.1.3 Inefficient Data Accessing (ID)): O problema N+1 continua frequente: aparece em 15 ações problemáticas e 9 issues do estudo.
  - "The former uses pluck to issue a query to load the total column of all corresponding records and then computes the sum in memory, while the latter uses sum to issue a query that directly performs the sum in the DBMS without returning actual records to the server." (5.1.1 Inefficient Computation (IC) - Moving computation to the DBMS): Carregar a coluna inteira e somar em memória no servidor é ineficiente. A correção é agregar no SGBD sem devolver as linhas.
- **Custo ou risco segundo a fonte:** Os autores aplicam as correções com cuidado para não mudar a semântica do programa. Parte das correções (paginação, remoção de funcionalidade) altera a exibição. Problemas de dados só aparecem com volume grande, depois do deploy.
- **Correção do verificador:** DOI: 10.1145/3180155.3180194 (ICSE '18, May 27-June 3, 2018, Gothenburg, Sweden).
- **Opinião (aplicabilidade aqui):** é a fonte acadêmica que sustenta (b), (c) e (e). O relatório de vendas por dia faz exatamente o anti-padrão 'trazer as linhas e somar em memória', e as FKs sem índice são o caso MI. Observação de método: a ACM (dl.acm.org) devolveu 403 e o domínio hyperloop.cs.uchicago.edu não resolveu. Abri o manuscrito aceito no NSF PAR com WebFetch, que baixou o PDF, e extraí o texto localmente com pdftotext para copiar as citações literais.

## 2. Conexões e N+1

### Pooling (node-postgres docs, Features)

- **Autor/organização:** Brian Carlson / projeto node-postgres (documentação atual (consultada em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://node-postgres.com/features/pooling>
- **Sustenta:** Pool de conexões dentro do processo Node (pg.Pool), reaproveitando clientes em vez de abrir uma conexão por consulta
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Connecting a new client to the PostgreSQL server requires a handshake which can take 20-30 milliseconds." (Why pool?): Abrir um cliente novo exige um handshake que pode levar de 20 a 30 ms.
  - "The PostgreSQL server can only handle a limited number of clients at a time. [...] Depending on the available memory of your PostgreSQL server you may even crash the server. [...] PostgreSQL can only process one query at a time on a single connected client in a first-in first-out manner." (Why pool?): O servidor aceita um número limitado de clientes ao mesmo tempo e, conforme a memória disponível, conexões demais podem derrubar o servidor. Cada cliente conectado processa uma consulta por vez, em ordem FIFO.
  - "This is the preferred way to query with node-postgres if you can as it removes the risk of leaking a client. [...] You must always return the client to the pool if you successfully check it out" (Examples / Checkout, use, and return): pool.query é o jeito preferido de consultar porque elimina o risco de vazar clientes. Quem faz checkout manual tem de devolver o cliente sempre.
- **Custo ou risco segundo a fonte:** Com checkout manual (pool.connect) e sem release, a aplicação vaza clientes: 'If you don't release the client your application will leak them'.
- **Correção do verificador:** Contexto opcional: "Depending on the available memory of your PostgreSQL server you may even crash the server if you connect an unbounded number of clients."
- **Opinião (aplicabilidade aqui):** é a correção principal de (a). O db.js atual cria Client/connect/end por consulta, então paga o handshake em cada uma das cerca de 22 consultas da rota N+1 de um cliente médio (500 mil pedidos / 100 mil clientes ≈ 5 pedidos; 1,5 milhão de itens / 100 mil ≈ 15 itens; 1+1+5+15 = 22). Pela faixa de 20-30 ms da fonte, isso dá entre 0,4 e 0,7 s só de handshakes por requisição. É uma estimativa derivada, que precisa ser medida. A troca não toca no contrato.

### pg.Pool (node-postgres API reference)

- **Autor/organização:** Brian Carlson / projeto node-postgres (documentação atual (consultada em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://node-postgres.com/apis/pool>
- **Sustenta:** Configuração do pg.Pool (max, idleTimeoutMillis, connectionTimeoutMillis) e uso correto de pool.query
- **Verificação:** confirmada-com-correcao (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Maximum number of clients the pool should contain. [...] By default this is set to 10." (Constructor / config.max): O tamanho máximo padrão do pool é 10 clientes.
  - "Default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients. [...] By default this is 0 which means no timeout." (Constructor / idleTimeoutMillis, connectionTimeoutMillis): Clientes ociosos são desconectados por padrão depois de 10 s. Por padrão também não há timeout para obter uma conexão nova.
  - "Do not use pool.query if you are using a transaction. The pool will dispatch every query passed to pool.query on the first available idle client." (pool.query): pool.query não serve para transações, porque cada chamada pode cair num cliente ocioso diferente.
- **Custo ou risco segundo a fonte:** Com connectionTimeoutMillis = 0 (padrão), uma requisição espera indefinidamente quando o pool está esgotado. Transações exigem o mesmo cliente (pool.connect + release).
- **Correção do verificador:** Separar a citação 2 em duas: connectionTimeoutMillis: "Number of milliseconds to wait before timing out when connecting a new client. By default this is 0 which means no timeout." e idleTimeoutMillis: "Number of milliseconds a client must sit idle in the pool and not be checked out before it is disconnected from the backend and discarded. Default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients." max: "Maximum number of clients the pool should contain. By default this is set to 10. There is some nuance to setting the maximum size of your pool."
- **Opinião (aplicabilidade aqui):** com 20 VUs em modelo fechado e API de 0,5 CPU, um max entre 10 (padrão) e 20 deve bastar. Vale definir connectionTimeoutMillis para falhar rápido em vez de travar. As rotas atuais não usam transação, então pool.query cobre todos os casos.

### PostgreSQL 16 Documentation, 52.2. How Connections Are Established

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/connect-estab.html>
- **Sustenta:** Modelo de processos do PostgreSQL: um processo backend por conexão, criado pelo postmaster a cada pedido de conexão
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "PostgreSQL implements a "process per user" client/server model. In this model, every client process connects to exactly one backend process. As we do not know ahead of time how many connections will be made, we have to use a "supervisor process" that spawns a new backend process every time a connection is requested." (52.2): O PostgreSQL segue o modelo 'processo por usuário': cada cliente fica ligado a exatamente um processo backend, e o postmaster cria um backend novo a cada pedido de conexão.
  - "Those backend processes communicate with each other and with other processes of the instance using semaphores and shared memory to ensure data integrity throughout concurrent data access." (52.2): Os backends se comunicam entre si por semáforos e memória compartilhada.
- **Custo ou risco segundo a fonte:** A página não dá números. O custo vem implícito no desenho: cada conexão nova cria um processo no servidor.
- **Correção do verificador:** Seção 52.2, no capítulo 52 'Overview of PostgreSQL Internals'.
- **Opinião (aplicabilidade aqui):** explica por que o padrão atual (conexão por consulta) também gasta CPU do banco, que tem só 1 CPU, criando e destruindo processos backend, e não apenas latência na API. O pool elimina esse custo depois do aquecimento.

### Analyzing the Limits of Connection Scalability in Postgres

- **Autor/organização:** Andres Freund (andresfreund, Microsoft) (2020-10-08 (atualizado em 2020-10-26))
- **Tipo:** técnica primária
- **Link:** <https://techcommunity.microsoft.com/blog/adforpostgresql/analyzing-the-limits-of-connection-scalability-in-postgres/1757266>
- **Sustenta:** Análise dos custos de conexões no PostgreSQL (estabelecimento, memória, snapshots) e do papel dos poolers
- **Verificação:** confirmada-com-correcao (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Given the cost of establishing a new database connection (TLS, latency, and Postgres costs, in that order) [...] When a new connection is established, Postgres' supervisor process creates a dedicated process to handle that connection going forward." (Why connection scalability matters / Postgres connection model): Abrir uma conexão nova tem custo, nesta ordem: TLS, latência e custos do próprio Postgres. A cada conexão o processo supervisor cria um processo dedicado.
  - "the memory overhead of each connection is below 2 MiB [...] the achievable throughput of active connections decreases significantly when the number of idle connections increases." (Memory usage / Snapshot scalability): Bem configurado (em especial com huge_pages), o overhead de memória de cada conexão fica abaixo de 2 MiB. O gargalo que o autor encontrou foi GetSnapshotData(): a vazão das conexões ativas cai bastante conforme cresce o número de conexões ociosas.
  - "To some degree this issue can be addressed using Postgres connection poolers like PgBouncer or more recently Odyssey. [...] precludes the use of many useful database features like prepared statements, temporary tables" (Connection poolers): Poolers como PgBouncer ou Odyssey resolvem o problema só em parte. Para reduzir conexões no servidor é preciso pooling por transação ou por statement, e isso impede recursos úteis como prepared statements e tabelas temporárias.
- **Custo ou risco segundo a fonte:** Pooler externo em modo transação ou statement quebra recursos de sessão (prepared statements, tabelas temporárias). Conexões ociosas demais degradam a vazão das ativas.
- **Correção do verificador:** Citação 2 corrigida: "And that in many workloads, and with the right configuration—most importantly, using huge_pages—the memory overhead of each connection is below 2 MiB." Citação 3, contexto: "However, doing so precludes the use of many useful database features like prepared statements, temporary tables, …" (sobre usar poolers em transaction ou statement pooling). Autor: 'andresfreund (Microsoft)'. Retirar 'committer do PostgreSQL' ou atribuí-lo a outra fonte.
- **Opinião (aplicabilidade aqui):** dá base técnica primária para (1) reaproveitar conexões e (2) não superdimensionar o pool. Um pool de 10 a 20 conexões custa poucos MiB num banco de 512 MB. Um pool muito maior não ajuda, porque o gargalo vira CPU e snapshot.

### PgBouncer - Features

- **Autor/organização:** Projeto PgBouncer (documentação atual (consultada em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://www.pgbouncer.org/features.html>
- **Sustenta:** Pooler externo com modos session, transaction e statement
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "A server connection is assigned to a client only during a transaction. When PgBouncer notices that the transaction is over, the server will be put back into the pool." (Pooling modes): No modo transaction, uma conexão do servidor fica com o cliente só durante a transação e volta ao pool quando ela termina.
  - "Note that “transaction” pooling breaks client expectations of the server by design" (SQL feature map for pooling modes): O próprio projeto avisa que o pooling por transação quebra, por desenho, as expectativas do cliente sobre o servidor. Na tabela de compatibilidade, SET/RESET, LISTEN, PREPARE/DEALLOCATE e advisory locks de sessão aparecem como 'Never' nesse modo.
  - "Low memory requirements (2 kB per connection by default)." (Features): PgBouncer consome pouca memória: 2 kB por conexão no padrão.
  - Tabela "SQL feature map for pooling modes" (aberta de novo em 2026-11-07): "Protocol-level prepared plans | Yes | Yes [2]", com a nota 2 "You need to change max_prepared_statements to a non-zero value to enable this support."; "PREPARE / DEALLOCATE | Yes | Never"; "SET/RESET | Yes | Never". Ou seja: em modo transaction, PREPARE e SET em SQL não funcionam, mas prepared statements do protocolo funcionam se configurados.
- **Custo ou risco segundo a fonte:** Modo transaction e statement quebram recursos de sessão (SET, PREPARE, LISTEN, advisory locks de sessão, WITH HOLD cursors). O modo statement proíbe transações com vários comandos.
- **Correção do verificador:** Contexto: "Note that “transaction” pooling breaks client expectations of the server by design and can be used only if the application cooperates"
- **Opinião (aplicabilidade aqui):** é uma alternativa ou complemento a (a), mas acrescenta mais um serviço com CPU e memória próprias no compose, o que vai contra (g). Com uma única instância da API, o pool interno do pg resolve o mesmo problema sem infraestrutura extra. PgBouncer faz mais sentido com várias instâncias da API ou funções serverless.

### PgBouncer - Usage

- **Autor/organização:** Projeto PgBouncer (documentação atual (consultada em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://www.pgbouncer.org/usage.html>
- **Sustenta:** Objetivo do pooler externo e descrição dos modos
- **Verificação:** confirmada-com-correcao (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Any target application can be connected to pgbouncer as if it were a PostgreSQL server, and pgbouncer will create a connection to the actual server, or it will reuse one of its existing connections. The aim of pgbouncer is to lower the performance impact of opening new connections to PostgreSQL." (Description): O PgBouncer existe para reduzir o impacto de abrir conexões novas no PostgreSQL. A aplicação conecta nele como se fosse o servidor, e ele cria ou reaproveita conexões reais.
  - "The server connection will be put back into the pool immediately after a query completes. Multi-statement transactions are disallowed in this mode as they would break." (Pool modes): No modo statement, a conexão volta ao pool logo depois de cada consulta, e transações com vários comandos ficam proibidas.
- **Custo ou risco segundo a fonte:** O modo statement proíbe transações com vários comandos.
- **Correção do verificador:** Título: 'PgBouncer command-line usage'. A citação 2 é da seção 'Statement pooling'.
- **Opinião (aplicabilidade aqui):** mesmo com PgBouncer, um app que abre uma conexão por consulta ainda paga o handshake TCP/startup até o PgBouncer, só que sem o fork de backend. É mais barato, mas não chega ao custo zero de um pool dentro do processo.

### Detecting Performance Anti-patterns for Applications Developed using Object-Relational Mapping

- **Autor/organização:** Tse-Hsun Chen, Weiyi Shang, Zhen Ming Jiang, Ahmed E. Hassan, Mohamed Nasser, Parminder Flora (Queen's University, York University, BlackBerry). ICSE 2014, Proceedings of the 36th International Conference on Software Engineering, pp. 1001-1012 (2014 (ICSE '14, 31 de maio a 7 de junho, Hyderabad))
- **Tipo:** acadêmica
- **Link:** <https://petertsehsun.github.io/papers/peter_icse2014.pdf> · DOI: 10.1145/2568225.2568259
- **Sustenta:** Detectar e corrigir o anti-padrão 'one-by-one processing' (N+1) com lotes (batch). Avaliação estatística do impacto com repetições, t-test e effect size.
- **Verificação:** confirmada-com-correcao (4/4 citações encontradas na página)
- **Citações (literais):**
  - "(2) One-by-One Processing, which repeatedly performs similar database operations in loops [17]. [...] The repetitive SQL statements can be optimized using batches, which reduce a large amount of query preparation and transmission overheads." (2. Motivating examples / 3.3 Performance assessment): Os autores definem one-by-one processing (o N+1) como repetir operações de banco parecidas dentro de laços. Os SQLs repetitivos podem ser otimizados com lotes, que eliminam boa parte do custo de preparar e transmitir as consultas.
  - "In Broadleaf, one-by-one processing anti-patterns have a statistically significant performance impact in 4 out of the 9 test suites, and the effect sizes are at least medium (0.59-4.54). The assessed response time reduction is from 20-32%. [...] the assessed response time reduction is high (69%) and the effect size is large (55.3)." (4. Case study, RQ1, Performance benefits of removing one-by-one processing): No Broadleaf, one-by-one processing teve impacto estatisticamente significativo em 4 de 9 suítes, com redução de tempo de resposta estimada entre 20 e 32%. No sistema industrial (EA), a redução estimada foi de 69%.
  - "The original code takes about 24.67 ± 0.84 seconds. Fixing the code results in a mean response time of 5.36 ± 0.06 seconds [...] fixing the detected performance antipatterns can improve the system response time by up to 98%." (6. Discussion (accuracy) / Abstract): Num programa de teste com 100 mil departamentos, o código one-by-one original levou cerca de 24,67 s e o corrigido 5,36 s. O resumo cita melhoria de até 98% no tempo de resposta, mas esse máximo veio do anti-padrão 'excessive data' (Pet Clinic), e não do N+1.
  - "The results indicate that when the response time of a program is small, adding batches will not give much improvement. This also shows that not all anti-patterns are worth fixing. [...] We repeat the performance tests > 30 times (as suggested by Georges et al.)" (4. Case study, RQ1 / 3.3 Part 3): Quando o tempo de resposta já é pequeno, lotes trazem pouco ganho, e nem todo anti-padrão compensa a correção. Para a medição, os autores repetem os testes mais de 30 vezes e usam t-test.
- **Custo ou risco segundo a fonte:** Corrigir one-by-one pode ser bem mais complicado que o exemplo e exige conhecer a estrutura, o desenho e as APIs do sistema ('requires a deep knowledge about a system's structure, design and APIs'). O ganho é pequeno quando o tempo de resposta já é curto.
- **Correção do verificador:** Citação 2 completa: "Although we cannot show the mean response time and confidence interval in EA, the assessed response time reduction is high (69%) and the effect size is large (55.3)." Citação 3, contexto: "We create a database with 100, 000 department names [...] The original code takes about 24.67 ± 0.84 seconds. Fixing the code results in a mean response time of 5.36 ± 0.06 seconds, and the assessment shows a mean response time of 10.42 ± 0.09 seconds." e, em separado, "fixing these instances of performance anti-patterns can improve the systems' response time by up to 98% (and on average by 35%)."
- **Opinião (aplicabilidade aqui):** é a fonte acadêmica central de (b). A correção que o artigo usa (@BatchSize, ou seja, buscar N filhos de uma vez) equivale a WHERE pedido_id = ANY($1). Para (h), a metodologia do artigo (mais de 30 repetições, IC 95%, effect size) mostra que 3 execuções com variação acima de 30% são pouco para afirmar ganho. Nota: o PDF foi baixado via WebFetch e o texto extraído com pdftotext; o DOI foi confirmado no Crossref (a página da ACM retornou 403).

### Finding and Evaluating the Performance Impact of Redundant Data Access for Applications that are Developed Using Object-Relational Mapping Frameworks

- **Autor/organização:** Tse-Hsun Chen, Weiyi Shang, Zhen Ming Jiang, Ahmed E. Hassan, Mohamed Nasser, Parminder Flora. IEEE Transactions on Software Engineering 42(12), pp. 1148-1161 (2016 (dezembro))
- **Tipo:** acadêmica
- **Link:** <https://petertsehsun.github.io/papers/peter_tse2016.pdf> · DOI: 10.1109/TSE.2016.2553039
- **Sustenta:** Versão estendida: acesso a dados redundantes (select all, update all, excessive data, cache por transação) e distinção para one-by-one processing
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "We find that redundant data problems exist in 87% of the exercised transactions. [...] Our performance assessment result shows that by resolving the redundant data problems, the system response time for the studied systems can be improved by an average of 17%." (Abstract): Dados redundantes apareceram em 87% das transações exercitadas, e resolvê-los melhorou o tempo de resposta em 17% na média.
  - "The select all problem causes a statistically significant performance impact in Pet Clinic, ES, and two test suites in Broadleaf (3-31% improvement) with varying effect sizes." (Results, Select All): O problema 'select all' (trazer colunas não usadas) teve impacto estatisticamente significativo, com melhorias entre 3 e 31%.
  - "One-by-one processing is caused by repeatedly sending similar queries with different parameters (e.g., in a loop) within the same transaction." (Per-Transaction Cache): One-by-one processing é causado por enviar repetidamente consultas parecidas com parâmetros diferentes, por exemplo em laço, dentro da mesma transação.
- **Custo ou risco segundo a fonte:** O efeito varia com o esquema e o volume de dados. Colunas nulas, por exemplo, reduzem o custo de transmissão e o ganho.
- **Correção do verificador:** Contexto opcional: "resolving redundant data problems can improve the system performance (i.e., response time) by up to 92% (with an average of 17%)"
- **Opinião (aplicabilidade aqui):** a rota N+1 faz SELECT * FROM pedidos, o que inclui a coluna de texto observacoes sem usá-la. Selecionar só as colunas necessárias (id, status, criado_em) é o 'select all' do artigo e não muda o contrato. Vale também para (e).

### Active Record Query Interface, Eager Loading Associations / N + 1 Queries Problem (Rails Guides)

- **Autor/organização:** Ruby on Rails (equipe core) (documentação atual (consultada em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://guides.rubyonrails.org/active_record_querying.html>
- **Sustenta:** Eager loading: includes, preload (uma consulta por associação, ou seja, lote com IN) e eager_load (LEFT OUTER JOIN único)
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "The above code executes 1 (to find 10 books) + 10 (one per each book to load the author) = 11 queries in total." (N + 1 Queries Problem): No exemplo do guia, carregar 10 livros e o autor de cada um gera 11 consultas (1 + 10).
  - "The above code will execute just 2 queries, as opposed to the 11 queries from the original case: [...] With preload, Active Record loads each specified association using one query per association." (includes / preload): Com includes, o mesmo resultado sai em 2 consultas. O preload usa uma consulta por associação.
  - "With eager_load, Active Record loads all specified associations using a LEFT OUTER JOIN. [...] The above code will execute just 1 query, as opposed to the 11 queries from the original case:" (eager_load): O eager_load carrega tudo com um LEFT OUTER JOIN numa única consulta.
- **Custo ou risco segundo a fonte:** Com preload não dá para pôr condições nas associações pré-carregadas ('it is not possible to specify conditions for preloaded associations').
- **Opinião (aplicabilidade aqui):** as duas estratégias do Rails têm equivalente direto em SQL puro no Node. preload corresponde a consultas em lote com ANY($1), e eager_load a um JOIN único (precisa ser LEFT JOIN para não perder pedidos sem itens).

### Merge request performance guidelines (GitLab Docs)

- **Autor/organização:** GitLab Inc. (documentação atual (consultada em 2026-11-07))
- **Tipo:** caso de mercado
- **Link:** <https://docs.gitlab.com/development/merge_request_concepts/performance/>
- **Sustenta:** Política de engenharia: proibir consultas em laço (N+1), exigir eager loading e processamento em lote
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "SQL queries must not be executed in a loop unless absolutely necessary. [...] Executing SQL queries in a loop can result in many queries being executed depending on the number of iterations in a loop. [...] This particular problem is known as the "N+1 query problem"" (Executing Queries in Loops): No GitLab, consultas SQL não podem rodar em laço salvo quando estritamente necessário, porque o número de consultas cresce com o número de iterações. É o problema N+1.
  - "always eager load associations when retrieving more than one row. [...] should be executed in a batch style to reduce connection overheads." (Eager Loading / Batch process): A regra é sempre fazer eager loading de associações ao buscar mais de uma linha, e processar em lote para reduzir o overhead de conexão.
- **Custo ou risco segundo a fonte:** O guia lembra que o N+1 pode passar despercebido em desenvolvimento, com pouco dado, e estourar em produção.
- **Correção do verificador:** Contexto: "Iterating a single process to external services (for example, PostgreSQL, Redis, Object Storage) should be executed in a batch style to reduce connection overheads."
- **Opinião (aplicabilidade aqui):** é o caso de mercado de que N+1 é tratado como defeito em revisão de código. Aqui o problema se agrava porque cada consulta do laço também abre uma conexão nova, ou seja, (a) e (b) se multiplicam.

### Query count limits (GitLab Docs)

- **Autor/organização:** GitLab Inc. (documentação atual (consultada em 2026-11-07))
- **Tipo:** caso de mercado
- **Link:** <https://docs.gitlab.com/development/database/query_count_limits/>
- **Sustenta:** Limite automatizado de consultas por requisição nos testes, para pegar N+1
- **Verificação:** confirmada (1/1 citações encontradas na página)
- **Citações (literais):**
  - "Each controller, API endpoint and Sidekiq worker is allowed to execute up to 100 SQL queries. [...] In test environments, we raise an error when this threshold is exceeded." (Query count limits): No GitLab, cada controller, endpoint de API ou worker pode executar no máximo 100 consultas SQL, e os testes falham com erro quando o limite é ultrapassado.
- **Custo ou risco segundo a fonte:** Desativar o limite exige uma issue associada e priorizada ('Disabling the limit should always associate and prioritize an issue').
- **Opinião (aplicabilidade aqui):** dá para adaptar como verificação de regressão: contar as consultas por requisição (por exemplo, instrumentando consultar()) e garantir que /clientes/:id/pedidos fique num número constante, como 3 ou 4, qualquer que seja a quantidade de pedidos.

### Solving the N+1 Problem for GraphQL through Batching

- **Autor/organização:** Shopify Engineering (autores: Leanne Shapton, Dylan Thacker-Smith, Scott Walkinshaw) (2018-04-24)
- **Tipo:** caso de mercado
- **Link:** <https://shopify.engineering/solving-the-n-1-problem-for-graphql-through-batching>
- **Sustenta:** Batching com promises (biblioteca GraphQL Batch): agrupar cargas parecidas e resolvê-las numa ida ao banco
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "For example, if there were fifty authors, then it would make fifty-one round trips for all the data." (The n+1 problem): Com 50 autores, buscar o endereço de cada um separadamente faz 51 idas ao datastore.
  - "It should be able to fetch all the addresses together in a single round trip [...] so only two round trips to datastores in total," (Batching): O ideal é buscar todos os endereços de uma vez. Com batching, o total cai para duas idas ao datastore, qualquer que seja o número de autores.
- **Custo ou risco segundo a fonte:** O artigo não traz benchmarks nem discute desvantagens. Exige reestruturar o código em torno de promises e loaders.
- **Opinião (aplicabilidade aqui):** confirma num caso real que o número de idas ao banco deve ser constante, e não proporcional a N. Na nossa rota, isso significa cair de 2+P+I consultas para 3 ou 4.

### graphql/dataloader (repositório oficial, README)

- **Autor/organização:** GraphQL Foundation (originalmente Facebook) (README atual (consultado em 2026-11-07))
- **Tipo:** técnica primária
- **Link:** <https://github.com/graphql/dataloader>
- **Sustenta:** DataLoader: agrupa as chamadas load(key) feitas no mesmo tick do event loop numa única função de lote, com cache por requisição
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "DataLoader is a generic utility to be used as part of your application's data fetching layer [...] DataLoader will coalesce all individual loads which occur within a single frame of execution" (Getting Started / Batching): DataLoader é um utilitário genérico para a camada de acesso a dados que junta todas as cargas individuais feitas no mesmo frame de execução.
  - "The Array of values must be the same length as the Array of keys. [...] Each index in the Array of values must correspond to the same index in the Array of keys." (Batch Function): A função de lote tem de devolver um array do mesmo tamanho do array de chaves, com cada posição correspondendo à mesma chave.
  - "DataLoader caching does not replace Redis, Memcache, or any other shared application-level cache. [...] Typically, DataLoader instances are created when a Request begins, and are not used once the Request ends." (Caching): O cache do DataLoader não substitui um cache compartilhado da aplicação. As instâncias costumam ser criadas no começo de cada requisição e descartadas no fim.
- **Custo ou risco segundo a fonte:** A função de lote precisa reordenar os resultados para casar com as chaves (risco de bug de ordem). O cache vale só por requisição e não pode ser compartilhado entre usuários.
- **Opinião (aplicabilidade aqui):** na rota atual os laços fazem await sequencial, então o DataLoader só agruparia alguma coisa se o código fosse reescrito com Promise.all. Para uma rota só, isso é mais complexidade e uma dependência a mais do que escrever direto WHERE ... = ANY($1).

### PostgreSQL 16 Documentation, 9.21. Aggregate Functions

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/functions-aggregate.html>
- **Sustenta:** Montar os itens aninhados no próprio banco com json_agg, jsonb_agg ou array_agg
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Collects all the input values, including nulls, into a JSON array. Values are converted to JSON as per to_json or to_jsonb." (Table 9.59): json_agg e jsonb_agg juntam os valores de entrada, nulos incluídos, num array JSON, convertendo cada valor como to_json ou to_jsonb.
  - "This ordering is unspecified by default, but can be controlled by writing an ORDER BY clause within the aggregate call [...] Beware that this approach can fail if the outer query level contains additional processing, such as a join, because that might cause the subquery's output to be reordered before the aggregate is computed." (9.21 (nota sobre ordenação)): A ordem de entrada de json_agg e array_agg não é especificada por padrão e precisa ser fixada com ORDER BY dentro da chamada do agregado. Ordenar numa subconsulta pode falhar se o nível externo tiver um join.
- **Custo ou risco segundo a fonte:** Sem ORDER BY dentro do agregado, a ordem dos itens não é garantida. json_agg também inclui nulos, então um LEFT JOIN de pedido sem itens gera [null].
- **Opinião (aplicabilidade aqui):** reduz a 1 a ida ao banco e tira CPU do Node (0,5 CPU), mas desloca serialização para o banco (1 CPU). É a alternativa com mais risco de mudar o contrato: formato de criado_em, tipos numéricos, [null] e ordem.

### PostgreSQL 16 Documentation, 9.16. JSON Functions and Operators (to_json, json_build_object)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/functions-json.html>
- **Sustenta:** Conversão SQL→JSON no banco (base de json_agg e json_build_object)
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Converts any SQL value to json or jsonb. [...] For any scalar other than a number, a Boolean, or a null value, the text representation will be used, with escaping as necessary to make it a valid JSON string value." (Table 9.47): to_json converte qualquer valor SQL. Escalares que não são número, booleano ou nulo viram a representação em texto, como string JSON.
  - "Builds a JSON object out of a variadic argument list. By convention, the argument list consists of alternating keys and values. Key arguments are coerced to text; value arguments are converted as per to_json or to_jsonb." (Table 9.47): Em json_build_object, as chaves viram texto e os valores são convertidos como to_json.
- **Custo ou risco segundo a fonte:** A página não fixa o formato de timestamps em JSON. Ele segue a representação em texto do PostgreSQL, que não é a mesma do Date.toISOString() do JavaScript.
- **Opinião (aplicabilidade aqui):** hoje criado_em (timestamp sem fuso) chega ao Node como Date e o res.json o serializa via toISOString. Se o JSON for montado no banco, o texto de criado_em tende a sair diferente, sem milissegundos e sem 'Z', e isso quebra o contrato. O contrato/verificar.js precisa validar isso. É mais seguro agregar no banco só os itens (inteiros e texto) e manter criado_em vindo como coluna normal.

### PostgreSQL 16 Documentation, 9.24. Row and Array Comparisons (IN, ANY/SOME array)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/functions-comparisons.html>
- **Sustenta:** Consulta em lote com coluna = ANY($1::int[]) no lugar de uma consulta por id
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "The right-hand side is a parenthesized expression, which must yield an array value. The left-hand expression is evaluated and compared to each element of the array using the given operator, which must yield a Boolean result." (9.24.3 ANY/SOME (array)): Em expressão operador ANY (array), o lado direito tem de produzir um array, e o lado esquerdo é comparado a cada elemento.
  - "The result is “false” if no true result is found (including the case where the array has zero elements)." (9.24.3 / 9.24.1): ANY dá falso quando nenhum elemento casa, inclusive com array vazio. IN com lista é atalho para várias igualdades unidas por OR.
- **Custo ou risco segundo a fonte:** Com um array nulo o resultado é null. Se o array tiver nulos e nada casar, o resultado também é null, não false.
- **Opinião (aplicabilidade aqui):** ANY($1) com um único parâmetro array funciona com qualquer quantidade de ids e não exige montar SQL dinâmico com IN ($1,$2,...), que gera texto de consulta e plano diferentes a cada tamanho. O array vazio (cliente sem pedidos) é tratado com naturalidade.

### PostgreSQL 16 Documentation, 7.5. Sorting Rows (ORDER BY)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/queries-order.html>
- **Sustenta:** Garantir ordem determinística nas consultas reescritas (JOIN ou lote)
- **Verificação:** confirmada (1/1 citações encontradas na página)
- **Citações (literais):**
  - "If sorting is not chosen, the rows will be returned in an unspecified order. The actual order in that case will depend on the scan and join plan types and the order on disk, but it must not be relied on. A particular output ordering can only be guaranteed if the sort step is explicitly chosen." (7.5): Sem ORDER BY a ordem das linhas não é especificada. Ela depende do plano e da ordem em disco e não deve ser usada como garantia.
- **Custo ou risco segundo a fonte:** Depender de ordem implícita pode mudar o resultado quando o plano muda, por exemplo depois de criar índices em (c).
- **Opinião (aplicabilidade aqui):** o original ordena pedidos por criado_em DESC, id DESC e itens por id dentro de cada pedido. Qualquer reescrita precisa reproduzir isso com ORDER BY explícito (no lote: ORDER BY pedido_id, id; no JOIN: ORDER BY p.criado_em DESC, p.id DESC, i.id). A ordem dos produtos não importa, porque o lookup é por Map.

### Queries (node-postgres docs, Features)

- **Autor/organização:** Brian Carlson / projeto node-postgres (documentação atual (consultada em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://node-postgres.com/features/queries>
- **Sustenta:** Consultas parametrizadas com arrays JS (para ANY) e prepared statements nomeados, cujo plano fica em cache por conexão
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Converted to a string that describes a Postgres array." (Parameterized query / type conversion): Um array JavaScript passado como parâmetro vira um array PostgreSQL, o que permite usar ANY($1).
  - "the query execution plan will be cached on the PostgreSQL server on a per connection basis." (Prepared statements): Com prepared statements nomeados, o plano de execução fica em cache no servidor, por conexão.
- **Custo ou risco segundo a fonte:** Montar SQL concatenando strings 'can (and often does) lead to sql injection vulnerabilities'.
- **Correção do verificador:** Contexto: o cache do plano por conexão acontece só em prepared statements nomeados ('name' na query config).
- **Opinião (aplicabilidade aqui):** com conexão por consulta (o estado atual), qualquer cache por conexão, como prepared statements, se perde. É mais um ganho que só aparece com pool. A consulta em lote deve passar o array como parâmetro ($1), nunca concatenado.

### Data Types (node-postgres docs, Features)

- **Autor/organização:** Brian Carlson / projeto node-postgres (documentação atual (consultada em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://node-postgres.com/features/types>
- **Sustenta:** Como o driver converte tipos: o que muda se a montagem do JSON passar para o banco
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "node-postgres converts DATE and TIMESTAMP columns into the local time of the node process set at process.env.TZ." (Date / Timestamp): node-postgres converte DATE e TIMESTAMP para a hora local do processo Node (process.env.TZ), em objetos Date.
  - "node-postgres converts json/jsonb objects directly into their JavaScript object via JSON.parse." (JSON): Colunas json e jsonb chegam já convertidas em objetos JavaScript via JSON.parse.
- **Custo ou risco segundo a fonte:** Datas e timestamps dependem do TZ do processo Node.
- **Opinião (aplicabilidade aqui):** um criado_em que venha dentro de um json_agg chega como string, e não como Date, então a serialização final muda. Se o criado_em do pedido continuar como coluna normal, o contrato atual se mantém.

### brianc/node-pg-types (README)

- **Autor/organização:** Brian Carlson (mantenedor do node-postgres) (README atual (consultado em 2026-11-07))
- **Tipo:** técnica primária
- **Link:** <https://github.com/brianc/node-pg-types>
- **Sustenta:** Tipos numéricos: int8/bigint volta como string
- **Verificação:** confirmada (1/1 citações encontradas na página)
- **Citações (literais):**
  - "Because JavaScript doesn't have support for 64-bit integers [...] just returns int8 results as strings and leaves the parsing up to you." (README): Como JavaScript não tem inteiro de 64 bits nativo, o node-postgres devolve int8 como string e deixa a conversão para a aplicação.
- **Custo ou risco segundo a fonte:** Converter int8 para number pode perder precisão em valores acima de 2^53. Isso só é seguro se os valores couberem no intervalo esperado.
- **Opinião (aplicabilidade aqui):** se total_centavos passar a ser calculado em SQL (sum(quantidade*preco) devolve bigint), ele chega como string "1234" e não como número 1234, o que quebra o contrato. É preciso fazer cast ::int ou ::float8, ou manter o cálculo em JS como hoje.

### PostgreSQL 16 Documentation, 20.3. Connections and Authentication (max_connections)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/runtime-config-connection.html>
- **Sustenta:** Dimensionar o pool dentro do limite de conexões do servidor
- **Verificação:** confirmada (1/1 citações encontradas na página)
- **Citações (literais):**
  - "Determines the maximum number of concurrent connections to the database server. The default is typically 100 connections, but might be less if your kernel settings will not support it (as determined during initdb). This parameter can only be set at server start." (max_connections): max_connections costuma valer 100 por padrão e só pode ser alterado com o servidor reiniciado. superuser_reserved_connections reserva 3 vagas por padrão.
- **Custo ou risco segundo a fonte:** Acima de max_connections menos as vagas reservadas, só superusuários conseguem conectar.
- **Opinião (aplicabilidade aqui):** um pool de 10 a 20 numa única instância da API fica bem abaixo de 100. No estado atual, 20 VUs com rajadas de conexões novas ainda ficam dentro do limite, mas pagam fork e handshake a cada consulta.

## 3. Agregados, contagem, cache e log

### Count estimate

- **Autor/organização:** PostgreSQL Wiki (comunidade PostgreSQL) (s.d. (consultado em 2026-11-07))
- **Tipo:** técnica primária
- **Link:** <https://wiki.postgresql.org/wiki/Count_estimate>
- **Sustenta:** Contagem estimada via pg_class.reltuples ou via estimativa de linhas do EXPLAIN.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "This is only an estimate used by the planner." (pg_class.reltuples): O reltuples é só uma estimativa usada pelo planejador.
  - "If you didn't ANALYZE recently (after last changes), the estimates will be off more or less." (pg_class.reltuples): Sem ANALYZE recente após mudanças, a estimativa fica errada em maior ou menor grau.
- **Custo ou risco segundo a fonte:** É impreciso: depende de VACUUM/ANALYZE recentes. No exemplo da página, a estimativa deu 100 para 99 linhas reais. A função baseada em EXPLAIN fica sujeita a SQL injection se receber consulta não sanitizada.
- **Opinião (aplicabilidade aqui):** não serve aqui. O campo total de /pedidos precisa ser exato (contrato), e uma estimativa mudaria o valor devolvido.

### Faster PostgreSQL Counting

- **Autor/organização:** Joe Nelson / Citus Data (hoje Microsoft) (2016-10-12 (atualizado em nov/2020))
- **Tipo:** blog técnico
- **Link:** <https://www.citusdata.com/blog/2016/10/12/count-performance/>
- **Sustenta:** Compara contagem exata, tabela de contagem mantida por trigger, estimativas (reltuples/EXPLAIN) e index-only scan.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "There is no single universal row count that the database could cache, so it must scan through all rows counting how many are visible." (Why is count slow?): Com MVCC não existe uma contagem universal que o banco possa guardar em cache, então ele varre as linhas visíveis.
  - "However this technique shifts overhead to inserts and deletes." (Exact counts / trigger): A tabela de contagem mantida por trigger desloca o custo para inserções e exclusões.
  - "whereas inserts with the trigger are fifty times slower" (Exact counts / trigger): No teste do autor, as inserções com o trigger de contagem ficaram 50 vezes mais lentas.
- **Custo ou risco segundo a fonte:** Trigger de contagem: escrita muito mais lenta (50x no teste do autor). Estimativas: a precisão depende do planejador. O artigo não trata de contenção de bloqueio.
- **Opinião (aplicabilidade aqui):** é a fonte que quantifica o custo de escrita da tabela de contagem. A API do desafio só lê, então o custo de escrita não aparece no k6, mas existiria num sistema real.

### PostgreSQL 16 Documentation — 13.3. Explicit Locking (13.3.2 Row-Level Locks)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/explicit-locking.html>
- **Sustenta:** Base para o risco de linha quente: UPDATE concorrente na mesma linha de contador/resumo serializa as transações.
- **Verificação:** confirmada-com-correcao (a citação 1 foi trocada pelo texto literal do verificador; 2/2 literais)
- **Citações (literais):**
  - "That is, other transactions that attempt UPDATE, DELETE, SELECT FOR UPDATE, SELECT FOR NO KEY UPDATE, SELECT FOR SHARE or SELECT FOR KEY SHARE of these rows will be blocked until the current transaction ends;" (13.3.2 Row-Level Locks (FOR UPDATE)): Outras transações que tentem UPDATE, DELETE ou SELECT FOR UPDATE/NO KEY UPDATE em linhas bloqueadas esperam até o fim da transação atual.
  - "This lock mode is also acquired by any UPDATE that does not acquire a FOR UPDATE lock." (13.3.2 Row-Level Locks (FOR NO KEY UPDATE)): Todo UPDATE que não pega FOR UPDATE pega o modo FOR NO KEY UPDATE, que também conflita com outros escritores da mesma linha.
- **Custo ou risco segundo a fonte:** Escritores concorrentes na mesma linha ficam bloqueados até o commit ou rollback do primeiro.
- **Correção do verificador:** Texto literal de (1), em 13.3.2, modo FOR UPDATE: 'That is, other transactions that attempt UPDATE, DELETE, SELECT FOR UPDATE, SELECT FOR NO KEY UPDATE, SELECT FOR SHARE or SELECT FOR KEY SHARE of these rows will be blocked until the current transaction ends;'
- **Opinião (aplicabilidade aqui):** uma tabela de contagem por status teria só 4 linhas, e um resumo diário teria a linha do dia corrente. Toda inserção de pedido atualizaria a mesma linha e serializaria as transações: é a linha quente. A fonte não fala de contadores, a ligação é dedução minha.

### PostgreSQL 16 Documentation — 43.10. Trigger Functions (PL/pgSQL)

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/plpgsql-trigger.html>
- **Sustenta:** Tabela de resumo mantida por trigger (Exemplo 43.6) e trigger por comando com transition tables (Exemplo 43.7).
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "One use of triggers is to maintain a summary table of another table. The resulting summary can be used in place of the original table for certain queries — often with vastly reduced run times." (Exemplo 43.6): Um uso de triggers é manter uma tabela de resumo de outra tabela. O resumo pode substituir a tabela original em certas consultas, muitas vezes com tempo de execução bem menor.
  - "This can be significantly faster than the row-trigger approach when the invoking statement has modified many rows." (Exemplo 43.7): Um trigger por comando com transition table pode ser bem mais rápido que o trigger por linha quando o comando altera muitas linhas.
- **Custo ou risco segundo a fonte:** Por implicação do Exemplo 43.7, o trigger por linha é mais caro em escritas em lote. A doc não quantifica o custo por escrita.
- **Opinião (aplicabilidade aqui):** mantém top-produtos e vendas-por-dia sempre atuais. Exige triggers em itens_pedido e em pedidos (mudança de status para 'cancelado' altera a receita), além de backfill inicial. O esforço é alto para uma API que só lê.

### PostgreSQL 16 Documentation — REFRESH MATERIALIZED VIEW

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/sql-refreshmaterializedview.html>
- **Sustenta:** Materialized view com refresh completo ou CONCURRENTLY.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "REFRESH MATERIALIZED VIEW completely replaces the contents of a materialized view." (Description): O REFRESH substitui todo o conteúdo da materialized view, e o conteúdo antigo é descartado.
  - "Without this option a refresh which affects a lot of rows will tend to use fewer resources and complete more quickly, but could block other connections which are trying to read from the materialized view." (CONCURRENTLY): Sem CONCURRENTLY, o refresh tende a gastar menos recursos e terminar mais rápido, mas pode bloquear quem está lendo a view.
  - "This option is only allowed if there is at least one UNIQUE index on the materialized view which uses only column names and includes all rows;" (CONCURRENTLY): CONCURRENTLY exige pelo menos um índice UNIQUE só com nomes de coluna, sem expressão e sem WHERE.
- **Custo ou risco segundo a fonte:** O refresh recalcula tudo. Sem CONCURRENTLY bloqueia leitores, e com CONCURRENTLY exige índice único. Só um REFRESH por vez em cada view.
- **Correção do verificador:** Continuação de (3): '... includes all rows; that is, it must not be an expression index or include a WHERE clause.'
- **Opinião (aplicabilidade aqui):** encaixa bem no top-produtos (um agregado por produto, 20 mil linhas, índice único em produto_id) e num resumo diário (cerca de 731 dias, índice único em dia). Como os dados do desafio são estáticos, um refresh após a carga basta.

### Cache-Aside pattern — Azure Architecture Center

- **Autor/organização:** Microsoft (2025-09-11 (ms.date))
- **Tipo:** documentação oficial
- **Link:** <https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside>
- **Sustenta:** Cache-aside: carregar sob demanda, invalidar na escrita, expirar por TTL.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Don't make the expiration period too short because premature expiration can cause applications to continually retrieve data from the data store and add it to the cache. Similarly, don't make the expiration period so long that the cached data becomes stale." (Problems and considerations — Lifetime of cached data): Expiração curta demais faz a aplicação voltar ao banco o tempo todo. Expiração longa demais deixa o cache desatualizado.
  - "The Cache-Aside pattern doesn't guarantee consistency between the data store and the cache." (Problems and considerations — Consistency): O padrão não garante consistência entre o banco e o cache.
  - "Most requests don't experience a cache hit. In this situation, the overhead of checking the cache and loading data into it might outweigh the benefits of caching." (When to use this pattern): Quando a maioria das requisições não acerta o cache, o custo de consultar e carregar o cache pode superar o benefício.
- **Custo ou risco segundo a fonte:** Dados desatualizados, sem garantia de consistência, despejo por limite de tamanho, cache local incoerente entre instâncias. Não recomendado para dados sensíveis.
- **Opinião (aplicabilidade aqui):** no k6, top-produtos sempre usa limite=10 (uma chave, acerto perto de 100%) e as contagens têm 4 chaves (uma por status), então o cache rende muito. vendas-por-dia tem cerca de 725 janelas possíveis e acerta menos. Há só uma instância da API, então não há incoerência entre caches locais.

### Caching Best Practices

- **Autor/organização:** Amazon Web Services (s.d. (consultado em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://aws.amazon.com/caching/best-practices/>
- **Sustenta:** Lazy caching/cache-aside, TTL, thundering herd (dog piling), despejo por memória.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Lazy caching, also called lazy population or cache-aside, is the most prevalent form of caching." (Lazy caching): Lazy caching (cache-aside) é a forma mais comum de cache.
  - "Always apply a time to live (TTL) to all of your cache keys, except those you are updating by write-through caching." (Time-to-live): Recomenda aplicar TTL a todas as chaves, exceto as atualizadas por write-through.
  - "Also known as dog piling, the thundering herd effect is what happens when many different application processes" (The thundering herd): Descreve o efeito thundering herd (dog piling): muitos processos sofrem cache miss ao mesmo tempo e sobrecarregam o banco.
- **Custo ou risco segundo a fonte:** Dados desatualizados até o TTL vencer, thundering herd em miss simultâneo, despejo quando a memória enche.
- **Opinião (aplicabilidade aqui):** com 20 VUs em loop fechado, o primeiro miss do top-produtos pode disparar várias agregações pesadas iguais ao mesmo tempo. Coalescer numa única Promise (single-flight) ou pré-aquecer na inicialização evita isso.

### Scaling Memcache at Facebook

- **Autor/organização:** Rajesh Nishtala, Hans Fugal, Steven Grimm, Marc Kwiatkowski, Herman Lee, Harry C. Li, Ryan McElroy, Mike Paleczny, Daniel Peek, Paul Saab, David Stafford, Tony Tung, Venkateshwaran Venkataramani (Facebook) — USENIX NSDI '13 (2013 (10th USENIX Symposium on Networked Systems Design and Implementation, Lombard, IL))
- **Tipo:** acadêmica
- **Link:** <https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf>
- **Sustenta:** Cache look-aside sob demanda com invalidação por delete. Leases contra stale sets e thundering herds.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "we use memcache as a demand-filled look-aside cache as shown in Figure 1." (2 Overview — Query cache): O Facebook usa o memcache como cache look-aside preenchido sob demanda: em caso de miss, o servidor web lê do banco e popula o cache.
  - "A thundering herd happens when a specific key undergoes heavy read and write activity. As the write activity repeatedly invalidates the recently set values, many reads default to the more costly path." (3.2.1 Leases): Thundering herd: uma chave com muita leitura e escrita é invalidada repetidamente, e muitas leituras caem no caminho caro (o banco).
  - "Without leases, all of the cache misses resulted in a peak database query rate of 17K/s. With leases, the peak database query rate was 1.3K/s." (3.2.1 Leases): Com leases, o pico de consultas ao banco nos misses caiu de 17K/s para 1,3K/s.
- **Custo ou risco segundo a fonte:** Stale sets (valor velho gravado no cache por reordenação de atualizações concorrentes) e thundering herds exigem mecanismos extras (leases).
- **Opinião (aplicabilidade aqui):** em escala bem maior, mas valida o padrão look-aside e o risco de misses simultâneos. Aqui, uma Promise compartilhada por chave cumpre o papel do lease contra o thundering herd.

### Node.js v20 Documentation — Process: A note on process I/O

- **Autor/organização:** OpenJS Foundation / Node.js (Node.js v20 (latest-v20.x))
- **Tipo:** documentação oficial
- **Link:** <https://nodejs.org/docs/latest-v20.x/api/process.html>
- **Sustenta:** Em que casos process.stdout (usado pelo console.log) escreve de forma síncrona, e o risco de bloquear o event loop.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Files: synchronous on Windows and POSIX" (A note on process I/O): Escrita em arquivo é síncrona no Windows e em POSIX.
  - "Pipes (and sockets): synchronous on Windows, asynchronous on POSIX" (A note on process I/O): Em pipes e sockets a escrita é síncrona no Windows e ASSÍNCRONA em POSIX (Linux incluído).
  - "Synchronous writes block the event loop until the write has completed." (A note on process I/O — Warning): Escritas síncronas bloqueiam o event loop até terminar, e a doc pede cuidado com log de produção nos streams do processo.
- **Custo ou risco segundo a fonte:** Sob carga alta, com pipes que não são lidos do outro lado ou com terminais/sistemas de arquivos lentos, o event loop pode ficar bloqueado o bastante para degradar muito o desempenho.
- **Opinião (aplicabilidade aqui):** CORREÇÃO DE PREMISSA. A doc do Node 20 diz que pipes são assíncronos em POSIX, não síncronos no Linux. No Docker sem TTY, o stdout do container costuma ser um pipe, então o console.log provavelmente não bloqueia na escrita. O custo principal do middleware passa a ser a CPU: um JSON.stringify extra do corpo inteiro por requisição, além do que res.json já faz. Some-se o buffer em memória se o coletor de logs atrasar, o volume de log e os dados pessoais. Vale medir antes de afirmar.

### Production best practices: performance and reliability

- **Autor/organização:** Express.js (OpenJS Foundation) (s.d. (consultado em 2026-11-07))
- **Tipo:** documentação oficial
- **Link:** <https://expressjs.com/en/advanced/best-practice-performance.html>
- **Sustenta:** Não usar console.log em produção. Usar biblioteca de log (Pino) e evitar funções síncronas.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "But these functions are synchronous when the destination is a terminal or a file, so they are not suitable for production, unless you pipe the output to another program." (Do logging correctly): console.log/console.error são síncronos quando o destino é terminal ou arquivo, então não servem para produção, a menos que a saída vá por pipe para outro programa.
  - "instead of using console.log(), use a logging library like Pino, which is the fastest and most efficient option available." (Do logging correctly — For app activity): Para logar atividade da aplicação, recomenda trocar o console.log por uma biblioteca como o Pino.
- **Custo ou risco segundo a fonte:** Chamadas síncronas somam e reduzem o desempenho em sites de alto tráfego.
- **Opinião (aplicabilidade aqui):** bate com a doc do Node (síncrono para terminal/arquivo, e a ressalva do pipe). É a recomendação oficial do framework para trocar o console.log do middleware.

### pino — README (Low overhead / Transports)

- **Autor/organização:** Pino (pinojs, mantenedores) (branch main (consultado em 2026-11-07))
- **Tipo:** técnica primária
- **Link:** <https://raw.githubusercontent.com/pinojs/pino/main/README.md>
- **Sustenta:** Logger JSON de baixo custo, com processamento de log fora do event loop principal (transports em worker thread).
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Using minimum resources for logging is very important." (Low overhead): Gastar o mínimo de recursos com log é muito importante.
  - "Log messages tend to get added over time and this can lead to a throttling effect on applications" (Low overhead): As mensagens de log se acumulam com o tempo e podem estrangular a aplicação (menos requisições por segundo).
  - "it's highly recommended that sending, alert triggering, reformatting, and all forms of log processing" (Transports): Recomenda fazer envio, alertas, reformatação e todo processamento de log em outro processo ou thread.
- **Custo ou risco segundo a fonte:** Log acumulado reduz a vazão. Processar log no processo principal compete com o event loop.
- **Opinião (aplicabilidade aqui):** numa API limitada a 0,5 CPU, cada ciclo gasto com log sai das requisições. Pino com redact e sem o corpo é a alternativa robusta, mas a dependência nova precisa ser justificada.

### pino — Asynchronous Logging (docs/asynchronous.md)

- **Autor/organização:** Pino (pinojs, mantenedores) (branch main (consultado em 2026-11-07))
- **Tipo:** técnica primária
- **Link:** <https://raw.githubusercontent.com/pinojs/pino/main/docs/asynchronous.md>
- **Sustenta:** Log assíncrono com buffer (pino.destination com sync: false) e seus riscos.
- **Verificação:** confirmada-com-correcao (2/3 citações encontradas na página)
- **Citações (literais):**
  - "Asynchronous logging enables the minimum overhead of Pino." (Asynchronous Logging): O log assíncrono dá o menor custo possível ao Pino.
  - "Asynchronous logging works by buffering log messages and writing them in larger chunks." (Asynchronous Logging): Funciona juntando mensagens num buffer e gravando em blocos maiores.
  - "There is a possibility of the most recently buffered log messages being lost in case of a system failure, e.g. a power cut." (Caveats): As mensagens mais recentes no buffer podem se perder (por exemplo, numa queda abrupta).
- **Custo ou risco segundo a fonte:** Perda das últimas linhas em crash. Em AWS Lambda, logs atrasados ou perdidos. Uma chamada de log deixa de corresponder a uma escrita.
- **Correção do verificador:** Texto literal de (3): 'There is a possibility of the most recently buffered log messages being lost in case of a system failure, e.g. a power cut.'
- **Opinião (aplicabilidade aqui):** aceitável para log de acesso. Para erros fatais, vale manter escrita síncrona ou um flush na saída.

### Logging Cheat Sheet

- **Autor/organização:** OWASP Cheat Sheet Series (s.d. (consultado em 2026-11-07))
- **Tipo:** técnica primária
- **Link:** <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- **Sustenta:** O que não registrar em log (dados pessoais, segredos) e proteção contra o log esgotar recursos.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "The following should usually not be recorded directly in the logs" (Data to exclude): Lista dados que em geral não devem ir diretamente para o log. Pede que sejam removidos, mascarados, sanitizados, transformados em hash ou criptografados.
  - "Sensitive personal data and some forms of personally identifiable information (PII)" (Data to exclude): A lista inclui dados pessoais sensíveis e algumas formas de informação pessoal identificável (PII).
  - "Ensure logging cannot be used to deplete system resources" (Protection / Event collection): Pede garantir que o log não possa ser usado para esgotar recursos do sistema.
- **Custo ou risco segundo a fonte:** Logs podem ser alvo de ataque, e inundar o log pode esgotar o disco.
- **Correção do verificador:** Continuação de (1): '..., but instead should be removed, masked, sanitized, hashed, or encrypted:'. Continuação de (3): '..., for example by filling up disk space or exceeding database transaction log space, leading to denial of service.'
- **Opinião (aplicabilidade aqui):** o middleware grava nome, e-mail e cidade dos clientes e o histórico de pedidos. Também grava a URL de GET /clientes?email=..., que expõe o e-mail na query string. Tirar o corpo do log resolve a maior parte. Mascarar ou omitir a query string resolve o resto.

### Lei nº 13.709, de 14 de agosto de 2018 — Lei Geral de Proteção de Dados Pessoais (LGPD)

- **Autor/organização:** Presidência da República — Planalto (legislação federal brasileira) (2018)
- **Tipo:** documentação oficial
- **Link:** <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm>
- **Sustenta:** Princípios da LGPD (necessidade, segurança) aplicados ao log: não registrar dados pessoais além do necessário.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "I - dado pessoal: informação relacionada a pessoa natural identificada ou identificável;" (Art. 5º, I): Dado pessoal é informação relacionada a pessoa natural identificada ou identificável. Nome e e-mail de cliente se enquadram.
  - "III - necessidade: limitação do tratamento ao mínimo necessário para a realização de suas finalidades," (Art. 6º, III): Princípio da necessidade: o tratamento deve se limitar ao mínimo necessário para a finalidade.
  - "Os agentes de tratamento devem adotar medidas de segurança, técnicas e administrativas aptas a proteger os dados pessoais" (Art. 46, caput): Os agentes de tratamento devem adotar medidas de segurança técnicas e administrativas para proteger os dados pessoais.
- **Custo ou risco segundo a fonte:** A lei não trata de desempenho. O risco é de conformidade: registrar dados pessoais em log sem necessidade contraria o princípio da necessidade.
- **Opinião (aplicabilidade aqui):** gravar o corpo inteiro da resposta (nome, e-mail) em cada log de acesso não é necessário para a finalidade de observabilidade. Isso dá justificativa legal, além da de desempenho, para tirar o corpo do log.

## 4. Metodologia, recursos e custo

### Open Versus Closed: A Cautionary Tale

- **Autor/organização:** Bianca Schroeder, Adam Wierman, Mor Harchol-Balter (Carnegie Mellon University) (2006 (3rd USENIX Symposium on Networked Systems Design & Implementation, NSDI '06, San Jose, CA, maio de 2006))
- **Tipo:** acadêmica
- **Link:** <https://www.usenix.org/legacy/events/nsdi06/tech/full_papers/schroeder/schroeder_html/index.html>
- **Sustenta:** Distinguir gerador de carga fechado (nova requisição só após a anterior terminar, como o constant-vus do k6) de aberto (chegadas independentes das conclusões); usar modelo aberto ou parcialmente aberto quando ele representa melhor o tráfego, e Lei de Little (N = X·E[T]) para interpretar sistemas fechados.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "choosing a workload generator based on a closed model can greatly underestimate response times" (9 Conclusion (fragmento literal; a frase completa é mais longa)): Escolher um gerador baseado em modelo fechado pode subestimar muito os tempos de resposta.
  - "the mean response time for an open system model can exceed that for a closed system model by an order of magnitude or more" (1 Introduction): O tempo médio de resposta num modelo aberto pode passar o do modelo fechado em uma ordem de grandeza ou mais.
  - "To see why, note that in a closed system Little's Law states that N=X E[T], where N is the constant MPL across policies." (5.2 The impact of scheduling): Num sistema fechado, a Lei de Little dá N = X·E[T], com N fixo (o número de usuários/MPL); logo, com N constante, o tempo de resposta médio é determinado pela vazão. A fila fica limitada a N mesmo sob carga muito alta.
- **Custo ou risco segundo a fonte:** O artigo não diz que o modelo aberto é sempre o certo: dá regras práticas e afirma que sistemas parcialmente abertos com muitas requisições por sessão (mais de 10) se comportam como fechados ('a high number of requests per session (more than 10) suggests a closed model'). Trocar o modelo sem critério também distorce a medição.
- **Correção do verificador:** Ao usar a citação 1, manter a condição do original: 'in capacity planning for an open system, choosing a workload generator based on a closed model can greatly underestimate response times'. Ao usar a citação 2, manter 'for a fixed load, the mean response time for an open system model can exceed that for a closed system model by an order of magnitude or more.'
- **Opinião (aplicabilidade aqui):** aplica-se diretamente. O k6 do desafio usa 20 VUs sem pausa, ou seja, um sistema fechado com N=20 e think time zero. Pela Lei de Little, o tempo médio de resposta é cerca de 20/vazão: na linha de base, 20/2,34 req/s dá uns 8,5 s (conta minha, com a mediana de analise/medianas.md). Por isso latência e vazão não são métricas independentes nesse cenário, e a p95 medida tende a subestimar a de tráfego real (aberto). Manter o cenário fechado para comparar com a linha de base faz sentido, mas vale complementar com um cenário aberto.

### Open and closed models (k6 documentation)

- **Autor/organização:** Grafana Labs (k6) (acessado em 2026-11-07 (versão latest da documentação))
- **Tipo:** documentação oficial
- **Link:** <https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/>
- **Sustenta:** Entender que constant-vus é modelo fechado (o tempo de resposta controla a vazão do teste) e que constant-arrival-rate/ramping-arrival-rate implementam o modelo aberto, que evita coordinated omission.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "In a closed model, the execution time of each iteration dictates the number of iterations executed in your test." (Closed model): No modelo fechado, a duração de cada iteração determina quantas iterações o teste executa.
  - "In some testing literature, this problem is known as coordinated omission." (Closed model): No modelo fechado, o tempo de resposta do sistema testado influencia a vazão do teste; a literatura chama esse problema de coordinated omission.
  - "k6 implements the open model with two arrival rate executors" (Open model): O k6 implementa o modelo aberto com dois executores de taxa de chegada (constant-arrival-rate e ramping-arrival-rate).
- **Custo ou risco segundo a fonte:** A página diz que o modelo fechado não serve quando o objetivo é uma taxa de chegada ou vazão específica (requisições por segundo), porque o sistema lento reduz a própria carga: 'the target system's response time can influence the throughput of the test'.
- **Opinião (aplicabilidade aqui):** confirma, pela documentação do próprio k6 (versão 0.54.0 no docker-compose), que o teste atual (20 VUs constantes) é fechado. Em cenário fechado, a métrica principal de comparação deve ser a vazão, com as latências lidas junto com ela.

### Constant arrival rate (k6 executor)

- **Autor/organização:** Grafana Labs (k6) (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/>
- **Sustenta:** Cenário de modelo aberto: iniciar um número fixo de iterações por unidade de tempo, independente da resposta do sistema, com preAllocatedVUs/maxVUs.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "iterations start independently of system response" (Descrição do executor): No constant-arrival-rate, as iterações começam independentemente da resposta do sistema.
  - "Number of iterations to start during each `timeUnit` period." (Options): rate é o número de iterações iniciadas em cada período timeUnit.
  - "Using too low of a `preAllocatedVUs` setting will reduce the test duration at the desired rate" (Options / aviso): preAllocatedVUs baixo demais reduz o tempo do teste em que a taxa desejada é mantida.
- **Custo ou risco segundo a fonte:** Exige dimensionar VUs (preAllocatedVUs/maxVUs). Com VUs a menos, o teste não sustenta a taxa pedida.
- **Opinião (aplicabilidade aqui):** bom como cenário complementar, sem substituir o oficial. Com a linha de base a uns 2,3 req/s (analise/medianas.md), uma taxa fixa acima disso faria a versão original acumular fila e timeouts. Para comparar antes e depois no mesmo cenário aberto, a taxa precisa ser sustentável pela versão mais lenta. A outra opção é usar o cenário aberto só para caracterizar a versão otimizada.

### VU allocation for arrival-rate executors (k6 documentation)

- **Autor/organização:** Grafana Labs (k6) (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/arrival-rate-vu-allocation/>
- **Sustenta:** Dimensionar VUs no modelo aberto pela relação concorrência ≈ duração da iteração × taxa, a forma da Lei de Little.
- **Verificação:** confirmada-com-correcao (2/2 citações encontradas na página)
- **Citações (literais):**
  - "preAllocatedVUs = [median_iteration_duration * rate] + constant_for_variance" (Pre-allocation): Fórmula de estimativa dos VUs pré-alocados: duração mediana da iteração × taxa, mais uma folga para variância.
  - "The necessary allocation depends on the iteration duration: longer durations need more VUs." (Pre-allocation): A alocação necessária depende da duração da iteração: iterações mais longas pedem mais VUs.
- **Custo ou risco segundo a fonte:** A própria página trata a fórmula como estimativa ideal ('In a perfect world'). A variância da duração exige folga.
- **Correção do verificador:** Título: 'Arrival-rate VU allocation (Grafana k6 documentation)'.
- **Opinião (aplicabilidade aqui):** a página não cita a Lei de Little, mas a fórmula é exatamente L = λ·W. A Lei de Little vem de schroeder-nsdi06. Serve para checar a consistência dos resultados: no cenário fechado, VUs ≈ vazão × latência média.

### Dropped iterations (k6 documentation)

- **Autor/organização:** Grafana Labs (k6) (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/>
- **Sustenta:** No modelo aberto, monitorar a métrica dropped_iterations como sinal de saturação do sistema testado ou de VUs insuficientes.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "With `constant-arrival-rate` and `ramping-arrival-rate`, iterations drop if there are no free VUs." (Dropped iterations): Nos executores de taxa de chegada, iterações são descartadas quando não há VUs livres.
  - "Many dropped iterations might indicate that your SUT has completely stopped responding." (Dropped iterations): Muitas iterações descartadas podem indicar que o sistema testado parou de responder.
- **Custo ou risco segundo a fonte:** Descartes no início do teste indicam falta de VUs pré-alocados, um problema de configuração do teste e não do sistema. Descartes mais tarde podem indicar degradação do SUT. É preciso distinguir os dois casos.
- **Opinião (aplicabilidade aqui):** se houver cenário aberto, reportar dropped_iterations junto com a p95. Uma p95 'boa' com muitos descartes é enganosa.

### wrk2 - a constant throughput, correct latency recording variant of wrk (README)

- **Autor/organização:** Gil Tene (autor do wrk2 e do HdrHistogram) (acessado em 2026-11-07)
- **Tipo:** técnica primária
- **Link:** <https://github.com/giltene/wrk2>
- **Sustenta:** Medir a latência a partir do instante em que a requisição deveria ter sido enviada (carga de vazão constante), corrigindo a coordinated omission dos geradores em laço fechado.
- **Verificação:** confirmada-com-correcao (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Since each connection will only begin to send a request after receiving a response" (README, discussão de Coordinated Omission (fragmento literal)): Em geradores em que cada conexão só envia a próxima requisição depois de receber a resposta, as respostas lentas atrasam as requisições seguintes.
  - "a strong Coordinated Omission effect, through which most of the high latency artifacts" (README (fragmento literal)): Isso produz um forte efeito de Coordinated Omission, que esconde a maior parte dos artefatos de alta latência.
  - "wrk2 measures response latency from the time the transmission should have occurred" (README (fragmento literal)): O wrk2 mede a latência a partir do momento em que a transmissão deveria ter ocorrido.
- **Custo ou risco segundo a fonte:** Exige uma taxa-alvo fixa. O README trata de ferramenta específica (wrk2); no k6 o equivalente é usar executores arrival-rate.
- **Correção do verificador:** Título: 'wrk2 - a HTTP benchmarking tool based mostly on wrk (README)'. Se preferir, citar como descrição do repositório: 'A constant throughput, correct latency recording variant of wrk'.
- **Opinião (aplicabilidade aqui):** fundamenta por que a p95/p99 do cenário de 20 VUs fechado é otimista. Não sugiro trocar o k6 pelo wrk2: o cenário do desafio é k6. Serve como justificativa teórica no relatório.

### Site Reliability Engineering, Chapter 4 - Service Level Objectives

- **Autor/organização:** Google (livro SRE, sre.google) (acessado em 2026-11-07 (livro de 2016))
- **Tipo:** técnica primária
- **Link:** <https://sre.google/sre-book/service-level-objectives/>
- **Sustenta:** Usar percentis (p50, p95, p99) em vez da média para latência, porque a média esconde a cauda.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "We generally prefer to work with percentiles rather than the mean (arithmetic average) of a set of values." (Aggregation): O Google prefere trabalhar com percentis em vez da média aritmética.
  - "A simple average can obscure these tail latencies, as well as changes in them." (Aggregation): Uma média simples pode esconder a latência de cauda e as mudanças nela.
  - "a high-order percentile, such as the 99th or 99.9th, shows you a plausible worst-case value" (Aggregation): Um percentil alto, como o 99º ou o 99,9º, mostra um valor plausível de pior caso.
- **Custo ou risco segundo a fonte:** Percentis altos precisam de muitas amostras para ser estáveis (inferência minha). A fonte observa que a mediana (p50) 'emphasizes the typical case'.
- **Correção do verificador:** Opcional: dar os autores do capítulo (Chris Jones, John Wilkes, Niall Murphy, com Cody Smith) além de 'Google'.
- **Opinião (aplicabilidade aqui):** justifica reportar p95/p99. Mas na linha de base há rotas com 1 a 48 amostras por execução (top-produtos tem n=1 ou 2; resultados/*-00-linha-de-base/resumo.txt), e com isso a p95 por rota é estatisticamente instável. É uma causa provável da variação acima de 30% entre execuções. Reportar o n por rota junto do percentil.

### Is Big Data Performance Reproducible in Modern Cloud Networks?

- **Autor/organização:** Alexandru Uta, Alexandru Custura, Dmitry Duplyakin, Ivo Jimenez, Jan Rellermeyer, Carlos Maltzahn, Robert Ricci, Alexandru Iosup (2020 (17th USENIX Symposium on Networked Systems Design and Implementation, NSDI '20, Santa Clara, CA))
- **Tipo:** acadêmica
- **Link:** <https://www.usenix.org/system/files/nsdi20-paper-uta.pdf>
- **Sustenta:** Sob variabilidade, fazer muitas repetições e reportar medianas e percentis com intervalos de confiança não paramétricos. Três execuções não bastam para calcular IC. (PDF aberto com WebFetch, que salvou o binário; as citações foram extraídas desse mesmo arquivo com pdftotext.)
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "In the presence of variability, large numbers of experiment repetitions must be performed to achieve tight confidence intervals [47]." (1 Introduction): Na presença de variabilidade, é preciso um grande número de repetições para obter intervalos de confiança estreitos.
  - "Three repetitions are insufficient to calculate CIs; we plot medians because this is representative of what is often found in the literature." (2.1, nota de rodapé 2): Três repetições são insuficientes para calcular intervalos de confiança.
  - "Of the eight cloud bandwidth distributions, the 3-run median falls outside of the gold-standard CI for six of them (75%), and the 10-run median for three (38%)." (2.1 How credible are experiments with few repetitions?): Nos experimentos dos autores, a mediana de 3 execuções caiu fora do IC de referência em 6 de 8 distribuições (75%), e a de 10 execuções em 3 de 8 (38%).
- **Custo ou risco segundo a fonte:** Mais repetições custam tempo de experimento. Os autores dizem que estimar a cauda (p90) é ainda mais difícil: 'it is even more difficult to get robust tail performance estimates'.
- **Opinião (aplicabilidade aqui):** o contexto é rede de nuvem e big data, não uma API local. O resultado estatístico (3 execuções não dão IC; a mediana de 3 é pouco confiável sob alta variância) se transfere bem para o caso de variação acima de 30%. Sugere ir para 5 a 10 execuções ou alongar cada uma.

### Methodological Principles for Reproducible Performance Evaluation in Cloud Computing (SPEC RG Technical Report SPEC-RG-2019-03; versão revisada publicada no IEEE Transactions on Software Engineering 47(8):1528-1543, 2021)

- **Autor/organização:** Alessandro V. Papadopoulos, Laurens Versluis, André Bauer, Nikolas Herbst, Jóakim von Kistowski, Ahmed Ali-Eldin, Cristina L. Abad, José Nelson Amaral, Petr Tůma, Alexandru Iosup (SPEC RG Cloud) (relatório técnico de 1º de abril de 2019; artigo IEEE TSE 2021)
- **Tipo:** acadêmica
- **Link:** <https://research.spec.org/fileadmin/user_upload/documents/rg_cloud/endorsed_publications/SPEC_RG_2019_Methodological_Principles_for_Reproducible_Performance_Evaluation_in_Cloud_Computing.pdf> · DOI: 10.1109/TSE.2019.2927908
- **Sustenta:** Oito princípios metodológicos: repetições justificadas com confiança quantificada (P1), distribuição completa e não só a média (P5), avaliação estatística (P6), unidades (P7) e custo com modelo explícito, uso de recurso por segundo e custo cobrado (P8). (PDF aberto com WebFetch, que salvou o binário; as citações foram extraídas desse mesmo arquivo com pdftotext. A hifenização de linha foi removida.)
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "P1: Repeated experiments. After identifying the sources of variability, decide how many repetitions with the same configuration of the experiment should be run, and then quantify the confidence in the final result." (2 Experiment Methodology, P1): P1: identificar as fontes de variabilidade, decidir quantas repetições rodar e quantificar a confiança no resultado final.
  - "P8: Cost. Every cloud experiment should include (i) the cost model used or assumed for the experiment; (ii) accounted resource usage (per second), independently of the model; and (iii) charged cost according to the model." (2 Experiment Methodology, P8): P8: todo experimento deve trazer o modelo de custo, o uso de recursos contabilizado por segundo e o custo cobrado segundo o modelo.
  - "The SPEC CPU 2017 benchmark reports the median value of three runs, or the minimum (worse) value if only two runs where executed." (Comparação com benchmarks da indústria, P5): Benchmarks da indústria costumam reportar só médias. Há exceções: o SPEC CPU 2017 reporta a mediana de três execuções.
- **Custo ou risco segundo a fonte:** O texto de P1 diz que escolher o número de repetições sem justificativa ou sem ligá-lo à precisão exigida 'is not sufficient'. O texto de P6 afirma que testes paramétricos (t de Student/Welch) só cabem para dados normais e que outros casos pedem métodos não paramétricos.
- **Correção do verificador:** Se citar o TSE, indicar que a referência não vem desta URL: 'IEEE Transactions on Software Engineering, 47(8):1528-1543, 2021 (early access 2019)'.
- **Opinião (aplicabilidade aqui):** é a melhor base para as duas pontas do grupo. A mediana de 3 tem precedente na indústria (SPEC CPU), mas deve vir com dispersão e com a justificativa do número de repetições (P1, P5). P8 dá o formato do relatório de custo: modelo (tarifas Fargate), uso por segundo (vCPU e GB alocados × duração) e custo resultante.

### Resource constraints (Docker Engine documentation)

- **Autor/organização:** Docker Inc. (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://docs.docker.com/engine/containers/resource_constraints/>
- **Sustenta:** Limitar CPU com --cpus (equivalente a cpu-period/cpu-quota do CFS) ou fixar núcleos com --cpuset-cpus; limitar memória com --memory, sabendo que estourar o limite leva ao OOM killer.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "If you have 1 CPU, each of the following commands guarantees the container at most 50% of the CPU every second." (CPU / --cpus): Com 1 CPU, --cpus=".5" garante ao container no máximo 50% da CPU a cada segundo. É um teto, não uma reserva.
  - "By default, if an out-of-memory (OOM) error occurs, the kernel kills processes in a container." (Memory / Understand the risks of running out of memory): Por padrão, num erro de falta de memória (OOM), o kernel mata processos dentro do container.
  - "Perform tests to understand the memory requirements of your application before placing it into production." (Memory): A documentação recomenda testar para entender os requisitos de memória da aplicação antes de ir para produção.
- **Custo ou risco segundo a fonte:** Limites de memória baixos demais disparam o OOM killer ('Any process is subject to killing'). --memory-reservation é limite brando e 'doesn't guarantee that the container doesn't exceed the limit'. --cpuset-cpus restringe a núcleos específicos.
- **Opinião (aplicabilidade aqui):** base para reduzir os limites com segurança: reduzir aos poucos e registrar OOMKilled e erros em cada passo. O container k6 roda no mesmo host sem limite. Dar a ele núcleos separados (--cpuset-cpus/cpuset) ou um limite próprio pode reduzir a interferência e a variância. Em Docker Desktop/WSL2 os núcleos são os da VM.

### Compose Deploy Specification - resources (Docker documentation)

- **Autor/organização:** Docker Inc. (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://docs.docker.com/reference/compose-file/deploy/>
- **Sustenta:** Declarar limites (limits) e reservas (reservations) de cpus/memory no docker-compose.yml, que é o mecanismo já usado no desafio.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "`limits`: The platform must prevent the container from allocating more resources." (resources): limits: a plataforma deve impedir que o container aloque mais recursos.
  - "`reservations`: The platform must guarantee the container can allocate at least the configured amount." (resources): reservations: a plataforma deve garantir que o container possa alocar pelo menos a quantidade configurada.
  - "`cpus` configures a limit or reservation for how much of the available CPU resources, as number of cores" (resources / cpus): cpus configura limite ou reserva em número de núcleos.
- **Custo ou risco segundo a fonte:** A página só define a semântica. Não traz custo nem desvantagem explícita.
- **Opinião (aplicabilidade aqui):** a configuração 'mais barata' deve ser entregue mudando deploy.resources.limits no compose. Com isso, cada medição registra exatamente os limites usados (P3/P8 do SPEC RG).

### CFS Bandwidth Control (Linux kernel documentation)

- **Autor/organização:** The Linux Kernel documentation (kernel.org) (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://docs.kernel.org/scheduler/sched-bwc.html>
- **Sustenta:** Entender o mecanismo por trás do --cpus: quota por período (padrão de 100 ms) compartilhada por todas as threads e processos do grupo, com throttling ao esgotar. Diagnosticar por cpu.stat (nr_throttled, throttled_time).
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Within each given "period" (microseconds), a task group is allocated up to "quota" microseconds of CPU time." (Introdução): Em cada período, o grupo de tarefas recebe até 'quota' microssegundos de CPU.
  - "Throttled threads will not be able to run again until the next period when the quota is replenished." (Management / throttling): Esgotada a quota, as threads do grupo sofrem throttling e só voltam a rodar no período seguinte.
  - "nr_throttled: Number of times the group has been throttled/limited." (Statistics): cpu.stat expõe nr_throttled, o número de vezes que o grupo foi limitado.
- **Custo ou risco segundo a fonte:** O throttling atrasa a execução até o próximo período, o que afeta a latência. A documentação diz que período pequeno dá latência mais consistente 'at the expense of burst capacity'.
- **Opinião (aplicabilidade aqui):** explica por que um cluster de vários processos Node em 0,5 CPU não ganha capacidade: todos dividem a mesma quota (50 ms a cada 100 ms) e podem esgotá-la mais cedo no período, aumentando a cauda. Também é uma métrica barata para entender variância e o efeito de reduzir CPU: ler /sys/fs/cgroup/cpu.stat dentro do container antes e depois do teste.

### AWS Fargate Pricing

- **Autor/organização:** Amazon Web Services (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://aws.amazon.com/fargate/pricing/>
- **Sustenta:** Traduzir os recursos alocados (vCPU e GB por tempo) em custo usando as tarifas por segundo do Fargate, US East (N. Virginia), Linux/x86. ATENÇÃO: as tabelas de preço por hora vieram VAZIAS no texto devolvido pelo WebFetch (são carregadas dinamicamente). Os únicos números presentes no texto são as tarifas POR SEGUNDO dos exemplos, citadas abaixo. A conversão para hora é cálculo meu: 0,000011244 × 3600 = US$ 0,0404784 por vCPU-hora e 0,000001235 × 3600 = US$ 0,004446 por GB-hora, não lidos na página.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "using the Linux/X86 pricing for US East (N. Virginia) Region where CPU cost: $0.000011244 per vCPU second" (Pricing examples, Example 1): Exemplo da página com preço Linux/x86 na região US East (N. Virginia): CPU a US$ 0,000011244 por vCPU-segundo.
  - "CPU cost: $0.000011244 per vCPU second, memory cost: $0.000001235 per GB per second" (Pricing examples, Example 1): No mesmo exemplo, a memória custa US$ 0,000001235 por GB-segundo.
  - "Pricing is calculated per second with a 1-minute minimum." (Pricing details): A cobrança é por segundo, com mínimo de 1 minuto.
- **Custo ou risco segundo a fonte:** Preço por região, sistema operacional e arquitetura ('pricing is calculated based on the vCPU, memory, Operating Systems, CPU Architecture' e armazenamento). No exemplo 2, o Linux/ARM (Graviton) tem tarifa menor: 'CPU cost: $0.0000089944 per vCPU second'. Os preços podem mudar depois da data de acesso.
- **Opinião (aplicabilidade aqui):** OPINIÃO e cálculo meu: pelas tarifas por segundo, 1 vCPU custa cerca de 9,1 vezes 1 GB (0,000011244/0,000001235). A configuração atual (API 0,5 vCPU + 0,25 GB; banco 1 vCPU + 0,5 GB) daria uns US$ 0,0641/h, cerca de US$ 46,8 por mês de 730 h, e uns 95% disso é CPU. Portanto, cortar CPU importa muito mais que cortar memória. Uma métrica útil é o custo por milhão de requisições = custo/h ÷ (req/s × 3600) × 10^6. Na linha de base (2,34 req/s, mediana) daria uns US$ 7,60 por milhão (calculado por analise/medianas.js). É um modelo proxy: o desafio roda em Docker local, não no Fargate.

### Amazon ECS task definition differences for Fargate - Task CPU and memory

- **Autor/organização:** Amazon Web Services (Amazon ECS Developer Guide) (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html>
- **Sustenta:** Arredondar a configuração para a grade de tamanhos de tarefa válidos do Fargate e não aplicar só a conta linear.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Amazon ECS task definitions for AWS Fargate require that you specify CPU and memory at the task level." (Task CPU and memory): Tarefas Fargate exigem CPU e memória especificadas no nível da tarefa.
  - "512 (.5 vCPU) | 1 GB, 2 GB, 3 GB, 4 GB | Linux" (Tabela de combinações válidas): Com 0,5 vCPU, as memórias válidas são 1, 2, 3 ou 4 GB; com 0,25 vCPU, 512 MiB, 1 GB ou 2 GB; com 1 vCPU, de 2 a 8 GB.
- **Custo ou risco segundo a fonte:** A grade impõe memória mínima por faixa de CPU, e o cliente paga memória que talvez não use.
- **Opinião (aplicabilidade aqui):** a API atual (0,5 vCPU/256 MB) e o banco (1 vCPU/512 MB) não são tamanhos válidos no Fargate. No modelo realista, a API iria para 0,5 vCPU/1 GB e o banco para 1 vCPU/2 GB. Reduzir a API para 0,25 vCPU permitiria 512 MiB. Reportar os dois números: o custo linear (proxy) e o custo pela grade.

### PostgreSQL 16 Documentation - 32.2 When to JIT?

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16; acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/jit-decision.html>
- **Sustenta:** Desligar o JIT ou elevar jit_above_cost em carga OLTP de consultas curtas. O JIT compensa principalmente em consultas analíticas longas e CPU-bound.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "JIT compilation is beneficial primarily for long-running CPU-bound queries. Frequently these will be analytical queries." (32.2): O JIT beneficia principalmente consultas longas e CPU-bound, frequentemente analíticas.
  - "For short queries the added overhead of performing JIT compilation will often be higher than the time it can save." (32.2): Em consultas curtas, o custo de compilar com JIT costuma ser maior que o tempo economizado.
  - "The estimated cost of the query will be compared with the setting of jit_above_cost. If the cost is higher, JIT compilation will be performed." (32.2): O JIT é usado quando o custo estimado da consulta passa de jit_above_cost.
- **Custo ou risco segundo a fonte:** Inlining e otimização aumentam o overhead de compilação: 'Each of these options increases the JIT compilation overhead, but can reduce query execution time considerably.' Desligar o JIT pode piorar consultas analíticas pesadas.
- **Opinião (aplicabilidade aqui):** o problema maior é no estado original. As varreduras e agregações sem índice têm custo estimado acima de 100000 e disparam JIT em consultas frequentes, como pedidos por status e vendas-por-dia, gastando CPU num banco de 1 vCPU. Depois dos índices, o custo cai e o JIT tende a sumir sozinho. Medir com EXPLAIN (ANALYZE) e verificar a seção 'JIT:' antes de decidir.

### PostgreSQL 16 Documentation - 20.4 Resource Consumption

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16; acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/runtime-config-resource.html>
- **Sustenta:** Dimensionar shared_buffers (cerca de 25% da RAM), work_mem (lembrando que se multiplica por operação e por sessão) e paralelismo (max_parallel_workers_per_gather) para um container de 1 CPU e 512 MB.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "If you have a dedicated database server with 1GB or more of RAM, a reasonable starting value for shared_buffers is 25% of the memory in your system." (shared_buffers): Num servidor dedicado com 1 GB ou mais de RAM, um valor inicial razoável de shared_buffers é 25% da memória. O padrão costuma ser 128 MB.
  - "Therefore, the total memory used could be many times the value of work_mem; it is necessary to keep this fact in mind when choosing the value." (work_mem): Uma consulta pode usar várias operações de sort/hash ao mesmo tempo e várias sessões podem fazê-lo em paralelo, de modo que a memória total pode ser muitas vezes o work_mem.
  - "For example, a parallel query using 4 workers may use up to 5 times as much CPU time, memory, I/O bandwidth, and so forth as a query which uses no workers at all." (max_parallel_workers_per_gather): Consultas paralelas podem consumir muito mais recursos: cada worker é um processo separado, como uma sessão adicional; com 4 workers, até 5 vezes mais CPU e memória.
- **Custo ou risco segundo a fonte:** A fonte diz que mais de 40% da RAM em shared_buffers dificilmente ajuda, porque o PostgreSQL também usa o cache do SO. A tabela de hash usa work_mem × hash_mem_multiplier (padrão 2.0). work_mem alto, somado entre sessões, pode estourar a memória.
- **Opinião (aplicabilidade aqui):** com 512 MB, 25% dá 128 MB, igual ao padrão, então não há ganho em mexer. Subir work_mem é arriscado sob o limite de 512 MB (OOM do container, ver docker-resource-constraints). Com 1 vCPU, workers paralelos (padrão 2) não acrescentam CPU e competem com as 20 sessões concorrentes. Testar max_parallel_workers_per_gather=0. maintenance_work_mem (padrão 64 MB) pode subir temporariamente só durante CREATE INDEX.

### PostgreSQL 16 Documentation - 20.7 Query Planning

- **Autor/organização:** PostgreSQL Global Development Group (PostgreSQL 16; acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://www.postgresql.org/docs/16/runtime-config-query.html>
- **Sustenta:** Ajustar parâmetros de custo do planejador: random_page_cost menor se os dados cabem em cache, effective_cache_size compatível com a memória do container e jit_above_cost/jit.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Correspondingly, if your data is likely to be completely in cache, such as when the database is smaller than the total server memory, or network latency is high, decreasing random_page_cost might be appropriate." (random_page_cost): Se os dados devem estar inteiramente em cache, como quando o banco é menor que a memória do servidor, pode ser apropriado reduzir random_page_cost (padrão 4.0).
  - "This parameter has no effect on the size of shared memory allocated by PostgreSQL, nor does it reserve kernel disk cache; it is used only for estimation purposes." (effective_cache_size): effective_cache_size não aloca memória: só entra na estimativa do planejador. O padrão é 4 GB.
  - "Setting this to -1 disables JIT compilation. The default is 100000." (jit_above_cost): jit_above_cost define o custo a partir do qual o JIT é ativado. -1 desliga o JIT e o padrão é 100000.
- **Custo ou risco segundo a fonte:** A fonte diz que random_page_cost abaixo de seq_page_cost 'is not physically sensible'. Para discos com leitura aleatória cara, recomenda valor MAIOR. Mudar custos altera planos, para melhor ou para pior.
- **Opinião (aplicabilidade aqui):** o padrão effective_cache_size=4GB é irreal para um container de 512 MB e pode levar o planejador a preferir índices como se tudo estivesse em cache. Alinhar a uns 50 a 75% do limite é uma mudança barata. O random_page_cost só deve baixar se a medição mostrar que o conjunto de dados quente cabe na memória. Não está claro que 500 mil pedidos e 1,5 milhão de itens caibam em 512 MB.

### Node.js, the difference between development and production

- **Autor/organização:** OpenJS Foundation / Node.js (nodejs.org Learn) (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://nodejs.org/en/learn/getting-started/nodejs-the-difference-between-development-and-production>
- **Sustenta:** Rodar sempre com NODE_ENV=production. O Node em si não muda; o efeito vem das bibliotecas que leem a variável, como o Express.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "There is no difference between development and production in Node.js, i.e., there are no specific settings you need to apply to make Node.js work in a production configuration." (Introdução): Não há diferença entre desenvolvimento e produção no próprio Node.js.
  - "However, a few libraries in the npm registry recognize using the `NODE_ENV` variable and default it to a `development` setting." (Introdução): Algumas bibliotecas do npm leem NODE_ENV e assumem 'development' quando a variável não está definida.
  - "Always run your Node.js with the `NODE_ENV=production` set." (Introdução): A recomendação é sempre rodar com NODE_ENV=production.
- **Custo ou risco segundo a fonte:** A página chama de antipadrão usar NODE_ENV com valores diferentes de production: 'setting NODE_ENV to anything but production is considered an antipattern', porque ambientes diferentes impedem testes confiáveis.
- **Opinião (aplicabilidade aqui):** custo zero, mas o ganho esperado é pequeno nesta API, que só responde JSON e não renderiza views. Vale definir no Dockerfile ou no compose por correção, sem esperar grande efeito.

### Don't Block the Event Loop (or the Worker Pool)

- **Autor/organização:** OpenJS Foundation / Node.js (nodejs.org Learn) (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop>
- **Sustenta:** O JavaScript de um processo Node roda numa única thread (Event Loop). Trabalho de CPU no loop, como JSON.stringify de corpos grandes, atrasa todos os clientes. Escalar CPU exige mais núcleos, não mais processos disputando a mesma fração de CPU.
- **Verificação:** confirmada (3/3 citações encontradas na página)
- **Citações (literais):**
  - "Node.js runs JavaScript code in the Event Loop (initialization and callbacks), and offers a Worker Pool to handle expensive tasks like file I/O." (Overview): O Node.js roda o código JavaScript no Event Loop e oferece um Worker Pool para tarefas caras, como I/O de arquivo.
  - "This means that if the Event Loop spends too long at any point, all current and new clients will not get a turn." (Why should I avoid blocking the Event Loop): Se o Event Loop passa muito tempo num ponto, nenhum cliente atual ou novo é atendido.
  - "`JSON.parse` and `JSON.stringify` are other potentially expensive operations." (Blocking the Event Loop: JSON DOS): JSON.parse e JSON.stringify são operações potencialmente caras, O(n) no tamanho da entrada.
- **Custo ou risco segundo a fonte:** A justiça entre clientes é responsabilidade da aplicação: 'The fair treatment of clients is thus the responsibility of your application'. Tarefas longas no loop degradam a latência de todos.
- **Opinião (aplicabilidade aqui):** com quota de 0,5 CPU, a thread única já não tem um núcleo inteiro. O que melhora a vazão é tirar trabalho de CPU do loop (log de corpo, agregação em JS de vendas-por-dia), não multiplicar processos.

### Node.js v20/latest API - Cluster

- **Autor/organização:** OpenJS Foundation / Node.js (acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://nodejs.org/api/cluster.html>
- **Sustenta:** Cluster = vários processos Node (fork) dividindo a porta, com distribuição round-robin pelo primário. Útil quando há vários núcleos.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Clusters of Node.js processes can be used to run multiple instances of Node.js that can distribute workloads among their application threads." (Cluster): Clusters de processos Node.js rodam múltiplas instâncias para distribuir carga entre suas threads de aplicação.
  - "The worker processes are spawned using the child_process.fork() method, so that they can communicate with the parent via IPC and pass server handles back and forth." (How it works): Os workers são criados com child_process.fork() e se comunicam com o pai via IPC.
- **Custo ou risco segundo a fonte:** A documentação diz que, quando não é necessário isolamento de processos, worker_threads é a alternativa: 'When process isolation is not needed, use the worker_threads module instead'. Cada fork é um processo completo, com seu próprio heap.
- **Correção do verificador:** Para fixar a v20, usar https://nodejs.org/docs/latest-v20.x/api/cluster.html, onde as 2 citações também aparecem.
- **Opinião (aplicabilidade aqui):** os exemplos do cluster usam availableParallelism() para definir o número de workers. Num container de 0,5 CPU, isso pode devolver o número de CPUs do host e criar workers demais. Com a quota CFS (linux-cfs-bandwidth) compartilhada, o mais seguro é manter 1 processo.

### Node.js v20 Command-line API - --max-old-space-size

- **Autor/organização:** OpenJS Foundation / Node.js (documentação latest-v20.x; acessado em 2026-11-07)
- **Tipo:** documentação oficial
- **Link:** <https://nodejs.org/docs/latest-v20.x/api/cli.html>
- **Sustenta:** Limitar o heap do V8 abaixo do limite de memória do container ao reduzir a memória da API, deixando folga para buffers, pilha e bibliotecas nativas.
- **Verificação:** confirmada (2/2 citações encontradas na página)
- **Citações (literais):**
  - "Sets the max memory size of V8's old memory section. As memory consumption approaches the limit, V8 will spend more time on garbage collection in an effort to free unused memory." (Useful V8 options / --max-old-space-size=SIZE): --max-old-space-size define o tamanho máximo da old generation do V8. Perto do limite, o V8 gasta mais tempo em coleta de lixo.
  - "On a machine with 2 GiB of memory, consider setting this to 1536 (1.5 GiB) to leave some memory for other uses and avoid swapping." (Useful V8 options / --max-old-space-size=SIZE): A documentação sugere deixar folga: numa máquina de 2 GiB, cerca de 1536 MiB.
- **Custo ou risco segundo a fonte:** Limite baixo faz o V8 gastar mais tempo em GC, ou seja, mais CPU. A flag --max-old-space-size-percentage aparece só na documentação latest, não na v20.
- **Opinião (aplicabilidade aqui):** se a memória da API for reduzida (ex.: 256 para 128 MB), fixar --max-old-space-size em uns 75% do limite evita que o V8 cresça até o OOM do container. O efeito precisa ser medido, porque GC extra consome a mesma quota de CPU.

