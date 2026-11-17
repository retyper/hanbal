/**
 * 열전 소리 (형 11-15: 「피격 시 신음·기합 소리도 필요」). 판 상태를 읽기만 한다 — 프레임마다 지난 값과 견주어 바뀐 것만 낸다.
 * 형 11-15 밤 지적 뒤 다시 지음:
 *  - 곧바로 난다: 파일은 화면이 열릴 때 미리 받고, 첫 손길에 한꺼번에 풀어 둔다. 앞의 빈 소리는 풀 때 재서 건너뛴다.
 *  - 겹쳐 난다: 한 프레임에 여럿이 쓰러지면 그 수만큼(많아야 hitVoices) 한꺼번에, 높낮이만 조금씩 달리. 줄 세워 차례로 내지 않는다.
 *  - 무기마다 다르다: 활은 시위 놓는 소리, 칼·창·도끼는 휘두르는 소리(창은 높게, 도끼는 낮게).
 * 목소리(기합·신음·포효)는 형이 고른 것 (11-15 밤 · raid-sounds.html 판정 + 형이 받아 준 Pixabay 소리). 여자 비기 외침도 고른 여자 기합.
 * 능력 소리(불·바람·번개·땅)는 새로 생긴 투사체·이펙트를 세어 낸다. 원본: assets_src/realm/sfx-in/raid/pixabay
 * 돌팔매 묶음(11-16): 놓는 소리 · 돌 떨어지는 소리 · 비기·바위 때 팔매 돌리는 바람 소리 — 후보 셋 중 1번 (sfx/cand/sling_* · tools/out/sling-sound-candidates.json · 형이 고르면 SLING 만 바꾼다)
 * 소리 끔·크기는 본편 설정(hanbal.realm.mute · hanbal.realm.volume.*)을 따른다. 출처: public/realm/sfx/CREDITS.txt · public/sfx/CREDITS.txt
 */
import { HAEBI_SOUND as V } from '../tune/params.ts'
import type { HaebiRun, Kit } from './haebi.ts'

const BASE = import.meta.env.BASE_URL
const R = 'realm/sfx/', X = R + 'raid/', G = R + 'cand/raid/raid_'
/** 돌팔매 소리 — 후보 번호만 바꾸면 된다 (sfx/cand/sling_<자리>_<번호>.ogg · CC0 · 출처 CREDITS.txt) */
const SLING = { whirl: R + 'cand/sling_whirl_1.ogg', release: R + 'cand/sling_release_1.ogg', impact: R + 'cand/sling_impact_1.ogg' } as const
/** 주 무기 소리 — [파일들, 빠르기(=높낮이)] */
const WEAPON: Record<Kit, readonly [readonly string[], number]> = {
  bow: [['sfx/shot_longbow.ogg', 'sfx/shot_loose.ogg', 'sfx/shot_flecha.ogg'], 1],
  sword: [[X + 'swing_1.ogg', X + 'swing_3.ogg', X + 'swing_4.ogg'], 1.1],
  spear: [[X + 'swing_3.ogg', X + 'swing_4.ogg'], 1.3],
  axe: [[X + 'swing_1.ogg', X + 'swing_2.ogg'], .85],
  dagger: [[X + 'swing_3.ogg', X + 'swing_4.ogg'], 1.6],
  magic: [[R + 'tap_bell_g1.wav', R + 'tap_bell_g2.wav', R + 'tap_bell_g3.wav'], 1],
  sling: [[SLING.release], 1],
}
const FILES = {
  hit: [R + 'duel/rushHit_h1.mp3', R + 'duel/rushHit_h2.mp3', R + 'duel/rushHit_h3.mp3'],
  hurt: [R + 'duel/hurt_h.mp3'],
  arrows: [R + 'arrow_volley_c3.ogg'],
  level: [X + 'level.ogg'], pick: [R + 'ui_order_b.ogg'],
  elite: [R + 'war_cry_h1.mp3'], win: [R + 'horn_victory_a.ogg'], lose: [X + 'defeat.ogg'],
  fire: [X + 'fire_1.ogg', X + 'fire_2.ogg', X + 'fire_3.ogg'], wind: [X + 'wind_1.ogg', X + 'wind_2.ogg', X + 'wind_3.ogg'],
  bolt: [X + 'bolt_1.ogg', X + 'bolt_2.ogg'], light: [X + 'light_1.ogg', X + 'light_2.ogg'], earth: [X + 'earth_1.ogg', X + 'earth_2.ogg'], skillHit: [X + 'skill_hit.ogg'],
  whirl: [SLING.whirl], stone: [SLING.impact],
} as const
/** 목소리 — 자리마다 돌려 쓰는 묶음. 기합은 비기 때만 (평타엔 목소리 없음) */
const VOICE = {
  hurt_m: [G + 'hurt_m_g2.ogg'], hurt_f: [G + 'hurt_f_g1.ogg', X + 'hurt_f_1.ogg', X + 'hurt_f_2.ogg'],
  skill_m: [G + 'skill_m_g2.ogg'], skill_f: [X + 'kiai_f_2.ogg'],   // 형 11-16: 여자 비명 후보는 쓸데없음 · 고른 여자 기합으로
  die: [G + 'die_m_g3.ogg'], roar: [G + 'boss_roar_g1.ogg'],
} as const
type Voice = keyof typeof VOICE
/** 열전 전투 음악 — 형이 고른 곡 (11-15) */
const BGM = R + 'bgm_raid_d1.ogg'

