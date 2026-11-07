#!/usr/bin/env bash
# Coleta evidências de DIAGNÓSTICO do estado atual da aplicação e salva em diagnostico/<rotulo>/.
# Não é medição de antes/depois: os números de resultado saem só do scripts/medir.sh.
#
#   diagnostico/coletar.sh <rotulo> <arquivo-de-consultas.sql>
#   ex.: diagnostico/coletar.sh 00-linha-de-base diagnostico/consultas/00-originais.sql
#   SEM_CARGA=1 pula a fase com pg_stat_statements (só coleta as partes 1 a 3, com o banco ocioso).
#
# Arquivos gerados:
#   ambiente.txt            versão e parâmetros do PostgreSQL, tamanho das tabelas, índices e chaves estrangeiras
#   explain.txt             EXPLAIN (ANALYZE, BUFFERS) das consultas de cada rota, com o banco ocioso
#   custo-conexao.txt       micro-benchmark: conexão nova por consulta x conexão reaproveitada
#   consultas-por-rota.txt  consultas (pg_stat_statements) e conexões (log_connections) de UMA chamada de cada rota
#   carga-k6.txt            saída do k6 na carga de diagnóstico (mesmos VUS/DURACAO/SEMENTE do medir.sh)
#   carga-consultas.txt     pg_stat_statements: consultas que mais consumiram tempo do banco durante a carga
#   carga-tabelas.txt       pg_stat_user_tables e pg_stat_database durante a carga (varreduras, sessões, disco)
#   carga-atividade.txt     amostragem de pg_stat_activity a cada 1 s: o que o banco estava executando
#   log-api.txt             volume do log da API durante a carga e exemplos de linha
#
# As partes 4 a 6 reiniciam o banco com diagnostico/docker-compose.pgss.yml (pg_stat_statements e
# log_connections ligados) e, no fim, voltam para o docker-compose.yml normal e removem a extensão.

set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1   # Git Bash no Windows: não converter caminhos como /carga/... em C:/...

ROTULO="${1:-}"
CONSULTAS="${2:-}"
if [[ -z "$ROTULO" || -z "$CONSULTAS" || ! -f "$CONSULTAS" ]]; then
  echo "uso: diagnostico/coletar.sh <rotulo> <arquivo-de-consultas.sql>" >&2
  exit 2
fi
VUS="${VUS:-20}"
DURACAO="${DURACAO:-60s}"
SEMENTE="${SEMENTE:-42}"
PASTA="diagnostico/${ROTULO}"
mkdir -p "$PASTA"

psql_banco() { docker compose exec -T banco psql -U loja -d loja -X -v ON_ERROR_STOP=1 "$@"; }
api_no_ar() {
  for _ in $(seq 1 60); do
    curl -fsS http://127.0.0.1:3000/saude >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "API não respondeu" >&2; return 1
}
cabecalho() {
  echo "# rotulo: ${ROTULO}"
  echo "# data: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "# commit: $(git rev-parse --short HEAD) (arquivos alterados sem commit: $(git status --porcelain -- . ':(exclude)resultados' ':(exclude)diagnostico' | wc -l | tr -d ' '))"
  echo
}

api_no_ar

echo "[1/6] ambiente..."
{
  cabecalho
  psql_banco <<'SQL'
\pset pager off
SELECT version();
SELECT name, setting, unit, source FROM pg_settings
 WHERE name IN ('shared_buffers','work_mem','effective_cache_size','maintenance_work_mem','max_connections','jit',
                'jit_above_cost','random_page_cost','max_parallel_workers_per_gather','shared_preload_libraries')
 ORDER BY name;
SELECT c.relname AS tabela, c.reltuples::bigint AS linhas_estimadas,
       pg_size_pretty(pg_relation_size(c.oid)) AS dados, pg_size_pretty(pg_indexes_size(c.oid)) AS indices,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r','m')
 ORDER BY pg_total_relation_size(c.oid) DESC;
SELECT tablename AS tabela, indexname AS indice, indexdef AS definicao FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2;
SELECT conrelid::regclass AS tabela, conname AS chave_estrangeira, pg_get_constraintdef(oid) AS definicao
  FROM pg_constraint WHERE contype = 'f' ORDER BY 1, 2;
SQL
} > "${PASTA}/ambiente.txt" 2>&1

echo "[2/6] EXPLAIN ANALYZE das consultas (${CONSULTAS})..."
{ cabecalho; psql_banco < "$CONSULTAS"; } > "${PASTA}/explain.txt" 2>&1

echo "[3/6] custo de conexão (micro-benchmark dentro do container da API)..."
{ cabecalho; docker compose exec -T api node - < diagnostico/custo-conexao.js; } > "${PASTA}/custo-conexao.txt" 2>&1

if [[ "${SEM_CARGA:-}" == "1" ]]; then
  echo "SEM_CARGA=1: pulando as partes com pg_stat_statements."
  echo "Diagnóstico salvo em ${PASTA}/"
  exit 0
fi

