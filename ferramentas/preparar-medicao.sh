#!/usr/bin/env bash
# Deixa o ambiente no mesmo estado antes de cada série de medições:
# espera a API responder e o autovacuum que roda depois da carga inicial dos dados terminar.
# (Na linha de base, o autovacuum de todas as tabelas já tinha terminado antes da 1ª medição;
#  medir com ele rodando misturaria o custo dele no resultado.)
#
#   ferramentas/preparar-medicao.sh
#
# Estado do banco antes de cada série: dados recém-gerados, cache quente e autovacuum concluído.
# Mudanças no banco: recriado do zero (docker compose down -v && up -d --build). Mudanças só na API
# (05 e 07): banco mantido rodando desde a série anterior; da 10 em diante, recriado sempre.
# Um banco apenas reiniciado começa com o cache frio (ver a mudança 09 em experimentos.md).
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

for _ in $(seq 1 120); do
  curl -fsS http://127.0.0.1:3000/saude >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:3000/saude >/dev/null || { echo "API fora do ar" >&2; exit 1; }

# Pendente = tabela com mais inserções desde o último vacuum do que o limiar do autovacuum
# (autovacuum_vacuum_insert_threshold + scale_factor x linhas, padrões 1000 e 0,2), ou um worker rodando.
# Não usa last_autovacuum: o diagnostico/coletar.sh zera as estatísticas (pg_stat_reset) e ele volta a NULL.
for _ in $(seq 1 300); do
  pendentes="$(docker compose exec -T banco psql -U loja -d loja -X -At -c "
    SELECT (SELECT count(*) FROM pg_stat_user_tables s JOIN pg_class c ON c.oid = s.relid
             WHERE s.n_ins_since_vacuum > 1000 + 0.2 * greatest(c.reltuples, 0))
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
