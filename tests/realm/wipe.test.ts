/**
 * 플레이 기록 지우기 — 무엇을 지우고 무엇을 남기나 (형 11-01: "데이터 초기화 할 때 남겨지는 게 너무 많던데")
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wipeable } from '../../src/ui/realm/wipe.ts'

test('판 밖 기록까지 다 지운다', () => {
  for (const k of ['hanbal.realm.v2', 'hanbal.realm.v2.prev', 'hanbal.realm.v2.other', 'hanbal.realm.games', 'hanbal.realm.slots', 'hanbal.realm.slot.123',
    'hanbal.realm.draft', 'hanbal.realm.dex', 'hanbal.realm.clan', 'hanbal.realm.unlock', 'hanbal.realm.drill', 'hanbal.realm.relics', 'hanbal.realm.retain',
    'hanbal.realm.bring', 'hanbal.realm.tut', 'hanbal.realm.seen', 'hanbal.realm.tabsOpen', 'hanbal.realm.howwin', 'hanbal.realm.tokTapped', 'hanbal.realm.scoutKeep',
    'hanbal.night.result', 'hanbal.night.practice']) assert.ok(wipeable(k), k)
})

test('설정·계정·활터는 남긴다', () => {
  for (const k of ['hanbal.realm.mute', 'hanbal.realm.layers', 'hanbal.realm.gfx', 'hanbal.realm.gfx.auto', 'hanbal.realm.warHelp', 'hanbal.realm.battle0',
    'hanbal.night.rotate', 'hanbal.auth', 'hanbal.device', 'hanbal.audio.v1', 'hanbal.save.v1', 'hanbal.installHide']) assert.ok(!wipeable(k), k)
})
