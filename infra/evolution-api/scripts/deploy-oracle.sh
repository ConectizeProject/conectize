#!/usr/bin/env bash
# Bootstrap Evolution API no Oracle Cloud (Ubuntu ARM64, Always Free).
# Uso na VM: cd ~/evolution-api && bash scripts/deploy-oracle.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Conectize Evolution â€” deploy Oracle ($(uname -m))"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "${USER}" || true
  echo "    Se docker permission denied, rode: newgrp docker"
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERRO: docker compose plugin nÃ£o encontrado."
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f env.example.txt ]; then
    cp env.example.txt .env
    echo "==> Criado .env a partir de env.example.txt â€” EDITE antes de continuar:"
    echo "    - AUTHENTICATION_API_KEY (openssl rand -hex 32)"
    echo "    - SERVER_URL=https://evolution.seudominio.com.br"
    echo "    - DATABASE_CONNECTION_URI=postgresql://evolution:evolution@postgres-evolution:5432/evolution?schema=evolution_api"
    echo "    - DATABASE_PROVIDER=postgresql"
    exit 1
  fi
  echo "ERRO: .env nÃ£o encontrado."
  exit 1
fi

# Postgres local (recomendado na VM â€” sem Supabase remoto)
grep -q 'postgres-evolution' .env || {
  echo "AVISO: .env nÃ£o aponta para postgres-evolution. Veja ORACLE-CLOUD-DEPLOY.md"
}

echo "==> Subindo Evolution + Redis + Postgres..."
docker compose -f docker-compose.yml -f docker-compose.postgres.yml --env-file .env pull
docker compose -f docker-compose.yml -f docker-compose.postgres.yml --env-file .env up -d

echo "==> Aguardando health (30s)..."
sleep 30

if curl -sf http://127.0.0.1:8080/ >/dev/null; then
  echo "OK: Evolution respondendo em http://127.0.0.1:8080"
  echo "PrÃ³ximo passo: Cloudflare Tunnel â†’ HTTPS (ORACLE-CLOUD-DEPLOY.md parte 5)"
else
  echo "Evolution ainda nÃ£o respondeu â€” veja logs:"
  echo "  docker compose -f docker-compose.yml -f docker-compose.postgres.yml logs --tail=80 evolution-api"
  exit 1
fi
