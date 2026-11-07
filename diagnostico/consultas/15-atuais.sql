-- EXPLAIN (ANALYZE, BUFFERS) das consultas ATUAIS de cada rota (estado final, depois da mudança 15),
-- com os mesmos parâmetros de diagnostico/consultas/00-originais.sql. Rodado com o banco ocioso.
\pset pager off
\timing off

\echo '=== GET /clientes/:id'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM clientes WHERE id = 42;

\echo '=== GET /clientes?email='
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM clientes WHERE lower(email) = lower('cliente3@exemplo.com') ORDER BY id;

\echo '=== GET /clientes/:id/pedidos (uma consulta, sem N+1)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id AS pedido_id, p.status, p.criado_em, i.produto_id, pr.nome AS produto_nome, i.quantidade, i.preco_unitario_centavos
  FROM clientes c
  LEFT JOIN pedidos p ON p.cliente_id = c.id
  LEFT JOIN itens_pedido i ON i.pedido_id = p.id
  LEFT JOIN produtos pr ON pr.id = i.produto_id
 WHERE c.id = 42
 ORDER BY p.criado_em DESC, p.id DESC, i.id;

\echo '=== GET /pedidos?status=pago&pagina=500 (1) total do status (tabela de contagem)'
EXPLAIN (ANALYZE, BUFFERS) SELECT coalesce((SELECT total FROM pedidos_por_status WHERE status = 'pago'), 0) AS total;

\echo '=== GET /pedidos?status=pago&pagina=500 (2) página (deferred join)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id, p.cliente_id, p.status, p.criado_em
  FROM (SELECT id FROM pedidos WHERE status = 'pago' ORDER BY criado_em DESC, id DESC LIMIT 20 OFFSET 9980) AS pagina
  JOIN pedidos p ON p.id = pagina.id
 ORDER BY p.criado_em DESC, p.id DESC;

\echo '=== GET /produtos/busca?q=cadeira'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM produtos WHERE nome ILIKE '%' || 'cadeira' || '%' ORDER BY nome, id LIMIT 20;

\echo '=== GET /produtos/busca?q=modelo 12'
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM produtos WHERE nome ILIKE '%' || 'modelo 12' || '%' ORDER BY nome, id LIMIT 20;

\echo '=== GET /relatorios/vendas-por-dia?inicio=2024-06-01&fim=2024-06-07 (totais por pedido)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT to_char(dia, 'YYYY-MM-DD') AS dia, count(*) AS pedidos, sum(unidades) AS itens, sum(receita_centavos) AS receita_centavos
  FROM totais_pedido
 WHERE dia BETWEEN '2024-06-01' AND '2024-06-07'
   AND ativo AND itens > 0
 GROUP BY totais_pedido.dia
 ORDER BY totais_pedido.dia;

\echo '=== GET /relatorios/top-produtos?limite=10 (tabela de resumo)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pr.id, pr.nome, pr.categoria, r.unidades, r.receita_centavos
  FROM receita_por_produto r
  JOIN produtos pr ON pr.id = r.produto_id
 WHERE r.itens > 0
 ORDER BY r.receita_centavos DESC, r.produto_id
 LIMIT 10;
