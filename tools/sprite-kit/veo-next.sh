#!/bin/sh
# veo-next.sh — Veo 원장에서 다음 일을 claim 하고, 문안을 올릴 수 있는 자리(SKIT_VEO_TXT)로 복사, 넣을 사진 경로를 찍는다
#   sh tools/sprite-kit/veo-next.sh              → "JOB <id>" · "IMG <윈도 경로>" · "TXT <윈도 경로>"
#   sh tools/sprite-kit/veo-next.sh done <id> <chat url>   → submitted 기록
#   sh tools/sprite-kit/veo-next.sh held <id> "<까닭>"     → 한도·거절로 닫기 (재시도 금지)
# 원장 폴더 VEO_LEDGER (기본: Codex 작업 폴더)
L=${VEO_LEDGER:-C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code}
Q=D:/flutter/arrow_game_one/tools/veo/queue.mjs
T=${SKIT_VEO_TXT:-D:/flutter/arrow_game_one/tools/out/veo-prompt.txt}  # 브라우저 업로드는 작업 폴더 안 파일만 된다
mkdir -p "$(dirname "$T")"
cd "$L" || exit 1
case "$1" in
  done) node $Q submitted "$2" --chat "$3" | grep -E '"status"' | head -1; exit 0 ;;
  held) node $Q review "$2" --verdict held --note "$3" | grep -E '"status"' | head -1; exit 0 ;;
esac
# ★ 연속 실패 걸쇠 (11-13 형: 「다른 일 할 때도 놓쳤겠네 · 내가 모르는 곳에서도 대충 넘어가고 영원히 모를 거 아냐」)
#   마지막 reset 뒤 끝난 시도 셋이 모두 held(거절·오류·혼잡·한도)면 다음 일을 내주지 않는다 → 멈추고 원인부터 확인
#   (마지막으로 성공한 설정 그대로 한 번 · 모델(Argon) · 계정 · 형에게 직접 한 번 부탁). 원인을 찾아 고쳤으면:
#   sh tools/sprite-kit/veo-next.sh reset "<찾은 원인과 고친 것>"   → 원장 폴더 outputs/veo-tripwire.log 에 남기고 다시 연다
TW="$L/outputs/veo-tripwire.log"
if [ "$1" = reset ]; then [ -n "$2" ] || { echo "reset 에는 원인을 적는다"; exit 1; }; echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $2" >> "$TW"; echo "걸쇠 풀림: $2"; exit 0; fi
since=$(tail -1 "$TW" 2>/dev/null | cut -d' ' -f1)
trip=$(node -e '
const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const since=process.argv[2]||"";
const done=s.attempts.filter(a=>["held","downloaded","accepted"].includes(a.status)&&(a.updatedAt||"")>since).sort((a,b)=>(a.updatedAt||"").localeCompare(b.updatedAt||""));
const last=done.slice(-3);
if(last.length===3&&last.every(a=>a.status==="held"))console.log(last.map(a=>a.jobId+" — "+(a.reviewNote||"").slice(0,70)).join(" | "));
' "$L/outputs/veo-production-state.json" "$since")
if [ -n "$trip" ] && [ -z "$FORCE" ]; then
  echo "★ 걸쇠: 마지막 세 편이 모두 실패했다 — 다음 일을 내주지 않는다. 원인부터 확인하고 'veo-next.sh reset \"원인\"'"
  echo "$trip"
  exit 3
fi
job=$(node $Q peek | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s).job;if(!j){console.log("");return}console.log([j.id,j.inputPath,j.promptPath].join("\t"))})')
[ -z "$job" ] && { echo "NONE"; node $Q peek | grep -m3 reason; exit 1; }
id=$(echo "$job" | cut -f1); img=$(echo "$job" | cut -f2); txt=$(echo "$job" | cut -f3)
node $Q claim "$id" | grep -qE '"status": "claimed"' || { echo "claim 실패 $id"; exit 1; }
cp "$txt" "$T" || exit 1
echo "JOB $id"
echo "IMG $(cygpath -w "$img" 2>/dev/null || echo "$img")"
echo "TXT $(cygpath -w "$T" 2>/dev/null || echo "$T")"
