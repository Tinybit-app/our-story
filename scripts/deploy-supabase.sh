#!/usr/bin/env bash
# Deploy migrations + edge functions to the currently linked Supabase project.
# Reads secrets from .env.supabase (gitignored).
#
# Usage:
#   pnpm supabase:deploy                  # deploy everything
#   pnpm supabase:deploy migrations       # migrations only
#   pnpm supabase:deploy functions        # functions only
#   pnpm supabase:deploy secrets          # secrets only
#
# First-time setup:
#   1. supabase login
#   2. supabase link --project-ref <ref>
#   3. cp .env.supabase.example .env.supabase  and fill in values
#   4. pnpm supabase:deploy

set -euo pipefail

cd "$(dirname "$0")/.."

# ---- guard: must be linked --------------------------------------------------
if [ ! -f supabase/.temp/project-ref ]; then
  echo "✗ Not linked to a Supabase project."
  echo "  Run: supabase link --project-ref <your-uat-project-ref>"
  exit 1
fi
PROJECT_REF=$(cat supabase/.temp/project-ref)
echo "→ Target project: $PROJECT_REF"

# ---- confirm against prod ---------------------------------------------------
if [[ "${PROJECT_REF}" == *"prod"* ]] || [ "${CONFIRM_PROD:-}" = "1" ]; then
  read -r -p "⚠  Looks like a production project. Type 'deploy' to continue: " ok
  [ "$ok" = "deploy" ] || { echo "Aborted."; exit 1; }
fi

STEP="${1:-all}"

# ---- migrations -------------------------------------------------------------
deploy_migrations() {
  echo ""
  echo "━━━ Migrations ━━━"
  supabase db push --linked
}

# ---- edge functions ---------------------------------------------------------
deploy_functions() {
  echo ""
  echo "━━━ Edge functions ━━━"
  for fn in supabase/functions/*/; do
    name=$(basename "$fn")
    [ "$name" = "_shared" ] && continue
    echo "→ deploying $name"
    supabase functions deploy "$name" --project-ref "$PROJECT_REF"
  done
}

# ---- secrets ----------------------------------------------------------------
deploy_secrets() {
  echo ""
  echo "━━━ Edge function secrets ━━━"
  if [ ! -f .env.supabase ]; then
    echo "✗ .env.supabase not found. Copy .env.supabase.example and fill it in."
    exit 1
  fi
  supabase secrets set --project-ref "$PROJECT_REF" --env-file .env.supabase
}

case "$STEP" in
  migrations) deploy_migrations ;;
  functions)  deploy_functions ;;
  secrets)    deploy_secrets ;;
  all)        deploy_migrations; deploy_functions; deploy_secrets ;;
  *)          echo "Unknown step: $STEP (use migrations|functions|secrets|all)"; exit 1 ;;
esac

echo ""
echo "✓ Done."
