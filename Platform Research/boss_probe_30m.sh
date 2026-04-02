#!/bin/zsh
set -u

ROOT="/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform Research"
WORKDIR="$ROOT/boss-cli"
LOGDIR="$ROOT/logs"
mkdir -p "$LOGDIR"

TS="$(date +%Y%m%d_%H%M%S)"
LOGFILE="$LOGDIR/boss_probe_${TS}.log"

SEARCH_QUERY="Python"
SEARCH_CITY="全国"
DETAIL_ID="xlysHmJGVkPPL-y1lCY_Aem0AVSDtvO-F8tDGruvst0iaIZ-LXMgZBEqryLqMqWMOvvxyTjV4IdaPlVQiqU6GqowRF_FSgIeK9t-kXcMuQD8JzVB8CAzYKh78K7TKkKQ6Ab5vbrUykLnB563MPdsipdi0ErVDnDyy1OxFeYIDH8BTbXbeupt1cnLWvX1x0NjeIOfjVt8esFQLibD5XCg2Oi3vkm_pxD_9PjQRGQHUBmW5cLXDfvgFdI1i97kWD2sYbF5cs0gLyg1FfDx1R5KvaFJkmzPId-Msx2dKNnoppAz3l4bkW8dwUQnZP3F-V4vAarEwg~~"
GREET_IDS=(
  "FwLO8MKpn18W6-K1UEWR2oAC58bevayp-5xAOP8hreOl2vuHKj6qpDYuSSLVi8IzGpUpBhktdE83b9nR0QGIhSKIhqT0krVcnKhN_0Ypp1RdyLTPY4zrQ8ibGw6Q-g177HtDjm99aWqh-K3BAoFlFoV4Q2L0C8v4FSsocSOVDNKi9d9lq1I3dRuAwmxC1GhVelrhdSbjiMELQ1aTQJWwvC8HYmr8NkYV4DMZF3AnyGWufdLJIM842pMd-KLd4TmMJmXqPeZUe33btGCnuEAjVu4yo9v5kOH_GfVUIN7ZZ4XB"
  "ZUpWtcmX80q4F-61HF8PbZR-jRrF84NEiU_jmoh5gNdDt4anyTTRgUqhD8Qa76BdBO_VT2yAybpWb6o5E5fxpaBab7elkmZh8z_xVtr7OI1z6vvgiqx6z4vgU80vPvtjA43cx_albQuyXS5W5ONBWCWZzQyf-dKh4ukH1K3d9Ak2ahXeTS0XvOoMEH7zEdFifkKajPGIoxq25LJTop4Tb9DRRVUDe_Ii-FSLyIhzWWh_9qAX3mL9Ued7IJz8vsRyhhFIlNUOtIM1KSD9zj3mCGf2G9sRQaXzdydzPmCbiag01PbhZYtwxJtsXFYTUlLbNhQGdy4~"
)

cd "$WORKDIR" || exit 1

echo "# Boss 30m probe" | tee -a "$LOGFILE"
echo "# started_at=$(date -Iseconds)" | tee -a "$LOGFILE"
echo "# logfile=$LOGFILE" | tee -a "$LOGFILE"

run_block() {
  local label="$1"
  local cmd="$2"
  echo "" | tee -a "$LOGFILE"
  echo "## $label @ $(date -Iseconds)" | tee -a "$LOGFILE"
  echo "\$ $cmd" | tee -a "$LOGFILE"
  eval "$cmd" >> "$LOGFILE" 2>&1
  echo "exit_code=$?" | tee -a "$LOGFILE"
}

for cycle in {1..10}; do
  echo "" | tee -a "$LOGFILE"
  echo "================ cycle_${cycle} $(date -Iseconds) ================" | tee -a "$LOGFILE"

  run_block "status" "./.venv/bin/boss status --json"
  run_block "search" "./.venv/bin/boss search '$SEARCH_QUERY' --city '$SEARCH_CITY' --json"

  if [[ "$cycle" == "1" || "$cycle" == "4" || "$cycle" == "7" || "$cycle" == "10" ]]; then
    run_block "detail" "./.venv/bin/boss detail '$DETAIL_ID' --json"
  fi

  if [[ "$cycle" == "1" || "$cycle" == "6" ]]; then
    greet_index=1
    if [[ "$cycle" == "6" ]]; then
      greet_index=2
    fi
    run_block "greet" "./.venv/bin/boss greet '${GREET_IDS[$greet_index]}' --json"
    sleep 20
    run_block "chat_after_greet" "./.venv/bin/boss chat --json"
  fi

  if [[ "$cycle" == "3" || "$cycle" == "8" || "$cycle" == "10" ]]; then
    run_block "chat_probe" "./.venv/bin/boss chat --json"
  fi

  if [[ "$cycle" -lt "10" ]]; then
    sleep 180
  fi
done

echo "" | tee -a "$LOGFILE"
echo "# finished_at=$(date -Iseconds)" | tee -a "$LOGFILE"
