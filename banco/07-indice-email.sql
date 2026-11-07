-- Mudança 06: índice de expressão para GET /clientes?email=.
--
-- A consulta é WHERE lower(email) = lower($1) ORDER BY id. Um índice comum em email não serve para
-- lower(email), e cada chamada varria os 100 mil clientes (diagnostico/05-pool-conexoes: 36,6% do
-- tempo do banco). Com um índice na mesma expressão (PostgreSQL 16, seção 11.7), a busca vai direto
-- às linhas do e-mail, sem mudar o SQL. Não é UNIQUE: o contrato devolve uma lista (pode haver mais
-- de um cliente com o mesmo e-mail).

\echo 'Criando índice em lower(email) em clientes...'
CREATE INDEX clientes_lower_email_idx ON clientes (lower(email));
ANALYZE clientes;
