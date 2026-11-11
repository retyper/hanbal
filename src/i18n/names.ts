/**
 * 이름표 표(요청·공작·건물·병종·물자·사이·진군)의 영어 — 한국어 표는 sim·저장·시험이 쓰는 그대로 두고
 * 화면만 tn(표, 키) 로 말에 맞는 이름을 받는다. 영어에 없으면 한국어가 나간다.
 * nameTable(표, 한국어 표) 는 옛 표와 똑같이 `TABLE[key]` 로 읽히는 얇은 덮개(화면 코드가 줄마다 안 바뀐다).
 */
import { lang } from './lang.ts'

export type NameNs = 'good' | 'build' | 'unit' | 'ask' | 'askKind' | 'plot' | 'approach' | 'rel'

const EN: Record<NameNs, Readonly<Record<string, string>>> = {
  good: { grain: 'Grain', iron: 'Iron', salt: 'Salt', wood: 'Timber', horse: 'Horses' },
  build: { palisade: 'Palisade', moat: 'Moat', earthwall: 'Earthen wall' },
  unit: { spear: 'Spearmen', bow: 'Archers', pike: 'Pikemen', shield: 'Shieldmen', horse: 'Cavalry', crossbow: 'Crossbowmen', boat: 'Navy' },
  ask: {
    truce: 'Truce', trade: 'Trade', tribute: 'Vassalage', alliance: 'Alliance', gift: 'Gift', joint: 'Joint attack',
    aid: 'Aid request', troops: 'Request troops', break: 'Break pact',
  },
  askKind: {
    truce: 'Truce', alliance: 'Alliance', trade: 'Trade', tribute: 'Become vassal', demand: 'Demand vassalage', joint: 'Joint attack', aid: 'Aid request',
  },
  plot: { rumor: 'Rumor', sow: 'Sow discord', bribe: 'Bribe', burn: 'Arson', spy: 'Spy', assassin: 'Assassination', rescue: 'Rescue' },
  approach: {
    road: 'Take the main road', night: 'Sneak by night', ford: 'Cross the ford in secret', ridge: 'Circle by the foothills', cliff: 'Climb the cliff',
  },
  rel: { war: 'War', neutral: 'Neutral', truce: 'Truce', ally: 'Alliance' },
}

/** 한국어 표를 받아 현재 말의 이름을 낸다 */
export function tnFrom(ns: NameNs, key: string, koName: string): string {
  return lang() === 'en' ? (EN[ns][key] ?? koName) : koName
}

export function nameTable<K extends string>(ns: NameNs, koTable: Readonly<Record<K, string>>): Readonly<Record<K, string>> {
  return new Proxy(koTable, {
    get: (target, key) => (typeof key === 'string' && key in target ? tnFrom(ns, key, target[key as K]) : Reflect.get(target, key)),
  })
}

export function enName(ns: NameNs, key: string): string | undefined { return EN[ns][key] }
