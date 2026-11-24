# -*- coding: utf-8 -*-
"""맞음·일어남 네 칸을 장수 띠에 붙이고 계획(params.ts)에 hurt·rise 를 더한다 — HEROES hit=True · strip install · 계획 줄 칸 수 (11-24)
  py -3 -X utf8 tools/sprite-kit/hit-install.py <장수 …>   (먼저 hit-jobs → gpt-image → regrid-api → bake motion → hit-scale)
"""
import importlib.util, io, os, re, shutil, subprocess, sys
from PIL import Image
R = 'D:/flutter/arrow_game_one/'
os.chdir(R)
names = sys.argv[1:]
H = R + 'tools/sprite-kit/anim-harness.py'
s = io.open(H, encoding='utf-8').read()
for n in names:
    a = f"    '{n}': dict("
    assert a in s, n
    if f"    '{n}': dict(hit=True," not in s:
        s = s.replace(a, a + 'hit=True, ', 1)
io.open(H, 'w', encoding='utf-8', newline='\n').write(s)
spec = importlib.util.spec_from_file_location('h', H); h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
P = R + 'src/tune/params.ts'
for n in names:
    strip = h.HEROES[n]['strip']
    for suf in ('', '-x'):
        f = f'public/realm/anim-px/{strip}{suf}.png'
        if os.path.exists(f):
            shutil.copyfile(f, f'tools/out/strip/old5-{strip}{suf}.png')
    r = subprocess.run([sys.executable, '-X', 'utf8', '-I', 'tools/sprite-kit/anim-harness.py', 'strip', n, 'install'], capture_output=True, text=True, encoding='utf-8', timeout=400)
    verdict = [l for l in r.stdout.splitlines() if '판정' in l]
    if '게임에 넣음' not in r.stdout:
        print(n, '넣지 못함', verdict, r.stderr[-200:]); continue
    x = Image.open(f'public/realm/anim-px/{strip}-x.png')
    cw = h.HEROES[n].get('actw', 240) if h.HEROES[n].get('act') else 208
    total = 20 + x.size[0] // cw
    key = strip[4:]
    ps = io.open(P, encoding='utf-8').read()
    m = re.search(r"^    (?:'%s'|%s): \{ cells: (\d+),(.*)$" % (re.escape(key), re.escape(key)), ps, re.M)
    assert m, key
    line = m.group(0)
    new = re.sub(r'cells: \d+,', f'cells: {total},', line, count=1)
    new = re.sub(r' hurt: \[[^\]]*\], rise: \[[^\]]*\],', '', new)
    add = f' hurt: [{total - 4}, {total - 3}], rise: [{total - 2}, {total - 1}],'
    new = new.replace(' xGeom:', add + ' xGeom:', 1) if ' xGeom:' in new else re.sub(r' \},$', ',' + add.rstrip(',') + ' },', new)
    ps = ps.replace(line, new, 1)
    io.open(P, 'w', encoding='utf-8', newline='\n').write(ps)
    print(n, verdict[-1] if verdict else '?', '칸', total)
