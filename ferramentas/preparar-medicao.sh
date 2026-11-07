#!/usr/bin/env bash
# Deixa o ambiente no mesmo estado antes de cada série de medições:
# espera a API responder e o autovacuum que roda depois da carga inicial dos dados terminar.
# (Na linha de base, o autovacuum de todas as tabelas já tinha terminado antes da 1ª medição;
#  medir com ele rodando misturaria o custo dele no resultado.)
#
#   ferramentas/preparar-medicao.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

for _ in $(seq 1 120); do
  curl -fsS http://127.0.0.1:3000/saude >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:3000/saude >/dev/null || { echo "API fora do ar" >&2; exit 1; }

for _ in $(seq 1 300); do
  pendentes="$(docker compose exec -T banco psql -U loja -d loja -X -At -c "
    SELECT (SELECT count(*) FROM pg_stat_user_tables
             WHERE relname IN ('clientes','produtos','pedidos','itens_pedido') AND last_autovacuum IS NULL)
         + (SELECT count(*) FROM pg_stat_activity WHERE backend_type = 'autovacuum worker')" | tr -d '\r')"
  if [[ "$pendentes" == "0" ]]; then
    echo "Pronto: API no ar e autovacuum pós-carga concluído."
    docker compose exec -T banco psql -U loja -d loja -X -c \
      "SELECT relname, last_autovacuum FROM pg_stat_user_tables ORDER BY relname;"
    exit 0
  fi
  sleep 2
done
echo "Autovacuum não terminou em 10 min" >&2
exit 1
