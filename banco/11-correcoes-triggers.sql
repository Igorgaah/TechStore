-- Mudança 16: correções de corretude nos triggers das mudanças 03 (receita_por_produto) e 14
-- (totais_pedido), achadas na revisão. A carga do desafio só lê, então nenhuma delas aparecia nas
-- medições; todas aparecem quando há escrita. Reproduções e testes: testes/resumos.sql.
--
-- 1. Corrida na 03: o trigger de item lia o status do pedido sem travar a linha. Se outra transação
--    cancelasse o pedido ao mesmo tempo, o item era somado e nunca subtraído. Agora a leitura usa
--    FOR SHARE, que conflita com o UPDATE do status: uma transação espera a outra e, em READ COMMITTED,
--    a segunda enxerga o resultado da primeira.
-- 2. Ordem de disparo na 14: se um pedido e seus itens fossem criados no mesmo comando (CTE), o trigger
--    do item podia rodar antes de existir a linha do pedido em totais_pedido e o item se perdia. Agora
--    os dois triggers fazem upsert e funcionam em qualquer ordem.
-- 3. Overflow: quantidade * preco era calculado em integer e uma escrita com produto acima de
--    2.147.483.647 era recusada pelos triggers (sem eles, o esquema original aceitava). Agora em bigint.
--
-- Limites que continuam (documentados em proximos-testes.md): DELETE de pedido e de seus itens no MESMO
-- comando (CTE) não é subtraído de receita_por_produto; inserções concorrentes de itens dos mesmos
-- produtos em ordens diferentes podem dar deadlock (40P01) e precisam de nova tentativa.

\echo 'Corrigindo os triggers das tabelas de resumo...'

CREATE OR REPLACE FUNCTION itens_pedido_atualiza_resumo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE')
       AND (SELECT status FROM pedidos WHERE id = OLD.pedido_id FOR SHARE) <> 'cancelado' THEN
        PERFORM receita_por_produto_somar(OLD.produto_id, -1, -OLD.quantidade,
                                          -(OLD.quantidade::bigint * OLD.preco_unitario_centavos));
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE')
       AND (SELECT status FROM pedidos WHERE id = NEW.pedido_id FOR SHARE) <> 'cancelado' THEN
        PERFORM receita_por_produto_somar(NEW.produto_id, 1, NEW.quantidade,
                                          NEW.quantidade::bigint * NEW.preco_unitario_centavos);
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION pedidos_atualiza_resumo_produto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    sinal integer;
BEGIN
    IF (OLD.status = 'cancelado') IS NOT DISTINCT FROM (NEW.status = 'cancelado') THEN
        RETURN NULL;
    END IF;
    sinal := CASE WHEN NEW.status = 'cancelado' THEN -1 ELSE 1 END;
    PERFORM receita_por_produto_somar(i.produto_id, sinal * count(*), sinal * sum(i.quantidade),
                                      sinal * sum(i.quantidade::bigint * i.preco_unitario_centavos))
       FROM itens_pedido i
      WHERE i.pedido_id = NEW.id
      GROUP BY i.produto_id;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION pedidos_atualiza_totais() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- upsert: a linha pode já ter sido criada pelo trigger de um item do mesmo comando
        INSERT INTO totais_pedido AS t (pedido_id, dia, ativo, itens, unidades, receita_centavos)
        VALUES (NEW.id, NEW.criado_em::date, NEW.status <> 'cancelado', 0, 0, 0)
        ON CONFLICT (pedido_id) DO UPDATE SET dia = EXCLUDED.dia, ativo = EXCLUDED.ativo;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE totais_pedido
           SET pedido_id = NEW.id, dia = NEW.criado_em::date, ativo = NEW.status <> 'cancelado'
         WHERE pedido_id = OLD.id;
    ELSE
        DELETE FROM totais_pedido WHERE pedido_id = OLD.id;
    END IF;
    RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION itens_pedido_atualiza_totais() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        UPDATE totais_pedido
           SET itens = itens - 1,
               unidades = unidades - OLD.quantidade,
               receita_centavos = receita_centavos - OLD.quantidade::bigint * OLD.preco_unitario_centavos
         WHERE pedido_id = OLD.pedido_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        -- upsert a partir de pedidos: funciona mesmo se o trigger do pedido ainda não rodou
        INSERT INTO totais_pedido AS t (pedido_id, dia, ativo, itens, unidades, receita_centavos)
        SELECT p.id, p.criado_em::date, p.status <> 'cancelado', 1, NEW.quantidade,
               NEW.quantidade::bigint * NEW.preco_unitario_centavos
          FROM pedidos p
         WHERE p.id = NEW.pedido_id
        ON CONFLICT (pedido_id) DO UPDATE
           SET itens = t.itens + 1,
               unidades = t.unidades + EXCLUDED.unidades,
               receita_centavos = t.receita_centavos + EXCLUDED.receita_centavos;
    END IF;
    RETURN NULL;
END $$;
