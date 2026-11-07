-- Mudança 04: índice de expressão para o filtro de GET /relatorios/vendas-por-dia.
--
-- A consulta filtra por p.criado_em::date BETWEEN $1 AND $2. Com o cast aplicado na coluna, um índice
-- comum em criado_em não serve, e cada chamada varria os 500 mil pedidos (163 MB), expulsando do cache
-- o que as outras rotas usam (diagnostico/02-indice-status: 26% do tempo do banco).
-- Um índice sobre a mesma expressão (PostgreSQL 16, seção 11.7) é usado sem mudar o SQL.
-- O cast timestamp (sem fuso) -> date é imutável, então pode ser indexado.
-- Alternativa equivalente: reescrever o filtro como faixa (criado_em >= $1 AND criado_em < $2 + 1 dia)
-- com índice em criado_em; aqui foi preferido não mexer no SQL para isolar o efeito do índice.

\echo 'Criando índice em (criado_em::date) em pedidos...'
CREATE INDEX pedidos_criado_em_dia_idx ON pedidos ((criado_em::date));
ANALYZE pedidos;
