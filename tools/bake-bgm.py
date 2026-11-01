# 쓰는 법: py -I tools/bake-bgm.py assets_src/realm/sfx-in/gugak public/realm/sfx <임시 폴더> [k17 k18 …]
# 새 곡은 아래에 한 줄씩 더한다 · 굽고 나면 ebur128 로 재어 -18 LUFS 언저리인지 본다 (LIFT 로 맞춘다)
# 지도 음악 굽기 (형 11-01) — 국립국악원 디지털 이음 조각을 이어 한 곡씩, -18 LUFS mp3
import subprocess, sys, os
import numpy as np
FF = r'C:\Users\my\AppData\Roaming\Python\Python39\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
G = sys.argv[1]; OUT = sys.argv[2]; TMP = sys.argv[3]
SR = 44100
def load(n):
    raw = subprocess.run([FF, '-v', 'quiet', '-i', os.path.join(G, n), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
def fade(a, s):
    f = min(len(a), int(s * SR)); a = a.copy(); a[-f:] *= np.linspace(1, 0, f)[:, None] ** 1.5; return a
def fadein(a, s):
    f = min(len(a), int(s * SR)); a = a.copy(); a[:f] *= np.linspace(0, 1, f)[:, None]; return a
def sil(s): return np.zeros((int(s * SR), 2), np.float32)
def twice(names, quick=0.45, end=2.2):
    b = np.concatenate([load(n) for n in names])
    return np.concatenate([fade(b, quick), fade(b, end)])
LIFT = {'bgm_map_k18': 1.7, 'bgm_map_k19': 1.6, 'bgm_map_k20': 1.1, 'bgm_map_k22': 1.5, 'bgm_map_k25': 1.0, 'bgm_map_k21': 0.8, 'bgm_map_k23': 0.6, 'bgm_map_k24': 0.5}
def write(a, name, af=None):
    if af is None: af = f'loudnorm=I={-18 + LIFT.get(name, 0):.1f}:TP=-1.5:LRA=11' # 한 번 재고 맞추는 loudnorm 은 짧은 곡에서 조금 덜 키운다 — 잰 만큼 더
    t = os.path.join(TMP, name + '.f32'); a.astype(np.float32).tofile(t)
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', t, '-af', af, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '160k', os.path.join(OUT, name + '.mp3')], check=True)
    os.remove(t); print(name, round(len(a) / SR, 1), 's')
which = set(sys.argv[4:])
def want(n): return not which or n in which
# 귀인 — 정악 아쟁. 큰 대목이 튀어서 먼저 눌러 준다 (형: 소리가 큰 부분에서 조금 커서)
if want('k17'): write(fade(load('Ajaeng_12.wav'), 3.0), 'bgm_map_k17', 'acompressor=threshold=-22dB:ratio=3.5:attack=30:release=400:makeup=1,loudnorm=I=-18:TP=-1.5:LRA=6')
# 우조초수대엽 — 양금은 페달 밟은 듯 울림이 이어진다 → 조각마다 끝을 잦아들게 하고 쉼을 둔다
if want('k18'):
    ps = [np.concatenate([fade(load(f's5-211-{n}-Yangum.wav'), 1.8), sil(1.2)]) for n in ('010', '015', '030', '040', '050')]
    write(np.concatenate(ps), 'bgm_map_k18')
# 경기민요 — 메기고 받는 한 묶음을 두 번 (묶음 끝은 빠르게 잦아들고, 곡 끝은 천천히)
for k, names in (('k19', ['s1-912-001.wav', 's1-912-002.wav']), ('k20', ['s1-913-001.wav', 's1-913-002.wav']),
                 ('k21', ['s1-914-003.wav', 's1-914-004.wav']), ('k22', ['s1-915-001.wav', 's1-915-002.wav']),
                 ('k23', ['s1-916-001.wav', 's1-916-002.wav', 's1-916-003.wav']), ('k24', ['s1-917-001.wav', 's1-917-002.wav']),
                 ('k25', ['s1-918-001.wav', 's1-918-002.wav', 's1-918-003.wav'])):
    if want(k): write(twice(names), 'bgm_map_' + k)
