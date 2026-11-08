/**
 * 비기 컷인의 전신 그림이 있는 초상 id — `public/realm/skill-body/<초상 id>.jpg` (세로 2:3 · 남색 민무늬 판)
 * 있으면 컷인이 가슴 위 초상 대신 비기 쓰는 순간의 전신을 띄운다 (형 11-08 「비기나 기술 연출도 더 고민해봐 · 챗지피티 써도 되니까」)
 * 굽는 법: tools/sprite-kit (gpt-kit · heroes/gpt-1108.json 의 skill-*)
 */
export const SKILL_BODY: ReadonlySet<string> = new Set<string>([
  'g-64-jumong', // 11-08 주몽 · 큰 각궁 만작 · 빛나는 화살 (챗지피티 edu)
  'w-52-biryuna-songbi', // 송비 · 단풍이 휘도는 만작 (챗지피티 edu)
  'w-67-buyeo-haedal', // 해달 · 한쪽 무릎 꿇고 만작 · 달빛 화살 (챗지피티 edu)
  'l-L2-soseono', // 소서노 · 망토를 휘날리며 창 찌르기 (챗지피티 edu · 오른쪽을 보게 뒤집음)
  'l-L7-aryeong', // 알영 · 금빛 용이 감기는 창 찌르기 (챗지피티 edu)
  'g-71-baekje-onjo', // 온조 · 고리자루 칼로 비스듬히 크게 벤다 (챗지피티 edu)
  'g-74-saro-hyeokgeose', // 혁거세 · 흰빛이 흐르는 칼을 높이 치켜든 내려베기 (챗지피티 edu)
])
