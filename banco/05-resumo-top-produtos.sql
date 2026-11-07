-- Mudança 03: GET /relatorios/top-produtos lê uma tabela de resumo por produto, mantida por triggers.
--
-- Antes, cada chamada juntava e agregava os 1,5 milhão de itens com os 500 mil pedidos (2,5 s com o
-- banco ocioso; dezenas de segundos sob carga). O ranking só muda quando itens ou o status de um pedido
-- mudam, então a soma é mantida no momento da escrita (padrão "summary table" do PostgreSQL 16,
-- seção 43.10, Exemplo 43.6) e a leitura vira um Top-N sobre ~20 mil linhas já indexadas.
-- Diferente de uma materialized view ou de um cache, o resumo não fica desatualizado: os triggers
-- rodam na mesma transação da escrita. Custo: toda escrita em itens_pedido e toda troca de status
-- de pedido ganha um UPSERT, e produtos muito vendidos viram linhas disputadas (ver proximos-testes.md).

\echo 'Criando a tabela de resumo receita_por_produto...'
CREATE TABLE receita_por_produto (
    produto_id       integer PRIMARY KEY,
    itens            bigint  NOT NULL,  -- linhas de itens_pedido de pedidos não cancelados
    unidades         bigint  NOT NULL,
    receita_centavos bigint  NOT NULL
);

INSERT INTO receita_por_produto (produto_id, itens, unidades, receita_centavos)
SELECT i.produto_id, count(*), sum(i.quantidade), sum(i.quantidade * i.preco_unitario_centavos)
  FROM itens_pedido i
  JOIN pedidos p ON p.id = i.pedido_id
 WHERE p.status <> 'cancelado'
 GROUP BY i.produto_id;

-- Mesma ordem do ORDER BY da rota: receita decrescente, desempate por id do produto.
CREATE INDEX receita_por_produto_ranking_idx
    ON receita_por_produto (receita_centavos DESC, produto_id) WHERE itens > 0;

CREATE FUNCTION receita_por_produto_somar(p_produto integer, p_itens bigint, p_unidades bigint, p_receita bigint)
RETURNS void LANGUAGE sql AS $$
    INSERT INTO receita_por_produto AS r (produto_id, itens, unidades, receita_centavos)
    VALUES (p_produto, p_itens, p_unidades, p_receita)
    ON CONFLICT (produto_id) DO UPDATE
       SET itens            = r.itens + EXCLUDED.itens,
           unidades         = r.unidades + EXCLUDED.unidades,
           receita_centavos = r.receita_centavos + EXCLUDED.receita_centavos;
$$;

-- Item inserido, alterado ou apagado: soma ou subtrai, se o pedido dele não está cancelado.
CREATE FUNCTION itens_pedido_atualiza_resumo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE')
       AND (SELECT status FROM pedidos WHERE id = OLD.pedido_id) <> 'cancelado' THEN
        PERFORM receita_por_produto_somar(OLD.produto_id, -1, -OLD.quantidade,
                                          -(OLD.quantidade * OLD.preco_unitario_centavos));
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE')
       AND (SELECT status FROM pedidos WHERE id = NEW.pedido_id) <> 'cancelado' THEN
        PERFORM receita_por_produto_somar(NEW.produto_id, 1, NEW.quantidade,
                                          NEW.quantidade * NEW.preco_unitario_centavos);
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER itens_pedido_atualiza_resumo
    AFTER INSERT OR UPDATE OR DELETE ON itens_pedido
    FOR EACH ROW EXECUTE FUNCTION itens_pedido_atualiza_resumo();

-- Pedido que entra ou sai de 'cancelado': soma ou subtrai todos os itens dele.
CREATE FUNCTION pedidos_atualiza_resumo_produto() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    sinal integer;
BEGIN
    IF (OLD.status = 'cancelado') IS NOT DISTINCT FROM (NEW.status = 'cancelado') THEN
        RETURN NULL;
    END IF;
    sinal := CASE WHEN NEW.status = 'cancelado' THEN -1 ELSE 1 END;
    PERFORM receita_por_produto_somar(i.produto_id, sinal * count(*), sinal * sum(i.quantidade),
                                      sinal * sum(i.quantidade * i.preco_unitario_centavos))
       FROM itens_pedido i
      WHERE i.pedido_id = NEW.id
      GROUP BY i.produto_id;
    RETURN NULL;
END $$;

CREATE TRIGGER pedidos_atualiza_resumo_produto
    AFTER UPDATE OF status ON pedidos
    FOR EACH ROW EXECUTE FUNCTION pedidos_atualiza_resumo_produto();

-- TRUNCATE em itens_pedido zera o resumo.
CREATE FUNCTION itens_pedido_trunca_resumo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    TRUNCATE receita_por_produto;
    RETURN NULL;
END $$;

CREATE TRIGGER itens_pedido_trunca_resumo
    AFTER TRUNCATE ON itens_pedido
    FOR EACH STATEMENT EXECUTE FUNCTION itens_pedido_trunca_resumo();

ANALYZE receita_por_produto;