echo "[4/6] reiniciando o banco com pg_stat_statements e log_connections (só para o diagnóstico)..."
restaurar() {
  echo "Restaurando o banco para o docker-compose.yml normal..."
  psql_banco -c "DROP EXTENSION IF EXISTS pg_stat_statements;" >/dev/null 2>&1 || true
  docker compose up -d --wait banco >/dev/null 2>&1
  docker compose restart api >/dev/null 2>&1
  api_no_ar
}
trap restaurar EXIT
docker compose -f docker-compose.yml -f diagnostico/docker-compose.pgss.yml up -d --wait banco >/dev/null 2>&1
docker compose restart api >/dev/null 2>&1
api_no_ar
psql_banco -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" >/dev/null

echo "      consultas e conexões por chamada de cada rota..."
ROTAS=(
  "/clientes/42"
  "/clientes?email=cliente3%40exemplo.com"
  "/clientes/42/pedidos"
  "/pedidos?status=pago&pagina=500"
  "/produtos/busca?q=cadeira"
  "/relatorios/vendas-por-dia?inicio=2024-06-01&fim=2024-06-07"
  "/relatorios/top-produtos?limite=10"
)
# Uma chamada da rota de cada vez, com o banco ocioso. As consultas da própria coleta (psql) são descontadas:
# no pg_stat_statements, pelo texto; no log de conexões, pelo endereço de origem.
consultas_api() { psql_banco -At -c "SELECT coalesce(sum(calls), 0) FROM pg_stat_statements WHERE query !~* 'pg_stat|pg_backend'"; }
{
  cabecalho
  echo "Uma chamada de cada rota, com o banco ocioso."
  echo "consultas = execuções no banco (pg_stat_statements); conexoes = conexões novas (log_connections)."
  echo
  printf "%-62s %7s %10s %10s %9s\n" "rota" "status" "consultas" "conexoes" "tempo_s"
  for rota in "${ROTAS[@]}"; do
    psql_banco -c "SELECT pg_stat_statements_reset();" >/dev/null
    sleep 1
    desde="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    sleep 1
    # o corpo é descartado pelo shell (não com -o /dev/null, que o curl nativo do Windows não entende)
    resposta="$(curl -s -w '\n%{http_code} %{time_total}' "http://127.0.0.1:3000${rota}" | tail -n 1)"
    sleep 1
    consultas="$(consultas_api | tr -d '\r')"
    # conexões TCP vindas da rede dos containers (a API); exclui o healthcheck (127.0.0.1) e o psql ([local])
    conexoes="$(docker compose logs --no-log-prefix --since "$desde" banco 2>/dev/null \
      | grep 'connection received: host=' | grep -v 'host=127.0.0.1' | grep -vc 'host=\[local\]' || true)"
    printf "%-62s %7s %10s %10s %9s\n" "$rota" "${resposta% *}" "$consultas" "$conexoes" "${resposta#* }"
  done
} > "${PASTA}/consultas-por-rota.txt" 2>&1

echo "[5/6] carga de diagnóstico..."
echo "      aquecimento (5 VUs, 15 s, outra semente, como no medir.sh)..."
docker compose run --rm -e VUS=5 -e DURACAO=15s -e SEMENTE="$((SEMENTE + 1))" \
  carga run --quiet --no-summary /carga/teste-carga.js >/dev/null 2>&1
psql_banco -c "SELECT pg_stat_statements_reset();" -c "SELECT pg_stat_reset();" >/dev/null
INICIO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Amostragem do que o banco está executando: uma linha por sessão ativa a cada 1 s
# (sem sessão ativa, sai uma linha vazia, para contar a amostra).
AMOSTRAS="$(( ${DURACAO%s} - 5 ))"
psql_banco -At -F '|' > "${PASTA}/.atividade.raw" 2>&1 <<SQL &
SELECT to_char(statement_timestamp(), 'HH24:MI:SS.MS'),
       CASE WHEN a.pid IS NULL THEN '' ELSE coalesce(a.wait_event_type || ':' || a.wait_event, 'CPU') END,
       coalesce(left(regexp_replace(a.query, '\s+', ' ', 'g'), 150), '')
  FROM (SELECT 1) AS x
  LEFT JOIN pg_stat_activity a
    ON a.datname = 'loja' AND a.state = 'active' AND a.backend_type = 'client backend' AND a.pid <> pg_backend_pid()
\watch i=1 c=${AMOSTRAS}
SQL
AMOSTRADOR=$!

echo "      carga: ${VUS} VUs por ${DURACAO}, semente ${SEMENTE}..."
docker compose run --rm -e VUS="$VUS" -e DURACAO="$DURACAO" -e SEMENTE="$SEMENTE" -e ROTULO="diagnostico-${ROTULO}" \
  carga run --quiet /carga/teste-carga.js > "${PASTA}/carga-k6.txt" 2>&1
wait "$AMOSTRADOR" || true

