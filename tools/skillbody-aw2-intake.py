"""진각성 비기 전신(D:/에셋창고/skillbody_aw2_<id>.png) 검수판 · 넣기.

  py -3 -I tools/skillbody-aw2-intake.py sheet     → tools/out/skillbody-aw2-intake/sheet-NN.jpg (진각성 초상 | 받은 전신 · 자동 표시)
  py -3 -I tools/skillbody-aw2-intake.py install   → 반려 목록(tools/out/skillbody-aw2-intake/rejects.json) 밖의 것을
                                                     public/realm/skill-body/aw2/<id>.jpg (800×1200) 로 · src/realm/data/skill-body-aw2.ts 목록 갱신
에셋창고는 읽기만 한다 (옮기기·지우기 금지).
"""
import glob, json, os, re, sys
from PIL import Image, ImageDraw
import numpy as np

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = 'D:/에셋창고'
OUT = os.path.join(root, 'tools/out/skillbody-aw2-intake')
os.makedirs(OUT, exist_ok=True)
files = sorted(glob.glob(os.path.join(SRC, 'skillbody_aw2_*.png')))
ids = [os.path.basename(f)[len('skillbody_aw2_'):-4] for f in files]


def flags(im):
    """자동 표시 — 판 색에서 벗어난 몸의 테두리가 그림 끝에 닿는가(잘린 몸) · 몸이 너무 작은가"""
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    plate = np.median(np.concatenate([a[:8, :, :].reshape(-1, 3), a[-8:, :, :].reshape(-1, 3)]), axis=0)
    d = np.abs(a - plate).sum(axis=2) > 40
    ys, xs = np.nonzero(d)
    h, w = d.shape
    out = []
    if len(ys) == 0:
        return ['empty'], None
    t, b, l, r = ys.min(), ys.max(), xs.min(), xs.max()
    if t < 4: out.append('top')
    if b > h - 5: out.append('bottom')
    if l < 4: out.append('left')
    if r > w - 5: out.append('right')
    if (b - t) < h * 0.55: out.append('small')
    return out, (int(l), int(t), int(r), int(b))


def sheet():
    per = 30
    report = {}
    for s in range(0, len(ids), per):
        chunk = list(zip(ids[s:s + per], files[s:s + per]))
        cols = 6
        cw, ch = 300, 330
        rows = (len(chunk) + cols - 1) // cols
        sh = Image.new('RGB', (cols * cw, rows * ch), (40, 40, 40))
        dr = ImageDraw.Draw(sh)
        for i, (id_, f) in enumerate(chunk):
            x, y = (i % cols) * cw, (i // cols) * ch
            im = Image.open(f)
            fl, box = flags(im)
            report[id_] = {'flags': fl, 'bbox': box, 'size': im.size}
            ref = Image.open(os.path.join(root, f'public/realm/awaken2-hd/{id_}.jpg')).convert('RGB').resize((110, 110))
            sh.paste(ref, (x + 2, y + 2))
            sh.paste(im.convert('RGB').resize((186, 279)), (x + 112, y + 2))
            dr.text((x + 2, y + 284), f'{s + i}:{id_}', fill=(255, 255, 255))
            if fl: dr.text((x + 2, y + 298), ' '.join(fl), fill=(255, 90, 90))
        sh.save(os.path.join(OUT, f'sheet-{s // per:02d}.jpg'), quality=82)
    json.dump(report, open(os.path.join(OUT, 'auto-flags.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('sheets', (len(ids) + per - 1) // per, 'flagged', sum(1 for v in report.values() if v['flags']))


def install():
    rej = json.load(open(os.path.join(OUT, 'rejects.json'), encoding='utf-8'))
    dst = os.path.join(root, 'public/realm/skill-body/aw2')
    os.makedirs(dst, exist_ok=True)
    ok = []
    for id_, f in zip(ids, files):
        if id_ in rej: continue
        im = Image.open(f).convert('RGB').resize((800, 1200), Image.Resampling.LANCZOS)
        p = os.path.join(dst, f'{id_}.jpg')
        im.save(p, quality=86, optimize=True)
        if os.path.getsize(p) < 10000: raise SystemExit(f'too small {p}')
        ok.append(id_)
    p = os.path.join(root, 'src/realm/data/skill-body-aw2.ts')
    src = open(p, encoding='utf-8').read()
    m = re.search(r"new Set<string>\(\[\n(.*?)\]\)", src, re.S)
    body = ''.join(f"  '{i}',\n" for i in ok)
    open(p, 'w', encoding='utf-8', newline='\n').write(src[:m.start(1)] + body + src[m.end(1):])
    print('installed', len(ok), 'rejected', len(rej))


{'sheet': sheet, 'install': install}[sys.argv[1] if len(sys.argv) > 1 else 'sheet']()
