// 열전 목소리 고르기 (11-24 형 「꼬리 잘릴 때 남자 비명 · 여자 보스 웃음·피격」) — 순수 함수 + 파일 목록이 꺼져 있을 때 소리·요청이 없음
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAEBI_BOSS_VOICE as BV } from '../src/tune/params.ts'
import { newVoiceMemory, voiceCalls, type VoiceBoss, type VoiceFx } from '../src/raid/boss-voice.ts'

const gum = (state = 'body', hp = 1000): VoiceBoss => ({ kind: 'gumiho', state, hp, max: 1000 })
const run = (m: ReturnType<typeof newVoiceMemory>, o: { fx?: VoiceFx[]; fell?: number; boss?: VoiceBoss | null; start?: boolean; now?: number; on?: boolean }) =>
  voiceCalls(m, { fx: o.fx ?? [], fell: o.fell ?? 0, boss: o.boss === undefined ? null : o.boss, bossStart: o.start ?? false, now: o.now ?? 0, filesOn: o.on ?? true })
const tailBreak: VoiceFx[] = [{ kind: 'ring', championCue: 'roar', partBreak: true }]
const death = (mob: string): VoiceFx => ({ kind: 'death', mob })

test('구미호 부위(꼬리)가 끊긴 틀 — 남자 die 없음 · 포효 없음 · boss_f_scream 하나', () => {
  const m = newVoiceMemory()
  assert.deepEqual(run(m, { fx: tailBreak, boss: gum() }), ['boss_f_scream'])
  assert.deepEqual(run(newVoiceMemory(), { fx: tailBreak, boss: gum(), on: false }), [])   // 파일이 없으면 조용히 (짐승 포효를 내지 않는다)
})
test('사람 적이 쓰러진 틀 — die · 짐승·보스가 쓰러진 틀 — die 없음', () => {
  assert.deepEqual(run(newVoiceMemory(), { fx: [death('grunt')], fell: 1 }), ['die'])
  for (const mob of ['dog', 'tiger', 'bear']) assert.deepEqual(run(newVoiceMemory(), { fx: [death(mob)], fell: 1 }), [])
  assert.deepEqual(run(newVoiceMemory(), { fx: [death('boss')], fell: 1, boss: null }), [])
  // 묶음에 막혀 한 틀 늦게 세어져도(fell 이 나중) 사람이 쓰러졌다는 것은 남는다
  const m = newVoiceMemory(); run(m, { fx: [death('grunt')] })
  assert.deepEqual(run(m, { fell: 1 }), ['die'])
})
test('구미호가 공격 예고(tell)에 들어간 틀 — boss_f_laugh 하나 · 틈 안에는 다시 없음 · 틈이 지나면 다시', () => {
  const m = newVoiceMemory()
  run(m, { boss: gum('body'), now: 100 })
  assert.deepEqual(run(m, { boss: gum('tell'), now: 101 }), ['boss_f_laugh'])
  run(m, { boss: gum('strike'), now: 101.2 })
  assert.deepEqual(run(m, { boss: gum('tell'), now: 101.5 }), [])
  run(m, { boss: gum('strike'), now: 105 })
  assert.deepEqual(run(m, { boss: gum('tell'), now: 101 + BV.laughGap + .1 }), ['boss_f_laugh'])
})
test('등장·막 전환 — 구미호는 웃음(파일이 없으면 포효) · 이무기는 제 포효·제 아픈 소리 (11-24 형이 고른 소리)', () => {
  assert.deepEqual(run(newVoiceMemory(), { boss: gum(), start: true }), ['boss_f_laugh'])
  assert.deepEqual(run(newVoiceMemory(), { boss: gum(), start: true, on: false }), ['roar'])
  assert.deepEqual(run(newVoiceMemory(), { boss: gum('roar'), fx: [{ kind: 'ring', championCue: 'roar' }] }), ['boss_f_laugh'])
  const imugi: VoiceBoss = { kind: 'imugi', state: 'tell', hp: 1000, max: 1000 }
  assert.deepEqual(run(newVoiceMemory(), { boss: imugi, start: true }), ['beast_roar'])   // 등장과 겹친 공격 예고는 포효만
  assert.deepEqual(run(newVoiceMemory(), { boss: imugi, fx: tailBreak }), ['beast_hurt', 'beast_attack'])   // 부위가 끊긴 틀 + 처음 본 공격 예고
})
test('불의 무녀 — 등장은 포효 자리(방울) 그대로 · 부위가 끊기면 여자 비명', () => {
  const sh: VoiceBoss = { kind: 'shaman', state: 'body', hp: 1000, max: 1000 }
  assert.deepEqual(run(newVoiceMemory(), { boss: sh, start: true }), ['roar'])
  assert.deepEqual(run(newVoiceMemory(), { boss: sh, fx: tailBreak }), ['boss_f_scream'])
  assert.deepEqual(run(newVoiceMemory(), { boss: sh, fx: tailBreak, on: false }), ['roar'])
})
test('피격 — 여자 보스는 맞을 때 신음하지 않는다 (11-24 형) · 구미호가 쓰러지면 비명', () => {
  const m = newVoiceMemory(), hp = (n: number) => gum('body', n)
  assert.equal(BV.who.gumiho!.hurt, false)
  run(m, { boss: hp(1000), now: 10 })
  assert.deepEqual(run(m, { boss: hp(1000 - 1000 * BV.hurtShare * 1.1), now: 10.2 }), [])   // 문턱을 넘겨 깎여도 조용하다
  assert.deepEqual(run(m, { boss: hp(400), now: 10.3 + BV.hurtGap }), [])
  assert.deepEqual(run(m, { fx: [death('boss')], fell: 1, boss: null, now: 99 }), ['boss_f_scream'])
})
test('파일 목록이 꺼져 있으면 여자 보스 목소리는 아무것도 안 낸다 (11-24 형이 목소리를 골라 params 는 켜져 있다)', () => {
  assert.equal(BV.on, true)
  const m = newVoiceMemory()
  run(m, { boss: gum('body', 1000), on: false, now: 0 })
  assert.deepEqual(run(m, { boss: gum('tell', 500), on: false, now: 50 }), [])
})

