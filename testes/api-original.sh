#!/usr/bin/env bash
# Sobe o código ORIGINAL da API (commit do estado original do desafio) num container à parte, na porta
# 3001, ligado ao mesmo banco do docker-compose. Serve de referência para testes/equivalencia.js.
#
#   testes/api-original.sh          # sobe
#   testes/api-original.sh parar    # remove o container (faça isso antes de medir)
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

COMMIT_ORIGINAL="$(git log --format=%h --grep='^chore: estado original do desafio' | tail -n 1)"
NOME=loja-api-original

if [[ "${1:-}" == "parar" ]]; then
  docker rm -f "$NOME" >/dev/null 2>&1 || true
  echo "API original removida."
  exit 0
fi

git archive "${COMMIT_ORIGINAL}:api" | docker build -q -t "${NOME}:${COMMIT_ORIGINAL}" - >/dev/null
docker rm -f "$NOME" >/dev/null 2>&1 || true
REDE="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$(docker compose ps -q banco)")"
docker run -d --name "$NOME" --network "$REDE" -e DB_HOST=banco -e DB_USER=loja -e DB_NAME=loja \
  -p 127.0.0.1:3001:3000 "${NOME}:${COMMIT_ORIGINAL}" >/dev/null
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3001/saude >/dev/null 2>&1 && { echo "API original (${COMMIT_ORIGINAL}) em http://127.0.0.1:3001"; exit 0; }
  sleep 1
done
echo "API original não respondeu" >&2
exit 1
