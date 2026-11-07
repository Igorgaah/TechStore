-- Teste dos triggers das tabelas de resumo (receita_por_produto, mudança 03; pedidos_por_status, mudança 08;
-- totais_pedido, mudança 14): aplica escritas de todos os tipos dentro de uma transação e, depois de cada
-- uma, confere se cada resumo é igual ao agregado calculado do zero.
-- Cobre: inserir, alterar (quantidade, produto, preço, data, pedido do item, id do pedido), cancelar e
-- reativar, item em pedido cancelado, pedido sem itens, pedido e item no mesmo comando, valores acima de
-- 2^31, exclusões e TRUNCATE. NÃO cobre: concorrência entre transações (testes/concorrencia.sh) e DELETE
-- de pedido e itens no mesmo comando, um limite conhecido de receita_por_produto (proximos-testes.md).
-- Termina com ROLLBACK: não deixa nada no banco.
--   docker compose exec -T banco psql -U loja -d loja -X < testes/resumos.sql
\set ON_ERROR_STOP on
\pset pager off
BEGIN;

CREATE FUNCTION pg_temp.conferir(etapa text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    diferencas bigint;
    conferidos text;
BEGIN
    WITH resumo AS (
        SELECT produto_id, itens, unidades, receita_centavos FROM receita_por_produto WHERE itens > 0
    ), completo AS (
        SELECT i.produto_id, count(*) AS itens, sum(i.quantidade) AS unidades,
               sum(i.quantidade::bigint * i.preco_unitario_centavos) AS receita_centavos
          FROM itens_pedido i JOIN pedidos p ON p.id = i.pedido_id
         WHERE p.status <> 'cancelado'
         GROUP BY i.produto_id
    )
    SELECT count(*) INTO diferencas
      FROM ((SELECT * FROM resumo EXCEPT ALL SELECT * FROM completo)
            UNION ALL
            (SELECT * FROM completo EXCEPT ALL SELECT * FROM resumo)) d;
    IF diferencas > 0 THEN
        RAISE EXCEPTION 'FALHOU em "%": % linhas diferentes entre resumo e agregado completo', etapa, diferencas;
    END IF;

    conferidos := 'receita por produto';

    -- Contagem por status (mudança 08), se a tabela existir.
    IF to_regclass('pedidos_por_status') IS NOT NULL THEN
        EXECUTE $q$
            SELECT count(*)
              FROM pedidos_por_status s
              FULL JOIN (SELECT status, count(*) AS total FROM pedidos GROUP BY status) c USING (status)
             WHERE coalesce(s.total, 0) <> coalesce(c.total, 0)
        $q$ INTO diferencas;
        IF diferencas > 0 THEN
            RAISE EXCEPTION 'FALHOU em "%": contagem por status difere em % linhas', etapa, diferencas;
        END IF;
        conferidos := conferidos || ', contagem por status';
    END IF;

    -- Vendas por dia a partir dos totais por pedido (mudança 14), contra o JOIN original, em todos os dias.
    IF to_regclass('totais_pedido') IS NOT NULL THEN
        EXECUTE $q$
            WITH resumo AS (
                SELECT dia, count(*) AS pedidos, sum(unidades) AS itens, sum(receita_centavos) AS receita
                  FROM totais_pedido WHERE ativo AND itens > 0 GROUP BY dia
            ), completo AS (
                SELECT p.criado_em::date AS dia, count(DISTINCT p.id) AS pedidos, sum(i.quantidade) AS itens,
                       sum(i.quantidade::bigint * i.preco_unitario_centavos) AS receita
                  FROM pedidos p JOIN itens_pedido i ON i.pedido_id = p.id
                 WHERE p.status <> 'cancelado' GROUP BY 1
            )
            SELECT count(*) FROM ((SELECT * FROM resumo EXCEPT ALL SELECT * FROM completo)
                                  UNION ALL
                                  (SELECT * FROM completo EXCEPT ALL SELECT * FROM resumo)) d
        $q$ INTO diferencas;
        IF diferencas > 0 THEN
            RAISE EXCEPTION 'FALHOU em "%": vendas por dia diferem em % dias', etapa, diferencas;
        END IF;
        conferidos := conferidos || ', vendas por dia';
    END IF;

    RETURN 'ok  ' || etapa || ' (' || conferidos || ')';
END $$;

SELECT pg_temp.conferir('estado inicial');

INSERT INTO pedidos (id, cliente_id, status, criado_em, observacoes)
VALUES (900001, 1, 'pago', '2025-06-01 10:00', 'teste'), (900002, 2, 'cancelado', '2025-06-01 11:00', 'teste');
INSERT INTO itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario_centavos)
VALUES (90000001, 900001, 1, 2, 1000), (90000002, 900001, 2, 1, 2500), (90000003, 900001, 3, 3, 990),
       (90000004, 900002, 1, 5, 1000);
