# -*- coding: utf-8 -*-
"""갈아 끼운 그림의 옛 판을 한곳에 꺼내 둔다 (형 10-26: "새 이미지로 교체한 거는 그전 이미지는 지워버릴 거야? 나중에 어떻게든 쓸 거라고 생각하면 이동해서 별도로 저장해놔").

git 기록에서 public/realm 의 그림이 바뀐(M) 커밋마다 그 직전 판을 assets_src/realm/retired/<칸>/<이름>@<날짜>-<커밋>.<확장자> 로 꺼낸다.
이미 꺼낸 것은 건너뛴다 — 여러 번 돌려도 된다.   py -I tools/retire-history.py
"""
import os, subprocess
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'assets_src', 'realm', 'retired')
def git(*a, binary=False):
    return subprocess.run(['git', '-C', R, *a], capture_output=True, check=True).stdout if binary else subprocess.run(['git', '-C', R, *a], capture_output=True, text=True, encoding='utf-8', check=True).stdout
log = git('log', '--format=@%h %cs', '--diff-filter=M', '--name-only', '--', 'public/realm/**/*.jpg', 'public/realm/**/*.png', 'public/realm/**/*.webp')
sha = day = None
n = skip = 0
for line in log.splitlines():
    if line.startswith('@'):
        sha, day = line[1:].split()
        continue
    if not line.startswith('public/realm/'):
        continue
    rel = line[len('public/realm/'):]
    sub, name = os.path.split(rel)
    stem, ext = os.path.splitext(name)
    dst = os.path.join(OUT, sub, f'{stem}@{day.replace("-", "")}-{sha}{ext}')
    if os.path.exists(dst):
        skip += 1
        continue
    try:
        blob = git('show', f'{sha}^:{line}', binary=True)
    except subprocess.CalledProcessError:
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'wb') as f:
        f.write(blob)
    n += 1
print('꺼냄', n, '· 이미 있음', skip, '·', OUT)
