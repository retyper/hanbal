# -*- coding: utf-8 -*-
"""형이 고른 구미호 목소리를 게임 파일로 (11-24 형: 「꼬리만 레다로 · 웃는 소리는 어떤 건 루미 어떤 건 레다 · 여자 보스는 맞을 때마다 신음할 필요 없어
· 맞는 소리는 한 음원에 2번 있는 건 잘라 쓰면서 다른 여자 장수 피격 소리로」).
  py -3 -X utf8 tools/boss-voice-pick.py        (imageio-ffmpeg 가 사용자 site-packages 에 있어 -I 없이 돌린다)
하는 일
  웃음   cand/raid/raid_boss_f_laugh_{lumi,leda}_1..3.ogg → sfx/raid/boss_f_laugh_1..6.ogg
  비명   cand/raid/raid_boss_f_scream_leda_1..2.ogg       → sfx/raid/boss_f_scream_1..2.ogg
  피격   cand/raid/raid_boss_f_hurt_*_N.ogg 를 소리 덩어리마다 잘라(빈 소리 0.3초 넘으면) → sfx/raid/hurt_f_b<번호>.ogg  (여자 장수 피격 소리 묶음에 더한다)
끝에 덩어리 표(파일 · 길이 · 가장 큰 소리)를 찍는다 — 0.12초보다 짧은 덩어리(숨소리 조각)는 버린다.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = ROOT + '/public/realm/sfx/cand/raid/raid_boss_f_'
OUT = ROOT + '/public/realm/sfx/raid/'


def chunks(ogg, gap=.3, floor_db=-38.0):
    """ogg → (표본들, 표본율, [(시작초, 끝초)…])"""
    tmp = tempfile.mktemp(suffix='.wav')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', ogg, '-ac', '1', '-ar', '44100', tmp], check=True)
    with wave.open(tmp) as w:
        sr, n = w.getframerate(), w.getnframes()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    os.remove(tmp)
    hop = int(sr * .01)
    rms = np.sqrt(np.convolve(a * a, np.ones(hop) / hop, mode='same'))[::hop]
    loud = 20 * np.log10(rms + 1e-9) > floor_db
    segs, start, quiet = [], None, 0
    for i, v in enumerate(loud):
        if v:
            start = i if start is None else start
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * .01 >= gap:
                segs.append((start * .01, (i - quiet + 1) * .01))
                start, quiet = None, 0
    if start is not None:
        segs.append((start * .01, len(loud) * .01))
    return a, sr, segs


def cut(ogg, t0, t1, out):
    t0, t1 = max(0, t0 - .03), t1 + .08
    d = t1 - t0
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', ogg, '-af',
                    f'atrim={t0:.3f}:{t1:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={max(0, d - .05):.3f}:d=0.05',
                    '-c:a', 'libvorbis', '-q:a', '4', '-ac', '1', out], check=True)


def main():
    rows = []
    n = 0
    for voice in ('lumi', 'leda'):
        for i in (1, 2, 3):
            n += 1
            shutil.copyfile(f'{CAND}laugh_{voice}_{i}.ogg', f'{OUT}boss_f_laugh_{n}.ogg')
            rows.append((f'boss_f_laugh_{n}.ogg', f'웃음 {voice} {i}', None, None))
    for i in (1, 2):
        shutil.copyfile(f'{CAND}scream_leda_{i}.ogg', f'{OUT}boss_f_scream_{i}.ogg')
        rows.append((f'boss_f_scream_{i}.ogg', f'비명 leda {i}', None, None))
    k = 0
    for voice in ('lumi', 'leda', 'zephyr'):
        for i in (1, 2, 3):
            src = f'{CAND}hurt_{voice}_{i}.ogg'
            a, sr, segs = chunks(src)
            for (t0, t1) in segs:
                if t1 - t0 < .12:
                    continue
                k += 1
                out = f'{OUT}hurt_f_b{k}.ogg'
                cut(src, t0, t1, out)
                peak = float(np.abs(a[int(t0 * sr):int(t1 * sr)]).max())
                rows.append((f'hurt_f_b{k}.ogg', f'피격 {voice} {i} 의 {t0:.2f}~{t1:.2f}초', t1 - t0, 20 * np.log10(peak + 1e-9)))
    for f, what, d, pk in rows:
        print(f'{f:22s} {what:28s}' + (f' {d:.2f}초 · 가장 큰 소리 {pk:.1f} dB' if d else ''))
    print('피격 조각', k)


if __name__ == '__main__':
    main()
