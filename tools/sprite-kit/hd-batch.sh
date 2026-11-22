#!/usr/bin/env bash
# Codex 확대 보충 판(hdx) 묶음 넣기 (11-22 · 명령 78)
#   bash tools/sprite-kit/hd-batch.sh            → 아직 안 넣은 hdx 를 미리 굽고 확인 시트(D:/에셋창고/codex78/check/batch-*.jpg)
#   bash tools/sprite-kit/hd-batch.sh --write k… → 눈으로 본 것만 써 넣고 시험(실패면 멈춤 · 커밋은 손으로)
set -euo pipefail
SRC=${HDX_DIR:-/d/에셋창고/codex78}; CHK=$SRC/check; mkdir -p "$CHK"
if [ "${1:-}" = "--write" ]; then
  shift; py -3 -I tools/sprite-kit/bake-hero-hd2.py --write "$@" | LC_ALL=C sed 's/[^ -~]/?/g' | cut -c1-60
  npm run typecheck >/dev/null; npx tsx --test tests/raid-hd.test.ts 2>&1 | grep -E "^# (pass|fail)" | tee /dev/stderr | grep -q "^# fail 0" || { echo "시험 실패 · 커밋하지 말 것"; exit 1; }
  echo "써 넣음 $# · 시험 통과"; exit 0
fi
todo=$(for f in "$SRC"/hdx_*.png; do k=$(basename "$f" .png); k=${k#hdx_}; [ -e public/realm/anim-px/gen-${k}_hd.png ] || echo "$k"; done)
[ -n "$todo" ] || { echo "새 것 없음"; exit 0; }
py -3 -I tools/sprite-kit/bake-hero-hd2.py $todo 2>&1 | LC_ALL=C sed 's/[^ -~]/?/g' | grep -E "\?\?\?\?\?\? \?\? |skip|Error" || true
py -3 -I - "$CHK" $todo <<'PY'
import sys, os
from PIL import Image
chk, keys = sys.argv[1], sys.argv[2:]
ok = [k for k in keys if os.path.exists(f'D:/에셋창고/codex75/check/hd-{k}.jpg')]
print('미리보기', len(ok), '/', len(keys), '· 못 구움:', ' '.join(k for k in keys if k not in ok) or '없음')
ims = [Image.open(f'D:/에셋창고/codex75/check/hd-{k}.jpg') for k in ok]
ims = [i.resize((1500, int(i.size[1] * 1500 / i.size[0]))) for i in ims]
for n in range(0, len(ims), 6):
    part = ims[n:n + 6]; H = sum(i.size[1] + 6 for i in part); out = Image.new('RGB', (1500, H), (20, 20, 20)); y = 0
    for i in part: out.paste(i, (0, y)); y += i.size[1] + 6
    p = f'{chk}/batch-{n // 6}.jpg'; out.save(p, quality=82); print(p, ' '.join(ok[n:n + 6]))
PY
