#!/bin/sh
# install-awaken.sh <1|2> <초상 id> "<한 줄 설명>" — 칠십팔국 어댑터: 챗지피티 각성 그림을 넣는다
#   ~/Downloads/gpt_aw<단>-<초상 id>.png
#   1차 → assets_src/realm/awaken/<id>.png · public/realm/awaken-hd/<id>.jpg (900) · public/realm/awaken/<id>.jpg (320) · awaken-art.ts AWAKEN_ART 에 한 줄
#   2차 → assets_src/realm/awaken2/<id>.png · public/realm/awaken2-hd · awaken2 · awaken2.ts TRUE_WAKE 에 그 초상을 쓰는 장수 id 모두
#   → typecheck · npm test → 그 파일들만 커밋·푸시 (npm test 는 한 번 흔들리면 다시)
set -e
t=$1; id=$2; note=$3
f=${BAKE_DL:-$HOME/Downloads}/gpt_aw$t-$id.png
[ -s "$f" ] || { echo "받은 그림 없음 $f"; exit 1; }
if [ "$t" = 1 ]; then src=awaken; hd=awaken-hd; sm=awaken; else src=awaken2; hd=awaken2-hd; sm=awaken2; fi
mkdir -p assets_src/realm/$src public/realm/$hd public/realm/$sm
mv "$f" assets_src/realm/$src/$id.png
py -3 -c "
from PIL import Image
im=Image.open('assets_src/realm/$src/$id.png').convert('RGB')
im.resize((900,900),Image.LANCZOS).save('public/realm/$hd/$id.jpg',quality=88)
im.resize((320,320),Image.LANCZOS).save('public/realm/$sm/$id.jpg',quality=88)"
if [ "$t" = 1 ]; then
  R=src/realm/data/awaken-art.ts
  grep -q "^  '$id',\$\|^  '$id', //" $R || node -e "
const fs=require('fs');let s=fs.readFileSync('$R','utf8');const a=s.indexOf('export const AWAKEN_ART');const e=s.indexOf('\n])',a);
s=s.slice(0,e)+\"\n  '$id', // 11-08 $note\"+s.slice(e);fs.writeFileSync('$R',s)"
else
  R=src/realm/data/awaken2.ts
  node --experimental-strip-types -e "
const a=await import('./src/realm/data/art.ts');const fs=await import('node:fs');
const ids=Object.entries(a.HERO_BUST).filter(([,b])=>b==='$id').map(([h])=>h);
if(!ids.length){console.error('그 초상을 쓰는 장수 없음');process.exit(1)}
let s=fs.readFileSync('$R','utf8');const st=s.indexOf('export const TRUE_WAKE');const e=s.indexOf('\n])',st);
const body=s.slice(st,e);const add=ids.filter(h=>!body.includes(\"'\"+h+\"'\"));
if(add.length){s=s.slice(0,e)+'\n  '+add.map(h=>\"'\"+h+\"'\").join(', ')+', // 11-08 $note'+s.slice(e);fs.writeFileSync('$R',s)}
console.log('TRUE_WAKE +',add.join(' '))"
fi
# BATCH=1 이면 여기까지만 (tools/bake-intake.sh 가 모아서 한 번에 시험·커밋)
[ "${BATCH:-}" = 1 ] && { echo "넣음 $id"; exit 0; }
npm run typecheck >/dev/null 2>&1 || { echo "typecheck 실패"; exit 1; }
npm test 2>&1 | grep -q "^# fail 0" || npm test 2>&1 | grep -q "^# fail 0" || { echo "시험 실패 (두 번)"; exit 1; }
git add public/realm/$hd/$id.jpg public/realm/$sm/$id.jpg $R
git commit -q -m "$([ "$t" = 1 ] && echo 각성 || echo 진각성) 초상: $note (형 11-08)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TRiuNAG8xSjdmjCFpc8Rd5"
git push -q origin master 2>&1 | tail -1
git log --oneline -1 | cat
