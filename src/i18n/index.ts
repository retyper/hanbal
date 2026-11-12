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

/** 표 하나의 글 — 읽을 때마다 그때의 말로 (표를 모듈 첫머리에서 굳히지 않는다). 키는 `ns.k` */
export function lazyTable<K extends string>(ns: string, keys: readonly K[]): { readonly [P in K]: string } {
  const o = {} as { [P in K]: string }
  for (const k of keys) Object.defineProperty(o, k, { get: () => t(`${ns}.${k}` as Key), enumerable: true })
  return o
}

/** 키가 글자로 만들어질 때(`pro.when.${region}`) — 없는 키는 시험이 잡는다 */
export const tk = (key: string, vars?: Vars): string => t(key as Key, vars)

/** 자리표를 채우지 않은 글 그대로 — 그 글을 만드는 쪽이 제 방식으로 채울 때(회의 말의 {x|은}) */
export function tRaw(key: string): string {
  const k = key as Key
  return (lang() === 'en' ? en[k] : undefined) ?? ko[k]
}

type Shape = { readonly [k: string]: Shape | number }
type Tree<S> = { readonly [K in keyof S]: S[K] extends number ? readonly string[] : Tree<S[K]> }
/** 칸마다 글 몇 줄인 표 — 키 `ns.칸.칸.번호`. 읽을 때마다 지금 말로(자리표는 그대로 둔다) */
export function lazyTree<S extends Shape>(ns: string, shape: S): Tree<S> {
  const build = (path: string, sh: Shape): object => {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(sh)) {
      const p = `${path}.${k}`
      if (typeof v === 'number') {
        const arr: string[] = new Array<string>(v).fill('')
        for (let i = 0; i < v; i++) Object.defineProperty(arr, i, { get: () => tRaw(`${p}.${i}`), enumerable: true })
        o[k] = arr
      } else o[k] = build(p, v)
    }
    return o
  }
  return build(ns, shape) as Tree<S>
}

/** 말 몇 줄 — 키 `ns.0` `ns.1` … 읽을 때마다 지금 말로(자리표는 그대로 둔다) */
export function lazyList(ns: string, n: number): readonly string[] {
  const arr: string[] = new Array<string>(n).fill('')
  for (let i = 0; i < n; i++) Object.defineProperty(arr, i, { get: () => tRaw(`${ns}.${i}`), enumerable: true })
  return arr
}
