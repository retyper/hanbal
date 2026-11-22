"""쇼츠 굽기 (docs/realm/MARKETING.md §3 ② · 형 11-22 「니 제안대로」 · 채널 = 메모리 youtube-game-channel).

각성 숨쉬기 영상(public/realm/awaken-loop/<그림 id>.mp4 · 720×1280 · 10초 · Veo 소리 포함) 하나를
유튜브 쇼츠·틱톡 세로 판(1080×1920 · 30fps)으로 굽는다.
  위 맨 꼭대기: 훅 한 줄(흰 글) · 아래: 장수 이름(금빛 큰 글 · 0.3초에 떠오름) + 제목 로고(public/realm/logo/title.png) + 「스팀 출시 준비 중」 (상점 페이지가 열리면 --cta 「스팀에서 찜하기」)
  쇼츠 화면의 아래 20%·오른쪽 띠는 유튜브 단추가 덮으므로 글은 위 5~8% · 아래 56~76% 에만 둔다. 얼굴을 가리지 않는다.
  원본은 15% 키워 아래를 잘라 생성 도구 표시(✦)를 뺀다.

  py -3 -I tools/shorts.py <그림 id> <이름> [--hook "한 줄"] [--cta "한 줄"] [--voice 소리.ogg --line "대사"] [--title "유튜브 제목"]
    목소리: public/realm/voice/hero/<장수 id>/art.ogg (외침) · 장수 id ↔ 그림 id 는 src/realm/data/hero-bust.ts · 대사는 src/ui/realm/voice-hero*.ts 의 art
    → D:/에셋창고/shorts/<그림 id>.mp4 · 같은 이름 .txt (올릴 제목·설명)
  예) py -3 -I tools/shorts.py l-L2-soseono.2 소서노 --hook "뽑기 없이, 싸워서 얻는 장수"

15세 선: assets_r19 로 뺀 장수(R19)는 굽지 않는다 (메모리 rating-15-steam).
"""
import argparse
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = 'D:/에셋창고/shorts'
W, H = 1080, 1920
FONT_B = 'C:/Windows/Fonts/NanumMyeongjoExtraBold.ttf'
FONT_S = 'C:/Windows/Fonts/NanumGothicBold.ttf'
R19 = ('w-18', 'w-91', 'w-98', 'w-103')
GOLD, CREAM = (255, 214, 120), (243, 232, 210)
DEFAULT_HOOK = '뽑기 없이, 싸워서 사로잡는다'
DEFAULT_CTA = '스팀 출시 준비 중'
ZOOM = 1.15
ZW, ZH = round(W * ZOOM / 2) * 2, round(H * ZOOM / 2) * 2


def ffmpeg():
    """-I 로 돌면 사용자 site-packages 가 안 보인다 → 환경 변수 · import · 알려진 자리 차례로 (bake-bgm.py 와 같은 파일)"""
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return os.path.expanduser(r'~\AppData\Roaming\Python\Python39\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe')


