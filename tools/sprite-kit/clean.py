"""clean.py <sheet.png> <out-key.png> — 제미나이 초록 시트를 1376×768 로 맞추고 초록을 빼고 우하단 별(워터마크 자리)을 지운다."""
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
if im.size[0] < 1300:  # 캔버스로 받은 1024×572 판
    im = im.resize((1376, 768), Image.LANCZOS)
    im.save(src)
subprocess.run(['node', 'tools/key-png.mjs', src, out], check=True, capture_output=True)
a = np.array(Image.open(out).convert('RGBA'))
x0, x1, y0, y1 = 1190, 1330, 590, 720
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
Image.fromarray(np.dstack([rgb, a[..., 3]]), 'RGBA').save(out)
