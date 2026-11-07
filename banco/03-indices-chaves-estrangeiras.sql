-- Mudança 01: índices nas colunas de chave estrangeira usadas como filtro.
--
-- Declarar FOREIGN KEY não cria índice na coluna que referencia (PostgreSQL 16, seção 5.4.5).
-- Sem eles, cada "itens do pedido" e cada "pedidos do cliente" varria a tabela inteira
-- (diagnostico/00-linha-de-base/explain.txt e carga-consultas.txt: ~52% do tempo do banco).
-- Não muda o que nenhuma rota devolve: só o caminho que o banco usa para achar as linhas.

\echo 'Criando índices nas chaves estrangeiras...'
CREATE INDEX itens_pedido_pedido_id_idx ON itens_pedido (pedido_id);
CREATE INDEX pedidos_cliente_id_idx ON pedidos (cliente_id);
ANALYZE itens_pedido;
ANALYZE pedidos;
