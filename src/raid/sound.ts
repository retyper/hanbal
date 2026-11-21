/**
 * 열전 소리 (형 11-15: 「피격 시 신음·기합 소리도 필요」). 판 상태를 읽기만 한다 — 프레임마다 지난 값과 견주어 바뀐 것만 낸다.
 * 형 11-15 밤 지적 뒤 다시 지음:
 *  - 곧바로 난다: 파일은 화면이 열릴 때 미리 받고, 첫 손길에 한꺼번에 풀어 둔다. 앞의 빈 소리는 풀 때 재서 건너뛴다.
 *  - 겹쳐 난다: 한 프레임에 여럿이 쓰러지면 그 수만큼(많아야 hitVoices) 한꺼번에, 높낮이만 조금씩 달리. 줄 세워 차례로 내지 않는다.
 *  - 무기마다 다르다: 활은 시위 놓는 소리, 칼·창·도끼는 휘두르는 소리(창은 높게, 도끼는 낮게).
 * 목소리(기합·신음·포효)는 형이 고른 것 (11-15 밤 · raid-sounds.html 판정 + 형이 받아 준 Pixabay 소리). 여자 비기 외침도 고른 여자 기합.
 * 능력 소리(불·바람·번개·땅)는 새로 생긴 투사체·이펙트를 세어 낸다. 원본: assets_src/realm/sfx-in/raid/pixabay
 * 돌팔매 묶음(11-16): 놓는 소리 · 돌 떨어지는 소리 · 비기·바위 때 팔매 돌리는 바람 소리 — 후보 셋 중 1번 (sfx/cand/sling_* · tools/out/sling-sound-candidates.json · 형이 고르면 SLING 만 바꾼다)
 * 적이 맞는 「둑」·기세 알 줍는 「뽁」(11-19 형: 다이센카 · 버블 소리)은 파일 없이 WebAudio 로 합성 — 피해 숫자(fx hit·death)와 사라진 알을 세어 한 프레임 한 묶음, 소리 수 한도(maxVoices) 안에서.
 * 기술 계단(11-19 형: 「기술 쓸 때 사운드·햅틱 · 크리티컬은 핑 · 초반 사운드 너무 심하면 안 됨 · 진각성은 더 임팩트」): 비기 < 각성 비기 < 진각성 비기 · 크리티컬 「핑」 — HAEBI_FEEL_TIERS · 진동은 frame 이 돌려주는 사건으로 화면이 낸다.
 * 소리 끔·크기는 본편 설정(hanbal.realm.mute · hanbal.realm.volume.*)을 따른다. 출처: public/realm/sfx/CREDITS.txt · public/sfx/CREDITS.txt
 */
import { HAEBI_SOUND as V, HAEBI_IMPACT as IMPACT, HAEBI_FEEL_TIERS as F, HAEBI_ULT as U, HAEBI_AWAKEN_ULT as AC, type FeelTier } from '../tune/params.ts'
import type { HaebiRun, Kit } from './haebi.ts'

/** 한 프레임에 일어난 손맛 사건 — 화면이 진동에 쓴다 (판은 읽기만) · cast 비기를 누름 · skill 비기가 터짐 · crit 크리티컬이 났음 */
export interface FeelEvents { cast: FeelTier | null; skill: FeelTier | null; crit: boolean }
const NONE: FeelEvents = { cast: null, skill: null, crit: false }
/** 기술 계단 크기 — 한 번 쓸 때 나는 합성·파일 소리 크기의 합 (기합 목소리는 계단마다 같아 뺀다 · 시험·들어 보기) */
export const tierLoud = (tier: FeelTier) => { const t = F.tiers[tier]; return t.cast + t.hit + t.boom + t.tail }
const RANK: Record<FeelTier, number> = { skill: 0, awake: 1, true: 2 }

const BASE: string = import.meta.env?.BASE_URL ?? '/'
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
/** 「둑」 모양 — 한 묶음 맞은 수 · 그 묶음 피해 합 · 흔들기(-1~1) → 길이(초) · 높이(Hz) · 크기 몫(0~). 피해가 클수록 조금 낮고 크게 */
export function thudShape(count: number, damage: number, wobble = 0) {
  const big = damage > 0 ? damage / (damage + V.thudRef) : 0, stack = 1 + Math.min(Math.max(0, count - 1), V.thudStackMax) * V.thudStack
  return { s: (V.thudMs[0] + (V.thudMs[1] - V.thudMs[0]) * big) / 1000, hz: (V.thudHz[0] + (V.thudHz[1] - V.thudHz[0]) * big) * (1 + wobble * V.thudJitter), vol: V.thud * stack * (.8 + .4 * big) }
}
/** 「뽁」 높이 — 연달아 먹은 칸(0~popSteps) */
export const popHz = (step: number) => V.popHz * V.popStep ** Math.min(V.popSteps, Math.max(0, step))

