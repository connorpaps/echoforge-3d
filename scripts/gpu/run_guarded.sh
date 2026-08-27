#!/usr/bin/env bash
# run_guarded.sh — run a GPU-intensive command under a hard deadline with
# periodic check-ins. Protects the host: a hung CUDA kernel can't be cancelled
# from inside Python, so at the limit we force-kill the whole process tree.
#
# Usage:
#   bash .audit/run_guarded.sh <limit_sec> <logfile> <marker> <command...>
#
#   limit_sec : hard wall-clock ceiling before the process tree is killed.
#   logfile   : where the command's output is streamed (also polled for check-ins).
#   marker    : unique substring that appears in the command line of the spawned
#               python (e.g. the script path). Used to resolve the real Windows
#               PID — `$!` in Git Bash is an MSYS pid, NOT a Windows pid, so
#               taskkill on it silently misses. A single-column wmic query
#               (ProcessId only, WHERE CommandLine LIKE) avoids the
#               column-order and truncation bugs of `get ProcessId,CommandLine`.
# Exit code 124 means the limit was hit and the tree was killed.

set -u
LIMIT="${1:?limit_sec required}"
LOG="${2:?logfile required}"
MARKER="${3:?marker required}"
shift 3

START=$(date +%s)
echo "[watchdog] limit=${LIMIT}s log=${LOG} marker=${MARKER}"
echo "[watchdog] cmd: $*"
"$@" > "$LOG" 2>&1 &
CHECK=0

# Resolve every live python whose command line contains the marker.
winpids() {
  wmic process where "name='python.exe' and CommandLine like '%${MARKER}%'" get ProcessId 2>/dev/null \
    | grep -oE '[0-9]+'
}

# A process may not exist yet (still importing); sweep a few times before giving up.
kill_tree() {
  local attempt
  for attempt in 1 2 3 4 5; do
    local found=0
    for pid in $(winpids); do
      found=1
      echo "[watchdog] killing pid ${pid} (attempt ${attempt})"
      taskkill //PID "$pid" //T //F > /dev/null 2>&1
    done
    [ "$found" -eq 0 ] && return 0
    sleep 2
  done
  return 1
}

while true; do
  sleep 5
  CHECK=$((CHECK + 1))
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  if [ $((CHECK % 3)) -eq 1 ]; then
    GPU=$(nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader 2>/dev/null | tr -d ' ')
    LAST=$(tail -1 "$LOG" 2>/dev/null | head -c 140)
    echo "[watchdog] ${ELAPSED}s elapsed | GPU ${GPU:-n/a} | last: ${LAST:-}"
  fi
  # Early completion: the marker process is gone AND the background job exited.
  if [ -z "$(winpids)" ] && ! kill -0 "$(jobs -p)" 2>/dev/null; then
    break
  fi
  if [ "$ELAPSED" -ge "$LIMIT" ]; then
    echo "[watchdog] HARD LIMIT ${LIMIT}s reached — killing process tree"
    if kill_tree; then
      echo "[watchdog] all marker processes terminated."
    else
      echo "[watchdog] WARNING: some marker processes could not be killed."
    fi
    sleep 2
    echo "[watchdog] last 15 log lines:"
    tail -15 "$LOG"
    exit 124
  fi
done

wait "$(jobs -p)" 2>/dev/null
RC=$?
echo "[watchdog] finished rc=${RC} in $(( $(date +%s) - START ))s"
exit "$RC"
