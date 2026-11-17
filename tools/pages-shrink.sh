#!/usr/bin/env bash
# GitHub Pages 판만 가볍게 (11-17 형: 「사이트판은 스토어 출시에 안 쓰이니 용량 줄여도 된다」)
# Pages 한도 1GB 를 넘어(2.5GB · 각성 영상 1.27GB) 배포가 Timeout 으로 깨졌다.
# 저장소·스팀(desktop/) 판의 원본은 그대로 두고, 빌드된 dist 안의 사본만 다시 굽는다.
#   - 각성 영상: 세로 960 이하 · H.264 crf 30 · 소리 64k
#   - 시험 찌꺼기(_tmp)·카톡 사진/영상은 빼기
# CI(ubuntu)에서만 돈다: .github/workflows/deploy.yml
set -euo pipefail
D=${1:-dist}
rm -rf "$D/_tmp" "$D"/KakaoTalk_* 2>/dev/null || true
before=$(du -sm "$D" | cut -f1)
shrink() {
  f=$1; t="${f%.mp4}.tmp.mp4"
  ffmpeg -nostdin -y -loglevel error -i "$f" -vf "scale=-2:'min(960,ih)'" -c:v libx264 -preset veryfast -crf 30 \
    -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 64k "$t"
  # 더 커지면 원본을 둔다
  if [ "$(stat -c%s "$t")" -lt "$(stat -c%s "$f")" ]; then mv "$t" "$f"; else rm -f "$t"; fi
}
export -f shrink
find "$D/realm/awaken-loop" "$D/realm/awaken2-loop" -name '*.mp4' -print0 2>/dev/null | xargs -0 -n1 -P4 bash -c 'shrink "$0"'
after=$(du -sm "$D" | cut -f1)
echo "pages-shrink: ${before}MB -> ${after}MB"
