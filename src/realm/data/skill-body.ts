/**
 * 비기 컷인의 전신 그림이 있는 초상 id — `public/realm/skill-body/<초상 id>.jpg` (세로 2:3 · 남색 민무늬 판)
 * 있으면 컷인이 가슴 위 초상 대신 비기 쓰는 순간의 전신을 띄운다 (형 11-08 「비기나 기술 연출도 더 고민해봐 · 챗지피티 써도 되니까」)
 * 굽는 법: tools/sprite-kit (gpt-kit · heroes/gpt-1108.json 의 skill-*)
 */
export const SKILL_BODY: ReadonlySet<string> = new Set<string>([
  'g-64-jumong', // 11-08 주몽 · 큰 각궁 만작 · 빛나는 화살 (챗지피티 edu)
])
