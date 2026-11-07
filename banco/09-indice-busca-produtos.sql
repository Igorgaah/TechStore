-- Mudança 12: índice de trigramas para GET /produtos/busca?q= (nome ILIKE '%termo%').
--
-- Um B-tree não serve para LIKE/ILIKE com curinga no começo, e cada busca varria os 20 mil produtos
-- aplicando o ILIKE em cada nome. O pg_trgm (extensão que vem com o PostgreSQL) indexa os trigramas
-- do texto, e um índice GIN gin_trgm_ops atende LIKE e ILIKE (PostgreSQL 16, Apêndice F, pg_trgm):
-- o banco confere só os candidatos que têm todos os trigramas do termo. O operador continua o ILIKE,
-- então o resultado é o mesmo; termos com menos de 3 caracteres já são recusados pela rota.

\echo 'Criando índice GIN de trigramas em produtos.nome...'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX produtos_nome_trgm_idx ON produtos USING gin (nome gin_trgm_ops);
ANALYZE produtos;
