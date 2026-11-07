#!/usr/bin/env bash
# Deadlock entre duas transações que inserem itens dos mesmos produtos em ordem oposta. Sem os triggers
# de resumo, essas inserções não se bloqueiam; com eles, cada uma trava a linha do produto em
# receita_por_produto até o fim da transação. Faz COMMIT em pedidos de teste (900200 e 900201) e apaga
# tudo no fim: rode só num banco de teste (antes de cada série de medições o banco é recriado do zero).
#
#   testes/deadlock.sh
set -uo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

TMPA="$(mktemp)"; TMPB="$(mktemp)"
sql() { docker compose exec -T banco psql -U loja -d loja -X -q -v ON_ERROR_STOP=1 "$@"; }
limpar() {
  sql -c "DELETE FROM itens_pedido WHERE pedido_id IN (900200, 900201); DELETE FROM pedidos WHERE id IN (900200, 900201);" >/dev/null
}

echo "# testes/deadlock.sh no commit $(git rev-parse --short HEAD), $(date '+%Y-%m-%d %H:%M:%S %z')"
limpar
sql -c "INSERT INTO pedidos VALUES (900200, 1, 'pago', '2025-06-01 10:00', 'teste deadlock'), (900201, 2, 'pago', '2025-06-01 10:00', 'teste deadlock');"

# A insere item do produto 1 e depois do 2; B insere do 2 e depois do 1, ao mesmo tempo.
sql -c "BEGIN; INSERT INTO itens_pedido VALUES (90020001, 900200, 1, 1, 1000); SELECT pg_sleep(2);
        INSERT INTO itens_pedido VALUES (90020002, 900200, 2, 1, 1000); COMMIT;" > "$TMPA" 2>&1 &
A=$!
sleep 0.5
sql -c "BEGIN; INSERT INTO itens_pedido VALUES (90020101, 900201, 2, 1, 1000); SELECT pg_sleep(2);
        INSERT INTO itens_pedido VALUES (90020102, 900201, 1, 1, 1000); COMMIT;" > "$TMPB" 2>&1
B_STATUS=$?
wait "$A"; A_STATUS=$?

echo "sessão A (produto 1, depois 2): saída $A_STATUS"; grep -E "ERROR|DETAIL|deadlock" "$TMPA" | head -3
echo "sessão B (produto 2, depois 1): saída $B_STATUS"; grep -E "ERROR|DETAIL|deadlock" "$TMPB" | head -3
if grep -q "deadlock detected" "$TMPA" "$TMPB"; then
  echo "Deadlock reproduzido: o PostgreSQL abortou uma das transações (40P01); a outra terminou."
else
  echo "Sem deadlock nesta execução."
fi
limpar
rm -f "$TMPA" "$TMPB"
