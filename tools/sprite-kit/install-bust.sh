#!/bin/sh
# install-bust.sh <새 초상 id> <나이> <장수 키> "<커밋 설명>" — 칠십팔국 어댑터: 받은 초상 한 장을 게임에 넣는다
#   원본: assets_src/realm/bust/<id>-gpt.png (챗지피티에서 받은 1254 정사각)
#   → public/realm/bust-hd/<id>.jpg (900) · public/realm/bust/<id>.jpg (320)
#   → ages.ts FACE_AGE 에 나이 · art.ts 의 '<장수 키>': '<옛 id>' 를 새 id 로
#   → typecheck · npm test → 그 파일들만 커밋·푸시
set -e
id=$1; age=$2; key=$3; msg=$4
src=assets_src/realm/bust/$id-gpt.png
[ -s "$src" ] || { echo "원본 없음 $src"; exit 1; }
py -3 -c "
from PIL import Image
im=Image.open('$src').convert('RGB')
im.resize((900,900),Image.LANCZOS).save('public/realm/bust-hd/$id.jpg',quality=88)
im.resize((320,320),Image.LANCZOS).save('public/realm/bust/$id.jpg',quality=85)"
A=src/realm/data/ages.ts; R=src/realm/data/art.ts
grep -q "'$id': { age" $A || node -e "
const fs=require('fs');let s=fs.readFileSync('$A','utf8');const a=s.indexOf('export const FACE_AGE');const e=s.indexOf('\n}',a);
s=s.slice(0,e)+\"\n  '$id': { age: $age, grey: false },\"+s.slice(e);fs.writeFileSync('$A',s)"
grep -q "'$key': '" $R || { echo "art.ts 에 '$key' 없음"; exit 1; }
sed -i "s/'$key': '[^']*'/'$key': '$id'/" $R
grep -q "'$key': '$id'" $R || { echo "연결 실패"; exit 1; }
npm run typecheck >/dev/null 2>&1 || { echo "typecheck 실패"; exit 1; }
npm test 2>&1 | grep -q "^# fail 0" || npm test 2>&1 | grep -q "^# fail 0" || { echo "시험 실패 (두 번)"; exit 1; }  # 가끔 한 번 흔들린다
git add public/realm/bust-hd/$id.jpg public/realm/bust/$id.jpg $A $R
git commit -q -m "$msg (형 11-08)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TRiuNAG8xSjdmjCFpc8Rd5"
git push -q origin master 2>&1 | tail -1
git log --oneline -1 | cat
