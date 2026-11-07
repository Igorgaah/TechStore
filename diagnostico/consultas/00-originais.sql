-- EXPLAIN (ANALYZE, BUFFERS) das consultas do código ORIGINAL (api/src/rotas.js),
-- com parâmetros representativos do teste de carga. Rodado com o banco ocioso.
\pset pager off
\timing off

\echo '=== GET /clientes/:id  (SELECT por chave primária)'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM clientes WHERE id = 42;

\echo '=== GET /clientes?email=  (lower(email) = lower($1))'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM clientes WHERE lower(email) = lower('cliente3@exemplo.com') ORDER BY id;

\echo '=== GET /clientes/:id/pedidos  (1) pedidos do cliente'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM pedidos WHERE cliente_id = 42 ORDER BY criado_em DESC, id DESC;

SELECT count(*) AS pedidos_do_cliente_42 FROM pedidos WHERE cliente_id = 42;
SELECT id AS pedido_id FROM pedidos WHERE cliente_id = 42 ORDER BY criado_em DESC, id DESC LIMIT 1 \gset

\echo '=== GET /clientes/:id/pedidos  (2) itens de UM pedido (repetido para cada pedido: N+1)'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM itens_pedido WHERE pedido_id = :pedido_id ORDER BY id;

SELECT produto_id FROM itens_pedido WHERE pedido_id = :pedido_id ORDER BY id LIMIT 1 \gset
\echo '=== GET /clientes/:id/pedidos  (3) produto de UM item (repetido para cada item: N+1)'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM produtos WHERE id = :produto_id;

\echo '=== GET /pedidos?status=pago&pagina=500  (1) total do status'
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) AS total FROM pedidos WHERE status = 'pago';

\echo '=== GET /pedidos?status=pago&pagina=500  (2) página (OFFSET 9980)'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM pedidos WHERE status = 'pago' ORDER BY criado_em DESC, id DESC LIMIT 20 OFFSET 9980;

\echo '=== GET /produtos/busca?q=cadeira'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM produtos WHERE nome ILIKE '%' || 'cadeira' || '%' ORDER BY nome, id LIMIT 20;

\echo '=== GET /produtos/busca?q=modelo 12'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM produtos WHERE nome ILIKE '%' || 'modelo 12' || '%' ORDER BY nome, id LIMIT 20;

\echo '=== GET /relatorios/vendas-por-dia?inicio=2024-06-01&fim=2024-06-07'
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id AS pedido_id, p.criado_em, p.observacoes, i.quantidade, i.preco_unitario_centavos
  FROM pedidos p
  JOIN itens_pedido i ON i.pedido_id = p.id
 WHERE p.criado_em::date BETWEEN '2024-06-01' AND '2024-06-07'
   AND p.status <> 'cancelado';

\echo '=== bytes que a rota vendas-por-dia traz para o Node (7 dias)'
SELECT count(*) AS linhas,
       pg_size_pretty(sum(pg_column_size(p.observacoes))::bigint) AS bytes_de_observacoes,
       pg_size_pretty(sum(pg_column_size(p.*))::bigint) AS bytes_linhas_pedido
  FROM pedidos p
  JOIN itens_pedido i ON i.pedido_id = p.id
 WHERE p.criado_em::date BETWEEN '2024-06-01' AND '2024-06-07'
   AND p.status <> 'cancelado';

\echo '=== GET /relatorios/top-produtos?limite=10'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pr.id, pr.nome, pr.categoria,
       sum(i.quantidade) AS unidades,
       sum(i.quantidade * i.preco_unitario_centavos) AS receita_centavos
  FROM itens_pedido i
  JOIN pedidos p ON p.id = i.pedido_id
  JOIN produtos pr ON pr.id = i.produto_id
 WHERE p.status <> 'cancelado'
 GROUP BY pr.id, pr.nome, pr.categoria
 ORDER BY receita_centavos DESC, pr.id
 LIMIT 10;
