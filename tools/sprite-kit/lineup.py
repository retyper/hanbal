"""전투 그림 한 줄 세우기 (형 11-23 「크기도 분위기도 비율도 다 따로 놀면 유저가 안 한다」).
장수 띠마다 서기 칸(0)을 정수리~발 키(관·깃털은 headgear.json 만큼 빼고)로 같은 키에 맞춰 줄 세운다 → 비율·그림체·명암이 튀는 것이 보인다.
기준 셋(소서노·감실·진하)을 줄마다 맨 앞에 둔다.
  py -3 -I tools/sprite-kit/lineup.py [칸=0] [한 장 명수=24]   → tools/out/lineup/page-NN.jpg
"""
import glob, json, os, sys
from PIL import Image, ImageDraw

CELL = int(sys.argv[1]) if len(sys.argv) > 1 else 0
PER = int(sys.argv[2]) if len(sys.argv) > 2 else 24
H = 180          # 정수리~발을 이 높이로
BOX = (120, 230)  # 한 사람 자리
REF = ['soseono', 'gamsil', 'jinha']   # 앞의 소서노가 기준(11-23 형 「베이스라인 하나로」) · 감실·진하는 같은 결 예
gear = {k: v for k, v in json.load(open('tools/sprite-kit/headgear.json', encoding='utf-8')).items() if not k.startswith('_')}
os.makedirs('tools/out/lineup', exist_ok=True)


def figure(name):
    p = f'public/realm/anim-px/gen-{name}.png'
    im = Image.open(p).convert('RGBA'); w, h = im.size; fw = w // 20
    c = im.crop((CELL * fw, 0, (CELL + 1) * fw, h)); bb = c.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bb: return None
    c = c.crop(bb)
    g = gear.get(f'gen-{name}', 0) * (c.size[1] / max(1, bb[3] - bb[1]))  # 160칸 px → 잘린 그림 px (같은 축척)
    body = max(1, c.size[1] - g)
    k = H / body
    return c.resize((max(1, round(c.size[0] * k)), max(1, round(c.size[1] * k))), Image.LANCZOS)


names = sorted(os.path.basename(p)[4:-4] for p in glob.glob('public/realm/anim-px/gen-*.png') if not p.endswith('_hd.png') and Image.open(p).size[0] % 20 == 0)
names = [n for n in names if n not in REF]
refs = [figure(n) for n in REF]
pages = [names[i:i + PER] for i in range(0, len(names), PER)]
for pi, chunk in enumerate(pages):
    cols = 9  # 기준 3 + 6
    rows = (len(chunk) + 5) // 6
    sheet = Image.new('RGB', (cols * BOX[0], rows * BOX[1]), (214, 206, 186)); d = ImageDraw.Draw(sheet)
    for r in range(rows):
        row = chunk[r * 6:(r + 1) * 6]
        for j, (n, fig) in enumerate([(REF[i], refs[i]) for i in range(3)] + [(n, figure(n)) for n in row]):
            x, y = j * BOX[0], r * BOX[1]
            if j < 3: d.rectangle((x, y, x + BOX[0] - 1, y + BOX[1] - 1), fill=(196, 188, 166))
            d.line((x, y + BOX[1] - 22 - H, x + BOX[0], y + BOX[1] - 22 - H), fill=(170, 160, 140))
            if fig is not None:
                if fig.size[0] > BOX[0] - 2:  # 창·활이 길면 키는 그대로 두고 양옆만 자른다
                    cx = fig.size[0] // 2; fig = fig.crop((cx - (BOX[0] - 2) // 2, 0, cx + (BOX[0] - 2) // 2, fig.size[1]))
                top = max(0, fig.size[1] - (BOX[1] - 22)); fig = fig.crop((0, top, fig.size[0], fig.size[1]))
                sheet.paste(fig, (x + (BOX[0] - fig.size[0]) // 2, y + BOX[1] - 22 - fig.size[1]), fig)
            d.text((x + 3, y + BOX[1] - 18), n[:19], fill=(20, 20, 20))
    sheet.save(f'tools/out/lineup/page-{pi:02d}.jpg', quality=88)
print(len(names), 'names', len(pages), 'pages')
