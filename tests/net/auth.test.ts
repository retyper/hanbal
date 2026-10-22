/**
 * 로그인의 순수한 부분 (src/net/auth.ts · docs/realm/SERVER.md §4)
 *  - 구글 주소에 id_token · nonce · state · 돌아올 주소가 실린다
 *  - 돌아온 주소 조각을 읽는다 (성공 · 거절 · 상관없는 조각)
 *  - JWT 몸(base64url · 한글)을 푼다
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { googleAuthUrl, jwtBody, readReturn } from '../../src/net/auth.ts'

describe('로그인 — 순수한 부분', () => {
  it('구글 주소', () => {
    const u = new URL(googleAuthUrl('https://retyper.github.io/hanbal/realm.html', 'n1', 's1', 'cid'))
    assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
    assert.equal(u.searchParams.get('response_type'), 'id_token')
    assert.equal(u.searchParams.get('redirect_uri'), 'https://retyper.github.io/hanbal/realm.html')
    assert.equal(u.searchParams.get('nonce'), 'n1')
    assert.equal(u.searchParams.get('state'), 's1')
    assert.equal(u.searchParams.get('client_id'), 'cid')
  })
  it('돌아온 조각', () => {
    assert.deepEqual(readReturn('#state=s1&id_token=a.b.c&authuser=0'), { idToken: 'a.b.c', state: 's1' })
    assert.deepEqual(readReturn('#error=access_denied&state=s1'), { error: 'access_denied' })
    assert.equal(readReturn(''), null)
    assert.equal(readReturn('#tab=hero'), null)
  })
  it('JWT 몸', () => {
    const body = { nonce: 'n1', name: '신궁' }
    const b64 = Buffer.from(JSON.stringify(body)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    assert.deepEqual(jwtBody(`x.${b64}.y`), body)
  })
})
