"""Offline repair from original sheets; never generates or overwrites source art.

py -3 tools/sprite-kit/repair-pilot.py --out <candidate directory>
Uses installed Pillow/numpy/scipy. Whole connected figures cross nominal cell
boundaries safely. Face regions retain source colours without invented marks.
Outputs candidates + provenance/edge checks; installation is a separate step.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
H, FEET, PAD = 160, 156, 4
ORDER = [('act', 0)] * 4 + [('walk', i % 4) for i in range(8)] + [
    ('act', i) for i in [0, 1, 2, 2, 2, 0, 5, 7]]


def read_sheet(path):
    rgb = np.array(Image.open(path).convert('RGB'))
    f = rgb.astype(float)
    # Chroma background is saturated green. Ratio-only keying also deletes
    # celadon clothing and bronze spearheads, so require a large absolute gap.
    green = (f[..., 1] - np.maximum(f[..., 0], f[..., 2]) > 80) & (f[..., 1] > 120)
    # Label before cropping: a weapon extending over the grid remains attached.
    labels, _ = ndimage.label(~green, structure=np.ones((3, 3)))
    return rgb, labels


def extract(rgb, labels, landmark):
    x, y = landmark['seed']
    label = labels[y, x]
    mask = labels == label
    if label == 0 or mask.sum() < 5000:
        raise ValueError(f'Invalid body seed {landmark}')
    # A one-pixel green seam must not separate an engraved spearhead.
    near = ndimage.binary_dilation(mask, iterations=2)
    for small in np.unique(labels[near & ~mask]):
        if small == 0:
            continue
        piece = labels == small
        if piece.sum() < 2000:
            mask |= piece
    ys, xs = np.nonzero(mask)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    a = np.dstack([rgb.copy(), mask.astype('uint8') * 255])
    # Remove green contamination at the silhouette, not in clothing interiors.
    edge = mask & ~ndimage.binary_erosion(mask, iterations=2)
    a[..., 1][edge] = np.minimum(a[..., 1][edge], np.maximum(a[..., 0][edge], a[..., 2][edge]))
    return Image.fromarray(a).crop(box), box, float(xs.mean()), int(mask.sum())


def build(key, spec, out):
    if spec.get('pipeline') in ('full20-master','awakened20-master'):
        module_spec = importlib.util.spec_from_file_location(f'{key}_full20', Path(__file__).with_name('bake-full20.py'))
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        if spec.get('pipeline') == 'awakened20-master':
            module.HERE=Path(__file__).with_name('awakened-20261114')
        return module.bake(out,key)
    if spec.get('pipeline') == 'generated-master':
        module_spec = importlib.util.spec_from_file_location(f'{key}_master', Path(__file__).with_name(f'bake-{"haebi" if key == "haebi" else "aryeong"}-master.py'))
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        return module.bake(out) if key == "haebi" else module.bake(out, key=key)
    parts, sources = {}, {}
    for kind in ('act', 'walk'):
        path = ROOT / spec['sourceDir'] / f'{key}-{kind}.png'
        sources[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
        rgb, labels = read_sheet(path)
        for i, mark in enumerate(spec[kind]):
            parts[kind, i] = (*extract(rgb, labels, mark), mark)
    standing = parts['act', 0][0].height
    scale = min(spec['bodyHeight'] / standing, (FEET - PAD) / max(parts[p][0].height for p in ORDER))
    # Fit the full silhouette around its original centroid; no fixed-width crop.
    half = max(max(c - b[0], b[2] - c) * scale for im, b, c, n, mark in (parts[p] for p in ORDER))
    cw = int(np.ceil((half * 2 + PAD * 2) / 8) * 8)
    frames, report = [], []
    # One palette for the entire animation prevents colour flicker between poses.
    resized = {p: parts[p][0].resize((round(parts[p][0].width * scale), round(parts[p][0].height * scale)), Image.Resampling.LANCZOS) for p in set(ORDER)}
    samples = np.concatenate([np.array(im)[np.array(im)[..., 3] >= 128, :3] for p, im in sorted(resized.items())])
    palette = Image.fromarray(samples.reshape(1, -1, 3)).quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    for i, p in enumerate(ORDER):
        im, box, center, count, mark = parts[p]
        w, h = round(im.width * scale), round(im.height * scale)
        # One resize from the original; do not upscale a previously shrunken strip.
        small = resized[p]
        # 96-colour pilot palette keeps small skin/metal values; no dithering.
        pal = small.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
        alpha = np.array(small)[..., 3] >= 128
        arr = np.array(pal)
        arr[..., 3] = alpha.astype('uint8') * 255
        face = None
        if 'face' in mark:
            x0, y0, x1, y1 = mark['face']
            face = (max(0, round((x0 - box[0]) * scale)), max(0, round((y0 - box[1]) * scale)),
                    min(w, round((x1 - box[0]) * scale)), min(h, round((y1 - box[1]) * scale)))
            fx0, fy0, fx1, fy1 = face
            # Preserve the original eye/skin/lip colours; no painted eye template,
            # nose dot or mouth line. Palette reduction must not erase the eye.
            original = np.array(small)
            arr[fy0:fy1, fx0:fx1, :3] = original[fy0:fy1, fx0:fx1, :3]
        small = Image.fromarray(arr)
        ox = round(cw / 2 - (center - box[0]) * scale)
        oy = FEET - h
        frame = Image.new('RGBA', (cw, H))
        frame.alpha_composite(small, (ox, oy))
        # An OUTER one-pixel outline preserves thin spear shafts and face edges.
        arr = np.array(frame)
        solid = arr[..., 3] > 0
        border = ndimage.binary_dilation(solid) & ~solid
        if face is not None:
            fx0, fy0, fx1, fy1 = face
            # An added contour at the profile protrudes like a hooked nose.
            border[max(0, oy+fy0-1):oy+fy1+1, max(0, ox+fx0-1):ox+fx1+1] = False
        arr[border] = (26, 20, 18, 255)
        frame = Image.fromarray(arr)
        # One stable idle pose. Resizing the upper body deformed the forehead,
        # jaw and weapon every 180 ms; keep all four idle frames byte-identical.
        ink = np.array(frame)[..., 3] > 0
        ys, xs = np.nonzero(ink)
        margins = [int(xs.min()), int(ys.min()), cw - 1 - int(xs.max()), H - 1 - int(ys.max())]
        if min(margins) < 2:
            raise ValueError(f'{key} frame {i}: insufficient margin {margins}')
        if ox < 0 or ox + w > cw or oy < 0:
            raise ValueError(f'{key} frame {i}: crop would lose source pixels')
        frames.append(frame)
        report.append({'frame': i, 'source': list(p), 'sourceBox': box, 'sourcePixels': count,
                       'margins': margins, 'faceRetouch': False, 'sourceFaceColours': face is not None})
    strip = Image.new('RGBA', (cw * 20, H))
    for i, frame in enumerate(frames):
        strip.paste(frame, (i * cw, 0))
    strip.save(out / f'gen-{key}.png')
    # Review all frames, indexed and nearest-neighbour enlarged.
    contact = Image.new('RGB', (cw * 2 * 5, (H * 2 + 24) * 4), '#33434a')
    d = ImageDraw.Draw(contact)
    for i, frame in enumerate(frames):
        x, y = i % 5 * cw * 2, i // 5 * (H * 2 + 24)
        contact.paste(frame.resize((cw * 2, H * 2), Image.Resampling.NEAREST), (x, y + 24), frame.resize((cw * 2, H * 2), Image.Resampling.NEAREST))
        d.text((x + 8, y + 6), f'{key} / {i}', fill='white')
    contact.save(out / f'{key}-contact.png')
    top, bottom = np.where((np.array(frames[0])[..., 3] > 0).any(axis=1))[0][[0, -1]]
    return {'sources': sources, 'cell': [cw, H], 'feet': int(bottom + 1), 'bodyPx': int(bottom - top + 1),
            'cells': 20, 'kind': 'general', 'generatedCredits': 0, 'frames': report}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    spec = json.loads(Path(__file__).with_suffix('.json').read_text(encoding='utf-8'))
    report = {key: build(key, value, args.out) for key, value in spec.items()}
    (args.out / 'repair-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: {f: v.get(f) for f in ['cell', 'bodyPx', 'generationCalls', 'generatedCredits']} for k, v in report.items()}))