{
  cabecalho
  echo "pg_stat_statements durante a carga de diagnóstico (${VUS} VUs, ${DURACAO}, semente ${SEMENTE})."
  echo "tempo_total_ms = soma do tempo de execução no banco; pct = fatia do tempo total do banco."
  echo
  psql_banco <<'SQL'
\pset pager off
WITH s AS (SELECT * FROM pg_stat_statements
            WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'loja') AND query !~* 'pg_stat|pg_backend')
SELECT calls AS chamadas,
       round(total_exec_time::numeric, 0) AS tempo_total_ms,
       round((100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct,
       round(mean_exec_time::numeric, 2) AS media_ms,
       rows AS linhas,
       shared_blks_hit AS blocos_cache, shared_blks_read AS blocos_lidos, temp_blks_written AS blocos_temp,
       left(regexp_replace(query, '\s+', ' ', 'g'), 110) AS consulta
  FROM s ORDER BY total_exec_time DESC LIMIT 15;
SQL
} > "${PASTA}/carga-consultas.txt" 2>&1

{
  cabecalho
  echo "Contadores acumulados durante a carga de diagnóstico (zerados com pg_stat_reset logo antes)."
  echo
  psql_banco <<'SQL'
\pset pager off
SELECT relname AS tabela, seq_scan AS varreduras_seq, seq_tup_read AS linhas_lidas_seq,
       idx_scan AS buscas_indice, idx_tup_fetch AS linhas_via_indice
  FROM pg_stat_user_tables ORDER BY seq_tup_read DESC;
SELECT sessions AS sessoes_abertas, xact_commit AS transacoes, blks_read AS blocos_lidos_disco, blks_hit AS blocos_cache,
       round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 1) AS pct_cache,
       temp_files AS arquivos_temp, pg_size_pretty(temp_bytes) AS bytes_temp,
       round(active_time::numeric / 1000, 1) AS tempo_ativo_s, round(session_time::numeric / 1000, 1) AS tempo_sessao_s
  FROM pg_stat_database WHERE datname = 'loja';
SQL
} > "${PASTA}/carga-tabelas.txt" 2>&1

RAW="${PASTA}/.atividade.raw"
resumo_atividade() { # $1 = coluna agrupada (2 = estado de espera, 3 = consulta)
  awk -F'|' -v col="$1" '
    $1 !~ /^[0-9]/ { next }
    { amostras[$1] = 1 }
    $2 != "" { ativas++; grupo[$col]++ }
    END {
      n = 0; for (a in amostras) n++
      for (g in grupo) printf "  %6.2f  %5.1f%%  %s\n", grupo[g] / n, 100 * grupo[g] / ativas, g
    }' "$RAW" | sort -rn
}
{
  cabecalho
  awk -F'|' '
    $1 !~ /^[0-9]/ { next }
    { amostras[$1] = 1 }
    $2 != "" { ativas++ }
    END {
      n = 0; for (a in amostras) n++
      printf "Amostras: %d (1 por segundo). Sessões ativas em média: %.2f (com 1 CPU no banco, acima de 1 = fila).\n", n, ativas / n
    }' "$RAW"
  echo
  echo "Por estado de espera (CPU = executando, sem esperar). Colunas: sessões ativas em média, % das amostras ativas."
  resumo_atividade 2
  echo
  echo "Por consulta (quanto do banco cada consulta ocupa). Colunas: sessões ativas em média, % das amostras ativas."
  resumo_atividade 3
} > "${PASTA}/carga-atividade.txt" 2>&1
rm -f "$RAW"

echo "[6/6] log da API durante a carga..."
docker compose logs --no-log-prefix --since "$INICIO" api > "${PASTA}/.log-api.raw" 2>/dev/null || true
REQS="$(grep -Eo 'Requisições: +[0-9]+' "${PASTA}/carga-k6.txt" | grep -Eo '[0-9]+' || echo 0)"
{
  cabecalho
  LINHAS="$(wc -l < "${PASTA}/.log-api.raw" | tr -d ' ')"
  BYTES="$(wc -c < "${PASTA}/.log-api.raw" | tr -d ' ')"
  echo "Log da API (stdout do container) durante a carga de diagnóstico:"
  echo "  linhas: ${LINHAS}"
  echo "  bytes:  ${BYTES}"
  echo "  requisições da carga (k6): ${REQS}"
  if [[ "$REQS" -gt 0 ]]; then echo "  bytes de log por requisição: $((BYTES / REQS))"; fi
  echo "  maior linha (bytes): $(awk '{ if (length($0) > m) m = length($0) } END { print m + 0 }' "${PASTA}/.log-api.raw")"
  echo
  echo "Exemplos (primeiros 600 caracteres de linhas de rotas diferentes):"
  for padrao in '"url":"/clientes/[0-9]+"' '"url":"/clientes\?email' '"url":"/clientes/[0-9]+/pedidos"' '"url":"/relatorios/vendas'; do
    grep -m1 -E "$padrao" "${PASTA}/.log-api.raw" | cut -c1-600 || true
  done
} > "${PASTA}/log-api.txt" 2>&1
rm -f "${PASTA}/.log-api.raw"

echo "Diagnóstico salvo em ${PASTA}/"
