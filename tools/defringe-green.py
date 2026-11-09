"""
전투 그림의 초록 테 지우기 (형 11-09: "전투 에셋들은 테두리 여전히 초록색 크로마키 남아있으니 그 색들은 그냥 검은색으로 전부 바뀌게 파이썬 프로그램 하나 만들어서 전수 고쳐야겠음").

제미나이 그림은 초록 바탕에서 오려 내서 가장자리에 초록이 번져 남는다. 그 테만 검게 바꾼다 —
가장자리(투명한 곳에서 BAND 칸 안)의 초록빛 픽셀만 고른다. 안쪽의 초록 옷·띠는 건드리지 않는다.

  py -3 -X utf8 tools/defringe-green.py                  public/realm/anim2/*.png 전부 (원본은 assets_src/realm/retired/anim2-greenfringe 에 둔다)
  py -3 -X utf8 tools/defringe-green.py <png …> [--dry]   고를 파일만 · --dry 는 세기만
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

BAND = 3          # 투명한 곳에서 이 칸 안이 가장자리
ALPHA_CLEAR = 40  # 이 밑이면 투명으로 본다
CHROMA = 1.32     # 초록 번짐: g 가 r·b 중 큰 것의 이 배수를 넘는 진한 초록 (옥빛 창끝·연두 옷처럼 밝고 연한 초록은 1.2 밑이라 남는다)
SOFT_CHROMA = 1.15  # 반투명한 픽셀은 이것만 넘어도 번짐
DARK = (10, 8, 6)  # 바꿀 색 (검정에 가깝게 · 그림의 먹선과 어울리게)
BACKUP = Path('assets_src/realm/retired/anim2-greenfringe')


def edge_band(alpha: np.ndarray, band: int) -> np.ndarray:
    clear = alpha < ALPHA_CLEAR
    near = clear.copy()
    for _ in range(band):
        n = near.copy()
        n[1:, :] |= near[:-1, :]
        n[:-1, :] |= near[1:, :]
        n[:, 1:] |= near[:, :-1]
        n[:, :-1] |= near[:, 1:]
        near = n
    return near & ~clear


def defringe(path: Path, dry: bool) -> int:
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    band = edge_band(al, BAND)
    mx = np.maximum(np.maximum(r, b), 1)
    greenish = g > mx * CHROMA
    # 반투명한 픽셀은 가장자리 밖이어도 초록이면 번진 것
    soft = (al >= ALPHA_CLEAR) & (al < 230) & (g > mx * SOFT_CHROMA)
    m = (band & greenish) | soft
    n = int(m.sum())
    if n and not dry:
        BACKUP.mkdir(parents=True, exist_ok=True)
        bk = BACKUP / path.name
        if not bk.exists():
            im.save(bk)
        for i, v in enumerate(DARK):
            a[..., i] = np.where(m, v, a[..., i])
        Image.fromarray(a.astype(np.uint8)).save(path)
    return n


def main() -> None:
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    dry = '--dry' in sys.argv
    files = [Path(x) for x in args] if args else sorted(Path('public/realm/anim2').glob('*.png'))
    total = 0
    for f in files:
        n = defringe(f, dry)
        total += n
        if n:
            print(f'{f.name:32s} {n:7d}')
    print(f'합계 {total} 픽셀 · {len(files)} 파일' + (' (세기만)' if dry else ''))


if __name__ == '__main__':
    main()
