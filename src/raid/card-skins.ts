/**
 * Shared branch shells are loaded before 출전, alongside the combat art.
 * 51-1: 테 줄(border-image) 셋 + 늘리지 않고 겹치는 가운데 장식(위 crest · 아래 base · 칼 테 좌우 band) — card-skins.css · tools/sprite-kit/bake-branch-cards.py
 */
export const CARD_FRAME_PATHS = [
  'raid/ui-card-branch-a.webp',
  'raid/ui-card-branch-b.webp',
  'raid/ui-card-branch-c.webp',
  'raid/ui-card-branch-a-crest.webp',
  'raid/ui-card-branch-b-crest.webp',
  'raid/ui-card-branch-c-crest.webp',
  'raid/ui-card-branch-a-base.webp',
  'raid/ui-card-branch-b-base.webp',
  'raid/ui-card-branch-c-base.webp',
  'raid/ui-card-branch-a-band-l.webp',
  'raid/ui-card-branch-a-band-r.webp',
] as const
