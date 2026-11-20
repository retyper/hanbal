"""50-0: preserve native masters, re-extract victory matte, crop/encode runtime FX.

Run with Pillow + numpy: py tools/raid-fx-assets.py [--check]
Only stamp_victory's alpha is changed; its RGB brushwork is not recolored.
"""
from pathlib import Path
import hashlib
import json
import sys
import shutil
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'assets_src/realm/raid/fx-codex49-native'
DEST = ROOT / 'public/realm/raid/fx'
MANIFEST = ROOT / 'docs/realm/production/CODEX50-FX-MANIFEST.json'
PREV = json.loads((ROOT / 'docs/realm/production/CODEX49-FX-MANIFEST.json').read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def collar_mask(im):
    p = np.asarray(im).astype(float)
    r, g, b, a = np.moveaxis(p, -1, 0)
    edge = np.asarray(im.getchannel('A').filter(ImageFilter.MinFilter(7))) < 128
    return (a >= 128) & edge & (r > 1.8 * g) & (r > 2 * b)


def check():
    report = json.loads(MANIFEST.read_text(encoding='utf-8'))
    assert report['runtimeBytes'] < 1_500_000, report['runtimeBytes']
    assert len(report['items']) == 10
    for row in report['items']:
        original, output = ROOT / row['source'], ROOT / row['path']
        assert sha(original) == row['sourceSha256']
        assert sha(output) == row['sha256']
        im = Image.open(output).convert('RGBA')
        assert list(im.size) == row['size']
        a = np.asarray(im.getchannel('A'))
        assert np.any(a == 0) and np.any(a >= 128), row['name']
    victory = next(r for r in report['items'] if r['name'] == 'stamp_victory')
    im = Image.open(ROOT / victory['source']).convert('RGBA')
    runtime = Image.open(ROOT / victory['path']).convert('RGBA')
    assert runtime.size == tuple(victory['cropSize']), 'victory matte regression compares native coordinates'
    full = Image.new('RGBA', im.size)
    full.paste(runtime, tuple(victory['crop'][:2]))
    count = int(np.count_nonzero(collar_mask(im) & (np.asarray(full.getchannel('A')) >= 128)))
    assert count == 0, f'original red matte collar remains: {count}'
    print(json.dumps({'checked': 10, 'runtimeBytes': report['runtimeBytes'], 'originalRedCollarRemaining': count}))


if '--check' in sys.argv:
    check()
    sys.exit()

SOURCES.mkdir(parents=True, exist_ok=True)
rows = []
for native in PREV['items']:
    name = Path(native['name']).stem
    master = SOURCES / native['name']
    if not master.exists():
        assert sha(DEST / native['name']) == native['sha256']
        shutil.copyfile(DEST / native['name'], master)
    assert sha(master) == native['sha256']
    im = Image.open(master).convert('RGBA')
    original_size = im.size
    red_before = int(np.count_nonzero(collar_mask(im))) if name == 'stamp_victory' else None
    if name == 'stamp_victory':
        # A three-native-pixel matte choke removes the colored keying collar.
        # A small feather retains antialiasing without painting over gold texture.
        im.putalpha(im.getchannel('A').filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(.35)))
    bbox = im.getchannel('A').getbbox()
    assert bbox
    im = im.crop(bbox)
    crop_size = im.size
    if name.startswith('fx_') and name != 'fx_victory_rays':
        im.thumbnail((128, 128), Image.Resampling.LANCZOS)
    # UI originals are already below 2x peak displayed size including 1.8x stamp
    # overshoot / camera zoom. Do not upscale or discard their authored detail.
    output = DEST / (name + '.webp')
    im.save(output, 'WEBP', quality=88, method=6, exact=True)
    decoded = Image.open(output).convert('RGBA')
    a8 = decoded.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
    assert a8
    row = {'name': name, 'source': master.relative_to(ROOT).as_posix(), 'sourceSha256': sha(master),
           'sourceBytes': master.stat().st_size, 'sourceSize': list(original_size),
           'path': output.relative_to(ROOT).as_posix(), 'sha256': sha(output),
           'bytes': output.stat().st_size, 'size': list(im.size), 'crop': list(bbox),
           'cropSize': list(crop_size), 'boundsAlpha8': [a8[0], a8[1], a8[2]-a8[0], a8[3]-a8[1]]}
    if red_before is not None:
        full = Image.new('RGBA', original_size)
        full.paste(decoded, bbox[:2])
        original = Image.open(master).convert('RGBA')
        row['originalRedCollarBefore'] = red_before
        row['originalRedCollarAfter'] = int(np.count_nonzero(collar_mask(original) & (np.asarray(full.getchannel('A')) >= 128)))
        row['alphaMethod'] = 'native alpha minimum 7x7 (3px inward), Gaussian feather sigma 0.35; RGB unchanged before WebP encoding'
    rows.append(row)

report = {'nativeCalls': 0, 'sourceBytes': sum(r['sourceBytes'] for r in rows),
          'runtimeBytes': sum(r['bytes'] for r in rows), 'encoding': 'WebP quality 88, exact alpha; Pillow', 'items': rows}
MANIFEST.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(SOURCES / 'SHA256SUMS.txt').write_text(''.join(r['sourceSha256']+'  '+r['name']+'.png\n' for r in rows), encoding='utf-8')
bounds = {r['name']+'.webp': r['boundsAlpha8'] for r in rows}
(ROOT / 'src/raid/fx-bounds.ts').write_text('// Optimized WebP alpha>=8 crop metadata; native masters retained in assets_src.\nexport const FX_BOUNDS: Readonly<Record<string, readonly [number, number, number, number]>> = '+json.dumps(bounds, indent=2)+'\n', encoding='utf-8')

# Both black and white boards, with source/result side by side for every asset.
panel = Image.new('RGB', (1440, 10*220), '#35383d')
draw = ImageDraw.Draw(panel)
for y, row in enumerate(rows):
    draw.text((8, y*220+5), row['name']+' | native black / runtime black / native white / runtime white', fill='white')
    for col, (source, bg) in enumerate([(True, 'black'), (False, 'black'), (True, 'white'), (False, 'white')]):
        im = Image.open(ROOT / row['source' if source else 'path']).convert('RGBA')
        im = im.crop(im.getchannel('A').getbbox())
        im.thumbnail((340, 190), Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (350, 194), bg)
        tile.alpha_composite(im, ((350-im.width)//2, (194-im.height)//2))
        panel.paste(tile.convert('RGB'), (col*360, y*220+24))
panel.save(ROOT / 'docs/realm/production/CODEX50-FX-BLACK-WHITE-QA.jpg', quality=92)
check()
# Public runtime contains only the optimized variants. Every removed PNG has
# already passed a byte-for-byte master checksum above and the output check.
for native in PREV['items']:
    old = DEST / native['name']
    if old.exists():
        assert sha(old) == native['sha256']
        old.unlink()
