#!/bin/sh
# 각성 그림을 제미나이 동영상(Veo · 세로 9:16)에 넣을 판으로 — 정사각 그림을 720×1280 가운데에 통째로 두고 위아래는 같은 그림을 흐리게 채운다.
# (형 11-05: "넣은 이미지 전체가 안 나오고 핸드폰처럼 세로 길게 나오는 게 아쉽다" — 9:16 에 그냥 넣으면 양옆이 잘렸다)
# 받은 영상은 가운데 정사각(세로 22~78%)만 쓴다 — 오른쪽 아래 제미나이 표식(✦ · 세로 88~92%)은 흐린 띠에 떨어져 잘린다.
#   sh tools/veo/pad.sh <초상 id> [더 ...]   → assets_src/realm/awaken-loop/pad/<id>.png (dev 서버 5174 가 떠 있어야 한다)
#   진각성(2차) 그림이면 TIER=2 — awaken2-hd 에서 읽어 pad/<id>.t2.png 로
set -e
out=assets_src/realm/awaken-loop/pad
mkdir -p "$out"
tmp="${TMPDIR:-/tmp}/veo-pad.html"
for id in "$@"; do
  if [ "${TIER:-1}" = 2 ]; then src="/realm/awaken2-hd/$id.jpg"; name="$id.t2"; else src="/realm/awaken-hd/$id.jpg"; name="$id"; fi
  cat > "$tmp" <<HTML
<div style="position:fixed;inset:0;overflow:hidden;background:#0b0806">
  <div style="position:absolute;inset:-12%;background:url($src) center/cover;filter:blur(22px) brightness(.7)"></div>
  <img src="$src" style="position:absolute;left:0;top:50%;width:100%;aspect-ratio:1;transform:translateY(-50%);display:block" alt="">
</div>
HTML
  PRE="await new Promise(r=>setTimeout(r,600)); 'ok'" node --experimental-strip-types tools/phone-shot.ts "$out/$name.png" "$tmp" 360 640 >/dev/null
  echo "$out/$name.png"
done
