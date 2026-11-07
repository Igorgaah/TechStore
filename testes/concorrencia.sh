#!/usr/bin/env bash
# Corrida entre "inserir item" e "cancelar o pedido" em duas sessões ao mesmo tempo, que o
# testes/resumos.sql (uma sessão só) não alcança. Confere receita_por_produto contra o agregado completo
# do produto usado. Faz COMMIT de verdade num pedido de teste (id 900100) e apaga tudo no fim:
# rode só num banco de teste (antes de cada série de medições o banco é recriado do zero).
#
#   testes/concorrencia.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

sql() { docker compose exec -T banco psql -U loja -d loja -X -q -v ON_ERROR_STOP=1 "$@"; }
PRODUTO=7

limpar() {
  sql -c "DELETE FROM itens_pedido WHERE pedido_id = 900100; DELETE FROM pedidos WHERE id = 900100;" >/dev/null
}
conferir() { # $1 = nome do cenário
  local r
  r="$(sql -At -F ' ' -c "
    SELECT coalesce((SELECT itens FROM receita_por_produto WHERE produto_id = ${PRODUTO}), 0),
           coalesce((SELECT receita_centavos FROM receita_por_produto WHERE produto_id = ${PRODUTO}), 0),
           (SELECT count(*) FROM itens_pedido i JOIN pedidos p ON p.id = i.pedido_id
             WHERE p.status <> 'cancelado' AND i.produto_id = ${PRODUTO}),
           (SELECT coalesce(sum(i.quantidade::bigint * i.preco_unitario_centavos), 0) FROM itens_pedido i
              JOIN pedidos p ON p.id = i.pedido_id WHERE p.status <> 'cancelado' AND i.produto_id = ${PRODUTO})" | tr -d '\r')"
  read -r ri rr ci cr <<< "$r"
  if [[ "$ri" == "$ci" && "$rr" == "$cr" ]]; then
    echo "ok      $1: resumo (itens $ri, receita $rr) = agregado completo"
  else
    echo "FALHOU  $1: resumo (itens $ri, receita $rr) != agregado completo (itens $ci, receita $cr)"
    FALHAS=$((FALHAS + 1))
  fi
}

FALHAS=0
echo "# testes/concorrencia.sh no commit $(git rev-parse --short HEAD), $(date '+%Y-%m-%d %H:%M:%S %z')"
limpar
conferir "estado inicial"

# Cenário 1: A cancela o pedido e segura a transação; B insere um item no meio e confirma depois de A.
sql -c "INSERT INTO pedidos VALUES (900100, 1, 'pago', '2025-06-01 10:00', 'teste de corrida');"
sql -c "BEGIN; UPDATE pedidos SET status = 'cancelado' WHERE id = 900100; SELECT pg_sleep(3); COMMIT;" >/dev/null &
A=$!
sleep 1
t0=$(date +%s)
sql -c "INSERT INTO itens_pedido VALUES (90010001, 900100, ${PRODUTO}, 2, 1000);"
t1=$(date +%s)
wait "$A"
echo "        cenário 1: o INSERT esperou $((t1 - t0)) s pela transação que cancelava o pedido"
conferir "cenário 1 (cancela o pedido enquanto outro insere item)"
limpar

# Cenário 2: B insere o item e segura a transação; A cancela o pedido no meio.
sql -c "INSERT INTO pedidos VALUES (900100, 1, 'pago', '2025-06-01 10:00', 'teste de corrida');"
sql -c "BEGIN; INSERT INTO itens_pedido VALUES (90010001, 900100, ${PRODUTO}, 2, 1000); SELECT pg_sleep(3); COMMIT;" >/dev/null &
B=$!
sleep 1
t0=$(date +%s)
sql -c "UPDATE pedidos SET status = 'cancelado' WHERE id = 900100;"
t1=$(date +%s)
wait "$B"
echo "        cenário 2: o UPDATE esperou $((t1 - t0)) s pela transação que inseria o item"
conferir "cenário 2 (insere item enquanto outro cancela o pedido)"
limpar
conferir "depois da limpeza"

if [[ "$FALHAS" -eq 0 ]]; then echo "Concorrência: resumo correto nos 2 cenários."; else echo "Concorrência: $FALHAS conferências falharam."; fi
exit "$FALHAS"
