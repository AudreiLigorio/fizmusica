#!/usr/bin/env bash
# Descobre se o token do Instagram JÁ é de longa duração (60 dias).
# Usa o endpoint ig_refresh_token, que SÓ aceita token longo.
# Uso: bash scripts/ig-token-check.sh
set -euo pipefail

echo
echo "=== Verificar se o token já é de 60 dias ==="
echo "Copie o token de acesso do painel (o mesmo que publica o post) e tecle Enter."
read -rp "Copiou? Enter... " _
TOKEN="$(pbpaste)"
TOKEN="${TOKEN//[$'\t\r\n ']/}"
echo "-> Token: ${#TOKEN} caracteres"

echo
echo "Testando refresh (só funciona em token longo)..."
RESULT="$(curl -s -G "https://graph.instagram.com/refresh_access_token" \
  --data-urlencode "grant_type=ig_refresh_token" \
  --data-urlencode "access_token=${TOKEN}")"
echo
echo "=== Resposta ==="
echo "${RESULT}"
echo

if echo "${RESULT}" | grep -q '"access_token"'; then
  EXP="$(echo "${RESULT}" | sed -n 's/.*"expires_in":\([0-9]*\).*/\1/p')"
  DAYS=$(( ${EXP:-0} / 86400 ))
  NEW="$(echo "${RESULT}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"
  echo "✅ É token LONGO. O refresh renovou por ~${DAYS} dias."
  printf 'IG_LONG_LIVED_TOKEN=%s\n' "${NEW}" > /tmp/ig_long_token.txt
  echo "   Token renovado salvo em /tmp/ig_long_token.txt (linha pro .env.local)."
else
  echo "ℹ️  O refresh não aceitou — então este token é CURTO (1h) e a troca"
  echo "   (ig_exchange_token) é o caminho certo. Me manda esta resposta."
fi
