#!/bin/sh
# FLIP=1 sh install-skillbody.sh … — 왼쪽을 보고 있으면 뒤집어 적진(오른쪽)을 보게
# install-skillbody.sh <초상 id> "<한 줄 설명>" — 칠십팔국 어댑터: ~/Downloads/gpt_skill-<id>.png 를 비기 전신 그림으로 넣는다
#   → assets_src/realm/skill-body/<id>-gpt.png (원본) · public/realm/skill-body/<id>.jpg (640×960)
#   → src/realm/data/skill-body.ts 의 SKILL_BODY 에 한 줄 → typecheck · 시험 → 커밋·푸시
set -e
id=$1; note=$2
f=~/Downloads/gpt_skill-$id.png
[ -s "$f" ] || { echo "받은 그림 없음 $f"; exit 1; }
mkdir -p assets_src/realm/skill-body public/realm/skill-body
mv "$f" assets_src/realm/skill-body/$id-gpt.png
py -3 -c "
from PIL import Image
im=Image.open('assets_src/realm/skill-body/$id-gpt.png').convert('RGB')
if '${FLIP:-}': im=im.transpose(Image.FLIP_LEFT_RIGHT)  # 적진(오른쪽)을 보게
im.resize((640,960),Image.LANCZOS).save('public/realm/skill-body/$id.jpg',quality=86)"
S=src/realm/data/skill-body.ts
grep -q "'$id'" $S || sed -i "s|^\])$|  '$id', // $note\n])|" $S
grep -q "'$id'" $S || { echo "등록 실패"; exit 1; }
npm run typecheck >/dev/null 2>&1 || { echo "typecheck 실패"; exit 1; }
node --test --experimental-strip-types tests/realm/skill-body.test.ts 2>&1 | grep -q "^# fail 0" || { echo "시험 실패"; exit 1; }
git add public/realm/skill-body/$id.jpg $S
git commit -q -m "비기 전신 그림: $note (형 11-08)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TRiuNAG8xSjdmjCFpc8Rd5"
git push -q origin master 2>&1 | tail -1
git log --oneline -1 | cat
