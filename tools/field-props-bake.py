# -*- coding: utf-8 -*-
"""전장 소품 굽기 — tools/out/props/cut 의 낱개 그림을 게임 크기(병사 키 126화소 → 화면 32px 의 두 배로 저장)로 줄이고
자홍 번짐을 지워 public/realm/field-props/ 에 놓는다 · 크기표 manifest.json (w·h 는 배율 1 화면 px)
  py -3 -X utf8 -I tools/field-props-bake.py            (계절 판이 있으면 <이름>-<계절>.png 도 같이)"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = 'D:/flutter/arrow_game_one/'
CUT = ROOT + 'tools/out/props/cut/'
OUT = ROOT + 'public/realm/field-props/'
os.makedirs(OUT, exist_ok=True)
S = 32 / 126          # 그림 화소 → 배율 1 화면 px (병사 키)
KEEP = 2              # 저장은 두 배 (화면 배율·dpr 2 에서 흐리지 않게)
PROPS = {  # 이름: (파일, 크기 배)
  'pine-big': ('tp1-01', 1.0), 'pine': ('tp1-02', 1.0), 'pine-small': ('tp1-03', 1.0), 'oak': ('tp1-04', 0.9),
  'tree-dead': ('tp1-05', 1.0), 'tree-autumn': ('tp1-06', 1.0), 'stump': ('tp1-07', 1.0), 'log': ('tp1-08', 1.0),
  'rock-big': ('tp2-01', 0.9), 'rock': ('tp2-02', 0.9), 'rock-small': ('tp2-03', 0.9), 'rock-moss': ('tp2-04', 0.9),
  'cattail': ('tp2-05', 0.9), 'pebbles': ('tp2-06', 0.5), 'grass-dry': ('tp2-07', 0.5), 'grass-small': ('tp2-08', 0.5),
  'grass': ('tp2-09', 0.5), 'flowers': ('tp2-10', 0.5),
  'watchtower': ('tp3-04', 1.0), 'sotdae': ('tp3-05', 1.0),
  'stones-wet': ('tp4-01', 0.7), 'stones': ('tp4-02', 0.7), 'reeds-big': ('tp4-03', 0.7), 'reeds': ('tp4-04', 0.7),
  'step-1': ('tp4-05', 0.8), 'step-2': ('tp4-06', 0.8), 'step-3': ('tp4-07', 0.8), 'step-4': ('tp4-08', 0.8), 'step-5': ('tp4-09', 0.8),
  'flower': ('tp4-10', 0.7), 'iris': ('tp4-11', 0.7),
}
def clean(im, purple=False):
  """자홍 번짐 지우기 — purple 은 보랏빛 꽃(붓꽃·꽃무리)이라 진한 자홍만 지운다 · 나머지 소품은 자홍 기운이 조금만 있어도 바탕이 비친 틈"""
  a = np.asarray(im.convert('RGBA')).astype(np.int16)
  R, G, B, A = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
  mz = np.minimum(R, B) - G                 # 자홍 기운 (빨강·파랑이 둘 다 초록보다 큼)
  solid = A > 0
  edge = solid & ~ndimage.binary_erosion(solid, iterations=3)
  # 진한 자홍: 가장자리든 안쪽 틈(망루 기둥 사이처럼 바깥과 안 이어진 바탕)이든 지운다
  A = np.where(solid & ((mz > (35 if purple else 6)) | (edge & (mz > 20))), 0, A)
  # 옅은 자홍 번짐: 빨강은 그 몫만큼 내리고 파랑은 초록 아래로 (나무 갈색 쪽으로)
  tint = (A > 0) & (mz > 8)
  R = np.where(tint, np.maximum(R - mz, G), R)
  B = np.where(tint, G - 12, B)
  out = np.dstack([R, G, B, A]).clip(0, 255).astype('uint8')
  left = int(((np.minimum(out[..., 0], out[..., 2]).astype(int) - out[..., 1]) > 8)[out[..., 3] > 0].sum())
  return Image.fromarray(out), left
man = {}
for name, (f, k) in PROPS.items():
  im = Image.open(CUT + f + '.png').convert('RGBA')
  im, left = clean(im, name in ("iris", "flowers", "flower"))
  w, h = max(1, round(im.size[0] * S * k)), max(1, round(im.size[1] * S * k))
  im.resize((w * KEEP, h * KEEP), Image.LANCZOS).save(OUT + name + '.png', optimize=True)
  man[name] = {'w': w, 'h': h}
  print(f'{name:12s} {f}  화면 {w}x{h}px  자홍 남음 {left}')
json.dump(man, open(OUT + 'manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('manifest', len(man))
