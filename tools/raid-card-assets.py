"""Codex50 card frames: byte-identical native archives, resize + WebP only.

py tools/raid-card-assets.py [--check]
Masters are ignored and unavailable on a fresh clone; --check validates them when
present and always decodes/hashes the shipping art. No keying, crop or repaint.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets_src/realm/raid/card-frames-50'
MANIFEST = ROOT / 'docs/realm/production/CODEX50-CARD-FRAMES.json'
META = Path('C:/Users/my/Documents/Codex/2026-11-17/detail-bad-request/outputs/codex50')
INPUTS = {
    'a': ('card-pilot-a.json', 'original_path', '0dd0aad06bd0da25b7a642c05e46954308d1b9cd42c78afc730966e9de5df24c'),
    'b': ('card-b.json', 'raw_path', '60da97cf00ac5a3a27c4005b17908920840379d7a34841f8b6e146130156b07f'),
    'c': ('card-c.json', 'raw', 'b5134c9068b9fecea51c9be5a62da5e08932966975ed420259da8ae0bd1bd8cd'),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha(im):
    a = im.getchannel('A')
    hist = a.histogram()
    center = a.crop((im.width // 3, im.height // 3, im.width * 2 // 3, im.height * 2 // 3))
    return dict(transparentPixels=hist[0], visiblePixels=sum(hist[1:]), centerMax=center.getextrema()[1])


def check(report):
    for row in report['items']:
        output = ROOT / row['path']
        assert sha(output) == row['sha256'], output
        im = Image.open(output)
        assert im.mode == 'RGBA' and im.size == (384, 576), (im.mode, im.size)
        measured = alpha(im)
        assert measured == row['alpha'], (measured, row['alpha'])
        assert measured['transparentPixels'] > 0 and measured['visiblePixels'] > 0
        assert measured['centerMax'] <= 1, measured
        assert row['runtimeSlice'] / row['nativeSlice'] == 384 / 1024
        source = ROOT / row['source']
        if source.exists():
            assert sha(source) == row['sourceSha256'] == row['archiveSha256'] == row['generatorSha256']
            native = Image.open(source).convert('RGBA')
            assert native.size == (1024, 1536)
            expected = native.resize((384, 576), Image.Resampling.LANCZOS)
            # Lossy WebP changes RGB only: alpha/geometry must remain exactly the resize.
            assert expected.getchannel('A').tobytes() == im.getchannel('A').tobytes()
    assert sum(r['bytes'] for r in report['items']) == report['runtimeBytes'] < 180_000
    print(json.dumps(dict(checked=3, runtimeBytes=report['runtimeBytes'], items=[dict(branch=r['branch'], bytes=r['bytes'], alpha=r['alpha']) for r in report['items']])))


if '--check' in sys.argv:
    check(json.loads(MANIFEST.read_text(encoding='utf-8')))
    sys.exit()

SOURCE.mkdir(parents=True, exist_ok=True)
rows = []
for branch, (meta_file, raw_key, expected_sha) in INPUTS.items():
    metadata = json.loads((META / meta_file).read_text(encoding='utf-8-sig'))
    raw = Path(metadata[raw_key])
    archive = Path(f'D:/에셋창고/raid-card-branch-{branch}-50.png')
    assert sha(raw) == sha(archive) == expected_sha
    master = SOURCE / archive.name
    if master.exists():
        assert sha(master) == expected_sha
    else:
        shutil.copyfile(archive, master)
    im = Image.open(master).convert('RGBA')
    assert im.size == (1024, 1536)
    output = ROOT / f'public/realm/raid/ui-card-branch-{branch}.webp'
    im.resize((384, 576), Image.Resampling.LANCZOS).save(output, 'WEBP', quality=90, method=6, exact=True)
    rows.append(dict(branch=branch, source=master.relative_to(ROOT).as_posix(), sourceSha256=sha(master),
                     archivePath=str(archive), archiveSha256=sha(archive), generatorPath=str(raw), generatorSha256=sha(raw),
                     path=output.relative_to(ROOT).as_posix(), sha256=sha(output), bytes=output.stat().st_size,
                     size=[384, 576], nativeSize=[1024, 1536], nativeSlice=160, runtimeSlice=60,
                     alpha=alpha(Image.open(output).convert('RGBA')), metadataFile=meta_file,
                     prompt=metadata['prompt'], references=metadata.get('references', metadata.get('referenced_image_paths'))))
report = dict(task='Claude50-6 branch shells', newGenerationCalls=0, nativeFramesReused=3,
              assumption='Three shared branch a/b/c frames; no individual skill-name frame variants.',
              transforms='RGBA Lanczos resize 1024x1536 to 384x576, WebP quality=90 method=6 exact=True. No crop, keying, paint, or source edits.',
              centerUsage='CSS border-image without fill never paints the center; tiny native alpha=1 residue is unused.',
              cloneLimitation='assets_src native masters are ignored; a fresh clone contains runtime files and metadata only. Re-bake requires the recorded native masters.',
              runtimeBytes=sum(r['bytes'] for r in rows), items=rows)
MANIFEST.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
check(report)
