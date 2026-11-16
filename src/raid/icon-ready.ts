// tools/raid-icons-h56.py 가 쓴다 · 손으로 고치지 말 것. public/realm/raid/<이름>.png 로 구워 둔 전용 아이콘(H56~H61).
// power-ui.ts 는 여기 있는 것만 전용 그림으로 쓰고, 없는 것은 빌린 그림(빛깔)로 둔다.
export const ICON_READY: ReadonlySet<string> = new Set([
  'power-sling',
  'power-skip',
  'boulder',
  'daze',
  'stonefall',
  'cap-sword-a',
  'cap-sword-b',
  'cap-dagger-a',
  'cap-dagger-b',
  'cap-magic-a',
  'cap-magic-b',
  'cap-sling-a',
  'cap-sling-b',
  'node-counter',
  'node-hone',
  'node-drill',
])
