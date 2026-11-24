# -*- coding: utf-8 -*-
"""각성 그림을 9:16 으로 미리 잘라 영상 입력으로 (11-24 형 「남자 각성 영상은 니가 알아서 해」).
Flow·제미나이는 정사각 그림의 **가운데**만 9:16 으로 잘라 써서, 무기 쥔 손이 가장자리에 있는 장수는 무기가 첫 장면 밖으로 나가고 모델이 무기를 지어냈다.
가운데 대신 **얼굴과 무기가 함께 드는 자리**로 잘라 넘긴다 — 사람 크기는 그대로(형 「세로로 더 가까이 · 골반까지」), 그림을 늘이거나 바탕을 덧대지 않는다.

  py -3 -X utf8 -I tools/veo/crop916.py <id> <포함할 x 처음> <포함할 x 끝> [face=<얼굴 가운데 x>] [out=tools/out/veo-in/<id>-916.png]
  x 는 원본 그림(public/realm/awaken-hd/<id>.jpg) 화소. 얼굴 x 는 tools/sprite-kit/hit-focus.json 의 awaken/<id> fx 로 자동으로 더한다.
  얼굴~무기 폭이 9:16 창(원본 높이 × 9/16)보다 넓으면 만들지 않고 「못 담음」을 찍는다(그 장수는 건너뛰거나 형 판정).
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main(argv):
    hid, x0, x1 = argv[0], int(argv[1]), int(argv[2])
    out = next((a[4:] for a in argv[3:] if a.startswith('out=')), f'{ROOT}/tools/out/veo-in/{hid}-916.png')
    im = Image.open(f'{ROOT}/public/realm/awaken-hd/{hid}.jpg').convert('RGB')
    W, H = im.size
    focus = json.load(open(f'{ROOT}/tools/sprite-kit/hit-focus.json', encoding='utf-8')).get(f'awaken/{hid}')
    fx = next((int(a[5:]) for a in argv[3:] if a.startswith('face=')), None)   # 얼굴 가운데 x 를 눈으로 잰 값(face=) — hit-focus 의 haar 값은 틀릴 때가 있다(파도 0.158 · 실제 0.5)
    if fx is None:
        fx = int(focus['fx'] * W) if focus else W // 2
    lo, hi = min(x0, fx - int(W * .07)), max(x1, fx + int(W * .07))   # 얼굴 둘레 여유
    win = round(H * 9 / 16)
    if hi - lo > win:
        print(f'못 담음: {hid} · 얼굴~무기 {lo}~{hi} ({hi - lo}px) > 9:16 창 {win}px')
        return 1
    left = max(0, min(W - win, (lo + hi) // 2 - win // 2))
    crop = im.crop((left, 0, left + win, H)).resize((720, 1280), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    crop.save(out)
    print(f'{hid}: 창 x {left}~{left + win} (가운데라면 {W // 2 - win // 2}~{W // 2 + win // 2}) · 얼굴 x {fx} · 무기 {x0}~{x1} → {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
