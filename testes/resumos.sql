-- Teste dos triggers das tabelas de resumo (receita_por_produto, mudança 03; pedidos_por_status, mudança 08): aplica escritas de todos os tipos dentro de uma
-- transação e, depois de cada uma, confere se o resumo é igual ao agregado calculado do zero.
-- Termina com ROLLBACK: não deixa nada no banco.
--   docker compose exec -T banco psql -U loja -d loja -X < testes/resumos.sql
\set ON_ERROR_STOP on
\pset pager off
BEGIN;

CREATE FUNCTION pg_temp.conferir(etapa text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    diferencas bigint;
BEGIN
    WITH resumo AS (
        SELECT produto_id, itens, unidades, receita_centavos FROM receita_por_produto WHERE itens > 0
    ), completo AS (
        SELECT i.produto_id, count(*) AS itens, sum(i.quantidade) AS unidades,
               sum(i.quantidade * i.preco_unitario_centavos) AS receita_centavos
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

    -- Contagem por status (mudança 08), se a tabela existir.
    IF to_regclass('pedidos_por_status') IS NOT NULL THEN
        EXECUTE $q$
            SELECT count(*) FROM (
                (SELECT status, total FROM pedidos_por_status WHERE total > 0
                 EXCEPT ALL SELECT status, count(*) FROM pedidos GROUP BY status)
                UNION ALL
                (SELECT status, count(*) FROM pedidos GROUP BY status
                 EXCEPT ALL SELECT status, total FROM pedidos_por_status WHERE total > 0)) d
        $q$ INTO diferencas;
        IF diferencas > 0 THEN
            RAISE EXCEPTION 'FALHOU em "%": contagem por status difere em % linhas', etapa, diferencas;
        END IF;
        RETURN 'ok  ' || etapa || ' (receita por produto e contagem por status)';
    END IF;
    RETURN 'ok  ' || etapa || ' (receita por produto)';
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

UPDATE pedidos SET status = 'cancelado' WHERE id IN (2, 3, 4);
SELECT pg_temp.conferir('cancela 3 pedidos já existentes de uma vez');

DELETE FROM itens_pedido WHERE pedido_id = 900001;
DELETE FROM pedidos WHERE id IN (900001, 900002);
SELECT pg_temp.conferir('apaga pedidos e itens');

ROLLBACK;
