"""splice-act.py <strip name> <새 동작 8컷 띠> [amap] — 이미 있는 20컷 띠(public/realm/anim2/<name>.png)의 걷기(4~11)는 두고
서기(0~3)·공격(12~17)·맞음(18)·쓰러짐(19)만 새 동작 띠로 갈아 끼운다 (11-11 칸 끝에 잘린 칸 다시 굽기).
새 동작 띠에는 defringe-green + gen-outline 을 먼저 걸고, 옛 띠는 assets_src/realm/retired/anim2/<name>@20261111.png 에 남긴다.
  예: py -3 -X utf8 tools/sprite-kit/splice-act.py gen-g-spear tools/out/redo/gspear-act-strip.png"""
import importlib.util, shutil, subprocess, sys, tempfile, os
from pathlib import Path
from PIL import Image

name, act = sys.argv[1], sys.argv[2]
amap = sys.argv[3] if len(sys.argv) > 3 else ''
cur = Path(f'public/realm/anim2/{name}.png')
keep = Path(f'assets_src/realm/retired/anim2/{name}@20261111.png')
keep.parent.mkdir(parents=True, exist_ok=True)
if not keep.exists():
    shutil.copy2(cur, keep)

def load(p, n):
    s = importlib.util.spec_from_file_location(n, p); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

tmp = Path(tempfile.mkdtemp())
a2 = tmp / 'act.png'
shutil.copy2(act, a2)
d = load('tools/defringe-green.py', 'dg'); d.BACKUP = tmp / 'bk'; d.defringe(a2, False)
o = load('tools/gen-outline.py', 'go'); o.outline(Image.open(a2)).save(a2)
old = Image.open(keep).convert('RGBA'); cw = old.width // 20
walk = Image.new('RGBA', (cw * 8, 160))
for i in range(8):
    walk.alpha_composite(old.crop(((4 + i) * cw, 0, (5 + i) * cw, 160)), (i * cw, 0))
w = tmp / 'walk.png'; walk.save(w)
out = tmp / 'out.png'
subprocess.run([sys.executable, 'tools/sprite-kit/compose20.py', str(w), str(a2), str(out), amap], check=True)
shutil.copy2(out, cur)
print('spliced', name, Image.open(cur).size)
