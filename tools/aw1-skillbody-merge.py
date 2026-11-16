"""1차 각성 비기 전신 검수 기록(tools/out/skillbody-aw1-review-*.json)의 통과 id 를 src/realm/data/skill-body-aw1.ts 목록에 더한다.
그림 파일(public/realm/skill-body/aw1/<id>.jpg)이 있는 id 만 · 이미 있는 id 는 그대로 · 다시: py -3 -I tools/aw1-skillbody-merge.py
"""
import glob, json, os, re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(root, 'src/realm/data/skill-body-aw1.ts')
src = open(p, encoding='utf-8').read()
m = re.search(r"new Set<string>\(\[\n(.*?)\n\]\)", src, re.S)
have = re.findall(r"'([^']+)'", m.group(1))
add = []
for f in sorted(glob.glob(os.path.join(root, 'tools/out/skillbody-aw1-review-*.json'))):
    for i in json.load(open(f, encoding='utf-8')).get('passed', []):
        if i not in have and i not in add and os.path.exists(os.path.join(root, f'public/realm/skill-body/aw1/{i}.jpg')):
            add.append(i)
body = '\n'.join(f"  '{i}'," for i in have + add)
open(p, 'w', encoding='utf-8', newline='\n').write(src[:m.start(1)] + body + src[m.end(1):])
print('had', len(have), 'added', len(add), 'total', len(have) + len(add))