SELECT pg_temp.conferir('insere pedido pago com 3 itens e pedido cancelado com 1 item');

UPDATE itens_pedido SET quantidade = 7 WHERE id = 90000001;
SELECT pg_temp.conferir('altera quantidade de um item');

UPDATE itens_pedido SET produto_id = 4, preco_unitario_centavos = 1234 WHERE id = 90000002;
SELECT pg_temp.conferir('troca o produto e o preço de um item');

UPDATE pedidos SET status = 'cancelado' WHERE id = 900001;
SELECT pg_temp.conferir('cancela um pedido');

INSERT INTO itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario_centavos)
VALUES (90000005, 900001, 5, 1, 777);
SELECT pg_temp.conferir('insere item em pedido cancelado');

UPDATE pedidos SET status = 'entregue' WHERE id = 900001;
SELECT pg_temp.conferir('reativa o pedido cancelado');

UPDATE pedidos SET status = 'pendente' WHERE id = 900001;
SELECT pg_temp.conferir('troca entre status não cancelados');

UPDATE itens_pedido SET pedido_id = 900001 WHERE id = 90000004;
SELECT pg_temp.conferir('move item de pedido cancelado para pedido ativo');

DELETE FROM itens_pedido WHERE id = 90000003;
SELECT pg_temp.conferir('apaga um item');

UPDATE pedidos SET criado_em = criado_em - interval '3 days' WHERE id IN (900001, 10, 11);
SELECT pg_temp.conferir('muda a data (o dia) de pedidos');

INSERT INTO pedidos (id, cliente_id, status, criado_em, observacoes)
VALUES (900003, 3, 'pago', '2025-06-01 12:00', 'teste sem itens');
SELECT pg_temp.conferir('insere pedido sem itens');

UPDATE itens_pedido SET pedido_id = 900002 WHERE id = 90000001;
SELECT pg_temp.conferir('move item de pedido ativo para pedido cancelado');

WITH p AS (INSERT INTO pedidos (id, cliente_id, status, criado_em, observacoes)
           VALUES (900010, 4, 'pago', '2025-06-02 09:00', 'teste mesmo comando'))
INSERT INTO itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario_centavos)
VALUES (90000010, 900010, 8, 2, 1000);
SELECT pg_temp.conferir('cria pedido e item no mesmo comando (CTE)');

INSERT INTO itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario_centavos)
VALUES (90000011, 900010, 9, 5000, 500000);
SELECT pg_temp.conferir('item com quantidade x preço acima de 2^31 (bigint)');

UPDATE pedidos SET id = 900004 WHERE id = 900003;
SELECT pg_temp.conferir('troca o id de um pedido sem itens');

UPDATE pedidos SET status = 'cancelado' WHERE id IN (2, 3, 4);
SELECT pg_temp.conferir('cancela 3 pedidos já existentes de uma vez');

DELETE FROM itens_pedido WHERE pedido_id IN (900001, 900002);
DELETE FROM itens_pedido WHERE pedido_id = 900010;
DELETE FROM pedidos WHERE id IN (900001, 900002, 900004, 900010);
SELECT pg_temp.conferir('apaga pedidos e itens');

TRUNCATE itens_pedido;
SELECT pg_temp.conferir('TRUNCATE em itens_pedido');

TRUNCATE pedidos, itens_pedido;
SELECT pg_temp.conferir('TRUNCATE em pedidos e itens_pedido');

ROLLBACK;
