# -*- coding: utf-8 -*-
"""맞음 판 배율 맞추기 — 넓게 선 넷째 칸 키가 서기의 0.89(형이 좋다 한 해적 두목 시범과 같은 몫)가 되게 bake-scene motion k= 로 다시 굽는다 (11-24).
  py -3 -X utf8 -I tools/sprite-kit/hit-scale.py <장수 …>   (먼저 bake-scene motion … hit 으로 한 번 구운 뒤)
"""
import importlib.util, numpy as np, subprocess, sys
from PIL import Image
spec=importlib.util.spec_from_file_location('h','tools/sprite-kit/anim-harness.py'); h=importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
S='D:/에셋창고/STD'
def ht(im):
    a=np.asarray(im)[...,3]>40; ys=np.nonzero(a.any(1))[0]; return ys.max()-ys.min()+1
for n in sys.argv[1:]:
    st=ht(Image.open(f'public/realm/anim-px/{h.HEROES[n]["strip"]}.png').convert('RGBA').crop((0,0,208,160)))
    c4=ht(Image.open(f'{S}/px/{n}-hit-4.png').convert('RGBA'))
    k=max(.85,min(1.3,.89*st/c4))
    r=subprocess.run([sys.executable,'-X','utf8','-I','tools/sprite-kit/bake-scene.py','motion',f'{S}/out-{n}-hit.png',n,'hit',f'{S}/scene-{n}-hit.png',f'k={k:.3f}'],capture_output=True,text=True,encoding='utf-8')
    c4b=ht(Image.open(f'{S}/px/{n}-hit-4.png').convert('RGBA'))
    print(f'{n} 서기 {st} 넓게선칸 {c4}→{c4b} k={k:.3f} 몫 {c4b/st:.3f}', '못찾음' if '못 찾' in r.stdout else '')
