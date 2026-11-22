"""열전 넓은 맵의 낱개 장식 — 한 장에 6~8개가 그려진 시트(민무늬 #1c2129 바탕)를 낱개로 잘라 작은 webp 로 낸다.
(docs/realm/RAID-REWARD-MAP-20261122.md 4-2 「낱개 장식」 · Codex 80 · 놓는 자리는 화면 쪽이 씨앗으로 흩는다: src/raid/wide-view.ts)

  py -3 -I tools/sprite-kit/map-props.py --src D:/에셋창고/codex80 [--out public/realm/raid/props] [--only forest,snow]

법: ① 가장자리와 이어진 바탕만 투명으로 (walk8-intake.py key_out 과 같은 길 · TOL 8) · 불이 있는 것(GLOW)은 불빛·연기 번짐을 바탕에서 먼 만큼만 남긴다
    ② 가까운 조각(밑동의 풀·돌)은 한 덩이로 묶어 덩이마다 자른다 (위에서 아래 · 왼쪽에서 오른쪽 차례로 번호)
    ③ 화면 키(DISPLAY · 장수 94px 에 견줘 나무 2~3배 · 바위·덤불 0.5~1배)의 STORE 배로 줄여 <스테이지>-<번호>.webp
    ④ src/tune/params.ts 의 HAEBI_WIDE.view.props 에 붙일 줄을 찍는다 (화면 폭·키 · 여기 DISPLAY 를 고치면 그 줄도 같이 고친다).
"""
import argparse
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STAGES = ['forest', 'ford', 'palisade', 'snow', 'fortress']
TOL, SOFT, SPECK, JOIN, PAD, ROW = 8, 46, 400, 14, 4, 160
STORE, QUALITY = 1.25, 82
# 낱개마다 화면 키(px) — 번호 차례 (숲: 소나무 둘 · 참나무 · 큰 바위 · 작은 바위 · 덤불 · 쓰러진 통나무 · 돌탑)
DISPLAY = {
    'forest': [250, 260, 270, 90, 55, 70, 55, 85],
    'ford': [94, 76, 280, 80, 60, 52, 60],            # 갈대 둘 · 단풍나무 · 바위 · 징검돌 · 작은 바위 · 떠내려온 나무
    'palisade': [115, 110, 210, 120, 90, 120],        # 목책 토막 · 부서진 목책 · 망루 · 낟가리 · 수레 · 화톳불 대
    'snow': [250, 265, 240, 165, 80, 42, 52],         # 눈 소나무 · 전나무 · 겨울나무 · 장승 · 바위 · 눈 더미 · 작은 바위
    'fortress': [130, 80, 110, 165, 70, 95],          # 무너진 성벽 둘(0 · 2) · 모닥불 · 찢긴 깃발 · 돌무더기 · 탄 수레
}
# 불빛·연기가 번진 것 — 바탕과 SOFT 안으로 비슷한 화소는 그만큼 옅게 (안 그러면 불 둘레가 검은 덩어리로 남는다)
GLOW = {('palisade', 5), ('fortress', 1)}


def key_out(img):
    """가장자리에서 이어진 바탕만 투명으로. (rgb, alpha, 바탕과의 차)"""
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.abs(a - bg).max(axis=2)
    lab, _ = ndimage.label(dist <= TOL)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    alpha = np.where(np.isin(lab, edge[edge > 0]), 0, 255).astype(np.uint8)
    return a.astype(np.uint8), alpha, dist


def soften(alpha, dist):
    """바탕과 이어진 채 바탕과 비슷한(SOFT 안) 화소를 바탕에서 먼 만큼만 남긴다."""
    lab, _ = ndimage.label(dist <= SOFT)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    halo = np.isin(lab, edge[edge > 0])
    soft = np.clip((dist - TOL) / float(SOFT - TOL), 0, 1) * 255
    return np.where(halo, np.minimum(alpha, soft), alpha).astype(np.uint8)


def cut(stage, src, out):
    rgb, alpha, dist = key_out(Image.open(os.path.join(src, f'props_{stage}.png')))
    # 가까운 조각은 한 덩이로 (JOIN 화소 안)
    lab, _ = ndimage.label(ndimage.binary_dilation(alpha > 0, iterations=JOIN))
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        mask = (lab[sl] == i) & (alpha[sl] > 0)
        if mask.sum() < SPECK:
            continue
        ys, xs = np.nonzero(mask)
        boxes.append((sl[0].start + ys.min(), sl[1].start + xs.min(), sl[0].start + ys.max() + 1, sl[1].start + xs.max() + 1, i))
    # 줄(위에서 아래) → 칸(왼쪽에서 오른쪽): 밑동 높이가 ROW 화소 안이면 같은 줄
    boxes.sort(key=lambda b: b[2])
    rows, cur = [], []
    for b in boxes:
        if cur and b[2] - cur[0][2] > ROW:
            rows.append(cur); cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    ordered = [b for row in rows for b in sorted(row, key=lambda b: b[1])]
    if len(ordered) != len(DISPLAY[stage]):
        raise SystemExit(f'{stage}: 낱개 {len(ordered)}개인데 DISPLAY 는 {len(DISPLAY[stage])}개다 (시트가 바뀌었으면 DISPLAY 를 다시 적는다)')
    lines = []
    for k, (top, left, bottom, right, i) in enumerate(ordered):
        t, l, b, r = max(0, top - PAD), max(0, left - PAD), min(alpha.shape[0], bottom + PAD), min(alpha.shape[1], right + PAD)
        a = np.where(lab[t:b, l:r] == i, alpha[t:b, l:r], 0)   # 이웃 덩이가 상자에 걸쳐도 이 덩이만
        if (stage, k) in GLOW:
            a = soften(a, dist[t:b, l:r])
        im = Image.fromarray(np.dstack([rgb[t:b, l:r], a]))
        show_h = DISPLAY[stage][k]; show_w = round(show_h * im.width / im.height)
        h = min(im.height, round(show_h * STORE)); w = max(1, round(h * im.width / im.height))
        path = os.path.join(out, f'{stage}-{k}.webp')
        im.resize((w, h), Image.LANCZOS).save(path, 'WEBP', quality=QUALITY, method=6)
        print(f'{stage}-{k}: 화면 {show_w}x{show_h} · 파일 {w}x{h} · {os.path.getsize(path)} bytes')
        lines.append(f"[{show_w}, {show_h}]")
    return f"      {stage}: [{', '.join(lines)}],"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='D:/에셋창고/codex80')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public/realm/raid/props'))
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    table = [cut(stage, a.src, a.out) for stage in [s for s in a.only.split(',') if s] or STAGES]
    size = sum(os.path.getsize(os.path.join(a.out, f)) for f in os.listdir(a.out) if f.endswith('.webp'))
    print(f'폴더 합 {size} bytes · HAEBI_WIDE.view.props 에 붙일 [화면 폭, 화면 키]:')
    print('\n'.join(table))


if __name__ == '__main__':
    main()