const stored = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const muted = () => stored('hanbal.realm.mute') === '1' || new URLSearchParams(location.search).has('silent')
const volume = (channel: 'bgm' | 'sfx' | 'voice') => { const n = Number(stored('hanbal.realm.volume.' + channel) ?? 1); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1 }
type Clip = { buf: AudioBuffer; from: number }

export function raidSound(female: boolean, kit: Kit) {
  const ouch: Voice = female ? 'hurt_f' : 'hurt_m', shout: Voice = female ? 'skill_f' : 'skill_m'
  const mine = [...new Set([...WEAPON[kit][0], ...Object.values(FILES).flat(), ...[ouch, shout, 'die' as const, 'roar' as const].flatMap(k => VOICE[k])])]
  // 화면이 열리자마자 받아 둔다 (풀기는 손길 뒤 — 브라우저 규칙)
  const raw = new Map(mine.map(f => [f, fetch(BASE + f).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)] as const))
  const clips = new Map<string, Clip>(), last = new Map<string, number>()
  let ctx: AudioContext | null = null, music: HTMLAudioElement | null = null, n = 0, voices = 0, hitAt = -9
  /** 풀면서 앞의 빈 소리를 잰다 (mp3 는 앞에 0.03~0.06초가 비어 있다) */
  async function decode(c: AudioContext, file: string) {
    const bytes = await raw.get(file); if (!bytes) return
    try {
      const buf = await c.decodeAudioData(bytes.slice(0)), d = buf.getChannelData(0)
      let i = 0; while (i < d.length && Math.abs(d[i]!) < V.silence) i++
      clips.set(file, { buf, from: Math.min(i / buf.sampleRate, Math.max(0, buf.duration - .05)) })
    } catch { /* 못 푸는 파일은 조용히 */ }
  }
  /** 곧바로 낸다. gap 은 같은 자리 소리가 한 프레임 안에서 수십 번 겹쳐 터지지 않게 하는 아주 짧은 틈 */
  function play(slot: string, file: string, vol: number, gap = 0, rate = 1, capped = false) {
    if (!ctx || muted() || document.hidden || capped && voices >= V.maxVoices) return
    const clip = clips.get(file); if (!clip) return
    const now = ctx.currentTime; if (gap && now - (last.get(slot) ?? -9) < gap) return
    last.set(slot, now)
    const src = ctx.createBufferSource(), gain = ctx.createGain()
    gain.gain.value = vol; src.buffer = clip.buf; src.playbackRate.value = rate
    src.connect(gain).connect(ctx.destination); voices++; src.onended = () => { voices--; src.disconnect(); gain.disconnect() }; src.start(0, clip.from)
  }
  const any = (list: readonly string[]) => list[n++ % list.length]!
  const sfx = (slot: keyof typeof FILES, vol: number, gap = 0, rate = 1) => play(slot, any(FILES[slot]), vol * volume('sfx'), gap, rate, true)
  const say = (slot: Voice, vol: number, gap = 0) => play(slot, any(VOICE[slot]), vol * volume('voice'), gap)
  /** 이미 소리를 낸 투사체·이펙트 (새로 생긴 것만 낸다) */
  const seen = new WeakSet<object>()
  const prev = { attack: 0, hurt: 0, kills: 0, skillCd: 0, offers: 0, level: 1, wakes: 0, barrage: 0, elites: 0, boss: false, state: 'playing' as HaebiRun['state'], run: null as HaebiRun | null }
  return {
    /** 첫 손길(출전 단추)에서 부른다 — 브라우저는 손길 뒤에만 소리를 연다. 여기서 전부 풀어 둔다 */
    unlock() {
      if (ctx) { void ctx.resume().catch(() => undefined); return }
      try { ctx = new AudioContext({ latencyHint: 'interactive' }) } catch { return }
      for (const f of mine) void decode(ctx, f)
      music = new Audio(BASE + BGM); music.loop = true; music.preload = 'auto'
    },
    frame(s: HaebiRun, live: boolean, paused: boolean) {
      const on = live && !paused && s.state === 'playing' && !document.hidden && !muted()
      if (music) { music.volume = V.bgm * volume('bgm'); if (on && !s.offers.length) { if (music.paused) void music.play().catch(() => undefined) } else if (!music.paused) music.pause() }
      if (!live) { prev.run = null; return }
      // 판이 바뀐 것은 씨앗이 아니라 판 그 자체로 가린다 (씨앗이 NaN 이면 매 프레임 처음으로 돌아가 비기 외침·신음이 프레임마다 다시 났다 · 형 11-16)
      if (prev.run !== s) Object.assign(prev, { attack: 0, hurt: 0, kills: s.kills, skillCd: 0, offers: 0, level: s.level, wakes: s.wakes, barrage: 0, elites: 0, boss: s.boss, state: 'playing', run: s })
      const barrage = s.shots.reduce((k, b) => k + Number(b.kind === 'barrage'), 0), elites = s.enemies.reduce((k, e) => k + Number(e.kind === 'elite'), 0)
      if (s.attack > prev.attack) { play('weapon', any(WEAPON[kit][0]), V.swing * volume('sfx'), 0, WEAPON[kit][1] * (.95 + (n % 5) * .025), true) }  // 평타엔 목소리 없음 (형 11-16: 「기합은 스킬 쓸 때만」)
      if (s.hurt > prev.hurt) { sfx('hurt', V.hurt); say(ouch, V.groan, V.groanGap) }
      // 쓰러진 수만큼 한꺼번에 — 줄 세우지 않는다 (형: 「겹쳐서도 들려야 하는데 … 순서대로 들림」)
      // 묶음은 hitGap 초에 한 번 (늑대 떼에 프레임마다 넷씩 새로 틀어 동시에 수십 개 · 11-18) · 그 사이 쓰러진 것은 다음 묶음 수에 든다
      const fell = ctx && ctx.currentTime - hitAt >= V.hitGap ? Math.min(V.hitVoices, s.kills - prev.kills) : 0
      if (fell > 0) hitAt = ctx!.currentTime
      for (let i = 0; i < fell; i++) sfx('hit', V.hit * (1 - i * .18), 0, .86 + ((n + i * 3) % 7) * .05)
      if (fell > 0) say('die', V.die, V.dieGap)
      if (s.skillCd > prev.skillCd) { say(shout, V.skill); if (kit === 'sling') sfx('whirl', V.whirl) }
      for (const b of s.shots) if (!seen.has(b)) { seen.add(b); if (b.kind === 'ember') sfx('fire', V.magic, V.magicGap); else if (b.kind === 'gale' || b.kind === 'wave' || b.kind === 'knife') sfx('wind', V.magic, V.magicGap); else if (b.kind === 'soul') sfx('light', V.magic, V.magicGap); else if (b.kind === 'boulder') sfx('whirl', V.whirl * .7, V.magicGap, .8) }
      for (const e of s.fx) if (!seen.has(e)) { seen.add(e); if (e.kind === 'bolt') sfx('bolt', V.magic, V.magicGap); else if (e.kind === 'spike') sfx('earth', V.magic, V.magicGap); else if (e.kind === 'skill') sfx('skillHit', V.skillHit); else if (e.kind === 'thud' || e.kind === 'ult' && e.ult === 'sling') sfx('stone', V.stone, V.stoneGap, .9 + (n % 5) * .05) }
      // 판 안 각성(투지) — 외침 + 터짐 (RAID-LINK §1)
      if (s.wakes > prev.wakes) { say(shout, V.skill); sfx('skillHit', V.skillHit) }
      if (s.offers.length && !prev.offers) sfx('level', V.ui)
      if (!s.offers.length && prev.offers && s.level > prev.level) sfx('pick', V.ui)
      if (barrage < prev.barrage) sfx('arrows', V.arrows, .15)
      if (elites > prev.elites) sfx('elite', V.cry)
      if (s.boss && !prev.boss) say('roar', V.roar)
      if (s.state !== prev.state) sfx(s.state === 'won' ? 'win' : 'lose', V.end)
      Object.assign(prev, { attack: s.attack, hurt: s.hurt, kills: fell > 0 || !ctx || ctx.currentTime - hitAt >= V.hitGap ? s.kills : prev.kills, skillCd: s.skillCd, offers: s.offers.length, level: s.level, wakes: s.wakes, barrage, elites, boss: s.boss, state: s.state })
    },
  }
}
