// face-lock.mjs — 남은 Veo 문안에 「얼굴·그림체 고정」을 건다 (형 11-10: "너무 과하게 빵 터지는 캐릭터 · 얼굴이 원본과 다르게 다 조금씩 못생겨진다")
//   node tools/veo/face-lock.mjs [--dry]
// - 「세로 화면 꽉 · 얼굴 크게」 → 원본과 거의 같은 크기 (1.3배까지)
// - 움직임은 몸·머리카락·옷·소품·숨으로 (얼굴은 빼고)
// - 맨 끝에 얼굴·그림체 고정 절 (위 문장보다 앞선다)
// 아직 안 낸 job 만 · 원래 문안은 두고 <이름>-f.txt 를 새로 써서 promptPath·promptSha256 을 바꾼다
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const L = process.env.VEO_LEDGER ?? 'C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code'
const qp = `${L}/outputs/veo-production-queue.json`
const sp = `${L}/outputs/veo-production-state.json`
const dry = process.argv.includes('--dry')

export const FRAME_OLD = /Fill the 9:16 frame with an unbroken close portrait from ([^.]*?), face large\./
export const lockText = (p) => `FACE AND STYLE LOCK (most important; it overrides anything above): ${p.sub} face stays exactly the face in the image for the whole take: the same eyes, eyelids, nose, lips, jaw, face shape and proportions. ${p.Sub} expression stays true to the expression in the image: if ${p.sub2} is smiling or laughing broadly there, ${p.sub2} may keep laughing naturally and warmly the whole take, with the face still the same face; if not, at most the smile grows a little or ${p.sub2} gives one wink. Never a mocking, sneering or explosive cackle, never a grotesquely wide-open mouth, never squeezed-shut eyes, never a grimace or exaggerated, distorted face. Keep the soft painterly illustration style and smooth, flawless airbrushed skin of the image: no photoreal skin texture, no pores, no freckles or blush patches that are not in the image, no added wrinkles or lines. Do not zoom in on the face; the face is never redrawn larger or sharper than in the image. Any animal head, pelt or ornament on the costume stays exactly where it is in the image and never slides or pops into view.`

export const BODY_MOTION = 'BODY MOTION (the body is NOT locked, only the face): her chest moves clearly and naturally the whole take with soft, weighty physics: it lifts and settles with every breath, sways with every turn of her torso and bounces softly with every step, hop, laugh or arm swing, settling a beat after each move. Keep this natural movement visible all the way to the last frame; it does not fade out. The livelier her action and the fuller her figure, the more visible this soft bounce is. Clothing stays in place and fully covers her; tasteful, never exaggerated.'

export function lock(t) {
  const he = /\b(he|him|his)\b/.test(t.slice(0, 600)) && !/\b(she|her)\b/.test(t.slice(0, 600))
  const p = he ? { sub: 'His', Sub: 'His', sub2: 'he' } : { sub: 'Her', Sub: 'Her', sub2: 'she' }
  let out = t.replace(FRAME_OLD, (_m, span) => `Fill the 9:16 frame with an unbroken portrait from ${span}, at about the same scale as the image (zoom in no more than 1.3 times); the face stays about the size it is in the image.`)
  out = out.replace(/Make (her|him) lively, not a still pose\./, (m, w) => `${m} All the life is in ${w === 'him' ? 'his' : 'her'} body, hair, cloth, props and breath; the face stays the same face.`)
  // 11-10 형: "활발하거나 가슴 큰 장수들은 바스트 모핑 좀 더" — 여자만 · 얼굴 고정과 따로 (몸은 묶지 않는다)
  // 끝이 아니라 「Make her lively」 문단 끝(동작 문단 뒤)에 — 끝에 두니 약하게 먹혔다 (형 11-10: "점점 바스트 모핑 없어지는 느낌")
  if (!he) out = out.replace(/(Make her lively[^\n]*)/, (m) => m + ' ' + BODY_MOTION)
  out = out.replace(/\s*$/, '') + '\n\n' + lockText(p) + '\n'
  return out
}

if (process.argv[1]?.endsWith('face-lock.mjs')) {
  const q = JSON.parse(readFileSync(qp, 'utf8'))
  const s = JSON.parse(readFileSync(sp, 'utf8'))
  const jobs = q.jobs ?? q
  let n = 0
  for (const j of jobs) {
    if (s.attempts.some((a) => a.jobId === j.id)) continue
    const base = j.promptPath.replace(/-f\.txt$/, '.txt')
    if (!existsSync(base)) { console.log('원본 없음', j.id); continue }
    const src = readFileSync(base, 'utf8')
    if (/FACE AND STYLE LOCK/.test(src)) continue
    if (!FRAME_OLD.test(src)) { console.log('틀 문장 없음', j.id); continue }
    const dst = base.replace(/\.txt$/, '-f.txt')
    const out = lock(src)
    if (!dry) {
      writeFileSync(dst, out)
      j.promptPath = dst
      j.promptSha256 = createHash('sha256').update(readFileSync(dst)).digest('hex')
    }
    n++
  }
  if (!dry) writeFileSync(qp, JSON.stringify(q, null, 2) + '\n')
  console.log(dry ? '바꿀 것' : '바꿈', n)
}
