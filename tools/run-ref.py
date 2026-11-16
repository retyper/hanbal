"""달리기 전용 띠 시험의 참고 그림: 장수 띠(anim-px/gen-<key>.png)에서 서기 0 · 걷기 4·7 · 공격 14 네 칸을 3배(nearest)로 한 줄에
형 11-16 「장수 기본 달리기가 조금 부자연스럽다 · 전용으로 다시 그리거나 추가」 → 챗지피티 시험 둘(tools/release-jobs.mjs RUN-)
다시: py -3 -I tools/run-ref.py gaon malgalgi
"""
import os, sys
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'assets_src/realm/raid/run-ref'); os.makedirs(out, exist_ok=True)
for key in sys.argv[1:]:
    im = Image.open(os.path.join(root, f'public/realm/anim-px/gen-{key}.png')).convert('RGBA')
    fw, fh = im.width // 20, im.height
    picks = [0, 4, 7, 14]
    sheet = Image.new('RGBA', (fw * len(picks), fh))
    for i, f in enumerate(picks):
        sheet.alpha_composite(im.crop((f * fw, 0, (f + 1) * fw, fh)), (i * fw, 0))
    sheet = sheet.resize((sheet.width * 3, sheet.height * 3), Image.Resampling.NEAREST)
    sheet.save(os.path.join(out, f'{key}.png'))
    print(key, sheet.size)
