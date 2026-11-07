-- Mudança 08: total de pedidos por status (GET /pedidos?status=) lido de uma tabela de contagem
-- mantida por trigger.
--
-- Mesmo com o índice da mudança 02, o count(*) exato percorre todas as entradas do status no índice
-- (300 mil para 'pago'; ~70 ms com o banco ocioso) a cada chamada: no PostgreSQL, por causa do MVCC,
-- não existe contagem pronta (PostgreSQL Wiki, "Slow Counting"). A contagem é mantida na escrita, na
-- mesma transação (PostgreSQL 16, seção 43.10), então continua exata.
-- Custo: toda inserção, exclusão ou troca de status de pedido atualiza uma de 4 linhas; transações
-- concorrentes que mexem no mesmo status esperam umas pelas outras (ver proximos-testes.md).

\echo 'Criando a tabela de contagem pedidos_por_status...'
CREATE TABLE pedidos_por_status (
    status text   PRIMARY KEY,
    total  bigint NOT NULL
);

INSERT INTO pedidos_por_status (status, total)
SELECT status, count(*) FROM pedidos GROUP BY status;

CREATE FUNCTION pedidos_atualiza_contagem_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NULL;
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        UPDATE pedidos_por_status SET total = total - 1 WHERE status = OLD.status;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        INSERT INTO pedidos_por_status AS c (status, total) VALUES (NEW.status, 1)
        ON CONFLICT (status) DO UPDATE SET total = c.total + 1;
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER pedidos_atualiza_contagem_status
    AFTER INSERT OR DELETE OR UPDATE OF status ON pedidos
    FOR EACH ROW EXECUTE FUNCTION pedidos_atualiza_contagem_status();

CREATE FUNCTION pedidos_trunca_contagem_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    TRUNCATE pedidos_por_status;
    RETURN NULL;
END $$;

CREATE TRIGGER pedidos_trunca_contagem_status
    AFTER TRUNCATE ON pedidos
    FOR EACH STATEMENT EXECUTE FUNCTION pedidos_trunca_contagem_status();

ANALYZE pedidos_por_status;
