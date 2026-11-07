-- Mudança 14: GET /relatorios/vendas-por-dia lê totais por pedido, mantidos por triggers.
--
-- Mesmo agregada no SQL (mudança 07) e com índice no dia (mudança 04), a rota juntava ~4,8 mil pedidos
-- com ~14 mil itens a cada chamada (137 ms com o banco ocioso) e respondia por 78,9% do tempo do banco
-- (diagnostico/13-log-sem-corpo/carga-consultas.txt).
-- totais_pedido guarda, por pedido, o dia, se está ativo (não cancelado) e a soma dos seus itens. A rota
-- passa a somar as linhas do período num índice parcial, sem JOIN. É uma linha por pedido, e não uma
-- por dia: um resumo diário faria toda inserção de pedido do dia atualizar a mesma linha (todas as
-- escritas do checkout esperando umas pelas outras); aqui duas escritas só disputam a mesma linha se
-- mexerem no mesmo pedido. Os triggers rodam na mesma transação da escrita, então o total é exato.

\echo 'Criando a tabela totais_pedido...'
CREATE TABLE totais_pedido (
    pedido_id        integer PRIMARY KEY,
    dia              date    NOT NULL,  -- criado_em::date do pedido
    ativo            boolean NOT NULL,  -- status <> 'cancelado'
    itens            integer NOT NULL,  -- linhas em itens_pedido
    unidades         bigint  NOT NULL,
    receita_centavos bigint  NOT NULL
);

INSERT INTO totais_pedido (pedido_id, dia, ativo, itens, unidades, receita_centavos)
SELECT p.id, p.criado_em::date, p.status <> 'cancelado',
       count(i.id), coalesce(sum(i.quantidade), 0), coalesce(sum(i.quantidade * i.preco_unitario_centavos), 0)
  FROM pedidos p
  LEFT JOIN itens_pedido i ON i.pedido_id = p.id
 GROUP BY p.id;

-- Só os pedidos que entram no relatório, com as somas no próprio índice (index-only scan).
CREATE INDEX totais_pedido_dia_idx ON totais_pedido (dia) INCLUDE (unidades, receita_centavos)
    WHERE ativo AND itens > 0;

-- Pedido criado, alterado (status, data ou id) ou apagado.
CREATE FUNCTION pedidos_atualiza_totais() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO totais_pedido (pedido_id, dia, ativo, itens, unidades, receita_centavos)
        VALUES (NEW.id, NEW.criado_em::date, NEW.status <> 'cancelado', 0, 0, 0);
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE totais_pedido
           SET pedido_id = NEW.id, dia = NEW.criado_em::date, ativo = NEW.status <> 'cancelado'
         WHERE pedido_id = OLD.id;
    ELSE
        DELETE FROM totais_pedido WHERE pedido_id = OLD.id;
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER pedidos_atualiza_totais
    AFTER INSERT OR DELETE OR UPDATE OF id, status, criado_em ON pedidos
    FOR EACH ROW EXECUTE FUNCTION pedidos_atualiza_totais();

-- Item inserido, alterado ou apagado: subtrai do pedido antigo e soma no novo.
CREATE FUNCTION itens_pedido_atualiza_totais() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        UPDATE totais_pedido
           SET itens = itens - 1,
               unidades = unidades - OLD.quantidade,
               receita_centavos = receita_centavos - OLD.quantidade * OLD.preco_unitario_centavos
         WHERE pedido_id = OLD.pedido_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE totais_pedido
           SET itens = itens + 1,
               unidades = unidades + NEW.quantidade,
               receita_centavos = receita_centavos + NEW.quantidade * NEW.preco_unitario_centavos
         WHERE pedido_id = NEW.pedido_id;
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER itens_pedido_atualiza_totais
    AFTER INSERT OR UPDATE OR DELETE ON itens_pedido
    FOR EACH ROW EXECUTE FUNCTION itens_pedido_atualiza_totais();

-- TRUNCATE: itens zera as somas; pedidos (que exige CASCADE em itens) esvazia a tabela.
CREATE FUNCTION itens_pedido_trunca_totais() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE totais_pedido SET itens = 0, unidades = 0, receita_centavos = 0;
    RETURN NULL;
END $$;

CREATE TRIGGER itens_pedido_trunca_totais
    AFTER TRUNCATE ON itens_pedido
    FOR EACH STATEMENT EXECUTE FUNCTION itens_pedido_trunca_totais();

CREATE FUNCTION pedidos_trunca_totais() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    TRUNCATE totais_pedido;
    RETURN NULL;
END $$;

CREATE TRIGGER pedidos_trunca_totais
    AFTER TRUNCATE ON pedidos
    FOR EACH STATEMENT EXECUTE FUNCTION pedidos_trunca_totais();

VACUUM ANALYZE totais_pedido;
