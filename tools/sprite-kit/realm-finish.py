"""realm-finish.py <name> — G/<name>-walk-strip.png + G/<name>-act-strip.png -> public/realm/anim2/gen-<name>.png
and rewrites the GEN_ANIM entry for <name> in src/realm/data/art.ts (keeps bow flag, replaces ar/body and the comment)."""
import re, subprocess, sys
import numpy as np
from PIL import Image
name = sys.argv[1]
note = sys.argv[2] if len(sys.argv) > 2 else ''
G = 'assets_src/realm/gemini/generals2/'
S = 'tools/sprite-kit/'
out = f'public/realm/anim2/gen-{name}.png'
amapA = sys.argv[3] if len(sys.argv) > 3 else ''
subprocess.run([sys.executable, S + 'compose20.py', G + f'{name}-walk-strip.png', G + f'{name}-act-strip.png', out, amapA], check=True)
im = Image.open(out)
cw = im.width // 20
a = np.array(im.crop((0, 0, cw, 160)))[..., 3]
ys = np.where(a.max(axis=1) > 40)[0]
body = (ys.max() - ys.min() + 1) / 160
p = 'src/realm/data/art.ts'
s = open(p, encoding='utf-8').read()
m = re.search(rf"^  {name}: \{{ ar: [^}}]*\}},?[^\n]*$", s, re.M)
if m is None:
    raise SystemExit('no entry for ' + name)
bow = (', bow: true' if 'bow: true' in m.group(0) else '') + (', mount: true' if 'mount: true' in m.group(0) else '')
line = f"  {name}: {{ ar: {cw} / 160, body: {body:.3f}{bow} }}, // 11-08 초상대로 다시 (형: 「투구 쓰고 원본과 다르다」 · 제미나이 걷기 4×2 + 동작 4×2 → 20컷 · assets_src/realm/gemini/generals2){(' · ' + note) if note else ''}"
s = s[:m.start()] + line + s[m.end():]
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print(name, 'cell', cw, 'body', round(body, 3), 'bow' if bow else '')

# contact point: weapon tip in the swing frame (14) = rightmost opaque pixel
f = 14  # swing frame
c = np.array(im.crop((f * cw, 0, (f + 1) * cw, 160)))[..., 3] > 60
xs = np.where(c.any(axis=0))[0]
xr = xs.max()
yr = int(np.where(c[:, xr])[0].mean())
bp = 'src/ui/realm/battle-strikes.ts'
b = open(bp, encoding='utf-8').read()
key = f"'gen-{name}': ["
i = b.find(key)
if i >= 0:
    j = b.find(']', i)
    b = b[:i] + f"'gen-{name}': [{f}, {xr / cw:.2f}, {yr / 160:.2f}" + b[j:]
    open(bp, 'w', encoding='utf-8', newline='\n').write(b)
    print('contact', f, round(xr / cw, 2), round(yr / 160, 2))
else:
    print('no contact entry for', name)