// 짐승·괴물 보스의 고유 소리 (11-24 형 「비인간형 보스는 소리를 찾아야지」 · 고른 것: 대호·이무기는 포효·공격·끊길 때 · 불가사리는 포효만)
const beast = (kind: string, state = 'body', hp = 1000): VoiceBoss => ({ kind, state, hp, max: 1000 })
test('백두 대호 — 등장은 제 포효 · 공격 예고에 들어가면 제 공격 소리(틈 안에는 다시 없음) · 부위가 끊기면 제 아픈 소리', () => {
  const m = newVoiceMemory()
  assert.deepEqual(run(m, { boss: beast('tiger'), start: true, now: 0 }), ['beast_roar'])
  assert.deepEqual(run(m, { boss: beast('tiger', 'tell'), now: 5 }), ['beast_attack'])
  run(m, { boss: beast('tiger', 'strike'), now: 5.5 })
  assert.deepEqual(run(m, { boss: beast('tiger', 'tell'), now: 6 }), [])   // attackGap 안
  run(m, { boss: beast('tiger', 'body'), now: 7 })
  assert.deepEqual(run(m, { boss: beast('tiger', 'tell'), now: 5 + 9 }), ['beast_attack'])
  assert.deepEqual(run(m, { fx: tailBreak, boss: beast('tiger'), now: 30 }), ['beast_hurt'])
})
test('불가사리 — 포효만 제 소리 · 공격 예고엔 소리 없음 · 부위가 끊기면 (제 아픈 소리가 없어) 제 포효', () => {
  const m = newVoiceMemory()
  assert.deepEqual(run(m, { boss: beast('bulgasari'), start: true, now: 0 }), ['beast_roar'])
  assert.deepEqual(run(m, { boss: beast('bulgasari', 'tell'), now: 5 }), [])
  assert.deepEqual(run(m, { fx: tailBreak, boss: beast('bulgasari'), now: 30 }), ['beast_roar'])
})
test('표에 없는 보스·구미호는 짐승 소리를 내지 않는다', () => {
  assert.deepEqual(run(newVoiceMemory(), { boss: beast('gumiho', 'body'), start: true, now: 0 }), ['boss_f_laugh'])
  assert.deepEqual(run(newVoiceMemory(), { boss: beast('shaman', 'body'), start: true, now: 0 }), ['roar'])
})
