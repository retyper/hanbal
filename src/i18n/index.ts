/**
 * t(key, vars) — 글 하나를 현재 말로. 영어에 없으면 한국어로 (빈 화면은 없다).
 * 자리표 {v} · {v|A/B}(한국어: 받침 조사 josa · 영어: 하나/여럿 {v|day|days}).
 * 어느 표에서 나온 글이냐에 따라 규칙이 갈린다. 영어 글이 비어 한국어가 나가도 조사는 제대로 붙는다.
 */
import { josa } from '../realm/data/prose.ts'
import { en } from './en.ts'
import { ko, type Key } from './ko.ts'
import { lang, type Lang } from './lang.ts'

export type { Key } from './ko.ts'
export { lang, setLang, forceLang, LANGS, LANG_KEY, pickLang, type Lang } from './lang.ts'

export type Vars = Readonly<Record<string, string | number>>

function fill(msg: string, vars: Vars | undefined, from: Lang): string {
  return msg.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (whole, name: string, rule: string | undefined) => {
    const v = vars?.[name]
    if (v === undefined) return whole
    if (rule === undefined) return String(v)
    if (from === 'ko') {
      const [a = '', b = ''] = rule.split('/')
      return josa(String(v), a, b)
    }
    const [one = '', many = one] = rule.split('|')
    return `${v} ${Number(v) === 1 ? one : many}`
  })
}

export function tIn(l: Lang, key: Key, vars?: Vars): string {
  const own = l === 'en' ? en[key] : undefined
  return fill(own ?? ko[key], vars, own !== undefined ? 'en' : 'ko')
}

export function t(key: Key, vars?: Vars): string {
  return tIn(lang(), key, vars)
}
