"""개발 과정 쇼츠 1편 · 4.5등신 고치기 전후 (docs/realm/MARKETING.md §4-1 · 형 11-22 「녹음할 수 있음」).

세로 1080×1920 · 16초 · 장면 넷 (각 4초):
  0~4  험측 바위 전·후   4~8  번예 한울 전·후   8~12  달빛 전(옛 작은 도트)·후   12~16  새 다섯이 나란히 걷고 끝에 로고
전 = 커밋 4b2e4c07 직전의 기본 띠(git 에서 꺼냄) · 후 = 지금의 2배 띠(_hd). 둘 다 서기 칸 몸 키를 같은 화면 키로 맞추고 걷기 8칸을 10fps 로.
형 목소리는 따로 녹음해 --voice 로 얹는다 (대본은 D:/에셋창고/shorts/devlog-01-대본.txt).

  py -3 -I tools/devlog-ba.py [--voice 녹음.m4a]   → D:/에셋창고/shorts/devlog-01.mp4
"""
import argparse
import io
import json
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PX = os.path.join(ROOT, 'public/realm/anim-px')
OUT = 'D:/에셋창고/shorts'
BEFORE = '4b2e4c07^'
W, H, FPS, SEC = 1080, 1920, 30, 16
WALK_FPS = 10
BG = (28, 33, 41)
FONT_B = 'C:/Windows/Fonts/NanumGothicExtraBold.ttf'
CREAM, GOLD, GREY = (243, 232, 210), (255, 214, 120), (170, 170, 170)
SCENES = [  # (띠 이름, 화면에 쓸 이름)
    ('base-g-61-heomcheuk-bawi', '바위'),
    ('base-g-62-beonye-hanul', '한울'),
    ('dalbit', '달빛'),
]
ALL = ['base-g-61-heomcheuk-bawi', 'base-g-62-beonye-hanul', 'base-g-59-yangmaek-maekson', 'dalbit', 'base-w-39-gosaburi-galmae']


def ffmpeg():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return os.path.expanduser(r'~\AppData\Roaming\Python\Python39\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe')


def cells_base(img):
    fw = img.size[0] // 20
    return [img.crop((i * fw, 0, (i + 1) * fw, img.size[1])) for i in range(20)]


def cells_hd(key):
    meta = json.load(open(os.path.join(HERE, 'sprite-kit/hero-hd2.json'), encoding='utf-8'))[key]
    (cw, ch), cols = meta['cell'], meta['cols']
    atlas = Image.open(os.path.join(PX, f'gen-{key}_hd.png')).convert('RGBA')
    return [atlas.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch)) for i in range(20)]


def old_cells(key):
    raw = subprocess.run(['git', 'show', f'{BEFORE}:public/realm/anim-px/gen-{key}.png'], cwd=ROOT, capture_output=True, check=True).stdout
    return cells_base(Image.open(io.BytesIO(raw)).convert('RGBA'))


def bbox(im):
    a = np.asarray(im)[:, :, 3] > 40
    ys, xs = np.nonzero(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def walk(cells, body_px, pixel=False):
    """걷기 8칸(4~11)을 서기 칸 몸 키가 body_px 가 되게 키운다 · 발 줄 = 서기 칸 바닥 · 가로 가운데 = 서기 칸 가운데"""
    x0, y0, x1, y1 = bbox(cells[0])
    k = body_px / (y1 - y0)
    cx, foot = (x0 + x1) / 2, y1
    out = []
    for c in cells[4:12]:
        im = c.resize((round(c.size[0] * k), round(c.size[1] * k)), Image.NEAREST if pixel else Image.LANCZOS)
        out.append((im, cx * k, foot * k))
    return out


def put(canvas, frame, x, y):
    im, cx, foot = frame
    # 활·짐이 넓은 그림(옛 달빛)이 화면 밖으로 잘리지 않게 안으로 민다 · 실제 그림이 있는 폭으로 잰다
    x0, _, x1, _ = bbox(im)
    left = round(x - cx)
    left = max(16 - x0, min(W - 16 - x1, left))
    canvas.alpha_composite(im, (left, round(y - foot)))


def label(canvas, xy, text, size, fill, stroke=6):
    f = ImageFont.truetype(FONT_B, size)
    d = ImageDraw.Draw(canvas)
    w = d.textlength(text, font=f)
    d.text((xy[0] - w / 2, xy[1]), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=(8, 8, 8))


def build(voice):
    scenes = []
    for key, name in SCENES:
        scenes.append((name, walk(old_cells(key), 720, pixel=(key == 'dalbit')), walk(cells_hd(key), 720)))
    row = [walk(cells_hd(k), 400) for k in ALL]
    logo = Image.open(os.path.join(ROOT, 'public/realm/logo/title.png')).convert('RGBA')
    logo = logo.crop(logo.getbbox())
    logo = logo.resize((620, round(logo.size[1] * 620 / logo.size[0])), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, 'devlog-01.mp4')
    cmd = [ffmpeg(), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-']
    if voice:
        cmd += ['-i', voice, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-16:TP=-1.5', '-c:a', 'aac', '-b:a', '160k']
    cmd += ['-t', str(SEC), '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    floor = 1480
    for f in range(FPS * SEC):
        t = f / FPS
        wi = int(t * WALK_FPS) % 8
        cv = Image.new('RGBA', (W, H), BG + (255,))
        if t < 12:
            name, old, new = scenes[int(t // 4)]
            label(cv, (W / 2, 210), '머리가 너무 컸다', 84, CREAM)
            label(cv, (W / 2, 330), name, 64, GOLD)
            label(cv, (290, 600), '전', 72, GREY)
            label(cv, (790, 600), '후', 72, GOLD)
            put(cv, old[wi], 290, floor)
            put(cv, new[wi], 790, floor)
            ImageDraw.Draw(cv).line((540, 640, 540, floor + 20), fill=(70, 76, 88), width=3)
        else:
            label(cv, (W / 2, 210), '4.5등신으로 다시', 84, CREAM)
            for i, fr in enumerate(row):
                x = 120 + i * 210
                put(cv, fr[(wi + i * 2) % 8], x, 1250)
            a = min(1.0, max(0.0, (t - 13) / 1.0))
            if a > 0:
                lg = logo.copy(); lg.putalpha(lg.getchannel('A').point(lambda v: int(v * a)))
                cv.alpha_composite(lg, ((W - lg.size[0]) // 2, 1420))
        p.stdin.write(cv.convert('RGB').tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise SystemExit('ffmpeg 실패')
    return out


SCRIPT = '''열국군웅전 개발 과정 1편 · 대본 (16초 · 장면마다 4초 · 편하게 말하듯이)

0~4초   (바위 전·후)    혼자 게임 만들고 있는데요, 장수들 머리가 너무 컸어요.
4~8초   (한울 전·후)    그래서 다섯 명을 4.5등신으로 다시 그렸습니다.
8~12초  (달빛 전·후)    얘는 아예 작은 도트였는데, 이렇게 바뀌었어요.
12~16초 (다섯이 나란히)  열국군웅전, 오늘부터 만드는 과정 올려 볼게요.

녹음: 폰 녹음 앱이나 PC 녹음기 · 조용한 방 · 입에서 한 뼘 · 16초 안 · 파일을 D:/에셋창고/shorts/ 에 두고 이름만 알려 주면 얹는다.
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice')
    a = ap.parse_args()
    print(build(a.voice))
    with open(os.path.join(OUT, 'devlog-01-대본.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(SCRIPT)


if __name__ == '__main__':
    main()
