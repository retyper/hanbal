# -*- coding: utf-8 -*-
"""각성 띠(SPA) 동작 판 참조: 비각성 띠 gen-<who>.png(20칸 한 줄)를 픽셀 그대로 4열×5행으로 다시 늘어놓는다 (11-19 Codex 제안 채택).
문안은 IMAGE 1 을 4×5 라 하는데 실제 참조가 20×1 한 줄이라, 그림이 「재배열 + 옷 갈아입히기」를 한 번에 하다 자세 차례·다리 위상이 틀렸다.
→ assets_src/realm/sprite-prop/actref-<who>.png (칸 크기·순서·픽셀 그대로 · 크기 바꿈 없음)
  py -3 -I tools/sprite-kit/aw1-actref.py [who ...]   (없으면 walkref.json 의 장수 전부)
"""
import json, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
PX, OUT = ROOT / 'public/realm/anim-px', ROOT / 'assets_src/realm/sprite-prop'
whos = sys.argv[1:] or list(json.loads((ROOT / 'tools/sprite-kit/walkref.json').read_text(encoding='utf-8')).keys())
n = 0
for who in whos:
    src = PX / f'gen-{who}.png'
    if not src.exists(): continue
    im = Image.open(src); w, h = im.size
    if w % 20: print('skip (20칸 아님)', who, w); continue
    cw = w // 20; out = Image.new(im.mode, (cw * 4, h * 5), (0, 0, 0, 0) if 'A' in im.mode else 0)
    for i in range(20): out.paste(im.crop((i * cw, 0, (i + 1) * cw, h)), ((i % 4) * cw, (i // 4) * h))
    out.save(OUT / f'actref-{who}.png'); n += 1
print('actref', n)
