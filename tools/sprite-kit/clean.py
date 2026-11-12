"""clean.py <sheet.png> <out-key.png> — 제미나이 초록 시트: 작은 판(캔버스 1024×572)은 1376×768 로 키우고, 초록을 빼고, 우하단 별(워터마크)을 지운다.
11-12: 우하단 칸이 자홍 네모(act5 · 워터마크 자리)면 그 칸 전체를 바탕 초록으로 덮은 뒤 키를 뺀다
       (key-png 는 네 귀 평균으로 바탕을 재서, 자홍 귀가 섞이면 바탕을 잘못 잰다) · 별 지울 자리는 그림 크기에 비례(큰 원본도 안전)."""
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
if im.size[0] < 1300 and abs(im.size[0] / im.size[1] - 16 / 9) < 0.05:  # 캔버스로 받은 16:9 작은 판
    im = im.resize((1376, 768), Image.LANCZOS)
    im.save(src)
a = np.array(im)
H, W = a.shape[:2]
mag = lambda y0, y1, x0, x1: (lambda m: m[0] > 180 and m[2] > 180 and m[1] < 110)(a[int(H * y0):int(H * y1), int(W * x0):int(W * x1)].reshape(-1, 3).mean(axis=0))
quad = mag(0.56, 0.62, 0.56, 0.62)  # 2×2 의 4번 칸 왼쪽 위 귀퉁이까지 자홍이면 2×2 (3×2·3×3 은 여기가 가운데 칸)
br = a[int(H * 0.7):int(H * 0.8), int(W * 0.8):int(W * 0.9)].reshape(-1, 3).mean(axis=0)  # 우하단 칸 한가운데
if br[0] > 180 and br[2] > 180 and br[1] < 110:  # 우하단이 자홍 → 3×2 의 6번 칸을 바탕으로
    bg = a[5, 5].copy()
    if quad:
        a[H // 2:, W // 2:] = bg   # 2×2(11-12 소서노 시험) 의 4번 칸
    else:
        y0 = (H * 2) // 3 if abs(W / H - 1) < 0.15 else H // 2   # 3×3(1:1) 은 9번 칸 · 3×2(16:9) 는 6번 칸
        a[y0:, (W * 2) // 3:] = bg
    Image.fromarray(a).save(src.replace('.png', '-prep.png'))
    keysrc = src.replace('.png', '-prep.png')
    magenta = True
else:
    # 키 빼기 전에 우하단 귀의 제미나이 ✦ (초록 위의 반투명 흰빛 = 초록이 세고 빨강·파랑도 조금 있는 픽셀) 를 바탕으로 덮는다 (11-12 단비: 별이 발치에 붙어 남았다)
    bg = a[5, 5].astype(int)
    y0, x0 = int(H * 0.72), int(W * 0.78)
    sub = a[y0:, x0:].astype(int)
    r_, g_, b_ = sub[..., 0], sub[..., 1], sub[..., 2]
    star = (g_ > 150) & (r_ > bg[0] + 35) & (b_ > bg[2] + 35) & (g_ > r_ + 30) & (g_ > b_ + 30)
    if star.any():
        sub[star] = bg
        a[y0:, x0:] = sub.astype(a.dtype)
        Image.fromarray(a).save(src.replace('.png', '-prep.png'))
        keysrc = src.replace('.png', '-prep.png')
    else:
        keysrc = src
    magenta = False
subprocess.run(['node', 'tools/key-png.mjs', keysrc, out], check=True, capture_output=True)
a = np.array(Image.open(out).convert('RGBA'))
if not magenta:
    x0, x1, y0, y1 = int(W * 0.865), int(W * 0.967), int(H * 0.768), int(H * 0.9375)  # 1376×768 에서 1190~1330 · 590~720
    sub = a[y0:y1, x0:x1].astype(int)
    r, g, b, al = sub[..., 0], sub[..., 1], sub[..., 2], sub[..., 3]
    a[y0:y1, x0:x1, 3][(al > 0) & (g > r + 15) & (g > b + 15)] = 0
    sub = a[y0:y1, x0:x1].astype(int)
    r, g, b, al = sub[..., 0], sub[..., 1], sub[..., 2], sub[..., 3]
    mn, mx = np.minimum(np.minimum(r, g), b), np.maximum(np.maximum(r, g), b)
    light = ((al > 0) & (mn > 175) & ((mx - mn) < 30)).astype('uint8')
    light = cv2.dilate(light, np.ones((3, 3), np.uint8), 1)
    mask = np.zeros(a.shape[:2], np.uint8)
    mask[y0:y1, x0:x1] = light * 255
    rgb = cv2.inpaint(np.ascontiguousarray(a[..., :3]), mask, 5, cv2.INPAINT_TELEA)
    a = np.dstack([rgb, a[..., 3]])
Image.fromarray(a.astype(np.uint8)).save(out)
print('key', out, f'{W}x{H}', '자홍 칸 덮음' if magenta else '별 지움')
