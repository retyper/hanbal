/**
 * 1차 각성한 장수의 비기 전신 — `public/realm/skill-body/aw1/<초상 id>.jpg` (세로 2:3 · 남색 민무늬 판)
 * 각성한 장수는 얼굴이 각성 초상(`../awaken-hd/<id>`)으로 바뀌므로, 컷인도 각성 옷의 전신으로 띄운다.
 * 없으면 각성 초상 그대로. 굽는 법: 챗지피티 줄(tools/release-jobs.mjs 의 SB1-) → 검수 → 이 목록.
 */
export const SKILL_BODY_AW1: ReadonlySet<string> = new Set<string>([
  'w-95-michuhol-haebi',
  'l-L2-soseono',
  'w-33-gammun-gamsil',
  'w-97-goguryeo-mir',
  'w-51-haseulla-dangung',
  'w-04-gaya-swordswoman',
  'g-64-jumong',
  'g-71-baekje-onjo',
  'w-83-gyeonji-beodeul',
  'l-L3-heo-hwangok',
])

const AW1 = '../awaken-hd/'
/** 컷인에 넘어온 얼굴 이름(bust 또는 ../awaken-hd/<id>)에 맞는 각성 전신 경로 · 없으면 null */
export const aw1SkillBody = (face: string): string | null =>
  face.startsWith(AW1) && SKILL_BODY_AW1.has(face.slice(AW1.length)) ? `skill-body/aw1/${face.slice(AW1.length)}.jpg` : null
