"""
목소리 도감 굽기 (형 11-01: "캐릭터마다 성우 · 목소리 모델마다 제대로 이해해야").

AI 스튜디오 대화 모드로 두 목소리가 같은 사극 대사를 한 번씩 읽은 wav 하나를 받아
  1. 가장 긴 쉼에서 둘로 자르고
  2. 목소리마다 음높이 중앙값(자기상관 · 40ms 틀 · 소리 큰 틀만)과 길이를 재고
  3. -16 LUFS 로 맞춰 public/realm/voice/book/<이름>.ogg 로 굽고
  4. public/realm/voice/book/book.json 에 잰 값을 더한다 (도감 화면 voice-book.html 이 읽는다)

쓰는 법: py -I tools/voice-book.py <받은 wav> <앞 목소리> <뒤 목소리>
ffmpeg 는 imageio-ffmpeg 의 exe (메모리: python 없음 · 사용자 site-packages).
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

FF = os.path.expandvars(r'%APPDATA%\Python\Python39\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('VB_OUT') or os.path.join(ROOT, 'public', 'realm', 'voice', 'book')  # 장수 후보는 VB_OUT 으로 따로


def read(path):
    with wave.open(path, 'rb') as w:
        sr = w.getframerate()
        n = w.getnframes()
        ch = w.getnchannels()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def split2(x, sr):
    """가운데 쪽에서 가장 긴 쉼 — 두 대사 사이"""
    hop = int(sr * 0.01)
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    quiet = e < max(0.01, np.percentile(e, 60) * 0.08)
    # 쉼 덩어리들 — 두 목소리가 같은 대사를 읽으니 말소리 가운데에 가장 가까운 긴 쉼이 경계다
    # (가장 긴 쉼만 고르면 한 대사 안의 쉼에서 잘려 한쪽이 5초 · 다른 쪽이 9초가 됐다)
    runs, i = [], 0
    while i < len(e):
        if quiet[i]:
            j = i
            while j < len(e) and quiet[j]:
                j += 1
            runs.append((i, j - i))
            i = j
        else:
            i += 1
    loud = np.where(~quiet)[0]
    mid = (loud[0] + loud[-1]) / 2 if len(loud) else len(e) / 2
    cand = [r for r in runs if r[1] >= 25 and r[0] > loud[0] and r[0] + r[1] < loud[-1]] or runs
    best = min(cand, key=lambda r: abs(r[0] + r[1] / 2 - mid) - min(r[1], 120) * 0.5)
    cut = (best[0] + best[1] // 2) * hop
    return x[:cut], x[cut:], best[1] * 10


def pitch(x, sr):
    """음높이 중앙값 (Hz) — 40ms 틀 자기상관, 소리 큰 틀만"""
    fr = int(sr * 0.04)
    rms = [np.sqrt(np.mean(x[i:i + fr] ** 2)) for i in range(0, len(x) - fr, fr)]
    th = np.percentile(rms, 60)
    lo, hi = int(sr / 400), int(sr / 70)
    out = []
    for k, i in enumerate(range(0, len(x) - fr, fr)):
        if rms[k] < th:
            continue
        f = x[i:i + fr] - np.mean(x[i:i + fr])
        c = np.correlate(f, f, 'full')[fr - 1:]
        if c[0] <= 0:
            continue
        lag = lo + int(np.argmax(c[lo:hi]))
        if c[lag] / c[0] > 0.3:
            out.append(sr / lag)
    return round(float(np.median(out))) if out else 0


def trim(x, sr):
    e = np.abs(x)
    th = 0.01
    idx = np.where(e > th)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(sr * 0.08))
    b = min(len(x), idx[-1] + int(sr * 0.15))
    return x[a:b]


def bake(x, sr, name):
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, f'_{name}.wav')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    dst = os.path.join(OUT, f'{name}.ogg')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', tmp, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '24000', '-c:a', 'libvorbis', '-q:a', '4', dst], check=True)
    os.remove(tmp)
    return dst


def main():
    src, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
    x, sr = read(src)
    p, q, gap = split2(x, sr)
    book_path = os.path.join(OUT, 'book.json')
    book = json.load(open(book_path, encoding='utf-8')) if os.path.exists(book_path) else {}
    for name, part in ((a, p), (b, q)):
        part = trim(part, sr)
        dst = bake(part, sr, name)
        if os.path.getsize(dst) == 0:
            raise SystemExit(f'빈 소리: {dst}')
        book[name] = {'hz': pitch(part, sr), 'sec': round(len(part) / sr, 2)}
        print(name, book[name], f'쉼 {gap}ms')
    with open(book_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(dict(sorted(book.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
