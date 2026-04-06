#!/bin/bash
# 海投 OS — 一键部署脚本
# 用法: ./deploy.sh [edge|worker|all]

set -e

PROJECT_REF="rlpipofmnqveughopxud"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
DEPLOY_TARGET="${1:-all}"

# 所有 Edge Functions
FUNCTIONS=(
  activation-confirm activation-get admin-stats
  handoff-close handoff-resolve handoff-takeover handoff-waiting-external handoffs-list
  home-get
  onboarding-complete onboarding-draft onboarding-get onboarding-resume
  opportunities-list opportunity-detail opportunity-trigger-takeover
  platform-connect platform-disconnect platform-health-check platform-reconnect platforms-list
  readiness-get review-get
  settings-get settings-update submission-profile
  team-pause team-start
)

# Pre-deploy: create git tag
tag_deploy() {
  local TAG="deploy-$(date +%Y%m%d-%H%M%S)"
  git tag "$TAG" 2>/dev/null && echo "Tagged: $TAG" || echo "⚠ git tag failed (non-fatal)"
}

deploy_edge() {
  echo "═══ Deploying ${#FUNCTIONS[@]} Edge Functions ═══"
  local failed=0
  for fn in "${FUNCTIONS[@]}"; do
    echo -n "  $fn ... "
    if supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --use-api --no-verify-jwt 2>/dev/null; then
      echo "✓"
    else
      echo "✗ FAILED"
      failed=$((failed + 1))
    fi
  done
  echo "═══ Edge Functions: $((${#FUNCTIONS[@]} - failed))/${#FUNCTIONS[@]} deployed ═══"

  # Post-deploy: verify a sample function responds
  echo -n "  Verifying Edge Functions (OPTIONS)... "
  local HTTP_CODE
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "${SUPABASE_URL}/functions/v1/home-get" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✓ (HTTP $HTTP_CODE)"
  else
    echo "⚠ HTTP $HTTP_CODE — check Supabase dashboard"
  fi

  [ $failed -gt 0 ] && return 1 || return 0
}

deploy_worker() {
  echo "═══ Deploying Worker to Fly.io ═══"
  fly deploy --local-only
  echo "═══ Worker deployed ═══"

  # Wait for health check
  echo -n "  Waiting for health check..."
  sleep 10
  STATUS=$(fly status 2>/dev/null | grep -i "started" | head -1)
  if [ -n "$STATUS" ]; then
    echo " ✓ healthy"
  else
    echo " ⚠ check: fly status / fly logs"
  fi

  # Verify fly status
  echo "  --- Fly.io Status ---"
  fly status 2>/dev/null || echo "  ⚠ fly status failed"
}

# Execute
tag_deploy

case "$DEPLOY_TARGET" in
  edge)   deploy_edge ;;
  worker) deploy_worker ;;
  all)    deploy_edge && deploy_worker ;;
  *)      echo "Usage: ./deploy.sh [edge|worker|all]" ;;
esac
