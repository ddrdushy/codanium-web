#!/bin/bash
# ============================================================================
# Codanium — LLM Provider Switcher
# ============================================================================
# Quick switch between LLM providers during development.
#
# Usage:
#   ./scripts/switch-llm.sh nvidia       # Switch to NVIDIA API
#   ./scripts/switch-llm.sh ollama       # Switch to Ollama cloud model
#   ./scripts/switch-llm.sh ollama-local # Switch to small local Ollama model
#   ./scripts/switch-llm.sh status       # Show current config
# ============================================================================

# Ensure PGPASSWORD is set in environment or default to local dev pass
export PGPASSWORD="${PGPASSWORD:-ats_dev_password}"
PG="psql -h localhost -p 14000 -U ats -d ai_team_studio"

set_provider() {
  local provider="$1" model="$2" base_url="$3" api_key="$4"
  $PG -c "
    INSERT INTO admin_settings (key, value, \"updatedAt\", \"updatedBy\") VALUES
      ('llm.defaultProvider', '\"$provider\"', NOW(), 'admin'),
      ('llm.defaultModel', '\"$model\"', NOW(), 'admin'),
      ('llm.baseUrl', '\"$base_url\"', NOW(), 'admin'),
      ('llm.apiKey', '\"$api_key\"', NOW(), 'admin')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, \"updatedAt\" = NOW();
  " > /dev/null 2>&1
  echo "✅ Switched to: $provider"
  echo "   Model:    $model"
  echo "   Base URL: $base_url"
}

show_status() {
  echo "=== Current LLM Config ==="
  $PG -c "SELECT key, value FROM admin_settings WHERE key LIKE 'llm.%' ORDER BY key;"
}

case "${1:-}" in
  nvidia)
    set_provider \
      "openai" \
      "qwen/qwen3.5-122b-a10b" \
      "https://integrate.api.nvidia.com/v1" \
      "${NVIDIA_API_KEY:-YOUR_NVIDIA_API_KEY_HERE}"
    ;;
  ollama)
    set_provider \
      "ollama" \
      "gpt-oss:120b-cloud" \
      "http://host.docker.internal:11434" \
      ""
    ;;
  ollama-local)
    set_provider \
      "ollama" \
      "qwen2.5:3b" \
      "http://host.docker.internal:11434" \
      ""
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: $0 {nvidia|ollama|ollama-local|status}"
    echo ""
    echo "  nvidia       — NVIDIA API (qwen/qwen3.5-122b-a10b)"
    echo "  ollama       — Ollama cloud (gpt-oss:120b-cloud)"
    echo "  ollama-local — Ollama local (qwen2.5:3b, no cloud quota)"
    echo "  status       — Show current config"
    exit 1
    ;;
esac
