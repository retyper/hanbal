"""
숨 쉬는 영상 움직임 검사 (형 11-08: "영상 중간부터 얼어 버리거나 맨 끝부분에 갑자기 순간이동하듯 프레임이 과격하게 바뀌는 게 있다 ·
1~7초 사이에는 자연스럽고 다양한 움직임 · 마지막 3초에는 숨 크게 한 번 쉬면서 원래로 돌아오는 느낌").

  py -3 -X utf8 tools/veo/motion.py [영상 또는 폴더 …]   (기본: public/realm/awaken-loop public/realm/awaken2-loop)

프레임 사이 변화(작게 줄인 흑백의 평균 차)를 재서, 1~7초 가운데 구간과 견준다:
  얼어감  7.5초 뒤 움직임의 중간값 / 가운데의 중간값 < FADE   (끝에서 움직임이 죽는다 · 숨쉬기도 없이 멈춤)
  튐      마지막 2초의 가장 큰 한 프레임 변화 / 가운데의 95분위 > SNAP  (원본 자세로 순간이동)
  멈춤    가운데 움직임의 20% 밑이 STILL 초 넘게 이어짐
  바뀜    어디서든 한 프레임 변화가 앞뒤 다섯 프레임 중간값의 CUT 배 넘음 (한 프레임 만에 다른 사람·옷·자세로 · 형 11-09 버들: "절대 못 쓰는 영상") — 번개 번쩍임은 4배 남짓
불·이펙트·활쏘기처럼 빠른 동작은 「튐」으로 잡힐 수 있으니 눈으로 확인할 거리 — 영상은 귀하니 이 검사로 버리지 않는다 (메모리 veo-takes-precious).
"""
import sys
from pathlib import Path

import cv2
import numpy as np

FADE = 0.3
SNAP = 2.5
STILL = 1.0
CUT = 8.0
SIZE = (90, 160)


def frames(path: Path):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    out = []
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        out.append(cv2.cvtColor(cv2.resize(fr, SIZE, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32))
    return out, fps


def measure(path: Path) -> tuple[float, float, float, float]:
    fs, fps = frames(path)
    d = np.array([float(np.mean(np.abs(fs[i + 1] - fs[i]))) for i in range(len(fs) - 1)])
    t = np.arange(len(d)) / fps
    mid = d[(t >= 1) & (t < 7)]
    late = d[t >= 7.5]
    tail = d[t >= len(d) / fps - 2]
    fade = float(np.median(late) / max(1e-6, np.median(mid)))
    snap = float(tail.max() / max(1e-6, np.percentile(mid, 95)))
    thr = max(0.3, 0.2 * float(np.median(mid)))
    run = best = 0
    for v in d:
        run = run + 1 if v < thr else 0
        best = max(best, run)
    i = int(d.argmax())
    nb = float(np.median(np.r_[d[max(0, i - 5):i], d[i + 1:i + 6]]))
    cut = float(d[i] / max(1e-6, nb))
    return fade, snap, best / fps, cut


def main() -> None:
    args = sys.argv[1:] or ['public/realm/awaken-loop', 'public/realm/awaken2-loop']
    paths: list[Path] = []
    for a in args:
        p = Path(a)
        paths += sorted(p.glob('*.mp4')) if p.is_dir() else [p]
    print('영상 · 끝/가운데 움직임 · 끝 튐 · 가장 긴 멈춤(초) · 한 프레임 바뀜 · 판정')
    for p in paths:
        fade, snap, still, cut = measure(p)
        flags = [x for x, on in (('얼어감', fade < FADE), ('튐', snap > SNAP), ('멈춤', still >= STILL), ('바뀜', cut > CUT)) if on]
        print(f'{p.parent.name}/{p.name:42s} {fade:5.2f} {snap:5.2f} {still:4.1f} {cut:5.1f}  {" ".join(flags) or "좋음"}')


if __name__ == '__main__':
    main()
