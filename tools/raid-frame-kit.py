"""H20 테두리 조각(모서리 하나 + 민무늬 막대 + 매듭)을 9분할 판과 매듭 두 장으로 굽는다.
늘이지 않고 막대만 반복하므로 어떤 크기의 창에서도 깨지지 않는다 (형 11-15).
쓰는 곳: src/raid/combat.css 의 --fk 테두리 · 다시 굽기: py -3 -I tools/raid-frame-kit.py"""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent.parent
kit = Image.open(root / 'assets_src/realm/raid/haebi-pack-v1-H20.png').convert('RGBA')
C, M = 262, 100                       # 모서리 칸 · 가운데 막대 칸 (원본 px)
corner = kit.crop((0, 0, C, C))
top = kit.crop((600, 0, 600 + M, C))   # 위 막대: 어디를 잘라도 같은 민무늬
left = kit.crop((0, 600, C, 600 + M))  # 왼쪽 막대
FH, FV = Image.FLIP_LEFT_RIGHT, Image.FLIP_TOP_BOTTOM
N = 2 * C + M
out = Image.new('RGBA', (N, N), (0, 0, 0, 0))
out.paste(corner, (0, 0)); out.paste(corner.transpose(FH), (C + M, 0))
out.paste(corner.transpose(FV), (0, C + M)); out.paste(corner.transpose(Image.ROTATE_180), (C + M, C + M))
out.paste(top, (C, 0)); out.paste(top.transpose(FV), (C, C + M))
out.paste(left, (0, C)); out.paste(left.transpose(FH), (C + M, C))
dst = root / 'public/realm/raid'
out = out.resize((N // 2, N // 2), Image.LANCZOS)     # 화면 모서리는 많아야 40px 라 절반이면 넉넉
out.save(dst / 'frame-9.png', optimize=True)  # border-image slice = C//2 = 131
knot = kit.crop((940, 1052, 1037, 1151)).resize((49, 50), Image.LANCZOS)  # 붉은 매듭만 (막대 끝 제외)
knot.save(dst / 'frame-knot-h.png', optimize=True)
knot.transpose(Image.ROTATE_90).save(dst / 'frame-knot-v.png', optimize=True)
print('frame-9', out.size, 'knot', knot.size)
