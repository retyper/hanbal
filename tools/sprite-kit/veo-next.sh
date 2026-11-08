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
job=$(node $Q peek | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s).job;if(!j){console.log("");return}console.log([j.id,j.inputPath,j.promptPath].join("\t"))})')
[ -z "$job" ] && { echo "NONE"; node $Q peek | grep -m3 reason; exit 1; }
id=$(echo "$job" | cut -f1); img=$(echo "$job" | cut -f2); txt=$(echo "$job" | cut -f3)
node $Q claim "$id" | grep -qE '"status": "claimed"' || { echo "claim 실패 $id"; exit 1; }
cp "$txt" "$T" || exit 1
echo "JOB $id"
echo "IMG $(cygpath -w "$img" 2>/dev/null || echo "$img")"
echo "TXT $(cygpath -w "$T" 2>/dev/null || echo "$T")"
