/**
 * 스팀 캡슐 규격표 — 꾸러미(tools/store-pack.mjs)와 합치는 도구(tools/store-capsule.mjs)가 같이 읽는다 (STEAM-STORE.md §4).
 *
 * 로고는 AI 가 그리지 않는다 (형 11-11: 로고는 확정 · 글자를 AI 에 맡기면 깨진다) — 문안은 「로고 자리를 비워라」 라고만 하고,
 * store-capsule.mjs 가 public/realm/logo/title.png (한국어) · title-en.png (영어) 를 그 자리에 얹는다.
 *
 * 자리는 완성 그림에 대한 비율이다: logo.w = 로고 폭 ÷ 그림 폭 · cx = 가운데 가로 위치 · bottom = 아래에서 띄우는 비율(또는 cy = 가운데 세로 위치).
 * focus = 받은 그림에서 어디를 중심으로 자르나 (0~1) · scrim = 로고가 읽히게 아래를 어둡게 덮는 띠 (from 높이부터 아래까지 alpha).
 */

/** 받은 그림 → 완성 그림 (key 가 파일 이름 `<key>.<ko|en>.png` 의 앞) */
export const ASSETS = [
  {
    key: 'header', w: 920, h: 430, bake: 'capsule_header.png', ratio: '3:2 가로 (1536×1024)',
    focus: [0.5, 0.4], logo: { w: 0.6, cx: 0.5, bottom: 0.04 }, scrim: { from: 0.58, alpha: 0.6 },
    note: '가로 3:2 로 받아 위아래를 잘라 2.14:1 로 만든다 (위쪽 40% 기준). 장수 둘 얼굴은 위 60% 안, 아래 40% 는 로고 자리.',
  },
  {
    key: 'small', w: 462, h: 174, bake: null, from: ['capsule_hero.png', 'capsule_main.png', 'capsule_header.png'],
    focus: [0.5, 0.5], logo: { w: 0.88, cx: 0.5, cy: 0.5 }, dim: 0.5,
    note: '따로 굽지 않는다 — 라이브러리 히어로(없으면 메인) 그림을 가운데에서 잘라 어둡게 깔고 로고만 크게. 작아서 로고만 읽히면 된다.',
  },
  {
    key: 'main', w: 1232, h: 706, bake: 'capsule_main.png', ratio: '3:2 가로 (1536×1024)',
    focus: [0.5, 0.42], logo: { w: 0.52, cx: 0.5, bottom: 0.05 }, scrim: { from: 0.66, alpha: 0.6 },
    fallback: 'public/realm/event/event-capture.jpg',
    note: '3:2 → 1.75:1 로 자른다. 굽지 않아도 된다 — 파일이 없으면 있는 그림 public/realm/event/event-capture.jpg (생포 장면) 로 만든다.',
  },
  {
    key: 'vertical', w: 748, h: 896, bake: 'capsule_vertical.png', ratio: '세로 2:3 (1024×1536)',
    focus: [0.5, 0.36], logo: { w: 0.82, cx: 0.5, bottom: 0.04 }, scrim: { from: 0.74, alpha: 0.65 },
    note: '세로 2:3 → 0.83:1 로 아래를 조금 자른다 (위쪽 36% 기준). 머리는 위, 몸은 78% 높이에서 어둠에 잠기고 아래 22% 는 로고 자리.',
  },
  {
    key: 'hero', w: 3840, h: 1240, bake: 'capsule_hero.png', ratio: '3:2 가로 (1536×1024) — 가운데 가로 띠만 쓴다',
    focus: [0.5, 0.5], logo: null,
    note: '글자 없는 그림 (스팀이 로고를 따로 얹는다). 3:2 로 받아 가운데 가로 띠(위아래 약 1/3 씩 버림)를 3.1:1 로 자르고 2.5배 키운다 — 그림이 다소 부드러워진다. 쓸 만한 AI 업스케일이 있으면 그 뒤에 넣어도 된다.',
  },
  {
    key: 'logo', w: 1280, h: 720, bake: null, transparent: true, logo: { w: 0.94, cx: 0.5, cy: 0.5 },
    note: '굽지 않는다 — 로고 파일만으로 투명 바탕에 가운데 놓는다.',
  },
]

export const LOGOS = { ko: 'public/realm/logo/title.png', en: 'public/realm/logo/title-en.png' }
