-- Mudança 02: índice composto para GET /pedidos?status=&pagina=.
--
-- A página faz WHERE status = $1 ORDER BY criado_em DESC, id DESC LIMIT 20 OFFSET n.
-- Sem índice, o banco lia os 500 mil pedidos e ordenava até 300 mil em disco a cada chamada
-- (diagnostico/01-indices-fk/carga-consultas.txt: 28,8% do tempo do banco, sort "external merge").
-- Com as colunas na mesma ordem do ORDER BY, o índice já entrega as linhas ordenadas
-- (PostgreSQL 16, seções 11.3 e 11.4) e a contagem do status pode ser feita só pelo índice (11.9).
-- Não muda o que a rota devolve: mesma ordem, inclusive no desempate por id.

\echo 'Criando índice (status, criado_em DESC, id DESC) em pedidos...'
CREATE INDEX pedidos_status_criado_em_id_idx ON pedidos (status, criado_em DESC, id DESC);
ANALYZE pedidos;
