#!/bin/sh
# register-realm.sh <key> "<커밋에 쓸 한글 설명>" — 칠십팔국 전용 어댑터 (다른 게임은 이 파일만 새로 쓴다)
#   heroes/*.json 에서 key 의 heroId·weapon 을 읽어
#   art.ts GEN_ANIM 자리줄 · GEN_OWN heroId→key · battle-strikes CONTACT 자리 → realm-finish.py(20컷 합치기·ar/body·맞는 점)
#   → typecheck · battle-strikes 시험 → 그 세 파일만 커밋·푸시
# SPEC 기본 tools/sprite-kit/heroes/realm-women-1108.json
set -e
key=$1; note=$2
SPEC=${SPEC:-tools/sprite-kit/heroes/realm-women-1108.json}
hero=$(node -e "const h=require('./$SPEC').find(x=>x.key==='$key');if(!h)process.exit(1);console.log(h.heroId+' '+h.weapon)")
heroId=${hero% *}; weapon=${hero#* }
A=src/realm/data/art.ts; B=src/ui/realm/battle-strikes.ts
bow=''; [ "$weapon" = bow ] && bow=', bow: true'
# GEN_ANIM 끝(GEN_OWN 설명 주석 바로 위의 닫는 괄호) 앞에 자리줄
grep -q "^  $key: { ar: " $A || node -e "
const fs=require('fs');const s=fs.readFileSync('$A','utf8');const m='}\n/** 제 그림이 있는 장수';
const i=s.indexOf(m);if(i<0)process.exit(1);
fs.writeFileSync('$A',s.slice(0,i)+'  $key: { ar: 160 / 160, body: 0.900$bow },\n'+s.slice(i))"
grep -q "'$heroId': '$key'" $A || sed -i "s/^\(export const GEN_OWN[^{]*{.*\) }$/\1, '$heroId': '$key' }/" $A
grep -q "'gen-$key': \[" $B || sed -i "s/^\(  'gen-soseono': \[[^]]*\], \)/\1'gen-$key': [14, 0, 0], /" $B
grep -q "'$heroId': '$key'" $A && grep -q "'gen-$key': \[" $B && grep -q "^  $key: { ar: " $A || { echo "등록 실패"; exit 1; }
py -3 -X utf8 tools/sprite-kit/realm-finish.py "$key" "11-08 처음 · $note"
# 군사 띠처럼 짙은 1px 테두리 (형 11-09: 장수 그림이 흐림) — 다시 구우면 .done 에서 빼야 다시 두른다
sed -i "/^gen-$key.png$/d" assets_src/realm/retired/anim2-outline/.done 2>/dev/null
py -3 -X utf8 tools/defringe-green.py "public/realm/anim2/gen-$key.png" >/dev/null 2>&1 || true
py -3 -X utf8 tools/gen-outline.py "public/realm/anim2/gen-$key.png"
npm run typecheck >/dev/null 2>&1 || { echo "typecheck 실패"; exit 1; }
node --test --experimental-strip-types tests/realm/battle-strikes.test.ts 2>&1 | grep -q "^# fail 0" || { echo "시험 실패"; exit 1; }
git add public/realm/anim2/gen-$key.png $A $B
git commit -q -m "전투 띠 새로: $note (형 11-08)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TRiuNAG8xSjdmjCFpc8Rd5"
git push -q origin master 2>&1 | tail -1
git log --oneline -1 | cat
