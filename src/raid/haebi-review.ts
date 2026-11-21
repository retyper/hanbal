import { createHaebi, stepHaebi, choose, raidRulesForStage, type HaebiRun } from './haebi.ts'
import { botChoice, botInput, type Route } from './haebi-replay.ts'
import { STAGE_ORDER, stageName, shopMax, SHOP } from './meta.ts'
const REVIEW_EXTRA = ['snow', 'fortress'] as const
export function installReview(root: HTMLElement, install: (s: HaebiRun) => void, mode: HaebiRun['mode'] = 'trial', kit: HaebiRun['kit'] = 'axe') {
  const panel = document.createElement('section'); panel.className = 'review-tools'
  panel.innerHTML = '<b>개발 검수 · 실제 입력 재생 (능력 주입 없음)</b><button data-until="0">첫 성장까지 재생</button><button data-until="60">초반 1분 재생</button><button data-until="300">중반 5분 재생</button><button data-until="600">10분 재생</button><button data-until="780">후반 13분 재생</button><button data-until="900">15분 재생</button><button data-until="1146">두목까지 재생</button><output></output>'
  if (mode === 'vanguard') panel.innerHTML = '<b>개발 검수 · 실제 입력 재생</b><button data-until="30">30초 재생</button><button data-until="90">90초 재생</button><button data-until="180">돌파 끝까지 재생</button><output></output>'
  root.append(panel)
  const route = document.createElement('select'); route.setAttribute('aria-label','검수 조합')
  route.innerHTML = '<option value="storm">도끼·바람</option><option value="fire">부적·번개</option>';panel.prepend(route)
  // 스테이지 고르기 (11-16 설원·산성 검수) — ?review&stage=snow 로도 · 검수는 DLC 로 닫힌 스테이지(설원·산성)도 고른다
  const stages = [...STAGE_ORDER, ...REVIEW_EXTRA.filter(id => !STAGE_ORDER.includes(id))]
  const stageSel = document.createElement('select'); stageSel.setAttribute('aria-label', '검수 스테이지')
  stageSel.innerHTML = stages.map(id => `<option value="${id}">${stageName(id)}</option>`).join(''); stageSel.value = new URLSearchParams(location.search).get('stage') ?? 'forest'
  if (mode === 'stage') panel.prepend(stageSel)
  // ?review&maxshop: 상점을 다 채운 장수로 (늦은 스테이지 두목까지 가 보기)
  const maxShop = new URLSearchParams(location.search).has('maxshop') ? Object.fromEntries(SHOP.map(x => [x.key, shopMax(x.key)])) : {}
  const close = document.createElement('button'); close.textContent = '검수 도구 닫기'; close.onclick = () => { panel.hidden = true }; panel.append(close)
  panel.querySelectorAll<HTMLButtonElement>('button[data-until]').forEach(b => b.onclick = async () => {
    panel.querySelectorAll<HTMLButtonElement>('button').forEach(x => x.disabled = true)
    // 스테이지 규칙은 실제 출전과 같게 (여울 이무기 · 목책 돌파 진짜 목책)
    const s = createHaebi(7, mode, kit, mode === 'stage' ? { stage: stageSel.value as typeof STAGE_ORDER[number], bonus: maxShop, simRules: raidRulesForStage(stageSel.value as typeof STAGE_ORDER[number]) } : {}), first = b.dataset.until === '0', until = Number(b.dataset.until) || 60, out = panel.querySelector('output')!, selectedRoute = route.value as Route
    while (s.t < until && s.state === 'playing' && !(first && s.offers.length)) {
      for (let i = 0; i < 1200 && s.t < until && s.state === 'playing' && !(first && s.offers.length); i++) { if (s.offers.length) choose(s, botChoice(s, selectedRoute)); else stepHaebi(s, botInput(s), 1 / 120) }
      out.textContent = ` ${Math.floor(s.t)}초 재생 중…`; await new Promise(resolve => setTimeout(resolve, 0))
      if (document.hidden) break
    }
    install(s); out.textContent = ` ${Math.floor(s.t)}초 · ${s.kills}격파 · ${s.state}`; panel.querySelectorAll<HTMLButtonElement>('button').forEach(x => x.disabled = false)
  })
}
