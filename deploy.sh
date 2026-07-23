#!/bin/bash
# Production deploy script for nexus-crm (sales.orelit.com).
#
# Usage (on the EC2 server):   ./deploy.sh          # deploys the main branch
#                              ./deploy.sh dev-g    # explicit branch override (avoid)
#
# Encodes the Phase-0 rules from plan-production-deployment.md:
# always the PROD compose file, tag every deploy, smoke-test before
# declaring success, fail loudly otherwise. If this script fails partway,
# roll back with:  git checkout <previous deploy-* tag>
#                  docker compose -f docker-compose.prod.yml up -d --build
set -euo pipefail
cd "$(dirname "$0")"

BRANCH="${1:-main}"
COMPOSE="docker compose -f docker-compose.prod.yml"
BASE_URL="https://sales.orelit.com"

echo "==> Deploying branch: $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

TAG="deploy-$(date +%Y-%m-%d-%H%M)"
git tag "$TAG"
echo "==> Tagged as $TAG (rollback: git checkout <previous tag> + compose up --build)"

echo "==> Building and starting containers (prod compose, never the dev file)"
$COMPOSE up -d --build

echo "==> Running database migrations"
$COMPOSE exec -T backend pnpm --filter @orelia/backend migration:run

echo "==> Running seed (idempotent -- registers any new RBAC permissions)"
$COMPOSE exec -T backend pnpm --filter @orelia/backend seed

# The frontend container runs `next build` on startup, which takes a few
# minutes -- poll until it actually serves before smoke-testing.
echo "==> Waiting for frontend to finish building (up to 10 min)"
frontend_ok=""
for _ in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$BASE_URL/" || true)
  if [ "$code" = "200" ] || [ "$code" = "307" ]; then frontend_ok=1; break; fi
  sleep 5
done
if [ -z "$frontend_ok" ]; then
  echo "❌ FRONTEND SMOKE TEST FAILED: $BASE_URL/ never came up. Check: $COMPOSE logs frontend"
  exit 1
fi
echo "    frontend up ($code)"

# A fake login returning 401 proves the whole chain: nginx -> backend ->
# database -> auth logic. Anything else (000/5xx) is a real outage.
echo "==> API smoke test (expect 401 for fake credentials)"
api_code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"smoke-probe","username":"smoke-probe","password":"smoke-probe"}' || true)
if [ "$api_code" != "401" ]; then
  echo "❌ API SMOKE TEST FAILED: expected 401, got $api_code. Check: $COMPOSE logs backend"
  exit 1
fi
echo "    api up (401 as expected)"

echo "✅ Deploy $TAG succeeded."