/**
 * trueWake: 이 장수가 진각성했나 (DLC · 화면이 판 밖 기록을 읽어 넘김) — 맞으면 판 안 각성 중 「진」 비기가 진각성 계단으로 난다
 * 기술 계단(HAEBI_FEEL_TIERS): 누름엔 기합 + 「탁」 · 터짐엔 skill_hit + 낮은 울림(각성부터) + 높은 종 꼬리(진각성) · 크리티컬은 맑은 「핑」(한 프레임 한 번 · crit.gap 틈)
 */
export function raidSound(female: boolean, kit: Kit, trueWake: () => boolean = () => false) {
  const ouch: Voice = female ? 'hurt_f' : 'hurt_m', shout: Voice = female ? 'skill_f' : 'skill_m'
  const mine = [...new Set([...WEAPON[kit][0], ...Object.values(FILES).flat(), ...[ouch, shout, 'die' as const, 'roar' as const].flatMap(k => VOICE[k])])]
  // 화면이 열리자마자 받아 둔다 (풀기는 손길 뒤 — 브라우저 규칙)
  const raw = new Map(mine.map(f => [f, fetch(BASE + f).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)] as const))
  const clips = new Map<string, Clip>(), last = new Map<string, number>()
  let ctx: AudioContext | null = null, music: HTMLAudioElement | null = null, n = 0, voices = 0, hitAt = -9
  /** 합성 소리 — 노이즈 한 조각(풀 때 한 번) · 「둑」 모아 둔 수·피해 · 「뽁」 연달음 */
  let noise: AudioBuffer | null = null, thudAt = -9, thudN = 0, thudD = 0, popAt = -9, popN = 0, championAt = -9
  /** 기술 소리 묶음 — 울림·종·skill_hit 이 겹쳐도 찢어지지 않게 한 번 눌러 준다 (없는 브라우저는 바로 내보냄) · 크리티컬 「핑」 마지막 때 · 다 풀렸나 */
  let bus: AudioNode | null = null, critAt = -9, ready: Promise<void> = Promise.resolve()
  /** 풀면서 앞의 빈 소리를 잰다 (mp3 는 앞에 0.03~0.06초가 비어 있다) */
  async function decode(c: AudioContext, file: string) {
    const bytes = await raw.get(file); if (!bytes) return
    try {
      const buf = await c.decodeAudioData(bytes.slice(0)), d = buf.getChannelData(0)
      let i = 0; while (i < d.length && Math.abs(d[i]!) < V.silence) i++
      clips.set(file, { buf, from: Math.min(i / buf.sampleRate, Math.max(0, buf.duration - .05)) })
    } catch { /* 못 푸는 파일은 조용히 */ }
  }
  let heroVoiceFile: string | null = null, voiceRevision = 0
  let pendingHeroVoice: { cast: NonNullable<HaebiRun['cast']>; file: string } | null = null
  /** An optional authored hero line. Preparation never plays or mutates the run. */
  async function setAwakeningVoice(url: string | null): Promise<boolean> {
    const rev = ++voiceRevision; heroVoiceFile = null; pendingHeroVoice = null
    if (!url) return false
    if (!raw.has(url)) raw.set(url, fetch(url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null))
    if (!await raw.get(url) || rev !== voiceRevision) return false
    if (ctx && !clips.has(url)) await decode(ctx, url)
    if (rev !== voiceRevision || ctx && !clips.has(url)) return false
    heroVoiceFile = url; return true
  }
  /** 곧바로 낸다. gap 은 같은 자리 소리가 한 프레임 안에서 수십 번 겹쳐 터지지 않게 하는 아주 짧은 틈 */
  function play(slot: string, file: string, vol: number, gap = 0, rate = 1, cap = 0, dest: AudioNode | null = null) {
    if (!ctx || muted() || document.hidden || cap && voices >= cap) return
    const clip = clips.get(file); if (!clip) return
    const now = ctx.currentTime; if (gap && now - (last.get(slot) ?? -9) < gap) return
    last.set(slot, now)
    const src = ctx.createBufferSource(), gain = ctx.createGain()
    gain.gain.value = vol; src.buffer = clip.buf; src.playbackRate.value = rate
    src.connect(gain).connect(dest ?? ctx.destination); voices++; src.onended = () => { voices--; src.disconnect(); gain.disconnect() }; src.start(0, clip.from)
  }
  /** 합성 소리를 낼 수 있나 — 꺼짐 · 가려진 탭 · 소리 수 한도면 못 낸다 */
  const room = (extra = 0) => !!ctx && !muted() && !document.hidden && voices < V.maxVoices + extra
  /** 짧은 소리 한 번 — 노드들을 이어 out 에 모으고, 끝나면 풀어 소리 수에서 뺀다 */
  function voice(c: AudioContext, len: number, vol: number, build: (out: GainNode, t: number, nodes: AudioNode[]) => AudioScheduledSourceNode[], dest: AudioNode | null = null) {
    const t = c.currentTime, out = c.createGain(), nodes: AudioNode[] = [out]
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vol, t + .004); out.gain.exponentialRampToValueAtTime(.001, t + len)
    out.connect(dest ?? c.destination)
    const srcs = build(out, t, nodes); voices++
    srcs[0]!.onended = () => { voices--; for (const x of [...srcs, ...nodes]) x.disconnect() }
    for (const x of srcs) { x.start(t); x.stop(t + len + .01) }
  }
  /** 「둑」 — 낮은 사인이 아래로 떨어지고 거친 노이즈가 한 번 (적이 맞음) */
  function thud(count: number, damage: number) {
    const c = ctx!, k = thudShape(count, damage, Math.random() * 2 - 1)
    voice(c, k.s, k.vol * volume('sfx'), (out, t, nodes) => {
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(k.hz, t); osc.frequency.exponentialRampToValueAtTime(k.hz * V.thudDrop, t + k.s); osc.connect(out)
      if (!noise) return [osc]
      const nz = c.createBufferSource(), lp = c.createBiquadFilter(), ng = c.createGain()
      nz.buffer = noise; lp.type = 'lowpass'; lp.frequency.value = V.thudCut; ng.gain.value = V.thudNoise; nz.connect(lp).connect(ng).connect(out)
      nodes.push(lp, ng)
      return [osc, nz]
    })
  }
  /** 「뽁」 — 위로 짧게 미끄러지는 사인 · 연달아 먹으면 한 칸씩 올라간다 (듀오링고 콤보) */
  function pop(count: number) {
    const c = ctx!, now = c.currentTime
    popN = now - popAt < V.popCombo ? Math.min(V.popSteps, popN + count) : count - 1; popAt = now
    const hz = popHz(popN), len = V.popMs / 1000
    voice(c, len, V.pop * volume('sfx'), (out, t) => {
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(hz, t); osc.frequency.exponentialRampToValueAtTime(hz * V.popRise, t + len * .8); osc.connect(out)
      return [osc]
    })
  }
  /** 비기를 누를 때 「탁」 — 아래로 꺾이는 세모파 + 띠 노이즈 한 번 (짧고 단단하게) */
  function castTick(tier: FeelTier) {
    const c = ctx!, len = F.castMs / 1000
    voice(c, len, F.tiers[tier].cast * volume('sfx'), (out, t, nodes) => {
      const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(F.castHz, t); osc.frequency.exponentialRampToValueAtTime(F.castHz / 2, t + len); osc.connect(out)
      if (!noise) return [osc]
      const nz = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain()
      nz.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = F.castCut; ng.gain.value = F.castNoise; nz.connect(bp).connect(ng).connect(out)
      nodes.push(bp, ng)
      return [osc, nz]
    }, bus)
  }
  /** 낮은 울림 — 아래로 가라앉는 사인 + 둘째 배음(폰 스피커는 아주 낮은 소리를 못 낸다) */
  function boom(tier: FeelTier) {
    const c = ctx!, k = F.tiers[tier], len = k.boomMs / 1000, [hi, lo] = F.boomHz
    voice(c, len, k.boom * volume('sfx'), (out, t, nodes) => {
      const a = c.createOscillator(), b = c.createOscillator(), over = c.createGain()
      a.type = b.type = 'sine'; over.gain.value = F.boomOver
      a.frequency.setValueAtTime(hi, t); a.frequency.exponentialRampToValueAtTime(lo, t + len)
      b.frequency.setValueAtTime(hi * 2, t); b.frequency.exponentialRampToValueAtTime(lo * 2, t + len)
      a.connect(out); b.connect(over).connect(out); nodes.push(over)
      return [a, b]
    }, bus)
  }
  /** 쇳소리 — 어긋난 배음 몇 개를 겹친 사인 · 높은 배음일수록 작고 빨리 사라진다 (진각성 종 꼬리 · 크리티컬 핑) */
  function chime(base: number, ratios: readonly number[], len: number, vol: number, dest: AudioNode | null) {
    const c = ctx!
    voice(c, len, vol, (out, t, nodes) => ratios.map((r, i) => {
      const o = c.createOscillator(), g = c.createGain(), w = 1 / (1 + i * F.chimeFall)
      o.type = 'sine'; o.frequency.setValueAtTime(base * r, t)
      g.gain.value = w; g.gain.exponentialRampToValueAtTime(.001, t + len / (1 + i))
      o.connect(g).connect(out); nodes.push(g)
      return o
    }), dest)
  }
  /** 비기가 터짐 — 계단마다 skill_hit 크기 · 울림 · 종 꼬리 (기술 소리는 maxVoices 위로 reserve 개까지) */
  function impact(tier: FeelTier) {
    const k = F.tiers[tier]
    play('skillHit', any(FILES.skillHit), k.hit * volume('sfx'), 0, 1, V.maxVoices + F.reserve, bus)
    if (k.boom > 0 && room(F.reserve)) boom(tier)
    if (k.tail > 0 && room(F.reserve)) chime(F.tailHz, F.tailRatios, k.tailMs / 1000, k.tail * volume('sfx'), bus)
  }
  /** 크리티컬 「핑」 */
  const ping = () => chime(F.crit.hz, F.pingRatios, F.crit.ms / 1000, F.crit.ping * volume('sfx'), null)
  /** 판 안 각성 중 「진」 비기 — 진각성한 장수면 진각성 계단 */
  const tierOf = (tru: boolean): FeelTier => tru ? trueWake() ? 'true' : 'awake' : 'skill'
  const any = (list: readonly string[]) => list[n++ % list.length]!
  const sfx = (slot: keyof typeof FILES, vol: number, gap = 0, rate = 1) => play(slot, any(FILES[slot]), vol * volume('sfx'), gap, rate, V.maxVoices)
  const say = (slot: Voice, vol: number, gap = 0) => play(slot, any(VOICE[slot]), vol * volume('voice'), gap)
  /** 이미 소리를 낸 투사체·이펙트 (새로 생긴 것만 낸다) */
  const seen = new WeakSet<object>()
  /** 지난 프레임에 판에 있던 기세 알 (사라진 수 = 주운 수 · 새 판이면 비운다) */
  let known = new WeakSet<object>(), dropsWere = 0, xpWas = 0
  const prev = { attack: 0, hurt: 0, kills: 0, skillCd: 0, offers: 0, level: 1, wakes: 0, barrage: 0, elites: 0, boss: false, state: 'playing' as HaebiRun['state'], run: null as HaebiRun | null }
  /** 첫 손길(출전 단추)에서 부른다 — 브라우저는 손길 뒤에만 소리를 연다. 여기서 전부 풀어 둔다 */
  function unlock() {
    if (ctx) { void ctx.resume().catch(() => undefined); return }
    try { ctx = new AudioContext({ latencyHint: 'interactive' }) } catch { return }
    const c = ctx
    ready = Promise.all([...raw.keys()].map(f => decode(c, f))).then(() => undefined)
    // 「둑」·「탁」의 거친 결 — 흰 노이즈 한 조각을 한 번 만들어 돌려 쓴다
    try { const len = Math.ceil(ctx.sampleRate * Math.max(V.thudMs[1], F.castMs) / 1000), d = (noise = ctx.createBuffer(1, len, ctx.sampleRate)).getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1 } catch { noise = null }
    try { const k = ctx.createDynamicsCompressor(); k.threshold.value = F.busDb; k.ratio.value = F.busRatio; k.connect(ctx.destination); bus = k } catch { bus = null }
    music = new Audio(BASE + BGM); music.loop = true; music.preload = 'auto'
  }
  return {
    unlock,
    setAwakeningVoice,
    /** 막 내림의 도장이 찍히는 박자. 음소거·음량은 기존 sfx 경로를 따른다. */
    ending: (won: boolean) => sfx(won ? 'win' : 'lose', V.end),
    /** 파일을 다 풀었나 (들어 보기 · 시험) */
    ready: () => ready,
    /**
     * 들어 보기 (public/realm/raid-sounds.html · 형이 귀로 판정) — 판과 같은 소리를 같은 차례로:
     * 계단이면 누름(기합 + 「탁」) → 시전 길이(HAEBI_ULT cast·trueCast ÷ slow) 뒤 터짐 · crit 이면 「핑」 하나. 터지는 순간을 돌려준다(ms)
     */
    async preview(kind: FeelTier | 'crit', onHit?: () => void): Promise<number> {
      unlock(); await ready
      if (!ctx) return 0
      if (kind === 'crit') { if (room()) ping(); onHit?.(); return 0 }
      say(shout, V.skill); if (room(F.reserve)) castTick(kind)
      const wait = (kind === 'skill' ? U.cast : U.trueCast) / U.slow * 1000
      setTimeout(() => { impact(kind); onHit?.() }, wait)
      return wait
    },
    frame(s: HaebiRun, live: boolean, paused: boolean, deferEnding = false): FeelEvents {
      // Keep an already-started line at the same sample while paused/hidden.
      // Terminal-state SFX use this context too, so state !== playing does not mute endings.
      if (ctx) {
        const audible = !paused && !document.hidden && !muted()
        if (!audible && ctx.state === 'running') void ctx.suspend().catch(() => undefined)
        else if (audible && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      }
      const on = live && !paused && s.state === 'playing' && !document.hidden && !muted()
      if (music) { music.volume = V.bgm * volume('bgm'); if (on && !s.offers.length) { if (music.paused) void music.play().catch(() => undefined) } else if (!music.paused) music.pause() }
      if (!live) { prev.run = null; pendingHeroVoice = null; return NONE }
      // 판이 바뀐 것은 씨앗이 아니라 판 그 자체로 가린다 (씨앗이 NaN 이면 매 프레임 처음으로 돌아가 비기 외침·신음이 프레임마다 다시 났다 · 형 11-16)
      if (prev.run !== s) { pendingHeroVoice = null; known = new WeakSet(); dropsWere = 0; xpWas = s.xp; thudN = thudD = 0; championAt = -9 }
      if (prev.run !== s) Object.assign(prev, { attack: 0, hurt: 0, kills: s.kills, skillCd: 0, offers: 0, level: s.level, wakes: s.wakes, barrage: 0, elites: 0, boss: s.boss, state: 'playing', run: s })
      const barrage = s.shots.reduce((k, b) => k + Number(b.kind === 'barrage'), 0), elites = s.enemies.reduce((k, e) => k + Number(e.kind === 'elite'), 0)
      if (s.attack > prev.attack) { play('weapon', any(WEAPON[kit][0]), V.swing * volume('sfx'), 0, WEAPON[kit][1] * (.95 + (n % 5) * .025), V.maxVoices) }  // 평타엔 목소리 없음 (형 11-16: 「기합은 스킬 쓸 때만」)
      if (s.hurt > prev.hurt) { sfx('hurt', V.hurt); say(ouch, V.groan, V.groanGap) }
      // 쓰러진 수만큼 한꺼번에 — 줄 세우지 않는다 (형: 「겹쳐서도 들려야 하는데 … 순서대로 들림」)
      // 묶음은 hitGap 초에 한 번 (늑대 떼에 프레임마다 넷씩 새로 틀어 동시에 수십 개 · 11-18) · 그 사이 쓰러진 것은 다음 묶음 수에 든다
      const fell = ctx && ctx.currentTime - hitAt >= V.hitGap ? Math.min(V.hitVoices, s.kills - prev.kills) : 0
      if (fell > 0) hitAt = ctx!.currentTime
      for (let i = 0; i < fell; i++) sfx('hit', V.hit * (1 - i * .18), 0, .86 + ((n + i * 3) % 7) * .05)
      if (fell > 0) say('die', V.die, V.dieGap)
      // 비기를 누름 — 기합(그대로) + 계단마다 「탁」
      let cast: FeelTier | null = null, skill: FeelTier | null = null, crits = 0
      if (s.skillCd > prev.skillCd) {
        cast = tierOf(s.cast?.kind === 'ult' && (s.cast.awakened ?? s.cast.tru))
        if (s.cast?.kind === 'ult' && s.cast.awakened && s.cast.seq !== undefined && heroVoiceFile && clips.has(heroVoiceFile)) pendingHeroVoice = { cast: s.cast, file: heroVoiceFile }
        else say(shout, V.skill)
        if (room(F.reserve)) castTick(cast); if (kit === 'sling') sfx('whirl', V.whirl)
      }
      if (pendingHeroVoice) {
        if (s.cast !== pendingHeroVoice.cast || s.state !== 'playing') pendingHeroVoice = null
        else if (on && 1 - s.cast.t / s.cast.total >= AC.enterFraction) { play('hero-awakening', pendingHeroVoice.file, V.skill * volume('voice')); pendingHeroVoice = null }
      }
      for (const b of s.shots) if (!seen.has(b)) { seen.add(b); if (b.kind === 'ember') sfx('fire', V.magic, V.magicGap); else if (b.kind === 'gale' || b.kind === 'wave' || b.kind === 'knife') sfx('wind', V.magic, V.magicGap); else if (b.kind === 'soul') sfx('light', V.magic, V.magicGap); else if (b.kind === 'boulder') sfx('whirl', V.whirl * .7, V.magicGap, .8) }
      let hitN = 0, hitD = 0
      for (const e of s.fx) if (!seen.has(e)) { seen.add(e); if (e.kind === 'hit' || e.kind === 'death') { hitN++; hitD += e.n ?? 0; if (e.crit) crits++ } if (e.championCue === 'roar') say('roar', V.roar);
        if (e.recoveryHit && ctx && ctx.currentTime - championAt >= IMPACT.cooldown) { championAt = ctx.currentTime; const t = tierOf(false); if (!skill || RANK[t] > RANK[skill]) skill = t }
        if (e.kind === 'bolt') sfx('bolt', V.magic, V.magicGap); else if (e.kind === 'spike') sfx('earth', V.magic, V.magicGap); else if (e.kind === 'skill') { const t = tierOf((e.awakened ?? e.tru) === true); if (!skill || RANK[t] > RANK[skill]) skill = t } else if (e.kind === 'thud' || e.kind === 'ult' && e.ult === 'sling') sfx('stone', V.stone, V.stoneGap, .9 + (n % 5) * .05) }
      // 비기가 터짐(한 프레임에 하나 · 가장 높은 계단) · 크리티컬 「핑」은 한 프레임 한 번 · crit.gap 틈 · 소리 수 한도면 버린다
      if (skill) impact(skill)
      if (crits > 0 && ctx && ctx.currentTime - critAt >= F.crit.gap && room()) { critAt = ctx.currentTime; ping() }
      // 적이 맞는 「둑」 — 이 프레임에 맞은 것을 한 묶음으로 (여럿이면 조금 크게) · thudGap 안이면 다음 묶음에 더한다 · 한도면 버린다
      thudN += hitN; thudD += hitD
      if (thudN > 0 && (!ctx || ctx.currentTime - thudAt >= V.thudGap)) { if (room()) { thudAt = ctx!.currentTime; thud(thudN, thudD / thudN) } thudN = thudD = 0 }
      // 기세 알 줍는 「뽁」 — 기세가 오른 프레임에 사라진 알 수만큼 (새 알은 다음 프레임부터 셈)
      let kept = 0; for (const d of s.drops) { if (known.has(d)) kept++; else known.add(d) }
      const picked = s.xp > xpWas + 1e-9 ? Math.max(1, dropsWere - kept) : 0
      dropsWere = s.drops.length; xpWas = s.xp
      if (picked > 0 && ctx && ctx.currentTime - popAt >= V.popGap && room()) pop(picked)
      // 판 안 각성(투지) — 외침 + 터짐 (RAID-LINK §1)
      if (s.wakes > prev.wakes) { say(shout, V.skill); sfx('skillHit', V.skillHit) }
      if (s.offers.length && !prev.offers) sfx('level', V.ui)
      if (!s.offers.length && prev.offers && s.level > prev.level) sfx('pick', V.ui)
      if (barrage < prev.barrage) sfx('arrows', V.arrows, .15)
      if (elites > prev.elites) sfx('elite', V.cry)
      if (s.boss && !prev.boss) say('roar', V.roar)
      if (!deferEnding && s.state !== prev.state) sfx(s.state === 'won' ? 'win' : 'lose', V.end)
      Object.assign(prev, { attack: s.attack, hurt: s.hurt, kills: fell > 0 || !ctx || ctx.currentTime - hitAt >= V.hitGap ? s.kills : prev.kills, skillCd: s.skillCd, offers: s.offers.length, level: s.level, wakes: s.wakes, barrage, elites, boss: s.boss, state: s.state })
      return cast || skill || crits ? { cast, skill, crit: crits > 0 } : NONE
    },
  }
}
