#!/bin/zsh
set -euo pipefail

ROOT="/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform Research"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOG_DIR/zhaopin_safe_probe_${TS}.log"

DETAIL_URL="https://www.zhaopin.com/jobdetail/CCL1520158950J40852039314.htm?refcode=4089&srccode=408901&preactionid=61fa1510-6642-4337-9460-b204355779f1"

run_osa() {
  osascript "$@"
}

{
  echo "# Zhaopin safe probe"
  echo "# timestamp: $(date -Iseconds)"
  echo

  echo "## Tabs before probe"
  run_osa -e 'tell application "Google Chrome" to get URL of every tab of front window'
  echo

  echo "## Recommend page probe"
  run_osa \
    -e 'tell application "Google Chrome" to set active tab index of front window to 8' \
    -e 'tell application "Google Chrome" to set URL of active tab of front window to "https://www.zhaopin.com/recommend"' \
    -e 'delay 2' \
    -e 'tell application "Google Chrome" to execute active tab of front window javascript "JSON.stringify({url:location.href,title:document.title,jobLinks:[...document.querySelectorAll(\"a[href*=\\\"jobdetail\\\"]\")].map(a=>a.href).slice(0,20),jobCount:[...document.querySelectorAll(\"a[href*=\\\"jobdetail\\\"]\")].length,text:(document.body.innerText||\"\").slice(0,3000)})"'
  echo

  echo "## Detail page probe"
  run_osa \
    -e 'tell application "Google Chrome" to set active tab index of front window to 8' \
    -e "tell application \"Google Chrome\" to set URL of active tab of front window to \"$DETAIL_URL\"" \
    -e 'delay 2' \
    -e 'tell application "Google Chrome" to execute active tab of front window javascript "JSON.stringify({url:location.href,title:document.title,signals:[...document.querySelectorAll(\"a,button,div,span\")].map((el,i)=>({i,text:(el.innerText||el.textContent||\"\").trim(),tag:el.tagName,cls:el.className||\"\"})).filter(x=>x.text.includes(\"立即沟通\")||x.text.includes(\"已投递\")||x.text.includes(\"职位描述\")||x.text.includes(\"职位发布者\")).slice(0,80),text:(document.body.innerText||\"\").slice(0,3500)})"'
  echo

  echo "## Resume page probe"
  run_osa \
    -e 'tell application "Google Chrome" to set active tab index of front window to 7' \
    -e 'delay 2' \
    -e 'tell application "Google Chrome" to execute active tab of front window javascript "JSON.stringify({url:location.href,title:document.title,signals:[...document.querySelectorAll(\"a,button,input\")].map((el,i)=>({i,text:(el.innerText||el.textContent||\"\").trim(),tag:el.tagName,type:el.type||\"\",href:el.href||\"\",placeholder:el.placeholder||\"\",cls:el.className||\"\"})).filter(x=>x.text.includes(\"简历\")||x.text.includes(\"附件\")||x.text.includes(\"上传\")||x.text.includes(\"修改\")).slice(0,120),text:(document.body.innerText||\"\").slice(0,3500)})"'
  echo

  echo "## Tabs after probe"
  run_osa -e 'tell application "Google Chrome" to get URL of every tab of front window'
} | tee "$LOG_FILE"

echo "$LOG_FILE"
