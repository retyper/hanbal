"""
제미나이가 고친 마을 바탕(public/realm/town/ground-*.png)의 오른쪽 아래 흰 별(✦ 워터마크)을 지운다.
별은 1376×768 로 키운 그림에서 늘 (1256, 646) 언저리 · 둘레보다 밝은 덩어리만 골라 OpenCV 인페인트로 메운다 (옆 무늬를 통째로 베끼면 배·풀이 끌려 들어왔다).

  py -3 -X utf8 tools/unstar-ground.py <png…>
"""
import sys
import cv2
import numpy as np

CX, CY, R = 1256, 646, 46

for p in sys.argv[1:]:
    im = cv2.imread(p, cv2.IMREAD_COLOR)
    x0, y0, x1, y1 = CX - R, CY - R, CX + R, CY + R
    box = im[y0:y1, x0:x1]
    hsv = cv2.cvtColor(box, cv2.COLOR_BGR2HSV)
    v = hsv[:, :, 2].astype(np.int16)
    s = hsv[:, :, 1].astype(np.int16)
    bg_v = cv2.medianBlur(hsv[:, :, 2], 41).astype(np.int16)
    bg_s = cv2.medianBlur(hsv[:, :, 1], 41).astype(np.int16)
    # 별 = 둘레보다 밝고 빛깔이 빠진 곳
    m = ((v - bg_v > 10) & (bg_s - s > 8)).astype(np.uint8) * 255
    yy, xx = np.mgrid[0:2 * R, 0:2 * R]
    m[(xx - R) ** 2 + (yy - R) ** 2 > (R - 6) ** 2] = 0
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    full = np.zeros(im.shape[:2], np.uint8)
    full[y0:y1, x0:x1] = m
    out = cv2.inpaint(im, full, 9, cv2.INPAINT_TELEA)
    cv2.imwrite(p, out)
    print(p, int(m.sum() / 255), 'px')
