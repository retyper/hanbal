"""장수 띠(anim-px/gen-*.png)의 걷기 칸 4~11 중 실제로 다른 그림이 몇 칸인지 센다 → src/raid/walk-cycle.ts
형 11-16 「장수 기본 달리기가 조금 부자연스럽다」: 띠 대부분(188/227)이 걷기 6칸 + 앞 두 칸을 되풀이(4·5 = 10·11)라
8칸을 그대로 돌리면 한 바퀴마다 같은 두 걸음이 거듭 나와 걸음이 턱 걸린다. 다시 시작하는 칸까지만 돈다.
다시 굽기: py -3 -I tools/walk-cycle-table.py
"""
import glob, json, os
import numpy as np
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
table = {}
for p in sorted(glob.glob(os.path.join(root, 'public/realm/anim-px/gen-*.png'))):
    a = np.asarray(Image.open(p).convert('RGBA'))
    fw = a.shape[1] // 20
    cells = [a[:, i * fw:(i + 1) * fw].tobytes() for i in range(4, 12)]
    n = next((i for i in range(1, 8) if cells[i] == cells[0]), 8)
    if n != 8:
        table['anim-px/' + os.path.basename(p)] = n
counts = {}
for n in table.values():
    counts[n] = counts.get(n, 0) + 1
out = os.path.join(root, 'src/raid/walk-cycle.ts')
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(f'// 자동 생성 — tools/walk-cycle-table.py (손으로 고치지 말 것) · 8칸이 아닌 띠 {len(table)}개 {json.dumps(counts)}\n')
    f.write('/** 장수 띠의 걷기 한 바퀴 칸 수 (칸 4부터) · 없으면 8 */\n')
    f.write('export const WALK_CYCLE: Readonly<Record<string, number>> = ' + json.dumps(table, ensure_ascii=False) + '\n')
print(len(table), counts)
