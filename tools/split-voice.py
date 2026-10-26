"""
한 번에 뽑은 목소리(대사 여럿 · 줄 사이 빈 소리)를 대사마다 잘라 ogg 로 굽는다 — 장수 목소리 (src/ui/realm/voice.ts)
  py -I tools/split-voice.py <ffmpeg> <wav> <나갈 폴더> <이름1,이름2,…> [글자수1,글자수2,…]
빈 소리(−40dB 아래)가 0.3초 넘게 이어지면 거기서 자른다. 덩어리가 많으면 가장 짧은 틈부터 붙이고, 모자라면 아무것도 안 쓰고 멈춘다.
글자 수를 주면 대사 길이에 맞춰 나눈다 — 긴 대사(등용 대사처럼 두 문장)는 문장 사이 쉼이 대사 사이 쉼보다 길 때가 있어서다.
"""
import os
import subprocess
import sys
import wave

import numpy as np


def segments(path: str, gap: float = 0.3, floor_db: float = -40.0) -> tuple[list[tuple[float, float]], int]:
    with wave.open(path) as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    hop = int(sr * 0.01)
    rms = np.sqrt(np.convolve(a * a, np.ones(hop) / hop, mode='same'))[::hop]
    loud = 20 * np.log10(rms + 1e-9) > floor_db
    segs, start, quiet = [], None, 0
    for i, v in enumerate(loud):
        if v:
            if start is None:
                start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 0.01 >= gap:
                segs.append((start * 0.01, (i - quiet + 1) * 0.01))
                start, quiet = None, 0
    if start is not None:
        segs.append((start * 0.01, (len(loud) - quiet) * 0.01))
    # 너무 짧은 숨소리는 버린다
    return [s for s in segs if s[1] - s[0] >= 0.12], sr


def by_weight(segs: list[tuple[float, float]], w: list[int]) -> list[tuple[float, float]]:
    """덩어리를 대사 수만큼 이어 붙여 나눈다 — 소리 길이가 글자 수 몫에 가장 가깝고, 나누는 틈은 길수록 좋게 (동적 계획)"""
    n, k = len(segs), len(w)
    speech = sum(b - a for a, b in segs)
    want = [speech * x / sum(w) for x in w]
    pre = [0.0]
    for a, b in segs:
        pre.append(pre[-1] + b - a)
    INF = float('inf')
    # best[j][i] — 대사 j개로 덩어리 i개를 덮는 가장 작은 값
    best = [[INF] * (n + 1) for _ in range(k + 1)]
    back = [[0] * (n + 1) for _ in range(k + 1)]
    best[0][0] = 0.0
    for j in range(1, k + 1):
        for i in range(j, n - (k - j) + 1):
            for s in range(j - 1, i):
                if best[j - 1][s] == INF:
                    continue
                d = pre[i] - pre[s]
                c = ((d - want[j - 1]) / want[j - 1]) ** 2
                if s > 0:
                    c -= 0.8 * (segs[s][0] - segs[s - 1][1])
                if best[j - 1][s] + c < best[j][i]:
                    best[j][i], back[j][i] = best[j - 1][s] + c, s
    cut, i = [], n
    for j in range(k, 0, -1):
        s = back[j][i]
        cut.append((segs[s][0], segs[i - 1][1]))
        i = s
    return cut[::-1]


def main(ff: str, src: str, out: str, names: list[str], weights: 'list[int] | None' = None) -> None:
    segs, _ = segments(src)
    if weights is not None and len(segs) >= len(names):
        segs = by_weight(segs, weights)
    # 대사 안의 쉼(쉼표·말줄임)으로 더 갈렸으면 가장 짧은 틈부터 붙인다 — 대사 사이 틈은 그보다 길다
    while len(segs) > len(names):
        i = min(range(len(segs) - 1), key=lambda k: segs[k + 1][0] - segs[k][1])
        segs[i:i + 2] = [(segs[i][0], segs[i + 1][1])]
    if len(segs) != len(names):
        print('덩어리 수가 다르다', len(segs), '≠', len(names), [(round(a, 2), round(b, 2)) for a, b in segs])
        sys.exit(1)
    os.makedirs(out, exist_ok=True)
    for (a, b), name in zip(segs, names):
        t0, t1 = max(0.0, a - 0.04), b + 0.12
        # 자르기를 필터 안에서 먼저 하고 시각을 0 으로 되돌린 뒤 끝을 줄인다 — 출력 쪽 -ss 로 자르면 필터는 원본 처음부터 돌아
        # 끝 줄임이 원본 시각에 걸려 둘째 대사부터 끊기거나 무음이 됐다 (형 10-26: "소리들이 중간에 끊기고 대부분은 아예 들리지도 않는데")
        af = 'atrim=start=%.3f:end=%.3f,asetpts=PTS-STARTPTS,afade=t=out:st=%.3f:d=0.05,loudnorm=I=-16:TP=-1.5:LRA=7' % (t0, t1, t1 - t0 - 0.05)
        subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', '-i', src,
                        '-af', af,
                        '-ar', '48000', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '6', os.path.join(out, name + '.ogg')], check=True)
        print('ok', name, round(b - a, 2))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(','), [int(x) for x in sys.argv[5].split(',')] if len(sys.argv) > 5 else None)