def text_layer(draw_on, xy, text, font, fill, stroke=6, glow=0):
    """가운데 맞춘 글 + 검은 테두리 (밝은 영상 위에서도 읽히게)"""
    layer = Image.new('RGBA', draw_on.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w = d.textlength(text, font=font)
    x = xy[0] - w / 2
    if glow:
        g = Image.new('RGBA', draw_on.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).text((x, xy[1]), text, font=font, fill=(0, 0, 0, 230), stroke_width=stroke + glow, stroke_fill=(0, 0, 0, 230))
        draw_on.alpha_composite(g.filter(ImageFilter.GaussianBlur(glow)))
    d.text((x, xy[1]), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(12, 8, 4, 255))
    draw_on.alpha_composite(layer)


def fit_font(path, text, size, max_w):
    f = ImageFont.truetype(path, size)
    d = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
    while d.textlength(text, font=f) > max_w and size > 24:
        size -= 4
        f = ImageFont.truetype(path, size)
    return f


def overlays(name, hook, cta, line=''):
    """위 글판(훅 · 이름)은 0.3초에 떠오르고, 아래 글판(로고 · 안내)은 처음부터.
    얼굴은 대개 위 15~40% 에 있다 → 훅은 머리 위 맨 꼭대기 한 줄, 이름은 아래 로고 바로 위.
    line(장수 한마디 자막)은 따로 한 판 — 목소리가 나오는 1초에 떠오른다 (소리 끄고 보는 사람도 읽게)."""
    top = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    text_layer(top, (W / 2, 96), hook, fit_font(FONT_S, hook, 52, 900), CREAM, stroke=5, glow=10)
    bot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    logo = Image.open(os.path.join(ROOT, 'public/realm/logo/title.png')).convert('RGBA')
    logo = logo.crop(logo.getbbox())
    lw = 560
    logo = logo.resize((lw, round(logo.size[1] * lw / logo.size[0])), Image.LANCZOS)
    ny, ly = (1040, 1310) if line else (1090, 1290)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((70, ny - 20, W - 70, ly + logo.size[1] + 100), 48, fill=(0, 0, 0, 135))
    bot.alpha_composite(sh.filter(ImageFilter.GaussianBlur(34)))
    text_layer(top, (W / 2, ny), name, fit_font(FONT_B, name, 140, 960), GOLD, stroke=8, glow=14)
    bot.alpha_composite(logo, ((W - lw) // 2, ly))
    text_layer(bot, (W / 2, ly + logo.size[1] + 16), cta, fit_font(FONT_S, cta, 46, 900), CREAM, stroke=5)
    sub = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if line:
        text_layer(sub, (W / 2, ny + 168), f'「{line}」', fit_font(FONT_S, line, 50, 940), (255, 255, 255), stroke=6, glow=8)
    return top, bot, sub


def build(key, name, hook, cta, voice, line=''):
    if key.startswith(R19):
        raise SystemExit(f'{key}: 15세 선 밖(assets_r19) — 쇼츠로 굽지 않는다')
    src = os.path.join(ROOT, 'public/realm/awaken-loop', f'{key}.mp4')
    if not os.path.exists(src):
        raise SystemExit(f'{key}: 각성 영상 없음 ({src})')
    os.makedirs(OUT, exist_ok=True)
    top, bot, sub = overlays(name, hook, cta, line)
    tp, bp, sp = (os.path.join(OUT, f'.{key}.{n}.png') for n in ('top', 'bot', 'sub'))
    top.save(tp); bot.save(bp); sub.save(sp)
    out = os.path.join(OUT, f'{key}.mp4')
    # 15% 키워 위·가운데에 맞춰 자른다 — 원본 오른쪽 아래의 생성 도구 표시(✦ · 세로 91% 자리)가 잘려 나간다
    vf = (f'[0:v]scale={ZW}:{ZH}:flags=lanczos,crop={W}:{H}:({ZW}-{W})/2:0,fps=30,setsar=1[v];'
          '[1:v]format=rgba,fade=in:st=0.3:d=0.45:alpha=1[t];'
          '[2:v]format=rgba[b];'
          '[3:v]format=rgba,fade=in:st=1.0:d=0.3:alpha=1[s];'
          '[v][b]overlay=0:0:shortest=1[vb];[vb][t]overlay=0:0:shortest=1[vt];[vt][s]overlay=0:0:shortest=1,format=yuv420p[o]')
    cmd = [ffmpeg(), '-v', 'error', '-y', '-i', src,
           '-loop', '1', '-framerate', '30', '-i', tp, '-loop', '1', '-framerate', '30', '-i', bp, '-loop', '1', '-framerate', '30', '-i', sp]
    if voice:
        cmd += ['-i', voice]
        # 영상 소리(Veo) 는 낮추고 장수 한마디를 1초에 얹는다
        af = '[0:a]volume=0.55[a0];[4:a]adelay=1000|1000,volume=1.6[a1];[a0][a1]amix=inputs=2:duration=first:normalize=0[a]'
        cmd += ['-filter_complex', vf + ';' + af, '-map', '[o]', '-map', '[a]']
    else:
        cmd += ['-filter_complex', vf, '-map', '[o]', '-map', '0:a?']
    cmd += ['-t', '10', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    for f in (tp, bp, sp):
        os.remove(f)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('key'); ap.add_argument('name')
    ap.add_argument('--hook', default=DEFAULT_HOOK)
    ap.add_argument('--cta', default=DEFAULT_CTA)
    ap.add_argument('--voice')
    ap.add_argument('--line', default='', help='장수 한마디 자막 (--voice 의 대사)')
    ap.add_argument('--title')
    a = ap.parse_args()
    out = build(a.key, a.name, a.hook, a.cta, a.voice, a.line)
    title = a.title or f'{a.name} 각성 | 열국군웅전 #shorts'
    with open(out[:-4] + '.txt', 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'제목: {title}\n\n설명(업로드 기본 설명 위에 한 줄):\n{a.name} · {a.hook}\n')
    print(out)


if __name__ == '__main__':
    sys.exit(main())
