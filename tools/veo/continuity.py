#!/usr/bin/env python3
"""Local video continuity triage, not an automatic quality verdict.

Dependencies: OpenCV, NumPy, Pillow. Does not modify the source video.
Frame indices are zero-based; a transition's time refers to its later frame.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


def mae(a, b):
    return float(np.abs(a.astype(np.float32) - b.astype(np.float32)).mean())


def stats(values):
    return {"median": float(np.median(values)), "p95": float(np.percentile(values, 95)),
            "max": float(np.max(values))}


def analyze(video, width=180, top=8, local_window=12):
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise ValueError("Cannot open video: " + str(video))
    fps = float(cap.get(cv2.CAP_PROP_FPS))
    declared_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if not np.isfinite(fps) or fps <= 0:
        cap.release()
        raise ValueError("Valid FPS required for time labels")
    first = previous = None
    full, center = [], []
    decoded = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if decoded == 0:
                native_height, native_width = frame.shape[:2]
                sample_width = min(width, native_width)
                sample_height = max(2, round(native_height * sample_width / native_width))
                # Fixed central portrait region, not a detected person/face mask.
                x0, x1 = int(sample_width * .2), max(1, int(sample_width * .8))
                y0, y1 = int(sample_height * .1), max(1, int(sample_height * .95))
            small = cv2.resize(frame, (sample_width, sample_height), interpolation=cv2.INTER_AREA)
            if first is None:
                first = small.copy()
            if previous is not None:
                full.append(mae(previous, small))
                center.append(mae(previous[y0:y1, x0:x1], small[y0:y1, x0:x1]))
            previous = small
            decoded += 1
    finally:
        cap.release()
    if decoded < 2:
        raise ValueError("At least two decoded frames required")
    full_stats, center_stats = stats(full), stats(center)
    epsilon = .01
    transitions = []
    for i, (f, c) in enumerate(zip(full, center)):
        neighbors = [j for j in range(max(0, i - local_window), min(len(full), i + local_window + 1)) if j != i]
        local_full = float(np.median([full[j] for j in neighbors])) if neighbors else full_stats['median']
        local_center = float(np.median([center[j] for j in neighbors])) if neighbors else center_stats['median']
        transitions.append({
            "from_frame": i, "to_frame": i + 1, "time_s": (i + 1) / fps,
            "full_mae": f, "center_mae": c,
            "full_local_median": local_full, "center_local_median": local_center,
            "full_local_ratio": f / max(epsilon, local_full),
            "center_local_ratio": c / max(epsilon, local_center),
            "rank_score": max(f / max(epsilon, full_stats['p95']), c / max(epsilon, center_stats['p95'])),
        })
    def select_candidates(score):
        chosen = []
        for item in sorted(transitions, key=lambda t: (-score(t), t['to_frame'])):
            # Avoid filling the sheet with adjacent samples of the same brief event.
            if all(abs(item['time_s'] - c['time_s']) >= .125 for c in chosen):
                chosen.append(dict(item, rank=len(chosen) + 1))
                if len(chosen) == top:
                    break
        return chosen
    candidates = select_candidates(lambda t: t['rank_score'])
    local_candidates = select_candidates(lambda t: max(t['full_local_ratio'], t['center_local_ratio']))
    return {
        "video": str(Path(video).resolve()), "fps": fps,
        "native_width": native_width, "native_height": native_height,
        "decoded_frames": decoded, "declared_frames": declared_count,
        "duration_s": decoded / fps, "sample_size": [sample_width, sample_height],
        "center_roi_normalized_xyxy": [.2, .1, .8, .95],
        "local_window_frames_each_side": local_window, "ratio_denominator_floor": epsilon,
        "adjacent_full": full_stats, "adjacent_center": center_stats,
        "loop_boundary_separate": {
            "from_frame": decoded - 1, "to_frame": 0,
            "full_mae": mae(previous, first),
            "center_mae": mae(previous[y0:y1, x0:x1], first[y0:y1, x0:x1]),
        },
        "candidates": candidates, "local_ratio_candidates": local_candidates, "transitions": transitions,
        "warnings": (["Decoded frame count differs from container metadata"] if declared_count != decoded else []) + [
            "No automatic PASS/FAIL. Candidates require watching the source around each time.",
            "MAE measures pixel changes; natural gestures, flashes and camera movement can rank highly.",
            "Fixed center ROI is not person segmentation; no motion compensation or audio analysis.",
            "Loop boundary is separate and is excluded from intermediate-cut ranking.",
        ],
    }


def read_selected(video, indices):
    cap = cv2.VideoCapture(str(video))
    selected = {}
    i = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if i in indices:
                selected[i] = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            i += 1
    finally:
        cap.release()
    if set(selected) != set(indices):
        raise ValueError("Could not decode requested sheet frames")
    return selected


def sheet(pairs, frames, destination, fps, loop=False):
    tile_width = 240
    tile_height = round(frames[pairs[0]['from_frame']].height * tile_width / frames[pairs[0]['from_frame']].width)
    pair_width, pair_height = tile_width * 2 + 12, tile_height + 56
    columns = min(2, len(pairs))
    canvas = Image.new('RGB', (pair_width * columns, pair_height * ((len(pairs) + columns - 1) // columns)), '#181818')
    draw = ImageDraw.Draw(canvas)
    for i, pair in enumerate(pairs):
        x, y = i % columns * pair_width, i // columns * pair_height
        label = 'LOOP END -> START (separate)' if loop else '#%d  %.3fs  full=%.2f center=%.2f' % (pair['rank'], pair['time_s'], pair['full_mae'], pair['center_mae'])
        draw.text((x + 5, y + 4), label, fill='white')
        for j, key in enumerate(('from_frame', 'to_frame')):
            index = pair[key]
            draw.text((x + j * (tile_width + 6) + 5, y + 21), 'frame %d / %.3fs' % (index, index / fps), fill='#ddd1aa')
            canvas.paste(frames[index].resize((tile_width, tile_height), Image.Resampling.LANCZOS), (x + j * (tile_width + 6), y + 42))
    canvas.save(destination, quality=92)


def write_report(video, prefix, width=180, top=8):
    result = analyze(video, width, top)
    prefix = Path(prefix)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    pairs = result['candidates']
    local_pairs = result['local_ratio_candidates']
    boundary = result['loop_boundary_separate']
    indices = {i for p in pairs + local_pairs + [boundary] for i in (p['from_frame'], p['to_frame'])}
    frames = read_selected(video, indices)
    sheet_path = str(prefix) + '-jumps.jpg'
    local_path = str(prefix) + '-local-jumps.jpg'
    loop_path = str(prefix) + '-loop-boundary.jpg'
    sheet(pairs, frames, sheet_path, result['fps'])
    sheet(local_pairs, frames, local_path, result['fps'])
    sheet([boundary], frames, loop_path, result['fps'], loop=True)
    result['contact_sheets'] = {"intermediate_candidates": sheet_path, "local_ratio_candidates": local_path, "loop_boundary_separate": loop_path}
    json_path = str(prefix) + '.json'
    Path(json_path).write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    return result, json_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True, type=Path)
    parser.add_argument('--out-prefix', required=True, type=Path)
    parser.add_argument('--width', type=int, default=180)
    parser.add_argument('--top', type=int, choices=range(5, 9), default=8)
    args = parser.parse_args()
    if args.width < 16:
        parser.error('--width must be at least 16')
    result, path = write_report(args.video, args.out_prefix, args.width, args.top)
    summary = {
        'frames': result['decoded_frames'], 'fps': result['fps'],
        'duration_s': round(result['duration_s'], 3),
        'size': [result['native_width'], result['native_height']],
        'mae': {region: {key: round(value, 3) for key, value in result['adjacent_' + region].items()}
                for region in ('full', 'center')},
        'loop_boundary_separate': {key: round(result['loop_boundary_separate'][key], 3)
                                   for key in ('full_mae', 'center_mae')},
        'local_candidates': [{'time_s': round(item['time_s'], 3),
                              'ratio': round(max(item['full_local_ratio'], item['center_local_ratio']), 3)}
                             for item in result['local_ratio_candidates'][:3]],
        'artifacts': {'json': path, **result['contact_sheets']},
        'manual_review_required': True,
    }
    print(json.dumps(summary, ensure_ascii=False, separators=(',', ':'), allow_nan=False))


if __name__ == '__main__':
    main()
