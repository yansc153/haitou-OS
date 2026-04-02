#!/bin/zsh
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <tab_index> <javascript>"
  exit 1
fi

TAB_INDEX="$1"
shift
JS="$*"

osascript \
  -e "tell application \"Google Chrome\" to set active tab index of front window to ${TAB_INDEX}" \
  -e "tell application \"Google Chrome\" to execute active tab of front window javascript \"${JS}\""
