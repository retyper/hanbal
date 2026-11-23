# -*- coding: utf-8 -*-
"""움직임 띠 검사 — 눈대중 말고 숫자로 (11-23 형 「서 있는 것으로 프레임을 꽉 채우면 안 됨 · 그래서 지진 난 듯 흔들린다」 · 「하네스로 제대로」).
게임과 무관한 몸통이다(경로·장수 이름 없음). 같은 파일이 공용 설정 skills/sprite-anim-harness/scripts/ 에도 있다 — 고치면 둘 다.

  py -3 -I anim-check.py <띠.png> [x=<덧띠.png>] [cw=208 ch=160 root=104 foot=155 h=137] [묶음 …] [out=<검사판 앞머리>]
  덧띠가 본 띠와 다른 칸(넓은 동작 칸)이면 xcw= xch= xroot= xfoot= 를 준다 — 두 띠를 뿌리·발 줄에 맞춰 한 칸 규격으로 옮긴 뒤 잰다(잘림은 옮기기 전 제 칸에서 본다)
  묶음 = 이름:종류:칸   종류 = stand | walk | attack | misc   칸 = 0-3 또는 4,5,6 (덧띠의 칸은 본 띠 칸 수 뒤로 이어 센다)
  묶음을 안 주면 우리 띠 규격: stand:stand:0-3 walk:walk:4-11 attack:attack:12-17

재는 것 (÷ 키 = 몸 키에 견준 몫)
  잘림        칸 가장자리에 닿은 그림 → 불합격
  바닥 줄     발바닥 맨 아래 줄이 foot 에서 벗어난 화소 (서기·걷기 ±1)
  뿌리        서기의 두 발 가운데가 root 에서 벗어난 화소 (참고 · 키의 8% 넘으면 경고 — 발끝이 앞을 보면 두 발 가운데는 골반보다 앞이다)
  윗몸 흔들림 걷기 칸마다 윗몸(위 4~45%)을 첫 걷기 칸에 겹쳐 가장 잘 맞는 밀림 → 가로 폭 ÷ 키 (1.5% 안 합격 · 3% 넘으면 불합격)
  출렁임      같은 밀림의 세로 폭 ÷ 키 (참고: 0 이면 미끄러지듯, 4% 넘으면 튄다)
  서기↔걷기   서기 윗몸과 걷기 윗몸의 가로 어긋남 ÷ 키 (2% 안)
  보폭        걷기에서 두 발 띠의 가장 넓은 폭 ÷ 키 (참고)
  뻗음        공격에서 뿌리 앞으로 가장 멀리 나간 화소와 남은 앞 여백 (여백 6px 밑이면 경고)
  공격 끝     공격 마지막 칸의 윗몸이 서기로 돌아왔나 (6% 안)
  이어짐      misc 묶음(개성 동작처럼 서기에서 이어지는 것)의 첫 칸 윗몸이 서기와 같은 자리인가 (2% 안 · 4% 넘으면 불합격)
못 재는 것(확대해서 눈으로): 다리가 번갈아 나가는가 · 손이 무기를 쥐었는가 · 얼굴. 검사판(…-sheet.png · …-onion.png)을 본다.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw


def parse_cells(s):
    out = []
    for part in s.split(','):
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def register(a, r, reach=14):
    """a 를 r 에 겹칠 때 서로 다른 화소가 가장 적은 (dx, dy) — r 기준으로 a 가 얼마나 밀렸나"""
    best, at = None, (0, 0)
    for dy in range(-reach // 2, reach // 2 + 1):
        ry = np.roll(r, dy, axis=0)
        for dx in range(-reach, reach + 1):
            c = int((a ^ np.roll(ry, dx, axis=1)).sum())
            if best is None or c < best or (c == best and abs(dx) + abs(dy) < abs(at[0]) + abs(at[1])):
                best, at = c, (dx, dy)
    return at


def main(argv):
    opt = dict(cw=208, ch=160, root=104, foot=155, h=0, xcw=0, xch=0, xroot=0, xfoot=0)
    strip, extra, groups, out = None, None, [], None
    for a in argv:
        if a.startswith('x='):
            extra = a[2:]
        elif a.startswith('out='):
            out = a[4:]
        elif '=' in a and a.split('=')[0] in opt:
            opt[a.split('=')[0]] = int(a.split('=')[1])
        elif a.count(':') == 2 and not a.lower().endswith('.png'):
            n, k, c = a.split(':')
            groups.append((n, k, parse_cells(c)))
        else:
            strip = a
    cw, ch, root, foot = opt['cw'], opt['ch'], opt['root'], opt['foot']
    if not groups:
        groups = [('stand', 'stand', [0, 1, 2, 3]), ('walk', 'walk', list(range(4, 12))), ('attack', 'attack', list(range(12, 18)))]
    im = Image.open(strip).convert('RGBA')
    cells = [im.crop((i * cw, 0, (i + 1) * cw, ch)) for i in range(im.size[0] // cw)]
    clipped = set()   # 제 칸의 가장자리에 닿은 칸(옮기기 전에 본다)

    def touch(c):
        m = np.asarray(c)[..., 3] > 40
        return bool(m[0].any() or m[:, 0].any() or m[:, -1].any())
    clipped |= {i for i, c in enumerate(cells) if touch(c)}
    if extra:
        e = Image.open(extra).convert('RGBA')
        xcw, xch, xroot, xfoot = opt['xcw'] or cw, opt['xch'] or ch, opt['xroot'] or root, opt['xfoot'] or foot
        xc = [e.crop((i * xcw, 0, (i + 1) * xcw, xch)) for i in range(e.size[0] // xcw)]
        clipped |= {len(cells) + i for i, c in enumerate(xc) if touch(c)}
        if (xcw, xch, xroot, xfoot) != (cw, ch, root, foot):   # 두 규격을 뿌리·발 줄에 맞춰 한 칸으로
            R_, F_ = max(root, xroot), max(foot, xfoot)
            W_, H_ = R_ + max(cw - root, xcw - xroot), F_ + max(ch - foot, xch - xfoot)

            def move(c, r, f):
                o = Image.new('RGBA', (W_, H_), (0, 0, 0, 0))
                o.alpha_composite(c, (R_ - r, F_ - f))
                return o
            cells = [move(c, root, foot) for c in cells]
            xc = [move(c, xroot, xfoot) for c in xc]
            cw, ch, root, foot = W_, H_, R_, F_
        cells += xc
    al = [np.asarray(c)[..., 3] > 40 for c in cells]

    def box(m):
        ys, xs = np.nonzero(m)
        return (int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())) if len(ys) else None

    stand = next((g for g in groups if g[1] == 'stand'), None)
    H = opt['h'] or (box(al[stand[2][0]])[3] - box(al[stand[2][0]])[2] + 1 if stand else 137)
    res, fails, warns = [], [], []

    def say(tag, text, level=0):
        res.append(('불합격 ' if level == 2 else '경고   ' if level == 1 else '       ') + f'{tag:<10} {text}')
        if level == 2:
            fails.append(tag)
        if level == 1:
            warns.append(tag)

    def upper(m):
        b = box(m)
        u = np.zeros_like(m)
        y0, y1 = b[2] + int(H * .04), b[2] + int(H * .45)
        u[y0:y1] = m[y0:y1]
        return u

    def feet_band(m):
        b = box(m)
        xs = np.nonzero(m[b[3] - max(2, int(H * .06)) + 1:b[3] + 1])[1]
        return int(xs.min()), int(xs.max())

    print(f'{strip} · 칸 {len(cells)} · 키 {H} · 뿌리 x {root} · 바닥 줄 {foot}')
    stand_ref = None
    for name, kind, idx in groups:
        idx = [i for i in idx if i < len(cells) and al[i].any()]
        if not idx:
            say(name, '칸이 없다', 2)
            continue
        bx = [box(al[i]) for i in idx]
        clip = [i for i in idx if i in clipped]
        if clip:
            say(name, f'잘림: 칸 {clip} 이 가장자리에 닿았다', 2)
        if kind in ('stand', 'walk'):
            off = [b[3] - foot for b in bx]
            say(name, f'바닥 줄 {off}', 2 if max(abs(o) for o in off) > 1 else 0)
        if kind == 'stand':
            f0, f1 = feet_band(al[idx[0]])
            d = (f0 + f1) / 2 - root
            say(name, f'뿌리: 두 발 가운데 {(f0 + f1) / 2:.1f} (뿌리에서 {d:+.1f}px) · 앞 여백 {cw - 1 - bx[0][1]}px · 뒤 여백 {bx[0][0]}px', 1 if abs(d) / H > .08 else 0)   # 참고 값: 앞을 보는 발끝·걷기의 앞 기울임 때문에 두 발 가운데는 골반 자리와 다르다 — 판정은 서기↔걷기 윗몸으로
            stand_ref = upper(al[idx[0]])
            sh = [register(upper(al[i]), stand_ref) for i in idx]
            say(name, f'서기 칸끼리 윗몸 밀림 {sh}', 1 if max(abs(s[0]) for s in sh) > 1 else 0)
        if kind == 'walk':
            ref = upper(al[idx[0]])
            sh = [register(upper(al[i]), ref) for i in idx]
            dx = max(s[0] for s in sh) - min(s[0] for s in sh)
            dy = max(s[1] for s in sh) - min(s[1] for s in sh)
            say(name, f'윗몸 흔들림 가로 {dx}px = 키의 {dx / H * 100:.1f}% (칸마다 {[s[0] for s in sh]})', 2 if dx / H > .03 else 1 if dx / H > .015 else 0)
            say(name, f'출렁임 세로 {dy}px = 키의 {dy / H * 100:.1f}% (칸마다 {[s[1] for s in sh]})', 1 if dy / H > .04 else 0)
            if stand_ref is not None:
                s0 = register(ref, stand_ref)
                mid = s0[0] + (max(s[0] for s in sh) + min(s[0] for s in sh)) / 2
                say(name, f'서기↔걷기 윗몸 어긋남 {mid:+.1f}px = 키의 {abs(mid) / H * 100:.1f}%', 2 if abs(mid) / H > .04 else 1 if abs(mid) / H > .02 else 0)
            w = [feet_band(al[i]) for i in idx]
            say(name, f'보폭: 발 띠 폭 {min(b - a for a, b in w)}~{max(b - a for a, b in w)}px = 키의 {max(b - a for a, b in w) / H * 100:.0f}% 까지 · 칸 수 {len(idx)}')
        if kind == 'attack':
            fwd = max(b[1] for b in bx) - root
            back = root - min(b[0] for b in bx)
            room = cw - 1 - max(b[1] for b in bx)
            say(name, f'뻗음: 뿌리 앞으로 {fwd}px(키의 {fwd / H * 100:.0f}%) · 뒤로 {back}px · 남은 앞 여백 {room}px · 칸 수 {len(idx)}', 1 if room < 6 else 0)
            hs = [b[3] - b[2] + 1 for b in bx]
            say(name, f'칸마다 키 {hs} · 폭 {[b[1] - b[0] + 1 for b in bx]}')
            if stand_ref is not None:
                s = register(upper(al[idx[-1]]), stand_ref, reach=24)
                say(name, f'공격 끝 칸의 윗몸이 서기에서 {s[0]:+d}px = 키의 {abs(s[0]) / H * 100:.1f}%', 1 if abs(s[0]) / H > .06 else 0)
        if kind == 'misc':
            off = [b[3] - foot for b in bx]
            say(name, f'바닥 줄 {off} · 폭 {[b[1] - b[0] + 1 for b in bx]}', 1 if max(abs(o) for o in off) > 2 else 0)
            if stand_ref is not None:   # 서기에서 이어지는 동작(개성 동작 등): 첫 칸의 윗몸이 서기와 같은 자리여야 튀지 않는다
                s = register(upper(al[idx[0]]), stand_ref, reach=24)
                say(name, f'서기↔첫 칸 윗몸 어긋남 {s[0]:+d}px = 키의 {abs(s[0]) / H * 100:.1f}%', 2 if abs(s[0]) / H > .04 else 1 if abs(s[0]) / H > .02 else 0)
    print('\n'.join(res))
    print(f'판정: {"불합격 — " + ", ".join(sorted(set(fails))) if fails else "합격" + (" (경고: " + ", ".join(sorted(set(warns))) + ")" if warns else "")}')

    if out:
        Zm, BG = 3, (96, 104, 72)
        rows = [(n, [i for i in idx if i < len(cells)]) for n, _, idx in groups]
        wide = max(len(r[1]) for r in rows)
        sheet = Image.new('RGB', (wide * cw * Zm, len(rows) * ch * Zm), BG)
        onion = Image.new('RGB', (len(rows) * cw * Zm, ch * Zm), BG)
        d = ImageDraw.Draw(sheet)
        for r, (n, idx) in enumerate(rows):
            acc = np.zeros((ch, cw, 3), float) + np.array(BG)
            for k, i in enumerate(idx):
                c = cells[i]
                bg = Image.new('RGB', (cw, ch), BG)
                bg.paste(c, (0, 0), c)
                sheet.paste(bg.resize((cw * Zm, ch * Zm), Image.NEAREST), (k * cw * Zm, r * ch * Zm))
                x = k * cw * Zm + root * Zm
                d.line([(x, r * ch * Zm + foot * Zm - 18), (x, r * ch * Zm + foot * Zm + 12)], fill=(0, 255, 255), width=2)
                d.line([(k * cw * Zm, r * ch * Zm + foot * Zm), ((k + 1) * cw * Zm, r * ch * Zm + foot * Zm)], fill=(0, 200, 200), width=1)
                d.rectangle([k * cw * Zm, r * ch * Zm, (k + 1) * cw * Zm - 1, (r + 1) * ch * Zm - 1], outline=(70, 76, 54))
                a = np.asarray(c).astype(float)
                acc += (a[..., :3] - np.array(BG)) * (a[..., 3:] / 255) / len(idx)
            o = Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8)).resize((cw * Zm, ch * Zm), Image.NEAREST)
            onion.paste(o, (r * cw * Zm, 0))
        sheet.save(out + '-sheet.png')
        onion.save(out + '-onion.png')
        print('검사판:', out + '-sheet.png', out + '-onion.png')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
