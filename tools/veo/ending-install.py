"""열전 승패 영상 넣기 (형이 OK 한 장수만).

  py -3 -I tools/veo/ending-install.py <그림 id> [<그림 id> ...]

D:/에셋창고/{victory,defeat}_<id>_flow-*.mp4 가운데 가장 새 판(이름에 -v2 가 있으면 그것)을
public/realm/raid/ending/<kind>_<id>.mp4 로 복사하고, 마지막 장면을 같은 이름 .jpg 포스터로 굽는다.
이미 있는 파일은 덮어쓰지 않는다(옛 판은 손으로 보관한 뒤 지울 것). 끝에 src/raid/ending-video.ts 의
clips 표에 넣을 줄을 찍는다.
"""
import glob
import os
import shutil
import sys

import cv2

STORE = 'D:/에셋창고'
OUT = 'public/realm/raid/ending'


def pick(kind: str, hero: str) -> str | None:
    found = sorted(glob.glob(f'{STORE}/{kind}_{hero}_flow-*.mp4'), key=os.path.getmtime)
    if not found:
        return None
    v2 = [f for f in found if '-v2' in f]
    return (v2 or found)[-1]


def poster(src: str, dst: str) -> None:
    cap = cv2.VideoCapture(src)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, n - 1))
    ok, frame = cap.read()
    if not ok:
        raise SystemExit(f'마지막 장면을 못 읽음: {src}')
    cv2.imwrite(dst, frame, [cv2.IMWRITE_JPEG_QUALITY, 88])


def main() -> None:
    heroes = sys.argv[1:]
    if not heroes:
        raise SystemExit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    lines = []
    for hero in heroes:
        got = {}
        for kind in ('victory', 'defeat'):
            src = pick(kind, hero)
            if src is None:
                print(f'없음: {kind} {hero}')
                continue
            if os.path.getsize(src) == 0:
                raise SystemExit(f'0바이트: {src}')
            name = f'{kind}_{hero}'
            mp4, jpg = f'{OUT}/{name}.mp4', f'{OUT}/{name}.jpg'
            if os.path.exists(mp4):
                print(f'이미 있음(그대로 둠): {mp4}')
            else:
                shutil.copyfile(src, mp4)
                poster(mp4, jpg)
                print(f'넣음: {mp4} ← {os.path.basename(src)}')
            got[kind] = name
        if got:
            parts = ','.join(f"{k}:'{v}'" for k, v in got.items())
            lines.append(f" '{hero}':{{{parts}}},")
    print('\n# src/raid/ending-video.ts clips 표에 넣을 줄')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
