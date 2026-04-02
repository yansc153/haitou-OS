#!/bin/zsh
set -euo pipefail

ROOT="/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform Research"
TAB_INDEX="${1:-8}"
DETAIL_URL="${2:-http://www.zhaopin.com/jobdetail/CCL1520158950J40852039314.htm?refcode=4089&srccode=408901&preactionid=e98588d6-879f-48ce-aeb4-6760d9510861}"

echo "## zhaopin recommend summary"
osascript \
  -e "tell application \"Google Chrome\" to set active tab index of front window to ${TAB_INDEX}" \
  -e 'tell application "Google Chrome" to execute active tab of front window javascript "JSON.stringify({url: location.href, title: document.title, ready: document.readyState, cookies: document.cookie, text: document.body.innerText.slice(0,4000)})"'
echo
echo "## zhaopin recommend job links"
osascript \
  -e "tell application \"Google Chrome\" to set active tab index of front window to ${TAB_INDEX}" \
  -e 'tell application "Google Chrome" to execute active tab of front window javascript "JSON.stringify([...document.querySelectorAll(\"a[href*=\\\"jobdetail\\\"]\")].map(a=>({text:(a.innerText||a.textContent||\"\").trim(),href:a.href})).slice(0,10))"'
echo
echo "## zhaopin recommend controls"
osascript \
  -e "tell application \"Google Chrome\" to set active tab index of front window to ${TAB_INDEX}" \
  -e 'tell application "Google Chrome" to execute active tab of front window javascript "JSON.stringify([...document.querySelectorAll(\"a,button,div,span\")].map((el,i)=>({i,text:(el.innerText||el.textContent||\"\").trim(),href:el.href||\"\",tag:el.tagName,className:el.className||\"\"})).filter(x=>x.text.includes(\"立即沟通\")||x.text.includes(\"立即投递\")||x.text.includes(\"简历\")||x.text.includes(\"附件\")||x.text.includes(\"消息\")).slice(0,80))"'
echo
echo "## zhaopin detail summary"
osascript \
  -e "tell application \"Google Chrome\" to set active tab index of front window to ${TAB_INDEX}" \
  -e "tell application \"Google Chrome\" to set URL of active tab of front window to \"${DETAIL_URL}\"" \
  -e 'delay 3' \
  -e "tell application \"Google Chrome\" to execute active tab of front window javascript \"JSON.stringify({url: location.href, title: document.title, cookies: document.cookie, text: document.body.innerText.slice(0,5000), controls:[...document.querySelectorAll(\\\"a,button,div,span\\\")].map(el=>({text:(el.innerText||el.textContent||\\\"\\\").trim(),href:el.href||\\\"\\\",tag:el.tagName,className:el.className||\\\"\\\"})).filter(x=>x.text.includes(\\\"沟通\\\")||x.text.includes(\\\"投递\\\")||x.text.includes(\\\"简历\\\")||x.text.includes(\\\"附件\\\")||x.text.includes(\\\"消息\\\")).slice(0,80)})\""
