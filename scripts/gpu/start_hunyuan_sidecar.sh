#!/usr/bin/env bash
set -euo pipefail

HUNYUAN_ROOT="${HUNYUAN_ROOT:-G:/EchoForge_App/hunyuan3d-2gp}"
HF_HOME="${HF_HOME:-G:/hf-cache}"
PORT="${HUNYUAN_PORT:-8081}"
PROFILE="${HUNYUAN_PROFILE:-4}"

if [[ ! -x "$HUNYUAN_ROOT/.venv/Scripts/python.exe" ]]; then
  printf 'Hunyuan sidecar environment not found: %s\n' "$HUNYUAN_ROOT/.venv" >&2
  exit 1
fi

export HF_HOME
export ECHOFORGE_HUNYUAN_OUTPUT="${ECHOFORGE_HUNYUAN_OUTPUT:-G:/EchoForge_App/hunyuan3d-cache/outputs}"

exec "$HUNYUAN_ROOT/.venv/Scripts/python.exe" \
  "$HUNYUAN_ROOT/echoforge_sidecar.py" \
  --host 127.0.0.1 \
  --port "$PORT" \
  --profile "$PROFILE"
