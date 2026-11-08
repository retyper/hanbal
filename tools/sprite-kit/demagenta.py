"""demagenta.py <png> — 자홍 바탕을 뺀 뒤 남은 자홍빛 그림자·테두리를 회색 그림자로 바꾼다 (게임과 무관)"""
import sys

import numpy as np
from PIL import Image

p = sys.argv[1]
a = np.array(Image.open(p).convert('RGBA')).astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
m = (al > 0) & (r > g + 35) & (b > g + 35)
lum = (0.3 * r + 0.59 * g + 0.11 * b)
a[..., 0][m] = (lum[m] * 0.35).astype(int)
a[..., 1][m] = (lum[m] * 0.35).astype(int)
a[..., 2][m] = (lum[m] * 0.4).astype(int)
a[..., 3][m] = (al[m] * 0.55).astype(int)
Image.fromarray(a.astype('uint8'), 'RGBA').save(p)
print('magenta px', int(m.sum()))
