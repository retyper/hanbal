/**
 * 튜닝 상수 단일 출처 (ARCHITECTURE A2)
 *
 * 이 게임의 손맛은 전부 이 파일 안에 있다.
 * 각 값은 메타데이터(범위/단위/설명)를 함께 들고 있고, 라이브 튜닝 콘솔(tune/console.ts)이
 * 이 스펙을 읽어 슬라이더를 자동 생성한다. 새 노브를 추가하면 콘솔 UI가 알아서 늘어난다.
 *
 * 워크플로: 게임을 켜고 ` 키 → 슬라이더로 손맛을 찾음 → [복사] → 이 파일에 붙여넣기 → 커밋.
 *
 * 단위 규약: 거리 m, 시간 s, 각도 rad, 질량 kg. 화면 픽셀 단위는 여기 들어오지 않는다.
 */

/** 막기 판만 쓰는 CSS px 가독성. 살 크기·탄도·당김 반경은 바꾸지 않는다. */
export const PIRATE_VISIBILITY = {
  arrowRim: 0.8, arrowShadowX: 0.8, arrowShadowY: 1.2,
  arrowInk: '#20170f', arrowShadowAlpha: 0.65,
  pullEdge: 1.2, pullShadowX: 0.8, pullShadowY: 1.2,
  pullInk: 'rgba(26,18,12,0.9)', pullShadow: 'rgba(16,10,6,0.65)',
  dotEdge: 1.1, dotEdgeAlpha: 0.9,
} as const

/** Awakened Haebi's optional campaign breakthrough. */
export const HAEBI_VANGUARD = {
  duration: 180, captainAt: [15, 65, 115], captainHp: [7000, 10000, 14000],
  startLevel: 9, spawnEarly: 17, spawnLate: 29, mobHp: 100,
  frontPower: [1, 1.35, 1.55, 1.75], frontLoss: [0, .04, .08, .12],
} as const

/** 열전 소리 크기(0~1)와 같은 소리가 겹치지 않게 두는 틈(초) — src/raid/sound.ts (형 11-15: 기합·신음) */
export const HAEBI_SOUND = {
  bgm: .2, swing: .3, hurt: .6, buy: .7, groan: .7, groanGap: .5,
  hit: .24, hitVoices: 4, die: .3, dieGap: 1.2, skill: .85, skillHit: .6, magic: .28, magicGap: .2, ui: .5, arrows: .4, cry: .55, roar: .8, end: .7, silence: .012,
  /** 돌팔매 묶음: 팔매 돌리는 바람(비기·바위) · 돌 떨어짐(같은 프레임에 여럿이면 stoneGap 초 틈) */
  whirl: .55, stone: .32, stoneGap: .05,
  /**
   * 소리 수 한도 (11-18 형 플립7 늑대 떼 렉) — 쓰러뜨림 소리를 프레임마다 hitVoices 개씩 새로 틀어 동시에 수십 개가 울렸다(헤드리스 셈: 초당 23개 · 동시 28 · 프레임 약 20% 깎임).
   * 쓰러뜨림 소리 묶음은 hitGap 초에 한 번 · 지금 울리는 소리가 maxVoices 개면 효과음은 건너뛴다(목소리·외침은 그대로).
   */
  hitGap: .07, maxVoices: 8,
  /**
   * 적이 맞는 「둑」 (11-19 형: 「다이센카처럼 적 데미지 입으면 둑 소리」) — 노이즈 한 번 + 낮은 사인, 판의 피해 숫자(fx hit·death)를 세어 낸다.
   * thudGap 초에 한 묶음(그 사이 맞은 것은 다음 묶음에 더함) · thudMs 길이(작은 피해→큰 피해) · thudHz 높이(작은→큰, 큰 피해가 낮다) · thudDrop 끝 높이 몫
   * thudRef 피해가 이만하면 「큰」 쪽 절반 · thudStack 한 묶음에 하나 더 맞을 때 커지는 몫(thudStackMax 개까지) · thudJitter 높이를 흔드는 몫(귀가 안 지침) · thudNoise 노이즈 몫 · thudCut 노이즈 저역 필터 Hz
   */
  /** 11-22 형이 고른 타격 소리(sfx/raid/hit_n1·n2 · 치명 hit_c1~3 · CC BY) — 「둑」·「핑」 위에 얹는다 · hitClip 일반 크기 · critClip 치명 크기 · clipRate 피해가 클수록 낮게(「둑」 높이 몫을 이만큼 따라감) */
  hitClip: .5, critClip: .6, clipRate: .5,
  /** 형이 더 고른 것 — down 적 쓰러짐 신음(downGap 초에 하나만 · 떼로 죽어도 하나) · fall 상자가 땅에 떨어짐 · popClip 기세 알 「뽁」에 얹는 소리(연달아 먹으면 popRate 몫만큼 높아짐) */
  down: .3, downGap: .45, fall: .55, popClip: .45, popRate: .5,
  thud: .32, thudGap: .05, thudMs: [30, 60], thudHz: [150, 85], thudDrop: .55, thudRef: 60, thudStack: .12, thudStackMax: 5, thudJitter: .06, thudNoise: .55, thudCut: 900,
  /** 보스 「쿵」(형 11-23 「보스가 쿵 하면 쿵 소리」 · src/raid/slam-watch.ts): 아주 낮은 사인이 더 낮게 떨어짐 + 땅 노이즈 + 땅 소리 낮게 얹기 · 장수급 적 내려찍기는 slamSmall 몫 */
  /** 치명타 마무리(홈런) 소리: 「둑」 짧고 굵은 저음(finishThud · Hz 떨어짐 · S 길이) → 멈춤(hold) 뒤 「팡」 비기 터짐 소리 높게(finishPop · popRate) + 맑은 종 꼬리(finishTail · tailS 길이) · 한 묶음 틈 finishGap */
  finishThud: .7, finishThudHz: [130, 48], finishThudS: .2, finishPop: .5, finishPopRate: 1.35, finishTail: .22, finishTailS: 1.1, finishGap: .08,
  quake: .95, quakeS: 1.1, quakeHz: [58, 24], quakeNoise: .8, quakeCut: 260, quakeClip: .75, quakeClipRate: .55, quakeGap: .15, slamSmall: .55,
  /**
   * 기세 알 줍는 「뽁」 (11-19 형: 「보석인지 템인지는 먹을 때 작은 버블 소리」) — 위로 짧게 미끄러지는 사인.
   * popHz 첫 높이 · popRise 끝 높이 몫 · popMs 길이 · popGap 묶음 틈(초) · popCombo 이 초 안에 또 먹으면 한 칸 오름 · popStep 한 칸(반음 몫) · popSteps 몇 칸까지
   */
  pop: .16, popHz: 620, popRise: 1.7, popMs: 55, popGap: .045, popCombo: .5, popStep: 1.0595, popSteps: 12,
} as const
/**
 * 여자 보스 목소리 (11-23 형 「구미호는 공격할 때 웃는 소리」 · 11-24 「웃음·피격소리 왜 안 넣었어 · 꼬리 잘릴 때 남자 비명」) — src/raid/boss-voice.ts 가 쓴다.
 * on: 파일 묶음(boss_f_laugh_1~3 · boss_f_hurt_1~3 · boss_f_scream_1~2 · public/realm/sfx/raid/)이 들어왔나. 들어오면 true 로 켠다 — 꺼져 있으면 파일을 부르지 않고(404 없음) 소리도 없다
 * laugh/hurt/scream: 크기(목소리 채널) · laughGap/hurtGap/screamGap: 같은 소리 사이 틈(초)
 * hurtShare: 보스 체력의 이 몫만큼 깎이면 한 번 (그 사이 깎인 양을 모은다 · 매 타마다 내지 않는다)
 * who: 보스 종류별 [웃음, 피격, 비명] — 무녀는 방울(웃음 없음)을 그대로 두고 피격·비명만 여자 목소리 · 이무기·백두 대호·불가사리는 이번 일이 아니다
 */
export const HAEBI_BOSS_VOICE = {
  on: true,   // 11-24 형이 골랐다: 웃음 = 루미·레다 · 꼬리 잘릴 때 비명 = 레다 · 피격 신음은 없음
  laugh: .85, laughGap: 4, hurt: .7, hurtGap: 1.6, hurtShare: .03, scream: .9, screamGap: .6,
  who: { gumiho: { laugh: true, hurt: false, scream: true }, shaman: { laugh: false, hurt: false, scream: true } } as Readonly<Record<string, { laugh: boolean; hurt: boolean; scream: boolean }>>,
} as const
/**
 * 짐승·괴물 보스의 고유 소리 (11-24 형 「비인간형 보스는 소리를 찾아야지」 · 고른 것 「321 122 1」 · 불가사리 공격·끊길 때는 다시 찾아 「공격2 부위1」) — src/raid/boss-voice.ts 가 쓴다.
 * who: 보스 종류별로 파일이 있는 칸 — roar 등장·막 전환 · attack 공격 예고(tell)에 들어갈 때 · hurt 부위가 끊길 때. 없는 칸은 예전 그대로(포효 파일 · 공격 소리 없음).
 * 파일: public/realm/sfx/raid/boss_<종류>_<칸>.ogg (출처 CREDITS.txt) · roar/attack/hurt 크기 · attackGap/hurtGap 같은 소리 사이 틈(초)
 */
export const HAEBI_BOSS_BEAST = {
  roar: .95, attack: .7, hurt: .85, attackGap: 2.5, hurtGap: .6,
  who: { tiger: { roar: true, attack: true, hurt: true }, imugi: { roar: true, attack: true, hurt: true }, bulgasari: { roar: true, attack: true, hurt: true } } as Readonly<Record<string, { roar: boolean; attack: boolean; hurt: boolean }>>,
} as const
/**
 * 열전 기술·크리티컬 소리와 진동 계단 (11-19 형: 「기술 쓸 때 사운드랑 햅틱 · 크리티컬은 핑 · 각성 기술은 더 강해야 하니 초반 사운드 너무 심하면 안 됨 · 진각성은 더 임팩트」).
 * 소리는 src/raid/sound.ts 가 WebAudio 로 합성(skill_hit.ogg 만 파일) · 진동은 src/ui/haptics.ts skill(tier)·crit().
 * tiers 한 줄에 한 계단 — skill 비기(평상) · awake 각성 비기(판 안 각성 중 「진」 비기) · true 진각성 비기(DLC · src/realm/dlc.ts 가 켜질 때)
 *   cast 누를 때 「탁」 크기 · hit 터질 때 skill_hit.ogg 크기 · boom 낮은 울림 크기 · boomMs 그 길이 · tail 높은 종 꼬리 크기 · tailMs 그 길이 · buzz 터질 때 진동 ms(떨기·쉬기 번갈아)
 *   비기 hit 는 예전 HAEBI_SOUND.skillHit(.6)보다 낮춰 위 계단의 머리 공간을 둔다 (기합 목소리 HAEBI_SOUND.skill 은 그대로)
 * crit 맑은 「핑」 — ping 크기 · hz 첫 배음 높이 · ms 길이 · gap 묶음 틈(초 · 한 프레임 한 번) · buzz 진동 ms · buzzGap 진동 사이 ms
 * castHz·castMs 「탁」 높이·길이 · castNoise 「탁」 노이즈 몫 · castCut 「탁」 노이즈 띠 Hz · boomHz 울림 [시작, 끝] Hz(폰 스피커가 들리게 둘째 배음 boomOver 몫을 겹침)
 * tailHz·tailRatios 종 배음 · pingRatios 핑 배음 · chimeFall 배음마다 작아지는 몫(높은 배음일수록 작고 빨리 사라짐) · reserve 기술 소리만 maxVoices 위로 더 쓸 수 있는 소리 수 · busDb·busRatio 기술 소리 묶음 압축(겹쳐도 찢어지지 않게)
 */
export const HAEBI_FEEL_TIERS = {
  tiers: {
    skill: { cast: .12, hit: .42, boom: 0, boomMs: 0, tail: 0, tailMs: 0, buzz: [18] },
    awake: { cast: .18, hit: .55, boom: .5, boomMs: 420, tail: 0, tailMs: 0, buzz: [32, 50, 48] },
    true: { cast: .24, hit: .62, boom: .64, boomMs: 680, tail: .24, tailMs: 1400, buzz: [42, 45, 58, 45, 130] },
  },
  crit: { ping: .3, hz: 2350, ms: 210, gap: .12, buzz: 10, buzzGap: 220 },
  castHz: 260, castMs: 70, castNoise: .6, castCut: 2600, boomHz: [72, 38], boomOver: .55,
  tailHz: 1560, tailRatios: [1, 2.76, 5.4], pingRatios: [1, 2.32, 4.25], chimeFall: 1.6, reserve: 3, busDb: -12, busRatio: 4,
} as const
export type FeelTier = keyof typeof HAEBI_FEEL_TIERS.tiers
/**
 * 폰 떨림 (11-19 형: 「피격될 때 햅틱 · 전투 승리하면 듀오링고처럼 햅틱 막 지랄 나 주면」) — src/ui/haptics.ts 한 곳에서 낸다.
 * hurt 맞을 때 [가장 짧게, 가장 길게] ms · hurtFull 잃은 체력이 최대의 이 몫이면 가장 길게 · hurtGap 연타 사이 ms
 * fieldHurt 본편 싸움에서 우리 장수가 크게 맞을 때(겨루기 짐·쓰러짐) ms · win 이김 · bigWin 대승(본편 몰아냄) — 떨기·쉬기 ms 번갈아
 * 아이폰 사파리는 진동이 없어 조용히 넘어간다. 끄기는 본편 설정(hanbal.realm.haptics)
 */
export const HAPTICS = {
  hurt: [15, 40], hurtFull: .15, hurtGap: 180, fieldHurt: 40,
  win: [30, 40, 30, 40, 60, 60, 120], bigWin: [30, 40, 30, 40, 30, 40, 60, 60, 60, 60, 160],
} as const
/**
 * 카드 자석 흔들림 (A1 · 형 11-20: 「카드 끌 때 자석처럼 흔들림(관성·기울기)」) — src/ui/fx/sway.ts 한 곳에서 쓴다 (열전 레벨업 카드 · 본편 싸움 깃발 · 옛 무덤 상자 · 얼굴 링).
 * 누른 채 끌면: 카드가 손가락을 고무줄처럼 조금만 따라온다 — 끈 거리 d 에 d·pull/(1+|d|/reach) (멀리 끌어도 pull·reach px 를 넘지 않는다)
 *   기울기 = 손가락 빠르기(px/초)·tiltPerSpeed + 따라온 거리·tiltPerPull (도) · 어떤 때에도 maxTilt 도를 넘지 않는다 · velTau 빠르기를 거르는 시간(초)
 *   slop 이만큼(px) 움직여야 끌기로 본다 · pressScale 누르기만 했을 때 · liftScale 끄는 동안 크기 · lift 끄는 동안의 그림자(저사양은 없음)
 * 용수철 [hz 떨림 수, zeta 감쇠 몫] — follow 누르고 있는 동안 따라붙기 · back 놓은 뒤 제자리로(감쇠가 작아 조금 넘쳤다 돌아온다) · tilt·tiltBack 기울기 몫
 * 마우스를 올리면(컴퓨터): 커서 쪽으로 가운데에서 떨어진 px 의 hoverPull 몫만큼 끌리고 hoverLift px 들리며 hoverScale 로 · 기울기는 가장자리에서 hoverTilt 도
 *   cssLift — CSS 가 이미 마우스를 올리면 들어 올리는 카드(본편 깃발 .wcmd:hover)의 들림 (겹쳐 두 배로 뜨지 않게 0)
 * 멈춤 판정: restPx·restDeg·restScale 안에 들고 빠르기가 restSpeed(px/초)·restSpin(도/초)·restGrow(/초) 밑이면 rAF 를 끄고 꾸밈을 걷는다
 * step 셈 한 걸음(초 · 용수철이 튀지 않게 잘게) · maxDt 한 프레임에 셈하는 가장 긴 시간(초 · 탭을 다녀오면 뛰지 않게) · z 끄는 카드를 이웃 위로
 * wideRef 이 폭(px)보다 넓은 카드는 폭에 반비례해 덜 기운다(끝이 흔들리는 거리를 비슷하게 · 본편 깃발 판의 한 줄짜리 넓은 깃발) · wideMin 그 몫의 바닥
 * ring — 얼굴 링: 고리가 도는 빠르기(칸/초)에 perSlot 도씩 얼굴이 기운다(앞 얼굴일수록 크게) · max 도까지 · 용수철 [hz, zeta]
 */
export const UI_SWAY = {
  pull: .3, reach: 80, tiltPerSpeed: .01, tiltPerPull: .15, maxTilt: 8, velTau: .06, slop: 6, wideRef: 300, wideMin: .35,
  pressScale: .97, liftScale: 1.05, lift: '0 16px 16px #000000a0',
  follow: [7, .75], back: [4.5, .45], tilt: [6, .55], tiltBack: [4.5, .4],
  hoverPull: .035, hoverLift: 4, hoverScale: 1.02, hoverTilt: 2, cssLift: 0,
  restPx: .15, restDeg: .04, restScale: .0006, restSpeed: 2, restSpin: 1, restGrow: .005,
  step: 1 / 120, maxDt: .05, z: 3,
  ring: { perSlot: 1.6, max: 8, spring: [5, .35] },
} as const
/**
 * 판 밖으로 넘는 꾸밈 (A1 · 형 11-20: 「이펙트가 판 레이아웃 경계를 넘나듦 · 소리와 딱 맞음」) — src/ui/fx/flyout.ts.
 * 고른 카드의 그림이 판 안에서 popMs 동안 popScale 로 부풀며 popRise px 솟고, flyMs 동안 화면을 가로질러 쓰이는 자리로 날아가 박힌다 (닿는 때 = 소리)
 *   arc 날아가는 길이 위로 휘는 몫(거리에 곱함) · spin 날며 도는 도 · ease 날기 빠르기 곡선(지수 · 1 보다 크면 끝에서 빨라져 「쾅」) · steps 길 위의 마디 수
 *   fit [작게, 크게] 닿을 때 크기 몫의 한도(닿을 칸 ÷ 나는 그림)
 *   landMs 박힌 뒤 납작해졌다 사라지는 시간 · squash 박히는 순간 크기 몫 · pulse 박힌 자리가 튀는 크기 · pulseAt 그 꼭대기 때(0~1) · pulseMs 그 시간 · hold 닿기 전 그 자리의 흐림(opacity)
 * 떠날 때 불티 sparks 낱이 판 테두리를 넘어 흩어진다 — 거리 sparkDist[가까이, 멀리] px · 크기 sparkSize px · 시간 sparkMs · sparkFall 끝에 처지는 px
 *   sparkMid 가는 길의 이 몫(때·거리·크기)까지 밝게 · sparkEnd 끝 크기 · lowSparks·midSparks 저사양·보통에서 남기는 몫(minSparks 낱은 남김)
 *   sparkCore 불티 속 빛 · sparkGlow 불티 번짐 px
 * ringMs 떠나는 자리 · 닿는 자리의 고리가 번지는 시간 · ringScale [처음, 끝] 크기 몫 · ringAlpha 처음 진하기 · ringLine 고리 굵기 px · ringFrom·ringTo 고리 지름(그림 크기 몫)
 * burstEase 터져 나가는 곡선 · 다 해서 0.8초 안 (popMs+flyMs+ringMs 770ms) · safety 그 몇 배가 지나면 애니가 멈췄어도 걷는다 · z 화면 위 겹 · glow 나는 그림의 빛(저사양 없음) · color 기본 빛깔
 * afterMs 고르자 닫힌 판의 잔상이 옅어지는 시간 · afterScale 그동안 작아지는 몫 (날아가는 그림이 판 테두리를 넘는 것이 보이게)
 * plant 본편 싸움 깃발이 박히는 높이 — 그 무리 네모의 위에서 이 몫 (보석이 뜨는 윗머리 쪽) · plantScale 박힐 때 깃발 크기 몫(판 위 깃발 그림에 곱함)
 */
export const UI_FLY = {
  popMs: 70, popScale: 1.6, popRise: 12, flyMs: 400, arc: .3, spin: 16, ease: 1.6, steps: 12, fit: [.25, 2],
  landMs: 170, squash: 1.3, pulse: 1.3, pulseAt: .3, pulseMs: 260, hold: .35,
  sparks: 10, minSparks: 2, sparkDist: [90, 210], sparkSize: [6, 12], sparkMs: [380, 540], sparkFall: 30, sparkMid: .6, sparkEnd: .3,
  lowSparks: .3, midSparks: .6, sparkCore: '#fff6cf', sparkGlow: 8,
  ringMs: 300, ringScale: [.4, 1.8], ringAlpha: .95, ringLine: 3, ringFrom: 1.3, ringTo: 1.4,
  burstEase: 'cubic-bezier(.15,.8,.3,1)', safety: 3, z: 9990, glow: 'drop-shadow(0 0 10px #ffd27a)', color: '#ffd27a',
  afterMs: 220, afterScale: .97, plant: .3, plantScale: 1.6,
} as const
/** 열전 손가락 조이스틱 (형 11-16: 「뱀서 컨텐츠 할 때는 조이스틱 생겨야 하는 거 아님?」) — 손가락 댄 자리에 생기는 떠다니는 막대.
 *  radius 막대가 끝까지 가는 거리(화면 px) · dead 이보다 덜 밀면 멈춤 · follow 끝을 넘겨 끌면 받침이 따라오는 몫(0~1)
 *  queue: 회피·비기를 재사용 중에 눌러도 이 초 안에 풀리면 나간다 (11-17 형: 「회피나 기술도 잘 안 눌렸음」) */
export const HAEBI_STICK = { radius: 54, dead: 7, follow: 1, queue: .15 } as const
/** 열전 전투판 확대 (11-19 형: 「우상단에 돋보기 · 탭 확대 · 탭 확대 · 탭 원래대로」) — 화면만 바뀐다 (판의 셈은 그대로).
 *  levels 단계마다 배율(처음은 1배) · follow 카메라가 장수를 따라가는 빠르기(초당 · 클수록 바짝) · ease 배율이 바뀌는 빠르기(초당) · pop 단추가 튀는 초 */
export const HAEBI_ZOOM = { levels: [1, 1.35, 1.8], follow: 7, ease: 9, pop: .32 } as const
/**
 * 59-WIDE 넓은 맵 (11-22 형 「맵이 너무 좁다」 · 「추천대로 해줘」 · docs/realm/RAID-REWARD-MAP-20261122.md 4장) — 새 규칙(opts.mapRules)으로 켠 열전 스테이지 판에만 쓴다 · 옛 기록은 한 장짜리 판 그대로.
 * 세계 = 원래 판(0~width × 0~height · 「결전장」)을 가운데 칸으로 둔 가로세로 screens 장. 원래 판의 좌표는 그대로라 거대 보스·중간 보스·목책 코드는 손대지 않는다.
 *  spawnMargin 적이 나오는 둘레: 장수 화면(1배) 밖 이만큼(px · 카메라가 앞서 보는 lookAhead + 몸 반 폭보다 크게) · spawnOpen 그 둘레가 세계 끝에 눌려도 이 몫은 남아야 「화면 밖」으로 친다(아니면 반대쪽에서 나온다)
 *  strayScreens 뒤처진 적: 장수에게서 화면 이만큼(가로는 판 폭 · 세로는 판 높이의 배수) 넘게 멀면 앞쪽 둘레로 옮긴다 (뱀서 방식 · 한쪽으로 달려도 밀도가 유지된다)
 *  huntNear~huntFar 큰 놈 사냥: 정예가 나오는 거리(화면 수) · huntInset 세계 끝에서 이만큼 안쪽 · seenInset 화면 안으로 이만큼 들어와야 「봤다」(빨리 잡기 20초는 그때부터 센다)
 *  gateWarn 안개 문: 보스 이 초 전부터 세계 끝에서 결전장으로 닫힌다(밀어 넣기만 · 피해 없음) · gateOpen 중간 보스가 쓰러지면 이 초에 걸쳐 다시 열린다
 *  edge 고리가 적·알·상자를 안으로 미는 여유(px · 옆 · 위 · 아래 = 옛 판의 돌진 끝 10·20·10 그대로)
 *  view: lookAhead 카메라가 걷는 쪽을 앞서 보는 px · leadEase 그 빠르기(초당) · tileScale 바닥 무늬 한 화소가 판에서 차지하는 px(결전장 그림과 같은 배율 = 판 높이 ÷ 그림 높이 810)
 *        feather 결전장 그림 가장자리를 바닥에 섞는 폭(px · 가로는 그림의 숨은 옆 폭 bleed 를 먼저 쓴다) · cull 화면 밖 이만큼까지는 그린다(몸·효과 반 폭)
 *        base 바닥 그림이 오기 전 민무늬 색 · fog 안개 문의 색(스테이지마다 · 화면만) · fogAlpha 바깥 진하기 · fogEdge 안쪽으로 번지는 폭(px) · fogPulse 일렁임(초당 라디안) · fogPulseShare 그 몫 · fogRim 고리 끝의 밝은 줄 굵기(px · 진하기 fogRimAlpha) · fogFadeIn 문이 이만큼 닫힐 때까지 안개가 서서히 짙어진다
 *        camLag 안개 문이 이만큼 닫힐 때까지는 카메라가 세계 끝까지 본다(다가오는 안개가 화면에 보인다) · 그 뒤로 조여 다 닫히면 결전장에 맞는다
 *        arrow 화면 가장자리 화살표: inset 가장자리에서 떨어진 px(위는 HUD 를 피해 top · 아래는 bottom) · size 화살촉 · badge 그림 원 반지름 · face 원 안에 얼굴이 오게 발을 내리는 몫(그림 키의) · bob 까딱임(px · 초당 라디안 bobRate) · max 한 번에 그리는 수 · 색(적 · 상자 · 결전장 · 테)
 *        props 낱개 장식 (Codex 80 · tools/sprite-kit/map-props.py 가 자른 public/realm/raid/props/<스테이지>-<번호>.webp) — 스테이지마다 번호 차례로 [화면 폭, 화면 키](px · 장수 94px 에 견줘 나무 2~3배 · 바위·덤불 0.5~1배 · 그 도구가 찍어 준 줄 그대로). 몸과 같이 위에서 아래로 그린다 · 부딪히지 않는다
 *        scatter 장식 흩기(화면 쪽이 씨앗으로 정한다 · 판의 셈과 무관): count 스테이지마다 놓는 수 · seed 씨앗 · gap 밑동끼리 떨어지는 거리(px) · pad 결전장(가운데 칸 · 안개 문이 닫히는 자리)에서 그림 상자를 띄우는 여유 · edge 세계 끝에서 띄움
 *                tall 이 키를 넘는 것(나무·망루)은 tallShare 몫으로 덜 놓는다 · behind 장수가 그 뒤에 서면 이 진하기로 비친다
 */
export const HAEBI_WIDE = {
  screens: 3, spawnMargin: 110, spawnOpen: .5, strayScreens: 1.5,
  huntNear: 1.2, huntFar: 1.8, huntInset: 60, seenInset: 30,
  gateWarn: 20, gateOpen: 6, edge: [10, 20, 10] as const,
  /**
   * 61-SOLID 부딪히는 장식 (raid/props.ts · 형 11-22 「장애물을 다 통과하네」 → 「무기는 통과」) — 스테이지마다 장식 종류(view.props 차례)별 [반폭 hw, 두께 반지름 r] · null 이면 지나간다.
   * 밑동 가로 캡슐: 발밑 y 에서 r × solidLift 만큼 위가 가운데 줄. 나무는 밑동만(잎은 지나감) · 목책·성벽은 넓게.
   */
  solidLift: .6,
  solid: {
    forest: [[0, 22], [0, 22], [0, 26], [30, 34], [15, 24], null, null, [0, 30]],
    ford: [null, null, [0, 30], [28, 32], null, [12, 26], null],
    palisade: [[80, 16], [75, 16], [55, 30], [40, 36], [50, 22], [0, 16]],
    snow: [[0, 26], [0, 24], [0, 22], [0, 18], [34, 34], null, [24, 26]],
    fortress: [[110, 18], null, [110, 16], [0, 10], [45, 24], [48, 22]],
    trial: [],
  } as Record<string, readonly (readonly [number, number] | null)[]>,
  view: {
    lookAhead: 70, leadEase: 2.5, tileScale: 720 / 810, feather: 90, bleed: 80, cull: 140,
    /** 가운데 결전장에 옛 스테이지 그림을 깔지 (false = 둘레와 같은 이어지는 바닥 · 11-22 형) */
    arenaArt: false,
    base: { forest: '#2b3a2a', ford: '#3a4444', palisade: '#4a4133', snow: '#b9c4cc', fortress: '#3b302b', trial: '#2b3a2a' },
    fog: { forest: '#c4d2bd', ford: '#cfe0e6', palisade: '#b9a98c', snow: '#f2f7fb', fortress: '#8a3a1e', trial: '#c4d2bd' },
    fogAlpha: .82, fogEdge: 120, fogPulse: 1.7, fogPulseShare: .12, fogRim: 4, fogRimAlpha: .7, fogFadeIn: .25, camLag: .6,
    arrow: { inset: 46, top: 215, bottom: 185, size: 20, badge: 30, face: .8, bob: 4, bobRate: 5, max: 6, foe: '#ff5a4a', loot: '#ffd66a', arena: '#fff3d0', rim: '#1a1210' },
    props: {
      forest: [[201, 250], [188, 260], [245, 270], [167, 90], [101, 55], [117, 70], [130, 55], [90, 85]],
      ford: [[144, 94], [103, 76], [307, 280], [143, 80], [121, 60], [90, 52], [146, 60]],
      palisade: [[196, 115], [188, 110], [203, 210], [153, 120], [154, 90], [91, 120]],
      snow: [[305, 250], [222, 265], [252, 240], [95, 165], [129, 80], [145, 42], [107, 52]],
      fortress: [[278, 130], [80, 80], [279, 110], [91, 165], [150, 70], [147, 95]],
      trial: [],
    } as Record<string, readonly (readonly [number, number])[]>,
    scatter: { count: 52, seed: 59, gap: 170, pad: 110, edge: 30, tall: 150, tallShare: .45, behind: .45 },
    /** 가운데 칸(결전장)에 흩는 몸 없는 장식 — 수 · 한가운데 비우는 반지름 · 서로 띄우는 거리 · 씨앗 */
    centerScatter: { count: 9, core: 220, gap: 150, seed: 61 },
  },
} as const
/** 열전 판 빠르기 (11-19 형: 「×1 누르면 ×2 · 또 누르면 ×3 · 한 번 더 누르면 ×1」) — 우상단 돋보기 옆 단추 · 단축키 X.
 *  steps 단계마다 배수: 판의 걸음(1/120초)은 그대로 두고 한 프레임에 걸음을 이만큼 더 돌린다 (A1 · 판 기록은 걸음마다라 빠르기와 상관없다).
 *  비기·각성 시전(컷인) 동안은 ×1 로 돈다 — 컷인 띠·기합·터짐이 세 배로 짧아지지 않게. pop 단추가 튀는 초 */
export const HAEBI_SPEED = { steps: [1, 2, 3], pop: .32 } as const
/** 열전 판 기록 (11-19 형: 「열전 플레이데이터도 받고 있지?」) — grid: 이동 입력을 1/grid 칸으로 맞춰 판에 넣고 적는다
 *  (조이스틱 끝까지 54px 이면 한 칸 1.7px · 판을 다시 돌리면 같은 결과가 나오게 · 기록이 짧아지게) */
export const HAEBI_LOG = { grid: 32 } as const
/**
 * 열전 첫 레벨업 카드 창 · 첫 비기 컷인 띠 미리 그리기 (11-22 · 4배 느린 CPU 에서 처음 뜰 때만 90~130ms 끊김) — 출전 화면에서 같은 HTML 을 한 번 그려 둔다.
 *  처음 비용은 글꼴 조각 받기·글자 모양 잡기·그림 풀기·칠하기 셰이더라 「보이지 않게」(visibility) 깔면 반만 풀린다 — 실제로 칠해지도록 아주 옅게 깐다.
 *  opacity: 덮는 진하기 (8비트 화면에서 0 으로 떨어지는 값 · 0 이면 브라우저가 칠하지 않는다) · holdMs: 글꼴·그림이 다 온 뒤 칠해질 틈 (미리 그리는 띠 애니 길이도) · afterMs: 출전 화면이 선 뒤 기다림
 */
export const HAEBI_WARM = { opacity: .001, holdMs: 1300, afterMs: 400 } as const
/** Haebi's independent ten-minute run. Combat tuning lives here, not in the renderer. */
export const HAEBI_RUN = {
  /** 판 길이 · 두목 — 다이센카처럼 20분 (11-16 형 고름 · 예전 600/540 → 900/840 → 1200/1140) · 스테이지마다 length 를 곱한다 */
  duration: 1200, bossAt: 1140, health: 180, speed: 185, width: 1120, height: 720,
  /** 맞은 적·장수 번쩍임 — 같은 그림을 빛으로 한 번 더 더하는 세기 (예전 brightness(1.7) 필터 대신 · 폰 프레임) */
  flashAdd: .55,
  /** 한 프레임에 그리는 맞은 불꽃 · 피해 숫자 · 쓰러지는 몸 수 (새것부터 · 판 상태는 그대로) — 늦은 판 폰 프레임 (11-17 형 「이쯤 오면 렉」) */
  drawHits: 40, drawNumbers: 18, drawDeaths: 40,
  /**
   * 피해 숫자 합치기 (11-18 형 플립7: 늑대 떼에 숫자 수십 개가 겹쳐 렉) — 새 숫자가 numMergeTime 초 안에 난 숫자와 numMerge px 안이면
   * 따로 띄우지 않고 그 숫자에 더한다(크게 다시 튐). 화살비·만 갈래가 한 무리를 한꺼번에 칠 때 한 덩이로 읽힌다.
   */
  numMerge: 38, numMergeTime: .14,
  /**
   * 적·장수 그림 굽기 (11-18 형 플립7 「늑대 떼부터 초당 3프레임」) — 그림 띠(늑대 6400px · 장수 4000~5800px)를 그리는 키 그대로
   * 한 번 줄여 캔버스에 구워 두고 1:1 로 찍는다. 띠 폭이 spriteBakeMax 를 넘으면 여러 줄로 접는다(폰 GPU 텍스처 한도 4096 아래).
   */
  spriteBakeMax: 4096,
  /** 격파 수·연속 격파 글자를 고쳐 쓰는 틈(초) — 연속 격파 중에만 (11-18 플립7 · 늑대 떼에 프레임마다 다시 칠함) */
  hudCountEvery: .12,
  /** 기세·각성(투지) 막대 너비를 고쳐 쓰는 눈금(%) — 투지 동안 각성 막대가 판마다 0.1% 씩 줄어 그림자 진 HUD 전체를 판마다 다시 칠했다 (11-18 플립7 · 느린 장면은 모두 투지 켜짐) */
  hudBarStep: .5,
  /**
   * 피해 숫자 (11-17 형: 「퍽 하고 테일즈위버처럼 튀어나가게 · 치명타는 더 빠르게 더 크게」) — 화면 쪽 알갱이 (판 상태는 읽기만).
   * 맞은 자리에서 numPop 배로 크게 찍혔다(numPopTime 초) 줄며, 위로 numRise px/초 · 옆으로 ±numSpread px/초 튀고 numGravity 로 꺾여 떨어진다 ·
   * numWobble 라디안만큼 흔들림 · 머무는 시간 numLife 초 · 글자 키 numSize(쓰러뜨림 numKill) px.
   * 치명타: numCritSize px · 더 빠르게(numCritSpeed 배 · 머무름 numCritLife) · 뒤에 작은 터짐 numCritBurst px.
   */
  numLife: .85, numPop: 1.9, numPopTime: .09, numRise: 150, numSpread: 70, numGravity: 330, numWobble: .14, numSize: 17, numKill: 21,
  numCritSize: 29, numCritSpeed: 1.45, numCritLife: .7, numCritBurst: 46,
  /** 체력 깎임 토막 (본편 싸움 막대와 같은 롤 체력바 · 형 11-16) — 막대는 단번에 떨어지고, 잃은 토막이 희게→노랗게→붉게 번쩍(hpChunkFlash 초)한 뒤
   *  마지막으로 맞고 hpChunkHold 초 지나면 처음엔 빠르게 끝 무렵엔 천천히(초마다 hpChunkRate 배로 좁아짐) 줄어든다 */
  hpChunkFlash: .24, hpChunkHold: .32, hpChunkRate: 4.5,
  maxEnemies: 230, maxShots: 240, maxFx: 320, maxDrops: 90, maxLevel: 44,
  /**
   * 레벨업 기세 = xpBase + 레벨 × xpPerLevel + 레벨² × xpCurve.
   * xpBase 8 → −3 (11-19 「시작은 평타만」 되맞춤): 보조 공격을 첫 카드로 얻게 되며 판마다 한 점이 모자라 숲 승률이 81% → 68% (봇 84판).
   * 첫 레벨을 15.8 → 4.8(첫 카드 약 15초)로, 앞 레벨들을 한 칸씩 당겨 81% 로 되돌렸다 · 뒤 레벨(30레벨 935)에는 1% 아래.
   */
  xpBase: -3, xpPerLevel: 7, xpCurve: .8, levelHeal: 28, killHeal: .08, regen: .8,
  dashCooldown: 2.4, dashTime: .22, dashInv: .42, dashSpeed: 3.8,
  /** 회피 잔상 (형 11-16: 「돌진 모션이 잔상처럼 여러 개 생기다 없어지게 · 사이버펑크처럼」) — 몇 초마다 하나 · 얼마나 남나 · 처음 진하기 · 색 갈라짐(px) */
  ghostEvery: .045, ghostLife: .42, ghostAlpha: .7, ghostSplit: 4,
  /** 장수 그림 키(px) · 걷기 한 바퀴(두 걸음)에 몸이 나아가는 거리 ÷ 몸 키 — 띠 227개의 그린 보폭을 잰 값(한 걸음 ≈ 몸 키의 0.39).
   *  걷기 칸은 시간이 아니라 실제로 움직인 거리로 넘긴다: 발이 바닥에서 미끄러지지 않게 (형 11-16 「이동이 부자연스럽다」) */
  heroPx: 94, walkStride: .78,
  /** 장수 테두리 빛 (GAP §15-2 · 11-22 녹화에서 해비가 갈색 무리에 묻힘) — 판 px 두께 · 색 · 진하기 · 방향 수(4 = 상하좌우 · 8 = 대각선까지) */
  heroRim: 2, // 11-23 무적(s.inv · 회피) 동안만 켠다 · 늘 켜 두면 던파의 슈퍼아머처럼 읽혀 뜻이 흐려진다 · 평소 장수 구분은 발밑 금빛 고리
  heroRimColor: '#ffe9a8', heroRimAlpha: .85, heroRimDirs: 8,
  /** 11-22 형 「키 기준은 이미지 전체 높이가 아니라 머리 정수리 기준」 — 장수마다 정수리~발(+신장 HERO_CM)을 같은 자로: 그림 키 = heroPx × heroBodyRef ÷ 그 장수 body · heroBodyRef 는 관·깃털 없는 165cm 장수의 몸 비(138÷160) · 너무 크게·작게 그리지 않게 heroFit 범위 */
  heroBodyRef: 138 / 160, heroFit: [.8, 1.3] as const,
  /** 비기를 쓴 뒤 무적 시간(초) — 비기 꼴·피해·재사용은 HAEBI_ULT */
  skillInv: .7,
  /** 컷인 띠 뒤 어두운 막 진하기 (판은 그대로 돌아 너무 어둡지 않게) */
  skillCutinDim: .3,
  /**
   * 컷인 길이는 시전에 맞춘다 (11-17 형: 「컷인 보고 → 컷인 끝나고 데미지」) — 띠가 번쩍이는 순간 = 비기가 터지는 순간 = 시전 끝(HAEBI_ULT.cast ÷ slow 초 · 화면 1.1~1.3초).
   * 예전엔 1.8초 고정이었다(11-15 형: 「너무 빨라서 읽을 수조차 없음」 · 그 전 .7) — 시전 동안 판이 느려져 이름을 읽을 틈은 남는다.
   * skillCutinTail: 터진 뒤 띠가 마저 걷히는 판 시각(초)
   */
  skillCutinTail: .12,
  axeDamage: 38, axeRankDamage: 16, axeRange: 112, axeRankRange: 11, axeCooldown: 1,
  galeDamage: 30, galeRankDamage: 16, galeSpeed: 350, galeCooldown: 2.3, galeLife: 2.1,
  heroShotHeight: 46, enemyShotHeight: 34, shotHandLead: 14, shotReleaseTime: .12,
  emberDamage: 54, emberRankDamage: 28, emberRange: 84, emberCooldown: 3.3,
  thunderDamage: 45, thunderRankDamage: 23, thunderRange: 220, thunderCooldown: 2.9,
  tempoStep: .14, reachStep: .12, levelPower: .045,
  orbitRadius: 145, orbitDamage: 60, orbitInterval: .22,
  /** 잡졸 체력 = mobHp × (1 + 초 × hpTimeScale + 분² × hpTimeCurve) — 처음 두세 대, 자라면 줄고, 시간이 다시 두껍게 (예전 42 · .0014 · 0 = 늘 한 방) */
  mobHp: 75, hpTimeScale: .004, hpTimeCurve: .012, mobSpeed: 42, speedTimeScale: .035,
  eliteHp: 1300, bossHp: 30000, eliteEvery: 150,
  contactDamage: 9, enemyShotDamage: 7, hitInv: .65, enemyShotSpeed: 155, enemyShotLife: 2.6,
  /** 적 한 대의 아픔이 초마다 붙는 비율 · 산적 활잡이 비율(처음 + 초마다) · 활잡이 재장전 (형 11-15: 가만히 있어도 깬다) */
  archerHunt: 480,
  /** 산적 일제 사격 — 처음 뜨는 때 · 간격(처음→두목 무렵) · 경고 시간 · 반지름 · 피해(초마다 붙는 비율) · 두목 무렵 곁에 더 떨어지는 수 */
  barrageAt: 40, barrageEvery: 9, barrageEveryLate: 4.5, barrageDelay: 1.25, barrageRadius: 58, barrageDamage: 22, barrageTimeScale: .0018, barrageExtra: 3, threatTimeScale: .0015, shotTimeScale: 0, archerShare: .08, archerTimeShare: 0, archerCooldown: 3, archerRange: 370,
  bossDamage: 30, bossWindup: 1.15, bossRadius: 95, bossCooldown: 2.5,
  spawnEarly: 1.5, spawnMid: 5, spawnLate: 13, spawnFeast: 23,
  /** 50-1 일반 열전만: 몰아침 → 잔병이 적은 숨 고름. 기존 적은 없애지 않는다. */
  surgeSeconds: 40, respiteSeconds: 18, respiteSpawn: .18, stageRangedShare: .08,
  barrageMarkWidth: 20, barrageMarkHeight: 18, barrageMarkLift: 8,
  /** 떨어진 기세: dropLife 초 뒤 사라짐(마지막 1초 옅어짐) · dropMagnet 둘레 안만 날아옴 (11-17 · 예전엔 반쯤 지나면 어디서든 날아와 가운데 서 있어도 다 먹혔다) */
  dropLife: 30, dropSpeed: 390, dropMagnet: 210, knockback: 14,
  // ── 무기 묶음 (11-15 각성 시련을 모든 장수로 · 도끼=해비 위 수치 그대로) ──
  // 활: 멀리서 꿰뚫는 속사 + 늦게 떨어지는 화살비
  bowDamage: 30, bowRankDamage: 11, bowRange: 430, bowCooldown: .68, bowSpeed: 640, bowLife: 1.1, bowPierce: 1,
  rainDamage: 36, rainRankDamage: 16, rainCooldown: 2.6, rainRadius: 72, rainDelay: .45, rainSpread: 60,
  volleyInterval: 1.4, volleyArrows: 12, volleyDamage: 46,
  // 창: 길고 좁게 꿰는 찌르기 + 멀리 꿰는 투창
  spearDamage: 58, spearRankDamage: 20, spearLength: 165, spearRankLength: 15, spearWidth: 56, spearCooldown: .9,
  javelinDamage: 38, javelinRankDamage: 20, javelinSpeed: 520, javelinCooldown: 1.9, javelinLife: 1.3, javelinPierce: 5,
  groveInterval: .9, groveSpikes: 6, groveRadius: 120, groveHit: 42, groveDamage: 90,
  // 칼: 빠르고 넓은 앞쪽 베기 + 멀리 나는 검기
  swordDamage: 38, swordRankDamage: 14, swordRange: 108, swordRankRange: 9, swordCooldown: .7, swordArc: .45,
  waveDamage: 30, waveRankDamage: 15, waveSpeed: 420, waveCooldown: 1.7, waveLife: 1.15, waveRadius: 34,
  tempestInterval: .5, tempestRadius: 135, tempestDamage: 58,
  splitDamage: .55, boomerangTurn: .5,
  // 단검 (11-16 형: 「단검도 있고 마법도 쓰는 거 같고」 · 단검·낫·맨손·채찍 장수): 짧고 아주 빠른 찌르기 + 부채꼴 비도
  daggerDamage: 26, daggerRankDamage: 9, daggerRange: 86, daggerRankRange: 6, daggerCooldown: .42, daggerArc: .3,
  knifeDamage: 22, knifeRankDamage: 11, knifeSpeed: 700, knifeCooldown: 1.3, knifeLife: .8, knifePierce: 1,
  shadowInterval: .7, shadowTargets: 3, shadowRange: 280, shadowDamage: 44, venomTime: 3, venomShare: .45,
  // 주술 (지팡이·방울·홀 장수): 둘레로 퍼지는 방울 파동 + 적을 쫓는 혼불
  bellDamage: 38, bellRankDamage: 14, bellRadius: 130, bellRankRadius: 10, bellCooldown: .95,
  soulDamage: 34, soulRankDamage: 16, soulSpeed: 300, soulCooldown: 1.8, soulLife: 2.6, soulTurn: 5, soulRadius: 44,
  riteInterval: 2.2, riteRadius: 230, riteDamage: 120, stormOrbs: 4, stormRadius: 110, stormDamage: 40, stormInterval: .25,
  // 돌팔매 (11-16 형: 「돌팔매는 슬링샷 사운드 같은 거 찾으면 만들 수 있지 않을까?」 · 초팔 팔매): 포물선으로 떨어져 둘레를 치는 돌 + 적 사이를 튀는 물수제비
  //   돌은 언제나 slingFlight 초 만에 떨어진다(먼 적일수록 빨리 날아감 · 그림의 포물선 높이 slingArc) · 떨어진 둘레 slingSplash(+단계마다) · 4단계부터 slingWide 배 · 맞은 적을 slingKnock 만큼 밀어냄
  slingDamage: 34, slingRankDamage: 15, slingRange: 360, slingCooldown: .85, slingFlight: .3, slingSplash: 36, slingRankSplash: 3, slingWide: 1.4, slingKnock: 16, slingArc: 70,
  //   물수제비: 맞힐 때마다 skipRange 안의 다음 적으로 튄다 (튀는 수 = skipBounces + 단계/2)
  skipDamage: 28, skipRankDamage: 14, skipSpeed: 620, skipCooldown: 1.6, skipLife: .9, skipBounces: 2, skipRange: 210,
  //   굴러가는 바위(조합): boulderInterval 초마다 가장 많이 걸리는 줄로 · 어지럼 돌(조합): 물수제비에 맞으면 dazeTime 초 멈춤
  boulderInterval: 2.4, boulderDamage: 95, boulderSpeed: 260, boulderLife: 2.4, boulderRadius: 44, boulderKnock: 22, dazeTime: .9,
} as const
/**
 * 열전 그리기의 말 — 누구 것인가 (11-18 형 플립: 「적 공격 이펙트랑 내 공격 이펙트가 헷갈림 · 내 발밑에 노란 원 생기다 불 나오던데 내가 맞는 공격 맞지?」).
 * 그리기만 (판의 셈은 그대로 · src/raid/haebi-view.ts). 약속은 하나: **붉은 것 = 적이 나를 때릴 자리 · 금빛·하늘빛 = 내 것**(피할 필요가 없어 덜 눈에 띄게).
 * 예전엔 거꾸로였다: 적이 던진 돌 자리는 누런 타원(내 발밑 금빛 표식에 덮였다), 내 화살비 자리는 붉은 불 고리.
 * foe 적이 나를 때릴 자리 — 돌·불 던지기 · 일제 사격 · 두목·곰 내려찍기가 한 꼴 (맞는 범위 그대로의 원):
 *   rim·rimDark 붉은 테와 그 밑 검붉은 받침(굵기 rimWidth·rimDarkWidth px · 밝은 땅·눈밭에서도 읽히게) · fill 바닥 붉은빛(짙기 fillAlpha · 맥박 pulse rad/초 · 깊이 pulseDepth)
 *   hatch* 바닥 빗금: 줄 사이 hatchGap px · 굵기 hatchWidth · 짙기 hatchAlpha · 흐르는 빠르기 hatchSlide px/초 (꽉 찬 붉은 동그라미가 아니라 테와 빗금으로)
 *   close* 가운데로 줄어드는 고리 = 남은 시간 (흰 속 hot 굵기 closeWidth · 붉은 겉 closeRim)
 *   flash 떨어지기 직전 한 번 번쩍이는 시간(초) · flashAlpha 그 짙기 · artFrom→artTo 용암 테 그림(ui/mark-slam) 짙기 처음→끝 · artScale 그림의 테가 맞는 범위에 닿게 키우는 몫
 *   onPulse·onWidth·onAlpha 내가 그 안에 서 있으면 테가 한 겹 더 빠르게 뛴다 (rad/초 · px)
 *   flameFill 타는 불바닥 둘레의 붉은 바닥 짙기 (불 그림 둘레에 붉은 테 = 여기 서면 아프다)
 *   shock 떨어진 뒤 붉은 테가 퍼져 나가는 몫 · line 돌진·투창 겨눔 줄 · buff 무당이 북돋는 고리(나를 때리지 않는다 · 검붉고 가늘게 buffWidth)
 *   lob* 던진 돌·기름 단지: 포물선 높이 lobArc · 손 높이 lobLift · 크기 lobSize · 붉은 꼬리 점 lobTail 개(포물선 몫 lobTailGap 간격) · jar·jarHot 기름 단지 빛
 * own 내 것:
 *   rim·rimWidth·rimAlpha 내 기술(화살비)이 떨어질 자리의 가는 금빛 테 · motes 안으로 모이는 빛 알 수(mote 빛 · moteSize px · moteAlpha)
 *   heroMark 내 발밑 표식 짙기 · heroMarkDim 맞을 자리 안에 섰을 때 (적의 붉은 표식이 위에서 더 진하게 보이게 물러난다)
 *   grit 영웅의 투지를 켠 순간 번지는 고리 빛 (예전엔 붉게 그려졌다) · ring 내 터짐 위로 번지는 가는 고리 굵기·짙기
 * trail 날아가는 것의 꼬리: 적의 화살·창 = 검붉은 받침 + 붉은 줄(foeLen · foeWidth px) · 내 것 = 무기 묶음 빛 한 줄(ownLen · ownWidth · ownAlpha)
 * aura 장수 오라 손잡이(입자 꼴은 FX_AURA): 적이 crowd 명을 넘으면 입자를 crowdDensity 몫만(늑대 떼 장면 프레임) · 각성 시전 동안 castFrom 몫에서 차오른다
 */
export const HAEBI_FX = {
  foe: {
    rim: '#ff3226', rimDark: '#3a0606', hot: '#ffe6dc', fill: '#ff2414', rimWidth: 3, rimDarkWidth: 6.5,
    fillAlpha: .2, pulse: 8, pulseDepth: .45,
    hatchGap: 13, hatchWidth: 2.4, hatchAlpha: .5, hatchSlide: 22,
    closeWidth: 2, closeRim: 5,
    flash: .16, flashAlpha: .7, artFrom: .5, artTo: 1, artScale: 1.05,
    onPulse: 16, onWidth: 3, onAlpha: .9,
    flameFill: .16,
    shock: .45, line: '#ff3a2c', buff: '#b3262e', buffWidth: 2.5,
    lobArc: 160, lobLift: 20, lobSize: 7, lobTail: 3, lobTailGap: .055, jar: '#ff7a2a', jarHot: '#ffe2a0',
  },
  own: {
    rim: '#ffe7a6', rimWidth: 1.6, rimAlpha: .55, motes: 6, mote: '#f3fbff', moteSize: 3, moteAlpha: .8,
    heroMark: .8, heroMarkDim: .3, grit: '#9fdcff', ringWidth: 2, ringAlpha: .7,
  },
  trail: { foeLen: 34, foeWidth: 3, ownLen: 24, ownWidth: 2, ownAlpha: .55 },
  aura: { crowd: 120, crowdDensity: .6, castFrom: .35 },
} as const
/**
 * 오라 입자 (11-18 형: 「투지 오라랑 각성 오라 이펙트도 필요」) — src/raid/fx-aura.ts · 열전 장수에 쓰고 본편에서도 쓴다 · 그리기만.
 * 덩어리 그림 한 장을 통째로 움직이지 않는다 — 낱낱 입자: 불꽃 가닥(불꽃 그림 한 장에 빛깔만 입혀 N번) · 불티(낱알) · 발밑 고리.
 * 입자 자리는 시계와 번호로만 셈한다(판의 셈과 무관 · 같은 시각이면 늘 같은 그림). filter·shadowBlur 없음 · 그라디언트는 한 번 만들어 다시 쓴다.
 * 길이·퍼짐은 몸 키의 몫(다른 키의 그림에도 그대로) · 굵기·고리는 px.
 *  grit 「투지」(불꽃이 찬 힘 · 모습 그대로): 하늘빛·흰빛 가는 가닥이 몸에서 오르고 발밑에 얇은 고리 — 차분하게 「버틴다」
 *  awake 「각성」: 금빛 불기둥 가닥이 몸 뒤에서 솟고(몸 앞에도 몇 가닥 = 깊이) 금 불티가 흩어 오르고 발밑 금 고리가 맥박친다 — 한눈에 크고 뜨겁다
 * 칸: colors 가닥 빛 셋(으뜸 · 속 · 짙은) · back·front 몸 뒤·앞 가닥 수 · rise 오르는 높이 · frontRise 앞 가닥은 그 몫만 · taper 바깥 가닥일수록 낮게(기둥 꼴) ·
 *  spread 좌우 퍼짐 · gather 오르며 가운데로 모이는 몫 · w·h 가닥 굵기·길이 · vary 가닥마다 크기·빠르기 들쭉날쭉 · thin 오르며 가늘어지는 몫 ·
 *  rate 한 번 오르는 빠르기(1/초) · sway 흔들림 px · swayRate rad/초 · alpha 짙기 · fadeIn 피어나는 구간(오름의 몫) · lift 구울 때 희게 띄우는 몫(밝은 땅에서도 보이게) ·
 *  sparks 불티 수 · spark 크기 px · sparkRate 빠르기 · sparkFrom→sparkRise 뜨는 높이 처음→끝 · drift 옆으로 흩어지는 폭 · twinkle 반짝임 rad/초 ·
 *  ring 발밑 고리 반지름 · ringWidth · ringAlpha · beat 맥박(1/초) · beatGrow 맥박 고리가 번지는 몫 · arcs 거꾸로 도는 끊긴 고리의 호 수(0 = 없음) · arcR 그 반지름 몫 · spin rad/초 ·
 *  glow 몸 뒤 둥근 빛 반지름(0 = 없음) · glowAlpha · tintEvery 무기 묶음 빛이 섞이는 가닥(몇 개마다 하나 · 0 = 안 섞음) · add 빛으로 더하는가(1) 덧칠인가(0 · 밝은 땅에서 하얗게 날지 않게)
 *  burst 켜지는 순간 한 번: life 초 · radius 고리가 번지는 끝 px · rings 고리 수 · width 고리 굵기 · sparks 흩어지는 불티 수 · lift 불티가 뜨는 높이 px · pillars 솟구치는 가닥 수 · pillarRise 그 높이(몸 키 몫)
 * density 입자 수 몫(전체) · minCount 줄여도 남기는 수 · flat 발밑 고리 납작함 · small 화면 짧은 변이 이 px 아래면 smallDensity 몫만(폰)
 * 그림: 가닥 = 본편 각성 불꽃(fx/awaken/flame) · 불티 = 불티 낱알(fx/awaken/ember) · 고리 = 열전 방울 고리(raid/bell-ring) — 오라 빛마다 한 번만 빛깔을 입혀 굽는다.
 *  bake·emberBake 구운 그림의 키 px · emberWide·emberTall 불티 낱알의 너비·키(불티 크기의 몫) · ringArt 고리 그림을 그 반지름에 맞추는 몫 · arcWidth 끊긴 고리 굵기
 */
export const FX_AURA = {
  density: 1, minCount: 2, flat: .36, small: 480, smallDensity: .75,
  bake: 96, emberBake: 28, emberWide: 2.2, emberTall: 4.6, ringArt: 1.3,
  grit: {
    colors: ['#58bdff', '#cfeeff', '#3a98ff'], back: 9, front: 4, rise: 1.05, frontRise: .6, taper: .3, spread: .38, gather: .35,
    w: 17, h: 50, vary: .5, thin: .45, rate: .6, sway: 3, swayRate: 3.2, alpha: 1, fadeIn: .15, lift: .2,
    sparks: 8, spark: 2.2, sparkRate: .5, sparkFrom: .1, sparkRise: 1.15, drift: .1, twinkle: 14,
    ring: 34, ringWidth: 1.8, ringAlpha: .8, beat: .7, beatGrow: .55, arcs: 0, arcR: 1.4, arcWidth: 0, spin: 0,
    glow: 46, glowAlpha: .55, tintEvery: 0, add: 0,
    burst: { life: .5, radius: 110, rings: 1, width: 3, sparks: 10, lift: 30, pillars: 0, pillarRise: 0 },
  },
  awake: {
    colors: ['#ffc02e', '#ffe58a', '#ff8a1e'], back: 14, front: 4, rise: 1.6, frontRise: .45, taper: .45, spread: .44, gather: .5,
    w: 28, h: 78, vary: .5, thin: .45, rate: .95, sway: 5, swayRate: 5, alpha: .95, fadeIn: .1, lift: .1,
    sparks: 16, spark: 2.8, sparkRate: .8, sparkFrom: .1, sparkRise: 1.5, drift: .55, twinkle: 20,
    ring: 46, ringWidth: 4, ringAlpha: .95, beat: 1.25, beatGrow: .7, arcs: 3, arcR: 1.5, arcWidth: 2, spin: 2.4,
    glow: 62, glowAlpha: 1, tintEvery: 4, add: 0,
    burst: { life: .7, radius: 230, rings: 2, width: 7, sparks: 26, lift: 70, pillars: 8, pillarRise: 2.3 },
  },
} as const
/**
 * 열전 비기 — 무기 묶음마다 꼴이 다르다 (형 11-16: 「무기마다 확실히 다르게 · DPS 예측해서 밸런스 조절」 · 재는 길 tools/raid-ult-dps.ts · docs/BALANCE.md).
 * damage 는 한 번 맞을 때 피해(× powerScale) · cooldown 재사용(초) · fx 그림이 머무는 시간(초) · 너비·반지름은 「큰 물결」 범위를 곱한다.
 * axe 천지 가르기: 내려찍은 발밑 둘레 burst 가 터지고, 가장 많이 걸리는 쪽으로 길이 length · 반폭 width 의 땅을 가른다 (넓고 짧게)
 * bow 하늘 꿰뚫기: 가장 많이 꿰는 줄로 화면을 가로지르는 큰 화살 한 대 (length 는 화면 대각선보다 길게)
 * spear 용오름 창: 몸 둘레로 창날이 pulses 번 솟는다 — gap 초마다 반지름 r0 → r1 로 넓어지며 knock 만큼 바깥으로 밀어낸다
 * sword 번개 베기: 움직이는 쪽(±cone 라디안 안에서 가장 많이 걸리는 줄 · 서 있으면 아무 쪽)으로 length 만큼 내달아(장수가 실제로 옮겨 간다) 지나간 줄(반폭 width)을 벤다
 * dagger 그림자 베기: range 안의 가장 가까운 적에게 차례로 targets 번 순간 이동해(gap 초 간격 · 적 곁 beside px) 그 둘레 splash 를 베고, 처음 자리로 돌아온다
 * magic 하늘 굿: 화면의 모든 적에게 신령 번개 (그리는 번개 줄은 bolts 개까지 · 피해는 모두에게)
 * sling 돌벼락: range 안에서 가장 많이 걸리는 자리를 골라 그 둘레 radius 에 waves 물결 × stones 개 돌이 gap 초 간격으로 떨어진다 (돌마다 둘레 splash · 가운데일수록 여러 번)
 */
/**56B wall-time policy; legacy HAEBI_ULT values below stay unchanged for53B/56A replay. */
export const HAEBI_AWAKEN_ULT = { normalWall: .4, normalEmpoweredWall: .5, normalSlow: .5, firstWall: 1.8, slow: .1, shortFactor: .5, enemyDaze: .3,
  enterFraction: .24, exitSeconds: .12, slideX: .42, slideY: .2, startScale: .94, dim: .72, bowArtHeight: 250, bowFallHeight: 220, magicArtHeight: 200 } as const
export const HAEBI_ULT = {
  axe: { cooldown: 13, damage: 170, length: 440, width: 80, burst: 240, fx: .75 },
  bow: { cooldown: 13, damage: 400, length: 1400, width: 42, fx: .6 },
  spear: { cooldown: 13, damage: 140, pulses: 3, gap: .15, r0: 130, r1: 285, knock: 40, fx: .5 },
  sword: { cooldown: 13, damage: 430, length: 500, width: 110, cone: 1.57, fx: .5 },
  dagger: { cooldown: 13, damage: 110, targets: 8, range: 320, gap: .07, splash: 40, beside: 24, fx: .38 },
  magic: { cooldown: 13, damage: 23, bolts: 40, fx: .5 },
  sling: { cooldown: 13, damage: 60, waves: 4, stones: 7, gap: .12, radius: 165, splash: 46, range: 480, fx: .5 },
  /** 줄 비기(도끼·활·칼)가 견줘 보는 방향 수 — 가까운 적 이만큼 쪽으로 줄을 대 보고 가장 많이 걸리는 쪽 */
  aimTries: 16,
  /**
   * 시전 (11-17 형: 「궁극기는 캐스팅 시간을 약간 줘야 컷인도 보고, 컷인 끝나고 적들이 데미지 입는 연출도 보고」) —
   * 비기를 누르면 cast 초(판 시각) 동안 기를 모으고 끝나는 순간 터진다. 시전 동안 판이 slow 배로 느려지고(화면에선 cast ÷ slow 초) 장수는 다치지 않는다.
   * 진 비기 (각성 중): 시전 trueCast 초 · 피해 ×trueDamage · 범위(너비·반지름) ×trueArea · 이름 앞에 「진」
   */
  cast: .55, slow: .5, trueCast: .65, trueDamage: 1.5, trueArea: 1.25,
  /**
   * 비기가 열리는 레벨 (11-19 형: 「시작은 평타만 가지고 해야 하는 거 아님??」) — 판은 평타만으로 시작하고, 첫 레벨업(1→2)에서
   * Space 단추가 금빛으로 터지며 열린다. 시련(8분)도 같은 규칙 · 선봉은 HAEBI_VANGUARD.startLevel 로 시작하니 처음부터 열려 있다.
   * unlockFlash = 열리는 순간 단추가 빛나는 초(화면 초 · 그리기만) · unlockRing = 열리는 순간 장수 둘레에 퍼지는 금빛 고리 반지름(px)
   */
  unlockLevel: 2, unlockFlash: 1.6, unlockRing: 150,
} as const
/**
 * 열전 기술 나무 (11-17 · docs/realm/RAID-LINK.md §2 디아블로식) — 조건이 찬 조합은 레벨업에 금테 카드로 나오고, 골라야 열린다.
 * 연 조합은 다시 나와 max 단계까지 · 단계마다 조합 피해(어지럼은 멈춤 시간)가 rankStep 씩 붙는다.
 * upgradeChance: 이미 연 조합이 레벨업 카드 하나로 다시 나올 몫 (새로 조건이 찬 조합은 늘 나온다 · 한 번에 조합 카드는 하나)
 * 조합 하나를 max 단계로 올리면 3층 「비기 강화」 — 비기 피해 ×ultDamage · 범위 ×ultArea · 재사용 ×ultCooldown
 */
/** 53B stage champions; initial values are measured against the frozen forty-run Before. */
/** 55 Imugi initial proposals. Only the prepared ford rules use these values. */
export const HAEBI_GIANT = {
  cameraZoom: .8,
  midFraction: 600 / 1140, midHpScale: 1, fightBudget: 240, enrageAfter: 180, enrageDamage: 1.2,
  hp: 900000, partHpShare: .08, headDamage: 1.5, recoveryHeadDamage: 2,
  phaseCuts: [.7, .35], entrySeconds: .9, roarSeconds: .65, bodySeconds: .5, strikeSeconds: .18,
  /** body 시작부터 첫 타격까지의 총예고. moves.tell은 짧은 박자의 총시간 후보입니다. */
  windup: { min: .5, max: 2.5, repeatHold: .3, minRed: .25, epsilon: 1e-9 },
  playerDiameter: 40, safeDiameters: 3, safeGrid: 40, idleRecovery: 1.2,
  motion: {
    impactAt: .65, mouthClearance: 80, minRelocate: 20, envelopeSteps: 8, turnHideStart: .15, turnHideSpan: .2, turnShowStart: .65, turnHiddenWindow: .5,
    slamHead: -.55, riseHead: -1.05, fallHead: .35,
    rest: [.08,-.12,.12,.15,-.30,.22,.12,-.22,.16,-.06],
    submergeOrder: ['head','jaw','neck-top','neck-mid','neck-base','root','body1','body2','body3','tail1','tail2','tail3','tail-tip'],
    brokenBend: { root: .06, 'neck-base': .55, 'neck-mid': .75, 'neck-top': -.5, head: .12, jaw: .55,
      body1: .35, body2: .35, body3: -.3, tail1: .3, tail2: -.3, tail3: .2, 'tail-tip': -.15 },
    // neck3,body3,tail3+tip. These author motion, never add attacks or damage.
    profiles: {
      emerge: { prepare: [.3,-.25,.2,.4,-.6,.3,.4,-.3,.2,-.1], impact: [.08,-.12,.12,.15,-.30,.22,.12,-.22,.16,-.06], neck: 1, body: .92, width: 1 },
      'jaw-dash': { prepare: [.4,-.1,-.2,.2,-.4,.25,-.3,.35,-.2,.1], impact: [.4,-.1,-.2,.2,-.4,.25,-.3,.35,-.2,.1], neck: .82, body: .35, width: 1 },
      'tail-sweep': { prepare: [0,.2,-.1,.08,-.16,.12,-.9,.25,-.15,.05], impact: [0,.2,-.1,.08,-.16,.12,.9,-.10,.08,-.03], neck: 1, body: 1, width: 1 },
      'water-fan': { prepare: [-.18,.5,-.3,.2,-.3,.15,.1,-.2,.1,0], impact: [-.18,.5,-.3,.2,-.3,.15,.1,-.2,.1,0], neck: 1.05, body: .35, width: 1.25 },
      'neck-slam': { prepare: [-.55,.75,-1.05,.25,-.35,.2,-.05,.15,-.1,0], impact: [.7,-.6,.45,.25,-.35,.2,-.05,.15,-.1,0], neck: 1.15, body: .95, width: 1 },
      'failed-rise': { prepare: [-.62,-.3,.2,.5,-.65,.4,.2,-.25,.15,0], impact: [.9,-.85,.75,-.2,.4,-.2,-.15,.25,-.2,.1], neck: 1.2, body: .9, width: 1 },
    },
  },
  headTurnLimit: 1, poseBoundsPadding: 110, recoveryNeck: .3, bodyNeck: -.22, jawOpen: .4,
  environmentTell: 2, environmentEvery: 1, environmentDamage: 8, environmentBorder: 28, environmentSide: 112, environmentInner: 320,
  moves: {
    emerge: { phase: 1, min: 0, max: 900, tell: 2, recover: 1.5, damage: 26, radius: 120 },
    'jaw-dash': { phase: 1, min: 70, max: 700, tell: 1.2, recover: 1.2, damage: 28, width: 120, lengthShare: .6 },
    'tail-sweep': { phase: 1, min: 0, max: 500, tell: 1.6, recover: 1.5, damage: 28, inner: 160, outer: 240, halfAngle: 1.25 },
    'water-fan': { phase: 1, min: 80, max: 900, tell: 2.1, recover: 2, damage: 25, rangeShare: .55, halfAngle: 35 * Math.PI / 180 },
    'neck-slam': { phase: 2, min: 0, max: 900, tell: 1.8, recover: 1.5, damage: 30, rx: 80, ry: 120 },
    'failed-rise': { phase: 3, min: 0, max: 900, tell: 2.5, followTell: 1, recover: 2, damage: 32, radius: 160, waveInner: 140, waveOuter: 220 },
  },
  pose: {
    // ID,parent,relative angle,length,radius; head/jaw use source sockets below.
    parts: [['root', null, 0, 0, 42], ['neck-base', 'root', -.9, 55, 30], ['neck-mid', 'neck-base', .3, 50, 27],
      ['neck-top', 'neck-mid', .35, 45, 24], ['head', 'neck-top', .25, 0, 0], ['jaw', 'head', 0, 0, 16],
      ['body1', 'root', Math.PI + .1, 75, 40], ['body2', 'body1', -.1, 70, 35], ['body3', 'body2', .08, 65, 30],
      ['tail1', 'body3', -.1, 55, 24], ['tail2', 'tail1', .1, 45, 19], ['tail3', 'tail2', -.08, 35, 14], ['tail-tip', 'tail3', .1, 0, 9]],
    headCenter: [95, 25], headRadii: [80, 45],
  },
  view: { widths: [70,75,80,108,100,90,78,65,55,44], headScale: .30, jawScale: .18, tipScale: .09,
    maxQuads: 96, perEdge: 8, period: 700, screenStep: 10, densityMin: .25, densityMax: 16,
    partHpWidth: 36, partHpHeight: 3, partHpLift: 6, waterOuterShare: .35, waterCoreShare: .10, waterAlpha: .6, waterOuter: '#69abb8', waterCore: '#d7f1ed' },
} as const

/**
 * 55 설원 고개 거대 보스 「백두 대호」 (11-22 형: 흑룡 → 호랑이 그 자체 · docs/realm/BOSS.md 백두 대호 표) — 규칙 55-TIGER 의 설원 판에만 쓴다.
 * 막·분노·시간 예산·안전로 3P·머리 배율·환경 피해 박자는 HAEBI_GIANT 의 공통 계약을 그대로 쓰고, 여기엔 범만의 값만 둔다.
 *  hp 본체 · midHpScale 10분 중간 보스(설산 우두머리)의 체력 몫(설원 두목은 여울의 두 배라 반으로 둔다) · parts 부위 체력 = hp × 몫 (가산 체력이 아니다 · 본체도 같이 깎인다)
 *  entrySeconds·entryDrop 등장: 하늘에서 내려앉는 초·높이 · roarSeconds 막 전환 포효 · staggerSeconds 회복 중 첫 타격의 움찔(그만큼 회복이 늘어 난다 · staggerRecover 상한)
 *  homeY·homeBand 평소 발 자리(판 y)와 그 둘레 · prowl* 다가가 서성임(초 · px/초 · 걸음 한 바퀴 거리) · idleRecovery 할 수가 없을 때 쉬는 초
 *  moves: phase 처음 여는 막 · body 몸 예고 · red 붉은 바닥 예고(초) · recover 회복(머리 노출) · strike 타격 몸놀림 초 · impactAt 그 가운데 판정 몫 · damage 피해 (× 스테이지 피해)
 *   swipe 앞발 후려치기: radius 부채 반지름 · halfAngle 반각 · reach 발에서 이 거리 안 · swing 발을 휘두르는 거리
 *   tail 꼬리 채찍: inner·outer 호 · halfAngle · reach 꼬리 뿌리에서 이 거리 안(등 뒤만)
 *   pounce 덮치기: wiggle 엉덩이 흔듦(seeded 0~이 초 · 몸 예고 뒤 · 붉은 예고 앞) · min·max 뛰는 거리 · rx·ry 착지 타원(긴 축이 뛰는 쪽) · hop 공중 높이 · brokenLeap 뒷다리가 하나라도 부서지면 거리 몫
 *   roar 포효(눈보라): band 좌우 띠 너비 몫(판 폭) · push 띠 안에서 밀려나는 px
 *   dive 눈 속 잠행: radius 솟구침 원 · spread 눈 더미 사이 · tailAt 화살 묶음이 부서지면 꼬리가 먼저 보이는 때(몸 예고 몫) · floor 더미가 판 아래 끝에서 떨어지는 몫(× radius · 아래 체력 막대에 가리지 않게)
 *   avalanche 눈사태: width 줄 폭 · gap 줄 사이 · strike 내리찍기부터 줄이 판 끝까지 내려오는 초(impactAt 몫에 내리찍고 남은 동안 내려온다) · lines 줄 수(앞다리가 하나라도 부서지면 brokenLines)
 *  env 막별 환경: border 막1 바깥 서리 띠(위아래 띠는 가운데 gap 을 비운다) · side 막2 양옆 눈보라 띠 · strips 막3 눈사태 줄 [x 몫, 폭] (가운데 세로 3P 는 늘 빈다)
 *  rig 몸 뼈대 (발 바닥 가운데가 0 · 앞이 +x · 아래가 +y · scale 을 곱한다) — 판정과 그림이 같은 뼈를 쓴다
 *  motion 수마다 몸 준비(prepare)·타격(impact) 자세: lift 몸 높이(+ 아래) · pitch 앞 들기(라디안) · shift 앞뒤 · neck·head 숙임(+ 아래) · jaw 벌림 0~1 · roar 포효 머리 · tail 꼬리 마디 넷 · paw 발 [앞 가까운 x,y · 앞 먼 · 뒤 가까운 · 뒤 먼] · sink 눈 속
 *  view (그리기만): 부위 그림 자리는 src/raid/tiger-art.ts · 김·흔들림·옅어짐 값
 */
export const HAEBI_TIGER = {
  hp: 1200000, midHpScale: .5,
  parts: { head: .1, jaw: .06, 'fore-near': .07, 'fore-far': .07, 'hind-near': .07, 'hind-far': .07, tail: .06, arrows: .05 },
  entrySeconds: 1.6, entryDrop: 620, roarSeconds: 1.1, staggerSeconds: .45, staggerRecover: .4,
  homeY: 470, homeBand: 70, prowlSeconds: 1.4, prowlSpeed: 120, prowlStride: 150, prowlNear: 230, idleRecovery: .9,
  /** turnDeadZone 장수가 이만큼(px) 안쪽 위아래면 돌아서지 않는다 · homePull 발 자리가 homeBand × 이만큼 벗어나면 먼저 제자리로 걸어간다 · prowlMin 이보다 가까우면 걷지 않는다 · sinkHidden 눈 속에 이만큼 잠기면 안 보이고 안 맞는다 */
  turnDeadZone: 12, homePull: 1.5, prowlMin: 12, sinkHidden: .5,
  moves: {
    /** swipe 덧: tilt 발에서 장수 쪽 부채 각의 한계 · backTilt 반대쪽(먼 발이면 아래·가까운 발이면 위)은 그 몫만 · sideBias 발 자리보다 이만큼 위까지는 가까운 발 · dip 앞으로 휘두를 때 발이 아래로 내려오는 몫 */
    swipe: { phase: 1, body: .5, red: .3, recover: 1, strike: .2, impactAt: .5, damage: 24, radius: 160, halfAngle: Math.PI / 4, reach: 240, tilt: .9, backTilt: .25, sideBias: 10, dip: .5, swing: 120 },
    tail: { phase: 1, body: .6, red: .9, recover: 1.5, strike: .32, impactAt: .5, damage: 26, inner: 200, outer: 280, halfAngle: 70 * Math.PI / 180, reach: 360 },
    pounce: { phase: 1, body: .4, red: .8, wiggle: .8, recover: 1.8, strike: .45, impactAt: .92, damage: 30, min: 140, max: 640, rx: 100, ry: 60, hop: 110, brokenLeap: .5 },
    roar: { phase: 2, body: .8, red: 1, recover: 2, strike: .3, impactAt: .3, damage: 22, band: .3, push: 80 },
    dive: { phase: 2, body: .8, red: 1.2, recover: 1.5, strike: .3, impactAt: .25, damage: 30, radius: 120, spread: 300, tailAt: .5, floor: .8 },
    avalanche: { phase: 3, body: .7, red: 1.3, recover: 2, strike: 1, impactAt: .12, damage: 32, width: 80, gap: 120, lines: 3, brokenLines: 2 },
  },
  env: { border: 28, gap: 160, side: 96, strips: [[.2, 64], [.8, 64]] },
  rig: {
    scale: .82,
    body: { pivot: [0, -238], half: 160, radius: 82 }, hip: [-140, -226], shoulder: [132, -222],
    neckBase: [176, -282], tailBase: [-200, -274], arrows: [-6, -324], arrowsRadius: 30,
    fore: { up: 112, low: 128, bend: 1, paw: [150, 6], radius: 24 },
    hind: { up: 104, low: 132, bend: -1, paw: [-130, 6], radius: 26 },
    far: [16, -12],
    neck: { length: 74, angle: -.62, radius: 40 },
    head: { angle: .12, center: [62, -8], radii: [64, 52], mouth: [128, 24], hinge: [40, 30] },
    jaw: { length: 72, angle: .16, open: .55, radius: 16, dangle: .62 },
    tail: { lengths: [76, 72, 68, 76], rest: [1.95, .25, .35, .5], radius: [17, 15, 13, 12] },
  },
  motion: {
    rest: { lift: 0, pitch: 0, shift: 0, neck: 0, head: 0, jaw: 0, roar: 0, tail: [0, 0, 0, 0], paw: [0, 0, 0, 0, 0, 0, 0, 0], sink: 0 },
    recover: { lift: 14, pitch: -.06, shift: 6, neck: .32, head: .38, jaw: .3, roar: 0, tail: [.25, .15, .1, .1], paw: [10, 0, 6, 0, 0, 0, 0, 0], sink: 0 },
    swipe: {
      prepare: { lift: 14, pitch: -.14, shift: -18, neck: .14, head: .2, jaw: .45, roar: 0, tail: [-.2, -.1, 0, 0], paw: [-58, -120, 0, 0, 8, 0, 4, 0], sink: 0 },
      impact: { lift: 18, pitch: -.14, shift: 22, neck: .18, head: .22, jaw: .6, roar: 0, tail: [.15, .1, 0, 0], paw: [0, 0, 0, 0, 14, 0, 10, 0], sink: 0 },
    },
    tail: {
      prepare: { lift: 4, pitch: .03, shift: -8, neck: -.12, head: -.08, jaw: .2, roar: 0, tail: [2.2, .2, .25, .3], paw: [0, 0, 0, 0, -12, 0, -8, 0], sink: 0 },
      impact: { lift: 6, pitch: -.02, shift: 6, neck: -.05, head: 0, jaw: .3, roar: 0, tail: [.15, -.2, -.3, -.45], paw: [0, 0, 0, 0, 10, 0, 6, 0], sink: 0 },
    },
    pounce: {
      prepare: { lift: 46, pitch: -.08, shift: -26, neck: .22, head: .2, jaw: .2, roar: 0, tail: [.35, .2, .2, .15], paw: [12, 0, 10, 0, 22, 0, 20, 0], sink: 0 },
      impact: { lift: 14, pitch: -.12, shift: 18, neck: .2, head: .24, jaw: .7, roar: 0, tail: [-.3, -.2, -.1, 0], paw: [34, 0, 30, 0, 6, 0, 4, 0], sink: 0 },
      wiggleShift: 9, wiggleHz: 3.6, wiggleTail: .25,
    },
    roar: {
      prepare: { lift: -8, pitch: .14, shift: -6, neck: -.3, head: -.32, jaw: 0, roar: 1, tail: [-.4, -.3, -.2, -.2], paw: [0, 0, 0, 0, 0, 0, 0, 0], sink: 0 },
      impact: { lift: -18, pitch: .2, shift: 10, neck: -.42, head: -.46, jaw: 0, roar: 1, tail: [-.6, -.4, -.3, -.3], paw: [16, 0, 12, 0, 0, 0, 0, 0], sink: 0 },
    },
    dive: {
      prepare: { lift: 60, pitch: -.2, shift: 10, neck: .4, head: .3, jaw: 0, roar: 0, tail: [.4, .2, .1, 0], paw: [30, 0, 26, 0, 10, 0, 8, 0], sink: 1 },
      impact: { lift: -24, pitch: .24, shift: 10, neck: -.25, head: -.3, jaw: .7, roar: 0, tail: [-.5, -.3, -.2, -.2], paw: [20, -30, 16, -24, 0, 0, 0, 0], sink: 0 },
    },
    avalanche: {
      prepare: { lift: -40, pitch: .58, shift: -18, neck: -.35, head: -.2, jaw: .45, roar: 0, tail: [.5, .3, .2, .2], paw: [24, -300, 10, -285, 10, 0, 6, 0], sink: 0 },
      impact: { lift: 18, pitch: -.12, shift: 26, neck: .22, head: .26, jaw: .65, roar: 0, tail: [-.4, -.2, -.1, 0], paw: [34, 0, 30, 0, 4, 0, 2, 0], sink: 0 },
    },
    limp: { lift: -46, back: -10, sag: .05 }, droop: [-.4, -.22, -.32, -.45], breath: { lift: 2.5, hz: .35, tail: .09, tailHz: .21, tailPhase: .7 },
    walk: { swing: 34, raise: 26, bob: 4, tail: [.15, .12] }, stagger: { shift: -16, pitch: .08, head: -.2 },
    /** 등장: 떨어지는 몫(앞 fall 동안 내려오고 남은 동안 눌렸다 편다) · 눌림 px · 앞 숙임 · 입 벌림 */
    entry: { fall: .7, squash: 34, pitch: .06, jaw: .5 },
  },
  /**
   * behind* 장수가 몸 뒤(발보다 위)에 서면 옅게 · brokenShade 부서진 부위 덧칠 · puff* 입김(초마다 · 머무름 · 오름 · 크기 · 짙기 · 회복 중 간격)
   * snowRim 눈빛 · mound* 잠행 눈 더미(짙기 · 가로 · 높이) · peekHeight 꼬리 끝이 솟는 높이 · frontAlpha 눈사태 · roarAlpha 포효 눈보라
   * break* 부서지는 서리 터짐(초 · 크기) · fall* 화살 묶음이 떨어지는 초·거리 · sink* 눈 속으로 잠기는 깊이·땅 가림 · shadow* 발밑 큰 그림자
   */
  view: {
    /** turnSquash 돌아서는 순간 가로로 눌리는 몫 · fallDrift·fallSpin 떨어지는 화살 묶음이 뒤로 밀리는 px·도는 라디안 */
    turnSquash: .7, fallDrift: 40, fallSpin: 1.6,
    behindAlpha: .52, behindPad: 10, brokenShade: 'rgba(38,46,66,.42)',
    /** 몸 둘레 어두운 외곽선 (GAP §15-6 · 11-22 녹화에서 흰 범이 흰 눈밭에 묻힘) — 그림 px 두께 · 색 · 진하기 · 방향 수 */
    outlinePx: 5, outlineColor: '#141a26', outlineAlpha: .75, outlineDirs: 8,
    puffEvery: 1.4, puffLife: 1.1, puffRise: 26, puffSize: 18, puffAlpha: .34, puffRecover: .55,
    snowRim: '#eef4ff', moundAlpha: .9, moundWidth: 70, moundHeight: 30, peekHeight: 90, frontAlpha: .85, roarAlpha: .38,
    breakLife: .7, breakSize: 70, fallLife: .8, fallDrop: 150, sinkDepth: 430, sinkClip: 8,
    shadowAlpha: .3, shadowShift: 20, shadowWidth: 250, shadowHeight: 34,
    /** 땅을 울린 눈보라 — 크기 · 머무는 초 · 등장 착지는 그 몫만큼 빨리 */
    landSize: 170, landLife: .55, landSpan: 1.6,
    /** 쓰러짐(승리 막 내림): 초 · 그 몫까지는 또렷하다 옅어짐 · 몸이 주저앉는 px · 앞 숙임 · 목·머리 떨굼 · 턱 · 다리가 꺾이는 발 자리 · 꼬리 늘어짐 */
    fallSeconds: 2.6, fallHold: .45, fall: { lift: 120, pitch: .22, neck: .6, head: .55, jaw: .45, paw: [50, 0, 40, 0, -30, 0, -20, 0], tail: [-.5, -.3, -.3, -.4] },
  },
} as const

/**
 * 55 불타는 산성 거대 보스 「불의 무녀 장군」 (docs/realm/BOSS.md 무녀 장군 표 · 무무와 장수를 섞은 창작 인물) — 규칙 55-SHAMAN 의 불타는 산성 판에만 쓴다.
 * 막·분노·시간 예산·안전로 3P·머리 배율·환경 피해 박자는 HAEBI_GIANT 의 공통 계약을 그대로 쓰고, 여기엔 무녀만의 값만 둔다.
 *  hp 본체 · midHpScale 10분 중간 보스(불의 반란 장군)의 체력 몫 · parts 부위 체력 = hp × 몫 (가산 체력이 아니다 · 본체도 같이 깎인다)
 *  entrySeconds 등장(방울이 울리고 불 고리가 피어나 불 속에서 걸어 나온다) · roarSeconds 막 전환(방울을 치켜든다) · stagger* 회복 중 첫 타격의 움찔(그만큼 회복이 는다 · staggerRecover 상한)
 *  homeY·homeBand·homePull 평소 발 자리와 둘레(벗어나면 먼저 돌아온다) · step* 미끄러지듯 다가가는 걸음(초 · px/초 · 장수와 둘 거리 · 이보다 가까우면 안 걷는다)
 *  idleRecovery 할 수가 없을 때 쉬는 초 · turnDeadZone 장수가 이만큼 안쪽 위아래면 돌아서지 않는다 · keySwitch 몸 예고의 이 몫에서 그림 자세가 바뀐다(몸이 바닥보다 먼저)
 *  lane 가운데 세로 안전 길 폭 — 막마다의 불과 화염 맥동이 이 길은 늘 비운다 (3P 이상 · 3P 빈 원을 재는 격자 자리가 길 안에 들게 넉넉히)
 *  moves: phase 처음 여는 막 · body 몸 예고 · hold [최소, 최대] 정지 초를 seeded 로 미리 고른다(정지가 길면 바닥도 늦게 뜬다) · red 붉은 바닥 · next 다음 타의 붉은 바닥(연타)
 *   recover 회복(머리 노출) · strike 타격 몸놀림 초 · impactAt 그 가운데 판정 몫 · damage 피해 (× 스테이지 피해)
 *   sweep 방울·가로 화염: radius·halfAngle 앞 호 · ahead 호 가운데가 발보다 앞선 px · aim 몸 앞에서 장수 쪽으로 돌리는 한계(라디안) · reach 장수가 이 거리 안
 *   ring 원무 지연 화선: radius 고리 가운데 반지름 · width 고리 폭(빈 3P 구간은 셈한다) · reach
 *   pillars 늦은 불기둥: radius 원 반지름 · spread 원 가운데 사이
 *   chase 세 걸음 추격: width·length 줄 하나 · steps 줄 수 · minLength 판 끝에 걸려 줄일 때의 하한 · min 장수가 이보다 가까우면 안 쓴다
 *   twin 낮은 선회 쌍타: inner 안쪽 호 반지름 · outer 바깥 호 · rear 등 뒤 빈 쐐기의 반각 · reach · damage [안, 바깥]
 *   pulse 끊긴 춤·화염 맥동: bands 전장 띠 수(띠 폭 W/bands · 가운데 길은 뺀다) · 타격 동안 왼쪽부터 차례로 탄다
 *  env 막별 환경: border 막1 바깥 불띠(위아래 띠는 가운데 gap 을 비운다) · lines·lineWidth 막2 끊긴 화선 y 몫과 굵기 · lineGap 가운데 길 양옆으로 더 비우는 px · walls 막3 양옆 불벽 폭
 *  rig 몸 판정 자리 — Codex 72 몸 판(boss_fire-shaman_body.png 1230×1278)의 원본 px 그대로 · 자세 넷 (0 서기 · 1 방울 들기 · 2 부채 내지르기 · 3 낮은 자세)
 *   feet 발 바닥 가운데(몸의 기준점) · head [x, y, rx, ry] · torso·skirt·fan·bell [[시작], [끝], 반지름] · waist [x, y, rx, ry] · robeBack·robeFront 옷자락이 매달리는 허리 자리 · scale 원본 1px 의 판 px
 *  motion 자세: key 자세 번호 · lean 앞 숙임(라디안) · lift 아래로 px · squash 키 늘임 몫 · spin 도는 바퀴(원무 · 판정도 같이 좁아진다) · flare 옷자락 펼침 0~1(그리기만)
 *  view (그리기만): 그림 자리는 src/raid/shaman-art.ts
 */
export const HAEBI_SHAMAN = {
  hp: 1300000, midHpScale: .4,
  parts: { head: .1, fan: .08, bell: .08, waist: .06 },
  entrySeconds: 2.4, roarSeconds: 1.2, staggerSeconds: .45, staggerRecover: .4,
  homeY: 450, homeBand: 80, homePull: 1.5, idleRecovery: .9, turnDeadZone: 12, keySwitch: .25,
  stepSeconds: 1.3, stepSpeed: 150, stepStride: 75, stepNear: 230, stepMin: 16,
  lane: 168,
  moves: {
    sweep: { phase: 1, body: .5, hold: [0, .3], red: .4, recover: 1, strike: .3, impactAt: .45, damage: 22, radius: 160, halfAngle: 50 * Math.PI / 180, ahead: 30, aim: 1, reach: 240 },
    /** ring 덧: gapPad 빈 곳을 3P 원보다 넓히는 px */
    ring: { phase: 1, body: 1.1, hold: [0, .5], red: .7, recover: 1.5, strike: .55, impactAt: .15, damage: 24, radius: 200, width: 40, reach: 380, gapPad: 4 },
    pillars: { phase: 1, body: .9, hold: [0, .3], red: 1.3, recover: 1.5, strike: .45, impactAt: .4, damage: 26, radius: 60, spread: 260 },
    chase: { phase: 2, body: .6, hold: [0, .3], red: .6, next: .8, recover: 1.5, strike: .28, impactAt: .5, damage: 18, width: 80, length: 160, steps: 3, minLength: 110, min: 120 },
    twin: { phase: 2, body: .8, hold: [0, .4], red: .6, next: 1, recover: 2, strike: .32, impactAt: .45, damage: [20, 24], inner: 120, outer: 200, rear: .62, reach: 320 },
    pulse: { phase: 3, body: 1, hold: [0, 0], red: 1.5, recover: 2, strike: 1, impactAt: 0, damage: 28, bands: 4 },
  },
  env: { border: 28, gap: 200, lines: [.21, .79], lineWidth: 24, lineGap: 40, walls: 64 },
  rig: {
    scale: .6,
    keys: [
      { feet: [304, 614], head: [311, 82, 36, 40], torso: [[318, 140], [330, 245], 48], skirt: [[325, 300], [305, 516], 95], waist: [336, 258, 58, 30], fan: [[254, 160], [214, 405], 32], bell: [[364, 158], [410, 362], 32], robeBack: [285, 268], robeFront: [375, 268] },
      { feet: [925, 614], head: [910, 80, 36, 40], torso: [[925, 130], [950, 240], 48], skirt: [[950, 290], [880, 512], 100], waist: [958, 250, 55, 30], fan: [[858, 170], [682, 298], 40], bell: [[975, 135], [1098, 95], 34], robeBack: [905, 262], robeFront: [995, 262] },
      { feet: [302, 1250], head: [313, 730, 36, 40], torso: [[305, 780], [335, 880], 48], skirt: [[335, 925], [290, 1142], 105], waist: [339, 888, 55, 30], fan: [[390, 770], [525, 762], 46], bell: [[370, 840], [452, 943], 32], robeBack: [300, 900], robeFront: [380, 900] },
      { feet: [917, 1250], head: [940, 790, 36, 40], torso: [[933, 840], [908, 945], 48], skirt: [[905, 985], [900, 1132], 115], waist: [902, 950, 55, 30], fan: [[890, 860], [800, 830], 44], bell: [[975, 850], [1122, 958], 32], robeBack: [860, 960], robeFront: [945, 960] },
    ],
  },
  motion: {
    rest: { key: 0, lean: 0, lift: 0, squash: 0, spin: 0, flare: .15 },
    recover: { key: 0, lean: .12, lift: 12, squash: -.05, spin: 0, flare: .1 },
    roar: { key: 1, lean: -.1, lift: -8, squash: .06, spin: 0, flare: .8 },
    sweep: { prepare: { key: 1, lean: -.1, lift: 0, squash: .03, spin: 0, flare: .35 }, impact: { key: 2, lean: .14, lift: 6, squash: -.03, spin: 0, flare: .6 } },
    ring: { prepare: { key: 3, lean: 0, lift: 12, squash: -.05, spin: 2, flare: 1 }, impact: { key: 3, lean: .06, lift: 16, squash: -.07, spin: 2, flare: .7 } },
    pillars: { prepare: { key: 3, lean: -.14, lift: -16, squash: .09, spin: 0, flare: .45 }, impact: { key: 2, lean: .1, lift: 8, squash: -.05, spin: 0, flare: .65 } },
    chase: { prepare: { key: 1, lean: .06, lift: 0, squash: 0, spin: 0, flare: .45 }, impact: { key: 2, lean: .2, lift: 4, squash: -.04, spin: 0, flare: .85 } },
    twin: { prepare: { key: 3, lean: .08, lift: 24, squash: -.1, spin: 0, flare: .3 }, impact: { key: 3, lean: .1, lift: 20, squash: -.08, spin: 1, flare: 1 } },
    /** pulse 덧: raise 두 팔을 드는 빠르기(타격 몫의 배) · shimmer 타격 동안 떨리는 반 바퀴 수 · shimmerLift 그 px */
    pulse: { prepare: { key: 1, lean: -.04, lift: -4, squash: .04, spin: 0, flare: .55 }, impact: { key: 1, lean: -.07, lift: -10, squash: .07, spin: 0, flare: .95 }, raise: 3, shimmer: 8, shimmerLift: 3 },
    /** 숨(키 늘임 몫 · Hz) · 흔들림(라디안 · Hz) · 움찔(뒤로 젖힘 · 들림) · 걸음(위아래 px · 앞 숙임 · 옷자락 펼침과 그 흔들림) */
    breath: { squash: .012, hz: .32, lean: .012, leanHz: .21 }, stagger: { lean: -.14, lift: -8 }, step: { bob: 5, lean: .07, flare: .45, flareSway: .2 },
    /** reprepare 연타 사이 다음 준비 자세로 돌아오는 몫(붉은 바닥의 앞쪽) · roarSnap 막 전환에서 방울을 치켜드는 빠르기 */
    reprepare: .45, roarSnap: 1.6,
    /** 등장: 불에서 몸이 드러나는 몫 구간 · 걸어 나오는 px · 마지막 걸음(땅을 울림)의 몫 · 나오며 숙인 몸 · 마지막 걸음에 눌림(숙임 · 키 · px) */
    entry: { from: .3, to: .78, walk: 90, land: .84, lean: .08, pop: { lean: .05, squash: .06, lift: 8 } },
  },
  /**
   * keyFade 자세가 바뀔 때 옛 자세가 옅어지는 초 · behind* 장수가 몸 뒤에 서면 옅게 · shadow* 발밑 그림자 · char 부서진 부채·방울에 덧칠하는 그을음 · charRadius 그 둘레(원본 px)
   * glow* 치마 끝 불꽃 무늬 빛(짙기 · 일렁임 몫 · Hz) · hem* 불꽃 혀(크기 px · 짙기 · 오르는 Hz · 오르는 px · 흔들림 px)
   * robe 옷자락 둘: pivot 원본(Codex 67) px 의 허리 끈 · turn 기본 기울기 · sway 흔들림 라디안 · hz · flare 펼칠 때 더 도는 라디안 · scale 원본 1px 의 판 px
   * waist 허리 장식: pivot 원본 px 의 매달린 곳 · swing 흔들림 · hz · scale · smear 휘두름 잔상(벌 수 · 짙기 · 도는 라디안 · 팔 그림 원본 px 의 어깨·손끝(부채·방울 가운데) · 그 1px 의 판 px)
   * bell* 방울이 울릴 때의 둥근 울림 · ring* 등장 불 고리 · break*·drop* 부서진 순간 터짐과 떨어지는 부채·방울 · fall* 쓰러짐(승리 막 내림) · pillar·band 불기둥·불벽 높이 px
   */
  view: {
    keyFade: .12, behindAlpha: .55, behindPad: 10, shadowAlpha: .32, shadowWidth: 125, shadowHeight: 24,
    char: 'rgba(26,10,6,.78)', charRadius: 70,
    glowAlpha: .5, glowFlicker: .35, glowHz: 6.3, hemSize: 26, hemAlpha: .85, hemHz: 1.7, hemRise: 22, hemSway: 4,
    robe: {
      back: { pivot: [1056, 160], turn: .12, sway: .07, hz: .37, flare: .5, scale: .6 },
      front: { pivot: [250, 160], turn: -.1, sway: .06, hz: .43, flare: .45, scale: .6 },
    },
    waist: { pivot: [766, 290], swing: .07, hz: .9, scale: .55 },
    smear: { copies: 4, alpha: .42, sweep: 1.1, fan: { shoulder: [245, 380], tip: [1400, 420], scale: .42 }, bell: { shoulder: [255, 250], tip: [1150, 560], scale: .42 } },
    bellRing: 90, bellLife: .5, ringBloom: 270,
    breakLife: .7, breakSize: 70, dropLife: 1, dropFall: 150, dropSpin: 2.4,
    fallSeconds: 2.8, fallHold: .45, fall: { lean: .35, lift: 44, squash: -.32 },
    pillar: 400, band: 200,
  },
} as const

/**
 * 64-BREAK 부위 파괴가 느껴지게 (docs/realm/RAID-BOSS-SIEGE-20261123.md §2 · 형 11-23 「그로기도 없고 · 부위보다 보스가 먼저 죽음」) — 거대 보스 다섯 모두.
 * spill 몸통(체력 칸 없는 조각)에 맞은 피해 가운데 가장 가까운 성한 부위로도 가는 몫 · partScale 부위 체력 배수 · groggy 큰 부위(보스 체력의 majorShare 이상)가 부서진 순간 멈춰 선 초 · groggyMinor 작은 부위 · groggyDamage 그동안 받는 피해 배수
 */
export const HAEBI_BREAK = { spill: .4, partScale: .7, groggy: 2.5, groggyMinor: .8, majorShare: .04, groggyDamage: 1.5, crackAt: .3 } as const
/**
 * 65-BUILD 설치 갈래 — 레벨업 카드의 네 번째 갈래 (docs/realm/QUESTIONS-20261122.md §2 A ★ · 형 11-23 「왜 아직 구현이 안 돼 있어」).
 * 11-23 형이 해 보고: 「설치물은 소환물이 아니라 그대로 있어야 · 떴다 사라지면 별로 · 다 통과하는 건 말이 안 됨 · 다이센카처럼 한 번 놓으면 그대로, 몸으로 천천히 밀어 옮긴다」
 *   (Brotato 포탑은 판 내내 무적으로 서 있고 · Monsters are Coming! 건물은 놓은 자리에 남고 · Endless Dungeon 은 포탑을 못 옮겨 욕먹었다 → 남고 + 밀린다).
 * 처음 고른 순간 장수 앞(가장 가까운 적 쪽 · 없으면 보는 쪽)에 하나가 서서 판 끝까지 남는다 · 단계 extraAt(3·5)에 이르면 그 순간 장수 앞에 하나 더 (종류마다 셋까지 · 둘째·셋째는 spread 라디안씩 옆으로).
 * 종류 칸은 kinds 개까지 (다 차면 가진 종류만 카드로 나온다). 단계는 그 종류 모두를 세게 한다.
 * 몸 r: 장수·적이 지나가지 못한다 (무기·화살은 지나간다 · 61-SOLID 와 같은 말) · 거대 보스는 막히지 않고 shove px/초로 밀쳐 낸다.
 * 밀기: 장수가 몸으로 밀면 장수 빠르기의 pushShare 몫으로 함께 미끄러진다 (장수도 그만큼 느려진다) · 적은 밀지 못한다 · 서로·장식 밑동 밖으로 · 설 수 있는 땅 안으로.
 *   pushDust 밀린 뒤 발밑 흙먼지가 남는 초 · settlePasses 설치물끼리 겹친 것을 푸는 되풀이 수.
 * 망루 tower: 장수 앞 ahead px · range 안의 가장 가까운 적에게 fire × (1 − fireStep × (단계−1)) 초마다 화살 한 발 (빠르기 speed · 수명 life0 초 · 맞는 둘레 radius · 맹공으로 빨라진다)
 *   피해 = 그때 잡졸 체력 × (share + shareStep × (단계−1)) · 첫 적에서 멈춘다 · 부적·번개는 붙지 않는다.
 *   어그로 (형 11-23 「망루나 건물들은 적이 일정거리에서 어그로 끌리거나 부서지는거」): 가까이 붙어 싸우는 잡졸(활·돌·불 던지는 적 · 정예 · 두목 · 거대 보스는 빼고) 가운데
 *   id 가 aggroEvery 의 배수인 놈(셋에 하나 · 장수도 계속 몰린다)이 망루 aggroR px 안에 들면 그 망루로 걸어가 친다 (몸 피해 × bite / 초 · 닿는 여유 touch px) · 망루가 무너지면 다시 장수에게.
 *   체력 (hp + hpStep × (단계−1)) × 판의 위협 배수 · 무너지면 rebuild 초 동안 잔해(막지도 쏘지도 않는다) → 같은 자리에 체력을 다 채워 다시 선다.
 * 목책 fence: 장수 앞 ahead px · 닿은 잡졸(touch px 안)은 멈춰 목책을 친다 (그 적의 몸 피해 × bite / 초)
 *   체력 (hp + hpStep × (단계−1)) × 판의 위협 배수(시간) · 부서지면 rebuild 초 동안 잔해(지나갈 수 있다) → 같은 자리에 체력을 다 채워 다시 선다.
 * 항아리 jar: 장수 앞 ahead px · 둘레 radius + radiusStep × (단계−1) 안에서 쓰러진 적의 기세가 1 + bonus + bonusStep × (단계−1) 배 · 무적 (살림살이라 적이 노리지 않는다).
 * flash 쏘거나 맞거나 기세를 더한 설치물이 반짝이는 초.
 * 11-23 헤드리스: 망루가 장수 힘 몫을 곱한 고정 피해(18 + 6/단계)일 때는 20분 판 피해의 2% 남짓이라 카드 한 장 값을 못 했다 → 잡졸 체력 몫.
 * view: 그림 (화면만 읽는다) — 망루 높이 towerH · 망루 화살 크기 arrow · 목책 폭 fenceW (발밑을 fenceLift 만큼 내림 · 다친 목책 위 체력 띠 폭 hpBar · 띄움 hpLift · 두께 hpH) · 항아리 높이 jarH ·
 *   항아리 둘레 고리 빛 ring(진하기 ringAlpha · 안 칠 ringFill · 점선 dash) · 반짝임 빛 glow(진하기 glowAlpha · 자리·크기 glowAt = [그림 높이 몫, 반지름 몫]) · 발밑 그림자 반폭 shadow(그림 크기 몫 · 높이 h px) ·
 *   밀릴 때 흙먼지 dust(알 수 n · 퍼짐 spread px · 크기 size · 빛 color · 진하기 alpha) · 잔해의 다시 서기 고리(반지름 rebuildR · 두께 rebuildW · 빛 rebuildColor) ·
 *   무너진 망루는 같은 그림을 rubbleAlpha 진하기 · rubbleSquash 높이 몫으로 주저앉혀 그린다
 */
export const HAEBI_BUILD = {
  kinds: 3, max: 5, flash: .35, extraAt: [3, 5], spread: .75, pushShare: .35, pushDust: .2, shove: 420, settlePasses: 6,
  tower: { ahead: 95, r: 36, range: 380, fire: 1.3, fireStep: .08, share: .4, shareStep: .1, speed: 620, life0: 1, radius: 10, hp: 260, hpStep: 90, rebuild: 10, aggroR: 140, aggroEvery: 3, touch: 6, bite: 1 },
  fence: { ahead: 85, r: 30, touch: 6, hp: 220, hpStep: 80, bite: 1, rebuild: 8 },
  jar: { ahead: 60, r: 16, radius: 190, radiusStep: 12, bonus: 1, bonusStep: .25 },
  view: { towerH: 104, arrow: 34, fenceW: 96, fenceLift: 12, jarH: 46, ring: '#ffd77a', ringAlpha: .32, ringFill: .07, glow: '#ffe7a0', glowAlpha: .8, glowAt: { tower: [.72, .14], jar: [.82, .32] }, shadow: { tower: .32, fence: .5, jar: .45, h: 7 }, dash: [10, 8], hpBar: 44, hpH: 5, hpLift: 8,
    dust: { n: 4, spread: 18, size: 7, color: '#c9a27a', alpha: .45 }, rebuildR: 16, rebuildW: 3, rebuildColor: '#ffd77a', rubbleAlpha: .45, rubbleSquash: .55 },
} as const
/**
 * 67-BUILD2 설치 갈래 다섯 종류 더 (형 11-23 「건설물 여러가지 더 만드는 것도 해줘. 창의적이게」) — 설치 갈래가 여덟 종류가 되고 종류 칸은 그대로 셋이라 「어느 셋을 고르나」가 판의 길이 된다.
 * 놓기·남기·막기·밀기·3·5단계에 하나 더는 HAEBI_BUILD 와 같다 (ahead 장수 앞 거리 · r 몸 반지름). 체력이 있는 것은 (hp + hpStep × (단계−1)) × 판의 위협 배수 · 무너지면 rebuild 초 잔해 뒤 다시 선다.
 * 장승 totem: 망루보다 세게 끈다 — 붙어 싸우는 잡졸 가운데 id 가 aggroEvery 의 배수(둘에 하나)가 aggroR 안이면 장승을 친다 (닿는 여유 touch · 몸 피해 × bite / 초).
 *   장승이 둘 넘게 서면 저마다 가장 가까운 장승과 「혼줄」로 이어진다 (link px 안) · 줄 반폭 lineW 안에 든 적은 초마다 그때 잡졸 체력 × (lineShare + lineStep × (단계−1)) 를 잃고 lineSlowT 초 동안 빠르기가 lineSlow 배.
 * 솟대 sotdae: 무적 · 둘레 radius + radiusStep × (단계−1) 안의 적이 slow + slowStep × (단계−1) 만큼 느려진다 (가장 센 것 하나만 · 혼줄 느려짐과도 겹치지 않는다).
 * 봉수대 beacon: 무적 · every − everyStep × (단계−1) 초마다 연기를 올리고, 장수 화면에서 cluster px 안에 적이 가장 많이 뭉친 곳에 delay 초 뒤 화살비 (금빛 표식 먼저 · 둘레 radius + radiusStep × (단계−1) · 피해 그때 잡졸 체력 × (share + shareStep × (단계−1))).
 * 포차 catapult: 망루처럼 체력이 있고 끌린다 (aggroR · 셋에 하나) · every − everyStep × (단계−1) 초마다 minRange~range 안에서 cluster px 안에 적이 가장 많은 곳(같으면 먼 곳)으로 바위를 던진다
 *   (flight 초 날아감 · 둘레 radius + radiusStep × (단계−1) · 피해 그때 잡졸 체력 × (share + shareStep × (단계−1)) · 그을린 자국과 패인 자국을 남긴다).
 * 우물 well: 무적 · 장수가 둘레 radius + radiusStep × (단계−1) 안에 서 있으면 초마다 heal + healStep × (단계−1) 회복 (우물이 여럿이어도 한 번).
 * view: 그림 (화면만) — 높이 h(체력 띠 자리 · 포차는 조립한 그림 높이) · 혼줄 빛 line(두께 lineW · 진하기 lineAlpha) · 솟대 고리 sotdaeRing · 우물 고리 wellRing · 물방울 drops · 새 깡충 hop · 연기 smoke · 화살비 화살 수 arrows · 바위 크기 rock · 포물선 높이 arc ·
 *   throwOut 포차 팔이 장전 자리에서 넘어가는 초.
 * view.pocha 포차 부품 조립 (형 11-23 「포차는 부품마다 에셋」 「돌이 바닥에서 시작해서 던져져야」) — 부품 크기·축 자리는 public/realm/raid/pocha/pocha.json (2배 그림 px) 그대로 · scale 게임 px 몫(.5) ·
 *   wheelLift 받침 발이 땅 위로 뜬 몫(바퀴 반지름 몫) · arm.len·tail 축에서 팔 끝·꼬리까지(게임 px) · rockLift 바위가 주머니 자리에서 뜨는 px · rockSpin 날며 도는 몫 ·
 *   팔 각(도 · 팔 끝이 가리키는 쪽 · 0 = 던지는 쪽 · 위가 +): rest 장전(주머니가 뒤쪽 바닥) → 쏘면 throwOut 초 동안 가속하며 위로 넘어가 over 에 닿고 · release 를 지날 때 바위가 떠난다 ·
 *   hold 초 넘어간 채 → wind 초(쏘는 간격의 windShare 몫을 넘지 않게 · 적어도 windMin)에 걸쳐 감아 내린다 · 다 내려오면 새 바위 ·
 *   매달린 주머니·추는 팔 끝·꼬리의 가로 빠르기 × lag 만큼 뒤처지고(lagMax 라디안까지) · 넘어간 뒤 sway 라디안으로 swayHz 번 흔들리다 swayDecay 초로 잦아든다 ·
 *   쏘면 recoil px 뒤로 밀렸다 recoilTime 초에 돌아오고 바퀴가 그만큼 구른다(wheelRock 몫) · 쏘거나 맞으면 축에 빛(glow 진하기 · glowR 반지름) · 발밑 그림자 반폭 shadow ·
 *   무너지면 부품이 발밑 둘레에 흩어진다 scatter[부품] = [x, y(위가 −), 돌림, 세로 눌림] (id 로 좌우를 뒤집고 jitter px 흔든다) · 다시 서기 전 assemble 초 동안 제자리로 모인다
 */
export const HAEBI_BUILD2 = {
  totem: { ahead: 80, r: 22, hp: 640, hpStep: 220, rebuild: 12, aggroR: 190, aggroEvery: 2, touch: 6, bite: 1, link: 420, lineW: 16, lineShare: .45, lineStep: .15, lineSlow: .55, lineSlowT: .6 },
  sotdae: { ahead: 70, r: 12, radius: 150, radiusStep: 15, slow: .25, slowStep: .06 },
  beacon: { ahead: 90, r: 26, every: 8, everyStep: .6, delay: 1, cluster: 120, radius: 115, radiusStep: 10, share: 1, shareStep: .3 },
  catapult: { ahead: 100, r: 32, hp: 320, hpStep: 110, rebuild: 12, aggroR: 140, aggroEvery: 3, touch: 6, bite: 1, every: 5.5, everyStep: .4, minRange: 170, range: 640, cluster: 110, flight: 1.1, radius: 125, radiusStep: 10, share: 1.3, shareStep: .35 },
  well: { ahead: 70, r: 26, radius: 120, radiusStep: 12, heal: 3, healStep: 1.5 },
  view: {
    h: { totem: 92, sotdae: 84, beacon: 92, catapult: 104, well: 40 }, shadow: 1.1,
    line: '#9fe8ff', lineW: 4, lineAlpha: .55, lineGlow: 12,
    sotdaeRing: '#d8f0ff', sotdaeAlpha: .22, wellRing: '#7fc8ff', wellAlpha: .3, wellFill: .08,
    drops: { n: 5, size: 3, rise: 26, color: '#bfe6ff' }, hop: { height: 5, hz: 2.2 },
    smoke: { n: 5, size: 14, rise: 70, color: '#5d5550', alpha: .5, life: 2.2 },
    arrows: 5, arrow: 38, fall: 260, mark: '#ffd77a', markAlpha: .5,
    rock: 26, arc: 160, throwOut: .25,
    pocha: {
      scale: .5, wheelLift: .9, rockLift: 3, rockSpin: 9,
      frame: { size: [210, 147], axle: [105, 11.1], wheelL: [34.3, 133.1], wheelR: [175.7, 133.1], foot: [105, 143.1] },
      arm: { size: [196, 29], axle: [57.9, 13.1], len: 66.2, tail: 27.8 },
      pouch: { size: [49, 76], hang: [23.8, 2.5], seat: [23.8, 57.5] },
      wheel: { size: [65, 65], hub: [31.9, 31.9] },
      weight: { size: [56, 71], hang: [27.5, 5.8] },
      rock: { size: [55, 54], c: [27.5, 26.9] },
      plankA: { size: [69, 30] }, plankB: { size: [52, 31] },
      rest: -150, over: 35, release: 75, hold: .35, wind: 1.6, windMin: .3, windShare: .8,
      lag: .0015, lagMax: .6, sway: .3, swayHz: 1.6, swayDecay: .45, recoil: 5, recoilTime: .4, wheelRock: 1,
      glow: .5, glowR: 16, shadow: 50, assemble: 2.5, jitter: 5,
      scatter: {
        frame: [-6, -26, -.5, 1], arm: [10, -7, .05, 1], weight: [36, -14, 1.2, 1], pouch: [58, -8, 1.5, 1], rock: [66, -12, 0, 1],
        wheelL: [-46, -6, 0, .35], wheelR: [-30, -16, .4, 1], plankA: [22, -4, .25, 1], plankB: [-18, -3, -.4, 1],
      },
    },
  },
} as const
/**
 * 69-BUILDUP 설치물 강화 칸 둘 (형 11-23 「설치물들의 공격력이나 공격속도 올려주는 것도 따로 만들어야 할 것 같고」) — 설치 갈래의 칸이지만 설치물 종류가 아니라 종류 칸(HAEBI_BUILD.kinds 셋)을 쓰지 않는다
 *   (갈래 끝·버팀 칸처럼 가진 것을 세게 하는 칸 · 종류 칸은 「무엇을 세우나」의 고름으로 남긴다).
 * 화력 firepower: 공격하는 설치물(망루 화살 · 봉수대 화살비 · 포차 바위 · 장승 혼줄)의 피해 × (1 + dmgStep × 단계) · 넷 가운데 하나라도 가져야 카드·나무에 나온다.
 * 장전 reload: 때마다 쏘는 설치물(망루 · 봉수대 · 포차)의 쏘는 빠르기 × (1 + rateStep × 단계) · 간격 = 예전 간격(맹공으로 나눈 것) ÷ 그 배수, 그래도 minInterval 초 아래로는 줄지 않는다 · 셋 가운데 하나라도 가져야 나온다.
 * max 끝 단계.
 * 11-23 헤드리스 (설치 몰빵 봇 · 레벨 셋마다 설치 갈래 한 칸 · 5판 × 7무기 × 씨앗 둘 = 70판 · 상점 절반): 강화 칸 없이 45/70 승 · 설치 피해 몫 29.3% —
 *   처음 수치(+12% · +8%)는 강화 칸이 종류 단계(3·5단계에 하나 더 서는 것)를 밀어내 35/70 · 몫 25.3% (카드 값을 못 했다) → +25% · +15% 에서 39~41/70 · 몫 29.9% (몰빵해도 강화 칸 없는 판을 넘지 않는다)
 * v1 처음 낸 수치 — 규칙 69-BUILDUP 으로 적힌 옛 판 기록은 이 수치로 다시 돈다 (새 판은 69B-BUILDUP)
 */
export const HAEBI_BUILDUP = { max: 5, dmgStep: .25, rateStep: .15, minInterval: .3, v1: { dmgStep: .12, rateStep: .08 } } as const
/**
 * 66-CAP 최고 레벨 (형 11-23 「레벨은 왜 44가 맥스지? 맥스 찍었다는 걸 유저가 알기도 어려운데」 · 「44 는 이상하고 사사(死死)로 읽힌다 → 50」).
 * 이 규칙 판은 최고 레벨이 capLevel (끈 판·옛 기록은 HAEBI_RUN.maxLevel 44 그대로).
 * 50 에 닿는 때가 예전 44 에 닿던 때와 같게 기세 막대를 늘인다 — 예전 곡선(xpBase + xpPerLevel·L + xpCurve·L²)을 43/49 배로 눌러 편 것:
 *   다음 레벨까지 = xpBase + xpPerLevel × L + xpCurve × L² (첫 레벨은 예전과 같은 4.8 · 1→50 합이 예전 1→44 합과 같다).
 *   레벨마다 힘 levelPower · 레벨업 회복 levelHeal 도 43/49 배라, 같은 시각의 힘·회복은 예전과 같고 고르는 카드만 여섯 장 늘어난다.
 * 그 뒤로 기세 막대가 다시 찰 때마다 막대를 비우고 최대 체력의 heal 몫을 되찾고 판 금 gold(스테이지 금 배수 · 상점 「탐욕」 몫을 곱한다)를 받는다 · ring 받을 때 장수 둘레 빛 고리
 */
/**
 * 71-BOSSDUEL 보스전은 보스와 겨루게 (형 11-23 「보스전에서는 졸병이 꼭 나와야 하나 · 보스가 부를 때 나오는 건 그렇다 쳐도 잡몹이 최종 보스전 할 때 너무 많이 나옴」) — 스테이지 판만.
 * 마지막 두목(옛 두목 · 거대 보스)이 살아 있는 동안 저절로 나오는 잡졸이 bossSpawn 배 · 판 위 적이 bossCap 을 넘으면 더 나오지 않는다 (우두머리가 부르는 졸개는 그대로 · 상한도 HAEBI_RUN.maxEnemies)
 * 중간 보스가 살아 있는 동안 midbossSpawn 배.
 * 마지막 두목이 나오는 순간 판 위 보통 잡졸(정예 · 우두머리 · 부른 졸개 · 중간 보스 빼고)이 장수에게서 등 돌려 flee 초 동안 잡졸 빠르기 × fleeSpeed 로 달아나 사라진다 —
 *   쓰러뜨린 것이 아니라 기세·금·처치 수·처치 효과가 없고 · 달아나는 동안 치지도 맞지도 않는다 · 사라진 자리에 흙먼지 고리(반지름 puff · 빛 puffColor) ·
 *   두목이 스스로 등장 고리를 띄우지 않으면(옛 두목) 포효 고리(반지름 roar · 빛 roarColor) 하나 · 거대 보스는 제 등장 고리를 그대로 쓴다
 */
export const HAEBI_BOSS_DUEL = { bossSpawn: .2, midbossSpawn: .5, bossCap: 75, flee: 1.4, fleeSpeed: 1.8, puff: 26, puffColor: '#c9a27a', roar: 120, roarColor: '#e8dcc0' } as const
/**
 * 70-AWAKECAP 각성 장수 최고 레벨 60 (형 11-23 「각성하면 만렙이 10 오르게 하는 건 어때?」) — 영구 각성(permanentAwake)으로 들어온 66-CAP 판만 · 겉모습 각성(appearanceAwake)은 상관없다.
 * 후반은 이미 쉬워(형 판 기록) 51~60 은 그냥 주는 힘이 아니다:
 *   다음 레벨까지 = 66-CAP 곡선 × (1 + xpRise × (L − 49)) (L = 50~59 · 봇 판이 마지막 두목 무렵에야 60) · 레벨마다 카드는 그대로 고른다 ·
 *   레벨마다 힘 levelPower 는 powerShare 몫만 · 60 뒤 넘침 보상(회복 + 판 금)은 66 판의 50 뒤와 같은 막대마다.
 * 11-23 헤드리스 (영구 각성 봇 · 70판 · 상점 절반 · 50 에 닿는 때 평균 16:02 · 마지막 두목 19:00): 50 상한 53/70 승 · 끝 레벨 47.3 ·
 *   xpRise .15 는 60 이 3판(18:53)뿐 · 끝 레벨 51.7 · 55/70 승 → .05 는 60 이 15판(평균 18:31 · 설원 18:17 · 목책 18:58) · 끝 레벨 52.5 · 57/70 승 (빨리 크는 판만 두목 무렵 60)
 * v1 처음 낸 막대 — 규칙 70-AWAKECAP 으로 적힌 옛 판 기록은 이 막대로 다시 돈다 (새 판은 70B-AWAKECAP)
 */
export const HAEBI_CAP60 = { capLevel: 60, xpRise: .05, powerShare: .5, v1: { xpRise: .15 } } as const
export const HAEBI_CAP = { capLevel: 50, xpBase: -1.13, xpPerLevel: 5.39, xpCurve: .541, levelPower: .0395, levelHeal: 24.6, heal: .2, gold: 8, ring: 70 } as const
/**
 * 최고 레벨 화면 (raid/fx-cap.ts · 규칙과 상관없이 화면만) — 처음 닿은 순간 큰 글자 banner (「부위 파괴!」와 같은 결 · bannerLife 초 · popTime 동안 popScale 배에서 줄어듦 · lift 장수 위 · rise 떠오름) ·
 * 70-AWAKECAP 각성 장수가 50 을 넘는 순간 한 번 beyond 글자 (같은 결 · 같은 크기·시간) · 66-CAP 보상마다 작은 「+금 · 회복」 글자 (popSize · popLife 초 · popLift · popRise) · 빛 fill · 테 edge · 테 두께 stroke · 막대 끝 「MAX」
 */
export const HAEBI_CAP_VIEW = {
  banner: '수련을 모두 마쳤습니다', beyond: '한계를 넘어섭니다', size: 46, stroke: 8, fill: '#ffd34a', edge: '#3a1406', bannerLife: 2.6, fadeTime: .5, popTime: .14, popScale: 1.8, lift: 120, rise: 20,
  popSize: 24, popStroke: 5, popLife: 1.1, popLift: 70, popRise: 34, popFill: '#ffe9a8', max: 'MAX',
} as const
/** 부위 파괴 화면 (raid/fx-break.ts) — 「부위 파괴!」 글자 · 그로기 별 */
export const HAEBI_BREAK_VIEW = {
  text: '부위 파괴!', size: 54, stroke: 8, fill: '#ffd34a', edge: '#3a1406', textLife: 1.4, fadeTime: .4, popTime: .12, popScale: 1.9, lift: 90, rise: 26,
  stars: 4, spin: 4.5, orbit: 46, starSize: 11, star: '#ffe27a', starLift: 40, bodyLift: 160,
} as const
/**
 * 55 숲 산길 거대 보스 「구미호」 (docs/realm/BOSS.md 구미호 표 · 성인 여성 · 형: 「섹시한 여성 인간형 보스」) — 규칙 55-GUMIHO 의 숲 산길 판에만 쓴다.
 * 막 1 은 부채를 든 여인 · 막 2 에 반여우로 변하며 꼬리 아홉이 하나씩 터져 나온다 · 막 3 에 아홉 꼬리 지연 찌르기가 열린다.
 * 막·분노·시간 예산·안전로 3P·머리 배율·환경 피해 박자는 HAEBI_GIANT 의 공통 계약을 그대로 쓰고, 여기엔 구미호만의 값만 둔다.
 *  hp 본체 · midHpScale 10분 중간 보스(산적 대두목)의 체력 몫 · parts 부위 체력 = hp × 몫 (가산 체력이 아니다 · tail 은 꼬리 하나마다)
 *  entrySeconds 등장(여우불이 모이고 숲에서 걸어 나와 부채를 편다) · transformSeconds 막 2 변신 · roarSeconds 막 3 웃음 · stagger* 회복 중 첫 타격의 움찔
 *  homeY·homeBand 평소 발 자리(판 y)와 그 둘레 · glide* 미끄러지듯 다가감(초 · px/초 · 장수와 남길 거리 · 이보다 가까우면 안 감) · idleRecovery 할 수가 없을 때 쉬는 초
 *  turnDeadZone 장수가 이만큼(px) 안쪽이면 돌아서지 않는다 · homePull 발 자리가 homeBand × 이만큼 벗어나면 먼저 제자리로 · fadeHidden 이보다 옅으면 안 보이고 안 맞는다
 *  moves: phase 처음 여는 막 · body 몸 예고 · red 붉은 바닥 예고(초) · recover 회복(머리 노출) · strike 타격 몸놀림 초 · impactAt 그 가운데 판정 몫 · damage 피해 (× 스테이지 피해)
 *   reach 장수가 발에서 이 거리 안이면 후보 · aimLimit 바라보는 쪽에서 장수 쪽으로 틀 수 있는 각
 *   thrust 접은 부채 찌르기: 발 앞 from 부터 length 까지 폭 width 의 짧은 직선 (팔 길이 + 3P)
 *   gale 부채 곡풍: 발에서 반지름 rings 마다 폭 width 의 곡선 셋 (선 사이 3P) · halfAngle 반각
 *   illusion 환영 후 되받기: 자리 셋(spread 간격 · 진짜는 seeded 하나 · 몸 예고 blinkAt 몫에 자리를 바꾼다) · 진짜 앞 radius·halfAngle 부채 (환영은 피해 없음)
 *   sweep 세 꼬리 순차쓸기: tails 꼬리 셋이 차례로 반지름 radius · 60도(halfAngle) 부채를 쓴다 · follow 다음 부채의 붉은 예고 · 뒤쪽 반은 늘 빈다
 *   leap 반여우 도약 베기: holdMax 웅크려 버티는 seeded 0~이 초(wiggle·wiggleHz 들썩임) · min~reach 뛰는 거리 · lowest 착지 발 자리 y 한계(체력 막대 자리 위) · rx·ry 착지 타원(긴 축이 뛰는 쪽) · hop 공중 높이
 *   ninetail 아홉 꼬리 지연 찌르기: holdMax 꼬리 부채를 펼쳐 버티는 seeded 0~이 초 · 발에서 from~from+length 폭 width 방사 직선 · slots 자리(꼬리 아홉 + 빈 통로 하나) · lane 빈 통로가 장수 쪽 자리에서 떨어진 칸 수
 *  env 막별 환경: side 막1 양옆 숲바람 띠 · crescent 막2 양옆 꼬리 호(판 밖 x 를 중심으로 한 호) · rays 막3 방사 꼬리선 [위 x, 아래 x] 폭 width (가운데 세로 3P 는 늘 빈다)
 *  rig 그림 자세 넷의 관절 자리 (구운 그림 px · 발 가운데 0 · 앞 +x · 아래 +y · scale 을 곱하면 판 px) — 판정과 그림이 같은 점을 쓴다
 *   poses: 0 서기(접은 부채를 허리에) · 1 부채 팔을 뒤로 젖힘 · 2 접은 부채 찌르기 · 3 편 부채 휘두름 · crouch 웅크림 1 의 세로 눌림 몫 · turnSquash 돌아서는 순간 가로 눌림
 *   tails: length 판 px · radius 길이에 대한 판정 굵기 몫 · rest 쉬는 각 · spread 펼친 각(앞 +x 에서 · 위가 음수) · baseStep 꼬리 뿌리를 늘어놓는 간격 · emergeOrder 변신 때 나오는 차례
 *  motion 자세 (pose 그림 · crouch 웅크림 0~1 · lean 앞 기울임 · spread 꼬리 펼침 0~1) · sweep.raise/reach 순차쓸기 꼬리 들기·늘이기 · ninetail.reach/turn 찌르는 꼬리 길이·선 쪽으로 트는 몫 · breath 숨·꼬리 흔들림 · glide 미끄러짐 · stagger 움찔
 *  view (그리기만): 그림 자리는 src/raid/gumiho-art.ts
 */
export const HAEBI_GUMIHO = {
  hp: 1200000, midHpScale: .15,
  parts: { head: .08, 'fan-arm': .07, 'claw-arm': .07, tail: .03 },
  entrySeconds: 2.8, transformSeconds: 2.6, roarSeconds: 1.3, staggerSeconds: .45, staggerRecover: .4,
  homeY: 480, homeBand: 60, glideSeconds: 1.4, glideSpeed: 150, glideNear: 210, glideMin: 12, idleRecovery: .9,
  turnDeadZone: 14, homePull: 1.5, fadeHidden: .5,
  moves: {
    thrust: { phase: 1, body: .25, red: .25, recover: 1, strike: .18, impactAt: .5, damage: 20, reach: 340, aimLimit: .6, from: 40, length: 280, width: 40 },
    gale: { phase: 1, body: .6, red: .7, recover: 1.5, strike: .3, impactAt: .4, damage: 22, reach: 470, aimLimit: .6, rings: [100, 260, 420], width: 40, halfAngle: 50 * Math.PI / 180 },
    illusion: { phase: 1, body: .9, red: .8, recover: 1.5, strike: .3, impactAt: .5, damage: 28, reach: 420, aimLimit: 1.05, radius: 160, halfAngle: Math.PI / 4, spread: 330, blinkAt: .5, blinkFade: .12 },
    sweep: { phase: 2, body: .7, red: .7, follow: .8, recover: 1.5, strike: .22, impactAt: .55, damage: 20, reach: 330, radius: 260, halfAngle: Math.PI / 6, tails: [1, 4, 7] },
    leap: { phase: 2, body: .4, red: .8, holdMax: .6, recover: 1.5, strike: .5, impactAt: .85, damage: 30, reach: 560, min: 140, rx: 120, ry: 60, hop: 130, wiggle: .06, wiggleHz: 3.2, lowest: 620 },
    ninetail: { phase: 3, body: .6, red: 1.4, holdMax: .5, recover: 2, strike: .3, impactAt: .45, damage: 28, reach: 340, from: 30, length: 280, width: 40, slots: 10, lane: 2 },
  },
  env: { side: 80, crescent: { x: -40, inner: 200, outer: 290, halfAngle: 1.2 }, rays: [[315, 120], [432, 330], [688, 790], [805, 1000]], width: 40 },
  rig: {
    scale: .9, crouch: .1, turnSquash: .7,
    poses: [
      { head: [36, -381], neck: [34, -338], hip: [21, -194], tail: [-22, -208], fanShoulder: [61, -326], fanHand: [83, -264], fanTip: [136, -291], fanRadius: 26, clawShoulder: [-24, -311], clawHand: [68, -251] },
      { head: [43, -425], neck: [39, -380], hip: [23, -222], tail: [-24, -240], fanShoulder: [-44, -350], fanHand: [-167, -348], fanTip: [-214, -332], fanRadius: 26, clawShoulder: [79, -340], clawHand: [138, -278] },
      { head: [22, -427], neck: [17, -382], hip: [15, -237], tail: [-28, -252], fanShoulder: [59, -347], fanHand: [147, -365], fanTip: [214, -374], fanRadius: 26, clawShoulder: [-28, -337], clawHand: [-68, -285] },
      { head: [10, -451], neck: [7, -406], hip: [7, -251], tail: [-36, -273], fanShoulder: [67, -373], fanHand: [196, -384], fanTip: [211, -423], fanRadius: 52, clawShoulder: [-73, -343], clawHand: [-203, -293] },
    ],
    headRadii: [40, 50], robeLift: 50, robeRadius: 86, torsoRadius: 52, clawRadius: 24,
    tails: {
      length: [267, 246, 175, 217, 219, 248, 212, 230, 235], radius: .14, baseStep: [-.5, 4],
      rest: [-2.182, -2.400, -2.618, -2.836, -3.054, -3.272, -3.491, -3.709, -3.927],
      spread: [-.698, -1.156, -1.614, -2.073, -2.531, -2.989, -3.447, -3.905, -4.363],
      emergeOrder: [4, 3, 5, 2, 6, 1, 7, 0, 8],
    },
  },
  motion: {
    rest: { pose: 0, crouch: 0, lean: 0, spread: 0 },
    recover: { pose: 0, crouch: .3, lean: .1, spread: 0 },
    laugh: { pose: 3, crouch: 0, lean: -.12, spread: 1 },
    thrust: { prepare: { pose: 1, crouch: .2, lean: -.08, spread: 0 }, impact: { pose: 2, crouch: .08, lean: .14, spread: 0 } },
    gale: { prepare: { pose: 1, crouch: .3, lean: -.14, spread: 0 }, impact: { pose: 3, crouch: .05, lean: .1, spread: .2 } },
    illusion: { prepare: { pose: 0, crouch: .55, lean: .06, spread: 0 }, impact: { pose: 3, crouch: .1, lean: .2, spread: 0 } },
    sweep: { prepare: { pose: 3, crouch: .1, lean: -.06, spread: .35 }, impact: { pose: 3, crouch: .05, lean: .06, spread: .35 }, raise: .9, reach: 1.15 },
    leap: { prepare: { pose: 0, crouch: .6, lean: .16, spread: .2 }, air: { pose: 1, crouch: .1, lean: .1, spread: .5 }, impact: { pose: 2, crouch: .35, lean: .22, spread: .3 } },
    ninetail: { prepare: { pose: 3, crouch: .12, lean: -.04, spread: 1 }, impact: { pose: 3, crouch: .05, lean: .04, spread: 1 }, reach: 1.12, turn: .6 },
    /** 등장 몫: gather 까지 여우불만 · step 까지 걸어 나옴(rise px 위에서) · open 에 부채를 편다 */
    entry: { gather: .35, step: .7, open: .8, rise: 70 }, fanOpen: { pose: 3, crouch: 0, lean: -.06, spread: 0 },
    /** 변신 몫: laugh 까지 웃음 자세로 · fox 에서 반여우로(foxSpan 동안) · tails 에서 꼬리가 하나씩(tailsSpan 동안) */
    transform: { laugh: .2, fox: .22, foxSpan: .18, tails: .42, tailsSpan: .45 },
    breath: { hz: .32, crouch: .02, tail: .08, tailHz: .23, tailPhase: .8 },
    glide: { lean: .1, bob: 4, hz: 1.4 }, stagger: { lean: -.14, crouch: .18 },
  },
  /**
   * 그리기만 — behind* 장수가 몸 뒤(발보다 위)에 서면 옅게 · brokenShade 부서진 팔 덧칠 · sway 옷자락·머리 흔들림(px · 초마다 · 물결 · 엉덩이~발 사이 몫 from→peak→to · 가로 띠 수 · 윗몸 몫)
   * shadow 발밑 그림자 · fire 여우불 빛(속·겉·보라) · entry 모이는 여우불 수·둘레 · illusion 환영(짙기 · 빛 · 깜빡임 Hz · 깜빡임 깊이) · ghostTail 막 1 환영 예고의 꼬리 그림자
   * break*·drop* 부서짐 터짐 · 끊긴 꼬리가 떨어지는 초·거리·돌림 · streak 타격 빛줄기 · land 도약 착지 · fall* 쓰러짐(승리 막 내림) · flash 변신 섬광
   */
  view: {
    behindAlpha: .55, behindPad: 10, brokenShade: 'rgba(36,20,44,.5)',
    /** 그로기 동작 칸(gm_groggy · 11-23): 칸 0~3 을 fall 초씩 한 번(휘청 → 주저앉음) · 4~7 을 breath 초씩 되풀이(땅 짚고 숨) · 그동안 꼬리는 tailAlpha 로 옅게(무릎 꿇은 몸 위에 떠 보이지 않게) · 큰 부위가 하나라도 깨졌으면 찢긴 판 · 시작 때 남은 멈춤이 minDaze 초 넘을 때만(도끼 멈칫·작은 휘청은 옛 자세) */
    groggy: { fall: .14, breath: .3, tailAlpha: .25, minDaze: 1.2 },
    sway: { amp: 4, hz: .55, wave: 1, from: .2, peak: .72, to: .9, strips: 28, upper: .25 },
    shadow: { alpha: .32, width: 150, height: 26, lift: .006 },
    fire: { core: '#f4fbff', glow: '#8fd3ff', violet: '#b9a6ff', size: 15 },
    entry: { wisps: 16, radius: 240 },
    illusion: { alpha: .55, tint: 'rgba(140,205,255,.6)', flicker: 9, depth: .15 },
    ghostTail: { alpha: .45, coil: 1.1 },
    breakLife: .7, breakSize: 70, dropLife: .9, dropFall: 160, dropSpin: 1.4,
    streak: { alpha: .85, width: 6 }, land: { size: 150, life: .5 },
    fallSeconds: 2.8, fallHold: .35, fall: { crouch: 1, lean: .3, droop: 1.4, tilt: .32, sink: 40 }, flash: .55, flashRadius: 210, orbit: { count: 10, radius: 170, wobble: 40, speed: 2.4 },
  },
} as const

/**
 * 57 목책 돌파 거대 보스 「불가사리」 (쇠를 먹는 설화의 괴물 · docs/realm/BOSS.md 불가사리 표) — 규칙 57-BULGASARI 의 목책 돌파 판에만 쓴다.
 * 막·분노·시간 예산·안전로 3P·머리 배율·환경 피해 박자는 HAEBI_GIANT 의 공통 계약을 그대로 쓰고, 여기엔 불가사리만의 값만 둔다.
 *  hp 본체(11-22 봇 판 탐색: 1.0M 이면 상점 5할 싸움 43~92초로 막 셋을 다 보기 짧아서 1.3M · 55~119초 · docs/BALANCE.md) · midHpScale 10분 중간 보스(배신한 성주)의 체력 몫(.65 = 327,600 · 여울·설원 중간 보스와 같은 체력) · parts 부위 체력 = hp × 몫 (가산 체력이 아니다 · 본체도 같이 깎인다)
 *  armorDamage 성한 철갑(등·어깨)을 맞히면 본체가 받는 몫 · exposedDamage 철갑이 벗겨진 살을 맞히면 받는 몫 (BOSS.md 철갑 .5 · 파괴 노출 1.2) · 등 철갑은 몸통 껍데기라 성한 동안 몸통 타격도 받는다
 *  entrySeconds 등장 전체 초 · entry 큰 문으로 들어오는 차례(몫): walk 목책 뒤에서 문 앞까지 · chompAt 문 쇠붙이를 씹는 때 둘(chomp 한 번 피해) ·
 *   burst 문을 부수고 뛰쳐나오는 때 · land 판에 내려서는 때 · roarAt 포효 · behind 문 앞에 설 때 발이 목책 줄보다 위인 px · startAbove 처음 자리가 그보다 더 위 · (입이 문 위에 오도록 선다)
 *   breach 뛰쳐나올 때 몸 가운데 둘레 이 px 부터 문까지 몸이 짓밟는 성한 마디를 같이 부순다 · lunge 앞으로 나오는 px · hop 뛰쳐나오는 높이
 *  roarSeconds 막 전환 포효 · stagger* 회복 중 첫 타격의 움찔(그만큼 회복이 늘어난다 · staggerRecover 상한)
 *  homeY·homeBand 평소 발 자리 · floorY 세우는 자리(박치기 끝 · 출현)의 발이 이보다 아래로 가지 않는다(아래 체력 막대·조작부에 가리지 않게) · prowl* 다가가 서성임(초 · px/초 · 걸음 한 바퀴 거리 · 장수와 둘 거리) · idleRecovery 할 수가 없을 때 쉬는 초
 *  turnDeadZone 장수가 이만큼 안쪽이면 돌아서지 않는다 · homePull 발 자리가 homeBand × 이만큼 벗어나면 먼저 제자리로 · prowlMin 이보다 가까우면 걷지 않는다 · sinkHidden 땅속에 이만큼 잠기면 안 보이고 안 맞는다
 *  holdChance 두 번째 쓰는 수부터 붉은 예고 전에 몸 자세를 HAEBI_GIANT.windup.repeatHold 초 더 버틸 몫(seeded · 박치기·쌍돌진은 따로 seeded 긁기·수축)
 *  moves: phase 처음 여는 막 · body 몸 예고 · red 붉은 바닥 예고(초) · recover 회복(머리 노출) · strike 타격 몸놀림 초 · impactAt 그 가운데 판정 몫 · damage 피해 (× 스테이지 피해)
 *  env 막별 환경: border 막1 바깥 철편 띠(위아래 띠는 가운데 gap 을 비운다) · 막2 방사 철편: hub 판 가운데에서 떨어진 시작 · radial 선 방향(도) · lineWidth ·
 *   막3 지하 질주 띠 strips [x 몫, 폭] (가운데 세로 3P 는 늘 빈다)
 *  rig 몸 뼈대 (발 바닥 가운데가 0 · 앞이 +x · 아래가 +y · scale 을 곱한다) — 판정과 그림이 같은 뼈를 쓴다 · 그림 자리는 src/raid/bulgasari-art.ts
 *  motion 수마다 몸 준비(prepare)·타격(impact) 자세: lift 몸 높이(+ 아래) · pitch 앞 들기(라디안) · shift 앞뒤 · head 숙임(+ 아래) · jaw 벌림 0~1 ·
 *   swell 가슴 부풂(− 수축) · shoulder 어깨 철판 세움 0~1 · plates 등 철편 들림 0~1 · tail 꼬리 · paw 발 [앞 가까운 x,y · 앞 먼 · 뒤 가까운 · 뒤 먼] · sink 땅속
 */
export const HAEBI_BULGASARI = {
  hp: 1300000, midHpScale: .65,
  parts: { head: .1, jaw: .06, shoulder: .08, back: .16, 'fore-near': .07, 'fore-far': .07 },
  armorDamage: .5, exposedDamage: 1.2,
  entrySeconds: 3.4,
  entry: { walk: .3, chompAt: [.38, .5], chomp: 1400, burst: .6, land: .8, roarAt: .84, behind: 44, startAbove: 300, breach: 120, lunge: 70, hop: 80 },
  roarSeconds: 1.1, staggerSeconds: .45, staggerRecover: .4,
  homeY: 470, homeBand: 80, floorY: 560, prowlSeconds: 1.6, prowlSpeed: 80, prowlStride: 130, prowlNear: 240, idleRecovery: 1,
  turnDeadZone: 14, homePull: 1.5, prowlMin: 12, sinkHidden: .5, holdChance: .5,
  moves: {
    /** 쇠붙이 흡수: 입에서 장수 쪽 부채(앞에서 tilt 안) · length 6P · halfAngle 30도 · reach 입에서 이 거리 안이면 쓴다 · pull 맞으면 입 쪽으로 끌려가는 px */
    suction: { phase: 1, body: .8, red: 1.2, recover: 1.5, strike: .5, impactAt: .4, damage: 26, length: 240, halfAngle: Math.PI / 6, reach: 330, tilt: .55, pull: 46 },
    /** 철갑 박치기: width 4P · lengthShare 판 높이 몫(.6H) · scrape 앞발 긁기(seeded 0~이 초 · 몸 예고 뒤 · 붉은 예고 앞) · travel 타격 시간 가운데 달리는 몫 ·
     *  min 최소 거리 · tilt 앞에서 이만큼까지 비스듬히 · minTravel 이 몫보다 짧게 끊기면 안 쓴다 · wallR 머리가 목책에 닿는 반지름 · wallHit 박힌 마디 피해 · wallStun 박힌 뒤 더 쉬는 초(머리 노출) */
    ram: { phase: 1, body: .5, red: .7, scrape: .6, recover: 1.5, strike: .45, impactAt: .8, travel: .8, damage: 30, width: 160, lengthShare: .6, min: 100, tilt: .55, minTravel: .35, wallR: 24, wallHit: 2400, wallStun: 1.4 },
    /** 앞발 내려찍기: rx·ry 타원 반지름(4P×5P) · reach 발에서 이 거리 안 · ahead 발이 앞으로 내딛는 px 한도 · sideBias 발 자리보다 이만큼 위까지는 가까운 발 · lift 드는 높이 · wallHit 타원에 닿은 마디 피해 */
    stomp: { phase: 1, body: .45, red: .45, recover: 1, strike: .22, impactAt: .55, damage: 26, rx: 80, ry: 100, reach: 260, ahead: 110, sideBias: 10, lift: 150, wallHit: 900 },
    /** 지하 질주·출현: width 띠 폭(3P) · radius 출현 원(3P) · min 이보다 가까우면 안 쓴다 · front 타격 시간 가운데 솟는 앞머리가 띠를 다 지나는 몫(그 뒤 impactAt 에 출현) · wallHit 출현 원에 닿은 마디 피해 */
    burrow: { phase: 2, body: .8, red: 1.2, recover: 1.5, strike: .8, impactAt: .75, front: .65, damage: 30, width: 120, radius: 120, min: 200, wallHit: 3000 },
    /** 철편 회전 살포: lines 선 수 · slots 방향 칸 수(하나는 비운다 · seeded) · width 1P · inner 발 자리에서 떨어진 시작 · length 선 길이 · spinHz 도는 빠르기(돌아서기 / 초) */
    spin: { phase: 2, body: .8, red: 1, recover: 2, strike: .4, impactAt: .35, damage: 24, lines: 8, slots: 9, width: 40, inner: 135, length: 620, spinHz: 2.4 },
    /** 가벼운 몸 쌍돌진(등 철갑이 벗겨진 뒤 · 막 3): width 3P · lengthShare · rush 첫 돌진 전 몸 수축 유지(seeded 0~이 초) · followBody·followRed 둘째 돌진을 다시 예고 · 나머지는 박치기와 같은 뜻 */
    double: { phase: 3, body: .6, red: .9, rush: .4, recover: 2, strike: .35, impactAt: .8, travel: .8, damage: 28, width: 120, lengthShare: .5, min: 100, tilt: .7, minTravel: .3, wallR: 24, wallHit: 1800, wallStun: 1, followBody: .3, followRed: .7 },
  },
  env: { border: 28, gap: 160, hub: 150, radial: [0, 35, 145, 180, 215, 325], lineWidth: 40, strips: [[.22, 64], [.78, 64]] },
  rig: {
    scale: .78,
    /** body 몸통 그림이 붙는 점 · 살(root) 캡슐 from→to · radius / back 등 철갑 캡슐 · lift 철편이 들리는 px / shoulder 어깨 철판 타원 · raise 세울 때 도는 라디안 */
    body: { pivot: [0, -186], from: [-150, -158], to: [146, -170], radius: 76 },
    back: { from: [-172, -232], to: [96, -258], radius: 62, lift: 40 },
    shoulder: { center: [118, -236], radii: [72, 56], raise: .5 },
    /** 다리: socket 어깨·엉덩이(가까운 쪽) · paw 쉬는 발 자리 · radius 캡슐 · far 먼 쪽 다리가 옮겨 서는 몫 · tuckMin·stretch 발을 들고 뻗을 때 다리 길이 몫 한계 */
    fore: { socket: [118, -168], paw: [150, 0], radius: 34 },
    hind: { socket: [-126, -162], paw: [-150, 0], radius: 34 },
    far: [24, -16], tuckMin: .74, stretch: 1.04,
    /** neck 머리가 붙는 점 · head 머리 판정 타원(목 점 기준 · 머리 각으로 돈다) · hinge 턱 관절 · mouth 입 · jaw 턱 캡슐(length · 기본 각 · 벌림 라디안 · 부서지면 dangle) · tail 꼬리 캡슐 */
    neck: [160, -198],
    head: { center: [197, 27], radii: [68, 62], hinge: [14.6, 27], mouth: [262, 54] },
    jaw: { length: 259, angle: .27, open: .5, radius: 30, dangle: .42 },
    tail: { root: [-192, -184], length: 170, angle: Math.PI - .32, radius: 30 },
  },
  motion: {
    rest: { lift: 0, pitch: 0, shift: 0, head: 0, jaw: 0, swell: 0, shoulder: 0, plates: 0, tail: 0, paw: [0, 0, 0, 0, 0, 0, 0, 0], sink: 0 },
    recover: { lift: 18, pitch: -.06, shift: 6, head: .32, jaw: .3, swell: 0, shoulder: 0, plates: 0, tail: .12, paw: [8, 0, 6, 0, 0, 0, 0, 0], sink: 0 },
    suction: {
      prepare: { lift: -8, pitch: .1, shift: -16, head: -.2, jaw: 1, swell: 1, shoulder: .2, plates: .1, tail: -.15, paw: [16, 0, 12, 0, -8, 0, -6, 0], sink: 0 },
      impact: { lift: -2, pitch: .05, shift: -28, head: -.12, jaw: 1, swell: .55, shoulder: .2, plates: .1, tail: -.25, paw: [18, 0, 14, 0, -10, 0, -8, 0], sink: 0 },
    },
    ram: {
      prepare: { lift: 22, pitch: -.08, shift: -22, head: .2, jaw: .15, swell: .2, shoulder: 1, plates: .2, tail: .25, paw: [-22, 0, -18, 0, 14, 0, 12, 0], sink: 0 },
      impact: { lift: 12, pitch: -.1, shift: 26, head: .24, jaw: .2, swell: .1, shoulder: 1, plates: .2, tail: -.2, paw: [26, 0, 20, 0, -12, 0, -10, 0], sink: 0 },
      /** 앞발 긁기: 빠르기(번/초) · 앞뒤 px · 드는 px */
      scrapeHz: 2.6, scrapeX: 34, scrapeY: 18,
    },
    stomp: {
      prepare: { lift: -10, pitch: .16, shift: -20, head: -.22, jaw: .5, swell: .3, shoulder: .3, plates: 0, tail: -.2, paw: [26, -150, -6, 0, 8, 0, 6, 0], sink: 0 },
      impact: { lift: 14, pitch: -.06, shift: 18, head: .1, jaw: .6, swell: 0, shoulder: .1, plates: 0, tail: .2, paw: [0, 0, -4, 0, -6, 0, -4, 0], sink: 0 },
    },
    burrow: {
      prepare: { lift: 34, pitch: -.22, shift: 8, head: .45, jaw: .3, swell: -.2, shoulder: .3, plates: .3, tail: .3, paw: [26, 0, 22, 0, 12, 0, 10, 0], sink: 1 },
      impact: { lift: -16, pitch: .12, shift: 10, head: -.2, jaw: .9, swell: .4, shoulder: .4, plates: .4, tail: -.4, paw: [18, -30, 14, -26, 0, 0, 0, 0], sink: 0 },
    },
    spin: {
      prepare: { lift: 20, pitch: 0, shift: 0, head: .12, jaw: .25, swell: .3, shoulder: .4, plates: 1, tail: .45, paw: [12, 0, 10, 0, -12, 0, -10, 0], sink: 0 },
      impact: { lift: 6, pitch: .04, shift: 0, head: -.1, jaw: .5, swell: .1, shoulder: .2, plates: 0, tail: -.3, paw: [6, 0, 4, 0, -6, 0, -4, 0], sink: 0 },
    },
    double: {
      prepare: { lift: 24, pitch: -.08, shift: -32, head: .14, jaw: .4, swell: -.7, shoulder: .6, plates: 0, tail: .35, paw: [-26, 0, -22, 0, 18, 0, 16, 0], sink: 0 },
      impact: { lift: 10, pitch: -.1, shift: 30, head: .18, jaw: .5, swell: .1, shoulder: .6, plates: 0, tail: -.3, paw: [30, 0, 24, 0, -14, 0, -12, 0], sink: 0 },
    },
    roar: { lift: -16, pitch: .22, shift: -10, head: -.42, jaw: 1, swell: .6, shoulder: .5, plates: .5, tail: -.35, paw: [10, 0, 8, 0, 0, 0, 0, 0], sink: 0 },
    /** 등장: 문 쇠붙이를 씹는 자세 (머리를 문 위로 숙인다) */
    chomp: { lift: 16, pitch: -.1, shift: 14, head: .26, jaw: 0, swell: .3, shoulder: .4, plates: .2, tail: .2, paw: [14, 0, 10, 0, 0, 0, 0, 0], sink: 0 },
    limp: { lift: -42, back: -14, sag: .05 },
    breath: { lift: 3, hz: .3, tail: .07, tailHz: .19, swell: .12 },
    walk: { swing: 26, raise: 24, bob: 5, tail: .12, head: .05 },
    stagger: { shift: -14, pitch: .06, head: -.2 },
  },
  /**
   * 그리기만: behind* 장수가 몸 뒤(발보다 위)에 서면 옅게 · brokenShade 부서진 다리·머리 덧칠 · exposedPulse* 벗겨진 살이 붉게 숨쉼(빠르기 · 세기)
   * plate* 부서진 철갑 조각(초 · 조각 수 · 날아가는 px · 솟음 · 무게 · 도는 빠르기) · spark* 쇠 불티 · dust* 흙먼지 · land* 땅을 울린 먼지
   * suck* 흡수에 빨려 드는 쇠 부스러기(수 · 크기) · shard* 회전 살포 철편 · trench* 지하 질주 흙 두둑 · shadow* 발밑 그림자 · sinkDepth·sinkClip 땅속으로 잠기는 깊이·땅 가림
   * mouth* 입 안 · fall* 쓰러짐(승리 막 내림)
   */
  view: {
    behindAlpha: .5, behindPad: 10, brokenShade: 'rgba(36,26,22,.45)', exposedPulseHz: 1.3, exposedPulse: .22, exposedTint: '#ff5a3c',
    plateLife: 1, plates: 7, plateSpeed: 260, plateRise: 220, plateGravity: 620, plateSpin: 7,
    sparkLife: .45, sparks: 10, sparkSpeed: 230, sparkColor: '#ffcf7a', iron: '#9c8f86', rust: '#8a4a2a', dirt: '#6b5040',
    dustLife: .7, dustSize: 150, landLife: .6, landSize: 190, landSpan: 1.6,
    suckBits: 14, suckSize: 7, shardSize: 18, trenchWidth: 46, trenchAlpha: .75, moundSize: 70,
    shadowAlpha: .32, shadowShift: 10, shadowWidth: 260, shadowHeight: 36,
    sinkDepth: 420, sinkClip: 8, turnSquash: .75, mouthColor: '#2a0d0b',
    fallSeconds: 2.8, fallHold: .45, fall: { lift: 110, pitch: -.16, head: .6, jaw: .5, paw: [40, 0, 30, 0, -26, 0, -18, 0], tail: .4 },
  },
} as const

export const HAEBI_CHAMPION = {
  extraSeconds: 30, eliteLateRamp: 300, entrySeconds: .65, cooldown: 3.3, phaseRate: 1.2, roarSeconds: .65,
  dashWind: 1.05, dashRange: 400, dashSpeed: 340, dashWidth: 24, dashDamage: 20,
  slamWind: 1.35, slamRadius: 120, slamDamage: 30,
  fanWind: 1.1, fanCount: 5, fanSpread: .85, fanSpeed: 220, fanLife: 2.6, fanDamage: 15, fanHitRadius: 20,
  summonWind: 1, summonCount: 3, waveCount: 4, summonRadius: 180,
  guardSeconds: 1.5, guardFront: .3, guardRear: 1.2,
  recoverySeconds: 1.25, recoveryDamage: 1.5, attackRange: 330, phaseMove: 1.15,
  chestRadius: 22, fastSeconds: 20, viewGrid: 8, minViewShare: .5,
  view: { recoveryLean: .12, recoveryRingRadius: 28, recoveryRingAlpha: .45, roarRingRadius: 65, roarRingAlpha: .5,
    /** 53-B 스테이지 정예 띠(칸 144 · 발 142 · bake-elite-strips.py)를 그리는 높이 — 옛 산적 두령(칸 128 · 100)과 몸 크기를 맞추고 조금 키움 */
    eliteArtHeight: 118,
    elitePlateWidth: 120, elitePlateHeight: 26, elitePlateLift: 14, eliteHpHeight: 4, eliteNameFont: 12, eliteMargin: 4, eliteBottomInset: .25,
    chestSize: 32, chestLargeSize: 42, chestGlowAlpha: .35, chestCoinCount: 5, chestCoinSize: 12, chestCoinSeconds: .65, chestCoinSpread: 18 },
  stages: {
    forest: { patterns: ['dash', 'slam', 'summon'], eliteHp: 1.35, eliteLateScale: 2.4, bossHp: 11.5, minion: 'club' },
    ford: { patterns: ['dash', 'fan', 'slam'], eliteHp: 1, eliteLateScale: 2.4, bossHp: 6, minion: 'dog' },
    palisade: { patterns: ['guard', 'slam', 'dash'], eliteHp: 1, eliteLateScale: 1, bossHp: 6, minion: 'shield' },
    snow: { patterns: ['dash', 'slam', 'fan'], eliteHp: 1, eliteLateScale: 1.8, bossHp: 6, minion: 'bear' },
    fortress: { patterns: ['slam', 'fan', 'summon'], eliteHp: 1, eliteLateScale: 1, bossHp: 6, minion: 'iron' },
  },
} as const

/**
 * 60-JACKPOT 상자 (RAID-REWARD-MAP §3-1·3-2 · 형 11-22 「추천대로」 · 다이센카 틀) — 정예 상자는 고르지 않고 터진다.
 * counts 단계마다 오르는 칸 수 · slow 느리게 잡은 상자의 단계 몫 · fast 빨리 잡은(HAEBI_CHAMPION.fastSeconds 안) 상자의 단계 몫 (counts 와 같은 차례 · 합 1)
 * pityStep 5개 넘게 못 터진 상자마다 다음 상자의 5개 몫에 더하는 값 (가장 낮은 단계 몫에서 뺀다 · 5개 넘게 터지면 0 으로) · 8개 몫은 그대로
 * spareGold 올릴 칸이 없어 엽전으로 바뀌는 한 칸 값 (스테이지 금 몫·전리품을 곱한다)
 * view: 연출 (화면만 · 판의 셈은 멈춰 있다) — seconds 단계마다 길이(초) · colors 단계마다 빛(본편 유물 상자의 흔함·귀함·보배 + 대박 보라)
 *  enter 상자가 가운데로 오는 초 · enterDrop 떨어져 내리는 높이(px) · shakes 들썩이는 번수 · shakeGap [첫 틈, 끝 틈](초 · 빨라진다) · shakeMs 한 번 들썩이는 길이 · shakePx·shakeDeg 들썩임 · shakeGrow 번마다 커지는 몫
 *  burstHold 터진 뒤 첫 룬까지 · burstMs·burstPop 터질 때 상자가 튀는 길이·크기 · glowMs 빛이 켜지는 길이 · edgeMs 화면 가장자리 빛(5개부터 · 저사양은 없음)
 *  runeHold 솟은 룬이 날아가기 전에 머무는 초 · runeMs 솟는 길이 · runeGapMin 룬 사이 가장 짧은 틈 · rowMs 결과 줄에 서는 길이 · tail 끝 여운(초)
 *  mergeSeconds 새로 연 조합의 재료 룬 둘이 합쳐지는 길이 · mergeFrom 재료가 오는 거리(룬 크기 몫)
 *  freezeAt 대박이 멎는 들썩임 번호(0부터) · freezeLag 그 들썩임이 시작되고 멎기까지 · pushSeconds 「눌러!」를 안 눌러도 터지는 초 · pushPx 「눌러!」 흔들림(px) · skipGuard 막 열린 뒤 이 초 동안의 누름은 건너뛰기로 안 친다(싸우던 손) · pushGuard 「눌러!」가 뜨고 눌리기까지 · skipHold 건너뛴 뒤 결과를 보여 주는 초 · frameCap 한 틀에 밀리는 가장 긴 초(끊긴 틀에 연출이 건너뛰지 않게)
 *  coins 단계마다 엽전 알 수 · lowCoins 저사양 몫 · coinSize [작게, 크게]px · coinRise·coinSpread·coinFall 솟는 높이·퍼짐·떨어짐(px) · coinMs [짧게, 길게] · coinWave 한 번에 터지는 알 수(나머지는 coinGap ms 뒤에)
 *  chest 상자 그림 크기(px · 화면 짧은 변의 chestShare 몫과 견주어 작은 쪽) · glow 빛 지름(상자 크기 몫 · glowLow 저사양) · rune 솟는 룬 크기(px) · dim 판을 덮는 어둠
 *  소리: drumRate 북이 룬마다 오르는 몫 · drumBase 들썩임 북의 첫 높이 · drumVol·jingleVol·freezeVol 크기 (곡은 raid/sound.ts 의 chest1·chest3·chest5·chest8·chestFreeze 자리 · 형이 고르면 파일만 바꾼다)
 */
/**
 * 68-BOSSCHEST 중간 보스 상자 (형 11-23 「템이 너무 잘 나와서 중간보스 잡은 보상이 뇌화연옥밖에 없던 적이 너무 많음」) — 늘 서로 다른 카드 셋:
 * ① 안 연 조합(뇌화 연옥도 · 혼자만 나오지는 않는다) ② 연 조합의 다음 단계 ③ 갈래 끝 → 주 무기 → 나머지 칸 · 조합 아닌 칸은 고르면 ranks 단계를 한꺼번에 (끝 단계에서 멈춘다).
 * 올릴 것이 정말 하나도 없으면 카드 대신 판 금 gold (스테이지 금 배수 · 상점 「탐욕」 몫을 곱한다 · 화면에 「보스 전리품」 금빛 글자)
 */
export const HAEBI_BOSS_CHEST = { ranks: 2, gold: 150 } as const
export const HAEBI_JACKPOT = {
  counts: [1, 3, 5, 8], slow: [.9, .08, .02, 0], fast: [0, .85, .12, .03], pityStep: .05, spareGold: 25,
  view: {
    seconds: [3, 5, 8, 12], colors: ['#e0a85a', '#7ac0ff', '#ffd27a', '#c78bff'],
    enter: .35, enterDrop: 46, shakes: 3, shakeGap: [.42, .22], shakeMs: 260, shakePx: 7, shakeDeg: 5, shakeGrow: .35,
    burstHold: .3, burstMs: 320, burstPop: 1.35, glowMs: 420, edgeMs: 900,
    runeHold: .45, runeMs: 260, runeGapMin: .25, rowMs: 180, tail: .5, mergeSeconds: .6, mergeFrom: 1.3,
    freezeAt: 2, freezeLag: .1, pushSeconds: 2.5, pushPx: 5, pushGuard: .2, skipGuard: .5, skipHold: .7, frameCap: .25,
    coins: [6, 14, 28, 48], lowCoins: .35, coinSize: [14, 22], coinRise: 150, coinSpread: 190, coinFall: 120, coinMs: [700, 1150], coinWave: 12, coinGap: 90,
    // 11-22 Claude(형 「알아서 결정해 봐」): 상자가 PC 에서도 200px 에 묶여 작았다 → 최대 360 · 단계마다 더 크게(tierScale) · 룬도 같은 몫
    chest: 360, chestShare: .52, tierScale: [.82, .92, 1, 1.12], glow: 2, glowLow: 1.3, rune: 120, dim: .62,
    drumRate: 1.122, drumBase: .8, drumVol: .5, jingleVol: .6, freezeVol: .5,
  },
} as const
export const HAEBI_TREE = { max: 3, rankStep: .4, upgradeChance: .5, ultDamage: 1.4, ultArea: 1.25, ultCooldown: .8,
  /**
   * 갈래 셋 (11-17 밤 형: 「다 찍을 정도로 레벨 올리는 건 의미 없지 않아? 몇 개만 몰빵하거나 여러 개를 일단 찍거나」 · D2 식).
   * 갈래마다 네 층 — 층 n 은 그 갈래에 tiers[n] 점을 찍어야 열린다 (주 무기 첫 단계도 1점) · 4층 = 갈래 끝(빌드를 바꾸는 칸 · capMax 단계).
   * 한 판(20분)에 찍는 점은 레벨 44 까지 43점 · 갈래 칸을 다 채우면 약 100점이라 다 못 찍는다 (2.3배).
   * lean: 레벨업 카드가 이미 찍은 갈래로 끌리는 세기 — 칸 무게 = 1 + lean × 그 갈래 점수 몫 (카드 하나는 늘 다른 갈래)
   */
  tiers: [0, 3, 7, 12], capMax: 3, lean: 2,
  /**
   * 시작 단계 (11-19 형: 「시작은 평타만」 · 「둘 다 빼기」) — 판은 주 무기(평타) startPrimary 단계 하나로 시작하고,
   * 보조 공격(아라의 「검기」·해비의 「질풍 도끼」…)은 startSecondary 단계(0 = 없음)라 첫 레벨업 카드로 얻는다 (첫 카드 셋의 맨 앞이 늘 그것).
   * 시련(8분)도 같은 규칙: 첫 레벨업이 15초 안팎(xpBase)이라 짧은 판에서도 「평타 → 첫 카드로 보조 · 비기가 열림」을 그대로 본다.
   * 선봉(3분)은 HAEBI_VANGUARD.startLevel 과 함께 갖춘 채로 선다 (createHaebi).
   */
  startPrimary: 1, startSecondary: 0,
  /** 3층 · 주 무기 벼리기(주 무기 피해 +hone/단계) · 보조 숙련(보조 공격 피해 +drill · 빠르기 +drillTempo /단계) */
  hone: .12, drill: .14, drillTempo: .08,
  /** 버팀 갈래 — 단단한 몸(받는 피해 −tough/단계) · 숨 고르기(초마다 +breath 회복) · 날랜 발(회피 재사용 −nimble · 이동 +nimbleMove) · 굳센 몸(최대 체력 +stout) */
  tough: .07, breath: .45, nimble: .12, nimbleMove: .04, stout: 24,
  /** 버팀 끝 「되받아치기」 — 맞으면 그 묶음 비기가 작게 터진다 · 재사용 counterCd − counterCdStep × (단계−1) 초 · 힘 counter + counterStep × (단계−1) */
  counterCd: 12, counterCdStep: 2, counter: .4, counterStep: .15,
  /**
   * 갈래 끝 (주 무기 a · 보조 b) — 피해 몫은 share + step × (단계−1)
   * 도끼 a 땅 가르기: 휘두를 때마다 길이 length · 반폭 width 로 땅이 갈라진다 · b 돌아오는 회오리: 질풍 도끼가 life × turn 에서 되돌아온다
   * 활 a 꿰뚫는 일제: 화살이 모두 꿰뚫고 단계마다 extra 대 더 · b 폭우: 화살비 자리에 delay 초 뒤 한 번 더
   * 창 a 삼지창: 양옆(spread 라디안)으로도 찌른다 · b 솟는 창: 던진 창이 처음 꿰뚫은 자리 둘레 radius 에 창날이 솟는다
   * 칼 a 칼바람 베기: 벨 때마다 짧은 검기(life 초) · b 십자 검기: 검기가 뒤로도
   * 단검 a 독 묻은 쌍검: 찌른 적이 poison 초 동안 깎인다 · b 터지는 비도: 처음 맞힌 자리에서 작은 칼 shards 개
   * 방울 a 신령 부르기: 방울이 울릴 때마다 혼불 단계 수만큼 · b 갈라지는 혼불: 터지면 혼불 split 개로
   * 돌팔매 a 땅울림: 떨어진 둘레가 daze 초(+daStep/단계) 멈춤 · b 끝없는 물수제비: 튀는 수 +bounces/단계 · 튈 때마다 피해 ×(1+grow)
   */
  cap: {
    axe: { a: { share: .55, step: .25, length: 300, width: 34 }, b: { share: 1, step: .3, turn: .5 } },
    bow: { a: { share: 1.3, step: .2, extra: 1 }, b: { share: .55, step: .25, delay: .35 } },
    spear: { a: { share: .55, step: .2, spread: 2.1 }, b: { share: .7, step: .25, radius: 80 } },
    sword: { a: { share: .45, step: .2, life: .55 }, b: { share: .6, step: .2 } },
    dagger: { a: { share: .5, step: .15, poison: 2.5 }, b: { share: .35, step: .15, shards: 3 } },
    magic: { a: { share: .7, step: .2 }, b: { share: .55, step: .2, split: 3 } },
    sling: { a: { daze: .45, daStep: .2 }, b: { bounces: 2, grow: .1 } },
  },
} as const
/**
 * 58-KITS 무기 개성 (11-22 형 「그래 추천대로해」 · docs/realm/WEAPON-IDENTITY-20261122.md) — 새 규칙(opts.kitRules)으로 켠 판에만 쓴다 · 옛 기록은 위 HAEBI_RUN 그대로.
 * 몸 둘레 360도는 방울(주술)과 비기·각성 터짐만 · 공용 부적·벽력은 내 무기가 맞힌 데서 붙고 튄다 · 칼 반달만 걷는 쪽으로 (시험).
 * 피해 몫(damage·share)은 그 무기의 원래 피해에 곱한다 · 거리는 px · 시간은 초.
 * stillDecay: 걸으면 「멈춰 선 시간」이 초마다 이 배로 준다 (stillCap 초까지만 쌓인다) · runTurn: 이만큼(라디안) 안으로만 꺾으면 「곧게 달리기」가 이어진다
 * boltIdle: 벽력이 다 돈 뒤 이만큼(초) 큰 한 방이 없으면 다음 무기 맞힘에서 튄다 (큰 한 방이 드문 판에서도 벽력이 놀지 않게)
 * axe 내려찍기: 박자 cooldown · 피해 damage 배 · 앞 반원(등 뒤 back px까지) · 맞은 적을 knock px 밀고 daze 초 멈춤 · 4단계부터 밀기 rank4Knock 배 · 정예·두목·거구에 rank4Big 배
 * bow: 화살 피해 base 배 · 겨눔: 멈춰 focus 초 서 있으면 다음 화살이 damage 배 · 모두 꿰뚫음 · 맞는 크기 radius · 그림 크기 size px · 찬 순간 발밑 고리 ring
 * spear: 찌르기 피해 base 배 · 돌격: 같은 쪽으로 chargeTime 초 달리면 길이 length 배 · 피해 damage 배 · 꿴 적을 앞으로 knock px · 줄 세우기: 꿴 적 하나 더마다 lineBonus (lineMax 까지) · bigPierce 마리 넘게 꿰면 큰 한 방
 * sword 1-2-3: every 번째 칼마다 반달 검기(피해 waveShare · 맞는 크기 waveRadius 배 · 그림 waveSize px · 수명 waveLife) · 그 칼에 맞은 적 knock px 밀기 · 4단계부터 부채가 arc4 (등 뒤는 비움)
 * dagger: 찌르기 피해 base 배 · 4단계부터 부채가 넓어짐(arc4 · 등 뒤는 비운다 · 둘레 원은 아니다) · 손 닿는 거리 안의 가장 센 적 · 등 뒤(다른 데 정신 팔림·멈춤·방금 그림자 걸음)면 crit 배 · 독 한 겹 = 피해 × poisonShare(poisonTime 초) · poisonMax 겹(4단계부터 poisonMax4) · bigStacks 겹부터 큰 한 방
 *   그림자 걸음(빠져나가기): stepRadius 안에 적 stepCrowd 마리 넘게 붙으면 찌를 큰 놈 등 뒤 stepBeside px 로 · 재사용 stepCd
 * bell 굿판: 멈춰 groundTime 초 서 있으면 둘레가 radius 몫 넓어지고 피해 damage 몫 세짐 (걸으면 줄어든다)
 * sling: 장수 near px 안의 적은 피해 nearShare 배 · 멀수록 떨어진 둘레 +far 몫(던질 거리 끝에서) · 떨어진 돌이 앞으로 bounce px 한 번 더 튐(피해 bounceShare) · bigHits 마리 넘게 맞히면 큰 한 방
 * gale 질풍 도끼: 높이 던져 flight 초 뒤 앞 throwMin~throw px 에 떨어짐(둘레 splash · 그림은 arc px 높이 포물선) · 박힌 채 spin 초 돌며(그림 landedSize px) spinEvery 초마다 둘레 spinRadius 를 spinShare 몫으로
 * rain 화살비: 첫 화살비는 가장 가까운 적(몸을 지킨다) · 나머지는 활 거리 × look 안에서 cluster px 안에 적이 가장 많이 뭉친 곳 (같으면 먼 곳) · 둘째 화살비부터 흩어짐 spreadMore 배
 * seal 부적: 내 무기가 맞힌 적에 붙어 delay 초 뒤 터짐 (메아리 한 단계마다 한 장 더 · 같은 적에 한 장)
 * crack 산 가르기(도끼 조합): every 번째 내려찍기마다 앞으로 length · 반폭 width 의 갈라진 땅이 life 초 · tick 초마다 share 몫 피해 · 위의 적 daze 초 멈칫
 * volley 일제 사격(활 조합): HAEBI_RUN.volleyInterval 초마다 앞 부채 arrows 발(사이 spread 라디안) · 겨눔이 찼으면 모두 꿰뚫음
 * wall 창벽(창 조합): every 초마다 앞 ahead px 에 창날 spikes 개(사이 gap)가 가로로 life 초 · tick 초마다 피해 · 넘어오는 적은 벽 바깥으로 밀림(반폭 width)
 * tempest 삼연격(칼 조합): 셋째 칼 반달이 layers 겹(사이 spread 라디안) · 첫째·둘째 칼 피해 +share
 * mark 표식 사냥(단검 조합): every 초마다 shadowRange 안의 가장 센 적에 표식 · 그림자가 그 적만 벰 · 내 찌르기가 표식에 닿으면 burst 배로 터짐
 * shard 갈라짐 조각(천 갈래 바람 · 유성 화살비 · 폭렬비도): 앞으로만 spread 라디안 사이 부채
 */
export const HAEBI_KITS = {
  stillDecay: 3, stillCap: 2, runTurn: .45, boltIdle: 1.2,
  axe: { cooldown: 1.3, damage: 1.9, back: -30, knock: 38, daze: .25, rank4Knock: 2, rank4Big: 1.5 },
  bow: { base: 1.15, focus: .6, damage: 2.2, radius: 16, ring: 30, size: 60 },
  spear: { base: 1.3, chargeTime: 1, length: 1.45, damage: 1.35, knock: 34, lineBonus: .08, lineMax: 6, bigPierce: 2 },
  sword: { every: 3, waveShare: 1.2, waveRadius: 1.5, waveLife: .9, knock: 34, arc4: .7, waveSize: 86 },
  dagger: { base: 1.2, arc4: -.3, crit: 2, poisonShare: .3, poisonTime: 3, poisonMax: 4, poisonMax4: 8, bigStacks: 3, stepCd: 2, stepCrowd: 3, stepRadius: 60, stepBeside: 34 },
  bell: { groundTime: 2, radius: .6, damage: .5 },
  sling: { near: 90, nearShare: .5, far: .4, bounce: 70, bounceShare: .4, bigHits: 2 },
  gale: { flight: .45, throwMin: 90, throw: 220, splash: 60, spin: 1, spinEvery: .3, spinRadius: 46, spinShare: .4, arc: 90, landedSize: 38 },
  rain: { look: 1.3, cluster: 90, spreadMore: 2 },
  seal: { delay: .8 },
  crack: { every: 3, length: 260, width: 30, life: 1.5, tick: .3, share: .45, daze: .12 },
  volley: { arrows: 5, spread: .1 },
  wall: { every: 1.6, spikes: 5, gap: 36, ahead: 95, life: 1.5, tick: .3, width: 22 },
  tempest: { layers: 2, spread: .16, share: .25 },
  mark: { every: 1.2, burst: 3 },
  shard: { spread: .35 },
} as const
/**
 * 판 안 각성 (11-17 · RAID-LINK §1 디지몬식) — 적을 잡으면 막대가 차고(잡졸 kill · 정예 elite · 두목 boss 점), 다 차면 sec 초 동안 각성.
 * 막대 크기 = need × (1 + 각성한 수 × needGrowth) · 각성 동안 피해 ×power · 공격 속도 ×tempo · 이동 ×move · 비기 쿨이 ultRate 배로 돈다.
 * 각성할 때 둘레 burstRadius 를 burstDamage(× 힘) 로 치고 밀어낸다 · 본편에서 각성 못 한 장수는 「영웅의 투지」(grit*) — 모습은 그대로, 짧고 작게 · 보호막(gritShield*).
 * 숲·여울·목책을 다 깬 장수(숙련)는 막대 mastery 몫을 채우고 시작한다.
 */
export const HAEBI_AWAKEN = {
  /**56A permanent qualification; legacy timed-awake values below stay unchanged for old records. */
  permanent: { power: 1.35, tempo: 1.3, move: 1.15, ultRate: 2.5 },
  need: 160, needGrowth: .5, kill: 1, elite: 30, boss: 0,
  sec: 9, power: 1.35, tempo: 1.3, move: 1.15, ultRate: 2.5, burstRadius: 210, burstDamage: 90,
  gritSec: 7, gritPower: 1.12, gritTempo: 1.12, gritMove: 1.08,
  /**
   * 영웅의 투지 보호막 (11-17 형: 「영웅의 투지로 해 주고 보호막 효과도 주는 거지」) — 투지를 켜면 최대 체력의 gritShield 몫을 먼저 받아 낸다.
   * 다 깎이거나 투지(gritSec)가 끝나면 사라진다 · 두를 때·깨질 때 gritShieldBurst 둘레 빛 고리.
   * 몸 둘레 방패 빛(그리기만): 가로 gritShieldRx · 세로 gritShieldRy · 짙기 gritShieldAlpha · 맞아서 막은 직후 gritShieldFlash 초 동안 더 밝게.
   */
  gritShield: .3, gritShieldBurst: 110, gritShieldRx: 46, gritShieldRy: 58, gritShieldAlpha: .6, gritShieldFlash: .18,
  mastery: .5,
  /**
   * 각성 단추 (11-17 형: 「게이지 다 찼을 때 각성 버튼이 생기고 누르면 각성」) — 막대가 다 차면 찬 채로 기다린다.
   * 누르면 cast 초(판 시각 · HAEBI_ULT.slow 로 느려짐) 동안 각성 컷인 · 그동안 비기는 기다린다 · 끝나는 순간 둘레를 친다(burst*).
   * 각성 동안은 다치지 않는다 (금빛 체력 막대 · 오라).
   */
  cast: .6,
} as const

/**
 * 열전 스테이지 (형 11-16: 「스테이지를 다른 걸 줘서 적도 다르게 난이도도 어렵게 · 깨면 휘장」) — length 는 판 길이 배수.
 * tiers: 판을 다섯 토막으로 나눠 토막마다 나오는 적 둘 (앞 토막 적은 다음 토막에 안 나온다 · 「쉬운 적은 초반에만」).
 * 숲 산길 damage .9 (11-17): 상점 없는 새 사람의 첫 판 — 봇 씨앗 1~10 에서 일곱 묶음 모두 7/10 이상 (docs/BALANCE.md 2026-11-17).
 * trial 은 본편 각성 시련: 숲 산길의 짧고 쉬운 판 (상점 강화 없이도 깰 수 있게 · 형 11-16 「따로 떼기」).
 * art (51-2 · 그리기만): 그 스테이지에서 이 종류를 그릴 그림 — 판 셈(종류·능력치·스폰 표)은 그대로, 그림만 스테이지마다 (haebi-view.ts warlord).
 *  file 은 public/realm/anim-px/<file>.png (칸 144 · 발 140 · tools/sprite-kit/bake-stage-enemies.py) · scale 은 HAEBI_MOBS[종류].height 에 곱해 그리는 키 —
 *  대기 몸 키가 같은 종류 옛 bandit-<종류> 띠(칸 128)와 같게 굽는 도구가 셈해 찍는다(키 위 표식·별은 옛 키 그대로라 머리 위 같은 자리).
 *  화살비 궁수(archer)는 머리 위 붉은 화살촉이 얹히는 몸이라 스테이지마다 모자·깃 실루엣이 다르다 · 숲 화살비 궁수는 그림이 오면 넣는다.
 */
export const HAEBI_STAGES = {
  forest: { name: '숲 산길', length: 1, hp: 1, damage: .9, spawn: 1, bossHp: 1, gold: 1, bg: 'forest.webp', boss: 'bandit-warlord', bossName: '산적 대두목', eliteName: '정예 산적', elite: 'elite-forest',
    tiers: [['club', 'dog'], ['runner', 'dog'], ['shield', 'berserker'], ['berserker', 'archer'], ['iron', 'firearcher']],
    art: { club: { file: 'enemy-forest-leather', scale: 1.155 }, shield: { file: 'enemy-forest-vine-shield', scale: 1.108 }, archer: { file: 'enemy-forest-barrage-archer', scale: 1 } } },
  ford: { name: '물안개 여울', length: 1, hp: 1.7, damage: 1.8, spawn: 1.3, bossHp: 1.8, gold: 2, bg: 'ford.webp', boss: 'boss-ford', bossName: '여울 물두령', eliteName: '정예 여울 도적', elite: 'elite-ford',
    tiers: [['dog', 'runner'], ['runner', 'dog'], ['shield', 'berserker'], ['berserker', 'archer'], ['iron', 'dog']],
    art: { runner: { file: 'enemy-ford-pole', scale: 1.07 }, berserker: { file: 'enemy-ford-net', scale: 1.029 }, archer: { file: 'enemy-ford-barrage-archer', scale: 1.228 } } },
  palisade: { name: '목책 돌파', length: 1, hp: 2.2, damage: 2.2, spawn: 1.4, bossHp: 2.8, gold: 3.2, bg: 'palisade.webp', boss: 'boss-palisade', bossName: '배신한 성주', eliteName: '정예 수비병', elite: 'elite-palisade',
    tiers: [['shield', 'runner'], ['iron', 'dog'], ['berserker', 'shield'], ['runner', 'firearcher'], ['iron', 'archer']],
    art: { runner: { file: 'enemy-palisade-spear', scale: 1.133 }, shield: { file: 'enemy-palisade-wood-shield', scale: 1.091 }, archer: { file: 'enemy-palisade-barrage-marksman', scale: 1.36 } } },
  /** 11-16 H47·H50~H52: 설원 고개 — 범(멈칫 뒤 길게 덮침) · 반달곰(일어서서 내려침 · 아주 단단함) · 맥족 투창 사냥꾼(붉은 줄 뒤 창) · 두목 H54 설산 우두머리(쇠도리깨) */
  snow: { name: '설원 고개', length: 1, hp: 2.4, damage: 2.3, spawn: 1.45, bossHp: 3.6, gold: 4.5, bg: 'snow.webp', boss: 'boss-snow', bossName: '설산 우두머리', eliteName: '정예 설산 도적', elite: 'elite-snow',
    tiers: [['dog', 'tiger'], ['runner', 'tiger'], ['bear', 'dog'], ['berserker', 'hunter'], ['tiger', 'archer']],
    art: { berserker: { file: 'enemy-snow-fur-axe', scale: 1.068 }, runner: { file: 'enemy-snow-shield-pursuer', scale: 1.105 }, archer: { file: 'enemy-snow-barrage-hunter', scale: 1.179 } } },
  /** 11-16 H48·H53: 불타는 산성 — 횃불 방화꾼(지나간 자리에 불바닥 · 기름 단지) · 두목 H55 불의 반란 장군(달군 망치) */
  fortress: { name: '불타는 산성', length: 1, hp: 3.2, damage: 3, spawn: 1.6, bossHp: 4.6, gold: 6.5, bg: 'fortress.webp', boss: 'boss-fortress', bossName: '불의 반란 장군', eliteName: '정예 반란군', elite: 'elite-fortress',
    tiers: [['shield', 'runner'], ['berserker', 'dog'], ['iron', 'berserker'], ['runner', 'torch'], ['iron', 'archer']],
    art: { iron: { file: 'enemy-fortress-scorched-guard', scale: 1.084 }, berserker: { file: 'enemy-fortress-ash-axe', scale: 1.1 }, archer: { file: 'enemy-fortress-barrage-marksman', scale: 1.204 } } },
  trial: { name: '각성 시련', length: .4, hp: 1, damage: 1, spawn: 1, bossHp: .3, gold: 0, bg: 'forest.webp', boss: 'bandit-warlord', bossName: '산적 대두목', eliteName: '정예 산적', elite: 'elite-forest',
    tiers: [['club', 'archer'], ['runner', 'slinger'], ['shield', 'dog'], ['berserker', 'firearcher'], ['iron', 'shaman']], art: {} },
} as const
/**
 * 적 종류 — hp 는 그 시각 잡졸 체력의 배수 · share 는 토막 안에서 둘째 적이 나올 비율 · xp 는 떨어뜨리는 기세 · height 는 화면 키(px).
 * 몸짓: 창돌격꾼은 붉은 줄로 예고하고 곧게 돌진 · 투석꾼·불화살은 떨어질 자리에 고리 · 방패는 투사체를 덜 받음 · 개는 떼로 ·
 * 광전사는 반 아래면 빨라짐 · 철갑은 안 밀림 · 무당은 둘레 적을 북돋움 (빨라지고 덜 아픔)
 */
export const HAEBI_MOBS = {
  club: { hp: 1, speed: 1, hit: 1, xp: 1, share: 0, height: 64 },
  archer: { hp: .8, speed: 1, hit: 1, xp: 2, share: .2, height: 64 },
  runner: { hp: .8, speed: 1.25, hit: 1.2, xp: 2, share: 0, height: 64 },
  slinger: { hp: .7, speed: 1, hit: 1, xp: 2, share: .2, height: 62 },
  shield: { hp: 2.4, speed: .7, hit: 1.4, xp: 3, share: 0, height: 72 },
  dog: { hp: .45, speed: 2.1, hit: .8, xp: 1, share: .3, height: 46 },
  berserker: { hp: 1.8, speed: .95, hit: 1.6, xp: 3, share: 0, height: 74 },
  firearcher: { hp: .9, speed: 1, hit: 1, xp: 3, share: .2, height: 64 },
  iron: { hp: 3.2, speed: .65, hit: 1.8, xp: 4, share: 0, height: 76 },
  shaman: { hp: 1.5, speed: .9, hit: .8, xp: 5, share: .12, height: 66 },
  // 11-16 설원 고개(H50~H52) · 불타는 산성(H53) 적 — 그 스테이지에만 나온다
  tiger: { hp: 1.6, speed: 1.35, hit: 1.6, xp: 4, share: .3, height: 64 },
  bear: { hp: 5, speed: .55, hit: 2.2, xp: 6, share: .25, height: 70 },
  hunter: { hp: 1, speed: 1, hit: 1, xp: 3, share: .2, height: 64 },
  torch: { hp: 1.2, speed: 1.15, hit: 1.2, xp: 3, share: .3, height: 64 },
  runnerRange: 260, runnerWind: .7, runnerDash: .55, runnerDashSpeed: 4.2, runnerCooldown: 3.5,
  lobRange: 380, lobCooldown: 4.5, lobDelay: 1.2, lobRadius: 38, lobDamage: 9,
  flameLife: 3, flameRadius: 44, flameDamage: 8,
  shieldBlock: .45, dogPack: 5, berserkSpeed: 1.9,
  shamanRange: 300, shamanEvery: 4, shamanRadius: 210, shamanBuff: 4, shamanSpeed: 1.4, shamanArmor: .35,
  /** 범: 멈칫(웅크림) 뒤 길게 덮침 — 창돌격꾼보다 멀리서·빠르게 · 곰: 일어서서 내려침(바닥 원 · 안 밀림) */
  tigerRange: 320, tigerWind: .55, tigerDash: .5, tigerDashSpeed: 5.4, tigerCooldown: 3.2,
  bearRange: 95, bearWind: .9, bearRadius: 72, bearDamage: 16, bearCooldown: 3.2,
  /** 맥족 투창: 멈춰 붉은 줄로 겨눔 → 빠른 창 한 자루 (사거리 안에선 서서 던짐) */
  hunterRange: 430, hunterWind: .8, hunterCooldown: 4.5, hunterSpeed: 440, hunterLife: 1.4, hunterDamage: 5,
  /** 횃불 방화꾼: 달리며 몇 초마다 불바닥을 떨어뜨림(짧게 탐 · 판 위 불바닥 수 상한) + 가까우면 기름 단지(불화살과 같은 고리) */
  torchTrail: .7, torchTrailLife: 1.8, torchRange: 260, torchCooldown: 5, flameCap: 40,
} as const
/** 판 밖 상점 — 영구 강화 (형 11-16 · 다이센카처럼 언제든 되돌려 받기) · step 은 단계마다 더하는 값 · cost 는 첫 단계 값 */
export const HAEBI_SHOP = {
  might: { max: 10, step: .06, cost: 60 }, vigor: { max: 10, step: 15, cost: 50 }, armor: { max: 5, step: 1.5, cost: 90 },
  regen: { max: 5, step: .3, cost: 80 }, haste: { max: 5, step: .04, cost: 120 }, swift: { max: 5, step: .04, cost: 70 },
  /** 50-4: 10단은 판 전체. 목책 추천의 투자 문턱은 예전5단 가치로 유지한다. */
  magnet: { max: 10, step: .2, cost: 50, recommendationCap: 5 }, wisdom: { max: 5, step: .06, cost: 100 }, revive: { max: 2, step: 1, cost: 600 },
  reroll: { max: 3, step: 1, cost: 150 }, greed: { max: 5, step: .1, cost: 120 }, luck: { max: 5, step: .03, cost: 110 },
  /** 단계 값 = cost × (단계+1)^growth */
  growth: 1.45,
} as const
/**
 * 상점 「전부 되돌리기」 값 (11-19 형: 「능력치 초기화는 무료로 하지 말고 돈 써서 · 적당한 가격으로」) — 쓴 금은 다 돌려받되 지금 가진 금에서 값을 낸다.
 * 값 = 쓴 금 × share · 적어도 min · 많아야 쓴 금 그 자체(되돌려 받는 것보다 비싸지 않게) · round 단위로 맞춘다 (raid/meta.ts refundFee).
 * 근거 (11-19 봇 판 · REACT=.5 · 도끼·활·창·칼 × 씨앗 7,11 · 판 하나에 받는 금 runGold):
 *  - 상점 0: 숲 이김 1,308~1,319(평균 1,312) · 여울 이김 3,380~3,400 · 여울 짐 634~953 · 목책 0~51
 *  - 상점 3할: 숲 1,565~1,583 · 여울 이김 4,015~4,101 · 짐 1,324~1,382 · 목책 짐 0~3,935
 *  - 상점 값: 한 단계 50~600(처음) ~ 1,690(힘 10단계) · 다 사면 37,335
 *  min 600 = 숲 한 판(이김 1,312)의 절반쯤 — 초반엔 한 판 벌이 반을 내야 다시 찍는다 · share .15 = 다 산 상점(37,335)이면 5,600 ≈ 여울 한두 판
 */
export const HAEBI_REFUND = { share: .15, min: 600, round: 10 } as const
/** 판이 끝나면 받는 금 — 지면 적게, 다 깨면 많이 (형 11-16) · 스테이지 gold 배수 · greed 강화를 곱한다 */
export const HAEBI_GOLD = { perKill: .05, perElite: 12, perMinute: 6, clear: 400 } as const
/**
 * 목책의 「1분 벽」 (각성 v2 가9 · docs/realm/study-20261118/14-ref-pacing.md 6-2 · 6-4 의 2) — 상점이 얇은 손님은 목책에서 곧바로 쓰러져
 * 금 한두 자리를 받는다. 그런데 출전 화면은 「열렸고 아직 못 깬 첫 스테이지」인 그 목책을 골라 뒀다. 벽 앞에서는 바로 앞 스테이지(여울)를 골라 둔다
 * (raid/meta.ts pickStage). 손님이 직접 목책을 고르는 것은 막지 않는다. 벽을 넘었다고 보는 때는 둘 가운데 하나:
 *  - survive: 그 스테이지에서 이 초를 넘겨 버틴 적이 있다. 봇 118판(11-18 · 아래)에서 벽에 막힌 판은 0:24~2:51 에 끝났고 그 밖은 3:35 넘게 갔다(거의 18~19분)
 *  - shop: 상점에 쓴 금이 상점 전체 값(37,335)의 이 몫에 닿았다. 무기 묶음마다 다르다.
 * 근거 (11-18 · REACT=.5 tools/raid-stage-balance.ts palisade 일곱 묶음 · 씨앗 7,11 · SHOP 0~.8 → 쓴 금 0 · 2 · 4 · 12 · 14 · 28 · 32 · 52 · 62% · 62% 는 단검 · 활 · 돌팔매만):
 *  - 도끼 · 칼 · 창 .12: 금 12% 에서 여섯 판이 모두 5분을 넘겼다(다섯은 19분 두목까지 · 셋 이김). 4% 에서는 도끼가 0:55 · 1:18
 *  - 주술 .32: 28% 는 1:57 · 2:51, 32% 는 둘 다 19분
 *  - 돌팔매 .5: 32% 는 1:19 와 이김으로 갈렸고 52% 는 둘 다 이김 / 활 .5: 32% 까지 1분 안, 52% 는 둘 다 19분
 *  - 단검 .64: 52% 에서도 한 판은 1:56, 62% 는 이김과 3:35. 14 의 표에서 단검 봇이 목책을 처음 깬 가장 낮은 몫이 64%
 * 씨앗 둘짜리 봇 값이다. 사람 손으로 잰 뒤(가10) 다시 본다.
 */
export const HAEBI_WALL = { stage: 'palisade', survive: 180, shop: { axe: .12, sword: .12, spear: .12, magic: .32, sling: .5, bow: .5, dagger: .64 } } as const
/**
 * 56-C 목책을 진짜로 (11-21 형: 「3스테이지 목책이 오브젝트도 아니라서 다 그림 밟고 온다」) — 목책 돌파 판(규칙 56C)에만 선다.
 * 판을 가로지르는 목책 줄을 마디(축에 맞춘 상자)로 세운다. 장수도 적도 성한 마디에 막힌다 · 화살·던진 것은 넘어간다.
 * 적은 곧게 못 오면 가장 가까운 문(열린 문 · 부서진 마디)으로 돌아 들어온다(문까지 곧장 · 길 찾기 없음 · 프레임 예산).
 * 마디는 체력이 있다: 장수의 공격·비기가 닿으면 깎이고(내가 부수면 지름길) 창돌격꾼 돌진 · 정예·두목도 부순다. 부서진 마디는 지나간다.
 * 가운데 큰 문(g)이 「마지막 문」 — 부서진 판 초를 palisade.gateBrokenAt 에 적는다(거대 보스 연결은 뒤에 · 두목 때는 그대로).
 *  y 줄의 발 자리(판 y) · depth 막는 띠의 반 두께(px) · layout 왼쪽부터 w 말뚝 마디 · o 열린 문 · g 큰 문(문은 두 마디 폭 · 마디 폭 = 판 폭 ÷ 마디 수)
 *  wallHp·gateHp 체력 · heroR·mobR·bigR 부딪힘 반지름(장수 · 잡졸 · 정예·두목) · aimMargin 문으로 돌 때 문 기둥·띠에서 띄우는 px
 *  bash·bashEvery·bashPush 장수가 목책 쪽으로 밀면 내려친다: 한 번 피해(× 레벨·상점 힘 · 모습) · 사이(초 ÷ 맹공) · 목책 쪽으로 미는 몫(입력 방향 0~1)
 *  hit 장수의 공격이 닿을 때 한 번에 깎는 값(레벨과 무관) — melee 주 무기 근접(도끼·칼·창·단검·방울 · 떨어진 팔매돌) ·
 *    splash 터짐·조합 둘레(부적·화살비·혼불·뇌화·도는 도끼 … · 마디가 번쩍이는 동안은 다시 안 깎는다) · skill 비기·각성 터짐.
 *    공격의 피해 숫자를 쓰지 않는다 — 무기 단계·조합으로 수십 배 크는 피해를 받으면 줄이 통째로 녹는다
 *    (11-22 봇 판: 피해 그대로면 4분 · 정한 값 × 레벨 힘이어도 5분 안에 줄이 다 무너졌다). 목책은 일부러 밀어 부수는 것(bash · 레벨 힘을 탄다)이 첫 길이다.
 *  chargeBreak 창돌격꾼 돌진이 박힐 때 · champBash·bossBash 정예·두목이 밀 때 초당 · champDash 정예·두목 돌진이 박힐 때
 *  flash 맞은 번쩍(초) · hitLift 맞은 불꽃을 띄우는 높이(px · 말뚝 허리) · breakDust 부서질 때 흙먼지 둘레(마디 폭의 몫)
 * view (그리기만): wallDraw·brokenDraw 마디 그림 폭(마디 폭의 몇 배 · 끝 가로대가 이웃과 겹친다) · gateOverhang 문 기둥이 이웃 마디에 걸치는 px · foot 그림 발을 줄보다 내리는 px
 *   shake·shakeHz 맞을 때 흔들림(px · 빠르기) · behindAlpha·behindPad 장수가 마디 바로 뒤에 서면 옅게(그림 폭 + 이만큼 안) · bar* 깎인 체력 막대(맞은 뒤 보이는 초 · 이 몫 아래로 깎여야 뜸 · 폭 몫 · 키 · 띄움) ·
 *   debris* 부서질 때 나무 조각(초 · 수 · 빠르기 · 솟음 · 무게 · 크기 · 튀어 오르는 높이 px · 도는 빠르기) · dust* 흙먼지(퍼짐 몫 · 오르는 px/초 · 커지는 배) ·
 *   breakShake·breakShakeLife 부서질 때 판 흔들림(큰 문은 gateShake 배) · shadow* 발밑 그늘(짙기 · 세로 반지름 · 가로 반지름 = 마디 폭의 몫)
 */
export const HAEBI_PALISADE = {
  y: 205, depth: 8, layout: 'wwwwowwwgwwwowwww',
  wallHp: 1500, gateHp: 15000, heroR: 14, mobR: 10, bigR: 18, aimMargin: 4,
  bash: 120, bashEvery: .45, bashPush: .45, hit: { melee: 8, splash: 1, skill: 25 },
  chargeBreak: 220, champBash: 240, bossBash: 600, champDash: 500,
  flash: .14, hitLift: 28, breakDust: .6,
  view: {
    wallDraw: 1.1545, brokenDraw: 1.177, gateOverhang: 6, foot: 2, shake: 2.5, shakeHz: 70, behindAlpha: .5, behindPad: 20,
    barShow: 2.5, barFrom: .95, barWidth: .7, barHeight: 4, barLift: 6,
    debrisLife: .6, debris: 9, debrisSpeed: 170, debrisLift: 120, debrisGravity: 420, debrisSize: 16, debrisFrom: 30, debrisSpin: 9,
    dustSpread: .35, dustRise: 30, dustGrow: 2,
    breakShake: 5, breakShakeLife: .3, gateShake: 2, shadowAlpha: .28, shadowHeight: 7, shadowWidth: .56,
  },
} as const

export interface Knob {
  readonly v: number
  readonly min: number
  readonly max: number
  readonly step: number
  /** 슬라이더에 표시될 한글 설명. 형이 6주 뒤에 봐도 알아야 한다. */
  readonly label: string
  readonly unit?: string
}

const k = (v: number, min: number, max: number, step: number, label: string, unit?: string): Knob =>
  unit === undefined ? { v, min, max, step, label } : { v, min, max, step, label, unit }

/** 열전 화면 전용 타격감. 판의 피해·이동·난수에는 관여하지 않는다. */
export const HAEBI_IMPACT = {
  criticalStop: .04, eliteStop: .08, bossSkillStop: .12, hurtStop: .08, cooldown: .25,
  shakeLife: .2, shakeCritical: 2, shakeElite: 4, shakeHurt: 4, shakeSkill: 7, shakeMax: 8,
  shakeXHz: 91, shakeYHz: 77, shakeYShare: .6,
  mobFlash: .12, whiteTime: .05, mobJitter: 2.5, mobJitterHz: 83, squashX: 1.15, squashY: .9,
  numberPop: 1.6, numberPopTime: .08, numberCriticalPop: 1.85,
  deathDistance: 60, deathEliteDistance: 100, deathLift: 48, deathBounce: 13,
  deathBounceAt: .65, deathSpin: 2.7, deathFadeAt: .65,
  // 치명타 마무리 「홈런」 (11-23 형 「너무 빠르고 소리도 별로 · 클라우드 메도우의 둑, 팡~~ 이 안 느껴진다」 · 옛 .24초 → 세 박자):
  // hold 초 맞은 자리에서 부풀며 멈춤(「둑」) → 위로 크게 떠 멀리 날아가며 작아짐(빨리 떠서 느려짐 · 「팡」) → starAt 몫부터 반짝 별이 터지며 사라짐(「~~」)
  criticalFinish: { life: .95, hold: .1, holdScale: 1.12, distance: 560, lift: 170, endScale: .2, spin: 4.2, fadeAt: .72, starAt: .7, starSize: 34, starColor: '#fff2b0', trailAlpha: .2, trailOffsets: [.03, .06], maxBodies: 4, lowMaxBodies: 2 },
} as const

/**
 * 열전 장수 몸놀림 (62-A · 11-21 형: 「걷는 거랑 공격이 부자연스럽다 · 프레임이 부족한 건지 매끄럽지 못해서」) — 화면 전용(raid/hero-motion.ts).
 * 판(haebi.ts)의 피해·쿨다운·이동·난수는 그대로다. 시간은 모두 판 초(s.t)라 멈춤·숨은 탭·맞은 순간 멈춤 때 같이 멈춘다.
 *
 * 공격 박자: 판은 공격이 서는 그 걸음에 곧바로 친다(attack = window · 맞은 불꽃·숫자·소리도 그때). 그래서 맞힘을 늦추지 않고
 * 서는 순간부터 휘두름(swing 초) → 맞힘 칸에서 멈춤(contact 초 · 맞은 순간 멈춤 동안은 이 칸에 머문다) → 남은 시간 천천히 마무리.
 * 예비 동작(뒤로 젖힘)은 한 번 친 뒤 다음 공격 쿨다운의 마지막 anticTime 초에만 미리 보인다 — 서 있고, 가장 가까운 적이
 * 지금까지 친 거리 안(× anticReach + anticPad px)일 때만. 빗나가면(쿨다운이 끝났는데 안 침) anticCancel 초 준비 칸에 머물다 선다.
 * 그래서 첫 한 방에는 예비가 없다 — 그것까지 맞추려면 판이 피해를 늦춰야 한다(판 셈 바꿈 · 이번엔 안 함).
 */
/**
 * 열전 장수 서기 계획 (형 11-23 「숨쉬는 건 너무 등산하는 숨쉬기 · 기본 idle 은 서 있는 자세 2컷으로 텀 길게 움직이다가 가끔씩 큰 숨 · 테일즈위버·던파처럼 개성 있게」 ·
 * 같은 날 「idle 누가 코드로 짜랬냐 · 몸이 막 잘리잖아」 → 칸 고르기만 · 몸을 누르거나 옮기지 않는다). 화면만 (raid/hero-idle.ts · 판 상태에 쓰지 않는다).
 * 띠마다 계획 plans[띠 이름(gen- 뒤)] — 없으면 예전 그대로 HAEBI_ANIM.idle 을 idleTime 초마다 (판 시각).
 *   cells 띠 칸 수 (20 칸 넘는 띠도 · 그리는 쪽이 칸 폭을 이것으로 나눈다 · 없으면 20) · base 서기 칸들을 hold 초씩 · blink 눈 감는 칸 · breath 큰 숨 칸들 · quirk 버릇 칸들 (20 넘어도 된다)
 * 때는 쉬기 시작한 뒤(걷기·공격·맞음·시전이 끝난 때부터)의 시계 — 눈 깜빡임 blinkEvery 초 사이마다 blinkTime 초 · 큰 숨 breathEvery 사이마다 breathTime 초(칸 여럿이면 나눠서) ·
 *   버릇 quirkEvery 사이마다 칸마다 quirkStep 초(계획에 quirkTimes 가 있으면 칸마다 그 초). 셋은 겹치지 않는다(앞 일이 끝나고 gap 초 뒤에야 다음) · 사이는 띠 이름과 시각으로만 정해 장수마다 어긋난다(난수 없음) ·
 *   cycle 초마다 새 차례(오래 서 있어도 셈이 늘지 않게) · 움직임 줄이기(기기 설정)면 base 만 ·
 *   싸움 자세(계획 stance · 참고 연구: 잘 만든 2D 액션은 적이 있으면 다른 서기 자세): 장수 stanceR px 안에 산 적이 있거나 떠난 뒤 stanceLinger 초까지 base 대신 stance 칸 · 깜빡임만 (아직 쓰는 띠 없음) ·
 *   attack 공격 칸 계획 (raid/attack-plan.ts · HAEBI_ANIM 주석)
 * 새 띠 차례: 0~19 정규(본 띠 gen-X.png · 늘 20칸) · 20 부터는 덧 띠 gen-X-x.png — 20·21 쓰러짐 가운데 두 칸 · 22~25 버릇 네 칸 (cells = 본 띠 20 + 덧 띠 칸).
 * 범(beom) 띠: 0·1 서기(같은 그림) · 2 눈 감음 · 3 큰 숨 · 덧 띠 20 앉음 · 21 돌아누우며 한 손 짚음 · 쓰러짐 18 → 20 → 21 → 19 ·
 * 매화(maehwa) 띠: 0~3 서기(같은 그림 · 깜빡임·큰 숨 칸 아직 없음) · 덧 띠 20·21 쓰러짐 가운데 · 버릇 「깃털 매만지기」 22~25 (모자 깃털에 손을 뻗음 · 매만짐 · 볼에 손 대고 윙크 · 팔을 내림 · 먼 손은 늘 활을 쥔다)
 * 달빛(base-w-31-dabeol-dalbit) 띠: 0~3 서기(같은 그림) · 덧 띠 20·21 쓰러짐 가운데 · 버릇 「머리카락 넘기기」 22~25 (머리 한 가닥을 쥠 · 팔꿈치를 높이 들어 넘김 · 손이 목덜미를 타고 내려옴 · 팔을 내림)
 *   범 할퀴기 덧 띠 26~33 (26 웅크림 · 27 팔을 멀리 뒤로 · 28 머리 위로 들며 내디딤 · 29 맞힘(팔을 뻗고 손을 크게) · 30 팔이 내려감 · 31 팔이 뒤로 · 32 일어섬 · 33 서기로)
 *   — attack: 26·27 은 쿨다운 끝 예비 · 28 휘두름 · 29 맞힘이 예전 맞힘 때에 제 초 그대로 · 30~33 은 공격 시계 남은 시간에 줄여 넣는다(raid/attack-plan.ts) · 칸 안에서 몸이 내닫아 코드 런지·늘임·잔상은 끈다
 *   범 버릇 「손톱 살피기」 덧 띠 22~25 (손톱을 들여다봄 · 손끝을 훅 붊 · 씩 웃으며 손을 털음 · 팔을 내림 · 발은 서기 칸 자리 그대로) — 느린 몸짓이라 칸마다 quirkTimes 초 (셋째 칸에 조금 더 머문다)
 */
export const HAEBI_IDLE = {
  blinkTime: .18, blinkEvery: [3.2, 5.6], breathTime: .7, breathEvery: [9, 14], quirkStep: .28, quirkEvery: [7, 11], gap: .6, cycle: 60, stanceR: 260, stanceLinger: 1.5,
  plans: {
    beom: { cells: 38, base: [0, 1], hold: 2.4, blink: 2, breath: [3], fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .3, .38, .25],
      attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.08, .07, .05, .07, .06, .07, .08, .12], hit: 3 }, hurt: [34, 35], rise: [36, 37] },
    haebi: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28],
      attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    areum: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28],
      attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    maehwa: { cells: 30, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25], hurt: [26, 27], rise: [28, 29] },
    'base-w-31-dabeol-dalbit': { cells: 30, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .42, .3, .25], hurt: [26, 27], rise: [28, 29] },
    'base-w-13-young-archer': { cells: 30, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25], hurt: [26, 27], rise: [28, 29] },
    'base-w-10-pirate-captain': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-17-mahan-pearl-diver': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-06-buyeo-huntress': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-64-miri-dallae': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    ara: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-22-dongye-tiger-huntress': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    noeul: { cells: 30, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25], hurt: [26, 27], rise: [28, 29] },
    sagong: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    sinneoul: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    heo: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-08-mahan-warrior': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-23-usisan-whale-queen': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-26-iseo-tomboy-general': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-72-eumjeup-beol': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    tneoul: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    odi: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-76-gampyeong-baetsagong': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-34-chopal-deulme': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-102-garak-dana': { cells: 30, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25], hurt: [26, 27], rise: [28, 29] },
    'base-w-36-baekje-maena': { cells: 30, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25], hurt: [26, 27], rise: [28, 29] },
    'base-w-56-dongokjeo-sogeum': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    budeul: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-53-hwanna-gabi': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-18-jinhan-salt-widow': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    beombal: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    irang: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.08, .09, .09, .05, .15, .08, .09, .12], hit: 3 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    sogeumbi: { cells: 34, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], attack: { cells: [22, 23, 24, 25, 26, 27, 28, 29], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [30, 31], rise: [32, 33], xGeom: { h: 224, root: 92, foot: 216 } },
    baram: { cells: 34, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .12, .12, .08, .08, .12], hit: 3 }, xGeom: { h: 224, root: 92, foot: 216 } },
    byeol: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-71-yeonna-neoul': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-39-gosaburi-galmae': { cells: 26, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25] },
    'base-w-41-hwanna-beodeul': { cells: 26, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25] },
    'base-w-79-yangmaek-solmae': { cells: 26, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.28, .3, .42, .25] },
    'base-w-46-geonma-maru': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .12, .12, .08, .08, .12], hit: 3 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-48-mujin-mudeung': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .12, .12, .08, .08, .12], hit: 3 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-80-usan-gangchi': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .05, .15, .07, .08, .12], hit: 4 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    'base-w-81-byeokjin-byeolbit': { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .12, .12, .08, .08, .12], hit: 3 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
    beomi: { cells: 38, base: [0, 1], hold: 2.4, fall: [18, 20, 21, 19], quirk: [22, 23, 24, 25], quirkTimes: [.3, .32, .4, .28], attack: { cells: [26, 27, 28, 29, 30, 31, 32, 33], times: [.09, .08, .11, .12, .12, .08, .08, .12], hit: 3 }, hurt: [34, 35], rise: [36, 37], xGeom: { h: 224, root: 92, foot: 216 } },
  },
} as const
export const HAEBI_ANIM = {
  /** 판이 공격 때 세우는 attack 값(haebi.ts 의 s.attack = .3) — 공격 칸 시계의 길이 */
  window: .3,
  /** 열전 띠 칸: 서기(idleTime 초마다 다음) · 걷기 첫 칸 · 맞음 · 비기 시전(기를 모으는 자세) */
  idle: [0, 1, 2, 1], idleTime: .65, walkCell: 4, hurtCell: 18, castCell: 12,
  /** 계획에 맞음 두 칸(hurt)이 있는 띠: 깎인 체력이 최대 체력의 hurtStrong 몫 이상이면 크게 맞음 — 움츠림을 hurtSnap 초 보인 뒤 젖혀짐 (판의 맞음 시계 .3 초 안) */
  hurtStrong: .06, hurtSnap: .08,
  /** 계획에 일어남 두 칸(rise)이 있는 띠: 되살아난 뒤 riseTime 초 동안 한 무릎(앞 riseSplit 몫) → 넓게 섬 (판의 무적 2 초 안 · 화면만) */
  riseTime: .55, riseSplit: .6,
  /**
   * 공격 칸 역할 — 열전 띠(anim-px 정규 20칸)의 공격은 모든 장수가 12..17 이다(대결 원본 틀 [9..13,0] 같은 번호와 다르다 · codex62 PREP).
   * ready 준비(빗나간 예비를 거둘 때) · antic 예비 · swing 휘두름 · contact 맞힘·쏨 · recover 마무리(서기로).
   * strike: 내려치기·베기·찌르기·흔들기(도끼·칼·창·단검·방울·돌팔매) — 12 준비 · 13 젖힘 · 14 휘두름 · 15 맞힘 · 16·17 거둠.
   * draw: 활 — 13 메김 · 14 당김을 예비로, 15 놓음이 맞힘 칸(화살이 그 걸음에 나간다) · 휘두름 칸 없음.
   */
  roles: {
    strike: { ready: 12, antic: [13], swing: [14], contact: 15, recover: [16, 17], anticTime: .3, stretch: .06 },
    draw: { ready: 12, antic: [13, 14], swing: [], contact: 15, recover: [16, 17], anticTime: .36, stretch: 0 },
  },
  /** draw 역할을 쓰는 무기 묶음 (나머지는 strike) */
  drawKits: ['bow'],
  /** 휘두름 칸 보이는 판 초 (아주 짧게) · 맞힘 칸 멈춤 판 초 · 마무리 두 칸 중 앞 칸 몫 (뒤 칸 — 서기로 돌아가는 칸 — 을 더 오래) */
  swing: .04, contact: .08, recoverSplit: .4,
  /** 걷는 중 공격은 마무리를 이만큼(판 초)만 보이고 걷기로 돌아간다 — 공격 칸이 오래 미끄러지지 않게 · 예비는 서 있을 때만 */
  moveRecover: .06,
  /** 예비 거두기 · 예비 거리(지금까지 친 순간 가장 가까운 적 거리의 최댓값 × anticReach + anticPad px) · 예비 때 뒤로 젖히는 px */
  anticCancel: .06, anticReach: 1.05, anticPad: 6, anticPull: 2,
  /**
   * 힘을 다 모은 칸(예비의 마지막 칸 · 활은 시위를 끝까지 당긴 칸)에 머무는 몫 — 예비 시간(anticTime)의 이만큼을 그 칸에 쓰고 앞 칸들은 나머지를 나눈다.
   * 11-24 형 「타격감을 위해 열전에서는 시위 당겼을 때랑 공격 직전 에너지를 최대한 모았을 때의 동작이 약간 더 텀이 있어야 힘주어 때리는 타격감」
   *   → anticTime 을 .1/.14 에서 .3/.36 으로 늘리고 그 절반 남짓을 마지막 칸에. 피해 시각(판)은 그대로 — 예비는 쿨다운 끝에서 미리 보인다.
   */
  anticHold: .55,
  /** 런지(px · 그림만 · 판 좌표·그림자·맞는 자리는 그대로) — 맞힐 때 적 쪽으로 밀었다 마무리 동안 돌아온다 · 음수는 뒤로 반동(활) */
  lunge: { axe: 5, sword: 5, spear: 7, dagger: 4, magic: 0, bow: -2, sling: 2 },
  /** 휘두름 잔상 — 휘두름 칸을 옅게 낱낱이(몸 뒤로 ghostGap px 씩) · 개수 · 첫 진하기 (저사양 0) */
  ghosts: 2, ghostGap: 8, ghostAlpha: .42,
  /**
   * 걷기: bob = 발을 축으로 한 세로 늘임(디딤 칸 0·n/2 에서 줄고 사이 칸에서 늚 · 4칸 띠 24개는 모두, 8칸 띠는 128개 중 115개가 칸 0 에서 발이 가장 벌어진다).
   * 6·8칸 띠는 그림에 이미 출렁임이 있어(정수리 6~7px 흔들림 · 위상 제각각) bobRich 배만. lean = 걷는 쪽으로 기울기(탄젠트 · 위가 앞으로) ·
   * leanTau 초로 따라감 · settle 판 초 동안 마지막 걸음 칸에 머물렀다 선다(한 박 늦게).
   */
  bob: .018, bobCells: 4, bobRich: .4, lean: .03, leanTau: .08, settle: .08,
} as const

/**
 * 쓰러짐 KO 연출 (형 11-23 「쓰러진 자세는 조금 오래 유지되거나 슬로우되거나 줌 되거나 · 1:1 대전 게임의 KO 처럼 · 엘든링식 전투(겨루기)에도」) — 화면만 (판·규칙 그대로).
 * 우리 장수는 쓰러질 뿐이다(글은 「쓰러짐」). 쓰러지는 칸: 띠마다 계획(HAEBI_IDLE.plans[띠].fall) · 없으면 fall(맞음 18 → 누움 19).
 *   새 띠는 18 뒤로 물러섬 → 20 무릎이 꺾여 앉음 → 21 돌아누우며 한 손 짚음 → 19 옆으로 누움(끝).
 * 칸은 맞은 멈춤(HAEBI_END.defeat.freeze) 뒤 fallStep × (칸 수 − 1) 초에 걸쳐 넘어간다 — 1 − (1 − k)^ease 로 앞 칸은 빨리 · 마지막 넘어감은 느리게.
 * 마지막 칸에서 hold 초 멈춘 뒤 결과 창 · 누름 건너뛰기는 minSkip 초 뒤부터 (잘못 눌러 넘기지 않게) · 띠 칸은 길어야 maxCells 칸(막 길이를 정한다).
 * 카메라 (11-23 검수: 1.75배는 누운 몸이 화면 폭의 13% 뿐 → KO 가까이): 누운 몸 폭(장수 그리는 키 × lieWidth · 범 누운 칸을 열전 화면에서 잰 값 약 1.2)이 판 화면 폭의 fill 몫이 되는 배율로
 *   zoomTime 초에 걸쳐 다가간다(살짝 overshoot 만큼 지나쳤다 돌아옴 · 발 위 focusLift px 를 가운데로) · 지금 배율보다 줄이지 않고 maxZoom 을 넘지 않는다(머리칼까지 화면 안 · fill 이 40% 밑이라 양옆 여백).
 *   장수는 적보다 위에 그리고 · 장수 둘레 fadeR px 안의 적은 가까울수록 fadeNear 몫까지 옅게 (누운 몸을 가리지 않게).
 *   둘레는 누운 몸 화면 폭 × clearR 반지름 밖에서 그 dimR 배까지 gray 몫만큼 빛을 빼고 dark 몫만큼 어둡게 (장수는 또렷이).
 * 「패배」 띠는 끝나기 stampLead 초 전에 화면 높이 stampY 몫 자리에 (누운 장수를 가리지 않게) · 땅에 닿을 때 낮은 「쿵」(맞음 소리를 thudRate 배로 낮춰).
 * 움직임 줄이기(기기 설정)면 다가감·흐려짐 없이 칸과 멈춤만. 겨루기(duel): 같은 칸·박자 · 쓰러진 쪽 누운 몸이 화면 폭의 duelFill 몫이 되게(duelMaxZoom 까지) · duelDim 만큼 어둡게 · 결과 글은 쓰러짐이 끝난 뒤.
 * 쓰러짐 칸은 칸 넘어감마다 fallStep 초 (네 칸이면 1.05초) · 마지막 칸 hold 초 그대로.
 */
export const HAEBI_KO = {
  fall: [18, 19], fallStep: .35, ease: 2.2, maxCells: 4, hold: 2.5, minSkip: 1.2,
  fill: .37, lieWidth: 1.2, maxZoom: 6, zoomTime: 1.1, overshoot: .6, focusLift: 30, fadeR: 170, fadeNear: .85,
  clearR: .7, dimR: 2.6, gray: .6, dark: .35,
  stampY: .8, stampLead: .9, thudRate: .6, duelFill: .5, duelMaxZoom: 4, duelDim: .35,
} as const
export const HAEBI_END = {
  defeat: { freeze: .3, slow: 1.2 },
  victory: { duration: 3.8, freeze: .4, stampAt: 2.1, coinAt: 2.35 },
  retreatDuration: 2, slowRate: .25, flashTime: .12, flashAlpha: .88,
  shake: 12, shakeLife: .35, grayMax: .86,
  stampSize: .24, stampOvershoot: .8, stampSettle: .24, bandWidth: .84, bandHeight: .24,
  cameraZoom: .22, cameraTime: 1.5, waveDelay: .0013, mobFallLife: .65,
  coinCount: 12, coinSize: 18, coinTravel: .6, sparkCount: 24, sparkSize: 3,
  sparkLeft: .15, sparkSpan: .7, sparkSequence: .618,
  coinSpread: .2, coinStartY: .67, coinRise: .38, coinTextY: .3, coinFont: .07, coinSeedStep: 2.4, coinFlat: .35,
  skipClickMs: 300,
} as const

/** 낱알·먹·도장은 원본 PNG를 보존하고 화면용 메모리에서만 잘라 한 번 굽는다. */
/**
 * 그을린 자국 (raid/fx-scorch.ts · 형 11-23 「홍련 부적 폭발이 너무 짧다 · 탄 흔적을 남겼다 사라지게」) — 화면 전용 · 시간은 판 초.
 * life 자국이 남는 초 · fadeOut 마지막에 옅어지는 초 · max 한꺼번에 남는 수 · size 폭발 반지름에 견준 크기 · squash 세로 눌림(땅)
 */
export const HAEBI_SCORCH = {
  life: 2.6, fadeOut: 1, max: 40, size: 1.05, squash: .55, alpha: .75, bake: 128,
  /** 보스 땅 울림 자국 반지름(판의 고리는 작아서 따로) · 장수급 적 내려찍기는 그 예고 원 그대로 */
  quakeR: 130, waveLife: .45, waveGrow: 1.5, waveWidth: 7, waveAlpha: .8, waveColor: '#e8d8b0',
  core: 'rgba(20,12,8,.92)', mid: 'rgba(58,34,20,.55)',
  emberLife: 1.1, embers: 5, emberPx: 3, ember: '#ffb04a', flicker: 18,
  /** 흙 자국 (불 아닌 폭발·내려찍기·돌팔매·가시) — 너무 작은 것(minR 아래)은 남기지 않고 큰 것은 maxR 로 자른다 */
  minR: 18, maxR: 140, dirtAlpha: .55,
  dirtCore: 'rgba(40,30,20,.75)', dirtMid: 'rgba(70,52,34,.45)', dirtRim: 'rgba(150,120,80,.28)',
} as const
/**
 * 타격 섬광 (raid/fx-flare.ts · GAP §15-1 · pixelfx Hit spark·Crit hit 를 보고 새로 씀) — 화면 전용.
 * 시간은 효과 나이(초) · 길이는 판 좌표(px) · px = 도트 한 칸 크기.
 */
export const HAEBI_HIT_FLARE = {
  /** 한 프레임에 그리는 섬광 수 (무리를 한 번에 쓸면 수십이 겹친다) */
  budget: 10,
  px: 4, lift: 20, aimJitter: .5, tilt: .16, taper: 1.6,
  flashTime: .05, afterTime: .1, glowTime: .14, ringTime: .18,
  glowRadius: 64, glowAlpha: .7, critGlowAlpha: .95,
  core: 4, afterLen: .55, critScale: 1.55, bigScale: 1.25,
  ringFrom: 16, ringTo: 80,
  whiteUntil: .3, paleUntil: .62, warmUntil: .88,
  /** 연한 노랑 · 노랑 · 주황 (치명타는 더 붉게) */
  colors: ['#fff3a6', '#ffe26b', '#ff8a2a'],
  critColors: ['#ffe0a0', '#ffb347', '#f2561d'],
  /** 십자: 맞는 쪽으로 긴 한 줄 · 뒤로 짧은 하나 · 가로 둘(길이 다름) · 사이 반짝 하나 — a 는 방향(라디안) · len 길이 · vary 흔들림 · w 굵기 */
  rays: [
    { a: 0, len: 72, vary: 10, w: 11 },
    { a: Math.PI, len: 20, vary: 5, w: 11 },
    { a: -Math.PI / 2, len: 34, vary: 7, w: 13 },
    { a: Math.PI / 2, len: 24, vary: 5, w: 11 },
    { a: -Math.PI / 4, len: 15, vary: 4, w: 5 },
  ],
} as const

export const HAEBI_FX_ART = {
  alphaProbeMax: 256, alphaThreshold: 16, particleBakeMax: 96, uiBakeMax: 768,
  deathParticles: 7, eliteParticles: 12, particleBudget: 96,
  particleSeed: 2.399963, particleSpread: .72, particleSpeed: 95, eliteSpeed: 155,
  particleLift: 65, particleGravity: 165, particleSpin: 3.6,
  particleMinSpeed: .6, particleSpeedRange: .4, particleShrink: .3, particleSizeStep: .1,
  inkSize: 16, dustSize: 24, sparkWidth: 18, sparkHeight: 5, sparkGate: .12,
  hitSparks: 3, inkVariants: 3, dustEvery: 4, sparkEvery: 3,
  stampWidth: .68, stampHeight: .36, stampY: .5, rayWidth: .55, rayHeight: .9,
  rayY: .43, rayAlpha: .42, bandAlpha: .75,
  victoryBandAlpha: .42, victorySparkWidth: 9, victorySparkHeight: 3,
  heroRayWidth: 3, heroRayHeight: 4.5, heroRayLift: 1.8,
} as const

export const SPEC = {
  raid: {
    duration: k(90, 30, 300, 5, '토벌 제한 시간', 's'),
    bossAt: k(55, 10, 240, 5, '토벌 두목 등장', 's'),
    speed: k(155, 60, 300, 5, '토벌 이동 속도'),
    health: k(100, 20, 300, 5, '토벌 장수 체력'),
    spawnEvery: k(1.5, .2, 4, .1, '토벌 적 등장 간격', 's'),
    killHeal: k(2, 0, 10, .5, '토벌 격파 회복량'),
    axeRange: k(108, 50, 200, 2, '토벌 도끼 사거리'),
    axeDamage: k(28, 5, 100, 1, '토벌 도끼 피해'),
    axeCooldown: k(.85, .2, 2, .05, '토벌 도끼 공격 간격'),
    bowRange: k(420, 100, 600, 10, '토벌 활 사거리'),
    bowDamage: k(22, 5, 100, 1, '토벌 활 피해'),
    bowCooldown: k(.6, .2, 2, .05, '토벌 활 공격 간격'),
    spearRange: k(160, 80, 250, 5, '토벌 창 사거리'),
    spearDamage: k(24, 5, 100, 1, '토벌 창 피해'),
    spearCooldown: k(.65, .2, 2, .05, '토벌 창 공격 간격'),
    maxEnemies: k(48, 10, 100, 1, '토벌 동시 적 상한'),
    dashCooldown: k(2.8, .5, 10, .1, '토벌 회피 재사용', 's'),
    skillCooldown: k(9, 2, 30, 1, '토벌 비기 재사용', 's'),
  },
  /**
   * 연사(連射)와 몰기(沒技) — 능숙함을 속도로 환전하는 자리 (docs/MEGAHIT.md §1, sim/flow.ts)
   *
   * ★ 이 그룹을 만질 때의 규칙: **정확도 축의 노브는 여기 절대 안 들어온다.**
   *   산포·떨림·화살 속도를 연사에 물리면 빨간 바 계약이 깨진다. 여기는 오직
   *   "활이 손에서 가벼워진다" 축이다 — 만작 시간과 스태미나 소모.
   */
  flow: {
    /**
     * 1중당 만작 시간 배수. 0.88^5 = 0.528 이라 **5중에서 하한에 닿는다** —
     * 그 지점이 정확히 몰기다. 속도의 천장과 몰기가 같은 자리인 건 우연이 아니라 설계다.
     */
    perHit: k(0.88, 0.6, 1, 0.01, '1중당 만작 시간 배수'),
    /** 만작 시간 배수의 하한. 0.38s × 0.55 = 0.209s. 더 줄이면 조준할 시간이 안 남는다. */
    drawFloor: k(0.55, 0.2, 1, 0.01, '만작 시간 배수 하한'),
    /**
     * 1중당 당김 스태미나 소모 배수. 이게 없으면 빨리 쏘는 사람이 스스로 목을 조른다 —
     * 속도를 줬는데 그 속도로 무너지면 준 게 아니다.
     */
    perHitDrain: k(0.94, 0.7, 1, 0.01, '1중당 당김 소모 배수'),
    drainFloor: k(0.72, 0.4, 1, 0.01, '당김 소모 배수 하한'),
    /** 몰기 진입에 필요한 연속 중(中). 5 = 국궁의 한 순(巡). */
    molgiAt: k(5, 2, 15, 1, '몰기 진입 중(中) 수', '발'),
    /**
     * 이만큼 아무것도 안 하면 중(中)이 한 칸 식는다 (s). **망설여도 식는다**가 이 노브다.
     * 활을 잡고 있거나 내 화살이 날고 있는 동안은 안 센다 — 비행 시간은 벌이 아니다.
     */
    coolAfter: k(2.5, 0.5, 10, 0.1, '연사가 한 칸 식는 무행동 시간', 's'),
    /**
     * 판 경계를 넘어 연사를 잇는가 (1=잇는다). **여정이 momentum의 단위다.**
     * 실측 근거: 캠페인 판은 과녁이 1~4개(평균 2.3)라 판 안에서는 3중을 못 넘고
     * 몰기(5)에 **구조적으로 도달할 수 없다**. 끊으면 기능이 존재하지 않는 것과 같다.
     * 끊는 것은 오직 실중과 망설임이어야 한다 — 그래야 한 발 한 발에 값이 매겨진다.
     */
    carry: k(1, 0, 1, 1, '연사를 판 경계 너머로 잇는다'),
  },

  /** 활과 시위 — 당기는 감각 */
  bow: {
    /**
     * 0.85 -> 0.38: 실제 활은 시위를 순식간에 당긴다. 0.85초는 "무거운 걸 힘겹게 미는" 감각이라
     * 활이 아니라 유압장치처럼 느껴졌다. 이 게임의 싸움터는 당기는 구간이 아니라
     * **만작과 빨간 바 사이의 1.6~3.6초**다.
     */
    drawTime: k(0.38, 0.12, 2, 0.02, '만작까지 걸리는 시간', 's'),
    /**
     * 당김 진행 곡선 지수. 1이면 등속, >1이면 처음엔 쭉 당겨지다 마지막 한 뼘이 버겁다.
     * 실제 활의 감각이 이렇다 — 시위는 초반에 가볍고 만작 직전이 제일 무겁다.
     */
    drawEase: k(2.1, 1, 4, 0.05, '당김 곡선 지수 (클수록 마지막이 버겁다)'),
    /**
     * STR 0인 초보가 도달할 수 있는 최대 당김. 1.0 = 진짜 만작.
     * GDD 2장 "시위가 안 당겨진다" — 초보는 애초에 만작이 안 된다. 근력이 붙어야 열린다.
     * 이게 성장의 첫 번째 체감 지점이다.
     */
    maxDrawBase: k(0.72, 0.3, 1, 0.01, '초보의 최대 당김 한계 (1=만작)'),
    releaseDelay: k(0, 0, 0.12, 0.005, '놓은 뒤 화살이 나가기까지 (0이 정답, 올리면 즉시 반려)', 's'),
    /**
     * 18 -> 6 (2026-08-24): 탭(0.03s·당김 0.14)이 27m/s로 39m를 날았다 — "짧게 클릭해도
     * 생각보다 멀리 날아간다"(형). 실제 활은 덜 당기면 화살이 발치에 떨어진다.
     * 6이면 탭이 ~8m/s로 7m쯤에 툭 떨어지고, 반당김이 28m/s로 실제 비율과 맞다.
     * 실수(덜 당김)가 산포가 아니라 **탄도로** 읽히는 게 핵심이다 (물리가 곧 UI, GDD 2장).
     */
    /** 6 -> 3 (재점검): 탭은 발치에 툭 떨어져야 한다. 반당김 이상은 drawCurve가 지배한다. */
    minSpeed: k(3, 1, 60, 1, '최소 당김에서의 화살 초속', 'm/s'),
    maxSpeed: k(62, 20, 140, 1, '만작에서의 화살 초속', 'm/s'),
    /** 장력-속도 곡선. 1이면 선형, >1이면 만작 근처에서 급격히 강해진다(실제 활에 가까움). */
    drawCurve: k(1.6, 0.5, 3, 0.05, '장력 곡선 지수 (클수록 만작이 극적)'),
    /**
     * 시위를 놓는 순간 조준각에 더해지는 무작위 오차의 **최대 크기**. STEADY·FOCUS로 줄어든다.
     *
     * ★ 이건 항상 붙는 기본 오차가 아니다. 실제로 더해지는 값은
     *     gaussian × releaseScatter × (strain + 덜당김 × partialDrawPenalty) × ...
     *   이라, 빨간 바 위(strain 0)에서 만작(덜당김 0)으로 놓으면 **곱해지는 항이 통째로 0**이다.
     *   즉 안전 구간의 만작 릴리즈는 이 노브를 아무리 키워도 오차가 0이다 (실측 0.000 mrad).
     *
     * 0.011 -> 0.0035: 산포가 떨림(읽을 수 있는 채널)의 6.9배라 완벽한 릴리즈가 각오차를
     * 1.0%밖에 못 줄였다 — "놓는 순간이 전부다"(GDD 2장)가 통계적으로 존재하지 않았다.
     *
     * 0.0035 -> 0.0010: 그래도 부족했다. 경계선을 넘긴 뒤의 오차마저 대부분 이 난수였고,
     * 위상을 완벽히 읽어도 σ가 0.00364 -> 0.00362로만 줄었다(명중률 93.0% -> 93.2%).
     * 예산을 떨림으로 옮겨 **읽기가 결과를 바꾸게** 만든다.
     */
    /**
     * 0.0010 -> 0 (2026-08-24, 형의 결정): 숨은 난수를 **끝까지** 없앴다.
     * "특정 커서 위치에서 최대로 당겼다 놓으면 똑같이 박히게. 캐릭터가 힘들어서 흔들리지
     * 않는 한." — 이제 오차의 유일한 출처는 화면에 보이는 떨림(tremorOffset)뿐이다.
     * 빗나간 모든 발은 플레이어가 본 흔들림으로 설명된다. 되돌리려면 이 노브만 올리면 된다.
     */
    releaseScatter: k(0, 0, 0.06, 0.0005, '릴리즈 산포 최대치 (0 = 오차는 보이는 떨림뿐)', 'rad'),
    /**
     * 덜 당기고 놓으면 화살이 흔들리며 날아간다.
     *
     * 이제 이건 배수가 아니라 **오차를 만드는 두 항 중 하나**다 (다른 하나가 strain).
     * 만작(draw == maxDraw)이면 이 항이 정확히 0이 되어, 안전 구간에서는 오차가 통째로 사라진다.
     *
     * 0.55 -> 1.6: 떨림이 빨간 바 아래에서만 생기게 바꾸면서, 덜 당기고 즉시 쏘는 게
     * 오히려 안 떨려 정확해지는 구멍이 생겼다. 짧은 당김은 자세가 불안정해 더 부정확한 게 맞다.
     */
    partialDrawPenalty: k(1.6, 0, 3, 0.05, '덜 당기고 쏠 때 정확도 페널티 (만작이면 0)'),
    /** 붕괴는 큰 페널티다. 예전엔 도메인이 다른 tremor.fatigueMul을 빌려 썼다 — 전용 노브로 분리. */
    collapseScatterMul: k(3.4, 1, 10, 0.1, '붕괴 발사 시 산포 배수'),
    /**
     * 호흡정지가 떨림만 죽이고 난수 산포를 그대로 두면, 참고 쏜 한 발이 오히려 순수 운이 된다.
     * GDD 4장이 FOCUS 효과로 적어둔 "릴리즈 관용 창"이 성립하려면 이 경로가 있어야 한다.
     *
     * 0.55 -> 0.85: 떨림에 권위를 주는 만큼 호흡정지도 같이 세지면, 실력의 축이
     * '위상을 읽었는가'가 아니라 'Shift를 눌렀는가'로 넘어간다(실측: 같은 시점 명중률
     * 블라인드 93% 대 호흡정지 99.9%). 호흡정지는 창을 넓히는 장치지 게임을 대신
     * 이겨주는 버튼이 아니다.
     */
    steadyScatterMul: k(0.85, 0, 1, 0.01, '호흡정지 완전 적용 시 산포 배수'),
  },

  /** 떨림 — 이 게임의 심장. feel-lens가 가장 먼저 보는 곳 */
  tremor: {
    /**
     * 빨간 바를 완전히 넘어 스태미나가 바닥일 때의 떨림 진폭 = **떨림의 상한**.
     * 실제 진폭 = baseAmp × strain^growExp × (STEADY·호흡정지 배수) 이므로
     * 안전 구간(strain 0)에서는 이 값이 얼마든 떨림이 정확히 0이다.
     *
     * 0.0042 -> 0.016: 총 각오차는 그대로 두고 예산을 난수(releaseScatter)에서 여기로 옮겼다.
     * 경계선을 넘긴 발의 떨림 RMS가 실측 1.3~3.5 mrad로, 위상을 읽는 실력이
     * 실제로 명중률을 바꾸는 유일한 경로가 됐다.
     * (화면 진폭은 stickman.ts가 minVisiblePx로 역산하므로 이 값으로 커지지 않는다.)
     */
    baseAmp: k(0.016, 0, 0.05, 0.0002, '최대 떨림 진폭 (스태미나 0에서)', 'rad'),
    /**
     * 경계선을 넘은 뒤 떨림이 자라는 곡선 지수.
     * 1보다 커야 경계선을 갓 넘은 순간이 0에서 부드럽게 시작한다 — 툭 튀면 경계의 의미가 안 읽힌다.
     */
    growExp: k(1.4, 0.5, 3, 0.05, '경계선 이후 떨림 증가 곡선'),
    /** 2옥타브 노이즈. 느린 흔들림 + 빠른 잔떨림. 하나만 쓰면 사인파처럼 예측돼서 지루하다. */
    slowFreq: k(1.15, 0.2, 4, 0.05, '느린 흔들림 주파수', 'Hz'),
    fastFreq: k(6.8, 2, 20, 0.1, '빠른 잔떨림 주파수', 'Hz'),
    fastRatio: k(0.32, 0, 1, 0.01, '잔떨림 비중 (0=느린 흔들림만)'),
    /**
     * 떨림이 최대(스태미나 0)일 때 화면에서 흔들리는 픽셀 크기.
     * stickman.ts가 이 값으로 역산하므로 카메라 배율과 무관하게 일정하다.
     *
     * 2.5 -> 9: 역할이 바뀌었다. 예전엔 "항상 이만큼 보인다"는 하한이었지만,
     * 지금은 strain에 비례하므로 이게 최대치다. 2.5로 두면 빨간 바를 갓 넘었을 때
     * 화면 진폭이 1px 미만이라 "넘었다"는 사실 자체가 안 보인다.
     *
     * 9 -> 13: 경계선을 넘은 뒤 0.5초의 팔 p2p가 1.27px라 챕터 1의 과녁 반경(팔 1.2px)보다
     * 거칠었다 — 벌은 이미 반경의 1/3인데 그걸 읽을 해상도가 없었다.
     * (stickman의 tanh 소프트 클램프 때문에 실제 봉우리는 이 값보다 작게 나온다:
     *  챕터 1 구도에서 9 -> 약 7.1px, 13 -> 약 8.9px. 영점 부근은 선형이라 위상 읽기는 그대로.)
     */
    minVisiblePx: k(13, 0, 30, 0.5, '최대 떨림 화면 진폭 (스태미나 0에서)', 'px'),
  },

  /** 스태미나 — 버티는 힘과 붕괴 */
  stamina: {
    max: k(100, 20, 300, 5, '최대 스태미나'),
    /**
     * 21 -> 38: 초보(STR0, 당김 0.72)가 만작을 7.7초나 버텼다. 실제 초보는 몇 초 못 버틴다.
     * 38이면 4.2초 — 떨림이 1.5초면 이미 못 쓸 만큼 커지므로 "빨리 당기고 빨리 놓아라"가 되고,
     * 붕괴가 실제 위협이 된다. GDD 2장 "만작 유지가 몇 초 안 된다".
     */
    drawDrain: k(38, 2, 120, 1, '만작 유지 중 소모 속도', '/s'),
    /** 덜 당기면 덜 힘들다 */
    drainByDraw: k(1.4, 0, 3, 0.05, '당김량에 따른 소모 가중'),
    regen: k(34, 5, 150, 1, '쏘고 나서 회복 속도', '/s'),
    regenDelay: k(0.35, 0, 2, 0.05, '회복 시작까지 딜레이', 's'),
    /** 붕괴 예고. 이 값 아래로 떨어지면 팔이 처지고 떨림이 급증한다.
     *  예고 없는 붕괴는 "게임이 나를 배신했다"가 된다 — feel-lens 자동 반려 사유. */
    /**
     * 빨간 바의 위치 (최대 스태미나 대비 비율).
     *
     * **이 위로는 완벽하게 안정하다** — 떨림 0, 난수 오차 0, 조준한 그대로 맞는다.
     * 아래로 내려간 만큼만 떨린다.
     *
     * 왜: 플레이어가 제대로 쐈는데 빗나가면 자기가 뭘 잘못했는지 알 수 없고 그냥 화가 난다.
     * 오차는 반드시 본인의 선택(오래 끌었다)의 결과여야 하고, 그 경계가 화면에 보여야 한다.
     * STAMINA를 올리면 최대치가 커지므로 안전 구간이 실제로 넓어진다 — 성장 체감 지점.
     */
    steadyZone: k(0.55, 0, 0.95, 0.01, '빨간 바 위치 (이 위로는 완벽히 안정)'),
    collapseWarnAt: k(18, 0, 60, 1, '붕괴 경고 시작 스태미나'),
    collapseWarnMinTime: k(0.5, 0.1, 2, 0.05, '최소 경고 시간 (이보다 짧으면 경고 불충분)', 's'),
    /**
     * warn 곡선 지수. 선형(1)이면 경고 진입 순간의 warn이 0에 가까워
     * warn_start는 떴는데 렌더가 그릴 게 없다. 1보다 작으면 진입 즉시 눈에 띈다.
     */
    warnCurve: k(0.6, 0.2, 3, 0.05, '경고 곡선 지수 (작을수록 진입 즉시 뚜렷)'),
  },

  /** 호흡정지 — 숨을 참아 잠깐 안정시키기 */
  steady: {
    /**
     * 0.28 -> 0.55: 호흡정지가 떨림을 4분의 1로 죽이면 "위상을 읽는다"는 실력이
     * 통째로 무의미해진다 — Shift를 누른 사람은 읽을 게 없고, 안 누른 사람은 이길 수가 없다.
     * 절반쯤 눌리는 게 맞다. 창이 넓어질 뿐 여전히 놓는 순간을 골라야 한다.
     */
    tremorMul: k(0.55, 0, 1, 0.01, '호흡정지 중 떨림 배수'),
    staminaDrain: k(2.6, 1, 8, 0.1, '호흡정지 중 스태미나 소모 배수'),
    /**
     * 호흡정지 중 보이는 사선(궤적 미리보기)의 비행시간. "숨참기가 지금 의미가 있어?"(형) —
     * 재정의했다: 숨을 참으면 세상이 고요해지고 **화살이 갈 길이 보인다.** 스태미나를
     * 태우는 대가로 확신을 사는 것이다. 미리보기는 지금 조준각(떨림 포함)의 정직한 적분이라
     * "쏘는 대로 맞는다" 계약과 한 몸이다.
     */
    previewTime: k(1.1, 0, 3, 0.05, '호흡정지 사선 미리보기 비행시간', 's'),
    /**
     * 사선 점 사이 간격 (월드 m). 예전엔 물리 스텝 수(5스텝)로 찍어서, 화살이 빠를수록
     * 점 사이 실제 거리가 넓어졌다(최대 초속에서 ~3~5m) — 가까운 과녁을 겨눌 땐 점이
     * 하나도 안 찍히거나 하나뿐이었다 (형: "가까이있을땐 점이 있는줄도 모르겠잖아").
     * 스텝이 아니라 **거리**로 찍어서 속도와 무관하게 촘촘함이 일정하다.
     */
    previewDotGap: k(0.5, 0.15, 2, 0.05, '사선 점 간격', 'm'),
    /** 너무 오래 참으면 오히려 더 떨린다 (실제 사격과 같음) */
    maxHold: k(2.8, 0.5, 8, 0.1, '호흡정지 한계 시간', 's'),
    overholdPenalty: k(2.1, 1, 5, 0.1, '한계 초과 시 떨림 배수'),
    rampIn: k(0.18, 0, 1, 0.01, '호흡정지 효과가 드는 시간', 's'),
  },

  /** 화살 비행 */
  arrow: {
    gravity: k(9.81, 0, 25, 0.1, '중력', 'm/s2'),
    mass: k(0.025, 0.005, 0.1, 0.001, '화살 질량', 'kg'),
    drag: k(0.0021, 0, 0.02, 0.0001, '공기 저항 계수'),
    /** 화살이 속도 방향으로 정렬되는 속도. 낮으면 흔들리며 날아간다. */
    alignRate: k(9, 1, 30, 0.5, '화살촉 정렬 속도', '/s'),
    maxFlightTime: k(8, 2, 30, 0.5, '최대 비행 시간 (넘으면 소멸)', 's'),
    /** 관통 과녁을 뚫을 때 잃는 속도 비율. 중심을 뚫을수록 두꺼운 곳을 지나 더 잃는다. */
    pierceSpeedLoss: k(0.5, 0, 0.95, 0.01, '관통 시 잃는 속도 비율 (중심 명중 기준)'),
  },

  /**
   * 화살 종류의 효과 (docs/HOOK.md ★1)
   *
   * 드래프트로 고른 화살 하나가 그 판 내내 적용된다. 여기 있는 숫자가 "판이 얼마나 달라지는가"를
   * 통째로 정한다 — 전부 비슷하면 3택이 장식이 된다 (HOOK 4장 검증 기준 1).
   *
   * 이름 규약: 접두어 없는 노브는 그 효과를 쓰는 화살 전부의 공통값이고, `heavy*`는
   * 무거운 살만의 값이다. 무거운 살이 관통과 같은 필드를 쓰면서 값이 달라야 하기 때문이다.
   * (params.ts의 flatKnobs()는 2단만 훑으므로 경로는 `arrowkind.pierceExtra`처럼 평평해야 한다.)
   *
   * 기준자: 과녁 반경은 판이 바뀌어도 0.4~0.9m, 연쇄 기둥의 세로 간격 1.4~2.4m,
   * 기둥 사이 가로 간격 6~8m. 폭발 반경·사슬 사거리는 이 셋을 보고 정했다.
   */
  arrowkind: {
    // ── 물리의 계수 ──────────────────────────────────────────────
    //
    // 살마다의 질량·단면적은 sim/arrowfx.ts의 BODY에 있다 (그건 그 살이 무엇인가지 노브가 아니다).
    // 여기 있는 건 **그 몸을 게임 값으로 바꾸는 환율**이다.
    // 형의 물음(2026-08-25) "현실성도 살리면서 적절히 게임적 허용으로"의 후반부가 전부 여기 있다.

    /**
     * 초속의 하한·상한. 실물 식은 v = 1/√m 인데 그대로 두면 아주 가벼운 살의 탄도가
     * 직선이 되어 **조준을 배울 것이 없어진다.** 이 게임의 학습 대상이 탄도라 거기에 빗장을 건다.
     * (게임적 허용 ② — sim/arrowfx.ts BODY 위의 주석)
     */
    /**
     * 활의 **가상질량** — 림과 시위 자신의 몫 (유엽전 질량 = 1 단위).
     *
     * 이게 0이면 총구 운동에너지가 모든 살에서 같아져 **무게가 피해에 아무 영향이 없다**
     * (실측: 유엽전 64 vs 애기살 65). 실물의 활은 화살만 미는 게 아니라 제 림도 같이 밀고,
     * 그 몫이 고정이라 무거운 살일수록 에너지를 더 가져간다 (효율 = m/(m+Mv)).
     * 0.75면 유엽전 대비 육량전 에너지 1.33배 · 애기살 0.74배 — 살들이 확실히 갈린다.
     */
    virtualMass: k(0.75, 0, 3, 0.05, '활의 가상질량 (림·시위의 몫)'),
    speedLo: k(0.62, 0.3, 1, 0.02, '살 초속 배수 하한'),
    speedHi: k(1.4, 1, 2.5, 0.05, '살 초속 배수 상한'),
    /**
     * 갑옷이 뚫리는 관통력 문턱 (단면밀도 × 속도, 유엽전 초속 기준 1.0).
     * **문턱이지 곡선이 아니다** — 플레이어는 "이건 뚫린다/안 뚫린다"를 알 수 있어야 한다
     * (게임적 허용 ①). 실측: 애기살 1.49 · 육량전 1.15 · 나머지 ~1.0.
     * 1.1이면 그 둘만 열린다. 착탄 속도비를 곱하므로 **너무 멀면 그 둘도 못 뚫는다.**
     */
    armorPen: k(1.1, 0.5, 3, 0.05, '갑옷이 뚫리는 관통력 문턱'),
    /**
     * 갑옷을 뚫었을 때 들어가는 피해의 배수. 갑옷이 삼킨 몫이다.
     * 0.55인 이유: 헤드샷은 즉사고 이건 그 대안이지 상위 호환이면 안 된다.
     * **머리를 노리면 한 발, 몸통을 노리면 두 발** — 조준이 여전히 이긴다.
     */
    armorDmgMul: k(0.55, 0.1, 1, 0.05, '갑옷 관통 시 피해 배수'),
    /** 관통력 1을 넘는 몫이 다중 관통 몇 개가 되는가 (애기살이 뚫는 이유). */
    penPerPierce: k(4, 0, 10, 0.5, '관통력 → 추가 관통 수'),
    /** 운동량 1을 넘는 몫이 다중 관통 몇 개가 되는가 (육량전이 뚫는 이유). */
    momPerPierce: k(2, 0, 10, 0.5, '운동량 → 추가 관통 수'),
    /**
     * 뚫을 때 잃는 속도 = 이 값 / 운동량. 무거운 살이 계속 나아가는 이유가 이 나눗셈이다.
     * 관통 과녁의 손실(arrow.pierceSpeedLoss = 0.5)보다 작아야 한다 — 저건 뚫으라고 만든
     * 과녁이고 이건 안 뚫리는 걸 뚫는 것이라, 손실이 크면 두 번째 과녁이 늘 화살 아래로 떨어진다.
     */
    pierceLossBase: k(0.18, 0, 1, 0.01, '관통 속도 손실 기준'),
    /**
     * 폭발 살: 명중 지점에서 이 반경 안의 과녁을 같이 친다.
     * 2.2m는 연쇄 기둥의 위아래 하나는 확실히 물고 기둥 사이(6~8m)는 절대 못 넘는 거리다.
     * 3m를 넘기면 조준이 의미를 잃고, 1.5m 아래면 아무것도 안 딸려온다.
     */
    burstRadius: k(2.2, 0, 6, 0.1, '폭발 살 반경', 'm'),
    /**
     * 산전(散箭) — 한 번의 당김에 동시에 나가는 살 수. 형: "샷건같은 3개 동시쏘는 화살."
     *
     * 재고는 **한 발**만 깎인다 (한 번 당겼으니까). 값은 다른 데서 치른다:
     * 굵고 가벼워서(BODY.scatter) 공기저항이 크고, 그래서 멀면 셋 다 못 간다.
     * 산탄총이 실제로 그런 물건이라 물리를 그대로 쓰면 성격이 저절로 나온다.
     */
    volleyCount: k(3, 1, 7, 1, '산전 동시 발사 수'),
    /** 부채 반각 (rad). 0.10 ≈ 5.7° — 10m에서 좌우 1m쯤 벌어진다. */
    volleySpread: k(0.1, 0, 0.6, 0.01, '산전 부채 반각', 'rad'),
    /**
     * 연주전(連珠箭) — 첫 발 뒤에 **이어서** 더 나가는 수. 형: "한번만 쏴도 빠르게
     * 조준방향대로 3발 연사하는것." 2면 도합 세 발이다.
     *
     * 방향이 같아서 가만한 과녁에는 셋이 겹쳐 꽂히고(단일 표적에 강하다),
     * 바람·이동 과녁에는 셋이 흩어진다. 산전과 정확히 반대의 성격이다.
     */
    rapidCount: k(2, 0, 5, 1, '연주전 추가 발사 수'),
    /** 이어 쏘는 간격 (s). 0.11 = 셋이 0.22초에 다 나간다 — '연사'로 읽히는 빠르기다. */
    rapidDelay: k(0.11, 0.03, 0.5, 0.01, '연주전 발사 간격', 's'),
    /**
     * 폭발이 **나를** 칠 때의 피해. 0이면 자해 없음.
     *
     * 형: "화전은 어딜 맞춰도 폭발해야해. 심지어 땅에맞아도 터져야한다고.
     *      내발앞에 떨어지면 나도 데미지 맞아야지."
     * 맞는 말이다. 터지는 살이 내 발밑에서만 안전하면 그건 폭발이 아니라 연출이다.
     * 적 화살 피해(enemy.arrowDamage)와 같은 크기로 둔다 — 같은 아픔이어야 무섭다.
     */
    burstSelfDamage: k(25, 0, 100, 5, '폭발 자해 피해', '점'),
    /**
     * 자해가 시작되는 거리 배수 (반경 × 이 값). 1보다 작게 두는 이유:
     * 반경 끝에 스치기만 해도 아프면 폭발 살을 아무도 안 쓴다. **발밑**이어야 벌이다.
     */
    burstSelfRange: k(0.62, 0, 1, 0.02, '자해 반경 비율'),
    /** 분열 살: 명중 후 갈라지는 자식 화살 수 */
    splitCount: k(2, 0, 4, 1, '분열 살 자식 수', '발'),
    /**
     * 자식이 진행 방향에서 벌어지는 각. ±로 대칭 배분.
     * 0.30rad(≈17°)면 3m 더 날아가 옆으로 0.9m 벌어진다 — 과녁 반경의 두 배쯤이라
     * 바로 옆이 아니라 한 칸 건너를 노리게 된다.
     */
    splitAngle: k(0.30, 0.05, 1.2, 0.01, '분열 살 벌어지는 각', 'rad'),
    splitSpeedKeep: k(0.70, 0.2, 1, 0.01, '분열 자식이 물려받는 속도 비율'),
    /**
     * 유도 살: 초당 최대 선회각.
     *
     * 0.30 → 2.6 (2026-08-24, 형의 결정): "유도탄이 유도탄답지 않게 너무 안 맞아.
     * 확실하게 맞게 하되 얻기는 어렵게 만들면 되잖아." — 계약("쏘는 대로 맞는다")을
     * 지키던 자물쇠를 **희소성으로 옮겼다**: 신전은 이제 보급 풀의 마지막 마디(4번째
     * 보스)에서만 나온다 (game/supply.ts). 무한히 쓰던 시절의 0.30은 역사로 남긴다.
     * 2.6rad/s면 발사 방향 원뿔 안의 과녁은 사실상 놓치지 않는다 — 그게 이 살의 값어치다.
     */
    homingTurn: k(2.6, 0, 6, 0.05, '유도 살 선회 속도', 'rad/s'),
    homingRange: k(22, 2, 40, 0.5, '유도 살 탐지 거리', 'm'),
    /** 발사 직후부터 휘면 조준이 아니라 클릭이 된다. 0.12초는 첫 3~6m다. */
    homingDelay: k(0.12, 0, 1, 0.01, '유도 시작까지의 지연', 's'),
    /** 진행 방향 기준 이 각 안의 과녁만 노린다. 지나친 과녁으로 돌아가면 궤적이 안 읽힌다. */
    homingCone: k(0.60, 0.1, 1.5, 0.05, '유도 대상 원뿔 반각', 'rad'),
    /** 사슬 살: 명중 후 다음 과녁으로 튀는 최대 횟수. 2 = 한 발이 최대 3개. */
    chainBounces: k(2, 0, 5, 1, '사슬 살 튀는 횟수', '번'),
    /**
     * 4.5m — **기둥 안에서만 튄다.**
     *
     * 7.0으로 두면 챕터 1의 과녁 간격(4~6m)까지 닿아 한 발이 판 전체를 지운다
     * (실측: 1-5~1-8이 3발 → 1발). 그러면 이건 조합이 아니라 '판 건너뛰기'다.
     * 4.5면 연쇄 기둥의 세로 간격(1.4~2.4m)과 가까이 붙은 짝만 물고 챕터 1에서는
     * 기본 살과 같아진다 — 값을 하는 자리가 분명해진다.
     */
    /**
     * 4.5 -> 7.5 (형: "명적 범위가 너무 짧다"): 4.5m는 연쇄 기둥의 세로 간격(1.4~2.4m)만
     * 덮고 기둥 사이 가로 간격(6~8m)에는 못 미쳤다 — 무더기 안에서만 튀는 반쪽 살이었다.
     * 7.5m면 이웃 기둥·흩어진 적 사이를 건너뛴다. 재고제(판당이 아니라 발당 소모)라
     * 세져도 희소성이 값을 지킨다.
     */
    chainRange: k(7.5, 1, 20, 0.5, '사슬 살 튀는 거리', 'm'),
    chainSpeedKeep: k(0.85, 0.2, 1, 0.01, '사슬로 튈 때 남는 속도 비율'),
    /** 무거운 살: 관통 개수는 관통 살과 같되 손실은 절반이다 ("관통력 2배"의 다른 얼굴). */
    /** 0.72. 낙차를 크게 잡아야 닿는다 — 그게 이 화살의 값이다. 0.6 아래면 뒤 챕터에서 사거리가 안 나온다. */
    /** 무거우면 같은 항력에 덜 밀린다. 바람 판(챕터 3)에서 이 하나가 성격이 된다. */
    /**
     * 이 화살이 만든 점수 전부에 곱한다 (폭발·연쇄로 딸려 죽은 과녁 포함).
     *
     * ★ **1로 내렸다. 이 자리는 비워두는 게 맞다.**
     * HOOK.md의 원안은 '점수 2배'였는데, 점수 배수는 판을 바꾸는 게 아니라
     * **모든 판을 똑같이 좋게** 만든다. 실측 (교차표, 봇 average · 40판 × 20회):
     *   2.0            → 무거운 살이 40/40 판에서 점수 1등  ✗ 지배 전략
     *   2.0 + 관통 제거 → 29/40 판 1등                      ✗ 여전히 지배 전략
     *   1.0            → 12/40 판 1등, 다섯 종류가 저마다 이기는 판이 생김  ✓ 통과
     * 배수가 1보다 크기만 하면 **아무 효과도 발휘될 수 없는 판**(과녁이 서로 먼 판)에서
     * 자동으로 1등이 된다. 40판 중 26판이 그런 판이라 크기 문제가 아니라 종류 문제다.
     * 무거운 살의 정체성은 이제 '가장 깊은 관통 + 바람에 안 밀림 + 느림'이다.
     */
    heavyScoreMul: k(1, 1, 4, 0.05, '무거운 살 점수 배수'),
    /** 육량전의 질량 배수 — 피해는 속도 비례인데(enemy.playerDamage) 무거운 살은 느리다.
     *  운동에너지는 질량에도 비례한다: 느린 대신 훨씬 아프다. */
    /**
     * 육량전이 **갑옷을 뚫고** 넣는 피해의 배수 (0이면 못 뚫는다).
     *
     * 0.55인 이유: 헤드샷은 즉사고, 이건 그 대안이지 상위 호환이 아니어야 한다.
     * 갑옷 적(archerHp 100)에 육량전 몸통샷 = 40 × 속도비 × 2.0(질량) × 0.55 ≈ 두 발.
     * **머리를 노리면 한 발, 몸통을 노리면 두 발.** 조준이 여전히 이긴다.
     */
  },

  /**
   * 활 종류의 성질 — docs/BOWS.md
   *
   * 모든 활은 **장점 하나 + 대가 하나**다. 대가 없는 활은 이전 활을 함정 선택지로 만든다.
   * 수치의 출처는 실물이다: 각궁의 예민함, 롱보우의 무게, 리커브의 안정기, 컴파운드의 렛오프.
   * 여기의 값은 game/bows.ts 가 BowMods 로 구워 판 경계에서 sim 에 넣는다 (A1).
   */
  bowkind: {
    // ── 각궁 (角弓 · 국궁) — 빠른 손 ──
    /**
     * 0.62 → 0.80 (2026-08-31, 형: "각궁이 너무 강하니까").
     *
     * 밸런스 시뮬이 이미 빨간불이었다: **각궁이 62판 중 38판(61%)에서 점수 1등** —
     * "나머지 활이 함정이 된다". 원인은 이 한 값이다. 당김이 38% 빨라지면 같은 시간에
     * 더 많이 쏘고, 그 이득은 **모든 판에서** 나온다. 반면 대가(gakTremor)는 빨간 바
     * 아래로 내려갔을 때만 나오므로, 안전 구간에서 쏘는 사람에게는 **대가가 0**이었다.
     * 이득이 무조건이고 대가가 조건부면 그건 선택지가 아니라 정답이다.
     */
    gakDrawTime: k(0.80, 0.3, 1, 0.01, '각궁 당김 시간 배수 (빠름)'),
    gakSpeed: k(1.05, 1, 1.3, 0.01, '각궁 초속 배수'),
    /** 대가. 짧고 효율이 높은 활은 예민하다 — 빨간 바 아래에서만 먹는 값이라 계약(안전 구간 0)은 그대로다. */
    /** 1.30 → 1.45. 집중(만작 뒤 게이지)이 생기면서 빨간 바 아래에 머무는 시간이
     *  실제로 생겼다 — 이제 이 대가가 조건부가 아니라 **매 발의 값**이다. */
    gakTremor: k(1.45, 1, 2, 0.05, '각궁 떨림 배수 (예민함)'),

    // ── 장궁 (잉글리시 롱보우) — 무거운 힘 ──
    longSpeed: k(1.15, 1, 1.4, 0.01, '장궁 초속 배수'),
    longWind: k(0.70, 0.3, 1, 0.05, '장궁 바람 영향 배수 (무거운 화살)'),
    longDrawTime: k(1.40, 1, 2.5, 0.05, '장궁 당김 시간 배수 (무거움)'),
    /** 대가의 축. STR이 낮으면 아프고 크면 사라진다 — 활과 몸의 성장이 여기서 곱해진다. */
    longMaxDraw: k(0.08, 0, 0.25, 0.01, '장궁 만작 한계 페널티'),

    // ── 리커브 (현대 양궁) — 안정기 ──
    recTremor: k(0.70, 0.4, 1, 0.05, '리커브 떨림 배수 (안정기)'),
    recScatter: k(0.70, 0.4, 1, 0.05, '리커브 릴리즈 산포 배수'),
    recSpeed: k(0.92, 0.7, 1, 0.01, '리커브 초속 배수 (표적용 세팅)'),

    // ── 컴파운드 (도르래활) — 렛오프 ──
    /**
     * 만작 유지 소모 배수. 실제 컴파운드는 만작에서 장력의 ~80%가 빠진다.
     * 이 게임의 싸움터가 만작과 빨간 바 사이라, 렛오프는 숫자 버프가 아니라 **시간을 사는 활**이다.
     */
    compHoldDrain: k(0.40, 0.1, 1, 0.05, '컴파운드 만작 유지 소모 배수 (렛오프)'),
    compDrawTime: k(1.50, 1, 2.5, 0.05, '컴파운드 당김 시간 배수 (도르래)'),

    /** 궁합 — 각궁×애기살(편전) · 장궁×육량전. 관통 예산 가산 (docs/BOWS.md 2장). */
    synergyPierce: k(1, 0, 3, 1, '궁합 관통 가산', '개'),
    /**
     * 숙련 1레벨당 대가 완화율. 숙련은 장점을 키우지 않고 **대가를 깎는다** —
     * 장점을 키우면 활 간 밸런스가 레벨과 함께 인플레된다. 3레벨 × 0.25 = 대가의 75%가 사라진다.
     */
    masteryEase: k(0.25, 0, 0.33, 0.01, '숙련 1레벨당 대가 완화율'),
  },

  /** 바람 (챕터 4~) */
  wind: {
    maxSpeed: k(6, 0, 25, 0.5, '최대 풍속', 'm/s'),
    gustFreq: k(0.22, 0, 2, 0.01, '돌풍 변화 주파수', 'Hz'),
    gustAmp: k(0.35, 0, 1, 0.01, '돌풍 변동 폭 (평균 대비)'),
    /** 바람은 화살에 힘을 주는 게 아니라 상대속도 항력으로 작용한다. 에너지 주입 금지 (sim-lens A1) */
    effect: k(1, 0, 3, 0.05, '바람 영향 배수'),
  },

  /**
   * 과녁의 거동 — 돌진·보급처럼 **과녁 자신이 하는 일**의 수치.
   * (배치와 크기는 저작 데이터라 game/stages.ts · game/endless.ts 의 것이다.)
   */
  target: {
    /**
     * 돌진 과녁이 궁수 쪽으로 오는 속도.
     *
     * 30m 밖에서 출발해 1.6m/s면 18초. 한 판이 30초~1분(C1)이니 **넉넉하지만 무한하지는 않다** —
     * 다른 과녁을 다 처리하고 나서 여유롭게 쏘면 늦는다. 그 판단이 이 메커닉의 전부다.
     */
    chargeSpeed: k(1.6, 0.2, 8, 0.1, '돌진 과녁 접근 속도', 'm/s'),
    /** 궁수에게서 이 거리 안에 들어오면 닿은 것으로 본다 (m). */
    chargeReach: k(2.5, 0.5, 8, 0.1, '돌진 과녁이 닿는 거리', 'm'),
    /**
     * 다가오며 위아래로 흔들리는 폭·주기. 첫 값 0.35m 는 돌진이 **떠다니는 과녁**이던 때의 것이다 — 사람이 된 뒤에도
     * 남아서 달리는 사람이 둥실둥실 떠왔다 (2026-09-20, 형: "너무 둥실둥실 떠오잖아. 진짜 뛰어오는듯하게").
     * 사람은 땅을 달린다. 남긴 0.05m 는 달릴 때 몸통이 오르내리는 만큼이다 (그림은 발을 땅에 박고 컷이 오르내린다).
     */
    chargeBob: k(0.05, 0, 2, 0.05, '돌진 과녁 상하 흔들림', 'm'),
    /** 유령 보스가 뜨는 폭 — 예전엔 chargeBob 을 같이 썼다. 유령은 떠야 하고 사람은 달려야 해서 나눴다 (주기는 같이 쓴다). */
    ghostBob: k(0.35, 0, 2, 0.05, '유령 보스 상하 흔들림', 'm'),
    chargeBobFreq: k(0.9, 0, 4, 0.05, '돌진 과녁 흔들림 주기', 'Hz'),

    // ── 보스 (docs/RUN.md 3장) ──
    /** 돌진보다 훨씬 느리다 — 위협은 속도가 아니라 "몇 발이나 필요한가"다. */
    bossSpeed: k(0.55, 0.1, 3, 0.05, '보스 접근 속도', 'm/s'),
    /** 600 → 300: 피해가 속도 비례(~45)가 되면서 몸통 7발 · 헤드 2발 크기로 재조정. */
    bossHp: k(300, 100, 2000, 50, '보스 기본 체력'),
    /**
     * 첫 보스(10판)의 체력 배수 (2026-09-10, 형: "초반을 많이 쉽게"). 300 → 225:
     * 근력 0의 몸통은 12 라 300 은 눈 두 발이 **필수**였다 (초보 봇 30%). 225 는 눈 한 발 + 몸통
     * 두 발(피해 바닥 15)로 눕는다. 헤드샷 한 방(200)에는 여전히 안 눕는다 (형: "즉사는 안 되고").
     */
    bossFirstHpMul: k(0.75, 0.3, 1, 0.05, '첫 보스 체력 배수'),
    // ── 보스의 약점 (2026-09-10, 형: "보스도 형편없고 약점 공략하는 맛도 없고") ──
    // 약점은 **열렸다 닫힌다.** 늘 열린 약점은 조준 연습이지 공략이 아니다.
    //   눈알귀신: 눈을 뜨고 감는다. 뜬 눈을 맞히면 멈춘다 — 그때 한 발 더 (연속 크리).
    //   갑주귀신: 투구가 눈을 덮는다. 판금에 막힌 몸통 두 발이면 비틀거리고 투구가 열린다.
    //   쌍눈귀신: 둘이 엇박으로 뜬다. 한쪽 눈을 맞히면 다른 쪽도 멈춘다.
    //   폭주귀신: 약점은 다리다. 낮게 쏘면 넘어지고, 넘어진 동안 눈이 드러난다.
    /** 눈알·쌍눈 — 눈을 뜨고 있는 시간. */
    bossEyeOpen: k(2.4, 0.5, 10, 0.1, '눈 뜬 시간', 's'),
    /** 눈알·쌍눈 — 감고 있는 시간. */
    bossEyeShut: k(1.1, 0.2, 10, 0.1, '눈 감은 시간', 's'),
    /** 눈꺼풀이 여닫히는 시간 — 렌더의 눈 높이가 이 동안 움직인다. */
    bossEyeBlend: k(0.22, 0.02, 1, 0.01, '눈꺼풀 여닫는 시간', 's'),
    /** Target.weak 가 이 위면 뜬 눈이다 — 그 아래 맞은 화살은 몸통샷. */
    bossEyeOpenAt: k(0.5, 0, 1, 0.05, '뜬 눈 문턱'),
    /** 눈알귀신 — 뜬 눈을 맞히면 멈추는 시간. 다음 발이 크리티컬이 되는 창이다. */
    bossStaggerEye: k(1.3, 0, 5, 0.1, '눈알귀신 멈춤', 's'),
    /** 쌍눈귀신 — 한쪽 눈을 맞히면 **다른 쪽**이 멈추는 시간. */
    bossStaggerTwin: k(1.0, 0, 5, 0.1, '쌍눈귀신 멈춤', 's'),
    /** 갑주귀신 — 판금이 받은 몸통 발수가 이만큼이면 비틀거린다. */
    bossGuardHits: k(2, 1, 6, 1, '갑주귀신 비틀거림까지 몸통 발수'),
    /** 갑주귀신 — 비틀거리며 투구가 열려 있는 시간. */
    bossStaggerGuard: k(1.8, 0, 5, 0.1, '갑주귀신 멈춤', 's'),
    /** 폭주귀신 — 몸통 중심에서 이 아래(반경 비율)가 다리. 여기 맞으면 넘어진다. */
    bossLegZone: k(0.45, 0, 1, 0.05, '폭주귀신 다리 구간'),
    /** 폭주귀신 — 넘어져 있는 시간. 빠른 놈이니 넘어지면 오래 눕는다. */
    bossStaggerTrip: k(2.2, 0, 6, 0.1, '폭주귀신 넘어짐', 's'),
    /** 넘어진 폭주귀신이 내려앉는 깊이 (반경 비율). 렌더도 같은 값을 본다. */
    bossTripSink: k(0.35, 0, 1, 0.05, '넘어짐 내려앉기'),
    /**
     * 눈 박자의 배수 (2026-09-10, 보스를 여덟으로 늘리며). 뜬 시간에 곱하고 감은 시간을 나눈다.
     * 거인(도깨비)은 느긋해서 오래 뜨고, 저승사자는 갓 밑이라 좀처럼 안 본다.
     */
    /**
     * **걷는 보스**의 발걸음 (2026-09-10, 형: "모든 보스가 왜 다 둥실둥실 떠다니냐 개빡치게").
     * 도깨비·구미호·장승·저승사자는 유령이 아니라 **땅을 밟는 것들**이다. 발이 땅에 붙고
     * 걸음마다 몸이 아주 조금 들린다 — 크게 들리면 그건 걷는 게 아니라 뛰는 것이다.
     */
    bossStepFreq: k(1.5, 0.2, 5, 0.1, '걷는 보스 발걸음', 'Hz'),
    bossStepRise: k(0.06, 0, 0.5, 0.01, '걸음마다 들리는 높이', 'm'),
    bossEyeGiantMul: k(1.6, 0.2, 4, 0.1, '도깨비 눈 박자 배수'),
    bossEyeShyMul: k(0.45, 0.2, 4, 0.05, '저승사자 눈 박자 배수'),
    /** 멈춘 보스의 눈 명중 피해 배수 — 공략의 상. 200 × 1.5 = 300. */
    bossStaggerCritMul: k(1.5, 1, 4, 0.1, '멈춘 보스 눈 피해 배수'),
    /** 머리 반경 (몸통 반경 비율). 작을수록 헤드샷이 실력이다. */
    bossHeadR: k(0.34, 0.1, 0.8, 0.01, '보스 머리 반경 비율'),
    /** 머리 중심이 몸통 중심에서 위로 떠 있는 거리 (몸통 반경 비율) */
    bossHeadUp: k(0.78, 0, 1.5, 0.01, '보스 머리 높이 비율'),
    /** 헤드샷 한 발이 깎는 체력. 몸통(playerDamage 100)의 두 배 — 머리만 노리면 절반의 화살. */
    bossCritDmg: k(200, 100, 600, 25, '헤드샷 피해'),
    /**
     * 폭발이 **체력을 가진 적**(보스·적 궁수)에게 넣는 피해. 갑옷을 무시한다.
     *
     * ★ 예전엔 폭발이 반경 안의 모든 것을 `alive = false` 로 **즉사**시켰다.
     *   그래서 (1) 갑옷이 폭발 앞에서 아무 뜻이 없었고 — 그건 맞는 방향이지만 —
     *   (2) **보스도 한 방에 죽었다.** 호위 옆에서 화전이 터지면 30판 귀신이 즉사했다.
     *   형: "폭발터지면 갑곳 상관 없이 데미지" — 즉사가 아니라 **데미지**다. 그게 맞다.
     *
     * 400 인 이유: 가장자리(falloff 최소 blastFloor=0.5)에서도 200 이라 적 궁수(100)는
     * 반경 안이면 여전히 확실히 죽는다 — 화약통 퍼즐이 예전과 똑같이 풀린다.
     * 보스(300~)는 안 죽고 크게 깎인다. 폭발이 정답이 아니라 한 수가 된다.
     */
    blastDamage: k(400, 50, 2000, 25, '폭발이 적에게 넣는 피해'),
    /** 폭발 감쇠의 바닥. 가장자리에서도 이 비율은 들어간다 (0.5 = 절반). */
    blastFloor: k(0.5, 0, 1, 0.05, '폭발 감쇠 바닥'),
    /**
     * 폭탄 과녁(TargetSpec.bomb)이 터질 때의 반경. 폭발 살(arrowkind.burstRadius 2.2)과
     * 같은 함수를 쓰지만 노브는 따로 둔다 — 살은 "무엇을 들었나"고 폭탄은 "판이 무엇을
     * 놓았나"라 서로 다른 저작자가 만지는 값이다 (형: "폭발하는 폭탄 같은 것도 넣어야지").
     */
    bombRadius: k(2.2, 0, 6, 0.1, '폭탄 과녁 반경', 'm'),
    /**
     * ── 보스의 공격 주기 (2026-09-11, 형: "보스가 자기들만의 공격이 있어야 하는데 그런것도 없고") ──
     *
     * 그동안 보스는 **걸어올 뿐**이었다. 위협이 "닿으면 죽는다" 하나라 판이 타이머였고,
     * 약점을 노리는 이유도 '멈추게 해서 시간을 번다'가 전부였다. 이제 여덟이 저마다 쏜다.
     *
     * 기준 주기는 잡몹(shootEvery 6s)보다 **짧지만**, 보스는 하나뿐이고 비틀거리면 그동안
     * 아예 못 쏜다 — 약점을 때리는 것이 곧 방어가 된다. 그게 이 숫자의 뜻이다.
     * 여덟의 개성(무엇을 몇 발)은 sim/target.ts bossAttack 표에 있다.
     */
    bossShootEvery: k(4.2, 1.5, 15, 0.1, '보스 공격 주기', 's'),
    /** 보스가 여러 발을 뿌릴 때 벌어지는 각. 신기전보다 넓다 — 피할 수 없어야 답이 방패다. */
    bossVolleySpread: k(0.075, 0, 0.4, 0.005, '보스 부채꼴 각', 'rad'),
  },

  /**
   * 적과 플레이어 체력 (docs/RUN.md 6장). 10판부터 과녁이 아니라 **적**이 나온다 —
   * "보스가 왕 과녁이라는 게 말이 안 돼. 몬스터거나 활 쏘는 엔피씨가 나를 공격하게"(형).
   */
  enemy: {
    /** 여정 시작 체력. 죽으면 여정 종료 — 완전 게임오버. 100 스케일 (형의 결정). */
    hpMax: k(100, 10, 999, 10, '플레이어 체력'),
    /**
     * 내 화살의 **기준 피해** — 착탄 속도가 dmgRefSpeed일 때의 값이다 (형의 결정:
     * "화살 속도가 빨라지면 그에 비례해서 데미지가 증가하게").
     *   실제 피해 = playerDamage × (착탄 속도 / dmgRefSpeed) × 살의 질량 배수(fx.dmgMul)
     * 만작 근거리 ≈ 70m/s → 47쯤 · 멀리 감속하면 30대 — 몸통으로는 두세 발이 필요하다.
     * 헤드샷은 다른 규칙이다: 적 궁수는 즉사, 보스는 bossCritDmg.
     */
    playerDamage: k(40, 10, 200, 5, '내 화살 기준 피해'),
    /**
     * 내 화살 피해의 **바닥** (2026-09-10, 형: "초반을 많이 쉽게"). 속도의 제곱이라 근력 0의
     * 만작(0.72)은 착탄 33m/s → 피해 12였다. 18판(사수 넷, 체력 30)은 몸통 셋씩 열두 발 —
     * 화살 열 발로는 다 맞혀도 못 깬다 (숙련 봇 0%). 15면 두 발이다. 근력 3쯤부터 제곱이 바닥을
     * 넘어서므로 성장은 그대로 보인다. 살의 질량 배수(fx.mass)는 바닥에도 곱한다.
     */
    playerDamageFloor: k(15, 0, 60, 1, '내 화살 피해 바닥'),
    /** 기준 피해가 나오는 착탄 속도. */
    dmgRefSpeed: k(60, 20, 120, 5, '기준 착탄 속도', 'm/s'),
    /** 적 궁수의 머리 위치(반경 비율 위)와 반경 비율 — 렌더 실루엣과 같은 자리다. */
    archerHeadUp: k(0.62, 0, 1.2, 0.02, '적 궁수 머리 높이 비율'),
    archerHeadR: k(0.3, 0.1, 0.8, 0.02, '적 궁수 머리 반경 비율'),
    /** 적 화살 한 발의 피해. 100/25 = 네 발을 버틴다. */
    arrowDamage: k(25, 5, 100, 5, '적 화살 피해'),
    /** 적 궁수의 발사 간격. 이 시간이 곧 "저놈을 먼저 잡을 시간"이다. */
    shootEvery: k(6, 2, 20, 0.5, '적 궁수 발사 간격', 's'),
    /** 시위를 당기는 예고 시간. 예고 없는 피해는 배신이다 (빨간 바와 같은 사상). */
    windup: k(1.4, 0.3, 4, 0.1, '적 궁수 당김 예고', 's'),
    /** 적 화살 초속. 느릴수록 날아오는 게 보인다 — 위협은 속도가 아니라 예고다. */
    /** 26 -> 36: 곡사 챕터의 전환 저격수(최대 115m)가 나를 맞힐 수 있는 최소 초속.
     * 26이면 사거리 69m — 먼 창의 적이 허공에 쏘는 시늉만 했다. 36이면 132m. */
    arrowSpeed: k(36, 10, 60, 1, '적 화살 초속', 'm/s'),
    /** 이 반경 안에 적 화살이 오면 맞은 것 (m). 궁수 몸통 크기다. */
    hitRadius: k(0.55, 0.2, 2, 0.05, '플레이어 피격 반경', 'm'),
    /**
     * 적 궁수의 조준 산포 (가우시안 σ, rad). "적은 날 쏘면 무조건 백발백중이야?"(형) — 아니다.
     * 0.045rad면 15m에서 σ≈0.68m: 절반쯤 빗나간다. 가까울수록 자연히 정확해진다 —
     * 그래서 돌진과 달리 적 궁수도 **거리가 줄면 위협이 커진다.**
     */
    aimScatter: k(0.045, 0, 0.2, 0.005, '적 궁수 조준 산포', 'rad'),
    /**
     * 화차(火車)의 신기전이 벌어지는 각 (rad). 부채꼴이라 **한 발은 피해도 옆이 온다** —
     * 방패로 막거나 **패링으로 한 번에 쳐내는** 것이 답이다 (2026-09-10).
     */
    volleySpread: k(0.055, 0, 0.4, 0.005, '신기전 부채꼴 각', 'rad'),
    /**
     * ── 보스의 공격 주기 (2026-09-11, 형: "보스가 자기들만의 공격이 있어야 하는데 그런것도 없고") ──
     *
     * 그동안 보스는 **걸어올 뿐**이었다. 위협이 "닿으면 죽는다" 하나라 판이 타이머였고,
     * 약점을 노리는 이유도 '멈추게 해서 시간을 번다'가 전부였다. 이제 여덟이 저마다 쏜다.
     *
     * 기준 주기는 잡몹(shootEvery 6s)보다 **짧지만**, 보스는 하나뿐이고 비틀거리면 그동안
     * 아예 못 쏜다 — 약점을 때리는 것이 곧 방어가 된다. 그게 이 숫자의 뜻이다.
     * 여덟의 개성(무엇을 몇 발)은 sim/target.ts bossAttack 표에 있다.
     */
    bossShootEvery: k(4.2, 1.5, 15, 0.1, '보스 공격 주기', 's'),
    /** 보스가 여러 발을 뿌릴 때 벌어지는 각. 신기전보다 넓다 — 피할 수 없어야 답이 방패다. */
    bossVolleySpread: k(0.075, 0, 0.4, 0.005, '보스 부채꼴 각', 'rad'),
    /** 화차가 한 번에 쏘는 발수. 셋이면 방패 하나로는 다 못 막는다 — 그게 이 적의 질문이다. */
    volleyShots: k(3, 1, 8, 1, '화차 신기전 발수'),
    /** 화차의 발사 주기 배수. 여러 발을 한꺼번에 쏘므로 자주 쏘면 그건 벌이다. */
    hwachaPeriodMul: k(2.2, 1, 6, 0.1, '화차 발사 주기 배수'),
    // ── 총통수·투석군 (2026-09-11, 형: "항상 새로움을 줄 수 있도록 다양한 적군들") ──
    /**
     * 총통수의 조준 산포 배수. 1 보다 **작으면 더 정확하다** — 총은 활보다 곧게 간다.
     * 대신 곧게 오므로 산 방패가 잘 듣는다. 정확함이 곧 벌이 아니라 **다른 질문**이 되게.
     */
    gunnerAim: k(0.55, 0.1, 2, 0.05, '총통수 조준 산포 배수'),
    /** 총통수 발사 주기 배수. 한 발씩이라 잦아도 된다. */
    gunnerPeriodMul: k(0.85, 0.4, 3, 0.05, '총통수 발사 주기 배수'),
    /** 투석군 발사 주기 배수. 높은 호라 느리게 오므로 자주 던지면 하늘이 돌로 덮인다. */
    slingerPeriodMul: k(1.35, 0.5, 4, 0.05, '투석군 발사 주기 배수'),
    /** 돌진 몬스터가 닿을 때 깎는 체력. */
    chargerDamage: k(20, 0, 100, 5, '돌진 접촉 피해'),
    /** 11판+ 전환 사수의 체력 — 몸통 두 발(가까우면 한 발)이면 눕는 크기. 31판+ ×1.5. */
    convertHp: k(70, 10, 300, 5, '전환 사수 체력'),
    /**
     * 사수 체력의 **도입 경사** (2026-09-02, 형의 여자친구가 11판에서 접었다).
     *
     * 11판의 사수는 convertHp × convertHpEase 에서 시작해 convertHpEaseStages 판에 걸쳐
     * 1.0 배로 올라온다. 왜 필요한가 — 실측(`npm run balance`, 실제 판):
     *   내 화살 피해 = 40 × (착탄 속도/60)² 라 **속도의 제곱**이다. 근력 0의 만작(0.72)은
     *   38m/s, 착탄 33m/s → 피해 12. 체력 70의 사수 하나에 **여섯 발**이다. 12판(사수 셋,
     *   화살 8)은 숙련 봇도 0% — 100% 명중으로 화살을 다 써도 사수가 선다.
     * 근력 8쯤(11판 도착 시 냥로 살 수 있는 만큼)이면 피해 25 → 세 발, 근력 14면 두 발.
     * 그러니 11판은 "성장을 안 한 사람이 처음 부딛히는 벽"이고, 그 벽이 첫 사수부터
     * 통째로 서 있으면 아무도 넘지 못한다. 경사는 벽을 없애는 게 아니라 **오르막으로**
     * 바꾼다 — 11판 사수(35)는 근력 0도 세 발, 근력 8이면 두 발, 만작이면 한 발에 눕는다.
     * 성장이 **눈에 보이는** 자리가 여기다.
     */
    /**
     * 2026-09-10 (형: "게임이 쉬운 것도 아니고 피로하다 — 초반을 많이 쉽게"): 0.5/10 → **0.25/30**.
     * 예전 표(BALANCE.md §8-4)는 "스탯 0은 13판부터 다시 벽 — 의도다"였다. 그 의도를 버린다.
     * 11판 사수 17 (근력 0도 **두 발**), 20판 33 (세 발), 41판에야 70. 근력을 올리면 한 발이다.
     */
    convertHpEase: k(0.25, 0.1, 1, 0.05, '11판 사수 체력 배수 (도입 경사 시작)'),
    convertHpEaseStages: k(30, 1, 60, 1, '경사가 1.0에 닿는 데 걸리는 판 수'),
    /**
     * 적 화살 피해의 도입 경사 — 사수 체력과 같은 꼴. 11판 12.5 (여덟 발을 버틴다) 에서
     * foeDmgEaseStages 판에 걸쳐 arrowDamage 로. 처음 활을 든 적 앞에서 네 발에 죽으면
     * "방패를 사라"를 배우기 전에 여정이 끝난다 (형: "초반을 많이 쉽게").
     */
    foeDmgEase: k(0.5, 0.1, 1, 0.05, '11판 적 화살 피해 배수 (도입 경사 시작)'),
    foeDmgEaseStages: k(20, 1, 60, 1, '적 화살 피해 경사가 1.0에 닿는 판 수'),
    /**
     * 금관(金冠) 사수 — 현상금 (2026-09-02, 형: "돈을 벌고 싶어지도록").
     * 창의 사수 중 하나가 금관을 쓰고 나온다. **머리를 맞혀 즉사시키면** 냥 현상금
     * (game/rewards.ts FEAT_BOUNTY). 몸통으로 눕히면 관이 떨어지고 현상금도 없다 —
     * 이 게임의 핵심 실력(헤드샷)에 값을 붙이는 자리다. 판마다 있으면 값이 없고, 없으면 잊힌다.
     */
    bountyChance: k(0.4, 0, 1, 0.05, '금관 사수가 서는 판의 비율'),
    bountyFrom: k(12, 11, 60, 1, '금관 사수가 처음 나오는 판'),
    /**
     * 과녁이 사람이 될 때의 반경 배수 (저작된 반경 대비).
     *
     * 예전엔 반경을 0.62m 로 **못박았다.** 그러면 stagekit 의 각크기 규칙(반경 = 각크기 ×
     * 거리)이 죽어서, 가까운 적은 쓸데없이 크고 먼 적은 점이 된다 — 5장(곡사, 55~115m)에서
     * 적이 5px 였고 그게 "너무 멀어서 안 보인다"의 정체였다.
     * 1보다 큰 이유: 사람 몸통은 과녁판보다 넓다. 그래도 헤드샷 판정(머리 반경)은 그대로다.
     */
    foeR: k(1.15, 0.5, 2, 0.05, '사람이 될 때 반경 배수'),
    /**
     * 사람 반경의 **하한** (m). 각크기 규칙이 아무리 작게 내려와도 여기서 멈춘다.
     *
     * 2026-08-31, 형: "가끔 창문이 너무 작아서 적이 거의 안보이는 경우 있는데 그렇게
     * 안되게 해. 최소 적군사람 머리랑 상체 나올만큼은 크게 만들어."
     *
     * 창은 사람 반경에서 나온다 (render/buildings.ts — 반높이 1.05r). 그래서 r이 작으면
     * **창도 사람도 같이 작아진다.** 프로브가 재보니 31~39판의 창 높이가 0.77~0.90m 였다 —
     * 사람 상반신이 들어갈 수 없는 크기다(9/40판, tools/probe-foe.ts).
     * 0.5m면 창 높이 1.05m — 머리와 가슴이 나온다. 사람은 사람보다 작을 수 없다.
     */
    foeMinR: k(0.8, 0.2, 1.2, 0.05, '사람 반경 하한', 'm'),
    /**
     * 사람 반경의 **상한** (2026-09-20, 형: "캐릭터와 적군 크기가 인간이라면 현실적 스케일별로 비슷해야하는데 제각각이야.
     * 어떤건 아이같고 어떤건 거인같아").
     *
     * 사람의 키는 반경에서 나온다 (발 = 중심 − r, 머리 = 중심 + 0.62r → 키 ≈ 1.92r). 예전엔 반경이 각크기 규칙
     * (멀수록 크게)을 그대로 따라서, 같은 화면에 키 0.96m 인 총통수와 3.06m 인 총통수가 섰다. 막대 인간일 때는
     * 티가 안 났는데 사람을 **그림**으로 바꾸자 아이와 거인이 됐다. 이제 0.8~0.95m → 키 1.54~1.82m 로 모은다 (주인공 1.77m).
     * 먼 판에서 적이 예전보다 작아진다 — 그건 100m 밖의 사람이 작은 것이라 맞는 일이고, 붉은 테와 체력 바가 자리를 말한다.
     */
    foeMaxR: k(0.95, 0.5, 2, 0.05, '사람 반경 상한', 'm'),
    /** 내 화살이 적 화살을 쳐내는 판정 반경. 일부러 노리면 되는 크기 — 우연히는 드물게. */
    deflectR: k(0.3, 0.05, 1, 0.05, '화살 맞불 반경', 'm'),
    /** 숨는 사수가 예고(windup)보다 이만큼 먼저 나온다 — 나오는 걸 보고 조준할 시간이다. */
    peekLead: k(0.8, 0, 3, 0.1, '숨는 사수 노출 선행', 's'),
    /** 쏜 뒤 이만큼 있다가 숨는다 — 반격의 창. 0이면 쏘자마자 사라져 얍삽해진다. */
    peekTail: k(0.9, 0, 3, 0.1, '숨는 사수 노출 여운', 's'),
    /** 적 궁수의 기본 체력. 내 화살 한 발(playerDamage)에 눕는 크기다. */
    archerHp: k(100, 50, 900, 50, '적 궁수 체력'),
    /**
     * 갑옷 내구도 (형의 반려 2026-08-31: "적 갑옷병은 갑옷도 무적이 아니게").
     *
     * 보통 살의 몸통샷은 체력에 안 닿지만 이 값을 깎는다. 다 깎으면 갑옷이 벗겨지고
     * 그 뒤로는 아무 살이나 통한다. 즉 갑옷은 **답이 아니라 비용**이 됐다:
     *   · 관통살(육량전·애기살)   — 벗기지 않고 곧장 뚫는다 (제일 싸다)
     *   · 헤드샷                   — 갑옷이 안 덮는 곳이다 (제일 세다, 대신 어렵다)
     *   · 폭발                     — 판금을 통째로 뜯는다 (범위, 대신 화전이 있어야 한다)
     *   · 보통 살 몸통             — 세 발쯤 두들기면 벗겨진다 (제일 비싸지만 **언제나 된다**)
     * 마지막 줄이 이번 변경의 핵심이다. 어떤 장전으로 들어와도 길이 하나는 남는다.
     *
     * 180 인 이유: 유엽전 몸통 한 발이 근거리에서 약 60 을 깎는다 → 세 발.
     * 헤드샷(즉사) 한 발보다 확실히 비싸야 조준이 이긴다.
     */
    armorHp: k(180, 20, 900, 10, '갑옷 내구도'),
    /** 보스 보급의 회복 카드가 채우는 기력 — 잃은 체력을 되찾는 유일한 길이다 (형의 주문). */
    healReward: k(40, 10, 100, 5, '보급 회복량'),
  },

  /**
   * 방어 — 판 도중에 냥로 사는 두 가지 (형: "게임플레이 도중에 방어벽이나 방어구 구매").
   *
   * 이 게임에는 그동안 **맞는 것에 대한 대답이 없었다.** 적 화살이 날아오면 할 수 있는 건
   * 셋뿐이었다 — 먼저 쏴 죽이거나, 맞불로 쳐내거나, 과녁 뒤에 서거나. 셋 다 판의 배치가
   * 허락해야 되는 것이라, 배치가 나쁜 판에서는 **선택지가 없었다.** 사는 것이 네 번째 답이다.
   *
   * 둘의 성격을 일부러 갈랐다. 하나는 지금 이 판, 하나는 여정 전체다:
   *   · 방패(防牌)   — 앞에 세운다. 판이 끝나면 사라진다. 싸다. **위기 한 번을 넘기는 물건**
   *   · 두정갑(頭釘甲) — 입는다. 여정 내내 따라온다. 비싸다. **체력의 예산을 늘리는 물건**
   * 값이 같으면 하나가 다른 하나의 열등한 사본이 된다. 지속이 값을 정한다.
   *
   * 파는 것은 냥뿐이다 (GDD 9장 — 결제·광고·에너지는 없다). 스탯과 같은 지갑을 쓰므로
   * "지금 방패를 살까, 힘을 올릴까"가 진짜 저울질이 된다.
   */
  defense: {
    /** 방패 값 (냥). 스탯 0→1(costBase 2)보다 조금 비싸다 — 판 하나의 값이다. */
    shieldCost: k(3, 0, 30, 1, '방패 값 (냥)'),
    /**
     * 화살 한 발 (2026-09-02, 형: "돈 쓸 곳을 좀 더 많이"). 판 도중에 살통에 한 발을 얹는다.
     * "화살이 다했다"로 끝나는 여정의 마지막 발이 이걸로 산 발이면, 그 여정은 냥가 살린 것이다.
     * 살수록 비싸진다(arrowCostStep) — 화살을 돈으로 무한히 바꾸면 조준이 값을 잃는다.
     * 판당 상한(arrowMaxPerStage)도 같은 이유다.
     */
    arrowCost: k(12, 0, 100, 1, '화살 한 발 값 (냥)'),
    arrowCostStep: k(12, 0, 100, 1, '한 판에서 살수록 오르는 값'),
    arrowMaxPerStage: k(3, 1, 10, 1, '한 판에 살 수 있는 화살 수'),
    /** 방패가 삼키는 적 화살 수. 4발 = 맨몸이면 죽는 수(체력 100 / 화살 25)다. */
    shieldHp: k(4, 1, 20, 1, '방패 내구 (적 화살 발수)'),
    /** 방패가 서는 자리 (궁수 앞 m). 파비스처럼 땅에 박아 세우고 그 뒤에서 쏜다. */
    shieldX: k(1.6, 0.8, 4, 0.1, '방패 위치 (궁수 앞)', 'm'),
    /**
     * 방패 윗변 높이 (m). **궁수의 몸을 통째로 덮어야 한다** — 피격 판정은 손(1.4m)을 중심으로
     * 반경 hitRadius(0.55) 라 위로 1.95m 까지다. 그보다 낮으면 화살이 어깨 위로 들어와
     * "세웠는데 그냥 맞는" 물건이 된다 (실제로 1.25m 로 잡았다가 테스트에서 잡혔다).
     * 그러면서도 내 화살은 나간다 — 널판 한가운데의 **사격구** 하나로 (render/scene.ts).
     */
    shieldTop: k(2, 0.4, 3, 0.05, '방패 높이', 'm'),
    /** 방패 반폭 (m). 판정은 이 반폭이 아니라 세로 평면이다 — 옆면 2D라 깊이가 없다. */
    shieldHalf: k(0.34, 0.1, 1.2, 0.02, '방패 반폭', 'm'),
    /** 두정갑 값 (냥). 방패의 두 배 — 여정 내내 따라오는 값이다. */
    armorCost: k(6, 0, 60, 1, '두정갑 값 (냥)'),
    /** 한 벌이 대신 받아주는 피해. 50 = 적 화살 두 발(arrowDamage 25). */
    armorPer: k(50, 10, 300, 5, '두정갑 한 벌의 방어량'),
    /** 겹쳐 입는 상한. 100 = 체력과 같은 크기 — 이 위로 가면 맞아도 되는 게임이 된다. */
    armorMax: k(100, 10, 400, 10, '두정갑 최대 방어량'),
    // ── 갑옷 세 벌 (2026-09-10, 형: "방어구는 고를 수도 더 강화시킬 수도 없잖아") — game/armor.ts ──
    /** 가죽갑 — 두정갑 대비 방어량·상한·값 배수. 처음부터 있다. */
    armorLightMul: k(0.6, 0.2, 1, 0.05, '가죽갑 크기 배수'),
    /** 찰갑 — 가장 두껍고 가장 비싸다. */
    armorHeavyMul: k(1.6, 1, 4, 0.1, '찰갑 크기 배수'),
    /** 장만하는 값 (냥, 한 번). 스탯 몇 레벨 값이어야 "샀다"가 된다. */
    armorUnlockMid: k(40, 0, 600, 5, '두정갑 장만 값'),
    armorUnlockHeavy: k(120, 0, 1200, 5, '찰갑 장만 값'),
    /** 담금질 1단당 방어량·상한 증가율. 세 단이면 +60% — 활채 세 단(+10.5% 초속)보다 눈에 크다. */
    armorForgePer: k(0.2, 0, 1, 0.05, '담금질 1단당 증가율'),
    armorForgeMax: k(3, 1, 9, 1, '담금질 최대 단'),
  },

  /**
   * 환도(環刀) 패링 — **날아오는 화살을 칼로 쳐서 되돌려보낸다** (2026-09-10 형의 요구).
   *
   * 형: "'환도패링' 기능을 넣어. 적의 공격을 반사하는 패링기능이야. (…) 패링 판정은 너무
   *      빡빡하게 하진 않게 해서."
   *
   * 왜 이 게임에 맞나: 이 게임에는 이미 **예고**가 있다 (적이 활을 당기는 windup 1.4초,
   * RUN.md "예고 없는 피해는 없다"). 예고를 읽는 사람에게 줄 답이 그동안 방패(사서 세우는 것)
   * 하나뿐이었다 — 돈으로 사는 답이지 **손으로 내는 답**이 아니었다. 패링이 그 자리를 채운다.
   *
   * 값을 치른다: 칼을 뽑으려면 활을 놓아야 하므로 **당기던 것이 풀린다.** 화살은 안 나간다
   * (C2 — 끊어도 손해가 없어야 한다). 그리고 다시 휘두르기까지 쉰다(cool).
   */
  parry: {
    /** 한 번 휘두르는 데 걸리는 시간 (s) — 발도 + 슬래시 + 납도의 합. */
    swing: k(0.42, 0.1, 1.5, 0.02, '패링 한 동작 시간', 's'),
    /**
     * ① 발도 (s) — 칼이 뽑혀 나와 준비 자세에서 멎기까지 (2026-09-10, 형: "준비자세, 발도,
     * 빠르게 휘두르기, 이런게 순식간에 지나가야해"). 짧아야 한다: 여기가 길면 굼떠 보인다.
     */
    ready: k(0.06, 0.02, 0.5, 0.01, '발도 시간', 's'),
    /**
     * ② 슬래시 (s) — 186° 를 지나는 시간. **이 두세 프레임이 이 기능의 전부다.**
     * 0.07초면 60Hz 에서 네 프레임이고, 각의 대부분은 첫 두 프레임에 지나간다 (2.5제곱 감속).
     */
    slash: k(0.08, 0.02, 0.4, 0.01, '슬래시 시간', 's'),
    /**
     * ③ **뻗은 채 멎는다** (s) — 팔로스루 (2026-09-10 feel-lens).
     *
     * 이게 없을 때 무엇이 잘못됐나: 판정 창(active 0.30초)의 **77%에 칼이 없었다.** 칼이
     * 실제로 각을 지나는 건 4프레임뿐이고 나머지 13프레임은 뽑는 중이거나 거두는 중이라,
     * "뒤아래로 뻗은 정지한 막대에 화살이 튕기는" 그림이 나왔다. 야구 스윙이 스윙으로 읽히는
     * 것도 다 휘두른 뒤 **뻗은 채 멎는 이 구간** 덕이다. 판정을 줄이는 대신 그림을 채운다.
     */
    hold: k(0.16, 0, 0.6, 0.01, '다 벤 뒤 뻗은 채 멎는 시간', 's'),
    /**
     * 그중 **날이 실제로 화살을 잡는** 앞부분 (s). 형: "너무 빡빡하게 하진 않게."
     * 0.30 이면 60Hz 로 18스텝이다 — 적 화살이 36m/s 라 그 사이 10.8m 를 지난다.
     * 즉 "날아오는 게 보이면 누른다"로 잡힌다. 프레임 단위 반응을 요구하지 않는다.
     */
    active: k(0.3, 0.05, 1, 0.02, '날이 잡는 시간', 's'),
    /** 휘두름이 끝난 뒤 쉬는 시간 (s). 이게 없으면 계속 누르고 있는 게 정답이 된다. */
    /**
     * 휘두름이 끝난 뒤 쉬는 시간 (s). 이게 없으면 계속 누르고 있는 게 정답이 된다.
     * 0.9 → 0.55 (2026-09-10 feel-lens): 화면에 **아무 표시가 없는 구간**이 0.90초(54프레임)나
     * 됐다. 적 화살 간격은 사수 다섯이어도 3.0초라 쿨을 줄여도 안 부딪힌다.
     */
    cool: k(0.55, 0, 5, 0.05, '패링 후 쉬는 시간', 's'),
    /**
     * 칼이 닿는 반경 (m). 궁수 손 기준.
     *
     * 2.4 → 1.8 (2026-09-10 feel-lens): 2.4 면 원이 **머리 위 2.0m · 등 뒤 1.5m** 까지 덮어
     * 칼끝이 닿을 수 있는 넓이의 3.3배였다. 형이 "빡빡하지 않게"라고 한 건 **시간**을 달라는
     * 말이지 칼이 안 닿은 데서 튀라는 말이 아니다 — 그건 "안 맞았는데 맞았다"가 된다.
     * 누를 수 있는 총 창은 0.433 → 0.400초로 거의 안 준다 (화살이 그만큼 빠르다).
     */
    reach: k(1.8, 0.5, 6, 0.1, '칼이 닿는 반경', 'm'),
    /** 칼이 도는 중심이 손보다 얼마나 앞인가 (m). 앞에서 오는 것을 친다. */
    ahead: k(0.9, 0, 3, 0.1, '환도 중심의 앞 거리', 'm'),
    /**
     * 되돌아가는 화살의 속도 배수. **1이 정답이다** — 포물선은 시간을 뒤집으면 왔던 길을
     * 그대로 되짚는다. 속도와 방향을 정확히 반대로 놓으면 화살은 **쏜 놈에게 정확히 돌아간다.**
     * 조준을 계산할 필요도, 누가 쐈는지 기억할 필요도 없다 — 물리가 이미 알고 있다.
     * 1보다 키우면 그만큼 쏜 놈을 넘어가 뒤에 떨어진다 (실측: 1.15면 18m 사수 위로 7m 를 넘었다).
     */
    speedMul: k(1, 0.5, 3, 0.05, '되돌린 화살 속도 배수'),
    /**
     * 되돌아가는 각에 얹는 들림 (rad). 위와 같은 이유로 **0이 정답이다** — 조금이라도 얹으면
     * 되짚기가 깨져 쏜 놈 위로 넘어간다. 노브로 남겨 두는 건 형이 손맛을 보고 싶을 때를 위해서다.
     */
    liftAngle: k(0, 0, 0.6, 0.01, '되돌린 화살 들림', 'rad'),
  },

  /** 명중 반응 — 손맛 레이어 */
  hit: {
    /**
     * 정중앙 판정 문턱 (명중도 0..1, 1이 정중심). **단일 출처다** —
     * 손맛(크리티컬 소리·슬로모·파티클, render/effects.ts)과 보상·해금(game/rewards.ts)이
     * 같은 값을 봐야 "정중앙!"이 터진 판과 정중앙으로 세어진 판이 일치한다.
     *
     * 0.90 -> 0.78: 명중도 = 1 - 중심거리/반경 이므로 0.90은 **과녁 넓이의 1%**다.
     * 실측(봇 average, 40판) 판당 0.086회 — 열두 판에 한 번이라 크리티컬 연출이 사실상
     * 존재하지 않았고, 해금 조건('정중앙 12회')은 120판을 돌려도 안 열렸다.
     *
     * 문턱별 실측 정중앙/판: 0.85 → 0.18 · **0.78 → 0.29** · 0.70 → 0.45 · 0.62 → 0.62
     * 0.78(넓이의 4.8%)이면 서너 판에 한 번. 여전히 잘 겨눠야 나오지만 '있는 일'이 된다.
     * ※ 봇은 정중앙을 노리지 않고 각오차만 얹어 쏘므로 이건 **하한**이다 — 안전 구간에서는
     *   릴리즈 오차가 정확히 0이라, 사람이 화면을 보고 겨누면 이보다 자주 나온다.
     */
    bullseyeAcc: k(0.78, 0.5, 0.99, 0.01, '정중앙 판정 문턱 (명중도)'),
    stopMs: k(42, 0, 120, 1, '명중 히트스톱', 'ms'),
    chainStopMs: k(24, 0, 80, 1, '연쇄 히트스톱', 'ms'),
    shakeAmp: k(4.2, 0, 20, 0.1, '카메라 흔들림 진폭', 'px'),
    shakeDecay: k(11, 2, 40, 0.5, '흔들림 감쇠 속도', '/s'),
    /** 다음 조준 시작 전에 흔들림이 완전히 멎어야 한다 (feel-lens) */
    shakeCutoff: k(0.25, 0.05, 1, 0.01, '흔들림 강제 종료 시간', 's'),
    trailFade: k(2.4, 0.3, 10, 0.1, '화살 궤적 잔상 유지 시간', 's'),
    /** 빗나간 화살의 궤적은 더 오래 남는다. 왜 빗나갔는지 읽어야 학습이 된다 (GDD 8장) */
    missTrailFade: k(4.5, 0.3, 15, 0.1, '빗나간 궤적 유지 시간', 's'),
  },

  /** 점수 — 링 명중도가 점수로 번역되는 곳 */
  score: {
    /** 정중앙 명중의 점수 배수. 가장자리는 항상 1배다. */
    ringMulMax: k(2, 1, 6, 0.05, '중심 명중 점수 배수'),
    /** 곡선 지수. 1이면 선형, >1이면 중심을 정말 맞혀야 배수가 붙는다. */
    ringCurve: k(1, 0.3, 4, 0.05, '링 배수 곡선 지수 (클수록 중심에 인색)'),
  },

  /** 연쇄 폭발 */
  chain: {
    comboMul: k(1.15, 1, 2, 0.01, '연쇄 1단계당 점수 배수'),
    fallSpeed: k(7.5, 1, 30, 0.5, '공중 과녁 낙하 초속', 'm/s'),
    hitRadius: k(0.42, 0.1, 2, 0.02, '낙하 중 연쇄 판정 반경', 'm'),
    /** 연쇄가 이어질수록 반음씩 올라간다 */
    pitchStep: k(1.0595, 1, 1.3, 0.0005, '연쇄 사운드 피치 배수'),
    maxParticles: k(240, 40, 1200, 10, '파티클 링버퍼 크기'),
  },

  /** 성장 스탯이 물리에 미치는 영향 */
  growth: {
    strToSpeed: k(0.028, 0, 0.15, 0.001, 'STR 1당 화살 속도 증가율'),
    strToDrawTime: k(0.017, 0, 0.1, 0.001, 'STR 1당 만작 시간 단축율'),
    /**
     * STR 1당 최대 당김 한계 증가. maxDrawBase 0.72에서 시작해 STR 14쯤에 진짜 만작(1.0)이 열린다.
     * 성장 중 가장 크게 체감되는 지점 — 어느 날 갑자기 "시위가 끝까지 당겨진다".
     */
    strToMaxDraw: k(0.02, 0, 0.1, 0.001, 'STR 1당 최대 당김 증가'),
    steadyToTremor: k(0.033, 0, 0.15, 0.001, 'STEADY 1당 떨림 감소율'),
    staminaToMax: k(0.045, 0, 0.2, 0.001, 'STAMINA 1당 최대치 증가율'),
    focusToSteady: k(0.026, 0, 0.15, 0.001, 'FOCUS 1당 호흡정지 효율 증가율'),
    /** GDD 4장 FOCUS의 두 번째 효과 "릴리즈 관용 창". 떨림이 아니라 난수 산포를 좁힌다. */
    /** 산포가 0이 되면서(releaseScatter) FOCUS의 두 번째 효과를 산포 감소 → 호흡 한계로 교체. */
    focusToHold: k(0.05, 0, 0.3, 0.005, 'FOCUS 1당 호흡정지 한계 시간 증가율'),
    /** 후반 완만화. 스탯 효과는 로그로 감쇠한다 (GDD 4장, balance-lens 검증 대상) */
    diminishAt: k(20, 5, 100, 1, '수확체감 시작 스탯 레벨'),
    diminishRate: k(0.6, 0.1, 1, 0.01, '수확체감 강도'),
  },

  /** 오프라인 축적 (GDD 5장) */
  offline: {
    arrowPerSec: k(1 / 90, 0.001, 0.2, 0.001, '화살 축적 속도', '/s'),
    arrowCap: k(40, 5, 200, 1, '화살 상한'),
    trainingPerSec: k(1 / 180, 0.001, 0.2, 0.001, '냥 축적 속도', '/s'),
    trainingCap: k(20, 5, 100, 1, '냥 상한'),
    requestPerSec: k(1 / 1500, 0.0001, 0.05, 0.0001, '의뢰 축적 속도', '/s'),
    requestCap: k(4, 1, 20, 1, '의뢰 상한'),
    /** 오프라인 축적을 끈 사람에게 주는 스테이지 보상 상향. balance-lens가 등가성을 검증한다. */
    optOutBonus: k(1.85, 1, 4, 0.05, '오프라인 OFF 시 보상 배수'),
    /**
     * 명상(冥想) — 비접속 중의 획득을 키우는 능력치 (2026-09-20, 형: "마영전 메디테이션 처럼 명상 스탯을 넣어서
     * 비접속중에 획득 속도 혹은 획득량 증가하게"). 한 단마다 **속도**와 **상한**이 같이 는다 — 속도만 늘면 상한에 먼저 닿아
     * 올린 보람이 없고, 상한만 늘면 짧게 자리를 비운 사람에게 아무 일도 안 일어난다. 값은 몸의 능력치와 같은 곡선이다.
     */
    meditateRate: k(0.1, 0, 1, 0.01, '명상 한 단의 축적 속도 증가'),
    meditateCap: k(0.12, 0, 1, 0.01, '명상 한 단의 상한 증가'),
    meditateMax: k(20, 1, 60, 1, '명상 최고 단'),
  },

  /**
   * 성장·경제 (GDD 4·5장)
   *
   * 여기 있는 값이 "몇 판 만에 진짜 만작(STR 14)에 닿는가"를 통째로 정한다.
   * 판 보상과 비용을 같은 화면에서 보게 하려고 한 그룹에 둔다 — 한쪽만 만지면 곡선이 무너진다.
   */
  progression: {
    /** 처음 켠 사람이 들고 시작하는 화살. 0이면 첫 탭에서 아무것도 못 쏜다 (C1). */
    startArrows: k(20, 0, 100, 1, '시작 화살', '발'),
    /**
     * 보유 화살이 바닥나도 판마다 반드시 주는 최소 발수.
     * 이게 0이면 "화살이 없어 아무것도 못 하는" 에너지 게이트가 된다 — GDD 9장이 금지한 구조다.
     * 화살은 잠금장치가 아니라 **여유분**이다: 넉넉하면 판을 온전히 쏘고, 바닥나면 빠듯하게 쏜다.
     */
    minArrows: k(3, 1, 10, 1, '보유 0에서도 주는 최소 화살', '발'),
    /**
     * 바닥 지급을 스테이지 요구에 붙들어 매는 값. 바닥 = max(minArrows, stage.arrows - spareCut).
     *
     * 왜 상수 3발로는 안 되는가: 3명중을 요구하는 1-9(한 발 명중률 ~30%)에서 3발만 받으면
     * 클리어율이 54%에서 3%로 무너진다. 쏘긴 쏘는데 수학적으로 이길 수가 없는 상태 —
     * GDD 9장이 금지한 에너지 게이트의 소프트 버전이다.
     * 2면 1-1/1-2는 3발, 1-3~1-8은 4발, 1-9/1-10은 5발이 되어 "빠듯하다"는 압력만 남는다.
     */
    spareCut: k(2, 0, 6, 1, '바닥에서 깎이는 여벌 화살', '발'),
    /** 비용식 cost(l) = costBase + costLin·l + floor(l²/costQuadDiv). 정수 레벨에서 엄격히 증가해야 한다. */
    costBase: k(2, 1, 20, 1, '레벨 0→1 비용 (냥)'),
    costLin: k(1, 0, 5, 0.5, '레벨당 선형 비용 증가'),
    costQuadDiv: k(6, 4, 100, 1, '제곱 비용 완화 나눗수 (클수록 후반이 싸다)'),
    /**
     * 3차 항 나눗수 (2026-09-02, 형: "10분 플레이하면 1000 모은단 말이야 — 너무 싼 거 아냐?").
     * 실측(tools/probe-economy.ts): 옛 비용식(제곱만, quadDiv 16)으로는 4스탯 14가 668이라 숙련자가
     * **5분**에 샀다. 초반은 그대로 싸야 한다(초보가 첫 여정에 근력 7~8) — 그래서 뒤만 가파르게,
     * 3차 항이 그 일을 한다. 14: 2+13+28+109 = 152 · 29: 1390. 0이면 끈다.
     */
    costCubeDiv: k(14, 0, 200, 1, '3차 비용 나눗수 (0 = 없음 · 클수록 후반이 싸다)'),
    /** 실패에도 0을 주지 않는다. "손해 본 판"이 있으면 아무 때나 못 끊는다 (C2). */
    trainClear: k(3, 0, 20, 1, '클리어 냥'),
    trainFail: k(1, 0, 20, 1, '실패 냥 (0이면 C2 위반)'),
    trainFirstClear: k(2, 0, 20, 1, '첫 클리어 추가 냥'),
    trainAccuracy: k(3, 0, 20, 1, '정확도 100%에서의 추가 냥'),
  },

  /**
   * 그림 — 성장이 눈에 보이는 폭 (GDD 8장)
   *
   * 스틱맨의 골격 비율·관절 위치는 캐릭터의 신원이라 render/stickman.ts에 남는다.
   * 여기 올라온 건 **"성장하면 화면이 얼마나 달라지는가"** 를 정하는 값들뿐이다.
   */
  render: {
    /** 팔다리 기준 굵기 (m). 이 하나가 스틱맨 전체의 무게감을 정한다. */
    lineBody: k(0.105, 0.02, 0.3, 0.005, '스틱맨 기준 선 굵기', 'm'),

    // ── 쓰러진 적 (2026-08-31, 형: "퍽하고 뜨거나 날아가거나 물리엔진 적용해서") ──
    //
    // 시체는 **판정에 아무 영향이 없다** — 그래서 sim이 아니라 렌더가 굴린다 (A1).
    // 그래도 손맛에 직결되므로 값은 여기 산다 (A2).
    /** 폭발이 시체를 바깥으로 미는 속도 (m/s). 중심에서 멀수록 약해진다. */
    blastPush: k(9, 0, 30, 0.5, '폭발이 시체를 미는 속도', 'm/s'),
    /** 화살의 운동량이 몸으로 옮겨가는 비율. 1이면 화살 속도 그대로 날아간다 — 만화가 된다. */
    corpsePush: k(0.06, 0, 0.5, 0.005, '화살→시체 운동량 전달률'),
    /** 맞는 순간 위로 뜨는 속도 (m/s). '퍽' 하는 그 한 순간의 전부다. */
    corpseLift: k(2.4, 0, 10, 0.1, '시체가 뜨는 속도', 'm/s'),
    /**
     * 세게 죽었을 때(머리·폭발) 밀림·뜸의 배수 (2026-09-10, 형: "때리면 아파하거나 날라가거나").
     * 몸통 한 발과 헤드샷의 시체가 같은 궤적이면 조준의 값이 눈에 안 온다.
     */
    corpseHardMul: k(2.4, 1, 6, 0.1, '세게 죽은 시체 밀림 배수'),
    /** 그래도 이보다 빨리는 안 난다 (m/s). 한 발에 화면 밖으로 날아가면 그건 물리가 아니다. */
    corpseMaxV: k(11, 1, 40, 0.5, '시체 최대 초속', 'm/s'),
    /** 땅에 부딪힐 때 남는 속도 비율. 0.2면 한 번 튀고 만다. */
    corpseBounce: k(0.22, 0, 0.9, 0.02, '시체 반발 계수'),
    /** 땅에 끌리는 마찰 (초당 감쇠율). 클수록 빨리 멎는다. */
    corpseDrag: k(3.2, 0, 12, 0.1, '시체 지면 마찰', '/s'),
    /** 가로 속도가 회전으로 바뀌는 비율 (rad/s per m/s). 날아가면 돈다. */
    corpseSpin: k(0.9, 0, 4, 0.05, '시체 회전 비율'),
    /**
     * 돌진하는 적의 **달리는 주기** (Hz — 한 초에 몇 걸음 주기). 2.4면 뜀박질로 읽힌다.
     * 1 아래로 내리면 걷는 것으로 보여 "달려온다"는 위협이 사라진다 (render/foe.ts).
     */
    rusherCadence: k(2.4, 0.4, 6, 0.1, '돌진 달리는 주기', 'Hz'),
    /**
     * 그림 척후의 **한 주기(두 걸음)가 가는 거리** (m). 컷은 시계가 아니라 **간 거리**로 넘긴다 — 그래야 디딘 발이
     * 땅에서 미끄러지지 않는다. 실제 달리기는 2.6m 쯤이지만 척후는 1.6m/s 로 온다: 그 값이면 초당 2컷의 슬로모션이 된다.
     * 1.3 은 잰걸음으로 읽히는 값이다 (초당 5컷).
     */
    rusherCycleM: k(1.3, 0.4, 4, 0.1, '척후 한 주기의 거리', 'm'),
    /** 멎은 뒤 몇 초를 그대로 누워 있는가. 그 뒤 이 시간에 걸쳐 사라진다. */
    /**
     * 땅에 닿은 뒤 팔다리가 중력에 지는 데 걸리는 시간 (s).
     *
     * 형: "시체가 무슨 빳빳하게 굳어가지고. 사람이 바리케이트냐?" — 이 값이 그 답이다.
     * 0이면 닿는 즉시 널브러져 만화가 되고, 1을 넘으면 죽고도 한참 버티는 것처럼 보인다.
     */
    corpseLimp: k(0.38, 0.05, 2, 0.02, '시체가 늘어지는 시간', 's'),
    corpseLinger: k(6, 0, 30, 0.5, '시체가 남는 시간', 's'),
    corpseFade: k(1.6, 0.2, 6, 0.1, '시체가 사라지는 시간', 's'),
    /**
     * 만작에서 **몸통만** 굵어지는 폭 — 등과 어깨가 뭉치는 것.
     *
     * 0.18 → 0.07 (2026-08-25, 형: "활 당길 때 대체 왜 캐릭터 몸 전체가 두꺼워지는 거고").
     * 예전엔 이 값이 팔·다리·활에까지 걸려 만작에서 온몸이 1.48배가 됐다.
     * 이제 몸통 한 곳에만, 그것도 눈에 겨우 걸릴 만큼만 붙는다 (render/stickman.ts).
     */
    lineFullGain: k(0.07, 0, 1, 0.01, '만작에서 몸통이 굵어지는 폭'),
    /** 진짜 만작(1.0)에서 몸통이 추가로 굵어지는 폭. 성장의 주 신호는 자세와 색이 진다. */
    lineTrueFullGain: k(0.1, 0, 1.5, 0.01, '진짜 만작 몸통 추가 굵기'),
    /** 이 당김부터 자세가 조여지기 시작한다. 초보(0.72)는 여기서 절반쯤만 완성된다. */
    poseBraceFrom: k(0.5, 0, 1, 0.01, '자세가 조여지기 시작하는 당김'),
    /** 이 당김 위부터 '진짜 만작' 보상 자세 */
    poseTrueFullAt: k(0.94, 0.5, 1, 0.01, '진짜 만작 자세 문턱'),
    /** 진짜 만작에서 활이 더 휘는 비율 */
    poseFullBowCurve: k(0.35, 0, 1, 0.01, '진짜 만작 활 휨 추가'),
    /** 만작에 닿는 순간의 섬광. 당김(고요) → 만작(떨림) 전환을 눈에 보이게 한다. */
    poseOnsetFlash: k(0.18, 0, 1, 0.01, '만작 진입 섬광 지속', 's'),

    // ── '한 발' 순간 (docs/MEGAHIT.md §2) — 판마다 한 번 보장되는 기대 ──
    /**
     * 시간이 늘어지는 배율. 0.35면 화살의 비행이 세 배 가까이 길어진다.
     * 더 낮추면 극적이지만 **다음 판까지의 대기**가 길어져 30초 세션을 갉아먹는다 (C1).
     */
    oneShotScale: k(0.4, 0.15, 1, 0.05, "'한 발' 시간 배율"),
    /** 들어가는 시간 (s). 짧아야 한다 — 순간을 놓치면 연출이 아니라 렉이다. */
    oneShotIn: k(0.08, 0.01, 1, 0.01, "'한 발' 진입", 's'),
    /** 나오는 시간 (s). 여운은 진입보다 길다. */
    oneShotOut: k(0.35, 0.02, 2, 0.01, "'한 발' 해제", 's'),
    /** 배경이 물러나는 정도 0..1. 과녁과 화살만 남기고 나머지를 어둠으로 덮는다. */
    oneShotDim: k(0.42, 0, 0.9, 0.02, "'한 발' 배경 물러남"),
    /**
     * '한 발'의 실시간 상한 (s). MEGAHIT.md §2 원안에 "최대 2초"라 적혀 있었는데 실제로는
     * 안 걸려 있었다 — 빗맞고 화면 밖까지 계속 나는 화살은 sim 비행시간이 최대 8초라
     * oneShotScale(0.4)에서 실제로는 20초까지 슬로모가 안 풀렸다 (형: "화살이 멀리
     * 날아가는 도중에도 계속 슬로우 잡힌다", 2026-08-26). 상한을 넘기면 그 발이 아직
     * 날고 있어도 강제로 정상 속도로 되돌린다.
     */
    oneShotMaxSec: k(2, 0.5, 5, 0.1, "'한 발' 실시간 상한", 's'),

    // ── 빨간 바 (HUD) ─────────────────────────────────────────────────
    //
    // 게이지 배치·굵기 같은 화면 좌표는 render/hud.ts에 남는다. 여기 올라온 건
    // **"경계선을 넘었다는 사실이 얼마나 오래·언제부터 보이는가"** 를 정하는 시간 값들뿐이다.
    /**
     * 경계선을 넘는 순간 게이지에서 터지는 섬광의 길이.
     * poseOnsetFlash(만작 진입)와 같은 성격 — 상태가 바뀐 '순간'만 눈에 박아준다.
     * 이 한 번을 놓치면 플레이어는 언제부터 떨리기 시작했는지 영영 모른다.
     */
    zoneCrossFlash: k(0.42, 0, 2, 0.02, '빨간 바 넘김 섬광 지속', 's'),
    /**
     * 안전 구간이 이만큼도 안 남으면 게이지의 안전(청록) 구간이 숨쉰다.
     * 숫자 카운트다운을 띄우면 과녁이 아니라 시계를 보게 된다 — 밝기로만 알린다 (GDD 7장 절제 원칙).
     *
     * hud.ts가 **그 순간의 실소모율**로 나눠 재므로 이 값은 진짜 '초'다.
     * (drawDrain 원값으로 재던 시절엔 스탯·호흡정지에 따라 0.39~1.58초로 4배 흔들렸다.)
     */
    safeLowSec: k(1, 0, 4, 0.1, '안전 잔량 숨쉬기 문턱', 's'),

    // ── 경계선을 넘은 뒤의 자세 (stickman) ────────────────────────────
    //
    // 세 신호의 문법을 가른다: 굵기 = 당김·성장 · **형태 = strain** · 색 = warn(붕괴 임박).
    // strain은 조준을 붙들던 잠금(앞팔 팔꿈치·시위팔 팔꿈치·고개 정렬·활 휨·등)만 헐겁게 하고
    // 색은 절대 건드리지 않는다. warn이 쓰는 골반·무릎과 관절이 겹치면
    // "떨리기 시작함"과 "곧 놓쳐버림"이 한 덩어리로 보여 두 단계가 사라진다.
    /**
     * 경계선 직후를 즉시 읽히게 하는 곡선 지수. **1보다 작다** — 떨림(tremor.growExp 1.4)과 반대다.
     * 떨림은 경계에서 0부터 자라느라 넘은 직후 1px도 안 움직인다.
     * 그 빈 구간을 자세가 메워야 "방금 선을 넘었다"가 화면에 존재한다.
     */
    poseStrainOnset: k(0.7, 0.3, 2, 0.05, '경계선 이후 자세 풀림 곡선'),
    /** 앞팔(활 든 팔) 팔꿈치의 잠금이 풀리는 양 (배수). warnArm의 1/5 — 이건 붕괴가 아니다 */
    poseStrainArm: k(0.42, 0, 2, 0.02, '앞팔 팔꿈치 잠금 풀림'),
    /** 시위팔 팔꿈치가 내려앉는 비율 */
    poseStrainElbow: k(0.3, 0, 1, 0.01, '시위팔 팔꿈치 내려앉음'),
    /** 고개의 활 쪽 정렬이 풀리는 비율 */
    poseStrainHead: k(0.5, 0, 1, 0.01, '고개 정렬 풀림'),
    /**
     * 활을 온전히 붙들지 못해 휨이 풀리는 비율.
     * 0.3은 과했다 — 지친 진짜 만작(휨 0.213)이 멀쩡한 초보(0.204)와 같아 보여
     * "만작 한계"라는 더 중요한 신호를 지웠다. 0.2면 0.243으로 분명히 위에 남는다.
     */
    poseStrainBow: k(0.2, 0, 1, 0.01, '활 휨 풀림'),
    /**
     * 등이 헐거워지는 양 (m). warnSpine(0.2)의 1/3 — 실루엣 전체가 한 번은 반응해야 한다.
     * fullArch(0.07)와 같은 크기라, 진짜 만작으로 젖혔던 등이 완전 소진에서 정확히 0으로 돌아온다.
     */
    poseStrainSpine: k(0.07, 0, 0.4, 0.005, '등이 헐거워지는 양', 'm'),

    // ── 맞은 장수 초상 (11-17 형: 「맞았을 때 모습」 1단계 = 그림 없이 코드로 · src/ui/hit-portrait.ts) ──
    // 열전 왼쪽 초상 판 · 겨루기 적장 액자와 얼굴 · 본편 합전 장수 초상이 같은 값을 쓴다.
    // 세기 s(0~1) = 잃은 체력 몫 ÷ hitPortraitBigLoss. 아래 Min~Max 사이를 s 로 고른다.
    hitPortraitMs: k(260, 120, 600, 10, '맞은 초상: 효과 길이 (작은 피해)', 'ms'),
    hitPortraitMsHard: k(320, 120, 800, 10, '맞은 초상: 효과 길이 (큰 피해)', 'ms'),
    hitPortraitBigLoss: k(0.12, 0.02, 0.5, 0.01, '맞은 초상: 이만큼(최대 체력 몫) 잃으면 가장 세게'),
    hitPortraitShakeMin: k(3, 0, 12, 0.5, '맞은 초상: 흔들림 폭 (작은 피해)', 'px'),
    hitPortraitShakeMax: k(7, 0, 20, 0.5, '맞은 초상: 흔들림 폭 (큰 피해)', 'px'),
    hitPortraitRedMin: k(0.22, 0, 1, 0.01, '맞은 초상: 붉은 번쩍임 짙기 (작은 피해)'),
    hitPortraitRedMax: k(0.42, 0, 1, 0.01, '맞은 초상: 붉은 번쩍임 짙기 (큰 피해)'),
    hitPortraitGrayMin: k(0.16, 0, 1, 0.01, '맞은 초상: 빛 빠짐(잿빛 막) 짙기 (작은 피해)'),
    hitPortraitGrayMax: k(0.34, 0, 1, 0.01, '맞은 초상: 빛 빠짐(잿빛 막) 짙기 (큰 피해)'),
    hitPortraitCrackMin: k(0.5, 0, 1, 0.01, '맞은 초상: 갈라진 금 짙기 (작은 피해)'),
    hitPortraitCrackMax: k(0.9, 0, 1, 0.01, '맞은 초상: 갈라진 금 짙기 (큰 피해)'),
    hitPortraitGapMs: k(90, 0, 400, 10, '맞은 초상: 이 안에 또 맞으면 처음부터 다시 틀지 않고 세기만 올린다 (연타에 깜빡이지 않게)', 'ms'),
    hitPortraitArtMs: k(420, 100, 1500, 10, '맞은 초상: 피격 그림(realm/hit)이 있으면 바꿔 보여 주는 시간', 'ms'),
    // 11-18 형: 「깨지는 연출은 필요 없지 않을까」 — 피격 그림이 실려 있을 때 금 짙기에 곱한다 (0 = 끔 · 그림이 없거나 덜 실렸으면 금은 예전 그대로)
    hitPortraitCrackWithArt: k(0, 0, 1, 0.05, '맞은 초상: 피격 그림이 있을 때 갈라진 금 짙기에 곱하는 몫 (0 = 금 없음)'),
    // 11-18 형: 「얼굴이 바깥에 나가 있는 그림은 얼굴이 안 보인다」 — 잘려 보이는 판에서 얼굴(ui/hit-focus.generated.ts)을 판의 어디에 둘지 (0~1)
    hitPortraitFaceX: k(0.5, 0.2, 0.8, 0.01, '맞은 초상: 가로가 잘리는 판에서 얼굴을 둘 가로 자리 (0 = 왼쪽 끝 · 0.5 = 가운데)'),
    hitPortraitFaceY: k(0.33, 0.1, 0.7, 0.01, '맞은 초상: 세로가 잘리는 판에서 얼굴을 둘 세로 자리 (0 = 위 끝 · 0.33 = 위에서 1/3)'),
    // 11-19 형: 「피격됐을 때 계속 이미지 같은 부분만 보이던데 x 위치 바뀌게 하는 거 아니었어?」 — 맞을 때마다 얼굴을 둘 자리를 FaceX/Y ± Spread 안에서
    // 맞은 횟수로 옮기고(첫 번은 가운데 · 그림 끝은 넘지 않는다), 그림이 Slide 만큼 비껴 선 데서 SlideMs 동안 밀려 들어와 선다 (object-position · 좁은 판 한 장)
    hitPortraitFaceSpreadX: k(0.2, 0, 0.3, 0.01, '맞은 초상: 맞을 때마다 얼굴 가로 자리를 옮기는 폭 (판 너비 몫 · 0 = 늘 같은 자리)'),
    hitPortraitFaceSpreadY: k(0.06, 0, 0.2, 0.01, '맞은 초상: 맞을 때마다 얼굴 세로 자리를 옮기는 폭 (판 높이 몫 · 폰 세로 넓은 판)'),
    hitPortraitSlide: k(0.12, 0, 0.3, 0.01, '맞은 초상: 피격 그림이 비껴 선 데서 밀려 들어오는 거리 (잘리는 축 판 길이 몫 · 0 = 안 움직임)'),
    hitPortraitSlideMs: k(200, 60, 500, 10, '맞은 초상: 피격 그림이 밀려 들어와 서는 시간', 'ms'),
    // 얼굴이 그림 끝에 붙은 그림(얼굴 자리 0.8 넘는 것이 많다)은 가로로 옮길 몫이 거의 없어 맞을 때마다 얼굴 둘레를 조금씩 다르게 당겨 본다 (첫 번은 1)
    hitPortraitZoom: k(0.22, 0, 0.4, 0.01, '맞은 초상: 맞을 때마다 피격 그림을 얼굴 자리를 축으로 더 당겨 보는 몫 (최대 · 0 = 안 당김)'),
  },

  /**
   * 릴리즈 팔로스루 — 시위손이 놓은 뒤 어떻게 움직이는가 (render/stickman.ts).
   * 순수하게 경과 시간의 함수라 프레임률과 무관하다 (release 시점만 기억한다).
   *
   * 2026-08-26 (형의 지적): "놓을 때 팔이 너무 스르륵 내려간다. 팅 하고 반동으로
   * 빠르게 후퇴했다가, 가변적인 속도로(처음 빠르게 점점 느리게) 내려와야 하지 않나."
   * 예전엔 반동(kick)과 하강(settle)을 같은 시계로 재서 반동이 채 끝나기도 전에
   * 하강이 절반 가까이 섞여 들어갔고, 하강 곡선도 smoothstep(느리게 시작→느리게 끝)이라
   * 반동 직후에도 거의 안 움직이는 것처럼 보였다. 이제 하강은 **반동이 끝난 뒤부터** 따로
   * 재고(kickT만큼 지연), ease-out(처음 빠르고 갈수록 느려짐)으로 감쇠하듯 내려온다.
   */
  release: {
    /** 반동으로 손이 뒤로 벌어지는 거리 (m). */
    kick: k(0.07, 0, 0.3, 0.005, '릴리즈 반동 거리', 'm'),
    /** 반동 한 사이클의 길이 (s). '팅' 하고 빠지는 순간이라 짧아야 한다. */
    kickT: k(0.16, 0.05, 0.6, 0.01, '릴리즈 반동 시간', 's'),
    /** 반동이 끝난 뒤 편한 자리(어깨 앞·아래)까지 내려오는 시간 (s). */
    settleT: k(0.5, 0.1, 1.5, 0.02, '팔 하강 시간', 's'),
    /**
     * 하강 곡선 지수. 1이면 등속, 클수록 초반이 빠르고 갈수록 급격히 느려진다
     * (ease-out: 1-(1-x)^n). "가변적인 속도로 내려야" — 형의 요청이 이 노브다.
     */
    settleEase: k(2.4, 1, 5, 0.1, '하강 감속 곡선 지수'),
    /** 편한 자리가 어깨에서 앞으로 나온 거리 (m). */
    restFwd: k(0.1, -0.2, 0.4, 0.01, '하강 후 손 위치 (앞)', 'm'),
    /** 편한 자리가 어깨에서 아래로 처진 거리 (m). */
    restDrop: k(0.16, 0, 0.5, 0.01, '하강 후 손 위치 (아래)', 'm'),
    /** 시위 잔떨림 진폭 (m). */
    vib: k(0.028, 0, 0.15, 0.002, '시위 잔떨림 진폭', 'm'),
    vibHz: k(16, 4, 40, 0.5, '시위 잔떨림 주파수', 'Hz'),
    vibDecay: k(0.22, 0.05, 1, 0.01, '시위 잔떨림 감쇠', 's'),
  },

  /**
   * 소리 (GDD 7장)
   *
   * 여기 있는 건 **믹서**다 — 무엇이 얼마나 크게, 언제 울리는가.
   * 음색 자체(필터 주파수·Q·부분음 길이)는 파형의 신원이라 audio/ 안에 남는다.
   * bow.ts의 노이즈 시드와 같은 이유다: 바꾸면 값이 세지는 게 아니라 다른 소리가 난다.
   */
  audio: {
    /** 처음 켰을 때 놀라면 안 된다. 공부 곁의 게임이다 (C3). */
    master: k(0.38, 0, 1, 0.01, '전체 음량'),
    /**
     * 동시 발음 상한. 연쇄가 한꺼번에 터져도 여기서 잘린다.
     *
     * 14 -> 18: 연쇄가 이제 유리(샘플) + 종(배음) 두 겹이라 한 알에 보이스를 둘 먹는다.
     * 14로는 깊은 연쇄에서 뒤쪽 알갱이가 통째로 밀려 "또로롱"이 중간에 끊겼다.
     * 배음은 보이스를 하나만 잡으므로(synth.bellTone) 이 값이 곧 동시에 울리는 '소리'의 수다.
     */
    maxVoices: k(18, 4, 48, 1, '동시 발음 수'),
    drawGain: k(0.16, 0, 0.6, 0.005, '당길 때 삐걱 음량'),
    /** 게인을 draw가 아니라 변화율에 싣는 기준 속도. 만작 0.375s면 평균 2.7/s쯤 나온다. */
    drawRefRate: k(2.4, 0.5, 8, 0.1, '삐걱이 최대가 되는 당김 속도', '/s'),
    /** 움직임이 멎어도 남는 장력 잔음 비율. 만작에서도 활은 휘어 있다. */
    drawHold: k(0.3, 0, 1, 0.01, '만작에서 남는 삐걱 비율'),
    /** 크면 만작이 보상처럼 들려 오래 끌게 된다. 작게. */
    fullGain: k(0.15, 0, 0.6, 0.005, '만작 "툭" 음량'),
    strainGain: k(0.07, 0, 0.4, 0.005, '만작 긴장음 음량'),
    /**
     * 이 떨림 진폭에서 긴장음이 최대.
     *
     * 0.055 -> 0.015: 떨림 재설계로 tremorAmp의 상한이 tremor.baseAmp(0.016)가 됐다.
     * 0.055로 두면 붕괴 직전에도 비율이 0.29, 제곱으로 눌러 음량이 8%라 긴장음이 통째로 안 들린다.
     * (실측 peak tremorAmp: STAT 0에서 0.0160 · 호흡정지 과유지에서 0.0185 rad)
     * 0.015면 붕괴 직전에 포화하고, 경계선을 갓 넘은 구간은 제곱 덕에 여전히 조용하다.
     */
    strainRef: k(0.015, 0.005, 0.2, 0.005, '긴장음이 최대가 되는 떨림', 'rad'),
    beatGain: k(0.14, 0, 0.5, 0.005, '붕괴 예고 심장박동 음량'),
    beatSlow: k(0.6, 0.1, 3, 0.05, '경고 진입 시 박 속도', 'Hz'),
    beatFast: k(1.2, 0.2, 5, 0.05, '붕괴 직전 박 속도', 'Hz'),
    /** warn_start 시점의 warn은 아직 작다. 첫 박이 안 들리면 예고가 아니다. */
    beatMinWarn: k(0.35, 0, 1, 0.01, '심장박동 최소 세기'),
    releaseGain: k(0.34, 0, 1, 0.01, '릴리즈 저역 "텅" 음량'),
    /**
     * 림이 브레이스를 치는 저역 몸통. **이게 없으면 활 소리에 가슴이 없다** —
     * 형이 "히마리 없다"고 한 것의 정체가 이 층의 부재였다.
     */
    releaseBodyGain: k(0.24, 0, 1, 0.01, '릴리즈 몸통(림) 음량'),
    /** 시위가 튕기는 크랙. 짧고 날카롭다 — "놓았다"의 순간을 여기가 찍는다. */
    releaseSnapGain: k(0.26, 0, 1, 0.01, '릴리즈 시위 "탁" 음량'),
    /** power가 음량에 미치는 폭. 초보 한계 0.72와 진짜 만작 1.0이 귀로 구분돼야 한다. */
    releasePowerFloor: k(0.34, 0, 1, 0.01, '최소 당김에서의 릴리즈 음량 비율'),
    swooshGain: k(0.26, 0, 0.5, 0.005, '화살 "쉭" 음량'),
    /**
     * 활터의 북 — 맞았음을 알리는 소리 (docs/MEGAHIT.md §8).
     * 명중음(hitGain 0.24)보다 조금 작다: 북은 **타격이 아니라 인정**이라 뒤에서 받쳐야 한다.
     * 앞에 나오면 화살이 박히는 소리를 덮는다.
     */
    drumGain: k(0.2, 0, 0.6, 0.005, '활터의 북 음량'),
    collapseGain: k(0.13, 0, 0.5, 0.005, '붕괴 음량'),
    hitGain: k(0.24, 0, 0.8, 0.005, '명중 음량'),
    chainGain: k(0.19, 0, 0.8, 0.005, '연쇄 음량'),
    missGain: k(0.055, 0, 0.4, 0.005, '빗나감 음량'),
    endGain: k(0.13, 0, 0.6, 0.005, '판 클리어 음량'),
    /**
     * 폭발 음량. 명중(0.24)보다 확실히 커야 한다 — 폭발은 사건이지 타격이 아니다.
     * 다만 연쇄가 뒤따라 오므로 너무 키우면 그걸 다 덮는다.
     */
    burstGain: k(0.3, 0, 0.8, 0.005, '폭발 음량'),
    /**
     * 클리어 한 소절(피치카토 샘플)의 음량. 합성 상승음(endGain)과 따로 두는 이유:
     * 연주된 소리는 원본 음량이 합성음과 전혀 달라서, 한 노브로 묶으면
     * 한쪽을 맞추는 순간 다른 쪽이 틀어진다.
     */
    clearGain: k(0.42, 0, 1, 0.01, '클리어 한 소절 음량'),
    /** 보급을 주운 소리. 명중보다 밝고 조금 크게 — 이건 자원을 벌었다는 신호다. */
    pickupGain: k(0.26, 0, 0.8, 0.005, '보급 획득 음량'),
    /** 돌진에게 화살을 빼앗긴 소리. 벌이 아니라 경고라 크지 않게. */
    escapeGain: k(0.2, 0, 0.8, 0.005, '돌진 접근 허용 음량'),
  },

  /** 입력 — 조준 장치 */
  input: {
    /** 마우스가 없는 사람도 화면을 가로지르는 데 1초 안쪽이어야 답답하지 않다. */
    keyAimSpeed: k(900, 100, 3000, 25, '방향키 조준 속도', 'px/s'),
    /**
     * 조준 원뿔 — 앞쪽으로만 쏜다. 커서가 궁수 뒤로 가면 조준각이 ±180° 근처로 뒤집혀
     * 릭 전체가 접히고 궁수가 "작아졌다 커졌다" 하는 것으로 보였다 (형의 버그 보고).
     * 과녁은 언제나 앞(+x)에 있으므로 뒤를 겨눌 이유가 없다 — 각을 원뿔 안에 가둔다.
     */
    aimUpMax: k(1.48, 0.5, 1.57, 0.01, '조준 상한각', 'rad'),
    aimDownMax: k(0.9, 0.1, 1.57, 0.01, '조준 하한각', 'rad'),
  },

  /** 시뮬레이션 코어 */
  sim: {
    hz: k(120, 30, 240, 30, '고정 스텝 주파수', 'Hz'),
    maxCatchUpSteps: k(8, 1, 30, 1, '한 프레임에 따라잡을 최대 스텝 수'),
  },

  /**
   * 밤의 암살판 (docs/realm/SNIPE.md §0 · src/night/) — 기와지붕 위의 자객이 등불 아래 형체를 쏜다.
   * 활의 손맛(당김·떨림·빨간 바·탄도)은 위의 bow·stamina·arrow 그대로다. 여기는 **밤의 규칙**만 있다.
   */
  night: {
    /** 지붕(궁수 발밑 0)에서 마당 땅까지의 높이. 높을수록 내려 쏘는 각이 가팔라진다. */
    roofHeight: k(4, 1, 10, 0.1, '지붕 높이 (마당까지)', 'm'),
    /**
     * 바깥에서 화살 수를 안 주면 이만큼 (형: "유한한 화살수"). 칠십팔국 임무도 이 수에 덤을 얹는다 (realm/plots.ts assassinArrows).
     * 2026-10-23 9 → 15 — 헤드리스로 판을 하나도 안 놓치고 풀어도 담장 밖 3~4 · 안뜰 5~8(모닥불 3 · 등불 1 포함) · 사랑채 4,
     * 모두 12~16발이 든다. 9발로는 셋째 판에 닿기 전에 살이 다했다 (형: "암살활쏘기는 아직도 깰 수 없게 만들어져 있나?").
     * 11-10 15 → 20 — 폰에서 화살이 모자랐다 (형: "화살 개수는 왼쪽 상단에 두던가, 좀 넉넉히 주던가").
     */
    arrows: k(20, 3, 30, 1, '기본 화살 수', '발'),
    /** 어둠 층을 그리는 해상도 (CSS px 당) — 부드러운 그라디언트뿐이라 낮아도 같다. 폰에서 화면 전체를 네 번 칠하던 것 (형 11-10: 구출이 엄청 느려짐) */
    darkScale: k(0.25, 0.1, 2, 0.05, '어둠 층 해상도 (CSS px 당 픽셀)'),
    /** 밤 판 그리기 상한 — 90·120Hz 폰에서 두 배로 그리지 않게 (시뮬은 누산기라 결정론 그대로) */
    maxFps: k(60, 20, 144, 1, '밤 판 그리기 상한', 'fps'),
    /** 밤 판 캔버스의 DPR 상한 — 11-12 2 → 3 (gfxsafe 그러데이션 고친 뒤 빨라져서 · 형: "애들이 너무 뿌얘") */
    dprCap: k(3, 1, 3, 0.25, '밤 판 캔버스 DPR 상한'),
    /** 화살 눈금(작은 별도 판)의 DPR 상한 — 기기 화소 그대로 또렷하게 */
    quiverDprCap: k(3, 1, 4, 0.25, '화살 눈금 판 DPR 상한'),
    /** 가벼운 그림으로 내리는 선 — 프레임 간격 가운데값이 이보다 길면 (폰이 버거우면 · 칠십팔국이 저사양·보통이면 처음부터) */
    lowFrameMs: k(24, 12, 60, 1, '가벼운 그림으로 내리는 프레임 간격', 'ms'),
    /** 가벼운 그림의 캔버스 DPR 상한 */
    lowDprCap: k(1.5, 1, 2, 0.25, '가벼운 그림의 DPR 상한'),
    /** 가벼운 그림이면 어둠·불빛 층 해상도를 이만큼 더 낮춘다 */
    lowDarkMul: k(0.6, 0.2, 1, 0.05, '가벼운 그림의 어둠 층 배수'),
    /** 명궁 특성 자객이 쏘면 더 받는 화살 (칠십팔국 암살 — SNIPE §0-1). */
    archerBonus: k(3, 0, 10, 1, '명궁 자객의 덤 화살', '발'),
    /** 자객의 몸 — 근력·정확·지구력·집중을 이 레벨 하나로. */
    stat: k(5, 0, 30, 1, '자객 스탯 레벨'),
    /** 빛의 반지름 — 이 안에 들어온 형체만 또렷하다. */
    lightTorch: k(4.5, 1, 12, 0.1, '횃불 빛 반지름', 'm'),
    lightLantern: k(3.2, 1, 10, 0.1, '등불 빛 반지름', 'm'),
    lightFire: k(6, 1, 14, 0.1, '모닥불 빛 반지름', 'm'),
    lightCandle: k(2.4, 0.5, 8, 0.1, '창호지 촛불 빛 반지름', 'm'),
    flickerAmp: k(0.12, 0, 0.5, 0.01, '불꽃 깜빡임 세기'),
    flickerFreq: k(6, 0.5, 20, 0.5, '불꽃 깜빡임 빠르기', 'Hz'),
    /** 소리 — 빗나간 살이 맞은 곳마다 발각 게이지(0~1)에 더하는 몫. 가까운 보초일수록 크게 듣는다. */
    noiseGround: k(0.1, 0, 1, 0.01, '흙에 꽂힌 살 소리'),
    noiseWall: k(0.16, 0, 1, 0.01, '담·기둥에 맞은 살 소리'),
    noiseTile: k(0.26, 0, 1, 0.01, '기와에 맞은 살 소리'),
    noisePaper: k(0.3, 0, 1, 0.01, '창호지 찢는 소리'),
    noiseLamp: k(0.08, 0, 1, 0.01, '등불 깨지는 소리'),
    /** 쓰러뜨린 소리 — 머리는 소리 없이 쓰러진다. 몸은 신음, 다리는 비명. */
    noiseGroan: k(0.12, 0, 1, 0.01, '몸통에 맞은 보초의 신음'),
    noiseScream: k(0.32, 0, 1, 0.01, '다리에 맞은 보초의 비명'),
    hearRange: k(14, 2, 40, 0.5, '보초가 소리를 듣는 거리', 'm'),
    hearFloor: k(0.4, 0, 1, 0.05, '멀어도 들리는 몫'),
    /** 시체 — 빛 안의 시체를 앞을 보는 보초가 보면 게이지가 초마다 오른다. */
    sightRange: k(11, 2, 30, 0.5, '보초의 눈길이 닿는 거리', 'm'),
    corpseLight: k(0.22, 0, 1, 0.01, '시체가 보이는 밝기 문턱'),
    corpseRate: k(0.55, 0, 3, 0.05, '시체를 본 보초의 게이지 상승', '/s'),
    noticeDelay: k(0.6, 0, 3, 0.05, '시체를 알아채기까지', 's'),
    alarmDecay: k(0.03, 0, 0.5, 0.01, '게이지가 가라앉는 빠르기', '/s'),
    alarmCarry: k(0.6, 0, 1, 0.05, '다음 판으로 남는 게이지 몫'),
    alarmTime: k(1.6, 0, 5, 0.1, '경보 북이 울리고 끝나기까지', 's'),
    moveTime: k(1.6, 0.2, 5, 0.1, '지붕을 타고 다음 판으로 넘어가는 시간', 's'),
    chiefRise: k(1.2, 0.2, 4, 0.1, '적장 그림자가 일어서는 시간', 's'),
    chiefPatience: k(7, 1, 30, 0.5, '적장이 촛불을 끄기 전 기다림', 's'),
    /**
     * 그림자가 선 뒤 빗나간 살 — 전에는 한 발만 빗나가도 바로 촛불을 끄고 달아났다
     * (형: "사랑채에서 촛불이 꺼져서 도망치는건 대체뭔데. 어떻게잡으라는겨"). 이제 남은 기다림을 이만큼 깎는다 — 촛불 게이지로 보인다.
     */
    chiefMissCut: k(2.5, 0, 10, 0.5, '그림자가 선 뒤 빗나간 살 하나가 깎는 기다림', 's'),
    /**
     * 꺼진 불 다시 붙이기 (형: "불꺼지면 경비들은 불키러 가야하는거 아님? … 불 붙이는 중 하면서 게이지바가 나오면") —
     * 불이 꺼지면 가장 가까운 보초가 걸어가 붙인다. 붙이는 동안엔 불만 보고(시체를 못 본다) 머리 위에 게이지가 뜬다.
     * 등불을 든 보초는 제자리에서 다시 붙인다. 창호지 뒤 촛불은 적장의 것이라 아무도 안 붙인다.
     */
    relightTime: k(3.5, 0.5, 15, 0.5, '꺼진 횃불·등불을 다시 붙이는 시간 (경비 보통)', 's'),
    relightFire: k(2, 1, 5, 0.1, '모닥불은 불씨를 살리느라 이 배수만큼 더 걸린다'),
    relightReach: k(18, 2, 40, 1, '이 거리 안의 보초만 꺼진 불을 보러 간다', 'm'),
    tendWalk: k(1.4, 0.5, 3, 0.05, '불 붙이러 가는 걸음 (순찰 걸음의 배수)'),
    /**
     * 모닥불은 살로 안 꺼진다 — 불 위 삼발이에 매단 **물동이**를 맞히면 쏟아져 꺼진다
     * (형 10-23: "모닥불을 활로 쏴서 불 끄는 게 말이 되나"). 불길에 든 살은 타 버리고 불똥 소리만 난다.
     * 보초가 우물에서 물을 길어 와 다시 붙이면 물동이도 다시 걸린다.
     */
    fireHits: k(1, 1, 8, 1, '모닥불 위 물동이가 깨지는 살 수', '발'),
    jarHeight: k(1.6, 0.8, 2.5, 0.05, '물동이 높이 (모닥불 밑동에서)', 'm'),
    jarRadius: k(0.2, 0.08, 0.4, 0.01, '물동이 맞는 반지름', 'm'),
    fireDim: k(0.4, 0, 0.9, 0.05, '모닥불 — 살이 다 차기 직전 빛이 주는 몫'),
    noiseFire: k(0.05, 0, 1, 0.01, '모닥불 불길에 든 살 소리 (불똥)'),
    /** 경비 단계 — 느슨(0) · 삼엄(2)일 때 보통(1)에 곱하는 몫. 사람·불 수는 night/layout.ts 표의 min */
    relightLoose: k(1.6, 1, 4, 0.1, '경비 느슨 — 다시 붙이는 시간 배수'),
    relightTight: k(0.6, 0.2, 1, 0.05, '경비 삼엄 — 다시 붙이는 시간 배수'),
    sightLoose: k(0.8, 0.3, 1, 0.05, '경비 느슨 — 눈길 거리 배수'),
    sightTight: k(1.25, 1, 2, 0.05, '경비 삼엄 — 눈길 거리 배수'),
    darkSuspect: k(0.12, 0, 0.5, 0.01, '경비 삼엄 — 불이 꺼지면 수상히 여겨 오르는 게이지'),
    jitter: k(0.8, 0, 3, 0.1, '시드로 흔드는 자리 폭', 'm'),
    patrolSpeed: k(0.9, 0.1, 3, 0.05, '순찰 걸음', 'm/s'),
    /** 형체의 판정 — 머리 원 · 몸통 · 다리 (m). 활터 적의 머리 판정과 같은 급이다. */
    headR: k(0.14, 0.05, 0.4, 0.01, '머리 판정 반지름', 'm'),
    /** 판정만 그림보다 이만큼 너그럽게 — 머리·몸·다리·등불·물동이 (형 10-23: "히트박스는 조금 너그럽게 주자") */
    hitSlop: k(0.05, 0, 0.2, 0.01, '판정 여유 (그림보다 이만큼 크게 맞는다)', 'm'),
    /** 살길 위의 불(사랑채 앞 횃불대): 살의 앞길이 창호지 네모에서 이만큼 안이면 「창호지로 가는 살」로 보고 지나간다 · 아니면 그 불을 끈다 (11-12) */
    passSlop: k(0.5, 0, 2, 0.05, '살길 위의 불을 지나가는 창호지 여유', 'm'),
    torsoR: k(0.19, 0.05, 0.5, 0.01, '몸통 판정 반지름', 'm'),
    legR: k(0.12, 0.05, 0.4, 0.01, '다리 판정 반지름', 'm'),
    /**
     * 당겨 쏘기 (2026-10-18, 형: "찍었을때 뒤로 당겼다가 놓게 하는건 어떤가? 기존에 활쏘기게임들은 어떻게 하는지 참고해서") —
     * 아무 데나 누르면 그 자리에 고리가 생기고, 뒤로 끈 만큼 당긴다. 겨눔은 끈 쪽의 반대. 고리 안으로 돌아와 놓으면 그만둔다.
     * 당김은 여전히 시간을 들여 차오른다(근력의 몫) — 끈 길이는 **그 상한**이다. 덜 끌고 놓으면 덜 당긴 살이다 (빨간 바 계약의 ③).
     * 화면 픽셀 단위는 원칙상 여기 안 들어오지만, 손가락이 끄는 거리는 손맛 노브라 둔다 (CSS px).
     */
    pullDead: k(22, 4, 80, 1, '당겨 쏘기 — 그만두는 고리 반지름 (CSS px)', 'px'),
    pullMax: k(150, 60, 400, 5, '당겨 쏘기 — 끝까지 당기는 거리 (CSS px)', 'px'),
    pullMaxShare: k(0.3, 0.1, 0.6, 0.01, '당겨 쏘기 — 끝까지의 거리는 화면 짧은 변의 이 몫을 넘지 않는다 (폰 가로)'),
    pullFullAt: k(0.96, 0.8, 1, 0.01, '당겨 쏘기 — 이만큼 끌면 끝까지로 친다 (끝에서 떨지 않게)'),
    keyTurn: k(1.2, 0.2, 4, 0.1, '방향키로 겨눔을 돌리는 빠르기', 'rad/s'),
    /** 밤에만 — 활터의 스태미나 소모는 그대로 두고, 밤의 당김 소모만 이만큼 (형: "스태미너 너무 빨리 줄어드는데 … 적당히 느리게") */
    staminaDrainMul: k(0.5, 0.1, 1, 0.05, '밤 — 당길 때 스태미나 소모 배수'),
    /**
     * 활의 단계 (형: "암살강화하면 활 속도나 파워나 이런거 강화되게 … 완만한 성장이 아니라 계단적 성장") —
     * 단궁 0 → 맥궁 1 → 각궁 2 → 신궁 3. 한 단계마다 아래 몫이 한꺼번에 붙는다. URL `bow=<n>`.
     */
    tierSpeed: k(0.14, 0, 0.5, 0.01, '활 한 단계마다 — 살 빠르기 가산 (배수)'),
    tierDraw: k(0.8, 0.4, 1, 0.01, '활 한 단계마다 — 만작까지의 시간 배수'),
    tierTremor: k(0.7, 0.3, 1, 0.01, '활 한 단계마다 — 떨림 배수'),
    tierMaxDraw: k(0.06, 0, 0.3, 0.01, '활 한 단계마다 — 만작 한계 가산'),
    tierStat: k(4, 0, 15, 1, '활 한 단계마다 — 자객 스탯 레벨 가산 (지구력·집중 포함)'),
    tierArrows: k(2, 0, 8, 1, '활 한 단계마다 — 덤 화살', '발'),
  },

  /**
   * 바다도적 막기 — 사건 카드 「바다 도적」의 「맞선다」를 직접 쏘는 판 (docs/realm/SNIPE.md §0-9 · src/pirate/).
   * 활터의 활·탄도·빨간 바를 그대로 쓰고, 물결·목책·궤짝만 이 판의 것이다. 화살은 끝이 없다.
   */
  pirate: {
    stat: k(5, 0, 30, 1, '바다도적: 궁수 스탯 레벨 (바탕)'),
    muBase: k(5, 0, 10, 1, '바다도적: 포구 장수 무예가 이것을 넘는 1마다 근력이 오른다'),
    muStat: k(1.5, 0, 6, 0.5, '바다도적: 무예 1마다 오르는 근력 레벨 (당김이 빨라진다)'),
    lives: k(3, 1, 8, 1, '바다도적: 목책 (목숨) 바탕'),
    watchLife: k(0.5, 0, 1, 0.05, '바다도적: 포구 경계가 이 위면 목책 +1'),
    palisadeX: k(3.4, 2.8, 8, 0.1, '바다도적: 목책 자리 (궁수에서)', 'm'),
    shoreX: k(13, 6, 20, 0.5, '바다도적: 물가 (여기부터 물)', 'm'),
    spawnX: k(21, 12, 30, 0.5, '바다도적: 도적이 물에서 나오는 자리', 'm'),
    boatX: k(19.5, 10, 30, 0.5, '바다도적: 배 위 궁수 자리', 'm'),
    boatDeck: k(0.7, 0, 2, 0.05, '바다도적: 배 갑판 높이', 'm'),
    count1: k(8, 1, 20, 1, '바다도적: 첫 물결 칼잡이 수'),
    count2: k(11, 1, 24, 1, '바다도적: 둘째 물결 칼잡이 수'),
    count3: k(14, 1, 30, 1, '바다도적: 셋째 물결 칼잡이 수'),
    sevCount: k(0.25, 0, 0.6, 0.05, '바다도적: 세기 한 단계마다 칼잡이 수 ± 몫'),
    gap: k(2.0, 0.6, 5, 0.1, '바다도적: 첫 물결 도적 사이 간격', 's'),
    gapMul: k(0.85, 0.5, 1, 0.05, '바다도적: 물결마다 간격 배수 (몰려온다)'),
    pairChance: k(0.25, 0, 1, 0.05, '바다도적: 둘이 한꺼번에 나올 확률'),
    pairGap: k(0.9, 0.3, 3, 0.1, '바다도적: 둘이 나올 때 앞뒤 거리', 'm'),
    speed: k(2.4, 0.8, 6, 0.1, '바다도적: 첫 물결 달리는 빠르기', 'm/s'),
    speedStep: k(0.3, 0, 1.5, 0.05, '바다도적: 물결마다 빨라지는 몫', 'm/s'),
    speedJitter: k(0.12, 0, 0.4, 0.01, '바다도적: 도적마다 빠르기 흔들림 (몫)'),
    archers2: k(2, 0, 5, 1, '바다도적: 둘째 물결 배 위 궁수 수'),
    archers3: k(2, 0, 5, 1, '바다도적: 셋째 물결 배 위 궁수 수'),
    archerEvery: k(4.5, 2, 12, 0.5, '바다도적: 배 궁수 발사 간격', 's'),
    archerDelay: k(3, 1, 10, 0.5, '바다도적: 배 궁수 첫 발까지', 's'),
    archerSpread: k(1.6, 0.5, 4, 0.1, '바다도적: 배 궁수끼리 거리', 'm'),
    archerStagger: k(1.2, 0, 4, 0.1, '바다도적: 배 궁수끼리 첫 발 어긋남', 's'),
    archerR: k(0.65, 0.4, 1, 0.05, '바다도적: 배 궁수 몸 반경', 'm'),
    archerUp: k(0.72, 0.4, 1.2, 0.02, '바다도적: 배 궁수 몸 중심 높이 (갑판에서)', 'm'),
    barrelBobHz: k(0.33, 0.05, 1.5, 0.01, '바다도적: 궤짝이 오르내리는 빠르기', 'Hz'),
    frameUp: k(3.2, 1, 8, 0.1, '바다도적: 화면이 늘 담는 하늘 높이 (배 위)', 'm'),
    captainAt: k(0.35, 0, 1, 0.05, '바다도적: 두목이 나오는 때 (셋째 물결 길이의 몫)'),
    captainHp: k(400, 100, 1500, 50, '바다도적: 두목 체력 (내 화살 몸통 한 발 40~100)'),
    captainSpeed: k(1.2, 0.4, 4, 0.1, '바다도적: 두목 걷는 빠르기', 'm/s'),
    captainR: k(1.05, 0.6, 1.6, 0.05, '바다도적: 두목 몸 반경', 'm'),
    captainBreak: k(2, 1, 5, 1, '바다도적: 두목이 목책에 닿으면 부수는 수'),
    barrels: k(2, 0, 5, 1, '바다도적: 물결마다 떠 오는 궤짝 수'),
    barrelSpeed: k(0.9, 0.2, 3, 0.1, '바다도적: 궤짝이 밀려오는 빠르기', 'm/s'),
    barrelLife: k(14, 4, 40, 1, '바다도적: 궤짝이 떠 있는 시간 (지나면 가라앉는다)', 's'),
    barrelR: k(0.55, 0.3, 1, 0.05, '바다도적: 궤짝 반경', 'm'),
    barrelY: k(0.45, 0, 1.5, 0.05, '바다도적: 궤짝 높이 (물 위)', 'm'),
    barrelBob: k(0.15, 0, 0.5, 0.01, '바다도적: 궤짝이 물결에 오르내리는 폭', 'm'),
    specialSec: k(10, 3, 30, 0.5, '바다도적: 궤짝 화살이 이어지는 시간', 's'),
    pause: k(2.5, 0.5, 6, 0.1, '바다도적: 물결 사이 쉬는 시간', 's'),
    startDelay: k(1.5, 0, 5, 0.1, '바다도적: 판이 서고 첫 도적까지', 's'),
    pickLife: k(1, 0, 3, 1, '막기 판: 「목책 고치기」 — 고치는 목책 수 (바탕 목책 수 +1 까지만)'),
    pickDrawMul: k(0.85, 0.5, 1, 0.01, '막기 판: 「당김 빨라짐」 — 만작 시간 배수 (겹치면 곱해진다)'),
    shield2: k(2, 0, 10, 1, '막기 판: 둘째 물결 방패 든 도적 수 (칼잡이 수처럼 세기로 흔들린다)'),
    shield3: k(4, 0, 12, 1, '막기 판: 셋째 물결 방패 든 도적 수'),
    shieldHits: k(2, 1, 5, 1, '막기 판: 방패 든 도적 — 몸통을 이만큼 맞으면 방패가 깨진다 (머리는 한 발)'),
    shieldSpeedMul: k(0.85, 0.4, 1.2, 0.05, '막기 판: 방패 든 도적 달리는 빠르기 배수 (칼잡이 기준)'),
    shieldR: k(0.7, 0.4, 1, 0.05, '막기 판: 방패 든 도적 몸 반경', 'm'),
    shieldTallM: k(1.9, 1.2, 3, 0.05, '막기 판: 방패 든 도적 그림 키', 'm'),
    ridgeX: k(2, 0, 6, 0.5, '산적 판: 능선 궁수 자리 (도적 나오는 곳에서 안쪽으로)', 'm'),
    midY: k(1.6, 0.8, 3, 0.1, '산적 판: 가운뎃길(비탈 턱) 높이 · 능선 궁수도 이 턱에 선다', 'm'),
    ridgeY: k(3.2, 1.8, 5, 0.1, '산적 판: 윗길(능선·망루 쪽 다리) 높이', 'm'),
    midDropX: k(9, 5, 16, 0.5, '산적 판: 가운뎃길이 땅으로 내려서기 시작하는 자리 (궁수에서)', 'm'),
    midDropLen: k(2.6, 0.5, 6, 0.1, '산적 판: 가운뎃길 비탈 길이 (이 거리 안에 땅으로)', 'm'),
    ridgeDropX: k(15, 8, 20, 0.5, '산적 판: 윗길이 가운뎃길로 내려서기 시작하는 자리', 'm'),
    ridgeDropLen: k(2.6, 0.5, 6, 0.1, '산적 판: 윗길 비탈 길이 (가운뎃길 높이까지)', 'm'),
    banditFrameUp: k(5.2, 3, 8, 0.1, '산적 판: 화면이 늘 담는 하늘 높이 (윗길 위 산적 머리까지)', 'm'),
    chiefLane: k(1, 0, 2, 1, '산적 판: 두목이 타는 길 (0 아랫길 · 1 가운뎃길 · 2 윗길)'),
    pickSec: k(20, 5, 60, 1, '막기 판: 물결 사이 고르기 — 이 시간이 지나야 저절로 첫째가 고른다 (띠가 남은 시간을 보여 준다)', 's'),
    dprCap: k(3, 1, 3, 0.25, '막기 판: 캔버스 DPR 상한 (마우스 화면)'),
    dprTouchCap: k(2, 1, 3, 0.25, '막기 판: 폰(손가락 화면) DPR 상한 — 2.6 그대로면 화소가 1.7배라 버벅이고, 버벅이면 1 까지 떨어져 흐려졌다 (11-16)'),
    dprFloor: k(1.5, 1, 3, 0.25, '막기 판: DPR 을 이 아래로는 안 내린다 (1 이면 폰에서 뿌옇다)'),
    dprSlowRuns: k(2, 1, 6, 1, '막기 판: 느린 묶음(60프레임)이 이만큼 잇달아야 DPR 을 내린다 (한 번 버벅인 것으로 흐려지지 않게)'),
    dprDropMs: k(24, 12, 60, 1, '막기 판: DPR 을 내리는 프레임 간격 가운데값 (그리기 상한 60 · 41fps 아래)', 'ms'),
    maxFps: k(60, 20, 144, 1, '막기 판: 그리기 상한 — 120Hz 폰에서 두 배로 그리지 않는다 (밤 판과 같다)', 'fps'),
    pullDead: k(8, 2, 40, 1, '막기 판: 그만두는 고리 반지름 (CSS px · 형 11-12: 물 쓸어내리는 조작감 — 눌러 조금만 끌어도 당겨진다)', 'px'),
    kickPx: k(5, 0, 20, 0.5, '막기 판: 쏘는 순간 화면이 뒤로 밀리는 폭 (CSS px)', 'px'),
    killStopMs: k(60, 0, 150, 5, '막기 판: 한 놈 쓰러뜨릴 때 멈칫하는 시간', 'ms'),
    // 체력창 깎임 토막 — 열전(HAEBI_RUN.hpChunk*)과 같은 롤 체력바: 막대는 단번에 떨어지고, 잃은 토막이 희게→노랗게→붉게 번쩍인 뒤 줄어든다 (11-17 형: 「체력창 제대로」)
    hpChunkFlash: k(0.24, 0.05, 1, 0.01, '막기 판: 잃은 체력 토막이 번쩍이는 시간 (목책 · 두목 체력창)', 's'),
    hpChunkHold: k(0.32, 0, 2, 0.01, '막기 판: 마지막으로 깎이고 토막이 줄기 시작할 때까지', 's'),
    hpChunkRate: k(4.5, 0.5, 20, 0.1, '막기 판: 토막이 줄어드는 빠르기 (초마다 이 배로 좁아진다)'),
    bossGoneSec: k(0.9, 0.2, 3, 0.1, '막기 판: 두목이 쓰러진 뒤 위쪽 두목 체력창이 남아 있는 시간', 's'),
  },

  /**
   * 장수 겨루기 시험판 2판 (duel.html · src/duel/sim.ts · docs/realm/council/1109-battle.md · 형 11-09):
   * "화면에는 적장 이미지가 크게 · QTE 로 적이 공격 들어올 위치에 큰 원이 그 터치 영역으로 모임 · 무예가 높으면 더 불특정하고 빠르게 ·
   *  전혀 못 맞추면 내 체력 · 적당하면 막아 냄 · 잘 막으면 적이 지쳐 내가 공격 (연타 3초 · 무예 따라 튕김 · 맞힐수록 덜 튕김) ·
   *  세키로 체간처럼 · 정확한 타이밍이면 엘든링 패링처럼 바로 치명공격".
   * 시간은 틱(초당 hz). 자리는 초상 위 0~1.
   */
  duel: {
    fighterAttackMs: k(420, 200, 800, 10, '겨루기 공격 자세 길이', 'ms'),
    fighterLungeMs: k(300, 100, 600, 10, '겨루기 전진 후 복귀 길이', 'ms'),
    fighterLunge: k(0.32, 0, 0.5, 0.01, '겨루기 공격 전진 거리 / 장수 간격'),
    fighterHitMs: k(240, 100, 500, 10, '겨루기 피격 후 비틀거림 복귀', 'ms'),
    fighterRecoil: k(0.09, 0, 0.2, 0.01, '겨루기 피격 밀림 / 장수 간격'),
    fighterJoltMs: k(14, 5, 40, 1, '겨루기 피격 떨림 박자', 'ms'),
    fighterGuardMs: k(220, 100, 500, 10, '겨루기 방어 충격 후 준비 자세', 'ms'),
    fighterBlockRecoil: k(0.035, 0, 0.1, 0.005, '겨루기 막을 때 밀림 / 장수 간격'),
    fighterStaggerMs: k(420, 200, 800, 20, '겨루기 발 붙인 비틀거림 자세 간격', 'ms'),
    fighterWindupMs: k(250, 100, 500, 10, '겨루기 공격 예비 자세 전환', 'ms'),
    fighterIdleMs: k(180, 100, 400, 10, '겨루기 대기 프레임 간격', 'ms'),
    hz: k(60, 30, 120, 1, '겨루기: 초당 틱'),
    fieldTop: k(0.7, 0.6, 0.85, 0.01, '겨루기: 아래 들판(두 장수가 싸우는 띠)이 시작하는 높이 (화면 높이 비율 · 낮출수록 장수가 위로 · 형 11-11: 군사에 가림)'),
    loopIntroMs: k(10000, 0, 15000, 100, '겨루기 적장 등장 컷 길이(ms) · 10초 감상 후 자동 전투 · 탭하면 건너뛰기 · 전투 시간은 흐르지 않음'),
    loopWaitMs: k(650, 0, 1500, 50, '겨루기 등장 영상이 준비되기를 기다리는 최대 시간(ms) · 넘으면 이번 등장은 그림으로 고정'),
    loopFadeMs: k(220, 50, 1000, 10, '겨루기 등장 컷: 암전으로 전투에 넘기는 시간(ms)'),
    fighterGapW: k(0.5, 0.2, 0.8, 0.02, '겨루기 아래 두 장수: 사이 (화면 폭 비율 · 형 11-11: 너무 붙어 있다)'),
    pxFill: k(0.5, 0.2, 2, 0.05, '겨루기 도트 장수: 칸 키(160)를 화면 짧은 변의 몇 배로 맞출지 (정수 배율로 반올림 · 0.5 면 폰 390 폭은 1배 · 데스크톱 768 높이는 2배)'),
    /** 겨루기 캔버스 DPR 상한 — 11-12 폰 1.5·데스크톱 2 → 3 (렌더 굽기로 빨라진 뒤 형: "애들이 너무 뿌얘 · 해상도 올려") · 버거우면 dprDropMs 로 0.5 씩 내린다 */
    dprCap: k(3, 1, 3, 0.25, '겨루기 캔버스 DPR 상한'),
    /** 프레임 간격 가운데값(60틀)이 이보다 길면 DPR 을 한 단 내린다 */
    dprDropMs: k(22, 12, 60, 1, '겨루기 DPR 내리는 프레임 간격', 'ms'),
    /** 11-22 폰 프레임 (열전 HAEBI_RUN.spriteBakeMax 와 같은 까닭): 겨루기 띠가 4600~5760px 라 폰 GPU 텍스처 한도를 넘는다 → 칸을 1:1 로 옮겨 여러 줄로 접는다 */
    stripFoldPx: k(4096, 1024, 16384, 256, '겨루기 장수 띠: 폭이 이보다 넓으면 여러 줄로 접어 굽는다 (폰 GPU 텍스처 한도)', 'px'),
    /** 처음 쓰는 글자(피해 숫자·초·연타·안내)를 싸움 밖에서 한 틀에 몇 개씩 미리 굽는가 — 한꺼번에 구우면 그 한 틀이 길어진다 */
    warmPerFrame: k(3, 1, 20, 1, '겨루기: 글자 미리 굽기 (한 틀에 몇 개)'),
    warmImageTries: k(120, 1, 600, 1, '겨루기: 아직 안 온 그림(피격 그림 등)을 미리 올리려고 다시 보는 횟수 (미리 굽기 줄을 한 바퀴 돌 때마다 한 번)'),
    endGlowRes: k(0.25, 0.1, 1, 0.05, '겨루기 끝 빛: 둥근 빛을 이 몫 크기로 구워 늘린다 (고른 빛이라 늘려도 같다 · 1 이면 제 크기)'),
    fighterLift: k(0.06, 0, 0.2, 0.01, '겨루기 아래 두 장수: 발을 화면 아래에서 띄우는 정도 (화면 높이 비율 · 형 11-11: 좀 더 위로)'),
    crowdBackH: k(0.09, 0.03, 0.3, 0.01, '겨루기 뒷줄 군사(카메라를 봄): 키 (화면 높이 비율)'),
    crowdBackAlpha: k(0.9, 0.3, 1, 0.05, '겨루기 뒷줄 군사: 짙기'),
    crowdBackFeet: k(0.012, -0.05, 0.1, 0.002, '겨루기 뒷줄 군사: 발이 들판 윗선보다 아래로 내려오는 정도 (화면 높이 비율 · 장수 머리 위에 서게)'),
    crowdFrontH: k(0.14, 0.05, 0.4, 0.01, '겨루기 앞줄 군사(등을 보임): 키 (화면 높이 비율)'),
    crowdFrontW: k(1.06, 1, 1.5, 0.02, '겨루기 앞줄 군사: 폭 (화면 폭 비율 · 조금 넘치게)'),
    crowdFrontDrop: k(0.6, 0, 0.9, 0.02, '겨루기 앞줄 군사: 화면 아래로 잠기는 정도 (군사 키 비율 · 클수록 머리만 보임 · 장수 발목 아래만 가리게)'),
    crowdRowRoom: k(1.2, 1.1, 1.6, 0.05, '겨루기 군사 줄: 줄 판 높이 (군사 키 배수 · 키 들쭉날쭉 여유)'),
    crowdScaleMin: k(0.9, 0.6, 1, 0.02, '겨루기 군사 줄: 군사 크기 최소 배수'),
    crowdScaleMax: k(1.1, 1, 1.4, 0.02, '겨루기 군사 줄: 군사 크기 최대 배수'),
    crowdStepMin: k(0.55, 0.3, 1, 0.05, '겨루기 군사 줄: 다음 군사까지 간격 최소 (군사 폭 비율 · 1 미만이면 살짝 겹침)'),
    crowdStepMax: k(0.8, 0.4, 1.2, 0.05, '겨루기 군사 줄: 다음 군사까지 간격 최대 (군사 폭 비율)'),
    crowdJitterY: k(0.08, 0, 0.3, 0.01, '겨루기 군사 줄: 군사마다 서 있는 높이 들쭉날쭉 (군사 키 비율)'),
    crowdBob: k(2, 0, 10, 0.5, '겨루기 앞줄 군사: 함성 들썩임 (px · 치명엔 두 배)'),
    length: k(2400, 600, 7200, 60, '겨루기: 한 판 길이 (틱 · 2400 = 40초 · 형 11-09: 60초는 길다)'),
    // 난이도 — 판의 세기(촌장 0 ~ 천손 6)에 따라 사이를 고르게 잇는다 (형 11-09: "난이도에 따라 바뀌어야 · 지금 너무 쉬움")
    tierLead0: k(1.1, 0.5, 1.6, 0.05, '겨루기 난이도: 촌장일 때 고리 시간 배수'),
    tierLead6: k(0.62, 0.3, 1.2, 0.02, '겨루기 난이도: 천손일 때 고리 시간 배수'),
    tierGood0: k(1.25, 0.5, 2, 0.05, '겨루기 난이도: 촌장일 때 막는 폭 배수'),
    tierGood6: k(0.6, 0.3, 1.2, 0.05, '겨루기 난이도: 천손일 때 막는 폭 배수'),
    tierPerfect0: k(1.5, 0.5, 3, 0.1, '겨루기 난이도: 촌장일 때 정확 폭 배수'),
    tierPerfect6: k(0.5, 0.3, 1.5, 0.1, '겨루기 난이도: 천손일 때 정확 폭 배수'),
    tierFoeHp0: k(0.85, 0.5, 2, 0.05, '겨루기 난이도: 촌장일 때 적장 체력 배수'),
    tierFoeHp6: k(1.8, 0.5, 3, 0.05, '겨루기 난이도: 천손일 때 적장 체력 배수'),
    tierHurt0: k(0.75, 0.3, 2, 0.05, '겨루기 난이도: 촌장일 때 우리가 맞는 아픔 배수'),
    tierHurt6: k(1.7, 0.5, 3, 0.05, '겨루기 난이도: 천손일 때 우리가 맞는 아픔 배수'),
    tierTire0: k(1.2, 0.3, 2, 0.05, '겨루기 난이도: 촌장일 때 적장이 지치는 몫 배수'),
    tierTire6: k(0.55, 0.2, 1.5, 0.05, '겨루기 난이도: 천손일 때 적장이 지치는 몫 배수'),
    tierDeflect0: k(-0.1, -0.5, 0.5, 0.01, '겨루기 난이도: 촌장일 때 연타를 튕겨 낼 몫 덤'),
    tierDeflect6: k(0.25, -0.5, 0.6, 0.01, '겨루기 난이도: 천손일 때 연타를 튕겨 낼 몫 덤'),
    drawBand: k(10, 0, 40, 1, '겨루기: 60초가 다 됐을 때 남은 체력 차가 이 안이면 비김'),
    riserPeak: k(2.04, 0, 5, 0.01, '겨루기: 형이 받은 riser 소리에서 가장 높은 음이 오는 때(초) · 고리가 닿는 순간에 맞춘다 (형 11-09)'),
    riserRateMin: k(0.8, 0.3, 1, 0.05, '겨루기: 고리가 느릴 때 riser 를 늦출 수 있는 끝 (빠르기 배수)'),
    riserRateMax: k(1.7, 1, 3, 0.05, '겨루기: 고리가 빠를 때 riser 를 당길 수 있는 끝 · 넘으면 앞을 건너뛴다'),
    riserVol: k(0.55, 0, 1, 0.05, '겨루기: riser 소리 크기'),
    riserTail: k(0.25, 0, 1, 0.05, '겨루기: 고리가 닿은 뒤 riser 가 잦아드는 시간(초) · 먼저 막으면 곧바로 끊긴다'),
    hp: k(100, 40, 200, 5, '겨루기: 체력 (둘 다)'),
    posture: k(100, 40, 200, 5, '겨루기: 적장 빈틈 — 차면 연타 기회가 열린다'),
    // 적장의 공격 — 고리가 모여드는 시간이 곧 읽을 틈
    lead: k(66, 24, 120, 1, '겨루기: 고리가 나타나 원에 닿기까지 (틱 · 무예 5)'),
    leadPerMu: k(0.06, 0, 0.12, 0.005, '겨루기: 적장 무예 1마다 고리가 빨라지는 몫'),
    gapMin: k(30, 6, 90, 1, '겨루기: 공격 사이 최소 (틱 · 무예 5)'),
    gapMax: k(64, 10, 150, 1, '겨루기: 공격 사이 최대 (틱 · 무예 5)'),
    gapPerMu: k(0.07, 0, 0.15, 0.005, '겨루기: 적장 무예 1마다 공격 사이가 줄어드는 몫'),
    spreadBase: k(0.18, 0, 0.6, 0.01, '겨루기: 무예 5 적장이 앞 원에서 튀는 거리 (화면 몫 · 화면 어디든)'),
    spreadPerMu: k(0.05, 0, 0.12, 0.005, '겨루기: 무예 1마다 더 멀리 튀는 몫 (더 불특정)'),
    comboMu: k(6, 1, 10, 1, '겨루기: 적장 무예가 이만큼이면 이어치기(고리 둘이 잇달아)를 섞는다'),
    comboChance: k(0.12, 0, 0.6, 0.01, '겨루기: 이 무예에서 이어치기 몫 (무예 1마다 더한다)'),
    comboGap: k(16, 6, 40, 1, '겨루기: 이어치기 두 고리 사이 (틱)'),
    heavyChance: k(0.2, 0, 0.6, 0.01, '겨루기: 붉은 큰 공격 몫 — 아프지만 정확히 받으면 치명공격이 더 크다'),
    heavyLead: k(1.25, 1, 2, 0.05, '겨루기: 붉은 큰 공격은 고리가 이만큼 느리다 (배수)'),
    // 우리 손 — 원 안을 고리가 닿는 순간에
    radius: k(0.075, 0.03, 0.2, 0.005, '겨루기: 터치 원 반지름 (화면 짧은 변 몫)'),
    touchSlop: k(1.5, 1, 3, 0.1, '겨루기: 원 반지름의 이 배수 안이면 그 원을 누른 것으로 친다 (손가락)'),
    good: k(10, 3, 24, 1, '겨루기: 고리가 닿는 순간 앞뒤 이만큼이면 막아 냄 (틱)'),
    perfect: k(2, 0, 10, 1, '겨루기: 이만큼 안이면 정확 (틱)'),
    late: k(3, 0, 10, 1, '겨루기: 막는 폭 뒤로 더 받아 주는 틈 (틱 · 손가락 늦음)'),
    goodPerMu: k(0.04, 0, 0.12, 0.005, '겨루기: 우리 장수 무예 1마다 막는 폭이 넓어지는 몫'),
    // 값
    hitDmg: k(12, 0, 50, 1, '겨루기: 못 막으면 우리 체력 −'),
    heavyDmg: k(24, 0, 60, 1, '겨루기: 붉은 큰 공격을 못 막으면 우리 체력 −'),
    hitPerMu: k(0.06, 0, 0.2, 0.01, '겨루기: 적장 무예 1마다 아픈 몫'),
    goodPosture: k(9, 0, 40, 1, '겨루기: 막아 내면 적장 빈틈 +'),
    perfectPosture: k(16, 0, 80, 1, '겨루기: 정확히 막으면 적장 빈틈 +'),
    postureMu: k(0.1, 0, 0.3, 0.01, '겨루기: 적장 무예 1마다 덜 지치는 몫'),
    postureRecover: k(0.03, 0, 1, 0.005, '겨루기: 적장 빈틈이 틱마다 줄어드는 몫'),
    critDmg: k(8, 0, 60, 1, '겨루기: 정확히 받으면 치명공격 — 적장 체력 −'),
    critHeavy: k(1.6, 1, 3, 0.1, '겨루기: 붉은 큰 공격을 정확히 받은 치명공격 배수'),
    critTicks: k(50, 10, 120, 1, '겨루기: 치명공격 연출 동안 (틱 · 그동안 새 공격 없음)'),
    // 공격 차례 — 체간이 가득 차면 연타
    rushTicks: k(180, 60, 360, 10, '겨루기: 적장이 지쳐 비틀거리는 동안 = 우리 연타 (틱 · 180 = 3초)'),
    tapGap: k(5, 1, 20, 1, '겨루기: 연타 사이 최소 (틱 · 그보다 빠르면 한 번으로)'),
    tapDmg: k(2, 0, 20, 1, '겨루기: 연타 한 번 맞으면 적장 체력 −'),
    deflectBase: k(0.45, 0, 1, 0.01, '겨루기: 무예 5 적장이 연타를 튕겨 낼 몫 (처음)'),
    deflectPerMu: k(0.09, 0, 0.2, 0.01, '겨루기: 적장 무예 1마다 더 튕겨 내는 몫'),
    deflectPerHit: k(0.05, 0, 0.2, 0.005, '겨루기: 한 번 맞힐 때마다 튕겨 낼 몫이 주는 만큼'),
    deflectMin: k(0.05, 0, 0.5, 0.01, '겨루기: 튕겨 낼 몫 바닥'),
    deflectMax: k(0.95, 0.5, 1, 0.01, '겨루기: 튕겨 낼 몫 천장'),
    pauseTicks: k(40, 0, 120, 1, '겨루기: 차례가 바뀔 때 숨 고르기 (틱)'),
    // 손맛
    hitStopPerfect: k(120, 0, 400, 10, '겨루기: 정확히 막을 때 멈춤', 'ms'),
    hitStopHit: k(90, 0, 300, 10, '겨루기: 맞을 때 멈춤', 'ms'),
    hitStopCrit: k(520, 0, 1200, 20, '겨루기: 치명공격 멈춤 (연출)', 'ms'),
    shake: k(12, 0, 30, 1, '겨루기: 화면 흔들림 — 우리가 맞을 때만 (형 11-11: 화면 전체 흔들림과 적장 액자 흔들림을 나눈다)', 'px'),
    barJolt: k(5, 0, 16, 1, '겨루기: 맞은 쪽 체력 막대만 떨리는 폭 (형 11-11)', 'px'),
    barJoltMs: k(260, 0, 800, 20, '겨루기: 체력 막대 떨림이 잦아드는 시간', 'ms'),
  },

  /**
   * 갈림길 2택 (docs/MEGAHIT.md §3 · game/forks.ts). 판이 끝나면 다음 판을 둘 중 고른다.
   *
   * 2026-08-31: 카드가 둘(바람골·밀집) 고정이던 것을 **여섯 장의 패**로 바꿨다
   * (형: "바람골 밀집 고르는거 너무 별로야. 진짜 개노잼이야"). 밀집은 버렸다 —
   * 있는 과녁을 복제하는 방식이 겹침·지면 관통을 구조적으로 못 막았다. game/forks.ts 머리말.
   */
  fork: {
    /** 바람골을 고르면 이 값 아래인 바람을 이 값까지 끌어올린다. "강해진다"가 체감돼야 한다. */
    windFloor: k(6, 2, 15, 0.5, '바람골 최저 바람', 'm/s'),
    /**
     * 바람골의 냥 배수. 클리어했을 때만 적용된다 — 실패하면 어려움만 남는다.
     *
     * 1.6 -> 1.15 (2026-08-26, balance-lens): 챕터1 실측으로 windFloor=6은 물론 30(5배)까지
     * 올려도 클리어율이 100%→100%(변화 0%p)였고 착탄 오차도 과녁 반경의 1% 미만이었다 —
     * 이 게임의 짧은 비행시간(0.3~0.6s)에서는 바람이 항력으로만 걸려 조준에 거의 안 잡힌다.
     * 그런데 냥는 확정 ×1.6 — "위험 없는 축에 보상만"이라 지배 전략이 됐다.
     * 1.15는 이 게임의 변동 보상 스케일에 맞춘 상한이다 (docs/BALANCE.md §7-1).
     */
    windTrainMul: k(1.15, 1, 3, 0.05, '바람골 냥 배수'),

    // ── 화약고 ──────────────────────────────────────────────────────
    /** 과녁 중 몇 할에 화약을 싣는가. 전부 실으면 한 발에 판이 지워져 조준이 사라진다. */
    bombShare: k(0.34, 0.05, 1, 0.02, '화약고 — 폭탄이 되는 비율'),
    /**
     * 화약고의 화살 여유. **정답 발수 + 이 값**만 준다 (game/forks.ts applyBomb).
     *
     * 이 한 값이 화약고를 '쉬워지는 카드'에서 '퍼즐'로 바꾼다. 0이면 정답 한 수만 허용돼
     * 실수 한 번에 판이 끝나고, 3이면 그냥 하나씩 쏴도 깨져서 폭탄이 장식이 된다.
     * 1은 "한 번은 빗나가도 된다" — 정답은 있되 벌은 가볍게 (docs/GAP.md 앵그리버드 항).
     */
    bombSlack: k(1, 0, 4, 1, '화약고 화살 여유', '발'),
    /** 통 자리를 찾는 격자 간격 (m). 촘촘할수록 좋은 자리를 찾지만 그만큼 오래 건린다. */
    bombStep: k(0.2, 0.05, 1, 0.05, '화약고 자리 탐색 격자', 'm'),
    bombYMin: k(0.6, 0.2, 3, 0.1, '통을 놓는 최저 높이', 'm'),
    bombYMax: k(9, 2, 20, 0.5, '통을 놓는 최고 높이', 'm'),
    /** 통과 과녁 사이에 최소한 이만큼은 떨어져야 한다 (반경 합에 더한다). */
    bombGap: k(0.3, 0, 2, 0.05, '통-과녁 최소 여유', 'm'),

    // ── 노다지 (보급 과녁 하나) ─────────────────────────────────────
    /** 맞히면 돌아오는 화살 수. */
    supplyGive: k(2, 1, 5, 1, '노다지 — 돌려주는 화살', '발'),
    supplyR: k(0.5, 0.2, 1.2, 0.05, '노다지 과녁 반경', 'm'),
    /** 판의 가장 바깥 과녁에서 이만큼 더 바깥에 선다. */
    supplyGap: k(2.6, 0.5, 8, 0.1, '노다지 — 판 바깥 거리', 'm'),
    supplyY: k(3.2, 0.5, 10, 0.1, '노다지 높이', 'm'),

    // ── 척후 (돌진 하나) ────────────────────────────────────────────
    /** 척후 반경 — 사람 크기다(호위병 0.6과 같다). 이 값이 곧 발이 닿는 높이이기도 하다. */
    scoutR: k(0.85, 0.2, 1.2, 0.05, '척후 반경', 'm'),
    /** 바깥에서 걸어 들어온다. 노다지보다 멀리 서야 '오는 것'으로 읽힌다. */
    scoutGap: k(5, 1, 14, 0.5, '척후 — 판 바깥 거리', 'm'),
    /** 척후의 냥 배수. 진짜 시간 압박이 붙으므로 바람골보다 높다. */
    scoutTrainMul: k(1.2, 1, 3, 0.05, '척후 냥 배수'),

    // ── 단발 ────────────────────────────────────────────────────────
    /** 원래 지급량의 몇 할만 준다. */
    singleKeep: k(0.6, 0.2, 1, 0.05, '단발 — 남기는 화살 비율'),
    /** 그래도 이 아래로는 안 준다. 과녁 수보다 적으면 클리어가 불가능해진다. */
    singleFloor: k(3, 1, 8, 1, '단발 — 최소 화살', '발'),
    /**
     * 단발의 냥 배수. 여섯 중 가장 크다 — 화살이 줄면 실중 한 번이 곧 실패이기 때문이다.
     *
     * ★ 이 값은 아직 **헤드리스 시뮬로 검증되지 않았다.** balance-sim 의 봇은 명중률이
     * 100%라 화살을 줄여도 클리어율이 안 흔들린다 — 바람골이 ×1.6에서 ×1.15로 깎였던
     * 그 함정과 같은 축이다 (위 windTrainMul 주석). 사람이 실제로 놓치는 비율을 재기
     * 전까지는 잠정값으로 둔다.
     */
    singleTrainMul: k(1.4, 1, 3, 0.05, '단발 냥 배수'),

    /** 새로 놓는 과녁이 지면에서 최소한 이만큼은 떠 있어야 한다 (반경 위에 더한다). */
    groundClear: k(0.35, 0, 2, 0.05, '새 과녁 지면 여유', 'm'),
  },

  /**
   * 실험장(sandbox) 전용 배치 상수. 기록에 안 남는 개발용 스폰 도구라 손맛과 무관하지만,
   * A2(매직넘버 금지)는 게임 레이어 전체에 적용되므로 여기 둔다 (game/loop.ts sandboxSpawn).
   */
  /**
   * 대장간 — 활 개조 (2026-09-02, 형: "돈 쓸 곳을 좀 더 많이 마련해봐야해. 돈을 벌고 싶어지도록").
   *
   * 스탯(몸)과 다른 축이다: **활마다** 따로, 영구, 세 부위. 활을 바꾸면 그 활의 개조가 따라온다 —
   * "내 각궁은 시위까지 다 갈았다"가 활을 고르는 이유 하나를 더 만든다. 부위별 최대 3단.
   * 값은 냥다. 단이 오를수록 비싸다(costBase + costStep × 단).
   *   시위(弦)  — 만작까지 빨리 닿는다 (drawTime 배수)
   *   활채(弓幹) — 초속이 오른다 → 피해는 속도의 제곱이라 체감이 크다
   *   줌통(줌피) — 빨간 바 아래 떨림이 준다
   */
  forge: {
    /** 60·140·300 — 1단이 근력 8 한 레벨(45) 남짓, 3단은 근력 14 두 레벨. 개조는 스탯보다 비싼 것이 맞다:
     *  활채 1단(+7% 피해)은 근력 두세 레벨 값을 한다 (probe-economy). */
    costBase: k(60, 1, 600, 5, '개조 1단 값 (냥)'),
    costStep: k(80, 0, 600, 5, '단마다 오르는 값'),
    costStep2: k(80, 0, 600, 5, '단마다 더 오르는 값 (2차)'),
    maxLevel: k(3, 1, 9, 1, '부위별 최대 단'),
    stringDraw: k(0.07, 0, 0.3, 0.01, '시위 1단당 만작 시간 감소율'),
    limbSpeed: k(0.035, 0, 0.2, 0.005, '활채 1단당 초속 증가율'),
    gripTremor: k(0.1, 0, 0.5, 0.01, '줌통 1단당 떨림 감소율'),
  },

  /**
   * 부적(符籍) — 여정 한 번짜리 소모품 (2026-09-02). 출정할 때 하나만 지닌다.
   * 영구 성장(스탯·개조)과 다른 축: **이번 여정에만** 붙고, 여정이 끝나면 사라진다.
   * 그래서 "이번엔 이걸 지니고 간다"가 매 출정의 결정이 되고, 냥를 매 여정 쓸 이유가 생긴다.
   * 하나만인 이유: 넷을 다 지니게 하면 결정이 아니라 체크리스트다.
   */
  charm: {
    // 값은 여정 수입의 15~30% (초보 한 여정 ~150 · 숙련 ~375, probe-economy). 옛 8~12는 판 하나 값이었다.
    quiverCost: k(45, 0, 300, 5, '살통 부적 값 — 매 판 화살 +1'),
    ironCost: k(50, 0, 300, 5, '철갑 부적 값 — 두정갑 입고 출발'),
    goldCost: k(35, 0, 300, 5, '노다지 부적 값 — 냥 ×배수, 체력 깎여 출발'),
    goldTrainMul: k(1.3, 1, 3, 0.05, '노다지 부적 냥 배수'),
    goldHpCut: k(30, 0, 90, 5, '노다지 부적이 깎는 시작 체력'),
    ghostCost: k(60, 0, 300, 5, '파귀 부적 값 — 보스 체력 감소'),
    ghostBossHp: k(0.75, 0.3, 1, 0.05, '파귀 부적 보스 체력 배수'),
  },

  /**
   * 살 가게 — 발견한 특수살을 냥로 채운다 (2026-09-02). 보스 보급(공짜 3발)이 유일한
   * 획득처였는데, 아껴 둔 살이 다 떨어지면 다음 보스까지 빈 살통이었다. 값은 그 살이 처음
   * 나오는 마디(supply.ts)로 매긴다 — 깊은 살이 비싸다. 신전(homing)만 따로 값을 둔다.
   */
  shop: {
    priceBase: k(10, 1, 100, 1, '첫 마디 살 한 발 값 (냥)'),
    priceStep: k(5, 0, 50, 1, '마디마다 오르는 값'),
    homingPrice: k(30, 1, 200, 1, '신전 한 발 값'),
  },

  sandbox: {
    /** look3(드론) 보스 스폰의 속도 배수 — 실험장에서만 빠르게 붙는 걸 확인하려는 용도. */
    bossLook3SpeedMul: k(2.2, 1, 5, 0.1, '실험장 드론 보스 속도 배수'),
    /** 스폰 세로 난수 폭(ry2)에 곱하는 비율들 — 그냥 화면 안에 흩어지게 하는 자리다. */
    spreadLow: k(0.4, 0.1, 1, 0.05, '실험장 낮은 스폰 세로 난수 비율'),
    spreadHigh: k(0.6, 0.1, 1, 0.05, '실험장 높은 스폰 세로 난수 비율'),
    /** 폭탄 스폰 클러스터 — 딸린 과녁 셋이 폭탄에서 벌어지는 거리. bombRadius(2.2) 안이어야 딸려 죽는 게 보인다. */
    bombSpread: k(1.4, 0.5, 3, 0.1, '실험장 폭탄 클러스터 간격', 'm'),
  },

  /**
   * 나라(realm) — 칠십팔국의 계절 판정 (docs/realm/SYSTEMS.md §3 · §4 · §14)
   *
   * 숫자는 전부 **초안**이다. 확정은 tools/realm-sim.ts 의 봇 대전으로 한다 (BUILD §3).
   * 콘솔이 두 겹(group.name)만 읽으므로 표는 이름을 풀어 평평하게 둔다.
   */
  realm: {
    /** 설명 말풍선 (ui/realm/tips.ts · 형: "터치하자마자 중요한 설명 … 디테일은 누르고 있으면 조금있다") */
    tipHold: k(450, 200, 1200, 50, '설명 — 누르고 있으면 자세한 말이 뜨기까지', 'ms'),
    tipHover: k(0, 0, 1000, 20, '설명 — 마우스를 올려 두면 말풍선이 뜨기까지 (형 10-23: 바로바로)', 'ms'),
    /**
     * 싸움 한 합의 시계 하나 — 깃발(우리 먼저 · 쪽마다 둘까지) → 맞부딪힘 → 이야기 → 결과 (feel-lens 검토 10-24 · 형: "연출이 난잡해 · 차례차례 속도감 있게").
     * 그림(CSS 지연)과 소리가 같은 값을 읽는다 (battlefield.roundPlan)
     */
    warBeat0: k(0.25, 0, 2, 0.05, '싸움: 깃발 줄이 뒤집힌 뒤 첫 깃발 연출까지(초)'),
    warTabNextMs: k(320, 0, 1500, 20, '싸움: 깃발을 고른 뒤 다음 무리 탭으로 넘어가기까지(ms)'),
    warB0PopMs: k(1000, 300, 3000, 50, '새 전투 시험: 깃발을 고르면 화면 가운데 큰 깃발이 떠 있는 시간(ms)'),
    warTickLineH: k(36, 20, 60, 1, '싸움: 합 결과 두 줄 창의 한 줄 높이(px)'),
    warTickLineHLand: k(28, 20, 60, 1, '싸움: 가로 폰에서 두 줄 창의 한 줄 높이(px) — 두 줄이 화면 아래 띠 자리에 들게'),
    warLandMaxH: k(600, 400, 900, 10, '싸움: 가로 화면이 이 높이(px) 이하면 가로 폰 전투판 — 초상·막대는 양옆 칸, 전장은 가운데 (형 11-21 · 불러올 때 한 번 읽는다)'),
    warLandMaxW: k(1099, 700, 1400, 1, '싸움: 가로 폰 전투판은 이 폭(px)까지 — 더 넓으면 컴퓨터 판 (불러올 때 한 번 읽는다)'),
    warTickGap: k(4, 0, 12, 1, '싸움: 두 줄 창 줄 사이(px)'),
    warTickMove: k(0.25, 0.05, 1, 0.05, '싸움: 두 줄 창이 한 줄 밀려 올라가는 시간(초)'),
    warDropGap: k(6, 0, 60, 1, '싸움: 깃발 판 윗변에서 이만큼(px) 위부터 깃발을 놓으면 쓰인다'),
    warHoldLingerMs: k(300, 0, 3000, 50, '싸움: 병사·깃발에서 손을 뗀 뒤 설명 창이 더 떠 있는 시간(ms)'),
    warLookTableMs: k(500, 200, 2000, 50, '싸움: 깃발을 이만큼(ms) 누르고 있으면 깃발 판 밑 판세에 피해·사기 표까지'),
    warLookGain: k(4, 1, 12, 0.5, '싸움: 판세 막대 — 지금 판세에서 바뀌는 몫을 이만큼 키워 가운데 금에서 좌우로 (99% 와 98% 도 보이게 · 형 10-28)'),
    warGemSettleMs: k(2300, 300, 5000, 100, '싸움: 판이 열리고 병사가 걸어 들어온 뒤 보석 자리를 다시 재기까지(ms)'),
    warDragSlop: k(10, 2, 40, 1, '싸움: 깃발을 이만큼(px) 움직이면 끌기로 본다'),
    warTapPickMs: k(350, 100, 1000, 10, '싸움: 깃발 판의 깃발을 이만큼(ms)보다 짧게 누르고 떼면 그 깃발을 고른다 (끌지 않아도 · 폰 · FIRST-HOUR-20261122 TOP 3) · 길게 누르면 판세만'),
    warRoundPopHoldS: k(2.6, 0.8, 8, 0.1, '싸움: 합 결과 상자가 다 풀린 뒤 전장 위에 더 떠 있다가 사라지기까지(초)'),
    warLookMenStep: k(5, 1, 50, 1, '싸움: 깃발 짐작의 잃을 군사를 이 단위로 둥글린다 (백 명을 넘으면 10, 천 명을 넘으면 100)'),
    warLookPctStep: k(0.05, 0.01, 0.1, 0.01, '싸움: 깃발 짐작의 확률을 이 단위로 둥글린다 (0%·100% 는 참일 때만)'),
    warLookColorMen: k(300, 50, 2000, 50, '싸움: 깃발 짐작 표 — 군사가 이만큼 바뀌면 붉은빛·녹빛이 가장 짙다 (적을수록 옅다 · 로그 눈금)', '명'),
    warLookColorMor: k(40, 5, 100, 5, '싸움: 깃발 짐작 표 — 사기가 이만큼 바뀌면 붉은빛·녹빛이 가장 짙다', '점'),
    repGroupOpen: k(3, 1, 10, 1, '계절 소식: 한 갈래에서 펴 두는 줄 수 — 넘치면 나머지는 「n줄 더 보기」로 접는다'),
    /** 맞붙기 전 화면(VS) — 땅 칩과 진군 이야기를 읽을 틈 (형 10-25: "vs 화면은 자동으로 넘어가지는 시간이 더 길어져야") · 누르면 바로 넘어간다 */
    mapCullPad: k(0.8, 0.2, 3, 0.1, '지도: 보이는 칸 둘레로 이 몫(화면 크기의 배)까지만 고을·말·이름표를 그린다 — 그 밖은 숨기고 움직임을 끈다 (폰 그래픽 한도 · 형 11-08)'),
    mapCullPadTouch: k(0.3, 0.1, 3, 0.05, '지도: 폰(손가락 화면)은 화면 밖 둘레를 이만큼만 살려 둔다 — 밝힌 땅이 넓어지면 화면 밖 고을의 움직임 층까지 그래픽 한도를 넘어 보이는 고을이 통째로 안 그려졌다 (형 11-10)'),
    mapCullMs: k(120, 30, 600, 10, '지도: 미는 동안 화면 밖 숨기기를 다시 재는 틈(ms)'),
    mapPanRestMs: k(180, 50, 1000, 10, '지도: 밀기를 멈추고 이만큼(ms) 뒤에 「미는 중」 표시(.mapwrap.panning — 튜토리얼이 보고 흐르는 점선이 멈춘다)를 걷는다'),
    /**
     * 길과 금이 꼬이지 않게 (형 10-27: "국경이랑 길이 조금 더 단순해도 좋으니까 서로 꼬이지 않게") — 고을 구역 굽기(tools/zonegeo.ts) · roadlayout.ts.
     * roadCorridor* · border* 를 바꾸면 tools/bake-zones.ts 로 구역을 다시 굽는다 (게임은 구운 구역만 읽는다)
     * 재는 것은 tools/realm-tangle.ts (길끼리 엇갈림 · 길이 금을 건너는 수)
     */
    roadCorridor: k(1.6, 0.5, 4, 0.1, '지도: 길 둘레 이만큼(땅 칸)을 두 끝 고을 땅으로 묶는다 — 금이 길을 비껴 지나지 않게'),
    roadCorridorReach: k(0.75, 0.2, 1, 0.05, '지도: 먼 길의 묶인 칸이 땅을 퍼뜨리는 걸음 끝 — 고을이 퍼지는 끝의 몫'),
    borderSimplify: k(1.1, 0.5, 3, 0.05, '지도: 금을 줄일 때 버리는 잔 굽이(땅 칸) — 클수록 금이 곧고 단순하다'),
    borderSmooth: k(2, 0, 4, 1, '지도: 금 모서리 깎기 횟수 — 많을수록 둥글다'),
    roadClear: k(0.45, 0.1, 1, 0.05, '지도: 길이 남의 고을 자리에서 떨어져야 하는 거리 — 땅 반지름(terrR)의 몫'),
    /**
     * 나라의 두 빛 (ui/realm/kitcolor.ts · 형 10-26: "축구팀 유니폼 2가지 색을 다루듯이") — 거리는 CIE76 ΔE.
     * 한 판에 같이 서는 두 나라는 바탕 빛이 kitMainFar 넘게 멀거나, 아니면 둘째 빛이 kitSecondFar 넘게 멀어야 한다 (tests/realm/kit-color.test.ts)
     */
    kitMainFar: k(22, 5, 60, 1, '나라 빛: 바탕 빛만으로 갈리는 거리(ΔE) — 이보다 가까우면 둘째 빛으로 가른다'),
    kitSecondFar: k(40, 10, 100, 1, '나라 빛: 바탕이 비슷한 두 나라의 둘째 빛이 떨어져야 하는 거리(ΔE)'),
    kitSelfFar: k(35, 10, 100, 1, '나라 빛: 한 나라의 띠(둘째 빛)가 바탕에 묻히지 않는 거리(ΔE)'),
    kitInkLum: k(0.19, 0.05, 0.9, 0.01, '나라 빛: 바탕 밝기(휘도)가 이 위면 먹빛 글씨, 아래면 흰 글씨'),
    warOpenCount: k(10, 3, 20, 1, '싸움: 맞붙기 전 화면의 셈 — 10 9 8 … 1 뒤 걷힌다 (형 10-25: "누르면 넘어간다가 아니라 10 9 8 7 6 5 4 3 2 1")', '초'),
    /** 장수 목소리 (형 10-26: "장수 선택할때 네, 이런거는 나오긴 하는데 다른 데에서는 아무데서도 장수목소리가 안들리는데. 전투할때도") */
    warVoiceArtS: k(0.18, 0, 1.5, 0.02, '싸움: 장수 장면이 튀어나오고 외침까지(초)', '초'),
    warAutoEndVoiceS: k(0.9, 0, 4, 0.05, '맡긴 싸움: 마지막 합의 결과가 뜬 뒤 맡은 장수가 이김·짐 한마디를 하기까지(초)', '초'),
    voiceVol: k(0.9, 0, 1, 0.05, '장수 목소리 크기'),
    /** 전장 정보창 (형 10-25: "누르고 있거나 커서 올리면 터치 지역에서 약간 떨어진 왼쪽부분에") — 값은 머티리얼·플러터 기본(꾹 누름 ~0.5초 · 뗀 뒤 1.5초)에 맞췄다 */
    warTipHoldMs: k(250, 100, 1200, 50, '싸움 전장: 누르고 있으면 정보창이 뜨기까지(ms) — 짧게 누르면 무리 선택'),
    warTipLingerMs: k(0, 0, 5000, 100, '싸움 전장: 손을 뗀 뒤 정보창이 더 남는 시간(ms) — 하스스톤처럼 떼면 바로 걷힌다 (형 10-25: "안없어지잖아 자꾸")'),
    warTipHoverMs: k(120, 0, 1000, 20, '싸움 전장: 마우스를 올리면 정보창이 뜨기까지(ms)'),
    warTipSlop: k(15, 4, 40, 1, '싸움 전장: 이만큼(px) 넘게 움직이면 꾹 누름을 접는다(스크롤)'),
    warTipGapTouch: k(36, 0, 120, 2, '싸움 전장: 정보창이 손가락에서 떨어지는 거리(px)'),
    warTipGapMouse: k(18, 0, 80, 2, '싸움 전장: 정보창이 커서에서 떨어지는 거리(px)'),
    warTipW: k(270, 180, 420, 10, '싸움 전장: 정보창 폭(px)'),
    warTipMinW: k(190, 120, 300, 10, '싸움 전장: 손가락 옆에 이 폭(px)도 안 남으면 위로 띄운다'),
    warHitPad: k(8, 0, 30, 1, '싸움 전장: 무리를 누를 때 말들의 네모 밖으로 이만큼(px)까지 쳐 준다'),
    contestSeasons: k(4, 1, 12, 1, '3장(주몽): 송양의 활쏘기 겨루기를 할 수 있는 계절 수 (첫 해)'),
    pursuitSeasons: k(3, 0, 12, 1, '3장(주몽): 동부여 추격군이 유예 없이 쫓아오는 첫 계절 수'),
    cardFishSeason: k(1, 0, 12, 1, '3장(주몽): 엄리대수의 다리 카드가 오는 계절'),
    cardGogakSeason: k(4, 0, 20, 1, '3장(주몽): 비류국 고각 카드가 오는 계절'),
    cardMhScoldSeason: k(3, 0, 20, 1, '1장(마한): 마한왕의 꾸짖음 카드가 오는 계절 (위원회 11-04 역사 ③)'),
    cardMhHuntSeason: k(6, 0, 20, 1, '1장(마한): 사냥을 나간다 카드가 오는 계절'),
    cardOpenGateSeason: k(4, 0, 20, 1, '2장(서라벌): 밤에도 문을 열어 둔 나라 카드가 오는 계절'),
    cardRedSailSeason: k(2, 0, 20, 1, '4장(구지봉): 붉은 돛 카드가 오는 계절'),
    cardSelfPotSeason: k(3, 0, 20, 1, '5장(대무신왕): 저절로 끓는 솥 카드가 오는 계절'),
    cardChapFavor: k(15, 0, 40, 1, '장 카드: 크게 좋게 보는 호감 (마한왕의 꾸짖음 · 목책을 허문다)'),
    cardChapFoeMorale: k(0.15, 0, 0.5, 0.01, '장 카드: 몰래 쳐서 꺾이는 적 군대 사기 (사냥을 나간다)'),
    cardChapBond: k(8, 0, 30, 1, '장 카드: 귀한 손님을 맞아 오르는 장수들 정 (붉은 돛)'),
    cardRedSailOk: k(0.5, 0, 1, 0.05, '장 카드: 붉은 돛 · 신하를 보내면 손님이 따라올 가망'),
    cardChapGrain: k(0.12, 0, 0.5, 0.01, '장 카드: 저절로 끓는 솥으로 들어오는 곡식 (가진 곡식의 몫 · 바닥 cardGrainMin)'),
    cardFishMorale: k(0.25, 0, 1, 0.05, '3장(주몽): 다리를 흩으면 동부여 군대 사기가 이만큼 꺾인다'),
    cardFishFloor: k(0.3, 0, 1, 0.05, '3장(주몽) 카드: 사기가 이 밑으로는 안 내려간다'),
    cardGogakOk: k(0.6, 0, 1, 0.05, '3장(주몽): 고각을 몰래 가져올 확률'),
    cardGogakMorale: k(0.2, 0, 1, 0.05, '3장(주몽): 고각을 잃은 비류국 군대 사기 꺾임'),
    cardGogakAngry: k(20, 0, 100, 1, '3장(주몽): 고각 훔치다 들키면 비류국 호감 깎임'),
    cardGogakFavor: k(8, 0, 100, 1, '3장(주몽): 고각을 두고 예를 갖추면 비류국 호감'),
    contestArrows: k(2, 0, 10, 1, '2장: 겨루기 — 판마다 과녁 수에 더 얹어 주는 화살 수 (빗맞혀도 될 몫)'),
    contestGapX: k(5, 2, 10, 0.5, '2장 겨루기: 한 판의 과녁끼리 떨어진 거리 (m) — 가까운 것부터 먼 것까지'),
    contestSwingX: k(17, 8, 35, 0.5, '2장 겨루기 둘째 판: 흔들리는 사슴 과녁(가까운 것)까지의 거리 (m)'),
    contestSwingY: k(2.2, 0.5, 5, 0.1, '2장 겨루기 둘째 판: 흔들리는 과녁의 높이 (m)'),
    contestSwingAmp: k(0.9, 0.2, 2.5, 0.1, '2장 겨루기 둘째 판: 과녁이 위아래로 흔들리는 폭 (m)'),
    contestSwingFreq: k(0.35, 0.1, 1.2, 0.05, '2장 겨루기 둘째 판: 흔들리는 빠르기 (번/초)'),
    contestDeerX: k(22, 8, 40, 0.5, '2장 겨루기 첫 판: 백 보 과녁(가장 먼 것)까지의 거리 (m)'),
    contestDeerY: k(1.4, 0.3, 4, 0.1, '2장 겨루기 첫 판: 백 보 과녁의 높이 (m)'),
    contestDeerR: k(0.7, 0.2, 1.5, 0.05, '2장 겨루기 첫 판: 백 보 과녁의 반지름 (m)'),
    contestRingX: k(27, 8, 40, 0.5, '2장 겨루기 셋째 판: 매단 옥가락지(먼 것)까지의 거리 (m)'),
    contestRingY: k(4, 1, 8, 0.1, '2장 겨루기 셋째 판: 옥가락지를 매단 높이 (m)'),
    contestRingR: k(0.32, 0.1, 1, 0.02, '2장 겨루기 셋째 판: 옥가락지의 반지름 (m) — 작을수록 어렵다'),
    contestFavorWin: k(45, 0, 100, 1, '2장: 겨루기를 이기면 비류국 호감'),
    contestFavorLose: k(10, 0, 100, 1, '2장: 겨루기를 지면 비류국 호감 깎임'),
    seoraStrikeFavor: k(12, 0, 100, 1, '3장: 마을 하나를 칠 때마다 다른 마을들 호감 깎임 (칼을 덜 뽑는 장)'),
    warSkullNear: k(12, 0, 40, 1, '싸움: 군사·사기 막대가 무너지는 금 위로 이만큼(막대 %) 안이면 해골이 깜박인다'),
    warChunkFlashS: k(0.24, 0.05, 1, 0.01, '싸움: 막대가 줄 때 잃은 토막이 희게→노랗게→붉게 터지는 시간(초) — 롤 체력바 (형 10-28)'),
    warChunkShrinkS: k(0.6, 0.1, 2, 0.05, '싸움: 터진 토막이 줄어드는 시간(초) — 처음엔 빠르게, 끝 무렵엔 천천히'),
    warMuS: k(1.2, 0.4, 3, 0.1, '싸움: 상성 판정(우리 깃발 ▶ 적 깃발 · ✓ ✗ =)이 맞부딪는 순간 전장 가운데 떠 있는 시간(초) (형 10-29: "왜 언제는 강하고 언제는 약한지 모르겠고")'),
    warAutoCutS: k(0.5, 0, 4, 0.1, '싸움: 맡겼을 때 장수 지휘 장면이 뜬 뒤 첫 합이 풀리기까지(초) — 장면은 아래 반쪽이라 진이 곧바로 움직여도 된다 (형 11-09: 휘리릭 소리만 나고 2~3초 가만히 있다 · 옛 1.9)'),
    warAutoGapS: k(1.2, 0.2, 4, 0.1, '싸움: 맡긴 싸움에서 한 합의 결과가 나온 뒤 다음 합까지(초)'),
    tutTapSlop: k(26, 0, 80, 2, '배우는 판: 누를 곳(과 그 고을 이름표) 둘레 이만큼(px) 안의 누르기는 누를 곳을 누른 것으로 — 폰에서 고을이 손톱만 했다'),
    tutSwitchMs: k(300, 0, 3000, 50, '배우는 판: 고리를 다른 곳으로 옮기려면 그 후보가 내리 이만큼(ms) 뽑혀야 하고, 옮긴 뒤 이만큼은 그대로'),
    bgmRestMinS: k(15, 0, 120, 1, '소리: 지도 음악 한 곡이 끝나고 다음 곡까지 적어도 이만큼(초) 쉰다 — 계절 바람소리만 남는다'),
    bgmRestMaxS: k(45, 0, 180, 1, '소리: 쉬는 틈은 많아야 이만큼(초) — 그 사이에서 그때그때 뽑는다'),
    bgmFadeOutS: k(1.6, 0, 6, 0.1, '소리: 곡을 바꿀 때 앞 곡이 잦아드는 시간(초) — 혼례 가락이 장면을 닫으면 뚝 끊기지 않게 (형 10-29)'),
    tutReturnMs: k(1200, 200, 5000, 100, '배우는 판: 지도를 밀어 누를 곳이 화면 밖으로 나간 채 손을 떼고 이만큼(ms) 지나면 지도를 다시 그리로 굴린다'),
    tutSideMin: k(260, 160, 480, 10, '배우는 판: 전략 회의·옥중 담판 창 옆 빈자리가 이만큼(px) 넘으면 띠를 창 옆에 둔다 (모자라면 누를 곳 위아래)'),
    warBeatCut: k(1.9, 0, 3, 0.05, '싸움: 장수 기술 장면이 있으면 첫 깃발 연출까지(초)'),
    // 깃발 하나에 제 차례 하나 — 다음 깃발은 앞 깃발 연출이 걷힌 뒤에 (형 10-24: "카드 공격들 이펙트가 아직도 너무 한꺼번에 · 하나씩")
    warBeatStep: k(0.75, 0.1, 2, 0.05, '싸움: 깃발 차례의 기본 길이(초) — 연출 길이를 모를 때'),
    /** 등용 장면 — 칼금 셋이 나는 때(ms) · 펑 하고 얼굴이 다 드러나는 때(ms) (CSS 의 hcut·hpop 지연과 같다) */
    hireCutMs: [100, 560, 1020] as const,
    /** 돌아온 장수 알림이 머무는 시간(ms) — 큰 장면이 떠 있는 동안은 세지 않는다 */
    backToastMs: 7000,
    /** 싸움에 진 뒤 위에 뜨는 「이기는 법」 띠가 머무는 시간(ms) · 한 판에 이만큼 띄운 뒤로는 크게 졌을 때만 (howwin.ts) */
    howWinToastMs: 9000,
    howWinFreeShows: 3,
    /** 배우는 판 — 한 단계에 이만큼(ms) 머물면 「막혔으면 건너뛰기」가 뜬다 */
    tutStuckMs: 25000,
    hirePopMs: 1480,
    /** 풍습이 처음 걸린 장면 — 도장이 내려찍히는 때(ms) · CSS .cere.custom .cstamp 의 cstamp 0.62s 와 같게 */
    customStampMs: 620,
    hireVoiceMs: k(1750, 0, 5000, 50, '등용 장면: 장면이 뜨고 장수가 첫마디(등용 대사 목소리)를 하기까지(ms) — 펑(hirePopMs) 뒤에'),
    chiefVoiceMs: k(650, 0, 3000, 50, '사신의 청: 화면이 뜨고 저쪽 군장이 말(목소리)을 꺼내기까지(ms) — 말풍선 글자가 찍히기 시작하는 0.6초에 맞춤'),
    pactVoiceMs: k(1150, 0, 4000, 50, '맺었다·틀어졌다: 화면이 뜨고 저쪽 군장이 한마디(목소리)를 하기까지(ms) — 말풍선 글자가 찍히는 1.1초에 맞춤'),
    bridalShotS: k(5, 2, 12, 0.5, '신방 장면: 한 장이 머무는 시간(초)'),
    warBeatMin: k(0.5, 0.2, 2, 0.05, '싸움: 깃발 차례 가장 짧게(초)'),
    warBeatLong: k(1.25, 0.3, 3, 0.05, '싸움: 깃발 차례 가장 길게(초)'),
    warFxSquash: k(0.6, 0.2, 1, 0.05, '싸움: 깃발 연출을 제 차례 안에 끝내게 줄이는 배율'),
    warBeatMax: k(2, 1, 4, 1, '싸움: 한 쪽 깃발 연출 수 (많으면 앞의 것만)'),
    warClashGap: k(0.05, -0.5, 1, 0.02, '싸움: 마지막 깃발 차례가 끝난 뒤 맞부딪힘까지(초)'),
    warStoryGap: k(1.6, 0, 3, 0.05, '싸움: 맞부딪힘 뒤 이야기 줄까지(초)'),
    warResultGap: k(1.9, 0, 3, 0.05, '싸움: 맞부딪힘 뒤 밀림·잃은 수·막대까지(초)'),
    warBeatDur: k(0.5, 0.1, 2, 0.05, '싸움: 우리 깃발 소리 한 번의 길이(초)'),
    warSkEndMs: k(1550, 900, 2400, 50, '기술 장면(컷인): 처음부터 걷힐 때까지(ms) — warBeatCut(첫 깃발까지) 안에 들게 (skillfx.ts)'),
    warSkSpeed: k(1, 0.6, 1.6, 0.05, '기술 장면: 모든 박자에 곱하는 빠르기 (1 이 설계대로 · 작을수록 빠르다)'),
    warSkDim: k(0.72, 0.3, 0.9, 0.02, '기술 장면: 화면이 어두워지는 정도 (0~1)'),
    warSkHitMs: k(90, 40, 200, 10, '기술 장면: 맞는 순간 초상·이름이 떠는 한 번의 길이(ms) — 두 번 떤다 (히트스톱)'),
    warSkMissCutMs: k(150, 0, 600, 10, '기술 장면: 헛치면 맞는 순간보다 이만큼(ms) 앞서부터의 그림(꽂힘·깃발·말뚝·밧줄)을 뺀다 — 남는 건 갈라진 먹 (11-08)'),
    warArtFxS: k(1.7, 0.6, 3, 0.1, '기술의 여운: 컷인이 걷힌 뒤 전장 제자리에 남는 시간(초) — 혼불·흰 깃발·방패·바위 송곳 (11-08)'),
    warArtPopS: k(1.3, 0.5, 2.5, 0.1, '기술의 여운: 솟는 그림(혼불·깃발·바위 송곳·물기둥) 하나가 피었다 지는 시간(초) · 번쩍은 그대로 짧게'),
    warTokCap: k(30, 10, 60, 1, '싸움: 한 쪽 병사 그림 수 한도 (폰) — 넘으면 잣대(10·100·1000명)는 그대로, 맨 아랫자리만 반올림 (troops.ts)'),
    warTokBigSc: k(1.6, 1.2, 2.4, 0.05, '싸움: 큰 병사(100명) 크기 — 작은 병사(10명)의 몇 배'),
    warTokFlagSc: k(2.1, 1.4, 3, 0.05, '싸움: 깃발 병사(1000명) 크기 — 작은 병사의 몇 배'),
    warFordShift: k(13, 0, 25, 1, '싸움: 고을을 치는 싸움의 물가를 치는 쪽 앞으로 비키는 몫 (상자 가로 %) — 목책·해자와 안 겹치게'),
    captSlamMs: k(2520, 0, 5000, 20, '사로잡음 장면: 쇠창살이 닫히는 때(ms) — 그때 쇠판 소리와 떨림 (CSS jdrop 2.18s + .34s 와 같게)'),
    warRingBoost: k(1.5, 1, 2, 0.1, '싸움: 끝까지 울리는 깃발 소리(방진 「탱탱」)를 이만큼 크게'),
    warFoeBeatDur: k(0.32, 0.1, 2, 0.02, '싸움: 적 깃발 소리 한 번의 길이(초)'),
    warSoundMax: k(3, 1, 8, 1, '싸움: 한꺼번에 나는 소리의 수 (넘치면 적 것부터 버린다)'),
    warMeleeHits: k(4, 0, 10, 1, '싸움: 엉긴 앞줄의 칼·창 부딪는 소리 수'),
    warStrikeWindupS: k(0.58, 0.15, 1, 0.01, '싸움: 공격 준비부터 무기 접촉 또는 화살 발사까지(초)'),
    warStrikeWalkInS: k(0.32, 0.15, 0.7, 0.01, '싸움: 근접 공격 전 걸어서 접근할 여유(초)'),
    warStrikeWalkBackS: k(0.64, 0.25, 1.1, 0.02, '싸움: 피격과 공격이 끝난 뒤 대열에 걸어서 돌아가는 시간(초)'),
    warWalkStride: k(0.9, 0.5, 2, 0.05, '싸움: 보행 한 주기 동안 가는 거리(그림 높이 대비)'),
    warRideStride: k(1.3, 0.7, 2.5, 0.05, '싸움: 말의 발놀림 한 주기 동안 가는 거리(그림 높이 대비)'),
    warStrikeHorseWindupS: k(0.95, 0.3, 1.5, 0.05, '싸움: 기병이 표적을 향해 달려드는 시간(초)'),
    warHorseRideS: k(1.45, 0.5, 2.5, 0.05, '싸움: 기병이 옆구리로 돌아가는 시간(초)'),
    warPlaybackRate: k(0.7, 0.4, 1, 0.05, '싸움: 1배에서 연출 시계가 흐르는 속도'),
    warCapRunS: k(0.8, 0.3, 1.6, 0.05, '사로잡기: 우리 장수가 적장에게 달려가는 시간(초) — 맞부딪힘에 닿는다 (battle-capture.ts)'),
    warCapGrabS: k(0.75, 0.3, 1.5, 0.05, '사로잡기: 맞부딪힘부터 쓰러진 적장을 들어 올리기 시작할 때까지(초)'),
    warCapLiftS: k(0.32, 0.1, 0.8, 0.02, '사로잡기: 적장을 머리 위로 들어 올리는 시간(초)'),
    warCapCarryS: k(1.15, 0.5, 2.5, 0.05, '사로잡기: 적장을 이고 우리 진으로 돌아오는 시간(초)'),
    warCapDropS: k(0.3, 0.1, 0.8, 0.02, '사로잡기: 우리 진에 닿아 적장을 땅에 내려놓는 시간(초)'),
    warCapBob: k(0.05, 0, 0.15, 0.01, '사로잡기: 이고 달릴 때 적장이 걸음마다 들썩이는 높이(장수 그림 높이 대비)'),
    warCapReach: k(0.45, 0, 1, 0.05, '사로잡기: 적장 바로 앞에 멈추는 거리(장수 그림 폭 대비)'),
    warStrikeHitS: k(0.38, 0.1, 0.65, 0.01, '싸움: 개별 피격 자세가 보이는 시간(초)'),
    warStrikeFallS: k(0.32, 0.1, 0.6, 0.02, '싸움: 쓰러진 병사가 전장에서 사라지는 시간(초)'),
    warStrikeStaggerS: k(0.24, 0, 0.4, 0.01, '싸움: 같은 진의 근접 공격이 엇갈리는 간격(초)'),
    warStrikeReplyS: k(0.36, 0, 0.7, 0.02, '싸움: 반대쪽 근접 공격의 답격 간격(초)'),
    warArrowFlightS: k(0.64, 0.3, 1.1, 0.02, '싸움: 활을 놓은 순간부터 표적에 닿을 때까지(초)'),
    warArrowLift: k(0.20, 0.05, 0.45, 0.01, '싸움: 화살 호의 높이(발사점과 표적의 가로 거리 대비)'),
    warMeleeGap: k(0.28, 0.1, 1, 0.02, '싸움: 엉긴 앞줄의 칼·창 소리 사이(초) — 찌르기 컷 박자(.3s)에 맞춘다'),
    tipShort: k(2800, 1000, 10000, 100, '설명 — 짧은 말풍선이 떠 있는 시간', 'ms'),
    tipLong: k(7000, 2000, 20000, 500, '설명 — 길게 눌러 띄운 말풍선이 떠 있는 시간', 'ms'),
    /** 란체스터 제곱의 꼴 — P = Fa^k / (Fa^k + Fd^k). 2 면 큰 쪽이 더 유리하다. */
    battleK: k(2, 1, 3, 0.1, '전투 승률 지수 k'),
    /** 교착 몫 = drawK · P · (1−P). 접전일수록 크고 양쪽에서 똑같이 덜어 낸다. */
    drawK: k(0.4, 0, 1, 0.05, '교착 계수'),
    /** 결과 칸 '대승'은 이긴 몫의 이만큼 (나머지가 '승'). 지는 쪽도 같은 비율로 대패/패. */
    routShare: k(0.35, 0, 1, 0.05, '이긴 몫 가운데 대승의 비율'),
    lossRoutWin: k(0.05, 0, 0.5, 0.01, '대승 — 이긴 쪽 손실'),
    lossRoutLose: k(0.4, 0, 1, 0.01, '대승 — 진 쪽 손실'),
    lossWin: k(0.12, 0, 0.5, 0.01, '승 — 이긴 쪽 손실'),
    lossLose: k(0.25, 0, 1, 0.01, '승 — 진 쪽 손실'),
    lossDraw: k(0.1, 0, 0.5, 0.01, '교착 — 양쪽 손실'),

    /** 장비 단계 E — 쇠 판갑·찰갑은 없다, 4세기의 것이다 (WORLD §3) */
    equipStone: k(0.8, 0.5, 2, 0.05, '장비: 돌·나무 (돌창 · 나무 방패 · 뼈촉 화살)'),
    equipBronze: k(0.9, 0.5, 2, 0.05, '장비: 청동 (청동 날 · 세형동검)'),
    equipIronTip: k(1, 0.5, 2, 0.05, '장비: 쇠날 (날과 촉만 쇠)'),
    equipIron: k(1.2, 0.5, 2, 0.05, '장비: 온 쇠 (쇠 날에 쇠비늘 갑옷)'),
    equipLeather: k(1.3, 0.5, 2, 0.05, '장비: 가죽 갑옷 (옛 값 — 병종 무장에서는 청동 단계로 친다, kit.tierOf)'),
    equipRingSword: k(1.45, 0.5, 2, 0.05, '장비: 환두대도 (큰 판 후반)'),

    /** 지휘 L = leadBase + leadPerMu × 무(1~10) → 0.85 ~ 1.30 */
    leadBase: k(0.8, 0.5, 1, 0.01, '지휘 바탕'),
    leadPerMu: k(0.05, 0, 0.1, 0.005, '무 1당 지휘'),
    /** 상성 — 유리 ×1.25 · 불리 ×0.8 */
    counterUp: k(1.25, 1, 2, 0.05, '병종 상성 유리'),
    counterDown: k(0.8, 0.5, 1, 0.05, '병종 상성 불리'),
    /** 병종의 쓰임 — 공수·성·지형 (battle.roleMul, 2026-10-18 형: "지형에따라, 공격인지 방어인지에 따라 계산되는 승패 다른거 맞지?") */
    roleBowDef: k(0.15, 0, 0.6, 0.01, '궁수 — 지킬 때 덤'),
    roleBowWall: k(0.1, 0, 0.6, 0.01, '궁수 — 성·높은 터 위에서 지킬 때 덤 (지킬 때 덤에 더해)'),
    roleBowForest: k(0.25, 0, 0.8, 0.01, '궁수 — 숲길 싸움에서 깎임'),
    roleShieldDef: k(0.12, 0, 0.6, 0.01, '방패병 — 지킬 때 덤'),
    roleShieldAmbush: k(0.3, 0, 1, 0.01, '방패병 — 기습을 당했을 때 버티는 덤'),
    roleSpearAtk: k(0.1, 0, 0.6, 0.01, '창병 — 칠 때 덤'),
    roleSpearField: k(0.1, 0, 0.6, 0.01, '창병 — 들길 싸움에서 덤'),
    roleSpearPass: k(0.2, 0, 0.8, 0.01, '창병 — 좁은 고갯길 싸움에서 깎임'),
    /** 수군 (형: "수군들은 어떻게 응용해야하지" 2026-10-19) — 물길·바닷길·포구에서 세고, 뭍의 길에서는 약하다 */
    roleBoatWater: k(0.5, 0, 1.5, 0.05, '수군 — 나루·갈대·바다·갯벌 길 싸움에서 덤'),
    roleBoatPort: k(0.3, 0, 1, 0.05, '수군 — 포구를 지킬 때 덤'),
    roleBoatLand: k(0.3, 0, 0.8, 0.05, '수군 — 들·고개·숲 길 싸움에서 깎임'),

    /**
     * 직접 지휘하는 싸움 (realm/tactics.ts · docs/realm/BATTLE.md — 형: "명령해서 진두지휘하는듯 · 상성 · 포획은 직접" 2026-10-19).
     * 라운드마다 두 쪽이 명령 하나씩. 돌격 > 화살비 > 방진 > 돌격 의 세모.
     */
    tacRounds: k(4, 2, 6, 1, '싸움 한 판의 라운드 수'),
    tacK: k(1.1, 0.5, 3, 0.1, '라운드의 승률 지수 — 라운드가 쌓이니 battleK 보다 무르게'),
    tacTriUp: k(1.45, 1, 2.5, 0.05, '세모 상성 — 이긴 명령의 배수'),
    tacTriDown: k(0.7, 0.3, 1, 0.05, '세모 상성 — 진 명령의 배수'),
    // 상성을 이긴 쪽은 덜 잃고 진 쪽은 더 잃는다 — 방진으로 돌격을 받으면 달려든 쪽이 크게 다친다 (형: "우리가 방진이고 적이 돌격이었는데 우리가 피해를 더입네")
    tacTriTakeWin: k(0.6, 0.2, 1, 0.05, '세모 상성 — 이긴 쪽이 받는 손실 배수'),
    tacTriTakeLose: k(1.4, 1, 2.5, 0.05, '세모 상성 — 진 쪽이 받는 손실 배수'),
    tacShareBase: k(0.6, 0.2, 1, 0.05, '명령의 세기 바탕 — 그 명령에 맞는 병종이 하나도 없을 때'),
    tacShareGain: k(0.9, 0, 2, 0.05, '명령의 세기 — 맞는 병종 몫 1 당 더해지는 세기'),
    tacChargeMul: k(1.1, 0.8, 1.5, 0.05, '돌격의 세기 배수 (대신 더 잃는다)'),
    tacHoldMul: k(0.85, 0.5, 1.2, 0.05, '방진의 세기 배수 (대신 덜 잃는다)'),
    tacTakenCharge: k(1.15, 0.5, 2, 0.05, '돌격할 때 받는 손실 배수'),
    tacTakenHold: k(0.65, 0.3, 1.2, 0.05, '방진일 때 받는 손실 배수'),
    tacTakenVolley: k(0.9, 0.5, 1.5, 0.05, '화살비일 때 받는 손실 배수'),
    tacRoundLoss: k(0.07, 0.02, 0.2, 0.005, '라운드 한 번 — 팽팽할 때 한쪽이 잃는 몫'),
    // 0.8 → 0.4 (형 10-31: "전투에서 너무 확률적인 게 강하면 · 내가 통제한다는 생각이 안 든다")
    tacJitter: k(0.4, 0, 1, 0.05, '라운드의 운 — 밀고 밀리는 몫이 이만큼 흔들린다'),
    /** 머릿수 (tactics.resolveRound) — 한 합에 잃는 몫 × (상대 머릿수 ÷ 우리 머릿수)^이것 · 같은 머릿수면 1 */
    // 쇠의 바다 봇 판 머릿수 3배+ 싸움에서 많은 쪽이 더 잃은 몫 — 옛것 37% · 0.5 이면 13% · 0.8 이면 9% · 1 이면 11% (tools/realm-size.ts 10-31)
    tacSizeExp: k(0.8, 0, 1.5, 0.05, '머릿수: 많은 쪽이 때리면 더 죽는다 (지수)'),
    tacSizeMin: k(0.3, 0.1, 1, 0.05, '머릿수: 많은 쪽이 잃는 몫의 바닥 배수'),
    tacSizeMax: k(3, 1, 6, 0.25, '머릿수: 적은 쪽이 잃는 몫의 천장 배수'),
    tacMoraleSwing: k(0.6, 0, 1, 0.01, '라운드에 밀린 만큼 사기가 오가는 크기'),
    tacTriMorale: k(0.04, 0, 0.2, 0.01, '세모에서 진 쪽 사기 더 감산'),
    tacBreakMen: k(0.45, 0.1, 0.8, 0.05, '처음보다 이만큼 아래로 남으면 무너진다'),
    tacBreakMorale: k(0.55, 0.2, 0.9, 0.05, '사기가 이 아래면 무너진다'),
    tacWinShare: k(0.58, 0.5, 0.9, 0.01, '끝까지 싸웠을 때 남은 전투력 몫이 이 위면 이긴다 (아래쪽은 1-이것)'),
    tacRoutShare: k(0.78, 0.5, 1, 0.01, '무너뜨렸을 때 남은 전투력 몫이 이 위면 대승'),
    tacCapPerMu: k(0.03, 0, 0.1, 0.005, '사로잡기 — 두 장수 무예 1 차이당'),
    tacCapMin: k(0.03, 0, 0.3, 0.01, '사로잡기 — 바닥'),
    tacCapSpend: k(0.5, 0, 1, 0.05, '사로잡으러 간 라운드 — 우리 세기가 이만큼으로 준다'),
    tacTakenCapture: k(1.2, 0.5, 2, 0.05, '사로잡으러 간 라운드 — 받는 손실 배수'),
    tacRetreatLoss: k(0.5, 0, 1, 0.05, '물러날 때 — 그 라운드에 받을 손실의 몫'),
    tacDeathRout: k(0.12, 0, 0.5, 0.01, '무너진 쪽 장수가 난전에 쓰러질 확률'),
    tacChase: k(0.15, 0, 0.5, 0.01, '무너져 달아나는 쪽이 쫓기며 더 잃는 몫'),
    /** 대승까지는 아닌데 무너졌을 때 — tacChase 의 이만큼 배 (0.8 → 12% · 물러남 3.5% · 물러나다 따라잡힘 11.2% 보다 크게) */
    tacBreakChase: k(0.8, 0, 1, 0.05, '무너졌지만 대승은 아닐 때 쫓기며 잃는 몫 (tacChase 배)'),
    tacFlankMul: k(1.35, 1, 2, 0.05, '옆치기 — 세기 배수 (세모를 타지 않고 방진을 이긴다)'),
    tacFireOk: k(0.8, 0, 1, 0.05, '불 — 불길이 적 쪽으로 번질 확률'),
    tacFireTaken: k(0.5, 0, 1.5, 0.05, '불 — 먹히면 적이 받는 손실에 더하는 배수'),
    tacFireDealt: k(0.6, 0.2, 1, 0.05, '불 — 먹히면 적의 세기 배수'),
    tacFireBack: k(0.1, 0, 0.3, 0.01, '불 — 바람이 돌면 우리 사기 감산'),
    tacDuelMu: k(6, 1, 10, 1, '장수 겨루기 — 우리 장수 무예가 이만큼은 되어야 나선다'),
    tacDuelPerMu: k(0.08, 0, 0.2, 0.01, '장수 겨루기 — 무예 1 차이당 이길 확률'),
    tacDuelWin: k(0.08, 0, 0.3, 0.01, '장수 겨루기 — 이긴 쪽 사기 가산'),
    tacDuelLose: k(0.18, 0, 0.5, 0.01, '장수 겨루기 — 진 쪽 사기 감산'),
    tacDuelKill: k(0.25, 0, 1, 0.05, '장수 겨루기 — 진 장수가 쓰러질 확률 (아니면 다친다)'),
    tacDuelLeader: k(0.85, 0.5, 1, 0.05, '장수 겨루기 — 장수를 잃은 쪽 세기 배수 (남은 라운드)'),
    tacHungry: k(0.04, 0, 0.2, 0.01, '군량이 바닥인 쪽 — 라운드마다 사기 감산'),
    tacWallSteady: k(0.25, 0, 0.8, 0.05, '성벽·목책 안에서 지키는 쪽은 밀린 합에서 사기가 이만큼 덜 꺾인다 (M2 성벽이 안겨 주는 위안 · 형 10-31)'),
    tacWallFloor: k(0.42, 0.1, 0.5, 0.02, '성벽·목책 안에서 지키는 쪽의 합 사이 사기 바닥 — 처음 사기의 이 몫 (무너짐 문턱 tacBreakMorale 보다 낮아야 무너질 수 있다 · 밖은 0.1 고정)'),
    // ── 전투 2판 — 세 무리(앞줄·활·말)를 깃발마다 따로 부린다 (docs/realm/BATTLE.md · 형: "각자 행동 컨트롤 되어야 하는거 아냐?")
    /**
     * 해시계 (형 10-26: "유저는 언제 전투가 끝나는지도 모르고 갑자기 끝나버려서" · "야습이나 야간전투 같은건 어떻게함?") —
     * 싸움은 때 넷: 낮이면 아침·한낮·해거름·해질녘, 기습·야습이면 한밤·깊은 밤·동틀 녘·새벽. 한 때가 한 합. 화면 위에 늘 보인다.
     * 마지막 때가 끝나도 아무도 안 무너졌으면 두 쪽이 고른다 — 진을 친다(판세로 정해진다) · 한 합 더(밤싸움 · 곡식과 사기가 든다) · 물러난다
     */
    tacClock: k(4, 2, 4, 1, '싸움 한 판의 때 — 낮이면 아침·한낮·해거름·해질녘, 밤이면 한밤·깊은 밤·동틀 녘·새벽 (한 때가 한 합)'),
    tacClockSmall: k(1, 0, 2, 1, '작은 싸움(tacSmallBattle 아래)은 이만큼 늦게 붙는다 — 한낮(깊은 밤)부터'),
    tacDuskNear: k(0.1, 0, 0.3, 0.01, 'AI — 마지막 때에 무너지는 선과 이만큼 가까우면 (적이면 한 합 더, 지고 있는 우리면 물러난다)'),
    tacPressGrainPer: k(0.02, 0, 0.2, 0.005, '한 합 더(밤싸움) — 군사 한 명에 드는 곡식 (횃불·밤참 · 500명이면 10)'),
    tacPressMorale: k(0.03, 0, 0.2, 0.01, '한 합 더 — 지친 군사의 사기 감산 (곡식을 냈을 때)'),
    tacPressHungry: k(0.1, 0, 0.3, 0.01, '한 합 더 — 곳간에 곡식이 모자라 굶은 채 싸우면 사기 감산'),
    // 밤 규칙 — 밤 싸움의 때 · 해가 진 뒤 한 합 더 (날이 밝은 뒤 한 합 더는 낮 규칙)
    tacNightBows: k(0.6, 0.2, 1, 0.05, '밤 — 어두워 화살비·맞쏘기·높은 곳의 세기 배수'),
    tacNightFire: k(1.4, 1, 2.5, 0.05, '밤 — 불화살이 먹히면 적이 받는 손실 배수 (불길이 어둠 속에 더 무섭다)'),
    tacNightMorale: k(1.5, 1, 3, 0.05, '밤 — 그 합에 밀린 쪽이 잃는 사기 배수 (어둠 속 술렁임)'),
    tacNightEdge: k(0.2, 0, 0.6, 0.01, '야습 — 먹힌 기습의 첫 때에 치는 쪽 세기 덤 (때마다 줄어 새벽엔 없다)'),
    tacLookFall: k(0.1, 0, 0.5, 0.05, '깃발 짐작 — 이번 합에 무너지는 선 밑으로 떨어질 판이 이 몫을 넘으면 깃발에 경고'),
    /**
     * 원군 (형: "양쪽에서 동시공격 했을때 그냥 퉁쳐진 합으로 계산해서 싸우는거야? … 열세에 밀린 아군에 로한의 기병대 같은 쾌감") —
     * 다른 길로 함께 친 군대, 지키는 고을로 같은 계절에 닿은 우리 군대는 처음부터 섞이지 않고 이 합에 닿는다.
     * 닿는 순간 맞은편은 옆구리·등을 찔려 사기가 꺾이고 우리는 기운이 솟는다. 원군에 기병이 많을수록 더.
     */
    reliefRound: k(1, 1, 3, 1, '원군이 닿는 합 (0 이 첫 합)'),
    reliefShock: k(0.12, 0, 0.5, 0.01, '원군이 닿으면 맞은편 사기가 꺾이는 몫'),
    reliefLift: k(0.08, 0, 0.5, 0.01, '원군이 닿으면 우리 사기가 오르는 몫'),
    reliefHorse: k(0.12, 0, 0.5, 0.01, '원군이 기병뿐이면 더 꺾이는 몫 (기병 몫에 비례)'),
    tacRoundsMax: k(5, 3, 8, 1, '싸움 한 판의 합 — 많아도 (마지막 때 뒤 「한 합 더」까지 쳐서)'),
    tacExtendBand: k(0.14, 0, 0.5, 0.01, 'AI — 마지막 때에 남은 전투력 몫이 0.5 ± 이것 안이면 치러 온 쪽이 한 합 더 (비기면 빈손이다)'),
    tacSmallBattle: k(160, 0, 1000, 10, '두 쪽 사람이 합쳐 이 아래면 작은 싸움 — 때가 하나 준다 (tacClockSmall)'),
    tacGroupMin: k(0.06, 0, 0.3, 0.01, '무리로 서는 몫 — 전체의 이만큼은 돼야 깃발을 따로 든다'),
    tacGrpFront: k(1, 0.3, 2, 0.05, '무리의 사람 하나 세기 — 앞줄'),
    tacGrpBows: k(0.85, 0.3, 2, 0.05, '무리의 사람 하나 세기 — 활'),
    tacGrpHorse: k(1.35, 0.3, 3, 0.05, '무리의 사람 하나 세기 — 말'),
    tacHoldSteady: k(0.85, 0.3, 1.2, 0.05, '방진이 돌격을 꺾으려면 사기가 처음의 이만큼은 돼야 한다 (흔들리면 못 막는다)'),
    tacHoldBreak: k(0.7, 0.2, 1, 0.05, '방진의 사기가 처음의 이 아래면 돌격에 뚫린다'),
    tacOpenFront: k(0.6, 0.2, 1, 0.05, '길 트기 — 앞줄을 벌려 맞붙는 세기는 이만큼 (대신 활이 세진다)'),
    tacOpenVolley: k(1.5, 1, 2.5, 0.05, '길 트기 — 앞줄이 길을 트면 우리 화살비가 이만큼 세진다'),
    tacStall: k(0.35, 0, 1, 0.05, '방진끼리 — 서로 버티면 손실이 이만큼으로 준다'),
    tacVolleyLoss: k(0.75, 0, 2, 0.05, '화살비 — 맞은 쪽 손실 크기 (맞붙음 대비)'),
    tacVolleyHold: k(1.4, 1, 2.5, 0.05, '화살비 — 서서 버티는 방진에 (세모: 화살비 > 방진)'),
    tacVolleyCharge: k(0.6, 0.2, 1, 0.05, '화살비 — 달려드는 적에게는 덜 맞는다'),
    tacChargeSpill: k(0.6, 0, 1.5, 0.05, '돌격이 막히지 않으면 적 궁수까지 덮친다 (세모: 돌격 > 화살비)'),
    tacCounterCut: k(0.5, 0, 1, 0.05, '맞쏘기 — 적 화살비의 세기를 이만큼으로 꺾는다'),
    tacFlank2: k(1.6, 1, 3, 0.05, '옆치기 — 막는 말이 없으면 적 활(없으면 앞줄 옆구리)을 이만큼 세게'),
    tacFlankHold: k(1.3, 1, 2, 0.05, '옆치기 — 방진의 옆구리를 칠 때 더 (세모 밖: 옆치기 > 방진)'),
    tacPunchHoldTake: k(1.5, 1, 3, 0.05, '돌파 — 방진·긴창에 부딪힌 말이 받는 손실 배수'),
    tacPursueMorale: k(0.75, 0.3, 1, 0.05, '추격 — 적 사기가 처음의 이만큼 아래거나 앞줄이 밀렸을 때만 먹힌다'),
    tacPursueMul: k(1.8, 1, 3, 0.05, '추격 — 흔들리는 적을 쫓을 때 세기 배수'),
    tacPursueWaste: k(0.2, 0, 1, 0.05, '추격 — 흔들리지 않는 적을 쫓으면 이만큼밖에 못 한다'),
    tacGuardCap: k(0.25, 0, 1, 0.05, '호위 — 적의 사로잡기를 이만큼으로 꺾는다'),
    tacGuardRetreat: k(0.5, 0, 1, 0.05, '호위 — 물러날 때 받는 손실을 이만큼으로'),
    // 물러나기는 시도다 — 가망을 보이고 굴린다 (형 10-27: "퇴각도 항상 가능한 게 아니라 성공 확률이 있어야 · 적도 마찬가지로")
    tacRetBase: k(0.6, 0, 1, 0.05, '물러나기 — 바탕 가망'),
    tacRetGuard: k(0.2, 0, 0.5, 0.05, '물러나기 — 우리 말이 호위하면 더하는 가망'),
    tacRetChase: k(0.4, 0, 1, 0.05, '물러나기 — 적 말이 쫓아오면 깎는 가망의 끝 (적 말이 많을수록)'),
    tacRetChaseK: k(3, 0.5, 10, 0.5, '물러나기 — 적 말 ÷ 우리 사람에 이만큼 곱해 쫓는 몫(0~1)으로'),
    tacRetRyak: k(0.03, 0, 0.1, 0.005, '물러나기 — 우리 장수 지략이 5 에서 한 칸 오를 때마다 더하는 가망'),
    tacRetMorale: k(0.3, 0, 1, 0.05, '물러나기 — 사기가 처음보다 꺾인 몫에 곱해 깎는 가망 (흩어지는 군대는 질서 있게 못 빠진다)'),
    tacRetDark: k(0.2, 0, 0.5, 0.05, '물러나기 — 밤·해질녘 어둠을 틈타면 더하는 가망'),
    tacRetWaver: k(0.15, 0, 0.5, 0.05, '물러나기 — 적이 흔들리고 있으면 쫓을 힘이 없다 · 더하는 가망'),
    tacRetMin: k(0.15, 0, 1, 0.05, '물러나기 — 가망의 바닥'),
    tacRetMax: k(0.95, 0, 1, 0.05, '물러나기 — 가망의 천장'),
    tacRetNoChase: k(0.15, 0, 0.5, 0.05, '물러나기 — 적에게 말이 하나도 없으면 더하는 가망 (걸어서는 걸어 도망가는 이를 못 따라잡는다 · 형 10-28)'),
    tacRetFailLoss: k(1.6, 0, 4, 0.1, '물러나다 따라잡히면 — 한 합 몫의 이만큼 배를 잃는다 (등을 보인 군대)'),
    tacRetFailMorale: k(0.12, 0, 0.5, 0.01, '물러나다 따라잡히면 — 꺾이는 사기 (처음을 1)'),
    tacAiRetreatOdds: k(0.3, 0, 1, 0.05, 'AI — 물러날 가망이 이 밑이면 물러나지 않고 끝까지 싸운다'),
    tacFeastGuard: k(0.5, 0, 1, 0.05, '호궤 — 먹인 합에 깎이는 사기의 몫 (0.5 면 반만 깎인다)'),
    tacFeastMorale: k(0.2, 0, 0.5, 0.01, '호궤 — 곳간의 곡식을 풀어 먹이면 사기가 이만큼 오른다 (처음 사기까지 · 한 판에 한 번)'),
    tacFeastGrainPer: k(0.03, 0, 0.2, 0.005, '호궤 — 군사 한 명에 드는 곡식 (640명이면 20)'),
    tacAiFeast: k(0.8, 0, 1, 0.05, '맡긴 싸움 — 사기가 처음의 이 몫 밑이면 장수가 호궤를 한다'),
    tacDrumMorale: k(0.03, 0, 0.2, 0.01, '장수가 북을 친다 — 흔들린 사기를 이만큼 다잡는다 (처음 사기까지만)'),
    tacCapSquad: k(0.1, 0.01, 0.5, 0.01, '사로잡기 — 날랜 무리로 빼는 우리 사람 몫'),
    tacCapSquadHorse: k(0.25, 0, 1, 0.05, '사로잡기 — 말 무리에서 더 빼는 몫 (말은 빨리 파고든다)'),
    tacCapEscort: k(0.3, 0.01, 0.5, 0.01, '사로잡기 — 적장 곁 호위로 남는 적 사람 몫 (적 사기에 따라 준다)'),
    tacCapAideEscort: k(0.45, 0.1, 1, 0.05, '사로잡기 — 부장 곁 호위는 총대장 곁의 이 몫 (부장이 잡기 쉽다)'),
    tacCapGuardMul: k(3, 1, 6, 0.1, '사로잡기 — 적 말이 호위하면 호위가 이만큼 두꺼워진다'),
    tacCapK: k(0.4, 0.05, 1, 0.01, '사로잡기 — 날랜 무리와 호위가 같을 때의 바탕'),
    tacCapExp: k(1.4, 0.5, 3, 0.05, '사로잡기 — 날랜 무리 ÷ 호위의 지수 (적은 수로 큰 무리 속 장수는 거의 못 잡는다)'),
    tacCapBroken: k(0.25, 0, 1, 0.05, '사로잡기 — 적 사기가 무너질 지경이면 더하는 몫'),
    tacCapDraw: k(0.85, 0.3, 1, 0.05, '사로잡으러 간 합 — 나머지 무리의 세기가 이만큼으로 준다'),
    tacCapFailLoss: k(0.5, 0, 1, 0.05, '사로잡기를 놓치면 날랜 무리가 잃는 몫'),
    tacCaughtMorale: k(0.3, 0, 1, 0.05, '사로잡혔다 — 장수를 잃은 쪽 군사의 사기가 이만큼 꺾인다'),
    tacCapAideMorale: k(0.12, 0, 1, 0.01, '부장이 사로잡혔다 — 그 쪽 사기가 이만큼 꺾인다 (총대장보다 덜 · 싸움은 이어진다)'),
    // 장수의 비기 (tactics.resolveRound · heroes.heroArt) — 한 판에 한 번
    tacArtMinStat: k(7, 5, 10, 1, '비기: 특성이 없으면 이 이상인 가장 높은 능력치(무예·지략·통솔·매력)에서 비기가 난다'),
    tacArtShot: k(0.15, 0, 0.5, 0.01, '명궁의 한 발 — 적장이 다치고 적 사기가 이만큼 꺾인다'),
    tacArtRally: k(0.12, 0, 0.4, 0.01, '큰 외침 — 우리 사기가 이만큼 오른다 (진중 굿은 1.5배 · 처음 사기를 넘을 수 있다)'),
    tacArtSway: k(0.08, 0, 0.3, 0.01, '항복 권유 — 흔들리는 적의 무리마다 이 몫이 무기를 버린다 (안 흔들리면 헛일)'),
    swayJoin: k(0.5, 0, 1, 0.05, '항복한 군사 — 권유한 쪽이 이기면 이 몫이 그 군대에 든다 (싸움이 끝난 뒤)'),
    swayJoinMorale: k(0.7, 0.3, 1.2, 0.05, '항복한 군사 — 들어온 이들의 사기 (군대 사기에 머릿수만큼 섞인다)'),
    swayHomeHH: k(0.25, 0, 1, 0.05, '항복한 군사 — 군대에 안 든 나머지 한 명당 그 고을에 드는 집'),
    tacArtAmbush: k(0.12, 0, 0.4, 0.01, '샛길 기습 — 맞붙기 전에 적 궁수(없으면 앞줄)의 이 몫이 쓰러진다'),
    tacArtVanguard: k(1.35, 1, 2, 0.05, '선봉에 선다 — 이 합 우리 앞줄의 힘 배수'),
    tacArtStand: k(0.6, 0.2, 1, 0.05, '버텨라 · 진을 다잡는다 — 이 합 우리가 잃는 사람 배수'),
    tacFordHold: k(1.6, 1, 3, 0.05, '여울 막기 — 강을 건너는 적에게 버티는 세기 배수'),
    tacFordCharge: k(0.7, 0.3, 1, 0.05, '여울 막기 — 물을 건너 달려드는 적 앞줄의 세기 배수'),
    tacRocks: k(0.08, 0, 0.3, 0.01, '바위 굴리기 — 맞붙기 전에 적 앞줄이 잃는 몫'),
    tacGateMul: k(1.35, 1, 2.5, 0.05, '성문 깨기 — 성벽 앞 방진을 깨는 세기 배수 (방진이 돌격을 이기지 못한다)'),
    tacRamMul: k(1.5, 1, 2.5, 0.05, '배 들이받기 — 물 위 앞줄 세기 배수'),
    tacHeight: k(1.4, 1, 2.5, 0.05, '높은 곳 — 그 합 활의 세기 배수 (앞줄 방진도 조금)'),
    tacHintScout: k(0.75, 0.33, 1, 0.05, '귀띔 — 이번 계절 정찰·첩자가 본 적이면 맞힐 확률'),
    tacHintBase: k(0.5, 0.33, 1, 0.05, '귀띔 — 본 것이 없을 때 맞힐 확률'),
    tacHintPerRyak: k(0.03, 0, 0.1, 0.005, '귀띔 — 우리 장수 지략 1 당 (5 넘는 만큼)'),
    tacLookSamples: k(48, 8, 200, 4, '깃발 짐작 — 적이 낼 만한 수와 우리 운을 이만큼 굴려 본다 (많을수록 고르지만 느리다)'),
    tacLookBand: k(0.05, 0, 0.25, 0.01, '깃발 짐작 — 굴린 판의 위아래 끝을 이만큼씩 떼고 가운데를 폭으로 보인다 (0.05 면 열에 아홉)'),
    tacAiCounter: k(0.7, 0, 1, 0.05, 'AI — 상대 앞줄의 수(지난 합 · 버릇)를 읽고 그 맞수를 고를 확률 (지략 5 기준). 한 수만 되풀이하면 읽힌다'),
    tacAiCapture: k(0.45, 0, 1, 0.05, 'AI — 사로잡기 확률이 이 위면 사로잡으러 간다'),
    tacAiRetreatMineEdge: k(0.1, 0, 0.5, 0.01, '맡긴 우리 싸움 — 세기 몫이 이 아래이고'),
    tacAiRetreatMineMen: k(0.4, 0, 1, 0.05, '맡긴 우리 싸움 — 남은 군사 몫도 이 아래일 때만 물러선다 (그 밖엔 끝까지 싸운다)'),
    tacStyleRead: k(0.2, 0, 0.5, 0.05, '맡긴 싸움 — 신중한 장수가 상대 앞줄의 맞수를 고를 확률 덤'),
    tacStyleBow: k(2.5, 1, 6, 0.1, '맡긴 싸움 — 명궁 장수가 앞줄 길 트기(활 앞세우기)를 고를 무게 배수'),
    tacStyleLand: k(0.95, 0.5, 1, 0.05, '맡긴 싸움 — 산사람(돌·높은 데)·물길잡이(나루)가 땅의 수를 쓸 확률'),

    /** 진군 방식 (형: "강을 도하해 기습 · 대로로 행군 · 산기슭 · 절벽 · 식량" 2026-10-19) */
    apRoadMorale: k(0.05, 0, 0.2, 0.01, '대로 — 질서 있게 닿아 사기 가산'),
    apFordConceal: k(0.1, 0, 0.4, 0.01, '여울 건너기 — 강가 갈대에 숨는 은폐 가산'),
    apFordCaughtLoss: k(0.12, 0, 0.5, 0.01, '여울 건너기 — 들키면 물 한가운데서 더 잃는 몫'),
    apRidgeConceal: k(0.12, 0, 0.4, 0.01, '산기슭 돌기 — 은폐 가산'),
    apRidgeExtra: k(1, 0, 2, 1, '산기슭 돌기 — 더 걸리는 계절', '계절'),
    apRidgeFort: k(0.5, 0, 1, 0.05, '산기슭 돌기 — 먹히면 성·지형 배수가 이 지수로 준다 (뒤를 친다)'),
    // 길목 — 지키는 쪽이 지킬 길 하나 (council.ts · docs/realm/COUNCIL.md 위원회 결정 · 형 10-29: "적이 어떻게 움직일지 장수들이랑 논의")
    cnWRoad: k(1, 0, 5, 0.05, '길목 — 대로를 지킬 바탕 무게'),
    cnWNight: k(1, 0, 5, 0.05, '길목 — 밤길을 지킬 바탕 무게'),
    cnWFord: k(1.2, 0, 5, 0.05, '길목 — 여울을 지킬 바탕 무게 (강은 누구나 의심한다)'),
    cnWRidge: k(1, 0, 5, 0.05, '길목 — 산기슭을 지킬 바탕 무게'),
    cnWCliff: k(0.5, 0, 5, 0.05, '길목 — 절벽을 지킬 바탕 무게 (설마 하고 덜 본다)'),
    cnTraitMul: k(1.8, 1, 5, 0.1, '길목 — 적장의 버릇이 가리키는 길(신중·물길잡이·산사람·밤눈)의 무게 배수'),
    cnMindMul: k(1.5, 1, 5, 0.1, '길목 — 나라 성향(탐욕은 대로 · 신중은 숨는 길)의 무게 배수'),
    cnRepeatMul: k(3, 1, 10, 0.1, '길목 — 지난번에 그 나라가 온 길의 무게 배수 (되풀이하면 읽힌다)'),
    cnWatchHit: k(0.25, 0, 0.6, 0.01, '길목 — 지킨 길로 들어가면 숨어 닿을 가망이 깎이는 몫'),
    cnWatchMiss: k(0.08, 0, 0.4, 0.01, '길목 — 다른 길을 지켰으면 숨어 닿을 가망이 오르는 몫 (그 길목에 사람을 뺐다)'),
    cnRoadHold: k(0.06, 0, 0.3, 0.01, '길목 — 대로를 지켰는데 대로로 오면 지키는 쪽 사기 + (성문 앞에 진을 쳤다)'),
    cnReadRyak: k(6, 1, 10, 1, '길목 — 이 지략부터 장수가 적이 지킬 길목을 짚어 말한다 (밑이면 모르겠다고)'),
    cnKeepTake: k(0.7, 0.4, 0.9, 0.05, '전략 회의 — 이웃 적이 노리는 고을을 비우지 말자는 안에서 데려갈 몫 (나머지는 남아 지킨다)'),
    cnCloseOdds: k(0.6, 0.3, 0.9, 0.05, '전략 회의 — 승산의 최악이 이 밑이면 거친 장수가 군사를 나누지 말자고 맞선다'),
    cnAgendaMax: k(3, 2, 7, 1, '전략 회의 — 한 번에 펴는 안건 수의 끝 (형 11-05: "제안이 5개 넘게 쌓이는 게 아니라 다양성") · 「때」 안건(동맹·공작·기다림·하늘)은 그 가운데 하나만'),
    cnWaitFoe: k(0.5, 0.1, 2, 0.05, '전략 회의 — 호전적인 적 나라가 우리 땅 곁에 둔 군사가 이 군대의 이만큼이면 「먼저 치게 두고 기다리자」는 안이 선다'),
    cnPlotRich: k(600, 0, 5000, 50, '전략 회의 — 정찰로 본 적 나라 곳간의 곡식이 이만큼이면 「먼저 곡간에 불을」 안이 선다'),
    cnGrainAge: k(4, 0, 12, 1, '전략 회의 — 정찰로 본 적의 곳간은 이 계절까지만 믿는다'),
    cnMemAge: k(12, 1, 40, 1, '전략 회의 — 장수가 이 계절 안의 지난 일만 까닭으로 든다 (더 오래된 일은 말하지 않는다)'),
    cnCouncilWatch: k(4, 0, 12, 1, '전략 회의 — 받아들인 안의 결과를 이 계절까지 기다린다 (그 고을 싸움이 나면 이겼나 졌나)'),
    apRidgeMorale: k(0.06, 0, 0.3, 0.01, '산기슭 돌기 — 먹히면 지키는 쪽 사기 감산'),
    apCliffBase: k(0.5, 0, 1, 0.05, '절벽 타기 — 바탕 확률'),
    apCliffFreeMen: k(160, 0, 1000, 10, '절벽 타기 — 이만큼까지는 사람이 많아도 괜찮다', '명'),
    apCliffPerHundred: k(0.1, 0, 0.5, 0.01, '절벽 타기 — 그 위 100명마다 감산'),
    apCliffPerMu: k(0.04, 0, 0.1, 0.005, '절벽 타기 — 장수 무예 1 당 (5 기준)'),
    apCliffMountain: k(0.15, 0, 0.5, 0.01, '절벽 타기 — 산사람 특성 가산'),
    apCliffFall: k(0.2, 0, 0.6, 0.01, '절벽 타기 — 실패하면 떨어져 잃는 몫'),
    apCliffMorale: k(0.1, 0, 0.4, 0.01, '절벽 타기 — 먹히면 지키는 쪽 사기 감산 (적이 뒤에서 나타났다)'),
    /** 군량 — 넉넉히 챙기면 곡식이 들고, 가볍게 가면 빨리 가지만 오래 못 버틴다 */
    rationReserve: k(2, 0, 6, 1, '군량 기본값 — 길 계절에 더해 챙기는 계절치 (옛 "넉넉히")', '계절'),
    rationMaxExtra: k(4, 1, 8, 1, '군량 — 길 계절에 더해 챙길 수 있는 가장 많은 계절치', '계절'),
    councilSkipWin: k(0.9, 0.5, 1, 0.01, '출정 전 군막 — 아는 판세의 최악 승률이 이만큼 넘으면 저절로 열지 않는다 (형 11-11: 압도적이면 군사회의 없이)'),
    councilSkipAge: k(4, 0, 20, 1, '출정 전 군막 — 판세 정보가 이 계절 수보다 오래됐으면 압도적이어도 연다', '계절'),
    rationPack: k(0.5, 0, 3, 0.1, '챙기는 군량 — 병사 1명 계절치 (rationPerSoldier 배수)'),
    aiRationRich: k(4, 1, 10, 0.5, 'AI — 곡식이 군량 값의 이만큼 배는 있어야 넉넉히 챙긴다'),
    rationHungryMorale: k(0.08, 0, 0.3, 0.01, '군량이 떨어진 계절 — 사기 감산'),
    rationHungryLoss: k(0.05, 0, 0.3, 0.01, '군량이 떨어진 계절 — 사람이 빠지는 몫'),
    /** 계절에 막힌 길 (형: "불가능하게 만들지 말고 패널티 · 사전에 안내") */
    hardExtra: k(1, 0, 3, 1, '눈 덮인 고개·불어난 나루 — 더 걸리는 계절', '계절'),
    hardFrostLoss: k(0.08, 0, 0.4, 0.01, '눈 덮인 고개 — 얼어 잃는 사람 몫'),
    hardFloodLoss: k(0.06, 0, 0.4, 0.01, '불어난 나루 — 떠내려가 잃는 사람 몫'),
    hardMorale: k(0.06, 0, 0.3, 0.01, '막힌 길을 억지로 — 사기 감산'),
    /** 정찰이 본 병종의 몫 — 이 단위로 둥글린다 (intel seenMix: "궁수가 많다") */
    seenMixStep: k(0.1, 0.05, 0.5, 0.05, '정찰이 보는 병종 몫의 눈금'),
    /** 지형·성 — 방어측만 */
    fortPalisade: k(1.2, 1, 2, 0.05, '목책 방어 배수'),
    fortHigh: k(1.3, 1, 2, 0.05, '높은 터 방어 배수'),
    fortSanseong: k(1.6, 1, 3, 0.05, '산성 방어 배수'),
    fortMoat: k(1.15, 1, 2, 0.05, '해자 방어 배수 (겨울엔 언다 — 1)'),
    crossing: k(0.7, 0.3, 1, 0.05, '공격측 도하 중 배수'),
    /** 저격 X — 그 군대의 F 전체에 한 번만 (SYSTEMS §4-2). 다리는 X 가 아니라 생포로 간다 */
    snipeHead: k(0.7, 0.3, 1, 0.05, '저격 머리(사살) 배수'),
    snipeBody: k(0.85, 0.3, 1, 0.05, '저격 몸통(중상) 배수'),
    snipeDrum: k(0.85, 0.3, 1, 0.05, '저격 북(방어측만) 배수'),
    captureLegShot: k(0.35, 0, 1, 0.05, '저격 발 묶음 — 생포 가산'),
    captureBodyShot: k(0.15, 0, 1, 0.05, '저격 중상 — 생포 가산'),
    /** 장수 없이 보낸 척후의 략 — 들킬 확률을 셈할 때 */
    scoutRyak: k(3, 1, 10, 1, '척후의 략'),

    /** 길의 기습 은폐 (SYSTEMS §1-1) — 길 종류마다 바탕 */
    concealField: k(0.05, 0, 1, 0.01, '은폐: 들길'),
    concealPass: k(0.15, 0, 1, 0.01, '은폐: 고갯길 (외길이라 지키는 눈이 몰린다 — 2026-10-18 0.35→0.15)'),
    concealForest: k(0.4, 0, 1, 0.01, '은폐: 숲길(솔숲)'),
    concealReeds: k(0.45, 0, 1, 0.01, '은폐: 갈대 물가'),
    concealReedsWinter: k(0.15, 0, 1, 0.01, '은폐: 겨울 갈대 물가 (갈대가 눕는다)'),
    concealFord: k(0.1, 0, 1, 0.01, '은폐: 나루'),
    concealSea: k(0.1, 0, 1, 0.01, '은폐: 뱃길 (돛이 멀리서 보인다)'),
    concealMudflat: k(0.05, 0, 1, 0.01, '은폐: 갯벌 (트인 뻘)'),
    concealFog: k(0.2, 0, 0.5, 0.01, '안개골 — 봄·가을 은폐 가산'),
    /** 길과 때 (형이 고름: "길과 때의 싸움" — 2026-10-18) — 길의 꼬리표·겨울밤이 숨기를 돕는다 */
    concealEdgeTag: k(0.1, 0, 0.5, 0.01, '길에 갈대·솔숲·안개 꼬리표가 붙으면 은폐 가산'),
    concealWinterNight: k(0.1, 0, 0.5, 0.01, '겨울 — 밤이 길어 은폐 가산 (모든 길)'),
    concealGood: k(0.4, 0, 1, 0.01, '지도의 기습 길 — 이 은폐 이상이면 "좋다"'),
    concealFair: k(0.2, 0, 1, 0.01, '지도의 기습 길 — 이 은폐 이상이면 "보통" (아래는 "나쁘다")'),
    /** 행군 — 길 하나를 지나는 계절 수 (SYSTEMS §1-1 · §1-3) */
    marchSlow: k(2, 1, 4, 1, '고갯길·갯벌 행군', '계절'),
    marchSummerExtra: k(1, 0, 2, 1, '여름 장마 행군 가산 (달 시계는 7·8월에만 · 달)', '계절'),
    /**
     * 한 턴 = 한 달 (형 10-31: "지도에서 가까우면 실제로도 가까워야 함 · 왜군은 부산→한양 15~20일") — calendar.ts.
     * 새 판은 달 시계로 연다. 길마다 걸리는 달 = 지도 위 길이(km) ÷ marchMonthKm (반올림 · 적어도 1달 · 많아야 marchMonthMax)
     */
    monthClock: k(1, 0, 1, 1, '새 판을 달 시계로 연다 (1 = 한 턴 한 달 · 0 = 옛 한 턴 한 계절)'),
    monthShareStep: k(1, 0, 1, 1, '달 시계 — 징병·개척·이주·배치의 한 계절 몫이 달마다 1/3씩 차오른다 (1) · 첫 달에 다 쓸 수 있다 (0) · loop 리뷰: 첫 달에 다 쓰면 남은 두 달은 할 일이 없다'),
    marchMonthKm: k(25, 5, 100, 1, '달 시계 — 군대가 한 달에 가는 지도 위 길이 (영남 판 이웃 길 대개 한 달 · 가장 먼 길 석 달쯤)', 'km'),
    horseMarchShare: k(0.75, 0, 1, 0.05, '행군: 군대의 이만큼 넘게가 기병이면 뭍길이 빨라진다 (섞이면 보병에 맞춘다) · 형 11-05'),
    horseMarchCut: k(1, 0, 3, 1, '행군: 기병 군대가 뭍길에서 덜 걸리는 달 (적어도 한 달은 걸린다)'),
    marchMonthSlow: k(1.3, 1, 3, 0.1, '달 시계 — 고갯길·갯벌은 길이를 이만큼 길게 친다 (11-01 1.5 → 1.3: 마한 원산성↔금현성 47km 고개가 석 달이었다)'),
    marchMonthSea: k(0.4, 0.1, 1, 0.05, '달 시계 — 뱃길은 길이를 이만큼 짧게 친다 (형 11-01: "바닷길로 가는 것도 의미 있게 빠르면 한 달")'),
    marchMonthMid: k(1, 0.5, 2, 0.05, '달 시계 — 판마다 한 달 길이 = 그 판 길 길이의 가운데 × 이 값 (형 11-01: "가까운 건 바로 다음 달" · 넓은 판도 이웃은 한 달)'),
    marchMonthMax: k(4, 1, 12, 1, '달 시계 — 길 하나가 걸리는 가장 긴 달 (넓은 판의 먼 길도 이 위로는 안 간다)', '달'),
    marchLongAt: k(2.5, 1, 6, 0.1, '달 시계 — 길 하나는 한 달 · 그 판 보통 길 길이의 이 배를 넘는 먼 길만 두 달부터 (형 11-05: "존나 가까운데 왜 2달이나" · 군대는 하루 20~30리 · 한 달이면 웬만한 이웃은 닿는다)'),
    marchChainSpan: k(1.3, 0, 3, 0.05, '달 시계 — 먼 갈 곳으로 갈 때 한 달에 이어 걷는 길들의 합 (그 판 보통 길의 이만큼 배 · 지도에서 가까운 곳만 한 달에 · 형 11-05)'),
    aiMarchEvery: k(3, 1, 6, 1, '달 시계 — AI 가 출정·다가가기를 정하는 박자 (달). 3 이면 계절마다 한 번 · 1 이면 달마다', '달'),
    /**
     * 둘째 물결 (loop 리뷰 #5 · 11-01: 같은 고을로 오던 원군이 달을 달리해 닿아 하나씩 따로 싸웠다 — 싸움 화면·보고가 두 번) —
     * 고을에 싸움이 붙으면, 같은 고을로 오던 군대 가운데 이 달 수 안에 닿을 것은 이 싸움에 늦게 붙는다 (season.fight 의 원군 · reliefRound).
     * 치는 쪽은 같은 나라 군대 · 지키는 쪽은 그 고을 주인과 한편인 군대. 에워싸인 고을이 원군이 올 때까지 버틴다
     */
    reliefReach: k(1, 0, 3, 1, '달 시계 — 싸움이 붙은 고을로 오던 군대가 이 달 수 안에 닿을 것이면 그 싸움에 원군으로 붙는다 (0 이면 같은 달에 닿은 것만)', '달'),
    /**
     * 출정 달 어긋내기 · 칠 채비 (loop 리뷰 11-01: 우리를 친 싸움의 85% 가 그 앞 달에 길 위에 없던 군대였다 — 모두가 계절 첫 달에 한 달 길로 왔다).
     * 나라마다 제 출정 달(시드와 나라 이름으로 정한 0..aiMarchEvery-1)이 있다 · 플레이어 고을을 한 달 길로 칠 땐 한 달 먼저 제 자리에 모인다 (Army.strike)
     */
    aiMarchStagger: k(1, 0, 1, 1, '달 시계 — 나라마다 출정 달을 다르게 (1 켬 · 0 이면 모두 계절 첫 달)'),
    aiStrikeWarn: k(1, 0, 1, 1, '달 시계 — AI 가 플레이어 고을을 한 달 길로 치기 전에 한 달 모여 채비한다 (1 켬 · 지도에 「다음 달 친다」)'),
    aiStrikeCallOff: k(0.15, 0, 1, 0.05, '달 시계 — 채비하는 사이 그 길의 승률(가운데)이 이만큼 떨어지면 치지 않고 거둔다 (우리가 지킬 군대를 보내면)'),
    /**
     * 싸움의 끝맺음 (FOCUS C · 형: "400, 300, 200 계속 옴, 섬멸 안 됨") — 달 시계 판만 (옛 판은 그대로).
     * 진 군대는 싸움에서 잃은 것 말고도 흩어진다(도망병) · 남은 사람이 너무 적으면 다 흩어진다 · 물러날 곳이 없으면 섬멸 (season.scatterBeaten).
     * 연달아 진 AI 나라는 몇 계절 새 출정을 쉰다 · AI 징병은 싸움에서 잃은 사람만큼 덜 뽑는다 (rout.ts)
     */
    scatterLose: k(0.2, 0, 0.8, 0.05, '달 시계 — 진 군대가 싸움 뒤 흩어져 더 잃는 몫 (도망병 · 싸움에서 잃은 것 말고)'),
    scatterRouted: k(0.35, 0, 0.9, 0.05, '달 시계 — 무너져 진 군대가 흩어져 더 잃는 몫'),
    scatterFloor: k(40, 0, 200, 5, '달 시계 — 흩어지고 남은 사람이 이보다 적으면 군대가 다 흩어진다', '명'),
    wipeCapture: k(0.5, 0, 1, 0.05, '달 시계 — 물러날 곳이 없어 섬멸된 군대의 장수가 사로잡히는 가늠 (아니면 다쳐서 빠져나온다)'),
    // 영남 planner 200판: 2번·2계절 → 싸움 7.19/판 · 2번·4계절 → 6.88 · 1번·2계절 → 6.49 · 1번·3계절 → 6.17 (master 8.98 · docs/BALANCE.md 11-01 끝맺음)
    beatenStreak: k(2, 1, 6, 1, '달 시계 — AI 나라가 이만큼 연달아 지면 새 출정을 쉰다 (막혀 물러난 공격도 진 것으로 센다 · 1 이면 한 번 져도)', '번'),
    beatenRest: k(2, 0, 8, 1, '달 시계 — 연달아 진 AI 나라가 새 출정을 쉬는 계절 (그 계절 끝부터)', '계절'),
    warDeadHeal: k(0.25, 0, 1, 0.05, '달 시계 — AI 징병: 싸움에서 잃은 사람 장부가 계절마다 아무는 몫 (장부만큼 나라 군사 상한이 준다)'),
    kmPerLon: k(111.32, 100, 120, 0.01, '경도 1도의 길이 (적도에서 · 위도로 줄인다)', 'km'),
    kmPerLat: k(110.57, 100, 120, 0.01, '위도 1도의 길이', 'km'),

    /** 장정 — 군대 없는 고을도 그 고을 사람들이 지킨다 (SYSTEMS §4-6 · FLOW §2). 창병 · 청동 · 장수 없음. 가호에 비례 */
    // 사람의 단위 (형 2026-10-19: "한 고을마다 거의 십수명대 있는게 맞아? … 5명으로 무슨 고을을 어떻게 지켜") —
    // 『삼국지』 동이전: 변진 큰 나라 4~5천 가 · 작은 나라 6~7백 가, 마한 큰 나라 만여 가. 한 가(家)는 다섯 식구 남짓.
    // 장정은 그 집들의 사내가 나와 막는 것 — 집 둘에 하나꼴. 대신 갑옷도 진형도 없어 한 사람 한 사람은 약하다(militiaMorale).
    militiaPerHH: k(0.5, 0, 1.5, 0.01, '장정: 가호 하나당 나와 막는 사내 (집 둘에 하나꼴)'),
    militiaMorale: k(0.25, 0.05, 1, 0.01, '장정의 싸움 힘 — 농사꾼이라 갑옷·진형·훈련이 없다 (사기 자리에 곱한다)'),
    peoplePerHH: k(5, 3, 8, 0.5, '가호 하나의 식구 — 화면의 "사람" 수 (동이전 가·구 셈)'),
    militiaFortMul: k(2, 1, 4, 0.1, '장정: 산성은 이만큼 곱한다 (사람은 적고 성은 높다)'),
    militiaCapitalMul: k(1.5, 1, 4, 0.1, '장정: 국읍은 이만큼 곱한다 (나라가 무너지는 자리라 다 나와 막는다)'),

    /** 고을 살림 (FLOW §1·§2 · SYSTEMS §7-6 의 최소판) */
    harvestPerHH: k(0.15, 0, 1, 0.005, '(사람 눈금 ×4 — 옛 0.6) 가을 수확: 봄에 심은 가호 하나당 국읍 창고로 드는 곡식'),
    hhGrowth: k(0.015, 0, 0.1, 0.005, '가호가 계절마다 느는 몫 (곡식이 있고 싸움이 없을 때) — 0.01 은 너무 느렸다 (형: "집은 어떻게 늘리고")'),
    hhHunger: k(0.03, 0, 0.2, 0.01, '곡식이 바닥난 나라의 가호가 계절마다 주는 몫'),
    hhLossOnTake: k(0.15, 0, 0.5, 0.01, '고을을 뺏기면 가호가 이만큼 흩어진다'),
    hungerMorale: k(0.15, 0, 0.5, 0.01, '곡식이 바닥나면 군대 사기가 계절마다 이만큼 준다'),
    hungerFlee: k(0.06, 0, 0.3, 0.01, '곡식이 바닥난 계절에 군대에서 이만큼의 군사가 흩어진다 (사기만 깎이던 것 · 카드 A 11-11)'),
    hungerFleeMin: k(40, 1, 500, 1, '굶주려 흩어지는 군대의 바닥: 이만큼 이상인 군대만 (작은 군대는 안 흩어진다)', '명'),
    fedMorale: k(0.05, 0, 0.3, 0.01, '창고가 넉넉하면 꺾인 사기가 계절마다 이만큼 돌아온다 (1 까지)'),
    fedMoraleStock: k(3, 1, 10, 1, '넉넉하다 = 군량을 치르고도 이만큼 계절치가 남았다', '계절'),
    moraleFloor: k(0.5, 0.1, 1, 0.05, '사기 바닥'),
    moraleMax: k(1.2, 1, 2, 0.05, '사기 천장 (가을 제사로 1 을 넘을 수 있다)'),
    /** 막아낸 싸움 (형 10-31) — 지킨 쪽 사기 + · 성벽(목책·해자 등) 안이면 더 · 물러난 쪽 사기 - */
    holdMorale: k(0.1, 0, 0.5, 0.05, '사기: 막아내면 지킨 군대에 더한다'),
    wallHoldMorale: k(0.05, 0, 0.3, 0.05, '사기: 성벽 안에서 막아내면 더 더한다'),
    repelMorale: k(0.1, 0, 0.5, 0.05, '사기: 막혀 물러난 군대에서 뺀다'),
    mapFogSafeScale: k(0.125, 0.05, 0.5, 0.025, '지도: 갤럭시 호환 모드에서 안개 가장자리를 미리 그려 두는 그림판 크기(판에 대한 비)'),
    mapCanvasCapTouch: k(2048, 1024, 4096, 256, '지도 캔버스: 손가락 화면(폰)에서 정적 땅·길·안개 그림판의 긴 쪽 픽셀 한도 — 폰 그래픽 메모리를 지킨다', 'px'),
    mapCanvasCap: k(4096, 2048, 8192, 256, '지도 캔버스: 그 밖 화면에서 정적 땅·길·안개 그림판의 긴 쪽 픽셀 한도', 'px'),
    mapCanvasRedrawRatio: k(1.6, 1.1, 4, 0.1, '지도 캔버스: 보이는 가로가 마지막 그린 때보다 이만큼 배 넘게 커지거나 줄면 다시 그린다(선명함·국경 굵기)'),
    mapCanvasRedrawMs: k(250, 50, 1000, 50, '지도 캔버스: 배율이 굳은 뒤 다시 그리기까지 기다리는 시간', 'ms'),
    mapBandLazyMs: k(60, 0, 500, 10, '지도: 다음 달에 나라 땅 안쪽 띠를 새로 굽기까지 미루는 시간(ms) — 그린 뒤 한숨 돌려 구워 한 번의 긴 작업을 둘로 가른다'),
    mapBandBakeScale: k(0.175, 0.15, 1, 0.05, '지도: 나라 땅 안쪽 띠를 미리 구워 둘 그림판 크기(판에 대한 비) — 작을수록 가볍고 흐리다'),
    /** 국경 굵기는 화면 px — 확대·축소와 상관없이 같다 (FOCUS H · 형: "국경이 줌마다 꼬이고 작으면 사라짐") */
    mapBorderPx: k(6, 1, 14, 0.5, '지도: 나라 국경의 제 빛 선 굵기(화면 px) — 제 땅 안쪽으로 반만 보인다', 'px'),
    mapBorderInkPx: k(1.4, 0.5, 4, 0.1, '지도: 나라 사이 먹선 굵기(화면 px)', 'px'),
    mapTownLinePx: k(1.1, 0.5, 3, 0.1, '지도: 같은 나라 고을 사이 점선 굵기(화면 px)', 'px'),
    mapTownDashPx: k(5, 2, 12, 0.5, '지도: 같은 나라 고을 사이 점선의 한 마디(화면 px) — 틈은 0.8배', 'px'),
    mapMyEdgePx: k(8, 2, 16, 0.5, '지도: 우리 땅 둘레 겹선의 바깥 남색 굵기(화면 px) — 파랑은 0.6배 · 흰 심은 0.2배', 'px'),
    /**
     * 줌 단계별 이름표 (FOCUS G · 형: "이름표가 줌과 상관없이 고정 → 멀리서 이름표만 보임") — 배율을 칸을 꽉 채우는 배율(cover)로 나눈 값으로 가른다.
     * 멀리 = 고을 이름 대신 나라 이름만 크게 · 중간 = 도읍·우리 고을 (빽빽한 판) · 가까이 = 전부. 고른 고을·위협받는 고을은 늘 보인다
     */
    mapZoomMidAt: k(0.99, 0.5, 1.5, 0.01, '지도: 배율이 cover 의 이 배 아래면 「멀리」 — 고을 이름 대신 나라 이름만 (처음 여는 배율이 1 이라 「중간」 · 폰 세로는 가장 멀리 봐도 1 언저리라 1 바로 밑)'),
    mapZoomNearAt: k(1.45, 1, 3, 0.05, '지도: 배율이 cover 의 이 배 이상이면 「가까이」 — 모든 고을 이름 · 특산 칸 · 길 기호'),
    mapZoomMaxTouch: k(3.2, 1.5, 6, 0.1, '지도: 폰에서 가장 크게 볼 수 있는 배율 (cover 의 배 · PC 는 2.2 · 형 11-11: 확대가 더 안 돼 부대가 이름표와 겹쳐 못 누름)'),
    mapLodNearPx: k(120, 40, 300, 5, '지도 간소화: 보이는 고을 하나가 차지하는 화면 한 변이 이 px 이상이어야 「가까이」 (모든 것) · docs/realm/MAP-LOD.md', 'px'),
    mapLodMidPx: k(72, 20, 200, 2, '지도 간소화: 이 px 아래면 「멀리」 (나라 이름·도읍·지킬 곳만) · 그 사이는 「중간」', 'px'),
    mapLodHyst: k(0.08, 0, 0.3, 0.01, '지도 간소화: 단계 경계에서 깜빡이지 않게 지금 단계 쪽으로 끄는 몫'),
    mapNationNamePx: k(17, 10, 30, 1, '지도: 멀리 볼 때 나라 이름 글씨 크기(화면 px) — 배율과 상관없이 같다', 'px'),
    recTabMax: k(2, 1, 6, 1, '아래 탭 「추천」 딱지를 한 번에 몇 개까지 (형 10-29 · 문명)'),
    // 장수·열전 추천 점 (형 11-18 「튜토리얼에 너무 배우는 게 많은데 · 장수랑 열전에 추천 표시 자주 · 각성 조건 달성되면 무조건」 · ui/realm/recommend.ts)
    recHeroMax: k(2, 1, 4, 1, '추천 점: 한 번에 추천하는 장수 수 (각성 조건 달성은 이 수와 상관없이 늘 뜬다)'),
    recQuietTurns: k(1, 1, 6, 1, '추천 점: 「한 번 들어가 본」 가벼운 추천(안 싸워 본 장수 · 열전 금)이 이만큼 턴 동안 꺼진다'),
    recShopMul: k(1, 0.5, 5, 0.5, '추천 점: 열전 금이 가장 싼 다음 강화 값의 이만큼 배가 쌓이면 상점 추천'),
    recPulseMs: k(1100, 400, 3000, 50, '추천 점: 금빛 맥박 한 번의 길이(ms)', 'ms'),
    recBurstMs: k(650, 200, 1500, 50, '추천 점: 누르면 터지는 금빛 고리·불티가 머무는 시간(ms)', 'ms'),
    // 장수 열전은 장수마다 본편 한 달에 이만큼 (형 11-19 「한 달에 장수들 열전 다 하고 다음 달」 · realm/raid-month.ts · 옛 계절 시계 판은 한 계절에)
    raidPerMonth: k(1, 1, 5, 1, '장수 열전: 본편에서 한 장수가 한 달(턴)에 출전할 수 있는 횟수 · 출전 단추를 눌러 판이 시작될 때 센다'),
    // 11-22 형 「열전은 한 달에 한 캐릭터만 한 번」 — 장수 전체에서 한 달에 이만큼 (그 한 번은 지도 위 열전 표적 · realm/raid-bounty.ts)
    raidMonthAll: k(1, 1, 10, 1, '장수 열전: 본편 한 달(턴)에 장수 전체가 출전할 수 있는 횟수 · 그 한 번은 지도 위 열전 표적', '번'),
    raidBountyGrain: k(120, 0, 2000, 10, '열전 표적을 깨면 곳간에 드는 곡식 (판 크기 realmScale 를 곱함)'),
    raidBountyIron: k(30, 0, 500, 5, '열전 표적을 깨면 곳간에 드는 쇠 (판 크기 realmScale 를 곱함)'),
    raidPacifyMonths: k(6, 1, 36, 1, '열전 표적을 깬 고을이 「평정」 깃발을 달고 표적에서 빠지는 달 수', '달'),
    attackWarnWin: k(0.4, 0.1, 0.7, 0.05, '출정 확인 — 보이는 최악 승률이 이 밑이면 「승산이 N%뿐입니다. 그래도 치시겠습니까?」를 한 번 묻는다 (PLAYTEST-1112 TOP 1: 5판 모두 큰 패배로 접었다)'),    idleRecSeasons: k(3, 1, 8, 1, '판을 바꾸는 명령 없이 이만큼 계절이 지나면 추천 딱지를 셋까지 늘려 할 일을 권한다 (PLAYTEST-1112 TOP 2)'),    idleArmyMen: k(400, 100, 2000, 50, '이만큼 이상의 군대가 한 고을에서 idleRecSeasons 계절 놀면 「군사 N명이 놀고 있습니다」를 권한다 (PLAYTEST-1112 TOP 2)'),
    mapAskEveryS: k(10, 4, 40, 1, '지도: 할 일 없는 우리 군대 위 「명령?」이 몇 초마다 한 번 2초쯤 떴다 사라지나 (군대마다 때가 어긋난다)'),
    mapMoraleLow: k(0.8, 0.3, 1.2, 0.05, '지도: 군대 말 밑 사기 막대가 이 밑이면 붉은 주황으로'),
    mapHoldMs: k(320, 150, 1200, 10, '지도: 군대 말을 이만큼(ms) 꾹 누르면 설명 창이 뜬다 · 짧게 누르면 고르기'),
    mapHoldSlop: k(10, 4, 40, 1, '지도: 꾹 누르는 동안 이만큼(px) 넘게 움직이면 끌기로 보고 접는다'),
    mapHoldLingerMs: k(900, 0, 3000, 50, '지도: 손을 뗀 뒤 설명 창이 더 떠 있는 시간(ms)'),
    mapRingR: k(66, 40, 110, 2, '지도: 고을을 누르면 둘레에 뜨는 단추가 고을 가운데서 떨어진 거리(px)'),
    mapRingArc: k(150, 90, 340, 10, '지도: 둘레 단추가 퍼지는 부채꼴 각도(도) · 위쪽 가운데를 중심으로'),
    mapRingStep: k(44, 20, 90, 1, '지도: 둘레 단추 하나마다 벌어지는 각도(도) — 단추가 많으면 부채가 넓어진다'),
    mapRingArcMax: k(250, 150, 340, 10, '지도: 둘레 부채의 가장 넓은 각도(도)'),
    mapRingGap: k(54, 40, 90, 1, '지도: 이웃 둘레 단추 가운데 사이의 가장 짧은 거리(px) — 단추 46px + 틈'),
    mapRingEdgePad: k(10, 0, 60, 1, '지도: 둘레 단추가 화면 가장자리(위·아래 띠 포함)에서 떨어질 틈 — 밖이면 그만큼 지도를 민다', 'px'),
    mapRoadStub: k(0.42, 0, 1, 0.01, '지도: 한 끝만 아는 길은 아는 쪽에서 이만큼(길이 비율)까지 보인다 — 옆 고을은 몰라도 길이 나 있는 건 보이게 (형 11-04: 거창 위로 길이 있는지 아예 안 보여)'),
    mapRoadStubFade: k(0.6, 0, 1, 0.05, '지도: 한 끝만 아는 길의 앞 몇 할은 또렷하고 그 뒤는 흐려진다 — 또렷한 몫'),
    mapRoadStubOp: k(0.8, 0, 1, 0.05, '지도: 한 끝만 아는 길의 진하기 (흐린 꼬리는 이것의 반)'),
    townZoomMs: k(560, 100, 2000, 10, '마을 안: 카메라가 지도 속 그 고을로 파고드는 시간 — 지도가 그 고을을 축으로 커지며 어두워지고, 그 끝에 마을 안이 다가온다 (형 11-05: "카메라가 마을로 들어가는 연출 · 마을 혼자 커지면 안 된다")', 'ms'),
    townFadeMs: k(380, 50, 1500, 10, '마을 안: 마을 판이 다가오며 밝아지는 시간 · 나갈 때 지도가 그 고을에서 물러나는 시간', 'ms'),
    townDiveScale: k(5, 1.5, 12, 0.5, '마을 안: 파고들 때 지도가 그 고을을 축으로 커지는 배율 (나갈 땐 이 배율에서 물러난다)', '배'),
    townBoardFrom: k(0.84, 0.5, 1, 0.01, '마을 안: 마을 판이 다가올 때의 첫 크기 — 1 이면 다가오지 않고 밝아지기만', '배'),
    townHHPerWalker: k(30, 5, 200, 1, '마을 안: 집 몇 채에 일하는 사람 하나가 보이나 (가구 수에 맞춰 일손이 저절로 · 형 11-04)'),
    townWalkMin: k(2, 0, 10, 1, '마을 안: 일하는 사람 가장 적게'),
    townWalkMax: k(14, 1, 40, 1, '마을 안: 일하는 사람 가장 많이 (폰 그리기 몫)'),
    townCheerMs: k(700, 100, 3000, 50, '마을 안: 짓는 터를 톡톡 누르면 일꾼들이 더 빨리 두드리는 동안 (손맛만 · 판은 안 바뀐다)', 'ms'),
    townCheerPuffs: k(6, 0, 20, 1, '마을 안: 톡톡 누를 때 터지는 흙먼지 수'),
    townStampMs: k(2600, 500, 8000, 100, '마을 안: 「완공!」 도장이 머무는 시간 (누르면 바로 걷힌다)', 'ms'),
    pinChimeRates: [1.25, 1.5, 1.9] as readonly number[], // 협공 짝 방울 — 셋이 점점 높게 (뾰로로롱 · 형 11-05)
    pinChimeGapMs: k(85, 20, 400, 5, '협공 짝 방울 사이 (ms)', 'ms'),
    pinChimeVol: k(0.45, 0, 1, 0.05, '협공 짝 방울 크기'),
    haulCoinVol: k(0.55, 0, 1, 0.05, '주인 없는 철광·포구에서 거둔 달 · 엽전 소리 크기 (형 11-05: "소리로든 눈에 쌓이는 게 보이든")'),
    mapRingSettleMs: k(260, 0, 1000, 10, '지도: 둘레 단추가 다 튀어나오는 시간 — 그 뒤에 화면 안으로 민다', 'ms'),
    mapBottomRoom: k(170, 0, 400, 5, '지도: 아래 띠(할 일·다음 달·보기/＋/－) 높이만큼 더 굴릴 여백(px) — 남쪽 끝 고을을 띠 위로 끌어올린다', 'px'),
    mapRingStaggerMs: k(45, 0, 200, 5, '지도: 둘레 단추가 하나씩 퐁 튀어나오는 간격(ms)'),
    denyPopMs: k(2500, 600, 8000, 100, '못 하는 단추를 눌렀을 때 까닭 한 줄이 떠 있는 가장 짧은 시간(ms) · 글이 길면 noticePerCharMs 만큼 더'),
    noticeMinMs: k(3500, 1000, 10000, 100, '떴다 걷히는 알림이 머무는 가장 짧은 시간(ms)'),
    loadBarMapShare: k(0.5, 0.1, 0.9, 0.05, '받는 막대: 지도 바탕(몇 초 걸린다)이 차지하는 몫 · 나머지를 그림들이 나눈다 (ui/realm/loadbar.ts)'),
    loadBarMapExpectMs: k(3000, 500, 15000, 250, '받는 막대: 지도 바탕을 짓는 데 걸릴 듯한 시간 — 이만큼 지나면 그 몫의 2/3 쯤 찬다', 'ms'),
    loadBarImgExpectMs: k(500, 50, 5000, 50, '받는 막대: 그림 한 장을 받는 데 걸릴 듯한 시간', 'ms'),
    loadBarCreepMax: k(0.92, 0.5, 0.99, 0.01, '받는 막대: 안 끝난 일이 시간만으로 찰 수 있는 몫의 끝'),
    loadBarEase: k(0.12, 0.02, 0.5, 0.01, '받는 막대: 보이는 막대가 목표를 따라가는 빠르기 (프레임마다 남은 차이의 이만큼)'),
    loadTipMinMs: k(3800, 1000, 12000, 100, '스플래시·판 들어갈 때 가림막이 가운데 한 줄(도움말·옛 기록)과 함께 머무는 가장 짧은 시간(ms) · 형 11-03: 읽을 수 있게'),
    loadTipPerCharMs: k(85, 20, 300, 5, '가림막 한 줄 글자 하나마다 더 머무는 시간(ms)'),
    loadTipMaxMs: k(7000, 2000, 15000, 100, '가림막이 한 줄 때문에 머무는 가장 긴 시간(ms) · 받기를 다 했으면 누르면 바로 걷힌다'),
    bootCardMs: k(1800, 400, 4000, 100, '부팅 카드 한 장(제작사 · 게임 로고)이 또렷이 머무는 시간(ms) · 들어오고 나가는 fade 는 따로(bootFadeMs) · 아무 데나 누르면 바로 건너뛴다 (형 11-11: 1200 은 너무 빨랐다)', 'ms'),
    bootFadeMs: k(500, 100, 1500, 20, '부팅 카드가 부드럽게 나타나고 사라지는 시간(ms) · 한 쪽 기준', 'ms'),
    // 시작 화면 「아무 키나 누르세요」 (ui/realm/startgate.ts · Codex 59-A · 형 11-21: "게임에 포장이 부족 · 인디는 기대감을 줄 만한 걸 많이")
    startKbSec: k(48, 10, 120, 1, '시작 화면: 키 아트가 천천히 다가갔다 물러나는 한 바퀴(초) · 길수록 느리다', 's'),
    startKbZoom: k(0.07, 0, 0.2, 0.01, '시작 화면: 가장 다가갔을 때 더 커지는 몫 (0.07 = 7%)'),
    startKbPan: k(0.35, 0, 1, 0.05, '시작 화면: 세로 화면에서 가로 그림이 옆으로 흐르는 너비(넘치는 폭의 몫) · 크면 양끝 사람 얼굴이 로고 밑으로 들어온다'),
    startFocusY: k(0.42, 0, 1, 0.01, '시작 화면: 그림을 위아래로 자를 때 기준 높이 (0 = 위 · 1 = 아래)'),
    startEmbers: k(64, 0, 200, 1, '시작 화면: 불티 낱알 수 (1280×720 기준 · 화면 넓이에 따라 늘고 준다 · 보통 단계는 반 · 저사양은 넷에 하나)'),
    startEmberPx: k(12, 3, 30, 1, '시작 화면: 불티 하나의 빛 지름(px) · 낱알마다 0.5~1.6배', 'px'),
    startEmberStretch: k(1.6, 1, 3, 0.1, '시작 화면: 불티가 오르는 쪽으로 길쭉한 몫 (1 = 동그랗다)'),
    startEmberRise: k(34, 5, 120, 1, '시작 화면: 불티가 오르는 빠르기(px/초) · 가까운 큰 것은 더 빠르다', 'px/s'),
    startEmberSway: k(12, 0, 40, 1, '시작 화면: 불티가 좌우로 흔들리는 폭(px)', 'px'),
    startWind: k(6, -40, 40, 1, '시작 화면: 불티를 옆으로 미는 바람(px/초) · 음수면 왼쪽', 'px/s'),
    startFps: k(30, 15, 60, 5, '시작 화면: 1초에 그리는 장 수 (배터리 · 느린 확대와 불티는 30 이면 충분 · 누른 뒤 걷히는 동안만 화면 빠르기대로)'),
    startMaxDpr: k(2, 1, 3, 0.25, '시작 화면: 캔버스 해상도 배수 상한 (보통 단계는 1.5 · 저사양은 1 까지)'),
    startBreatheMs: k(2600, 800, 6000, 100, '시작 화면: 「아무 키나 누르세요」가 옅어졌다 짙어지는 반 바퀴(ms)', 'ms'),
    startArmMs: k(350, 0, 2000, 50, '시작 화면: 스플래시가 걷히기 시작하고 이만큼은 누름을 받지 않는다(ms) · 스플래시를 누른 손이 바로 넘기지 않게', 'ms'),
    startSfxVol: k(0.55, 0, 1, 0.05, '시작 화면: 누를 때 북 소리 크기 (효과음 크기에 곱함)'),
    startFlashMs: k(520, 100, 1500, 20, '시작 화면: 누를 때 로고가 번쩍이며 퍼지는 시간(ms)', 'ms'),
    startExitDelayMs: k(240, 0, 800, 20, '시작 화면: 누른 뒤 걷히기 시작할 때까지(ms) · 번쩍임을 먼저 보인다 · 이것과 startFadeMs 의 합이 1초 안', 'ms'),
    startFadeMs: k(620, 200, 1500, 20, '시작 화면: 걷히며 로비가 드러나는 시간(ms)', 'ms'),
    startExitZoom: k(0.08, 0, 0.3, 0.01, '시작 화면: 걷히는 동안 그림이 더 다가가는 몫 (화면이 열리듯)'),
    startRestSec: k(90, 15, 600, 5, '시작 화면: 아무 움직임 없이 이만큼 지나면 그리기를 멈춘다(초 · 배터리) · 마우스를 움직이면 다시 돈다', 's'),
    openingSceneSec: [5, 6, 6, 5, 5, 6, 8, 5] as readonly number[], // 오프닝: 여덟 장면 각각의 길이(초) · 합 46초 (docs/realm/OPENING.md 표)
    openingFadeMs: k(500, 100, 2000, 50, '오프닝: 덮개가 걷히는 시간, 장면 안에서 그림이 바뀌는 이음(ms)', 'ms'),
    openingSceneFadeMs: k(700, 100, 2000, 50, '오프닝: 장면과 장면 사이 이음(ms)', 'ms'),
    openingFirstFadeMs: k(2500, 500, 5000, 100, '오프닝: 첫 장면이 어둠에서 밝아지는 시간(ms) · 1번 장면 「어둠에서 서서히」', 'ms'),
    openingFirstWaitMs: k(1500, 300, 5000, 100, '오프닝: 첫 그림을 기다려 주는 가장 긴 시간(ms) · 이 뒤엔 못 받았어도 시계를 시작한다', 'ms'),
    openingShakeAt: k(0.6, 0, 4, 0.1, '오프닝 5번(싸움): 화면이 한 번 흔들리는 때(장면 시작부터 초)', 's'),
    openingJitterAt: [1.2, 2.4, 3.6] as readonly number[], // 오프닝 6번(생포): 포승줄이 흔들리는 박자에 맞춘 작은 떨림 셋(장면 시작부터 초)
    openingSweepAt: k(1.4, 0, 4, 0.1, '오프닝 8번(로고): 청동 빛이 한 번 지나가기 시작하는 때(장면 시작부터 초)', 's'),
    openingSweepMs: k(1600, 400, 4000, 100, '오프닝 8번(로고): 청동 빛이 글자 위를 지나가는 시간(ms)', 'ms'),
    openingBedVol: k(0.38, 0.05, 1, 0.01, '오프닝 음악: 처음 깔리는 크기(배경음 슬라이더에 곱함) · 1 이 가장 크다'),
    openingSwellVol: k(0.8, 0.1, 1, 0.01, '오프닝 음악: 6~8번 장면에서 크게 울리는 크기(배경음 슬라이더에 곱함)'),
    openingSwellScene: k(5, 0, 7, 1, '오프닝 음악: 몇 번째 장면(0부터)에서 커지기 시작하나 · 5 = 6번 장면(생포)'),
    openingSwellSec: k(3, 0.5, 8, 0.5, '오프닝 음악: 커지는 데 걸리는 시간(초)', 's'),
    openingDuck: k(0.5, 0.1, 1, 0.05, '오프닝 음악: 내레이션이 나오는 동안 음악이 줄어드는 몫(1 = 줄이지 않음)'),
    openingDuckPerSec: k(3, 0.5, 10, 0.5, '오프닝 음악: 줄고 되돌아오는 빠르기(1초에 몇 배 따라가나)'),
    openingEndFadeSec: k(2.5, 0.5, 6, 0.5, '오프닝 음악: 끝나기 전 잦아드는 시간(초) · 건너뛰면 0.5초 안에', 's'),
    openingFlagPx: k(30, 16, 56, 1, '오프닝 3번: 나라 깃발 한 장의 크기(px · 폰 폭 390 기준)', 'px'),
    openingFlagSpan: k(0.78, 0.3, 0.95, 0.01, '오프닝 3번: 깃발이 다 켜지기까지가 장면 길이의 몇 할인가'),
    openingFlagWaves: k(6, 1, 12, 1, '오프닝 3번: 깃발이 남에서 북으로 몇 물결로 켜지나 · 물결 안에서는 거의 한꺼번에'),
    endingHeroMs: k(4000, 1500, 10000, 250, '끝맺음: 장 주인공 장면이 머무는 시간(ms) · 누르면 바로 크레딧으로', 'ms'),
    firstHintMs: k(6000, 2000, 20000, 100, '처음 한 번 알림(firsts.ts)이 머무는 가장 짧은 시간(ms) · 글이 길면 noticePerCharMs 만큼 더'),
    firstHintDelayMs: k(450, 0, 2000, 10, '다시 그린 뒤 처음 한 번 알림을 찾기까지(ms) · 판이 미끄러져 자리 잡은 뒤에'),
    firstHintTries: k(4, 0, 10, 1, '다시 그린 뒤 처음 한 번 알림을 몇 번 더 찾아볼까 · 판 속 카드는 조금 늦게 펼쳐진다'),
    raidHintFrom: k(3, 0, 36, 1, '처음 한 번 알림: 장수 열전 알림(장수 탭의 금빛 점)은 판 처음 이만큼 턴(달 시계면 달)이 지난 뒤에 · 첫 계절이 지나 판에 손이 익었을 때 (FIRST-HOUR-20261122 TOP 4)', '턴'),
    noticeBaseMs: k(2000, 0, 6000, 100, '알림 머무는 시간 = 이것 + 글자 수 × noticePerCharMs (ms)'),
    noticePerCharMs: k(90, 20, 300, 5, '알림 글자 하나마다 더 머무는 시간(ms) · 한 자 0.09초면 1초에 열한 자'),
    noticeMaxMs: k(14000, 4000, 30000, 500, '알림이 머무는 가장 긴 시간(ms)'),
    doneToastDelayMs: k(900, 0, 4000, 50, '완공 알림이 뜨기까지 — 달 넘김 장면이 먼저 보이게 (ms)'),
    /**
     * 「다음 달」 지도 연출 (turnplay.ts · 형 11-22: "본게임이 너무 정적 · 풀 뜯어먹는 기분") — 보고판보다 먼저 지도 위에서 한 달이 펼쳐진다:
     * 군대가 길을 걷고 → 싸움 불꽃과 그 결과(깃발 · 불 · 방패) → 거둔 것이 떠오르고 → 새 위협이 고리로 숨 쉰다. 누르거나 아무 키나 치면 바로 끝.
     * 그리기만 한다 (판은 이미 넘어갔다). 저사양 · 움직임 줄이기는 페이드만 하는 짧은 판
     */
    turnPlayback: k(1, 0, 1, 1, '「다음 달」 지도 연출 켬(1) · 끔(0) — 끄면 예전처럼 곧장 보고판'),
    tpSpeed: k(1, 0.5, 2.5, 0.1, '「다음 달」 지도 연출 빠르기 — 박자를 모두 이것으로 나눈다 (2 면 두 배 빠르게)'),
    tpLeadMs: k(150, 0, 1000, 10, '「다음 달」 지도 연출: 누른 뒤 첫 박자까지(ms)'),
    tpSeasonLeadMs: k(1700, 0, 3000, 50, '「다음 달」 지도 연출: 계절 띠가 뜬 달은 띠가 걷힐 때까지 기다린다(ms)'),
    tpWalkMs: k(1400, 400, 3000, 50, '「다음 달」 지도 연출: 군대가 이번 달 걸은 길을 걷는 시간(ms)'),
    tpWalkBackMs: k(900, 300, 2500, 50, '「다음 달」 지도 연출: 치다 물러난 군대가 돌아가는 시간(ms)'),
    tpStaggerMs: k(90, 0, 300, 10, '「다음 달」 지도 연출: 군대마다 떠나는 사이(ms)'),
    tpMaxWalkers: k(12, 1, 30, 1, '「다음 달」 지도 연출: 한 번에 걷는 군대 수 · 넘는 것은 그 자리에 바로 선다'),
    tpClashMs: k(800, 300, 2000, 50, '「다음 달」 지도 연출: 싸움 불꽃 하나가 터지고 사그라드는 시간(ms)'),
    tpClashGapMs: k(520, 150, 1500, 10, '「다음 달」 지도 연출: 싸움과 싸움 사이(ms)'),
    tpResultMs: k(380, 0, 1000, 10, '「다음 달」 지도 연출: 불꽃이 터진 뒤 결과(깃발 · 불 · 방패)가 서기까지(ms)'),
    tpGoodMs: k(1300, 400, 3000, 50, '「다음 달」 지도 연출: 거둔 것(+곡식 · +군사 …)이 떠올라 머무는 시간(ms)'),
    tpGoodGapMs: k(260, 50, 800, 10, '「다음 달」 지도 연출: 거둔 것 하나와 다음 사이(ms)'),
    tpMarkMs: k(1000, 300, 2500, 50, '「다음 달」 지도 연출: 새 위협 고리가 숨 쉬는 시간(ms)'),
    tpMarkGapMs: k(200, 0, 800, 10, '「다음 달」 지도 연출: 위협 고리 하나와 다음 사이(ms)'),
    tpTailMs: k(250, 0, 1000, 10, '「다음 달」 지도 연출: 마지막 박자 뒤 보고판까지(ms)'),
    tpMaxMs: k(6000, 2000, 12000, 250, '「다음 달」 지도 연출의 가장 긴 시간(ms) — 넘으면 박자를 고르게 줄인다'),
    tpQuietMs: k(700, 0, 2000, 50, '「다음 달」 지도 연출: 지도에 보일 일이 없는 달의 쉼(ms)'),
    tpShortMs: k(900, 300, 2000, 50, '「다음 달」 지도 연출: 저사양 · 움직임 줄이기의 짧은 판(페이드만 · ms)'),
    tpClashVol: k(0.35, 0, 1, 0.05, '「다음 달」 지도 연출: 싸움 불꽃 소리 크기'),
    noticeBigMs: k(6000, 2000, 15000, 100, '크게 뜨는 한 줄 알림(승리가 가깝다 · 적이 가깝다)이 머무는 가장 짧은 시간(ms)'),
    loopVolume: k(0.6, 0, 1, 0.05, '숨 쉬는 각성 영상에 든 음악·효과음의 크기 (형 11-05: 같이 들려도 좋다)'),
    winAheadMs: k(400, 100, 3000, 50, '「다음 달」의 승리 표 — 명령을 바꾸고 이만큼 멈추면 한 달을 미리 넘겨 본다 (형 11-05)', 'ms'),
    nextLockMs: k(1200, 200, 4000, 100, '「다음 달」을 누른 뒤 단추가 잠기는 시간(ms) — 넘기느라 멈춘 사이 쌓인 누름까지 버린다'),
    warnYesMs: k(380, 100, 1200, 20, '승산 낮은 출정 확인 — 「그래도 친다」가 눌린 채 금빛 ✓ 로 머문 뒤 출정하기까지(ms)'),
    mapWalkSize: k(0.42, 0.15, 1, 0.01, '지도: 길 위를 걷는 백성(짐꾼) 그림 크기 — 고을 그림 너비의 몫'),
    mapWalkSpeed: k(0.03, 0.005, 0.2, 0.005, '지도: 걷는 백성이 1초에 가는 거리 — 지도 너비의 몫'),
    mapWalkMinS: k(2.5, 0.5, 10, 0.5, '지도: 걷는 백성이 한 길을 가는 데 걸리는 가장 짧은 시간(초) · 짧은 길에서 너무 빨리 뛰지 않게'),
    mapWalkStepS: k(0.95, 0.3, 2, 0.05, '지도: 이주민 걷기 그림띠 8컷 한 바퀴(초) — 두 걸음'),
    gainPopMs: k(4500, 1000, 12000, 100, '고을을 얻거나 새 마을이 섰을 때 「획득!」 판이 떠 있는 가장 짧은 시간(ms) · 글이 길면 더'),
    gainChipMs: k(220, 50, 600, 10, '「획득!」 판의 생산품이 하나씩 튀어나오는 간격(ms) · 엽전 소리도 이 박자'),
    gainWaitMs: k(400, 100, 2000, 50, '「획득!」 판이 보고·장면이 걷히기를 다시 보는 간격(ms)'),
    /**
     * 소도 제사 (형: "소도는 왜있는거고?" — 2026-10-18) — 「常以五月下種訖祭鬼神…十月農功畢亦復如之」.
     * 소도와 길로 맞닿은 고을을 쥔 나라만, 봄·가을에. 봄은 그해 수확, 가을은 군대 사기.
     */
    riteGrain: k(40, 0, 300, 5, '봄 제사 곡식의 바닥 (riteSpringShare 몫이 이보다 작아도 이만큼)'),
    riteHarvest: k(0.25, 0, 1, 0.05, '봄 제사 — 그해 가을 수확 가산 몫'),
    riteMorale: k(0.15, 0, 0.5, 0.01, '가을 제사 — 모든 군대 사기 가산'),
    /** 화친·동맹을 맺으면 얻는 것 (형: "화친이랑 동맹도 되면 뭐가 되는건지 모르겠네") */
    truceTrade: k(5, 0, 50, 1, '장터 — 화친·동맹인 두 나라가 계절마다 저마다 얻는 곡식'),
    aiAllyFocus: k(0.1, 0, 0.5, 0.01, 'AI — 동맹과 전쟁 중인 나라의 고을을 이만큼 더 쳐 볼 만하게 본다'),
    /**
     * 남의 나라가 거는 청 (형: "적이 뭔가 거래를 걸어온다거나 동맹요구하거나 그런거 없어?" — 2026-10-18).
     * 계절 끝에 나라마다 aiAskChance 로 플레이어에게 하나. 플레이어가 받는 것은 계절에 askMaxPerSeason 까지.
     */
    aiAskChance: k(0.07, 0, 1, 0.01, 'AI — 한 계절에 플레이어에게 청을 걸 확률 (나라마다)'),
    askMaxPerSeason: k(2, 0, 6, 1, '플레이어가 한 계절에 받는 청의 상한', '개'),
    askTributeShare: k(0.15, 0, 0.5, 0.01, '조공을 바칠 때 제 곡식의 몫'),
    askDemandShare: k(0.25, 0, 0.6, 0.01, '조공을 요구할 때 플레이어 곡식의 몫'),
    askDemandPower: k(1.6, 1, 4, 0.1, '요구 — 그쪽 힘이 우리의 이만큼 배는 돼야 내놓으라 한다'),
    askTributePower: k(1.8, 1, 4, 0.1, '바침 — 우리 힘이 그쪽의 이만큼 배는 돼야 바친다'),
    askTradeIron: k(15, 1, 100, 1, '맞바꿈 제안의 철 몫'),
    aiEnvoyChance: k(0.15, 0, 1, 0.01, 'AI — 한 계절에 다른 AI 나라에 사신을 보낼 확률'),
    /** 기습 낌새 · 경계 강화 (형: "기습에 대비하거나 우리가 경계를 강화하거나") */
    suspectBase: k(0.35, 0, 1, 0.05, '우리 고을로 오는 기습을 낌새챌 바탕 확률'),
    suspectPerAlert: k(0.8, 0, 2, 0.05, '경계 1 당 낌새챌 확률 가산'),
    suspectPerRyak: k(0.04, 0, 0.2, 0.01, '기습하는 장수의 략 1 당 낌새챌 확률 감산'),
    guardGrain: k(15, 0, 200, 1, '경계 강화에 드는 곡식'),
    guardAlert: k(0.3, 0, 0.6, 0.01, '경계 강화로 오르는 경계'),
    /**
     * 공작 (plots.ts, 형: "다양한 외교나 공작이 가능 해야하는거 아님?" — 2026-10-18)
     * 먹힐 확률 = 바탕(op) + plotPerRyak × (우리 최고 략 − 그 나라 최고 략) − plotAlertWeight × 고을 경계(매수·첩자) → [plotMin, plotMax]
     */
    // 보낼 사람(hands)이 먼저 막는다 — 이것은 사람이 아주 많을 때의 바닥 없는 천장 (형 10-23: "보낼 수 있는 장수가 셋인데 왜 두 번밖에 안 되는지")
    plotsPerSeason: k(6, 0, 12, 1, '공작: 한 나라가 한 계절에 벌일 수 있는 수의 천장 (보통은 보낼 사람 수가 먼저 막는다)'),
    // 외교의 손 (VICTORY §2-2) — 사신·공작은 보낼 사람만큼: 군장의 사자 + 쉬는 장수
    handsBase: k(1, 0, 3, 1, '외교의 손: 군장의 사자 — 장수가 없어도 이만큼은 보낸다'),
    envoyHeldWar: k(0.15, 0, 1, 0.01, '전쟁 중인 나라에 사신으로 간 장수가 붙잡힐 확률'),
    // 맹주의 길 — 진왕 (VICTORY §1)
    tributeSeasons: k(8, 2, 20, 1, '조공을 바치기로 한 나라는 이만큼 조공국으로 남는다', '계절'),
    suzerainSeasons: k(4, 1, 12, 1, '맹주: 살아 있는 아는 나라 절반 넘게와 손잡은 채 이만큼 내리 버티면 이긴다', '계절'),
    suzerainMinVassals: k(1, 0, 5, 1, '맹주: 손잡은 나라 가운데 속국(조공국)이 이만큼은 있어야 — 동맹만으로는 진왕이 아니다'),
    suzerainMinPool: k(3, 1, 10, 1, '맹주: 셈할 나라가 이만큼은 있어야 (작은 판에서 둘과 손잡고 끝나지 않게)'),
    suzerainRumorShare: k(0.75, 0.3, 1, 0.05, '맹주: 남이 필요한 수의 이만큼에 닿으면 소문이 온다'),
    // 철과 뱃길 · 큰 제사 (paths.ts · VICTORY §1) — 문턱은 판의 나라 수에 비례
    /** 철과 뱃길 — 철광·포구를 둘 다 쥔 채 창고 철이 이만큼이면 이긴다 (형 10-30). 봇 판에서 철광이나 포구를 쥔 나라의 창고 철: 중간 50 안팎 · 상위 10% 는 24계절 220 · 32계절 300 · 300 이면 쇠의 바다에서 남이 철과 뱃길로 이기는 판 21% (AI 는 쌓기만 한다) → 450 이면 7% · 600 이면 0% (realm-paths 10-31) */
    ironseaStock: k(450, 50, 2000, 25, '철과 뱃길: 철광·포구를 쥔 채 쌓을 창고 철 (판의 철광 하나마다)', '덩이'),
    /** 낙동강(영남) 판만 — 타국 도읍을 멀리 두자(rivalGapHops 4) 아무도 안 건드리는 먼 나라가 철과 뱃길로 이긴 판이 28% → 44% (600판).
     *  봇 판 150판: 600 → 42% · 750 → 37% · 800 → 29% · 850 → 16% · 900 → 3% (40계절 안에 못 쌓는다). 삼한은 450 그대로(800 이면 0%) (10-31) */
    ironseaStockYeongnam: k(800, 50, 2000, 25, '철과 뱃길: 낙동강 판의 문턱 (판의 철광 하나마다)', '덩이'),
    riteChainNeed: k(4, 2, 8, 1, '큰 제사: 봄·가을 제사를 내리 이만큼 (넷 = 두 해)'),
    riteHHShare: k(0.38, 0.05, 1, 0.01, '큰 제사: 우리 집이 판의 모든 집 × 이것 ÷ √(나라 수/6) 이상이어야 — 판이 클수록 집 수는 많이, 몫은 조금 작게'),
    riteFairMul: k(3.5, 1, 5, 0.1, '큰 제사: 판의 모든 집 ÷ 나라 수 의 이만큼 배는 쥐어야 (여섯이면 6할 · 1.6 이면 낙동강 30% · 2.4 이면 삼한 33% 판을 남이 이겼다 · 빈 땅이 넓어 앞선 나라가 몫을 쉽게 넘는다)'),
    riteShareCap: k(0.85, 0.5, 1, 0.05, '큰 제사: 그래도 판의 모든 집의 이 몫보다 많이는 안 바란다'),
    pathRumorShare: k(0.75, 0.3, 1, 0.05, '철과 뱃길·큰 제사: 남이 문턱의 이만큼에 닿으면 소문이 온다'),
    // 0.75 — 큰 제사 사슬은 4칸이라 0.75 에서 1 로 곧장 뛴다: 0.8 이면 알림 없이 끝났다 (10-31)
    pathAlertShare: k(0.75, 0.5, 0.95, 0.05, '승리 조건: 우리가 넷 가운데 하나를 이만큼 채우면 화면에 한 번 크게 알린다 (형 10-26: "정복 중인데 철 모아서 승리했네")'),
    marketIron: k(3, 0, 20, 1, '장터: 철광을 쥔 나라가 철광 없는 화친·동맹 나라에 계절마다 파는 철'),
    marketIronPrice: k(4, 0, 20, 0.5, '장터: 철 하나의 곡식 값'),
    plotBaseRumor: k(0.6, 0, 1, 0.01, '공작 바탕 — 소문'),
    plotBaseSow: k(0.4, 0, 1, 0.01, '공작 바탕 — 이간'),
    plotBaseBribe: k(0.45, 0, 1, 0.01, '공작 바탕 — 매수'),
    plotBaseBurn: k(0.45, 0, 1, 0.01, '공작 바탕 — 방화'),
    plotBaseSpy: k(0.55, 0, 1, 0.01, '공작 바탕 — 첩자'),
    plotPerRyak: k(0.04, 0, 0.2, 0.01, '공작: 략 1 차이당'),
    plotAlertWeight: k(0.5, 0, 2, 0.05, '공작: 매수·첩자에서 고을 경계가 깎는 몫 (경계 × 이것)'),
    plotMin: k(0.05, 0, 0.5, 0.01, '공작 최소 확률'),
    plotMax: k(0.9, 0.5, 1, 0.01, '공작 최대 확률'),
    plotCaughtOnFail: k(0.5, 0, 1, 0.05, '공작이 실패하면 들킬 확률'),
    plotCaughtOnSuccess: k(0.1, 0, 1, 0.05, '공작이 먹혀도 들킬 확률'),
    plotGuessRyakLo: k(2, 1, 10, 1, '공작 셈: 모르는 그 나라 최고 략의 아래 끝'),
    plotGuessRyakHi: k(9, 1, 10, 1, '공작 셈: 모르는 그 나라 최고 략의 위 끝 (군주까지 치면 지략 8~9 가 있다)'),
    plotRumorGrain: k(20, 0, 300, 1, '소문에 드는 곡식'),
    plotSowGrain: k(30, 0, 300, 1, '이간에 드는 곡식'),
    plotBribeGrain: k(40, 0, 300, 1, '매수에 드는 곡식'),
    plotBribeIron: k(10, 0, 100, 1, '매수에 드는 철'),
    plotBurnGrain: k(25, 0, 300, 1, '방화에 드는 곡식'),
    plotSpyGrain: k(30, 0, 300, 1, '첩자에 드는 곡식'),
    /** 암살 (형: "암살자를 보내야지 장군 지혼자 왜 가냐") — 우리 장수를 자객으로, 없으면 고용 자객. R2 에 활 저격판으로 이어진다 */
    plotAssassinGrain: k(50, 0, 300, 1, '암살에 드는 곡식'),
    plotHiredGrain: k(30, 0, 300, 1, '고용 자객을 쓰면 더 드는 곡식'),
    plotHiredRyak: k(4, 1, 10, 1, '고용 자객의 지략'),
    plotBaseAssassin: k(0.35, 0, 1, 0.01, '공작 바탕 — 암살'),
    plotAssassinPerMu: k(0.04, 0, 0.2, 0.01, '암살: 노린 장수 무예 1 마다 감산 (자객 지략 1 마다 가산은 plotPerRyak)'),
    plotAssassinKill: k(0.25, 0, 1, 0.01, '암살이 먹히면 죽을 확률 (나머지는 다친다)'),
    plotSkipSeenMul: k(0.85, 0.5, 1, 0.05, '암살 건너뛰기: 진짜 지붕을 본 뒤에 자객에게 맡기면 굴림이 이만큼 (안 보고 맡기면 1 — 보고 고르는 맛을 막는다)'),
    /** 구출 (형 10-26: "잡혀간 우리 장수가있는나라의 경우 구출 이 활성화되면 좋겠어") — 잡은 나라 도읍의 옥에서 빼낸다. 밤 판으로도 간다 */
    plotRescueGrain: k(40, 0, 300, 1, '구출에 드는 곡식 (고용 자객이면 plotHiredGrain 더)'),
    plotBaseRescue: k(0.35, 0, 1, 0.01, '공작 바탕 — 구출'),
    plotRescueCapital: k(0.1, 0, 0.5, 0.01, '구출: 갇힌 곳이 도읍이면 감산 (옥이 깊다)'),
    plotWoundMonths: k(2, 1, 12, 1, '자객에게 당한 장수가 다쳐 눕는 달 (달 시계 · 옛 계절 판은 한 계절) · 장수가 눕는 건 이것뿐 (형 11-03: "암살 시 쉬는 것도 몇 달이 적절하지?" · 옛 2계절 = 여섯 달은 길었다)', '달'),
    plotRumorMorale: k(0.15, 0, 0.5, 0.01, '소문이 먹히면 그 나라 군대 사기가 이만큼 준다 (moraleFloor 까지)'),
    plotSowWar: k(0.35, 0, 1, 0.05, '이간: 중립인 두 나라가 전쟁이 될 확률 (화친·동맹은 한 칸 내려간다)'),
    plotBribeSeasons: k(2, 1, 8, 1, '매수가 먹히면 그 고을 장정이 안 서는 계절 수'),
    plotBurnShare: k(0.15, 0, 0.5, 0.01, '방화가 먹히면 그 나라 곡식이 이 몫만큼 탄다'),
    plotBurnMax: k(120, 0, 1000, 10, '방화로 타는 곡식 상한'),
    plotSpySeasons: k(4, 1, 12, 1, '첩자가 그 고을 군세를 알려 주는 계절 수'),
    plotBurnSfxSec: k(3.6, 1, 5, 0.1, '방화 성공 장의 불타는 소리 길이(초) · 형이 받은 60초 파일을 5초로 잘라 그 안에서 서서히 줄인다 (형 11-09)'),
    plotCaughtAlert: k(0.3, 0, 0.6, 0.01, '공작이 들키면 그 고을(소문·이간·방화는 국읍) 경계 가산 — 누가 했는지 몰라도 오른다'),
    /**
     * 들킴 세 갈래 (형: "자객을 보내면 잡히기도 하고 어디서보낸 첩자인지 알기도 모르기도 하고 … 알려지면 국가간 신뢰도 감소") —
     * 안 들킴 · 들켰지만 누가 보냈는지 모름(경계만 오른다) · 누가 보냈는지 드러남(사이·호감이 나빠지고 다른 나라도 등 돌린다).
     * 드러날 확률 = 바탕 − 보낸 이의 지략(5 넘는 1 마다) − 고용 자객 + 그 고을 경계 × 계수 + 우리 장수가 붙잡힘 → [최소, 최대]
     */
    plotExposeBase: k(0.5, 0, 1, 0.01, '들킨 공작에서 누가 보냈는지 드러날 바탕 확률'),
    plotExposePerRyak: k(0.06, 0, 0.2, 0.01, '보낸 이(자객 장수 · 고용 자객 · 그 밖은 그 나라 최고 략)의 지략 5 넘는 1 마다 드러남 감산'),
    plotExposeHired: k(0.2, 0, 0.6, 0.01, '고용 자객 — 누가 샀는지 저도 잘 몰라 드러남 감산'),
    plotExposePerAlert: k(0.5, 0, 2, 0.05, '그 고을(없으면 국읍) 경계 × 이것만큼 드러남 가산'),
    plotExposeCaptured: k(0.25, 0, 0.6, 0.01, '우리 장수가 자객으로 가서 붙잡혔으면 드러남 가산 (얼굴이 알려진 장수다)'),
    plotExposeMin: k(0.1, 0, 0.5, 0.01, '드러날 확률 바닥'),
    plotExposeMax: k(0.9, 0.5, 1, 0.01, '드러날 확률 천장'),
    plotConfess: k(0.2, 0, 1, 0.01, '붙잡혔지만 입을 다문 자객 장수가 계절마다 실토할 확률 (실토하면 그때 드러난다)'),
    favorPlotExposedOthers: k(4, 0, 30, 1, '공작이 드러나면 그 일을 아는 다른 나라들 호감 − (뒤에서 칼 쓰는 나라)'),
    aiPlotChance: k(0.12, 0, 1, 0.01, 'AI — 한 계절에 공작 하나를 벌일 확률 (나라마다)'),
    aiAssassinChance: k(0.3, 0, 1, 0.01, 'AI — 공작을 벌일 때 본 장수가 있으면 암살을 고를 확률'),
    /**
     * 자객 기본 · 장수는 도박 (형이 고름 — 2026-10-18). 고용 자객은 잡혀도 값만 잃는다.
     * 우리 장수를 보내면 솜씨·화살이 낫지만, 들키면 도망(지략·무예·특성)과 사로잡힘을 굴린다.
     */
    plotAgentArrows: k(3, 0, 10, 1, '우리 장수를 자객으로 보내면 밤 판에서 더 받는 화살', '발'),
    /** 밤 판의 경비 (plots.ts assassinGuard) — 고을 경계(0~0.6) + 도읍 + 군주 의 합이 문턱을 넘으면 보통 · 삼엄 */
    guardCapital: k(0.2, 0, 1, 0.05, '밤 판 경비 — 도읍이면 더하는 몫'),
    guardRuler: k(0.2, 0, 1, 0.05, '밤 판 경비 — 군주면 더하는 몫'),
    guardMid: k(0.15, 0, 1, 0.05, '밤 판 경비 — 보통의 문턱'),
    guardHigh: k(0.45, 0, 1.5, 0.05, '밤 판 경비 — 삼엄의 문턱'),
    escapeBase: k(0.4, 0, 1, 0.05, '들킨 자객 장수가 도망칠 바탕 확률'),
    escapePerRyak: k(0.04, 0, 0.2, 0.01, '자객 장수의 지략 5 넘는 1 마다 도망 가산'),
    escapePerMu: k(0.03, 0, 0.2, 0.01, '자객 장수의 무예 5 넘는 1 마다 도망 가산'),
    escapeTrait: k(0.15, 0, 0.5, 0.01, '명궁·밤눈·겁 많음 특성이 있으면 도망 가산'),
    escapeMax: k(0.85, 0, 1, 0.05, '도망 확률 천장'),
    /** 자객의 활 — 계단으로 오른다 (형: "완만한 성장이 아니라 계단적 성장"). 0 단궁 · 1 맥궁 · 2 각궁 · 3 신궁 (밤 판 bow= 와 같은 단계) */
    bowUp1Grain: k(80, 0, 1000, 10, '맥궁으로 — 곡식'),
    bowUp1Iron: k(20, 0, 300, 5, '맥궁으로 — 철'),
    bowUp2Grain: k(160, 0, 1000, 10, '각궁으로 — 곡식'),
    bowUp2Iron: k(45, 0, 300, 5, '각궁으로 — 철'),
    bowUp3Grain: k(300, 0, 2000, 10, '신궁으로 — 곡식'),
    bowUp3Iron: k(90, 0, 500, 5, '신궁으로 — 철'),
    bowUpDangung: k(0.7, 0.3, 1, 0.05, '단궁의 고장(동예)이거나 그와 동맹이면 활 올리는 값에 곱한다 — 박달나무 활 (위서 예전 [곁들임])', '배'),
    plotBowStep: k(0.08, 0, 0.3, 0.01, '활 한 단계마다 굴리는 암살의 몫 가산'),
    aiBowUpChance: k(0.04, 0, 1, 0.01, 'AI — 한 계절에 자객의 활을 올릴 확률 (값을 낼 수 있을 때)'),
    aiAgentRyak: k(7, 1, 10, 1, 'AI — 이 지략 넘는(또는 명궁) 장수만 자객으로 보낸다. 아니면 고용 자객'),
    ironPerMine: k(20, 0, 100, 1, '철산 하나가 계절마다 내는 철'),
    ironPerPort: k(4, 0, 50, 1, '포구 하나가 계절마다 교역으로 들이는 철'),
    /**
     * 땅마다 나는 것 (형: "자원들도 다각화해야할거같은데 · 갯마을은 철이 안나는 지역인가?" — 2026-10-18).
     * 바닷가(항구 · 뱃길·갯벌이 닿는 고을) — 소금·물고기 · 솔숲·높은 터·산성·숲길이 닿는 고을 — 나무 · 목장 꼬리표 — 말
     */
    saltPerCoast: k(4, 0, 30, 1, '바닷가 고을 하나가 계절마다 내는 소금'),
    fishPerHH: k(0.015, 0, 0.1, 0.001, '바닷가 고을 — 겨울 빼고 계절마다 가호 하나당 물고기(곡식)'),
    woodPerNode: k(3, 0, 30, 1, '나무가 나는 고을 하나가 계절마다 내는 나무'),
    horsePerPasture: k(2, 0, 20, 1, '목장 하나가 계절마다 내는 말'),
    spoilShare: k(0.15, 0, 0.5, 0.01, '겨울 — 소금으로 못 덮은 곡식이 썩는 몫'),
    saltKeeps: k(25, 1, 200, 1, '소금 하나가 겨울에 썩지 않게 지키는 곡식'),
    awayRation: k(1.25, 1, 2, 0.05, '제 땅 밖의 군대(길 위 · 남의 땅)는 군량이 이만큼 — 소금이 있으면 1'),
    saltPerAway: k(0.02, 0, 0.2, 0.005, '제 땅 밖 군사 한 명이 계절마다 쓰는 소금 (절인 양식)'),
    buildPalisadeWood: k(40, 0, 400, 5, '목책 — 나무'),
    buildPalisadeGrain: k(30, 0, 400, 5, '목책 — 곡식 (일손)'),
    buildMoatWood: k(20, 0, 400, 5, '해자 — 나무 (목책이 있어야 판다)'),
    buildMoatGrain: k(60, 0, 400, 5, '해자 — 곡식 (일손)'),
    boatWood: k(0.1, 0, 1, 0.01, '수군 한 명을 뽑는 데 드는 나무 (배)'),
    settleWood: k(0.02, 0, 0.5, 0.005, '개척 — 옮기는 가호 하나당 나무 (집 짓기)'),
    horsePerRider: k(1, 0, 3, 0.5, '기병 한 명을 뽑는 데 드는 말'),
    worthSalt: k(1.5, 0.1, 10, 0.1, '교역 — 소금 하나가 곡식 몇의 값인가'),
    worthWood: k(0.5, 0.1, 10, 0.1, '교역 — 나무 하나가 곡식 몇의 값인가'),
    worthHorse: k(6, 0.1, 30, 0.5, '교역 — 말 하나가 곡식 몇의 값인가'),
    worthLackMul: k(1.5, 1, 4, 0.1, '교역 — 받는 쪽에 없는 것이면 값이 이만큼 (뭍의 나라가 소금을 탐낸다)'),
    tradeLot: k(30, 5, 300, 5, '맞바꿈 제안 한 몫의 값의 바닥 (곡식으로 친)'),
    tradeLotShare: k(0.06, 0, 0.3, 0.01, '맞바꿈 제안 한 몫 — 두 나라 가운데 작은 창고 값의 이만큼 (창고가 크면 몫도 크다)'),
    tradeLotSwingLo: k(0.6, 0.1, 1, 0.05, '맞바꿈 제안 한 몫 — 판마다 흔들리는 배수의 아래'),
    tradeLotSwingHi: k(1.6, 1, 4, 0.05, '맞바꿈 제안 한 몫 — 판마다 흔들리는 배수의 위'),
    rumorChance: k(0.6, 0, 1, 0.05, '첩보 — 첩자 하나가 계절마다 소식 하나를 들을 확률 (나라마다 두 개까지)'),
    heroDeokEnvoy: k(0.03, 0, 0.1, 0.005, '사신을 따라간 장수의 매력 1 위아래마다 받아 줄 확률'),
    aiEnvoyHero: k(0.5, 0, 1, 0.05, 'AI — 사신에 장수를 딸려 보낼 확률 (맞는 장수가 놀고 있을 때)'),

    /** 징병 (FLOW §2) */
    draftPerSeason: k(0.1, 0, 0.5, 0.01, '한 고을에서 한 계절에 뽑을 수 있는 몫 (가호 대비)'),
    draftCap: k(0.3, 0, 1, 0.01, '나라 군사의 상한 (가호+군사 대비)'),
    /** 알아서 뽑기 — 뽑을 수 있는 병종마다 몫 (형 10-25: "뽑을수 있는 모든 군대를 자동으로 분배") · 못 뽑는 병종은 빼고 나눈다 */
    draftMixSpear: k(0.35, 0, 1, 0.05, '알아서 뽑기: 창병 몫'),
    draftMixBow: k(0.3, 0, 1, 0.05, '알아서 뽑기: 궁병 몫'),
    draftMixShield: k(0.2, 0, 1, 0.05, '알아서 뽑기: 방패병 몫'),
    draftMixHorse: k(0.15, 0, 1, 0.05, '알아서 뽑기: 기병 몫 (말이 있는 만큼)'),
    draftMixBoat: k(0.15, 0, 1, 0.05, '알아서 뽑기: 수군 몫 (포구 · 나무가 있는 만큼)'),
    draftHHPerMan: k(0.5, 0.1, 1, 0.05, '군사 하나를 뽑으면 빠지는 가호 몫 — 집이 통째로 사라지지 않고 일손이 빠진다 (해산하면 돌아온다)'),
    draftGrain: k(0.125, 0, 1, 0.005, '(사람 눈금 ×4 — 옛 0.5) 징병 한 명의 채비 곡식'),

    /** 개척 (FLOW §2) — 제 고을 사람을 길로 맞닿은 빈땅으로 옮긴다 */
    settleShare: k(0.15, 0, 0.5, 0.01, '개척: 한 계절에 한 고을에서 떠나보낼 수 있는 몫 (가호 대비)'),
    partyShare: k(0.12, 0.02, 0.4, 0.01, '개척단: 꾸리면 그 고을 가구의 이만큼이 떠난다'),
    partyMin: k(10, 1, 200, 1, '개척단: 이보다 적으면 꾸리지 못한다', '가구'),
    partyMax: k(2, 1, 6, 1, '개척단: 한 나라가 한꺼번에 둘 수 있는 수'),
    // 넓히기는 비싸고 느리게 (형 11-03: "군사가 밟기만 하면 내 영토 · 0인데 바로 100이 어지럽게 생기는데 실상은 10") — 문명의 개척자처럼 큰 결정
    foundGrain: k(60, 0, 500, 5, '새 마을 열기(개척단·개척) 한 번에 드는 곡식 — 가구 몫과 따로'),
    foundGrainPerTown: k(12, 0, 100, 1, '새 마을 열기: 이미 가진 고을 하나마다 더 드는 곡식 (넓을수록 비싸다)'),
    foundWood: k(8, 0, 100, 1, '새 마을 열기 한 번에 드는 나무'),
    partyPrepTurns: k(3, 0, 12, 1, '개척단: 꾸린 뒤 도읍에서 채비하는 턴(달) — 이만큼 지나야 떠난다'),
    // 고을 일터 (works.ts · 형 11-03 "마을 내정") — 짓는 값과 효과 곱
    workGrain: k(50, 0, 500, 5, '일터 짓기: 곡식'),
    workWood: k(8, 0, 200, 1, '일터 짓기: 나무 (논·장정 마을은 안 든다)'),
    workSmithyIron: k(25, 0, 200, 1, '대장간 짓기: 쇠 (쇠부리터의 열매)'),
    workJeotgalSalt: k(30, 0, 200, 1, '젓갈 창고 짓기: 소금 (소금밭의 열매)'),
    workTurns: k(3, 1, 12, 1, '일터 짓는 데 걸리는 턴(달)'),
    workPaddyMul: k(1.3, 1, 3, 0.05, '논: 그 고을 가을걷이 곱'),
    workGoodMul: k(2, 1, 4, 0.1, '소금밭·목수 마을·말 목장: 그 특산 곱'),
    workSmelterMul: k(1.6, 1, 4, 0.1, '쇠부리터: 그 고을 쇠 곱'),
    workYardMul: k(1.3, 1, 3, 0.05, '장정 마을: 그 고을 한 계절 징병 몫 곱'),
    workSmithyArm: k(0.7, 0.2, 1, 0.05, '대장간: 나라 전체 무장 올리는 쇠 곱'),
    workJeotgalSalt2: k(0.5, 0.1, 1, 0.05, '젓갈 창고: 밖에 나간 군사의 소금 곱'),
    ranchPlainShare: k(0.5, 0, 1, 0.05, '말 목장: 너른벌이 아닌 들판 마을에 연 목장이 내는 말 — 너른벌 몫 대비 (그 위에 일터 곱)'),
    // 떠돌이 상단 (merchant.ts · 형 11-03 "쇼핑") — 비싸게, 한정 개수로
    merchantEvery: k(4, 2, 12, 1, '상단: 몇 턴(달)마다 들르나'),
    merchantStay: k(2, 1, 6, 1, '상단: 몇 턴 머무나'),
    merchantSlots: k(6, 1, 8, 1, '상단: 물건 가짓수'),
    merchantMarkup: k(1.6, 1, 4, 0.05, '상단: 사는 값 — 물건 값어치(worthOf)에 곱'),
    merchantSellRate: k(0.5, 0.1, 1, 0.05, '상단: 파는 값 — 값어치에 곱'),
    merchantSellCap: k(150, 0, 2000, 10, '상단: 한 번 들를 때 우리가 팔아 받을 수 있는 곡식'),
    scaleSellRate: k(0.35, 0, 1, 0.05, '장터 저울: 팔면 받는 곡식 — 값어치의 몫 (상단보다 나쁘다 · 위원회 11-04 림월드 ③)'),
    scaleBuyMul: k(2.2, 1, 5, 0.1, '장터 저울: 사면 내는 곡식 — 값어치의 배 (상단보다 비싸다)'),
    scaleCap: k(60, 0, 1000, 5, '장터 저울: 달마다 곡식으로 친 한도 × 장터 단'),
    wishWorth: k(60, 10, 500, 5, '상단의 주문: 물건 한 가지마다 곡식으로 친 값어치의 바닥 (위원회 11-04 림월드 ② · 11-08 부터는 벌이 몇 계절치가 먼저)'),
    wishSeasons: k(2.5, 1, 8, 0.5, '상단의 주문: 모을 양 = 우리 땅이 그 물건을 이만큼의 계절 동안 내는 양 (판 내내 비슷하게 까다롭게 · 위원회 11-08)'),
    wishBigAt: k(2.5, 1, 12, 0.1, '상단의 주문: 나라의 그릇이 이만큼이면 큰 주문 (갚음이 이름난 장수)'),
    wishRoyalAt: k(6, 1, 12, 0.1, '상단의 주문: 나라의 그릇이 이만큼이면 왕의 주문 (이름난 장수 + 먼 나라 소문)'),
    wishBigMul: k(1.4, 1, 4, 0.1, '상단의 주문: 큰 주문은 모을 양이 이만큼 더'),
    wishRoyalMul: k(1.8, 1, 4, 0.1, '상단의 주문: 왕의 주문은 모을 양이 이만큼 더'),
    aiCatchCap: k(0.04, 0, 0.15, 0.01, '이웃이 따라옴: 재물의 위협 한 단(log2 그릇)마다 AI 나라의 군사 상한(draftCap)이 이만큼 오른다 (쉬움은 위협 0 · 카드 A 11-11)'),
    aiCoalCap: k(0.08, 0, 0.3, 0.01, '이웃이 따라옴: 연합에 든 AI 나라는 군사 상한이 이만큼 더 (카드 A 11-11)'),
    wishLateGrow: k(0.2, 0, 1, 0.05, '상단의 주문: 나라의 그릇이 wishRoyalAt 을 넘으면 그 위 한 단(log2)마다 모을 양이 이만큼 더 (후반에도 고민이 되게 · 카드 A 11-11)'),
    wishBack: k(0.3, 0, 1, 0.05, '상단의 주문: 큰 주문 이상은 내놓은 물건 값어치(worthOf)의 이 몫을 곡식으로 덤으로 돌려받는다 (후반 갚음이 장수 하나뿐이라 약했다 · 카드 A 11-11)'),
    scaleRefHH: k(1800, 500, 10000, 100, '나라의 그릇: 이 집 수에서 1 · 늘어나는 값(상단 주문·물건)이 모두 이 눈금을 쓴다 (scale.ts · 위원회 11-08)'),
    scaleExp: k(0.85, 0.3, 1.5, 0.05, '나라의 그릇: 집 수에 거는 거듭제곱'),
    scaleMax: k(12, 2, 30, 1, '나라의 그릇: 위 끝'),
    wealthFocus: k(0.08, 0, 0.5, 0.01, '재물의 위협: 이웃이 우리 고을을 위협 한 단(log2 그릇)마다 이만큼 더 쳐 볼 만하게 본다 (쉬움 빼고 · 림월드 · 위원회 11-08)'),
    wealthBad: k(0.12, 0, 1, 0.01, '재물의 위협: 위협 한 단마다 나쁜 사건(재해·도적)이 이만큼 더 잦다 (쉬움 빼고)'),
    wealthSevStrong: k(0.06, 0, 0.3, 0.01, '재물의 위협: 위협 한 단마다 재해가 「크게」로 올 몫이 이만큼 는다 (쉬움 빼고)'),
    crownShowAt: k(0.5, 0.2, 0.9, 0.05, '결승선 왕관: 정복(쥔 도읍/쥐어야 할 도읍)이 이 몫을 넘으면 왕관 줄과 지도 위 왕관이 뜬다 (crowns.ts · 위원회 11-08)'),
    crownFlyMs: k(1300, 400, 3000, 50, '결승선 왕관: 쥔 도읍에서 왕관 줄로 날아가는 시간(ms)'),
    crownFlyDelayMs: k(700, 0, 3000, 50, '결승선 왕관: 계절을 넘긴 뒤 날기 시작할 때까지(ms)'),
    // 곳간을 부을 곳 (wonders.ts · 위원회 11-08 ⑦ · 쉬움부터 모든 단계) — 큰 공사(판에 하나씩) · 큰 잔치(굴림 하나)
    wonderOpenAt: k(2.5, 1, 12, 0.1, '큰 공사·큰 잔치: 나라의 그릇이 이만큼이면 열린다'),
    wonderStages: k(4, 2, 8, 1, '큰 공사: 다 지을 때까지 쌓는 단 수'),
    wonderStageSeasons: k(1, 1, 4, 1, '큰 공사: 한 단을 쌓는 데 걸리는 동안', '계절'),
    wonderGrain: k(400, 50, 3000, 10, '큰 공사: 한 단 곡식 = 이 값 × 나라의 그릇'),
    wonderGood: k(12, 0, 200, 1, '큰 공사: 한 단 쇠나 나무 = 이 값 × 나라의 그릇'),
    wonderRefund: k(0.5, 0, 1, 0.05, '큰 공사: 남이 먼저 다 지으면 부은 것 가운데 돌려받는 몫'),
    wonderAiSpare: k(1.5, 1, 6, 0.5, '큰 공사: 남의 나라는 곳간에 한 단 값의 이만큼 배가 남아야 붓는다'),
    wonderHarvest: k(0.2, 0, 1, 0.01, '솟대 숲: 가을걷이 +'),
    wonderIron: k(0.3, 0, 1, 0.01, '큰 쇠부리 가마: 모든 고을의 쇠 +'),
    wonderFort: k(1.3, 1, 3, 0.05, '고인돌 큰 무덤: 선 고을 지킴 배수'),
    wonderMorale: k(0.1, 0, 0.5, 0.01, '소도 큰 제단: 모든 싸움에서 처음 사기 +'),
    feastShare: k(0.3, 0.05, 0.9, 0.05, '큰 잔치: 곳간에서 붓는 몫'),
    feastMinGrain: k(200, 0, 3000, 10, '큰 잔치: 붓는 곡식이 이 값 × 나라의 그릇은 돼야 연다'),
    feastEvery: k(4, 1, 12, 1, '큰 잔치: 한 번 열면 다음까지', '계절'),
    feastGuest: k(0.35, 0, 1, 0.05, '큰 잔치: 이름난 손님(장수)이 올 확률'),
    feastKing: k(0.35, 0, 1, 0.05, '큰 잔치: 이웃 왕이 찾아올 확률 (그 나라 호감 +)'),
    feastFavor: k(30, 0, 100, 1, '큰 잔치: 찾아온 이웃 왕의 나라 호감 +'),
    feastMorale: k(0.2, 0, 1, 0.01, '큰 잔치: 좋은 잔치면 모든 우리 군대 사기 +'),
    feastMerit: k(40, 0, 500, 5, '큰 잔치: 좋은 잔치면 우리 장수마다 단련 공 +'),
    // 도읍 — 궁궐 네 단 · 조정 세 자리 (palace.ts · docs/realm/CAPITAL.md) — 값은 나라의 그릇(realmScale)을 따른다
    palaceStages: k(3, 1, 6, 1, '궁궐: 한 단을 올리는 데 나눠 붓는 번수'),
    palaceStageSeasons: k(1, 1, 4, 1, '궁궐: 한 번 붓고 쌓는 데 걸리는 동안', '계절'),
    palaceGrain2: k(600, 50, 6000, 50, '궁궐 2단(큰 마루 집): 곡식 합계 = 이 값 × 나라의 그릇'),
    palaceGrain3: k(1500, 100, 15000, 50, '궁궐 3단(목책 궁): 곡식 합계 = 이 값 × 나라의 그릇'),
    palaceGrain4: k(3500, 200, 30000, 100, '궁궐 4단(토성 궁성): 곡식 합계 = 이 값 × 나라의 그릇'),
    palaceWoodShare: k(0.1, 0, 1, 0.01, '궁궐: 나무 = 곡식 합계의 이 몫'),
    palaceIron3: k(40, 0, 1000, 5, '궁궐 3단: 쇠 합계 = 이 값 × 나라의 그릇'),
    palaceIron4: k(120, 0, 2000, 5, '궁궐 4단: 쇠 합계 = 이 값 × 나라의 그릇'),
    palaceFort: k(1.2, 1, 3, 0.05, '토성 궁성(4단): 도읍 지킴 배수'),
    seatChi: k(0.008, 0, 0.05, 0.001, '재상: 내정 한 점마다 일터 소출 +'),
    seatMuMorale: k(0.006, 0, 0.05, 0.001, '대장군: 무예 한 점마다 새로 뽑는 군사 사기 +'),
    seatMuGrain: k(0.01, 0, 0.05, 0.001, '대장군: 무예 한 점마다 징병 곡식 −'),
    seatDeokRite: k(0.02, 0, 0.1, 0.005, '천군: 매력 한 점마다 제사 힘 +'),
    seatDeokOmen: k(0.015, 0, 0.1, 0.005, '천군: 매력 한 점마다 나쁜 일이 오는 확률 −'),
    seatBond: k(2, 0, 20, 1, '조정: 계절마다 앉은 장수와 군주의 정 +'),
    // 제천 대회 (festival.ts · CAPITAL §1-3 · 궁궐 3단부터 해마다 한 번)
    festTier: k(3, 1, 4, 1, '제천 대회: 궁궐 이 단부터 열린다 (그 아래는 옛 하늘 제사 카드)'),
    festMonthBuyeo: k(1, 1, 12, 1, '제천 대회: 부여 결의 달 (영고 · 정월)'),
    festMonthOther: k(10, 1, 12, 1, '제천 대회: 그 밖 결의 달 (동맹·무천·삼한 시월 제사)'),
    festBannerMonths: k(3, 1, 12, 1, '제천 대회: 도읍 판에 「다음 제천 대회」 띠가 서는 달 수'),
    festArcherFavor: k(5, 0, 30, 1, '제천 대회 활쏘기: 맞히면 이웃 한 나라 호감'),
    festArcherPriceMul: k(0.6, 0.1, 2, 0.05, '제천 대회 활쏘기: 찾아온 명궁의 값(곡식) 배수 (떠돌이 값에 곱)'),
    festArcherStayMul: k(1.5, 1, 4, 0.5, '제천 대회 활쏘기: 명궁이 머무는 기한 배수 (떠돌이 기한에 곱)'),
    festDuelLean: k(3, 0, 10, 0.5, '제천 대회 장수 겨루기: 이기면 그 장수의 마음의 벽이 깎이는 몫 (resistOf)'),
    festDuelMorale: k(0.12, 0, 0.5, 0.01, '제천 대회 장수 겨루기: 이기면 우리 모든 군대 사기 +'),
    festDuelLoseMorale: k(0.04, 0, 0.3, 0.01, '제천 대회 장수 겨루기: 지면 우리 모든 군대 사기 −'),
    festSongGain: k(0.04, 0, 0.3, 0.01, '제천 대회 노래와 춤: 도읍 가호 + (몫)'),
    festSongBond: k(4, 0, 20, 1, '제천 대회 노래와 춤: 우리 모든 장수 정 +'),
    festSeatMul: k(0.02, 0, 0.2, 0.005, '제천 대회: 천군이 앉았으면 그 장수 덕 한 점마다 보상(사기·가호·정·호감)이 오르는 몫'),
    seatDraftFloor: k(0.4, 0.1, 1, 0.05, '대장군: 징병 곡식은 아무리 무예가 높아도 이만큼 아래로는 안 내린다'),
    autoDraftReserve: k(2, 0, 8, 0.5, '대신 뽑기: 군량 이 계절치를 남기고 뽑는다'),
    mercMen: k(120, 10, 1000, 10, '상단 용병 무리: 창병 사람 수 (궁병은 7할)'),
    mercGrainPer: k(1.4, 0.1, 10, 0.1, '상단 용병: 한 사람 값(곡식)'),
    drumGrain: k(120, 0, 1000, 10, '상단 큰 북: 값(곡식)'),
    drumMorale: k(0.15, 0, 1, 0.01, '상단 큰 북: 모든 우리 군대 사기 +'),
    healGrain: k(90, 0, 1000, 5, '떠돌이 상단: 약초 꾸러미 값 — 다쳐 누운 우리 장수가 바로 일어난다 (다친 장수가 있을 때만 판다)'),
    seedGrain: k(140, 0, 1000, 5, '떠돌이 상단: 좋은 씨앗 값'),
    seedShare: k(0.06, 0.01, 0.3, 0.01, '좋은 씨앗 값: 우리 집 × 가을 몫(harvestPerHH) 의 이만큼 — 늘 걷이 늘어난 몫의 2.5배쯤 돌아오게 (seedGrain 이 바닥 · 위원회 11-08)'),
    seedHarvest: k(0.15, 0, 1, 0.01, '떠돌이 상단: 좋은 씨앗 — 다가오는 가을걷이가 이만큼 는다 (겨울·봄에만 판다 · 겨울에 사면 다음 해) (사건 카드의 가을걷이 곱과 같은 자리)'),
    silkGrain: k(120, 0, 1000, 5, '떠돌이 상단: 비단 선물 값'),
    silkFavor: k(6, 0, 30, 1, '떠돌이 상단: 비단 선물 — 아는 나라마다 호감'),
    workMarketEvery: k(0.67, 0.2, 1, 0.01, '장터 일터: 상단이 들르는 틈 곱 (작을수록 자주)'),
    workMarketHH: k(120, 0, 2000, 10, '장터 일터: 이만큼 집이 사는 고을에만 선다'),
    workMarketGrain: k(90, 0, 500, 5, '장터 일터: 곡식 (다른 일터보다 비싸다)'),
    siteStashSeasons: k(2, 1, 12, 1, '주인 없는 철광·포구 — 난 것이 이만큼의 철치까지 쌓인다 (군대가 밟으면 거둔다 · 형 11-05)', '철'),
    siteYieldMul: k(0.5, 0, 1, 0.05, '주인 없는 철광·포구 — 다스리는 이가 없어 반쯤만 난다 (쌓이는 양)'),
    siteAnnexMul: k(6, 1, 10, 0.5, '주인 없는 철광·포구를 개척으로 편입하는 값 — 새 마을 값의 이만큼 배 (사람과 광산이 이미 있다)'),
    workLotCapital: k(4, 1, 8, 1, '일터 터 — 도읍 (형 11-05: 땅 크기대로 · 논을 지으면 다른 걸 못 짓는 게 말이 안 된다)'),
    workLotTown: k(3, 1, 8, 1, '일터 터 — 마을 · 포구'),
    workLotSmall: k(2, 1, 8, 1, '일터 터 — 산성 · 철광'),
    workLotOpenMax: k(4, 1, 8, 1, '터 닦기: 공사로 늘려 한 고을이 가질 수 있는 터의 끝 (마을 안 판의 터 넷)'),
    workClearGrain: k(160, 0, 2000, 10, '터 닦기: 곡식'),
    workClearWood: k(60, 0, 1000, 5, '터 닦기: 나무'),
    workClearStep: k(0.6, 0, 3, 0.1, '터 닦기: 한 번 닦을 때마다 값이 이만큼씩 더 (몫)'),
    workClearTurns: k(2, 1, 12, 1, '터 닦기: 걸리는 턴'),
    workLotWildRoom: k(1500, 0, 5000, 100, '일터 터 — 개척한 빈 땅은 1 · 품이 이만큼 넘는 너른 벌이면 2', '집'),
    workLvMax: k(3, 1, 5, 1, '일터: 올릴 수 있는 가장 높은 단'),
    workLvCostMul: k(2.2, 1, 5, 0.1, '일터: 한 단 올릴 때마다 값 곱 (거듭제곱)'),
    workLv2Gain: k(2.2, 1, 5, 0.1, '일터 2단: 효과 몫 (1단 = 1)'),
    workLv3Gain: k(4, 1, 8, 0.1, '일터 3단: 효과 몫'),
    workCutFloor: k(0.25, 0, 1, 0.05, '일터: 줄이는 효과(대장간 쇠·젓갈 소금)의 바닥 곱'),
    workLvTurnsMul: k(1.5, 1, 4, 0.1, '일터: 올리는 데 드는 달 곱 (새로 짓기보다 오래)'),
    settleGrain: k(0.15, 0, 1, 0.005, '(사람 눈금 ×4 — 옛 0.6) 개척: 옮기는 가호 하나당 곡식'),
    settleGrow: k(0.06, 0, 0.3, 0.01, '개척한 땅이 품을 수 있는 만큼(room)까지 계절마다 느는 몫'),
    aiSettleShare: k(0.5, 0, 1, 0.05, 'AI 개척 — 보낼 수 있는 몫 가운데 이만큼만 보낸다'),

    /**
     * 이주 (형: "집 분배하는거 자동으로 분배하기 · 자동안하면 본인이 직접 이주 · 전방에 강제이주시키거나 수도에 집중") —
     * 고을마다 편히 품는 집(품)이 있다. 품을 넘으면 붐벼 집이 덜 는다. 자동 분배는 붐비는 고을에서 길로 맞닿은 한산한 제 고을로
     * 계절마다 조금씩 옮긴다. 억지 이주는 제 땅으로 이어진 어느 제 고을로든 곡식을 들여 옮기고, 두 고을은 한동안 집이 안 는다.
     * 품은 사람 눈금 ×4 로 센 값 (판 처음의 도읍 1~3천 집 · 마을 5백~2천 집).
     */
    roomCapital: k(3200, 400, 10000, 100, '이주: 도읍이 편히 품는 집'),
    roomPort: k(2400, 400, 10000, 100, '이주: 항구가 편히 품는 집'),
    roomVillage: k(1600, 400, 10000, 100, '이주: 마을이 편히 품는 집'),
    roomIronMine: k(800, 100, 10000, 50, '이주: 철광 고을이 편히 품는 집'),
    roomFort: k(600, 100, 10000, 50, '이주: 산성이 편히 품는 집'),
    crowdGrowMul: k(0.6, 0, 1, 0.05, '이주: 품을 넘긴(붐비는) 고을의 집 늘기 배수'),
    migrateAutoShare: k(0.02, 0, 0.2, 0.005, '이주: 자동 분배로 한 계절에 붐비는 고을에서 떠나는 집의 몫 (가호 대비, 많아야)'),
    migrateAutoGap: k(0.2, 0, 2, 0.05, '이주: 자동 분배가 움직이는 붐빔 차이 — 떠나는 고을 붐빔 − 받는 고을 붐빔이 이보다 커야'),
    migrateShare: k(0.12, 0, 1, 0.01, '이주: 억지 이주로 한 계절에 한 고을에서 떠나보낼 수 있는 몫 (가호 대비)'),
    migrateGrain: k(0.1, 0, 1, 0.005, '이주: 억지로 옮기는 집 하나당 곡식'),
    migrateCalm: k(1, 0, 4, 1, '이주: 억지 이주 뒤 두 고을의 집이 안 느는 계절 수 (그 계절 + 이만큼)'),
    /**
     * 백성 배치(사민 徙民) — 형 10-23: "마을마다 생산하는 것이 다르니 본인 전략대로 · 양동이에 물 나누듯".
     * 고을마다 −/+ 로 백성을 떼어 「모아 둔 백성」에 담았다가 다른 고을에 붓는다. 다 붓기 전엔 못 정한다.
     */
    /** 손맛 — 위 띠 수가 굴러 바뀌는 시간 (docs/realm/UX-JUICE.md) */
    uiRollMs: k(600, 0, 2000, 50, '손맛: 계절을 넘길 때 위 띠 수가 굴러 바뀌는 시간(ms)'),
    uiRollPlanMs: k(250, 0, 1000, 25, '손맛: 이번 계절 고르는 동안 위 띠 수가 바뀌는 시간(ms)'),
    placeShare: k(0.06, 0, 1, 0.01, '백성 배치: 한 계절에 옮길 수 있는 집 — 나라 전체 가호 대비'),
    // 각성 (형 10-31 · 11-04 · 11-15) — 우리 장수가 제 몫의 싸움을 이기면 불꽃이 하나 켜지고, 지거나 비기면 하나 꺼진다 (내리 이길 필요는 없다 · 순증).
    // 다 켜지면 각성 시련이 열리고(ascendTrialOpen 1) 시련을 넘으면 각성한다. 그 판에서만. 문턱은 heroes.ascendNeed 가 셈한다
    ascendWins: k(3, 1, 10, 1, '각성: 불꽃 칸 수. 제 몫의 싸움을 이기면 한 칸 켜지고 지거나 비기면 한 칸 꺼진다. 이만큼 켜지면 다 찬 것이다 (내리 이길 필요는 없다)'),
    firstAscendEase: k(1, 0, 3, 1, '각성: 처음 깨어날 때 켜진 채 시작하는 불꽃 칸 수. 그만큼 덜 이겨도 된다 (11-11 · docs/realm/FIRST-HOUR.md)'),
    legacyAwakeningOpen: k(0, 0, 1, 1, '옛 각성 시련·공훈 경로'),
    ascendTrialOpen: k(1, 0, 1, 1, '각성: 본편의 시련 관문. 1 = 불꽃이 다 켜지면 시련이 열리고 시련을 넘어야 힘이 붙는다(지금 규칙) · 0 = 시련 없이 불꽃이 다 켜지는 싸움 끝에 곧바로 붙는다(각성 v2 · 형의 판이 끝난 뒤 0 으로 · docs/realm/study-20261118/30-PROPOSAL.md 1절 ⑧). 배우는 판의 해비는 어느 쪽이든 시련이다'),
    flameFairShare: k(0.5, 0, 1, 0.05, '각성 불꽃: 진 쪽 군사가 이긴 쪽의 이 몫을 넘어야 붙는다 (제 몫의 싸움 · 위원회 11-04 던파)'),
    ascendBonus: k(1, 0, 5, 1, '각성: 능력치마다 오르는 몫 (10 을 넘을 수 있다)'),
    wakeMinFlames: k(2, 1, 3, 1, '각성기: 불꽃이 이만큼 있어야 쓴다 — 하나를 태우고 마지막 하나는 남는다 (위원회 11-04 던파 ①)'),
    trueWakeBig: k(0.8, 0, 3, 0.05, '진각성: 적의 힘이 우리의 이 몫을 넘는 큰 싸움에서만 (DESIRE §17 · 한 판에 한 번)'),
    trueWakeShock: k(0.25, 0, 1, 0.01, '진각성: 적 사기가 꺾이는 몫'),
    trueWakeLift: k(0.15, 0, 1, 0.01, '진각성: 우리 사기가 오르는 몫'),
    wakeAiEdge: k(0.45, 0, 1, 0.01, '각성기: 맡긴 우리 싸움에서 판세(이길 몫)가 이 밑이면 장수가 알아서 터뜨린다'),
    wakeAiMen: k(0.8, 0, 1, 0.01, '각성기: 맡긴 우리 싸움에서 남은 사람이 처음의 이 몫 밑이면 알아서 터뜨린다'),
    wakeReviveShare: k(0.35, 0, 1, 0.01, '각성기 · 동해의 파도(물): 이 싸움에서 쓰러진 우리 몫 가운데 다시 서는 몫 · 사기는 처음으로 (가장 센 각성기라 작게 시작 · 위원회 11-04 던파 ①)'),
    ascendOkMs: k(10600, 1000, 20000, 100, '각성: 「확인」 단추가 뜨는 때 (그 전엔 닫히지 않는다 · 형 11-01: "실수로 탭 한 번에 끝나 버림")', 'ms'),
    ascendAgainMs: k(3000, 1000, 10000, 100, '각성: 이 판에서 다시 깨어날 때의 짧은 연출 — 「확인」이 뜨는 때 (처음은 ascendOkMs 그대로 · 위원회 11-04 던파 ②)', 'ms'),
    ascendVortexMs: k(3600, 500, 10000, 50, '각성: 모임이 끝나고 소용돌이가 시작하는 때 (초상이 빛으로 바래기 시작)', 'ms'),
    ascendBeastMs: k(5400, 500, 12000, 50, '각성: 기운의 짐승이 뒤에서 솟는 때', 'ms'),
    ascendGather: k(90, 0, 160, 1, '각성: 둘레에서 빨려 드는 기운 알갱이 수 (큰 화면)'),
    ascendGatherPhone: k(48, 0, 120, 1, '각성: 빨려 드는 기운 알갱이 수 (폰 · 그래픽 한도)'),
    ascendStreakSec: k(2.4, 0.5, 6, 0.1, '각성: 빛줄기 하나가 둘레에서 가운데까지 오는 데 (가장 빠른 것 · 형 11-03: "사선 그림이 너무 빨리 지나감 · 천천히 보여서 기대하게" · 0.9 → 2.4)', 's'),
    ascendStreakSpreadSec: k(1.2, 0, 4, 0.1, '각성: 빛줄기마다 더 걸리는 몫의 폭 (느린 것 = 위 + 이만큼)', 's'),
    ascendStreakStaggerSec: k(2, 0, 4, 0.1, '각성: 빛줄기가 차례로 출발하는 폭 (한꺼번에 몰리지 않게)', 's'),
    ascendOrbit: k(28, 0, 80, 1, '각성: 소용돌이로 초상 둘레를 도는 알갱이 수 (큰 화면)'),
    ascendOrbitPhone: k(16, 0, 60, 1, '각성: 소용돌이 알갱이 수 (폰)'),
    ascendSlotMs: k(1200, 0, 6000, 50, '각성: 불꽃 첫 칸이 붙는 때', 'ms'),
    ascendSlotGapMs: k(700, 100, 1500, 20, '각성: 불꽃 칸 사이 (11-01 380 → 700 · 두구두구 사이로 하나씩)', 'ms'),
    ascendFlashMs: k(7200, 500, 15000, 50, '각성: 번쩍 · 각성 초상으로 바뀌는 때 (형 11-01: "디지몬 진화처럼 길게" · 2100 → 7200)', 'ms'),
    ascendEmbers: k(30, 0, 80, 1, '각성: 떠오르는 불티 수 (큰 화면)'),
    ascendEmbersPhone: k(16, 0, 60, 1, '각성: 떠오르는 불티 수 (폰 · 그래픽 한도)'),
    ascendIgniteMs: k(320, 50, 2000, 10, '각성: 불꽃 자리 하나에 불이 번지는 데 (셰이더 깎기 문턱이 내려가는 시간)', 'ms'),
    ascendFrameLeadMs: k(700, 100, 3000, 50, '각성: 액자 불이 번쩍보다 먼저 붙어 번지는 시간', 'ms'),
    ascendFrameTop: k(0.26, 0, 0.6, 0.02, '각성: 액자 위로 불이 솟을 몫 (액자 높이 비율 · 캔버스가 그만큼 위로 크다)'),
    ascendFrameSide: k(0.12, 0, 0.3, 0.01, '각성: 액자 불 캔버스를 양옆으로 더 넓히는 몫 (끝 혀가 잘리지 않게)'),
    ascendFrameBot: k(0.06, 0, 0.3, 0.01, '각성: 액자 불 캔버스를 아래로 더 두는 몫 (아랫변이 낮게 그을린다)'),
    // 옮긴 백성은 길 위에 있다가 계절마다 조금씩 닿는다 — 많이 옮길수록 여러 계절 (형 10-31: "재편한 양에 따라 몇 턴에 걸쳐")
    placeRateRoom: k(0.1, 0.01, 1, 0.01, '백성 배치: 받는 고을에 한 계절에 닿는 집 — 그 고을 품 대비'),
    callGrainPerHH: k(0.6, 0, 5, 0.05, '곳간 열기: 유민 한 집을 부르는 곡식 (나라 집이 적을 때) · 위원회 11-04 림월드 ①'),
    callNationHH: k(12000, 1000, 100000, 500, '곳간 열기: 나라 집이 이만큼이면 값이 곱절 — 큰 나라일수록 비싸다'),
    callRoomShare: k(0.05, 0.01, 0.5, 0.01, '곳간 열기: 한 번에 부르는 집의 끝 — 그 고을 품 대비'),
    callMin: k(20, 1, 500, 1, '곳간 열기: 한 번에 부르는 집의 바닥 (품이 작은 고을도)'),
    aiCallSpare: k(250, 0, 5000, 10, 'AI 곳간 열기: 군량 여유(aiDraftReserve 뺀 곡식)가 이만큼 넘으면 유민을 부른다'),
    placeRateMin: k(5, 1, 100, 1, '백성 배치: 한 계절에 닿는 집의 바닥 (품이 작은 고을도 이만큼은)'),
    placeStep: k(20, 1, 500, 1, '백성 배치: −/+ 한 번에 옮기는 집'),
    /** 땅의 결 — 강가(여울·갈대·나루가 닿는 들)는 논이 좋아 쌀이 더 나고, 높은 터·산성은 덜 난다 (형 10-23: "강이 있거나 가까우면 쌀 생산량도 많아지고") */
    riverRice: k(0.3, 0, 1, 0.05, '땅의 결: 강가 고을의 가을걷이 덤 (배수 +)'),
    hillRice: k(0.25, 0, 0.8, 0.05, '땅의 결: 높은 터·산성의 가을걷이 덜함 (배수 −)'),
    soilWoodRich: k(0.5, 0, 2, 0.05, '땅의 결: 솔숲(울창한 숲)의 나무 덤 (배수 +) · 형 11-05: "어떤 땅은 나무도 잘 자라고"'),
    soilWoodPoor: k(0.3, 0, 0.9, 0.05, '땅의 결: 숲길 없이 언덕·산성뿐인 성긴 숲의 나무 덜함 (배수 −)'),
    soilIronBuried: k(0.3, 0, 1, 0.05, '땅의 결: 쇠가 묻힌 땅(붉은 흙 마을)은 철광의 이만큼 철이 난다 · 형 11-05: "철도 묻혀 있어야"'),
    soilSaltRich: k(0.4, 0, 2, 0.05, '땅의 결: 갯벌이 닿는 바닷가의 소금 덤 (배수 +)'),
    /** 일손 — 철·나무·소금·말도 사는 사람 수에 따라 (형 10-23: "인구에 따라 거기서 생산되는 물품의 양이 달라지는 거니까") */
    workHH: k(600, 50, 5000, 50, '일손: 철·나무·소금·말이 제 몫(1배)만큼 나는 가호'),
    workMin: k(0.3, 0, 1, 0.05, '일손: 사람이 적어도 이만큼은 난다 (배수)'),
    workMax: k(1.5, 1, 3, 0.05, '일손: 사람이 많아도 이만큼까지만 난다 (배수)'),

    /**
     * 장수 첫판 (docs/realm/HEROES.md, 2026-10-18) — 능력치 여섯 · 특성 · 고을 맡기기 · 군주 · 회유 · 떠돌이.
     * 능력치 5 를 가운데로 친다: (값 − 5) × 계수.
     */
    persuadeUiriPer: k(0.5, 0, 2, 0.05, '회유: (그의 의리 − 우리 매력) 1 마다 더 드는 계절'),
    heroEscapePerMu: k(0.03, 0, 0.1, 0.01, '무예 1 위아래마다 졌을 때 생포·전사 확률 감산'),
    // 고을을 잃었을 때 거기 혼자 머물던 장수 (heroes.sweepHeroes — 형 2026-10-20: "수성에서 지면 장수가 무조건 사로잡혀? … 그 장수 능력치에따라 달라져야할듯")
    heroFallCaught: k(0.15, 0, 0.6, 0.01, '고을을 잃고 이웃 제 고을로 물러나다 붙잡힐 바탕 확률 (무예·지략으로 깎인다)'),
    heroFallSlip: k(0.3, 0, 1, 0.01, '물러날 이웃이 없을 때 적의 눈을 피해 도읍으로 빠져나갈 바탕 확률 (무예·지략으로 는다)'),
    heroFallDeath: k(0.06, 0, 0.3, 0.01, '고을이 떨어질 때 지키다 쓰러질 바탕 확률 (무예로 깎인다)'),
    heroFallPerRyak: k(0.03, 0, 0.1, 0.005, '지략 1 위아래마다 물러나기·빠져나가기 가감'),
    heroFallCoward: k(0.15, 0, 0.5, 0.01, '겁 많음 — 먼저 달아나 빠져나가기 가산'),
    postChiHarvest: k(0.04, 0, 0.2, 0.01, '맡은 장수 내정 1 위아래마다 그 고을 수확'),
    postChiGrow: k(0.1, 0, 0.5, 0.01, '맡은 장수 내정 1 위아래마다 그 고을 가호·개척 성장 배수'),
    postRyakAlert: k(0.03, 0, 0.1, 0.005, '맡은 장수 지략 1 마다 그 고을 경계 바닥값'),
    postDeokMilitia: k(0.05, 0, 0.2, 0.01, '맡은 장수 매력 1 위아래마다 그 고을 장정'),
    traitFarmer: k(0.25, 0, 1, 0.05, '농사꾼 — 맡은 고을 수확 가산'),
    traitAmbush: k(0.1, 0, 0.3, 0.01, '산사람(고개)·물길잡이(나루·뱃길)·밤눈(모든 길) — 기습 확률 가산'),
    traitGlutton: k(0.2, 0, 1, 0.05, '잔치꾼 — 이끄는 군대 군량 가산'),
    traitCowardMorale: k(0.15, 0, 0.5, 0.01, '겁 많음 — 지면 군대 사기 감산 (대신 안 잡힌다)'),
    traitSmith: k(4, 0, 20, 1, '대장장이 — 맡은 고을이 계절마다 내는 철'),
    traitCareful: k(0.2, 0, 0.6, 0.01, '신중 — 맡은 고을 경계 바닥값 가산'),
    traitDrinker: k(0.1, 0, 0.6, 0.01, '술꾼 — 맡은 고을 경계 바닥값 감산 (매력은 +1)'),
    traitTrader: k(0.12, 0, 0.5, 0.01, '장사꾼 — 교역 사신 받아 줄 확률 가산'),
    traitCharm: k(0.1, 0, 0.5, 0.01, '매혹 — 모든 사신 받아 줄 확률 가산'),
    traitArcherBow: k(1.15, 1, 2, 0.05, '명궁 — 이끄는 군대 궁수 배수 (조금 — 명궁의 몫은 자객)'),
    traitArcherAssassin: k(0.15, 0, 0.5, 0.01, '명궁 — 자객으로 보내면 암살 확률 가산'),
    traitHundred: k(1.5, 1, 3, 0.05, '백 사람의 이름 — 맡은 고을 장정 배수'),
    rulerDeokEnvoy: k(0.02, 0, 0.1, 0.005, '군주 매력 1 위아래마다 모든 사신 받아 줄 확률'),
    rulerChiHarvest: k(0.02, 0, 0.1, 0.005, '군주 내정 1 위아래마다 나라 수확'),
    rulerRyakPlot: k(0.02, 0, 0.1, 0.005, '군주 지략 1 위아래마다 공작 성공 확률'),
    rulerTongDraft: k(0.01, 0, 0.05, 0.005, '군주 통솔 1 위아래마다 나라 군사 상한 (가호+군사 대비)'),
    rulerAwayMul: k(0.5, 0, 1, 0.05, '군주가 도읍을 비우면(친정·자객) 다스림(능력치가 나라에 거는 몫)이 이만큼으로'),
    rulerAgentWound: k(2, 0, 6, 1, '자객으로 나간 군주가 들키면 다쳐 눕는 계절'),
    persuadeSeasons: k(4, 1, 12, 1, '회유에 드는 바탕 계절 (+ 의리·매력 차 · 매혹 −1 · 군주였으면 +2, 최소 1)'),
    persuadeGrain: k(10, 0, 100, 1, '회유 중 계절마다 드는 곡식'),
    /**
     * 회유는 굴림이다 (형: "몇계절 뒤 확정적으로 합류하는게 이상해. 매 시도마다 확률적이어야 … 림월드처럼") —
     * 마음의 벽(resist) = 바탕 + 의리 5 넘는 1마다 + 옛 주인을 믿었으면 + 군주였으면 + 일편단심.
     * 계절마다 회유하는 이의 매력만큼(흔들림 있게) 깎이고, 다 깎이면 계절마다 넘어올지 굴린다 — 실패하면 또 해 본다.
     */
    resistBase: k(2, 0, 10, 0.5, '회유: 마음의 벽 바탕'),
    resistPerUiri: k(1, 0, 4, 0.1, '회유: 의리 5 넘는 1마다 더하는 벽'),
    resistLoyal: k(2, 0, 10, 0.5, '회유: 옛 주인을 믿던 장수(정 70+)가 더하는 벽'),
    resistRuler: k(4, 0, 15, 0.5, '회유: 군주였던 이가 더하는 벽'),
    resistSteadfast: k(10, 0, 20, 0.5, '회유: 일편단심이 더하는 벽'),
    persuadeDrop: k(1.5, 0.2, 5, 0.1, '회유: 계절마다 깎는 벽 (매력 5 기준)'),
    persuadeDropPerDeok: k(0.12, 0, 0.5, 0.01, '회유: 매력 5 넘는 1마다 깎는 몫 배수'),
    persuadeCharm: k(1.4, 1, 3, 0.05, '회유: 매혹이면 깎는 몫 배수'),
    persuadeSway: k(0.4, 0, 1, 0.05, '회유: 깎는 몫의 흔들림 (±)'),
    recruitBase: k(0.45, 0, 1, 0.01, '회유: 벽이 무너진 뒤 계절마다 넘어올 확률 바탕'),
    recruitPer: k(0.06, 0, 0.3, 0.01, '회유: (회유하는 이 매력 − 그의 의리) 1마다'),
    recruitCharm: k(0.12, 0, 0.5, 0.01, '회유: 매혹이 더하는 확률'),
    recruitTraitor: k(0.25, 0, 0.6, 0.01, '회유: 반골의 상이 더하는 확률'),
    recruitSteadfast: k(0.6, 0, 1, 0.01, '회유: 일편단심이 깎는 확률'),
    recruitMin: k(0.03, 0, 0.5, 0.01, '회유: 넘어올 확률의 바닥'),
    recruitMax: k(0.85, 0.3, 1, 0.01, '회유: 넘어올 확률의 천장'),
    /**
     * 옥중 담판 (docs/realm/WOO.md, 2026-10-29) — 갇힌 이와 세 마디. 맞음(−2~+2)마다 먹힐 가망, 쓰는 능력치 5 넘는 1마다 더한다.
     * 반응: 크게 흔들림(약한 곳) · 흔들림 · 버팀 · 노여움(가시) — 벽에 drop × 이 배수. 판정은 tools/realm-woo.ts 의 정책 셋 표.
     */
    wooFit0: k(0.15, 0, 1, 0.01, '담판: 맞음 −2 의 먹힐 가망'),
    wooFit1: k(0.35, 0, 1, 0.01, '담판: 맞음 −1 의 먹힐 가망'),
    wooFit2: k(0.55, 0, 1, 0.01, '담판: 맞음 0 의 먹힐 가망'),
    wooFit3: k(0.75, 0, 1, 0.01, '담판: 맞음 +1 의 먹힐 가망'),
    wooFit4: k(0.9, 0, 1, 0.01, '담판: 맞음 +2 의 먹힐 가망'),
    wooPerStat: k(0.04, 0, 0.15, 0.005, '담판: 쓰는 능력치 5 넘는 1마다 먹힐 가망'),
    wooMomentum: k(0.1, 0, 0.3, 0.01, '담판: 앞 마디가 먹혔으면 +, 빗나갔으면 − (기세)'),
    wooChanceMin: k(0.05, 0, 0.5, 0.01, '담판: 먹힐 가망의 바닥'),
    wooChanceMax: k(0.95, 0.5, 1, 0.01, '담판: 먹힐 가망의 천장'),
    wooBig: k(1.5, 0, 4, 0.05, '담판: 크게 흔들림(약한 곳) — 깎는 벽 (한 계절 몫의 배수)'),
    wooSway: k(0.9, 0, 3, 0.05, '담판: 흔들림 — 깎는 벽 (한 계절 몫의 배수)'),
    wooRage: k(0.6, 0, 3, 0.05, '담판: 노여움 — 도로 쌓이는 벽 (한 계절 몫의 배수)'),
    wooRageShare: k(0.5, 0, 1, 0.05, '담판: 가시(맞음 −2)를 짚고 빗나간 몫 가운데 노여움이 되는 몫 (나머지는 버팀)'),
    wooHandBig: k(0.1, 0, 0.4, 0.01, '담판: 벽이 무너진 뒤의 담판 — 크게 흔들림마다 넘어올 가망 덤'),
    wooHandSway: k(0.05, 0, 0.3, 0.01, '담판: 벽이 무너진 뒤의 담판 — 흔들림마다 넘어올 가망 덤'),
    wooHandWeak: k(0.1, 0, 0.4, 0.01, '담판: 약한 곳으로 끝냈으면 「손을 내민다」의 덤'),
    wooGainGrain: k(20, 0, 200, 1, '담판: 「이익」을 걸 때 더 내는 곡식'),
    wooTalkGap: k(3, 1, 12, 1, '담판: 저절로 뜨는 때가 아니면 한 포로에 이 계절에 한 번 「마주 앉기」'),
    wooGrudgeRecruit: k(0.08, 0, 0.3, 0.01, '원한 한 겹마다 넘어올 확률 감산'),
    wooGrudgeMax: k(2, 0, 5, 1, '원한은 이만큼까지 쌓인다'),
    wooGrudgeBond: k(10, 0, 50, 1, '원한이 있던 이가 넘어오면 정이 이만큼 낮게 시작'),
    wooBondTalk: k(20, 0, 60, 1, '담판으로 넘어온 장수는 정이 이만큼 더 높게 시작 (형 대신 정함 10-29)'),
    wooRescueSeasons: k(4, 1, 20, 1, '담판: 이 계절 넘게 아무도 구하러 오지 않았으면 「명분」이 먹힌다'),
    /** 장수의 기억 (docs/realm/MEMORY.md §3 · memory.ts) — 판을 바꾸지 않는다. 읽는 것은 다음 걸음(회의) */
    memMax: k(12, 4, 40, 1, '장수의 기억: 사람마다 이만큼 줄까지 (오래된 것부터 지운다)'),
    memKeepMax: k(4, 0, 12, 1, '장수의 기억: 크게 남을 일(사로잡힘·풀려남·도읍 싸움)은 이만큼까지 지우지 않는다'),
    lessonMax: k(8, 2, 30, 1, '나라의 전례 장부: 상대 나라마다 이만큼 줄까지'),
    memSplitWatch: k(1, 0, 4, 1, '나눠 떠난 뒤 이 계절까지 도읍이 털렸나·그 싸움이 어찌 됐나를 그 떠남에 붙인다'),
    memPlotWindow: k(2, 0, 6, 1, '이 계절 안에 그 나라에 먹힌 공작이 있으면 「공작 뒤의 싸움」으로 적는다'),
    wandererChance: k(0.6, 0, 1, 0.05, '봄마다 떠돌이 인재가 나타날 확률'),
    /** 떠돌이는 장수가 모자란 나라로 — (고을+1)/(장수+1) × 이것 (0.1~1) 의 확률로 그 나라 고을에 머문다 (형 10-23: "떠돌이 인재는 왜 이렇게 많이 옴 · 마을 수랑 장수 수에 비례해서") */
    wandererNeedMul: k(0.45, 0, 2, 0.05, '떠돌이: 장수가 모자란 나라일수록 — (고을+1)/(장수+1) × 이것'),
    wandererNeedMin: k(0.08, 0, 1, 0.01, '떠돌이: 장수가 넉넉한 나라라도 이만큼은 온다'),
    cardExileW: k(0.4, 0, 2, 0.05, '사건 — 망명자 카드의 무게 (장수가 모자란 나라일수록 — wandererNeedMul 과 같은 셈을 곱한다)'),
    cardExileCost: k(0.04, 0, 0.3, 0.01, '사건 — 망명자를 받을 때 드는 곡식 (가진 곡식의 몫)'),
    retainMax: k(5, 0, 10, 1, '계승 가신 — 판이 끝날 때 다음 판에 데려갈 장수 수의 위 끝 (VISION §5-4)'),
    /** 동행 — 난세 단계(촌장 0 … 천손 6)마다 데려갈 수 (META §7-3 · 형 11-03: "제일 쉬운 데선 5 · 3 3 2 2 1 1 · 유물 모으면 써야지") */
    retainByTier: [5, 3, 3, 2, 2, 1, 1] as const,
    cardFugitiveBond: k(3, 0, 20, 1, '사건 — 소도의 도망자를 지켜 주면 오르는 장수의 정'),
    wedGrain: k(40, 0, 400, 5, '혼인 잔치에 드는 곡식 (혈통 — SYSTEMS §5-10)'),
    // 친밀 — 장수 둘 사이 (형 10-31: "혼인은 아무나 바로 하게 하지 말고 친밀도가 어느 선 이상 올라가면") · 섞은 안: 누구든 맺을 수 있지만
    // 친하면 잔치가 싸고, 낯설면(정략) 비싸고 둘 다 서운해한다
    tieMax: k(100, 10, 300, 5, '친밀: 두 장수 사이의 끝'),
    tieSeason: k(4, 0, 30, 1, '친밀: 같은 곳(고을·군대)에 머문 계절마다 오르는 몫'),
    tieWin: k(10, 0, 50, 1, '친밀: 함께 이긴 싸움마다 오르는 몫'),
    tieLove: k(60, 0, 300, 5, '친밀: 이만큼이면 서로 아끼는 사이 — 혼인 잔치가 싸다 · 연정 소문이 이 둘에게 먼저'),
    tieCold: k(20, 0, 300, 5, '친밀: 이보다 낮으면 정략혼인 — 잔치가 비싸고 둘 다 정이 떨어진다'),
    tieCrush: k(24, 0, 300, 2, '친밀: 연정 소문은 이만큼은 쌓인 둘에게만 난다 (같은 곳 여섯 계절 또는 함께 이긴 싸움 둘쯤 · 형 11-11: 정 쌓이기도 전에 난다)'),
    wedLoveMul: k(0.5, 0, 2, 0.05, '혼인: 아끼는 사이면 잔치 곡식 배수'),
    wedColdMul: k(2, 1, 5, 0.1, '혼인: 정략혼인이면 잔치 곡식 배수'),
    wedColdBond: k(8, 0, 40, 1, '혼인: 정략혼인이면 둘 다 떨어지는 정'),
    // 형 10-23: "애기는 너무 빨리 태어나는 거 같음 · 콘텐츠 소모 속도 너무 빨라" — 두 해에서 네 해로
    wedSeasons: k(16, 1, 40, 1, '혼인에서 자식 장수가 나서기까지 계절 (판 안에서 몇은 자라게 줄였다 — 판타지)'),
    escortMen: k(5, 1, 50, 1, '멀리 맡기기 — 장수를 따라가는 정예 호위 (그림·글에만 · 군사를 덜지 않는다)', '명'),
    // 재상 — 쉬는 장수를 빈 고을에 앉힐 때의 셈: 내정 + 특성이 고을과 맞으면 이것 + 이미 그 고을에 있으면 이것 (heroes.idleHeroOrders · 형 10-26)
    chancellorTraitFit: k(3, 0, 10, 1, '재상 — 특성이 고을과 맞으면(농사꾼·마을 · 대장장이·철광 · 신중·산성) 더하는 몫 (내정 1 = 1)'),
    chancellorHere: k(1, 0, 10, 1, '재상 — 장수가 이미 그 고을에 있으면 더하는 몫 (길에 안 나서도 된다)'),
    wedHoney: k(2, 0, 8, 1, '신혼 — 혼인한 뒤 이 계절 동안 부부가 떨어져 지내면 계절마다 아이가 한 계절 늦어진다', '계절'),
    wedTraitPass: k(0.5, 0, 1, 0.05, '부모 특성 하나하나가 자식에게 내려올 확률'),
    wedSurprise: k(0.05, 0, 1, 0.01, '부모 누구에게도 없던 한 등급 위 특성이 터질 확률 (혈통의 대박)'),
    wedSpread: k(2, 0, 5, 1, '자식 능력치 — 부모 평균에서 이만큼 위아래로 굴린다'),
    wedBond: k(60, 0, 100, 5, '자식 장수의 처음 정 — 제 나라에서 자랐다'),
    kidGrowSeasons: k(4, 0, 12, 1, '태어난 아이가 장수로 나서기까지 자라는 계절 (wedSeasons 안에 든다 — 혼인부터 장수까지 길이는 그대로)'),
    expMax: k(3, 0, 10, 1, '원정 — 한 나라가 동시에 보낼 수 있는 수 (SYSTEMS §15-4)'),
    cardChance: k(0.45, 0, 1, 0.05, '사건 — 계절마다 우리 나라에 카드가 올 확률 (형 10-31: 매 계절 뜨면 피곤 · 0.55 → 0.45) (events.ts · SYSTEMS §9)'),
    cardTierBad: k(0.1, 0, 1, 0.05, '사건 — 난세 한 단계마다 나쁜 카드의 무게가 이만큼 는다'),
    cardGrainMin: k(15, 0, 200, 5, '사건 — 곡식이 오갈 때 바닥 (창고에 비례하되 이보다 적지 않다)'),
    cardSwingLo: k(0.6, 0.1, 1, 0.05, '사건 — 곡식 몫이 사건마다 흔들리는 배수의 아래'),
    cardSwingHi: k(1.8, 1, 4, 0.05, '사건 — 곡식 몫이 사건마다 흔들리는 배수의 위'),
    cardMorale: k(0.1, 0, 0.5, 0.01, '사건 — 잔치·길한 징조가 올리는 군대 사기'),
    cardBond: k(3, 0, 30, 1, '사건 — 잔치가 올리는 장수의 정'),
    cardQuarrel: k(15, 0, 50, 1, '사건 — 장수 다툼에서 편든 쪽·안 든 쪽의 정'),
    cardQuarrelHush: k(6, 0, 30, 1, '사건 — 장수 다툼에 침묵했다가 앙금이 남으면 둘의 정 − (풀리면 아무 일 없다)'),
    cardQuarrelHushOk: k(0.5, 0, 1, 0.05, '사건 — 장수 다툼에 침묵하면 둘이 스스로 풀 확률'),
    cardRomanceW: k(0.5, 0, 3, 0.05, '사건 — 연정 소문이 뽑히는 무게 (혼인 안 한 남녀 장수가 있을 때)'),
    cardRomanceOk: k(0.6, 0, 1, 0.05, '사건 — 연정 소문을 모른 척하면 둘의 마음이 깊어질 확률'),
    cardRomanceBond: k(5, 0, 30, 1, '사건 — 연정 소문을 모른 척해 마음이 깊어지면 둘의 정 +'),
    cardRomanceSplit: k(8, 0, 30, 1, '사건 — 연정 소문에 둘을 떼어 놓으면 둘의 정 −'),
    cardIronSell: k(6, 1, 30, 1, '사건 — 왜의 배에 쇠 하나를 팔면 받는 곡식'),
    cardIronBuy: k(8, 1, 30, 1, '사건 — 왜의 배에서 쇠 하나를 사는 곡식'),
    cardPirateIron: k(12, 0, 100, 1, '사건 — 바다 도적을 물리치면 빼앗는 쇠'),
    // 카드 답마다의 몫·배수·확률 — events.ts 에 박혀 있던 것 (ODDS.md: sim 안의 매직넘버 → params · 화면도 같은 값을 읽는다)
    cardDroughtPray: k(0.05, 0, 0.5, 0.01, '사건 — 가뭄에 소도에 빌 때 바치는 곡식 (가진 곡식의 몫)'),
    cardDroughtPrayMul: k(0.85, 0, 1.5, 0.01, '사건 — 가뭄에 빌기만 하면 그해 가을걷이 배수'),
    cardDroughtDam: k(0.12, 0, 0.5, 0.01, '사건 — 가뭄에 보를 쌓을 때 드는 곡식 (가진 곡식의 몫)'),
    cardDroughtDamMul: k(0.97, 0, 1.5, 0.01, '사건 — 보를 쌓으면 그해 가을걷이 배수'),
    cardBountyMul: k(1.25, 1, 2, 0.01, '사건 — 풍년 조짐에 창고에 쌓으면 그해 가을걷이 배수'),
    cardFeastGrain: k(0.05, 0, 0.5, 0.01, '사건 — 풍년 잔치에 쓰는 곡식 (가진 곡식의 몫)'),
    cardLocustBurnMul: k(0.85, 0, 1.5, 0.01, '사건 — 메뚜기 떼에 불을 지르면 그해 가을걷이 배수'),
    cardLocustPray: k(0.03, 0, 0.5, 0.01, '사건 — 메뚜기 떼에 산천에 빌 때 바치는 곡식 (가진 곡식의 몫)'),
    cardLocustOk: k(0.75, 0, 1, 0.05, '사건 — 산천에 빌면 메뚜기가 사라질 확률'),
    cardLocustFailMul: k(0.5, 0, 1.5, 0.01, '사건 — 빌어도 안 사라지면 그해 가을걷이 배수'),
    cardPlagueShut: k(0.03, 0, 0.5, 0.01, '사건 — 돌림병에 고을 문을 닫으면 그 고을에서 잃는 집 (몫)'),
    cardPlagueShutGrain: k(0.03, 0, 0.5, 0.01, '사건 — 고을 문을 닫을 때 드는 곡식 (가진 곡식의 몫)'),
    cardPlagueOk: k(0.55, 0, 1, 0.05, '사건 — 돌림병을 내버려 두어도 그냥 지나갈 확률'),
    cardPlagueHit: k(0.12, 0, 0.5, 0.01, '사건 — 돌림병이 번지면 큰 고을 둘에서 잃는 집 (몫)'),
    cardSevWeak: k(0.3, 0, 1, 0.05, '사건 — 재해가 작게 올 몫 (형 11-05: 재해 강도에 variation)'),
    cardSevStrong: k(0.2, 0, 1, 0.05, '사건 — 재해가 크게 올 몫 (난세 단계마다 cardSevStrongTier 씩 는다)'),
    cardSevStrongTier: k(0.04, 0, 0.2, 0.01, '사건 — 난세 단계 하나에 큰 재해 몫이 느는 만큼'),
    cardSevWeakMul: k(0.5, 0, 1, 0.05, '사건 — 작은 재해의 피해 곱'),
    cardSevStrongMul: k(1.7, 1, 3, 0.05, '사건 — 큰 재해의 피해 곱'),
    cardSevOkShift: k(0.12, 0, 0.5, 0.01, '사건 — 세기 한 단에 맞서기·빌기가 될 가망이 바뀌는 만큼 (클수록 어렵다)'),
    cardFloodW: k(0.7, 0, 3, 0.05, '사건 — 강 범람 카드 무게 (여름 · 강가 고을이 있을 때)'),
    cardFloodDam: k(0.06, 0, 0.5, 0.01, '사건 — 범람에 둑을 쌓는 곡식 (창고 몫)'),
    cardFloodDamHurt: k(0.02, 0, 0.3, 0.01, '사건 — 둑을 쌓아도 잃는 집 (그 고을 몫)'),
    cardFloodHit: k(0.1, 0, 0.5, 0.01, '사건 — 물이 빠지길 기다리면 강가 고을마다 잃는 집 (몫)'),
    cardFloodRich: k(0.18, 0, 1, 0.01, '사건 — 물이 빠진 들의 새 흙 — 그해 가을걷이 더 (곱 · 세기만큼)'),
    cardHaloWatch: k(0.2, 0, 1, 0.05, '사건 — 해무리에 근신하면 고을마다 오르는 경계'),
    cardIronSellShare: k(0.3, 0, 1, 0.05, '사건 — 왜의 배에 파는 쇠 (가진 쇠의 몫)'),
    cardIronSellMin: k(5, 0, 50, 1, '사건 — 왜의 배에 파는 쇠의 바닥 (가진 만큼까지)'),
    cardIronBuyShare: k(0.08, 0, 0.5, 0.01, '사건 — 왜의 배에서 쇠를 살 때 내는 곡식 (가진 곡식의 몫)'),
    cardPirateRansom: k(0.08, 0, 0.5, 0.01, '사건 — 바다 도적에게 주는 몸값 곡식 (가진 곡식의 몫)'),
    cardPirateOk: k(0.4, 0, 1, 0.05, '사건 — 바다 도적에 맞서 이길 바탕 확률 (포구를 맡은 장수·경계로 오른다 · 위원회 11-04 F10)'),
    cardPirateHit: k(0.06, 0, 0.5, 0.01, '사건 — 바다 도적에 지면 그 포구에서 잃는 집 (몫)'),
    cardPirateLoss: k(0.1, 0, 0.5, 0.01, '사건 — 바다 도적에 지면 빼앗기는 곡식 (가진 곡식의 몫)'),
    cardFugitiveGrain: k(0.06, 0, 0.5, 0.01, '사건 — 소도의 도망자를 끌어내면 받는 몸값 곡식 (가진 곡식의 몫)'),
    cardWhaleShare: k(0.1, 0, 0.5, 0.01, '사건 — 고래 기름과 고기를 팔아 받는 곡식 (가진 곡식의 몫)'),
    cardWhaleMin: k(30, 0, 200, 5, '사건 — 고래를 팔아 받는 곡식의 바닥'),
    // 좋은 것 둘 가운데 하나 (형 10-31 · EVENTS-1031.md) — 무게는 cardGoodW 하나, 잔치 둘은 그 철에 cardFestW
    cardGoodW: k(0.5, 0, 3, 0.05, '사건 — 이득 고르기 카드(스승·대장장이·고향·노래·샘·선물·사냥) 하나의 무게'),
    cardFestW: k(1, 0, 3, 0.05, '사건 — 잔치 카드(씨 뿌린 뒤 · 하늘 제사)의 그 철 무게'),
    cardSowMul: k(1.12, 1, 2, 0.01, '사건 — 씨 뿌린 뒤 잔치에서 밭을 돌보면 그해 가을걷이 배수 · 새 샘에 제사해도 같다'),
    cardSkyMorale: k(0.2, 0, 0.5, 0.01, '사건 — 하늘 제사에서 군대가 맹세하면 오르는 사기'),
    cardSkyFavor: k(6, 0, 30, 1, '사건 — 하늘 제사·노래로 아는 나라마다 오르는 호감'),
    cardMentorStat: k(1, 0, 3, 1, '사건 — 스승과 제자: 제자의 무예가 오르는 몫'),
    cardMentorGap: k(3, 1, 9, 1, '사건 — 스승과 제자: 스승의 무예가 제자보다 이만큼은 높아야'),
    cardPairBond: k(8, 0, 30, 1, '사건 — 스승과 제자: 함께 다니면 둘의 정'),
    cardSmithIron: k(15, 0, 100, 1, '사건 — 대장장이의 새 틀: 쇠를 더 뽑으면 들어오는 쇠'),
    cardGoodGrain: k(0.08, 0, 0.5, 0.01, '사건 — 틀을 팔고 · 선물을 받고 · 가죽을 팔면 들어오는 곡식 (가진 곡식의 몫 · 바닥 cardGrainMin)'),
    cardHomeShare: k(0.1, 0, 0.5, 0.01, '사건 — 고향 소식·새 샘: 그 고을 집이 느는 몫 (지금 집 대비 · 바닥 cardHomeMin)'),
    cardHomeMin: k(5, 0, 100, 1, '사건 — 고향 소식·새 샘: 느는 집의 바닥'),
    cardHomeBond: k(12, 0, 40, 1, '사건 — 고향 소식: 장수와 쉬게 하면 오르는 정'),
    cardGiftFavor: k(18, 0, 40, 1, '사건 — 사신의 선물: 크게 답례하면 그 나라 호감 (곡식을 쓰니 받는 것보다 크게)'),
    cardGiftReturn: k(0.12, 0, 0.5, 0.01, '사건 — 사신의 선물: 크게 답례하면 나가는 곡식 (가진 곡식의 몫 · 바닥 cardGrainMin) · 받는 선물(cardGoodGrain)보다 크게'),
    // 위원회 11-04 역사 자리 — 공짜·밀리는 고름 고침 (docs/realm/council/1104/history.md §2)
    cardBountyFeastMul: k(1.1, 1, 1.5, 0.01, '사건 — 풍년 · 크게 잔치한다: 그해 가을걷이 곱 (풍년 몫을 먹는다 · 곡식은 안 든다)'),
    cardBountyFeastBond: k(6, 0, 20, 1, '사건 — 풍년 · 크게 잔치한다: 장수들 정'),
    cardSkyGuestFavor: k(10, 0, 30, 1, '사건 — 하늘 제사 · 이웃을 부른다: 아는 나라마다 호감 (잔치 곡식이 든다)'),
    cardExileReturnFavor: k(10, 0, 30, 1, '사건 — 쫓겨 온 사람 · 돌려보낸다: 쫓아낸 나라의 호감 (받으면 그 나라가 노한다)'),
    cardRomanceDrill: k(0.08, 0, 0.3, 0.01, '사건 — 연정 소문 · 떼어 놓는다: 군기가 서 우리 군대 사기'),
    cardMentorTie: k(30, 0, 100, 1, '사건 — 스승과 제자 · 함께 다니게 한다: 두 장수 사이 친밀'),
    cardMentorBond: k(4, 0, 20, 1, '사건 — 스승과 제자 · 함께 다니게 한다: 둘의 군장과의 정'),
    cardQuarrelMendTie: k(15, 0, 50, 1, '사건 — 장수 다툼 · 침묵: 스스로 풀리면 둘 사이 친밀'),
    cardQuarrelGrudge: k(20, 0, 60, 1, '사건 — 장수 다툼 · 편들기: 둘 사이에 남는 앙금 (친밀 −)'),
    cardPirateChief: k(0.15, 0, 0.5, 0.01, '사건 — 바다 도적 · 맞선다: 포구를 맡은 장수가 있으면 이길 가망 +'),
    cardPirateWatch: k(0.2, 0, 0.5, 0.01, '사건 — 바다 도적 · 맞선다: 포구 경계(0~1) × 이만큼 이길 가망 +'),
    cardPirateMax: k(0.85, 0.5, 1, 0.01, '사건 — 바다 도적 · 맞선다: 이길 가망의 끝'),
    cardPirateWinMul: k(1.5, 1, 3, 0.1, '사건 — 바다 도적 · 맞선다(직접 쏜다): 물결 셋을 다 막으면 빼앗는 쇠 배수 (SNIPE §0-9)'),
    cardPiratePerfectMul: k(2, 1, 4, 0.1, '사건 — 바다 도적·산적 · 맞선다: 물결 셋을 다 막고 목책도 안 부서졌으면(두목을 사로잡는다) 빼앗는 쇠 배수 (cardPirateWinMul 대신)'),
    cardPirateHoldCut: k(0.3, 0, 0.33, 0.01, '사건 — 바다 도적 · 맞선다(직접 쏜다): 막은 물결 하나마다 잃는 집·곡식이 이만큼 준다'),
    cardSeenSeasons: k(8, 0, 40, 1, '사건 — 같은 갈래·같은 사람 카드를 본 뒤 덜 오는 계절 (위원회 11-04 F13)', '계절'),
    cardSeenMul: k(0.2, 0, 1, 0.05, '사건 — 그동안 그 카드가 올 무게 곱'),
    rivalMeet: k(3, 2, 10, 1, '맞수 — 같은 적장과 싸움·겨루기로 이만큼 맞서면 맞수 카드가 올 수 있다 (위원회 11-04 역사 ①)'),
    cardRivalW: k(1.2, 0, 5, 0.1, '사건 — 맞수 카드 무게'),
    cardRivalBond: k(5, 0, 20, 1, '사건 — 맞수 · 도전장: 그 장수의 정'),
    cardRivalWine: k(0.04, 0, 0.3, 0.01, '사건 — 맞수 · 술 한 동이: 곡식 (가진 곡식의 몫)'),
    cardRivalFavor: k(8, 0, 30, 1, '사건 — 맞수 · 술 한 동이: 맞수의 나라 호감'),
    cardFavorUp: k(3, 0, 30, 1, '사건 — 소도의 도망자를 내버려 두면 아는 나라마다 오르는 호감'),
    cardFavorDown: k(8, 0, 30, 1, '사건 — 소도의 도망자를 끌어내면 아는 나라마다 떨어지는 호감'),
    omenRight: k(0.7, 0, 1, 0.05, '점괘가 맞을 확률 (SYSTEMS §9-3)'),
    omenShaman: k(0.15, 0, 0.5, 0.05, '무당 핏줄 장수가 있으면 점괘가 더 맞는다'),
    // 풍습 (data/customs.ts · CUSTOMS.md §7) — 0 이면 모든 풍습을 끈다 (짝 씨앗으로 풍습 하나의 몫을 잰다: realm-sim --set customsOn=0)
    customsOn: k(1, 0, 1, 1, '풍습을 켠다 (0 이면 끈다 — 재는 용)'),
    guseulGift: k(0.5, 0, 2, 0.05, '풍습 구슬(마한) — 우리 선물로 오르는 호감이 이만큼 더 크다'),
    guseulIron: k(0.6, 0.1, 1, 0.05, '풍습 구슬(마한) — 쇠를 이만큼으로 싸게 친다'),
    // 변한 결 (CUSTOMS §7-2 wave 2)
    deongiIron: k(0.1, 0.02, 1, 0.01, '덩이쇠(변한) — 곡식이 모자랄 때 군사 한 명의 징병값으로 내는 쇠'),
    deongiShare: k(0.5, 0, 1, 0.05, '덩이쇠 — 늘 쇠로 내는 징병값의 몫 (쇠가 있는 만큼)'),
    deongiCovet: k(60, 0, 400, 5, '덩이쇠 — 창고의 쇠가 이만큼을 넘으면 이웃이 탐낸다'),
    deongiFocus: k(0.05, 0, 0.3, 0.01, '덩이쇠 — 탐내는 이웃이 그 나라 고을을 이만큼 더 쳐 볼 만하게 본다 (ai.focus)'),
    girbiEnvoy: k(0.1, 0, 0.4, 0.01, '길 비켜 주기(변한) — 우리 사신의 화친·동맹·교역 청에 더하는 받아들일 확률'),
    girbiSpy: k(0.5, 0, 1, 0.05, '길 비켜 주기 — 우리 땅에 든 남의 척후가 들킬 확률이 이만큼 준다 (몫)'),
    girbiPlot: k(0.1, 0, 0.4, 0.01, '길 비켜 주기 — 우리 땅을 노린 남의 공작이 먹힐 확률 덤'),
    // 남부 판 대비 셋 (CUSTOMS §8-3 S3)
    chaekhwaMorale: k(0.1, 0, 0.5, 0.01, '책화(동예) — 우리 땅에 쳐들어온 적군의 처음 사기 깎임'),
    chaekhwaDeter: k(0.08, 0, 0.3, 0.01, '책화 — 이웃이 그 나라 고을을 이만큼 덜 쳐 볼 만하게 본다 (물어내기 싫다 · ai.focus)'),
    chaekhwaAway: k(1, 0, 3, 0.1, '책화 — 남의 땅에 나간 우리 군사가 더 먹는 군량 (한 사람 몫의 배수)'),
    maljangGrain: k(30, 0, 300, 5, '말 장례(마한) — 가을 장례에 드는 곡식'),
    maljangBond: k(8, 0, 30, 1, '말 장례 — 가을 장례로 오르는 장수마다의 정'),
    maljangHorseBond: k(2, 0, 10, 0.5, '말 장례 — 바친 말 한 필마다 더 오르는 정 (모두 합쳐 maljangBond 만큼까지 더)'),
    // 나라 고리 (CUSTOMS §8-2 ★ — 규칙마다 동사 한 문장 · data/customs.ts)
    saroMorale: k(0.1, 0, 0.5, 0.01, '여섯 마을의 뜻(사로) — 치러 간 우리 군대의 처음 사기 덤 (물어서 시작한 싸움)'),
    judgeTruce: k(0.25, 0, 0.6, 0.01, '수로왕의 판결(음즙벌) — 싸우는 나라에 화친을 청할 때 더하는 받아들일 확률'),
    judgeFeeShare: k(0.12, 0, 0.5, 0.01, '수로왕의 판결 — 판결해 준 큰 나라에 바치는 곡식 (가진 곡식의 몫)'),
    judgeFeeMin: k(20, 0, 300, 5, '수로왕의 판결 — 바치는 곡식의 바닥 (가진 만큼까지)'),
    dalcheonMul: k(2, 1, 4, 0.1, '달천 철광(우시산) — 우리 철광에서 나는 쇠의 배수'),
    dalcheonCap: k(0.05, 0, 0.2, 0.01, '달천 철광 — 나라가 뽑을 수 있는 군사 상한이 이만큼 준다 (가호+군사의 몫)'),
    sonoeFrames: k(3, 0, 10, 1, '쇠뇌(골벌) — 처음 쇠뇌 틀 수'),
    sonoePerFrame: k(40, 5, 300, 5, '쇠뇌 — 한 틀에 붙는 쇠뇌병 수 (판 위에 서 있는 쇠뇌병이 이만큼 × 틀 수를 넘지 못한다)'),
    sonoeIron: k(0.1, 0, 1, 0.01, '쇠뇌 — 쇠뇌병 한 명을 뽑는 데 드는 쇠'),
    sonoeMix: k(0.1, 0, 0.5, 0.05, '쇠뇌 — AI 가 뽑는 군사 가운데 쇠뇌 몫 (활 몫에서 떼어 온다)'),
    riseWait: k(2, 1, 8, 1, '다시 일어남(압독·실직) — 도읍을 빼앗기고 이만큼 지나야 들고일어날 수 있다 (계절)'),
    riseWindow: k(8, 1, 30, 1, '다시 일어남 — 빼앗긴 뒤 이만큼 안에서만 들고일어난다 (계절) — 지나면 불씨가 꺼진다'),
    riseGuard: k(0.5, 0, 3, 0.05, '다시 일어남 — 빼앗은 나라가 도읍에 둔 군사가 그 도읍 장정의 이만큼 배보다 적으면 들고일어난다'),
    riseMen: k(0.3, 0, 1, 0.05, '다시 일어남 — 들고일어난 사람 (도읍 집의 몫 · 창병으로)'),
    riseHH: k(0.4, 0, 0.9, 0.05, '다시 일어남 — 들고일어난 뒤 도읍에서 줄어드는 집 (몫)'),
    fortEarth: k(1.35, 1, 2, 0.05, '달벌 흙성(다벌) — 흙성이 지키는 쪽에 거는 성 배수'),
    buildEarthWood: k(60, 0, 400, 5, '달벌 흙성 — 나무'),
    buildEarthGrain: k(140, 0, 600, 5, '달벌 흙성 — 곡식 (일손)'),
    siegeFocus: k(0.1, 0, 0.4, 0.01, '도읍 에우기(이서) — 남의 도읍을 이만큼 더 쳐 볼 만하게 본다 (ai.focus)'),
    siegeFortPow: k(0.5, 0, 1, 0.05, '도읍 에우기(이서) — 남의 도읍을 칠 때 성 배수를 이만큼 제곱으로 (0 이면 성이 없는 셈)'),
    jultaPact: k(0.2, 0, 0.6, 0.01, '줄타기(사벌) — 가장 센 두 나라에 화친·동맹을 청할 때 더하는 받아들일 확률'),
    jultaFavor: k(15, 0, 60, 1, '줄타기 — 한쪽과 손잡으면 다른 쪽에서 깎이는 호감'),
    soebaeKeep: k(30, 0, 300, 5, '쇠 실은 배(가락) — 가을에 창고에 남기는 쇠 (넘는 몫은 배가 싣는다)'),
    soebaeMax: k(60, 0, 400, 5, '쇠 실은 배 — 한 해 싣는 쇠의 끝'),
    soebaePrice: k(2.5, 0, 10, 0.5, '쇠 실은 배 — 쇠 하나에 받는 곡식'),
    posangPact: k(0.3, 0, 0.6, 0.01, '바닷가 여덟 나라(포상) — 포상 나라끼리 화친·동맹·함께 치기 청에 더하는 받아들일 확률'),
    posangGuyaFavor: k(30, 0, 100, 5, '바닷가 여덟 나라 — 가락이 처음부터 포상 나라마다 품은 미움 (호감 −)'),
    // 땅 한 수 (CUSTOMS §8-1 셋째 층 — 땅의 꼬리표에서)
    landIronArm: k(0.8, 0.2, 1, 0.05, '쇠 다루기(땅) — 무장을 올리는 데 드는 쇠 배수'),
    landIronFocus: k(0.1, 0, 0.3, 0.01, '쇠 다루기 — 이웃이 그 나라 철광 고을을 이만큼 더 쳐 볼 만하게 본다 (ai.focus)'),
    landPortConceal: k(0.15, 0, 0.5, 0.01, '뱃길(땅) — 바닷길로 가는 기습의 숨기 덤'),
    landPortBoat: k(0.5, 0.1, 1, 0.05, '뱃길 — 수군을 뽑는 데 드는 나무 배수'),
    landPortMix: k(0.15, 0, 0.4, 0.05, '뱃길 — AI 가 뽑는 군사 가운데 수군 몫 (창 몫에서 떼어 온다)'),
    landPortMilitia: k(0.7, 0.2, 1, 0.05, '뱃길 — 사내들이 바다에 나가 우리 포구 고을의 장정이 이만큼으로 준다'),
    landHighPass: k(1, 0, 2, 1, '고갯목 — 고갯길로 나가면 더 걸리는 계절'),
    landReedsFlood: k(0.015, 0, 0.2, 0.005, '갈대밭 — 여름 큰물에 우리 강가 고을에서 줄어드는 집 (몫)'),
    landReedsConceal: k(0.25, 0, 0.6, 0.01, '갈대밭(땅) — 갈대·나루 길로 가는 기습의 숨기 덤'),
    landHighBuild: k(0.5, 0.1, 1, 0.05, '고갯목(땅) — 목책·해자 값 배수'),
    landHighMorale: k(0.12, 0, 0.5, 0.01, '고갯목(땅) — 고갯길·높은 터로 쳐들어온 적의 처음 사기 깎임'),
    landPastureHorse: k(4, 0, 30, 1, '말 치는 들(땅) — 계절마다 들어오는 말'),
    landPastureGrain: k(10, 0, 100, 1, '말 치는 들 — 계절마다 드는 말 먹이 곡식'),
    landSodoRite: k(0.5, 0.1, 1, 0.05, '소도 곁(땅) — 소도 제사 값 배수'),
    landSodoSkip: k(0.85, 0.5, 1, 0.01, '소도 곁 — 봄 제사를 거른 해의 가을걷이 배수'),
    tierArmy: k(0.09, 0, 1, 0.01, '난세 단계 — 한 단계마다 이웃 나라 첫 군대가 이만큼 커진다 (tier.ts · 크게 키우면 군량에 굶어 오히려 약해졌다 — BALANCE)'),
    tierStock: k(0.25, 0, 1, 0.01, '난세 단계 — 한 단계마다 이웃 나라 첫 창고가 이만큼 넉넉해진다'),
    tierFocus: k(0.02, 0, 0.1, 0.005, '난세 단계 — 한 단계마다 이웃이 우리 고을을 이만큼 더 쳐 볼 만하게 본다 (ai.focus)'),
    tierOurs: k(0.04, 0, 0.1, 0.005, '난세 단계 — 한 단계마다 우리 가을걷이가 이만큼 준다 (이웃만 세지면 이웃끼리 싸워 쉬워지기도 했다 — BALANCE)'),
    tierIncome: k(0.1, 0, 1, 0.01, '난세 단계 — 한 단계마다 이웃 나라 가을걷이가 이만큼 는다 (처음 몫만으론 40계절에 묻힌다 — BALANCE)'),
    // 2026-10-23 단계를 열에서 일곱(촌장·군장·대가·왕·대왕·태왕·천손)으로 — 한 단계 폭을 키워 6(천손)이 옛 10 보다 세다 (형: "쉬움 단계도 · 더 어려운 단계도")
    // 쉬움(촌장)은 "뭘 해도 이길 만큼" (형 10-26: "난이도 쉬움인데 왜 이렇게 어려운지 · 대역폭 확 더 늘려야 · 촌장급은 진짜 뭘 해도 승리할 정도로")
    easyArmy: k(0.4, 0.2, 1, 0.05, '쉬움(촌장) — 이웃 나라 첫 군대 배수'),
    easyStock: k(0.5, 0.2, 1, 0.05, '쉬움(촌장) — 이웃 나라 첫 창고 배수'),
    easyIncome: k(0.5, 0.3, 1, 0.05, '쉬움(촌장) — 이웃 나라 가을걷이 배수'),
    easyOurs: k(1.4, 1, 2, 0.05, '쉬움(촌장) — 우리 가을걷이 배수'),
    easyPower: k(1.7, 1, 2.5, 0.05, '쉬움(촌장) — 싸움에서 우리 쪽 힘 배수 (판 내내)'),
    easyMorale: k(0.3, 0, 0.6, 0.01, '쉬움(촌장) — 싸움에서 우리 쪽 처음 사기 가산'),
    // 형 10-27: "쉬운 난이도에서는 전투 혜택도 좀 줘라" — 힘·사기 덤에 더해, 물러나기·사로잡기도 쉽게 · 전장에 「촌장의 덤」 칩으로 보인다
    // 의리 — 공으로 사지 않고 판에서 겪은 일로 오른다 (docs/realm/UIRI.md · 형 10-27)
    uiriRoom: k(3, 0, 5, 1, '의리 — 타고난 값 위로 오를 수 있는 끝 (10 은 못 넘는다)'),
    uiriMin: k(1, 1, 5, 1, '의리 — 내려가도 이 밑으로는 안 간다'),
    easyRetreat: k(0.25, 0, 0.6, 0.05, '쉬움(촌장) — 우리 쪽 물러날 가망 가산'),
    easyRetreatFail: k(0.5, 0, 1, 0.05, '쉬움(촌장) — 우리가 물러나다 따라잡혀 잃는 몫에 곱한다'),
    easyCapture: k(0.15, 0, 0.5, 0.01, '쉬움(촌장) — 우리 쪽 사로잡기 확률 가산'),
    easyFocus: k(0.5, 0, 1, 0.01, '쉬움(촌장) — 이웃이 우리 고을을 이만큼 덜 쳐 볼 만하게 본다 (ai.focus)'),
    easyBad: k(0.5, 0, 1, 0.05, '쉬움(촌장) — 나쁜 사건 카드가 오는 몫'),
    expGrainPer: k(10, 0, 100, 5, '원정 — 가는 계절마다 드는 곡식 (떠날 때 한꺼번에)'),
    expIron: k(10, 0, 100, 1, '원정 — 철을 얻으면 짧은 길의 몫 (길이·장수 솜씨·땅으로 곱한다)'),
    expGrain: k(50, 0, 500, 5, '원정 — 곡식을 얻으면 짧은 길의 몫'),
    wandererStay: k(2, 1, 8, 1, '떠돌이가 머무는 계절'),
    wandererPricePer: k(4, 0, 20, 1, '떠돌이 값 — 능력치 합 × 이것 (곡식)'),
    aiHireReserve: k(3, 0, 8, 1, 'AI — 떠돌이를 들이거나 회유할 때 남길 군량 (계절치)'),
    /** 정과 성장 (HEROES §6, 형: "장수를 오래쓰면 친밀도? … 장수 키우는 맛도 있어야할듯" — 2026-10-18) */
    bondStart: k(25, 0, 100, 1, '정 — 처음부터 섬기던 장군'),
    bondHired: k(25, 0, 100, 1, '정 — 들인 떠돌이'),
    bondPersuaded: k(15, 0, 100, 1, '정 — 회유한 포로'),
    bondSeason: k(1, 0, 10, 0.5, '정 — 섬기는 계절마다 +'),
    bondWin: k(2, 0, 20, 1, '정 — 이끈 싸움을 이기면 +'),
    bondLose: k(2, 0, 20, 1, '정 — 이끈 싸움을 지면 −'),
    bondTrust: k(70, 1, 100, 1, '믿는 장수가 되는 정'),
    bondMorale: k(0.05, 0, 0.3, 0.01, '믿는 장수가 이끄는 군대의 사기 +'),
    bondUiri: k(2, 0, 6, 1, '믿는 장수는 남에게 회유될 때 의리 + (오래 걸린다)'),
    bondXpWarm: k(1.25, 1, 3, 0.05, '정든 장수(정 30~) — 얻는 공에 곱한다'),
    bondXpTrust: k(1.5, 1, 3, 0.05, '믿는 장수(정 70~) — 얻는 공에 곱한다'),
    bondXpSworn: k(2, 1, 4, 0.05, '한마음 장수(정 100) — 얻는 공에 곱한다'),
    bondMoraleSworn: k(2, 1, 4, 0.1, '한마음 장수가 이끄는 군대의 사기 덤 — 믿는 장수 덤에 곱한다'),
    /** 판 밖 인연 막대 (BONDS §2 · 장수마다 쌓여 판을 넘어 남는다) */
    metaSeasons: k(1, 0, 10, 1, '인연 — 섬긴 4계절마다 +'),
    metaGrow: k(2, 0, 10, 1, '인연 — 자란 한 단계마다 +'),
    metaBondWarm: k(3, 0, 30, 1, '인연 — 정이 든 장수 +'),
    metaBondTrust: k(8, 0, 30, 1, '인연 — 정이 믿음에 닿은 장수 +'),
    metaBondSworn: k(15, 0, 30, 1, '인연 — 한마음이 된 장수 +'),
    metaCaptive: k(6, 0, 30, 1, '인연 — 우리가 사로잡은 적장 (그 적장에게) +'),
    metaEndWin: k(8, 0, 30, 1, '인연 — 판 끝까지 우리 장수, 이겼을 때 +'),
    metaEndLose: k(4, 0, 30, 1, '인연 — 판 끝까지 우리 장수, 졌을 때 +'),
    metaEndSeasons: k(8, 0, 40, 1, '인연 — 판 끝 몫이 붙는 최소 계절 (넘게 돈 판만)'),
    metaDexMet: k(1, 0, 20, 1, '인연 — 도감 만남 칸을 처음 켤 때 +'),
    metaDexCaught: k(4, 0, 20, 1, '인연 — 도감 사로잡음 칸을 처음 켤 때 +'),
    metaDexServed: k(4, 0, 20, 1, '인연 — 도감 거느림 칸을 처음 켤 때 +'),
    metaRunCap: k(40, 1, 200, 1, '인연 — 한 판에 한 사람이 쌓는 상한'),
    metaTier1: k(15, 1, 1000, 1, '인연 1단(아는 사이) 문턱'),
    metaTier2: k(45, 1, 1000, 1, '인연 2단(정든 사이) 문턱'),
    metaTier3: k(100, 1, 1000, 1, '인연 3단(믿는 사이) 문턱'),
    metaTier4: k(180, 1, 1000, 1, '인연 4단(굳은 사이) 문턱'),
    metaTier5: k(300, 1, 1000, 1, '인연 5단(한마음) 문턱'),
    metaMigrateServed: k(15, 0, 100, 1, '인연 옮기기 — 옛 도감에 거느림이 켜진 장수'),
    metaMigrateCaught: k(4, 0, 100, 1, '인연 옮기기 — 옛 도감에 사로잡음이 켜진 장수 (더)'),
    metaMigratePick: k(10, 0, 100, 1, '인연 옮기기 — 옛 데려가기에서 고른 장수 (더)'),
    metaStartBond: k(5, 0, 50, 1, '인연 2단(정든 사이) — 판 시작 때 우리 장수의 정에 더하는 몫'),
    metaBonusMax: k(1, 0, 3, 1, '인연 5단(한마음) — 판 시작 때 떠돌이로 찾아오는 덤 동행 수'),
    metaBonusStay: k(8, 1, 40, 1, '인연 5단 덤 동행이 우리 도읍에 머무는 계절 수'),
    growXp: k(6, 1, 30, 1, '능력치가 한 단계 오르는 공 (5 이하일 때)'),
    growXpPer: k(2, 0, 10, 1, '능력치가 5 를 넘으면 한 단계마다 더 드는 공'),
    xpWin: k(2, 0, 10, 1, '이긴 싸움 — 무예·통솔 공'),
    xpLose: k(1, 0, 10, 1, '진 싸움·교착 — 무예·통솔 공'),
    xpPost: k(1, 0, 10, 1, '맡은 고을 — 계절마다 내정·매력 공'),
    xpPlot: k(3, 0, 10, 1, '암살을 해낸 자객 장수 — 지략 공'),
    xpPersuade: k(2, 0, 10, 1, '회유를 해낸 장수 — 매력 공'),
    /**
     * 단련 — 판을 넘어 자라는 장수 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §A · 형 10-26: "엘든링·다크소울식 패배 후 성장").
     * 판 안에서 우리 장수마다 공(功)이 쌓이고(realm/drill.ts), 판이 끝나면(이기든 지든) 단련 공으로 새긴다. 단련터에서 능력치를 하나씩 올린다.
     * 난세 단계와 상관없다 — 단계는 적을 세게 할 뿐 우리 단련을 깎지 않는다.
     */
    drillMeritFight: k(2, 0, 10, 1, '단련 공 — 이끈 싸움 (지거나 비겨도)'),
    drillMeritWin: k(3, 0, 10, 1, '단련 공 — 이끈 싸움을 이기면'),
    drillMeritDuel: k(3, 0, 10, 1, '단련 공 — 장수 겨루기를 이기면'),
    drillMeritCapture: k(3, 0, 10, 1, '단련 공 — 적장을 사로잡은 싸움에 선 우리 장수 (사로잡은 장수마다)'),
    drillMeritPost: k(1, 0, 10, 1, '단련 공 — 고을을 맡은 계절마다'),
    // 군대 이끈 계절이 공의 대부분이라(planner 봇 비화가야 40계절: 1 이면 주력 평균 45.5 · 단련 7.5) 반으로 — 0.5 면 26.6 · 단련 5.3 (tools/realm-drill.ts · 10-26)
    drillMeritLead: k(0.5, 0, 10, 0.5, '단련 공 — 군대를 이끈 계절마다'),
    drillMeritPlot: k(2, 0, 10, 1, '단련 공 — 자객으로 나가 공작이 먹히면'),
    // 얼굴 링 — 장수 고르기 (58-A · ui/realm/hero-ring.ts · 형 11-21 시안 docs/realm/production/mockups/hero-ring) · 단련터 · 열전 장수 바꾸기도 (58-B)
    ringSlots: k(10, 6, 14, 2, '얼굴 링 — 고리에 도는 칸 수 (장수가 몇 명이든 이만큼만 · 뒤쪽 칸은 가려진 동안 다음 장수로 갈아 끼운다)'),
    ringShow: k(2.5, 1.5, 4, 0.5, '얼굴 링 — 앞쪽 몇 칸까지 얼굴을 보이나 (양쪽 · 나머지는 빈 메달)'),
    ringTilt: k(66, 40, 80, 1, '얼굴 링 — 원판을 눕힌 각도 (클수록 납작한 타원)', '도'),
    ringFace: k(0.28, 0.15, 0.4, 0.01, '얼굴 링 — 얼굴 크기 / 고리 지름 (앞 얼굴은 이것의 1.12배)'),
    ringEase: k(11, 4, 30, 1, '얼굴 링 — 도는 빠르기 (남은 거리를 1초에 몇 번 좁히나)'),
    ringDrag: k(4.5, 1, 10, 0.5, '얼굴 링 — 고리 폭만큼 끌면 몇 칸 도나'),
    ringWheelPx: k(60, 10, 200, 10, '얼굴 링 — 휠을 이만큼 굴리면 한 칸', 'px'),
    ringJump: k(3, 1, 8, 1, '얼굴 링 — 번호 막대로 멀리 뛸 때 마지막 몇 칸만 돌아 들어오나'),
    ringBigMs: k(140, 0, 600, 20, '얼굴 링 — 앞 장수가 이만큼 머물면 큰 그림을 바꾼다 (빨리 돌릴 때 큰 그림을 줄줄이 받지 않게)', 'ms'),
    ringIdleMs: k(600, 200, 1500, 50, '얼굴 링 — 전투 띠 서기 숨 한 컷 길이', 'ms'),
    ringAttackMs: k(900, 300, 2000, 50, '얼굴 링 — 고를 때 공격 한 번 길이 (여섯 컷)', 'ms'),
    drillMeritEnvoy: k(1, 0, 10, 1, '단련 공 — 사신을 따라가 청이 받아들여지면'),
    drillWinMul: k(1.5, 1, 3, 0.1, '단련 공 — 판을 이기면 곱한다 (지면 그대로 · 져도 다 남는다)'),
    drillCostBase: k(2, 1, 10, 1, '단련 값 — 단련 n 에서 n+1 로 올리는 공은 n × drillCostMul + 이것'),
    drillCostMul: k(2, 1, 4, 1, '단련 값 — 단계마다 이만큼씩 비싸진다 (형 폰 기록 10-26: 한 장수로 밀면 이긴 한 판에 14단계 · 그릇이 거의 다 찼다)'),
    drillRunFull: k(30, 5, 200, 5, '단련 공 — 한 판에 한 장수가 다 받는 공 (넘는 몫은 drillRunOver 만큼만 · 곱하기 전)'),
    drillRunOver: k(0.25, 0, 1, 0.05, '단련 공 — drillRunFull 을 넘는 몫은 이만큼만 새긴다'),
    drillRoom: k(3, 0, 6, 1, '단련 그릇 — 능력치마다 타고난 값 + 이것까지 (10 은 못 넘는다)'),
    drillKeepRuns: k(30, 5, 200, 5, '단련 — 이미 새긴 판(같은 판을 두 번 새기지 않게)을 이만큼까지 기억한다', '판'),
    /**
     * 유물 — 이긴 판의 껴묻거리 (docs/realm/HERO-GROWTH.md ★ 둘째 판 §B · 형 10-26: "판 승리했을 때 3개의 보물상자 중에서 하나 유물 선택").
     * 표는 realm/data/relics.ts · 셈은 realm/relics.ts. 장수가 몸에 지닌다(무기 아님). 잃지 않는다.
     */
    relicStat: k(1, 0, 3, 1, '유물 — 능력치 유물이 판을 열 때 더하는 몫 (단련 그릇 위에 얹는다 · 10 은 못 넘는다)'),
    relicRoom: k(1, 0, 3, 1, '유물 — 그릇 유물이 넓히는 단련 그릇'),
    relicMorale: k(0.05, 0, 0.3, 0.01, '간두령 — 지닌 장수가 이끄는 군대의 사기 +'),
    relicBondMul: k(1.5, 1, 3, 0.1, '굽은옥 — 지닌 장수의 정이 오를 때 곱한다'),
    relicIron: k(1, 0, 10, 1, '덩이쇠 — 지닌 장수가 맡은 고을의 철 + (계절마다)'),
    relicCheonmaHorse: k(1.25, 1, 2, 0.05, '천마도 말다래 — 지닌 장수가 이끄는 기병의 힘 ×'),
    relicRiderHorse: k(1.2, 1, 2, 0.05, '기마인물형 토기 — 지닌 장수가 이끄는 기병의 힘 ×'),
    relicFarm: k(0.15, 0, 0.5, 0.01, '농경문 청동기 — 지닌 장수가 맡은 고을의 수확 +'),
    relicCrown: k(0.1, 0, 0.5, 0.01, '신라 금관 — 군주가 지니면 나라 모든 고을의 수확 +'),
    relicHouEnvoy: k(0.1, 0, 0.5, 0.01, '호우명 그릇 — 지닌 장수가 따라간 사신이 받아들여질 몫 +'),
    relicBrushEnvoy: k(0.05, 0, 0.5, 0.01, '다호리 붓 — 지닌 장수가 따라간 사신이 받아들여질 몫 +'),
    relicDaggerDuel: k(2, 0, 5, 1, '계림로 보검 — 겨루기에서 무예 +'),
    relicBipaDuel: k(1, 0, 5, 1, '비파형동검 — 겨루기에서 무예 +'),
    relicMirrorChant: k(1.5, 1, 3, 0.1, '잔무늬거울 — 지닌 장수의 비기가 진중 굿이 되고, 굿으로 오르는 사기에 곱한다'),
    relicBellSteady: k(0.7, 0.3, 1, 0.05, '팔주령 — 지닌 장수 쪽 군사가 지는 합에서 꺾이는 사기에 곱한다'),
    relicDuckSaves: k(1, 0, 3, 1, '오리모양 토기 — 싸움에서 잡히거나 쓰러질 때 다친 몸으로 빠져나오는 횟수 (판마다)', '번'),
    relicWheelMarch: k(1, 0, 3, 1, '수레바퀴모양 토기 — 지닌 장수가 이끄는 군대의 길이 이만큼 짧다 (턴으로 깎는다: 달 시계면 달 · 옛 판은 계절 · 적어도 한 턴)', '턴'),
    relicHornFeast: k(0.5, 0.1, 1, 0.05, '말머리 뿔잔 — 지닌 장수 쪽 호궤에 드는 곡식에 곱한다'),
    relicEarringWoo: k(1.5, 1, 3, 0.1, '굵은고리 금귀걸이 — 지닌 장수가 회유하면 계절마다 깎는 벽에 곱한다'),
    relicIncenseRite: k(2, 1, 3, 0.5, '금동대향로 — 지닌 장수의 나라 제사 효과 배수 (무당 핏줄과 같고 겹치지 않는다)'),
    relicIncenseStep: k(1, 0, 3, 1, '금동대향로 — 지닌 장수의 나라는 큰 제사 길에 내리 지낼 제사가 이만큼 적다', '번'),
    relicGuardianWards: k(1, 0, 3, 1, '진묘수 — 지닌 장수가 맡은 고을에 쳐들어온 적을 싸움 없이 돌려보내는 횟수 (판마다)', '번'),
    relicShoesCaught: k(0.7, 0.1, 1, 0.05, '금동신발 — 지닌 장수를 자객·구출로 보낼 때 들킬 몫에 곱한다'),
    relicSlots: k(1, 1, 3, 1, '유물 — 장수 하나가 지니는 수', '개'),
    relicSlotsHigh: k(2, 1, 4, 1, '유물 — 단련이 relicTwoAt 이상인 장수가 지니는 수', '개'),
    relicTwoAt: k(10, 1, 60, 1, '유물 — 단련 이 단계부터 relicSlotsHigh 개를 지닌다'),
    relicChests: k(3, 1, 5, 1, '유물 — 이긴 판의 옛 무덤에 놓이는 상자', '개'),
    relicWeightCommon: k(6, 0, 20, 1, '유물 상자 — 흔함이 나올 무게'),
    relicWeightRare: k(3, 0, 20, 1, '유물 상자 — 귀함이 나올 무게'),
    relicWeightLegend: k(1, 0, 20, 1, '유물 상자 — 보배가 나올 무게'),
    relicKeepRuns: k(30, 5, 200, 5, '유물 — 이미 연 무덤(같은 판을 두 번 열지 않게)을 이만큼까지 기억한다', '판'),
    /** 강화 — 가진 유물을 또 얻으면 한 단계 오른다 (FOCUS F · 형: "판 수만큼 하면 얻을 유물이 없음") */
    relicLvMax: k(3, 1, 5, 1, '유물 강화 — 가장 높은 단계 (★ 수)', '단계'),
    relicUpStep: k(0.5, 0, 1, 0.05, '유물 강화 — 단계마다 효과의 세기(없을 때와의 차이)에 더하는 몫 (0.5 면 ★★ 1.5배 · ★★★ 2배)'),
    relicUpInt: k(1, 0, 2, 1, '유물 강화 — 정수 효과(능력치·그릇·철·겨루기·빠져나옴·돌려보냄)가 단계마다 느는 몫'),
    relicUpSlow: k(0.5, 0, 1, 0.5, '유물 강화 — 길·큰 제사를 줄이는 효과가 단계마다 느는 몫 (올림 · 0.5 면 ★★ 에서 +1 로 끝)'),
    relicRareChance: k(0.25, 0, 1, 0.05, '판 끝 드문 상자 — 이긴 판의 무덤에 귀함·보배만 든 넷째 상자가 놓일 몫'),
    relicShakeMs: k(950, 0, 2500, 50, '옛 무덤 — 고른 상자가 북소리에 떨리다 터지기까지', 'ms'),
    relicSparks: k(24, 0, 60, 1, '옛 무덤 — 유물이 떠오를 때 흩어지는 금빛 낱알', '개'),
    relicDusts: k(7, 0, 16, 1, '옛 무덤 — 상자가 터질 때 이는 흙먼지 덩이', '개'),
    relicLandMs: k(745, 0, 3000, 5, '옛 무덤 — 터진 뒤 유물이 솟아 제자리에 처음 닿는 때 · 귀함 소리(엽전·종·나팔)를 이때 낸다 (relics.ts tbup: .35초 늦게 1.1초 cubic-bezier(.2,.9,.25,1.25) 가 처음 1 에 닿는 때 · 예전 380 은 솟기 시작할 때 · A1 소리 박자)', 'ms'),
    relicCalmLandMs: k(380, 0, 3000, 5, '옛 무덤 — 움직임 줄이기면 유물이 솟지 않고 .35초에 바로 선다 · 그때 귀함 소리', 'ms'),

    /** 이김·짐 (FLOW §7 #1) */
    winCapitals: k(3, 2, 6, 1, '이김: 이만큼의 국읍을 쥔다 (제 국읍 포함)', '곳'),
    /** 쇠의 바다(자유판 가장 작은 지도)의 타국 수 — 판마다 무작위 나라, 나머지는 빈 땅 (FOCUS.md J · 형 10-30) */
    miniRivals: k(1, 1, 5, 1, '쇠의 바다: 판에 나오는 타국 수', '나라'),
    yeongnamRivals: k(3, 1, 20, 1, '낙동강 스물한 나라: 판에 나오는 타국 수 (중소형)', '나라'),
    southRivals: k(5, 1, 35, 1, '삼한: 판에 나오는 타국 수 (중형)', '나라'),
    worldRivals: k(9, 1, 51, 1, '북녘의 바람: 판에 나오는 타국 수 (대형)', '나라'),
    rivalGapHops: k(4, 0, 12, 1, '자유판: 타국 도읍은 우리 도읍에서 이 걸음보다 멀리 있는 나라를 먼저 뽑는다 (처음부터 맞붙지 않게 · 형 10-31)', '걸음'),
    rivalGapHopsDuel: k(2, 0, 12, 1, '1:1 판(쇠의 바다): 타국 도읍은 이 걸음보다 멀리 · 붙어서 시작 (긴급 위원회 11-04)', '걸음'),
    /** 짐: 도읍을 잃으면 바로 지지 않는다 — 조정이 가장 큰 고을로 피해 이만큼 버틴다. 그 안에 되찾으면 산다 (형: "뺏기자마자 지는건 좀 오바") */
    exileSeasons: k(8, 1, 20, 1, '짐: 도읍을 잃고 되찾을 때까지 버티는 계절', '계절'),
    // 판이 클수록 더 쥐어야 한다 — 나라의 3분의 1쯤 (형 2026-10-19: "큰 판인데도 승리조건이 3개만먹으면 끝나는건 말이 안되는듯. 판 크기에 비례해야할듯")
    winCapitalsYeongnam: k(7, 3, 21, 1, '영남 판 이김: 이만큼의 도읍을 쥔다 (제 도읍 포함 · 스물한 나라의 3분의 1)', '곳'),
    winCapitalsSouth: k(12, 3, 36, 1, '삼한 남부 판 이김: 이만큼의 도읍을 쥔다 (제 도읍 포함 · 서른여섯 나라의 3분의 1)', '곳'),
    winCapitalsWorld: k(16, 3, 50, 1, '삼한과 북녘 판 이김: 이만큼의 도읍을 쥔다 (제 도읍 포함 · 쉰 나라의 3분의 1)', '곳'),
    /** 발견 (discovery.ts, 형: "시간지나서 발견국가가 많아지면 확장하는거지 지도도" — 2026-10-19) */
    discoverDrift: k(0.35, 0, 1, 0.05, '발견 — 계절마다 아는 나라의 이야기로 그 너머 한 나라를 알게 될 확률'),
    farMeetSeasons: k(6, 1, 20, 1, '발견 — 달 시계 판에서 아무와도 안 닿으면 이 계절마다 가장 가까운 모르는 나라 하나를 먼 소식으로 안다 (첫 만남 ~6계절 · FOCUS J)', '계절'),
    discoverDriftYeongnam: k(0.8, 0, 1, 0.05, '발견 — 영남 판의 소문 (좁고 촘촘한 판이라 빨리 돈다)'),
    meetPerSeason: k(1, 1, 4, 1, '새 나라 소개 — 한 계절에 화면에 새로 보이는 나라 수 (나머지는 줄을 서서 다음 계절에 · 형 FOCUS G: 두 개면 과부하). 우리와 직접 얽힌 나라는 줄을 건너뛴다', '나라'),
    aiFarEvery: k(3, 1, 8, 1, '플레이어가 모르는 먼 나라 AI 는 이만큼 계절에 한 번만 다 생각한다 (나머지는 답·징병만 — 서른여섯 나라의 무게)', '계절'),
    aiFarEveryWorld: k(5, 1, 10, 1, '삼한과 북녘 판 — 먼 나라 AI 가 다 생각하는 간격 (쉰 나라의 무게)', '계절'),

    /** 나누기·모으기·협공 (SYSTEMS §4-5) */
    armyMax: k(10, 1, 20, 1, '나라마다 군대 수 상한 (형: "왜 최대 5개야?" — 5 는 초판에 화면을 단순히 하려던 값. 2026-10-18 10)', '개'),
    splitMin: k(40, 1, 200, 1, '(사람 눈금 ×4 — 옛 10) 나눈 양쪽의 최소 병력', '명'),
    pincer: k(1.15, 1, 1.5, 0.05, '협공 — 서로 다른 길 둘 이상에서 들어오면 공격측 배수'),

    /** 정찰 (SYSTEMS §2-4) — 들킬 확률 = 바탕 + 략 차이 × 계수 */
    scoutDetectBase: k(0.15, 0, 1, 0.01, '정찰 들킬 바탕 확률'),
    scoutDetectPerRyak: k(0.05, 0, 0.2, 0.01, '략 1 차이당 들킬 확률'),
    /** 정찰꾼 수 — 고을이 이만큼이면 둘 · 셋 (FOCUS D · 형 11-01: "정찰 1개로 여러 전선을 못 봄") · scouts.scoutCap */
    scoutTowns2: k(4, 2, 20, 1, '고을이 이만큼이면 정찰꾼 둘', '곳'),
    scoutTowns3: k(8, 3, 40, 1, '고을이 이만큼이면 정찰꾼 셋', '곳'),
    /** 정찰꾼이 가는 거리 — 우리 고을에서 길 몇 번까지 (본 땅만) · 맞닿은 곳은 늘 보이니 정찰은 먼 곳용 */
    scoutReach: k(6, 1, 12, 1, '정찰꾼이 가는 거리 (우리 고을에서 길 몇 번) — 옛 3 (형 11-09: "3칸까지밖에 못 가는 게 말이 되나 · 군대도 멀리 다녀오는데")', '길'),
    /** 정찰 판에 늘어놓는 곳 — 나머지는 지도에서 고을을 눌러 보낸다 (형 10-28: 굴리는 목록 피하기) */
    scoutListMax: k(6, 3, 30, 1, '정찰 판에 늘어놓는 곳 수', '곳'),
    /** 우리 고을 이웃은 늘 보인다 — 파수꾼이 턴마다 보는 군세의 흐림 (intel 출처 'watch' · 척후 0 · 첩자 0.1 · 상인 0.3) */
    watchBlur: k(0.2, 0, 0.5, 0.05, '이웃 고을 파수 — 군세 범위의 흐림'),
    alertOnDetect: k(0.15, 0, 0.6, 0.01, '정찰이 들키면 그 고을 경계 가산'),
    alertOnAmbushed: k(0.1, 0, 0.6, 0.01, '이웃 고을이 기습당하면 경계 가산'),

    /** 기습 확률의 바닥·천장 — 확실한 기습도 불가능한 기습도 없다 */
    ambushMin: k(0.05, 0, 0.5, 0.01, '기습 최소 확률'),
    ambushMax: k(0.85, 0.5, 1, 0.01, '기습 최대 확률'),
    ambushPass: k(0.25, 0.05, 0.8, 0.01, '기습 문턱 — 숨음(은폐+략 차이+특성+방심−경계, 길목 보정 뒤)이 이 이상이면 반드시 숨어 닿고 밑이면 들킨다 (형 11-05: "기습은 확률이 낮으니 거의 안 하게 된다" · 주사위 말고 조건)'),
    hideGuardSpread: k(0.1, 0, 0.3, 0.01, '기습 — 저들이 길목을 지킬 몫은 남의 속이라 이만큼 넓혀 범위로 보인다 (ODDS 원칙 1)'),
    ambushPerRyak: k(0.05, 0, 0.2, 0.01, '략 1 차이당 기습 보정'),
    ambushWinterIce: k(0.2, 0, 0.5, 0.01, '겨울 언 강(나루·갈대) 은폐 가산'),
    /**
     * 기습은 정면과 다른 싸움이다 (형: "그냥공격하는거랑 기습하는거랑 느껴지는게 없음" — 2026-10-18).
     * 먹히면 성·지형 배수를 안 받고 장정이 모이지 못한다(그래서 배수는 낮게). 들키면 기다리던 적에게 걸린다.
     */
    ambushSuccess: k(1.25, 1, 3, 0.05, '기습 성공 — 공격측 배수 (성·장정 무시는 따로)'),
    ambushCaught: k(0.6, 0.3, 1, 0.01, '기습 들킴 — 공격측 배수 (되레 매복에 걸린다 — 2026-10-18 0.7→0.6)'),
    ambushCaughtLoss: k(0.15, 0, 0.5, 0.01, '기습 들킴 — 공격측 손실 가산'),
    ambushCaughtMorale: k(0.15, 0, 0.5, 0.01, '기습 들킴 — 걸린 군대 사기 감산 (moraleFloor 까지)'),
    ambushFirstStrike: k(0.12, 0, 0.5, 0.01, '기습 먹힘 — 맞붙기 전에 지키는 쪽이 먼저 잃는 몫 (첫 칼)'),
    aiAmbushWalled: k(0.35, 0, 1, 0.05, 'AI — 은폐가 좋은 길로 성 뒤 고을을 칠 때, 기습 확률이 이만큼 넘으면 기습한다'),
    /** 별동대 (ai.moves raid) — 칠 데를 못 찾은 군대가 작은 무리만 떼어 성 뒤를 기습하거나 빈 마을을 줍는다 */
    aiRaidShare: k(0.35, 0.1, 0.6, 0.05, 'AI 별동대 — 군대에서 떼는 몫의 상한 (ambushFreeMen 도 넘지 않는다)'),
    aiRaidWin: k(0.8, 0, 1, 0.05, 'AI 별동대 — 성 뒤 고을 기습: 먹혔을 때의 최악 승률이 이만큼은 돼야 간다'),
    aiRaidP: k(0.18, 0, 1, 0.01, 'AI 별동대 — 성 뒤 고을 기습: 숨어 닿을 가늠이 이만큼은 돼야 건다 (도박 — 작은 무리라 잃어도 덜 아프다)'),
    aiRaidEasy: k(0.85, 0, 1, 0.05, 'AI 별동대 — 성 없는 마을 줍기: 정면 최악 승률이 이만큼은 돼야 간다'),
    /** 호감을 사는 선물 (ai.favorGift) — 신중한 나라가 맞닿은 센 이웃에게 */
    aiGiftFavor: k(25, -100, 100, 1, 'AI 선물 — 호감이 이만큼 아래인 나라에 보낸다'),
    aiGiftMax: k(60, 0, 400, 10, 'AI 선물 — 한 번에 보내는 곡식의 상한', '섬'),
    /** 앞서가는 나라 (stance.leaderOf) — 다른 나라들이 그 땅을 더 쳐 볼 만하게 본다 (힘의 균형) */
    aiLeaderFocus: k(0.12, 0, 0.5, 0.01, 'AI — 앞서가는 나라의 고을을 이만큼 더 쳐 볼 만하게 본다'),
    aiPathBlockFocus: k(0.2, 0, 0.6, 0.01, 'AI — 이기는 길에 가까운 나라의 그 길 고을(철광·포구 / 소도 곁)을 이만큼 더 쳐 볼 만하게 본다 (위원회 11-04 문명 「결승선」)'),
    /** 큰 군대는 잘 안 숨는다 — 작은 별동대 기습이 수가 된다 (나누기의 쓸모) */
    ambushFreeMen: k(240, 0, 1200, 10, '(사람 눈금 ×4 — 옛 60) 기습: 이만큼까지는 숨는 데 벌점이 없다', '명'),
    ambushPerHundred: k(0.02, 0, 0.3, 0.005, '(사람 눈금 ×4 — 옛 0.08) 기습: 그 위 100명마다 기습 확률 감산'),
    alertMax: k(0.6, 0, 1, 0.05, '경계 상한'),
    alertDecay: k(0.05, 0, 0.2, 0.01, '경계가 계절마다 0으로 돌아가는 양'),
    lullMax: k(0.3, 0, 0.6, 0.05, '방심 상한'),

    /** 정보가 낡는 꼴 — 보지 않은 사이 F 가 움직일 수 있는 계절당 상한 (§2-2) */
    intelGrowMax: k(0.2, 0, 1, 0.01, '계절당 전투력 늘어남 상한'),
    intelLossMax: k(0.05, 0, 0.5, 0.01, '계절당 전투력 줄어듦 상한'),
    intelBlindAge: k(4, 1, 10, 1, '이만큼 낡으면 "모름"', '계절'),
    intelAlertWiden: k(0.05, 0, 0.2, 0.01, '경계 정보가 계절마다 넓어지는 절대 폭'),

    /** 생포 (§5-3) — 결과표의 바탕에 더한다 */
    captureRout: k(0.4, 0, 1, 0.05, '대패한 장수 생포 바탕'),
    captureLose: k(0.2, 0, 1, 0.05, '패한 장수 생포 바탕'),
    deathRout: k(0.15, 0, 1, 0.05, '대패한 장수 전사 바탕'),
    deathLose: k(0.1, 0, 1, 0.05, '패한 장수 전사 바탕'),
    captureAmbush: k(0.1, 0, 0.5, 0.05, '기습 성공 시 생포 가산'),
    captureMax: k(0.9, 0.5, 1, 0.05, '생포 확률 상한'),

    /** 세력 AI (SYSTEMS §11 · BUILD §3-5) — 성향마다 칠 만하다고 보는 승률 */
    aiCautiousWin: k(0.6, 0.3, 0.95, 0.05, 'AI 신중 — 최악의 승률이 이만큼은 돼야 친다'),
    aiCautiousAge: k(1, 0, 3, 1, 'AI 신중 — 정보가 이만큼보다 낡으면 먼저 정찰', '계절'),
    aiGreedyWin: k(0.55, 0.3, 0.95, 0.05, 'AI 탐욕 — 범위 가운데 승률이 이만큼이면 친다'),
    aiRecklessWin: k(0.4, 0.1, 0.95, 0.05, '봇 무모 — 범위 가운데 승률이 이만큼이면 친다'),
    plannerKeep: k(0.4, 0.1, 0.9, 0.05, '봇 계획가 — 별동대를 떼어 보낼 때 국읍에 남기는 몫'),
    aiGuardMin: k(240, 0, 1200, 5, '(사람 눈금 ×4 — 옛 60) AI — 국읍에 남기는 몫이 이만큼은 돼야 별동대를 떼어 보낸다', '명'),
    aiUnknownWin: k(0.65, 0, 1, 0.05, 'AI 탐욕·무모 — 모르는 고을을 이 승률로 얕본다'),
    aiAmbushWorth: k(0.3, 0, 1, 0.05, 'AI — 기습 확률이 이만큼 넘으면 기습으로 들어간다'),
    aiAssumeRyak: k(5, 1, 10, 1, 'AI — 모르는 적 장수의 략을 이만큼으로 본다'),
    aiAssumeAlert: k(0.15, 0, 0.6, 0.05, 'AI — 본 적 없는 고을의 경계를 이만큼으로 본다'),
    /** 초반 유예 — 작은 나라는 아직 눈에 안 띈다. 그동안 남의 나라는 플레이어 땅에 들어오지 않는다 (먼저 친 나라는 예외) */
    aiGrace: k(8, 0, 20, 1, 'AI — 판 첫 이만큼 계절은 플레이어 땅에 들어오지 않는다', '계절'),
    /** 짧은 판은 유예도 짧게 (긴급 위원회 11-04 · loop.md — 「다음 달」 24번 동안 아무 일도 없어 막내가 1장을 3분 만에 접었다) */
    aiGraceDuel: k(1, 0, 20, 1, 'AI — 1:1 판(쇠의 바다)의 초반 유예', '계절'),
    aiGraceMahan: k(1, 0, 20, 1, 'AI — 1장 마한의 초반 유예 (마한이 먼저 친다)', '계절'),
    /**
     * 새내기 유예 (FIRST-HOUR-20261122 TOP 1) — 초반 유예가 이보다 짧은 판(1장 마한 · 1:1 판)의 첫 이만큼 계절엔 남의 나라가 우리 군대 없는 우리 고을을 치지 않는다.
     * 첫 진짜 판의 첫 패배가 거의 모든 판에서 새로 연 마을의 손쓸 수 없는 패배(적 승률 1.00)였다. 먼저 쳐도 풀리지 않는다 · 0 이면 끈다
     */
    aiFreshGrace: k(4, 0, 20, 1, 'AI — 1장·1:1 판 첫 이만큼 계절엔 우리 군대 없는 우리 고을을 치지 않는다 (새내기 유예)', '계절'),
    /** 적이 온다 예고 (realm/warn.ts · FIRST-HOUR-20261122 TOP 1) — 이번 달 끝에 우리 고을을 칠 적과 지킬 가망 · 답 하나(이번 달 안에 닿는 우리 군대를 보낸다) */
    warnSendMin: k(0.35, 0, 1, 0.05, '적이 온다 예고: 보내면 지킬 가망(가운데)이 이만큼은 돼야 「보낸다」를 권한다 (확실히 지는 고름은 숨긴다)'),
    warnSendGain: k(0.15, 0, 1, 0.05, '적이 온다 예고: 보내서 지킬 가망(가운데)이 이만큼은 올라야 권한다'),
    threatWarnMs: k(9000, 3000, 30000, 500, '적이 온다 예고가 머무는 가장 짧은 시간(ms) · 글이 길면 noticePerCharMs 만큼 더 · 누르면 바로 걷힌다'),
    /** 외교 추천 (advice.ts · 형 10-31) — 우리 눈에 이웃의 힘이 우리의 이만큼 배를 넘으면 「손잡을 때」, 남과 싸우는 이웃이 이만큼 배보다 약하면 「칠 때」 */
    adviseStrongMul: k(1.3, 1, 3, 0.1, '외교 추천: 센 이웃 = 우리 힘의 이만큼 배 넘게'),
    adviseWeakMul: k(0.8, 0.3, 1.5, 0.1, '외교 추천: 칠 만한 이웃 = 남과 싸우는 중이고 우리 힘의 이만큼 배보다 약하다'),
    /** 다가가기 (ai.approach) — 옆에 칠 곳이 없으면 빈 땅을 지나 가장 가까운 남의 고을 쪽으로 (자유판은 도읍 하나로 시작해 사이가 빈 땅 · 형 10-30 "시간이 갈수록 적을 하나, 둘 만나") */
    aiApproachFrom: k(4, 0, 20, 1, 'AI 다가가기: 이 계절부터', '계절'),
    aiApproachSolo: k(8, 0, 30, 1, 'AI 다가가기: 군대가 하나뿐이면 이 계절부터 도읍을 비우고 간다', '계절'),
    aiApproachDuel: k(1, 0, 20, 1, 'AI 다가가기: 1:1 판은 이 계절부터 (군대가 하나뿐이어도) · 긴급 위원회 11-04', '계절'),
    aiApproachDepth: k(6, 2, 12, 1, 'AI 다가가기: 이만큼 길 안의 고을만 찾는다', '길'),
    /** 군량 — 출정한 사람 하나가 계절마다 먹는 곡식 (겨울 × winterRation) */
    rationPerSoldier: k(0.0625, 0, 0.5, 0.0025, '(사람 눈금 ×4 — 옛 0.25) 병사 1명 계절당 군량'),
    winterRation: k(1.5, 1, 3, 0.1, '겨울 군량 배수'),
    /** AI 징병 — 가을·겨울에, 곡식을 이만큼 계절치 군량으로 남기고 뽑는다 */
    aiDraftReserve: k(3, 0, 8, 1, 'AI 징병 — 남겨 두는 군량', '계절'),
    /** AI 징병의 병종 비 — 결·나라마다 (data/armymix.ts · CUSTOMS §8-3 S0). 0 이면 옛 창 6·활 3·방패 1 (짝 씨앗으로 재는 용) */
    aiKyeolMix: k(1, 0, 1, 1, 'AI 징병 — 병종 비를 결·나라마다 (0 이면 모두 창6·활3·방패1)'),
    aiDraftGoodsMin: k(5, 1, 200, 1, 'AI 징병 — 말·배가 모자라 기병·수군을 조금만 뽑을 수 있을 때 이만큼은 돼야 뽑는다 (나머지는 다음 병종으로)', '명'),

    /** 외교 (FLOW §4) — 받아들일 확률 = 바탕 + 힘의 비 · 관계 · 성향 · 이해 → [envoyMin, envoyMax] */
    truceSeasons: k(8, 1, 20, 1, '화친이 이어지는 계절', '계절'),
    envoyMin: k(0.02, 0, 0.5, 0.01, '사신 — 받아들일 확률 바닥'),
    envoyMax: k(0.95, 0.5, 1, 0.01, '사신 — 받아들일 확률 천장'),
    envoyTruce: k(0.35, 0, 1, 0.05, '화친 바탕'),
    envoyTrade: k(0.45, 0, 1, 0.05, '교역 바탕'),
    envoyTribute: k(0.05, 0, 1, 0.05, '조공 요구 바탕'),
    envoyAlliance: k(0.1, 0, 1, 0.05, '동맹 바탕'),
    envoyPower: k(0.25, 0, 1, 0.05, '힘의 비(우리/그들 − 1)당 가산 — 센 쪽 말을 듣는다'),
    envoyPowerCap: k(2, 0.5, 5, 0.1, '힘의 비 가산의 상한 (비가 이 이상이면 더 안 오른다)'),
    envoyWar: k(-0.2, -1, 0, 0.05, '전쟁 중인 나라의 사신'),
    envoyFriend: k(0.15, 0, 1, 0.05, '화친·동맹 중인 나라의 사신'),
    envoyCautious: k(0.1, -0.5, 0.5, 0.05, '신중한 나라는 화친을 더 받는다'),
    envoyGreedy: k(-0.1, -0.5, 0.5, 0.05, '탐욕스러운 나라는 화친을 덜 받는다'),
    envoyCommonFoe: k(0.3, 0, 1, 0.05, '동맹 — 같은 적과 싸우고 있으면'),
    envoyGain: k(0.5, 0, 2, 0.05, '교역 — 그들이 얻는 몫(값의 비)당 가산'),
    envoyIronWorth: k(2, 0.5, 5, 0.1, '교역 — 철 하나가 곡식 몇의 값인가'),
    envoyTributePower: k(1.5, 1, 4, 0.1, '조공 — 우리가 이만큼 세야 바탕 위로 오른다'),
    envoyUnknownNode: k(2400, 0, 6000, 10, '(사람 눈금 ×4 — 옛 600) 사신 — 못 본 고을의 군세를 0~이만큼으로 본다 (큰 국읍도 덮게)'),

    /**
     * 외교 둘째판 (2026-10-18, 형: "동맹은 된거면 뭔가 더 할수 있는게 있어야 하는데 없고 … 외교가 좀 재미없음") —
     * 호감(−100..100) · 관계마다 다른 사신 · 동맹의 함께 치기·지원·군대 빌리기 · 깨기의 값
     */
    envoyFavor: k(0.004, 0, 0.02, 0.001, '호감 1 당 받아 줄 확률 가산 (호감 100 이면 +0.4)'),
    favorGift: k(0.4, 0, 2, 0.05, '선물 — 값(곡식 + 철×값) 1 당 호감'),
    favorGiftMax: k(25, 0, 100, 1, '선물 하나로 오르는 호감의 상한'),
    favorAccept: k(6, 0, 30, 1, '사신·청을 받아 주면 서로 호감 +'),
    favorTrade: k(3, 0, 20, 1, '교역이 서면 서로 호감 +'),
    favorMarket: k(1, 0, 10, 0.5, '장터 — 화친·동맹이면 계절마다 서로 호감 +'),
    favorCommonFoe: k(1, 0, 10, 0.5, '같은 적과 싸우고 있으면 계절마다 서로 호감 +'),
    favorReject: k(3, 0, 20, 1, '청을 거절당하면 그 나라 호감 −'),
    favorRefuseAlly: k(10, 0, 40, 1, '동맹의 부탁(함께 치기·지원)을 저버리면 호감 −'),
    favorPlotCaught: k(15, 0, 50, 1, '공작이 들키면 그 나라 호감 −'),
    favorPledgeKept: k(12, 0, 50, 1, '함께 치자는 약속을 지키면 호감 +'),
    deedsKeep: k(14, 4, 60, 1, '나라 사이에 있었던 일을 몇 개까지 적어 두나 (나라 카드 — 오래된 것부터 걷는다)'),
    favorPledgeBroken: k(25, 0, 80, 1, '함께 치자는 약속을 저버리면 호감 −'),
    favorBreakSelf: k(40, 0, 100, 1, '화친·동맹을 먼저 깨면 그 나라 호감 −'),
    favorStation: k(4, 0, 30, 1, '화친·동맹 땅에 약속 없이 군대를 머물게 하면 계절마다 그 나라 호감 −'),
    favorBreakOthers: k(10, 0, 50, 1, '화친·동맹을 먼저 깨면 다른 나라들 호감 − (신의의 값)'),
    favorAllyAsk: k(40, 0, 100, 1, 'AI — 호감이 이만큼 넘으면 동맹을 청한다'),
    favorHostile: k(-40, -100, 0, 1, 'AI — 호감이 이만큼 아래면 조공을 요구하고 사신을 안 받는다'),
    /**
     * 속셈 (stance.ts, 형: "모든 국가들을 승리를 목적으로 행동하니까 · 좀 근거가 있게 움직여야해" — 2026-10-18) —
     * 화친·동맹·깨기는 까닭이 있을 때만 꺼낸다. 까닭이 있을 때 언제 꺼낼지만 굴린다.
     */
    leaderCapitals: k(2, 1, 3, 1, '앞서가는 나라 — 도읍을 이만큼 쥐면 (제 도읍을 넣어)', '개'),
    leaderCapitalsYeongnam: k(2, 2, 10, 1, '영남 판 — 앞서가는 나라가 되는 도읍 수 (나라가 많아 더 높다)', '개'),
    leaderShareYeongnam: k(0.15, 0.05, 0.5, 0.01, '영남 판 — 앞서가는 나라가 되는 힘의 몫 (스물한 나라)'),
    leaderCapitalsSouth: k(3, 2, 20, 1, '삼한 남부 판 — 앞서가는 나라가 되는 도읍 수 (서른여섯 나라)', '개'),
    leaderShareSouth: k(0.1, 0.03, 0.5, 0.01, '삼한 남부 판 — 앞서가는 나라가 되는 힘의 몫'),
    leaderCapitalsWorld: k(6, 2, 25, 1, '삼한과 북녘 판 — 앞서가는 나라가 되는 도읍 수 (쉰 나라)', '개'),
    leaderShareWorld: k(0.08, 0.02, 0.5, 0.01, '삼한과 북녘 판 — 앞서가는 나라가 되는 힘의 몫'),
    leaderShare: k(0.3, 0.1, 0.8, 0.01, '앞서가는 나라 — 살아 있는 나라들 힘의 이만큼을 넘으면'),
    stanceMemory: k(2, 0, 8, 1, '땅을 앗긴 일을 까닭으로 기억하는 계절', '계절'),
    stanceLosing: k(1.2, 1, 3, 0.05, '밀린다 — 그쪽 힘이 우리의 이만큼 배이고 땅을 앗겼거나 군대가 오고 있으면'),
    stanceHungry: k(1, 0, 4, 0.5, '굶주린다 — 곡식이 군량 이만큼 계절치도 안 되면', '계절'),
    stancePrey: k(1.8, 1, 4, 0.1, '만만하다 — 우리 힘이 그쪽의 이만큼 배면 (탐욕스러운 나라가 약조를 깰 까닭)'),
    stanceBreakFloor: k(0.5, 0, 1, 0.05, '너무 커졌다 — 우리 힘이 그쪽의 이만큼은 돼야 등을 돌린다'),
    stanceBigNeighbor: k(1.5, 1, 5, 0.1, '같은 큰 이웃 — 둘이 함께 맞닿은 이웃이 둘 어느 쪽보다 이만큼 배 세고 하나를 치고 있으면 손잡는다'),
    envoyMotive: k(0.25, 0, 1, 0.05, '사신 — 받는 쪽에게도 같은 까닭이 있으면 가산'),
    envoyWinning: k(-0.35, -1, 0, 0.05, '화친 — 받는 쪽이 이기고 있는 싸움이면 가산 (음수)'),
    aiBreakChance: k(0.3, 0, 1, 0.05, 'AI — 깰 까닭이 있을 때 한 계절에 깰 확률'),
    pledgeSeasons: k(2, 1, 6, 1, '함께 치자는 약속의 말미', '계절'),
    aiPledgeFocus: k(0.35, 0, 1, 0.05, 'AI — 약속한 고을을 이만큼 더 쳐 볼 만하게 본다'),
    // 합종 — 앞서가는 플레이어를 겁낸 나라들이 묶여 친다 (coalition.ts · 위원회 11-08 ⑤ · 형: 쉬움은 그대로, 보통부터)
    coalOn: k(1, 0, 1, 1, '합종: 1 이면 연합이 선다 (0 이면 끔 · 견주어 볼 때)'),
    coalThreat: k(2, 0.5, 4, 0.1, '합종: 재물의 위협(log2 나라의 그릇)이 이만큼은 돼야 겁먹은 나라들이 묶인다 (2 = 그릇 4)'),
    coalFade: k(0.75, 0, 1, 0.05, '합종: 위협이 coalThreat 의 이 몫 밑으로 내려가면 두려움이 걷혀 연합이 흩어진다'),
    coalMin: k(3, 2, 8, 1, '합종(보통): 서는 나라 수의 위 끝 (나라가 적은 판은 coalShare 로 줄인다) · 이 밑으로 줄면 흩어진다'),
    coalMinHard: k(2, 2, 8, 1, '합종(어려움 · coalHardTier 부터): 서는 나라 수'),
    coalHardTier: k(3, 1, 10, 1, '합종: 이 난세 단계부터 어려움 값(coalMinHard · coalWarnHard)'),
    coalShare: k(0.5, 0.2, 1, 0.05, '합종: 서는 나라 수는 우리가 아는 살아 있는 나라의 이 몫 (2 부터 coalMin 까지 · 나라 넷 판이면 둘)'),
    coalReach: k(3, 1, 8, 1, '합종: 우리 땅에서 이만큼 길을 건너 닿는 나라가 겁을 먹는다', '길'),
    coalMax: k(5, 2, 10, 1, '합종: 연합에 드는 나라 수의 위 끝 (힘 센 순)'),
    coalWarn: k(2, 1, 6, 1, '합종(보통): 연합이 선 뒤 함께 칠 때까지 (미리 보인다)', '계절'),
    coalWarnHard: k(1, 1, 6, 1, '합종(어려움): 함께 칠 때까지', '계절'),
    coalMarch: k(2, 1, 6, 1, '합종: 함께 치는 출정이 이어지는 동안', '계절'),
    coalFocus: k(0.3, 0, 1, 0.05, '합종: 출정 동안 연합 나라들이 우리 고을을 이만큼 더 쳐 볼 만하게 본다 (ai.focus)'),
    coalGatherFocus: k(0, -0.5, 0.5, 0.05, '합종: 모이는 동안(출정 앞) 노릴 값 · 0 이면 여느 때와 같다'),
    coalLeaveLosses: k(2, 1, 8, 1, '합종: 우리에게 이만큼 싸움을 진 나라는 연합에서 빠진다'),
    coalBrokenRest: k(3, 0, 8, 1, '합종: 출정을 막아 내면 연합 나라들이 새 출정을 쉬는 동안 (달 시계)', '계절'),
    coalBrokenFavor: k(15, 0, 50, 1, '합종: 출정을 막아 내면 연합 나라들의 우리 호감 +'),
    coalFavor: k(20, 0, 50, 1, '합종: 연합이 서면 연합 나라끼리 호감 +'),
    coalRest: k(6, 0, 20, 1, '합종: 연합이 끝난 뒤 새 연합이 설 수 있을 때까지', '계절'),
    coalBrokenPeace: k(1, 0, 1, 1, '합종: 1 이면 출정을 막아 낸 뒤 연합 나라와 저절로 화친 (진 쪽만 장수를 돌려준다 · 앗고 흩어졌으면 싸움이 남는다 · 위원회 11-08b Q2)'),
    leaderRichFirst: k(1, 0, 1, 1, '앞서가는 나라: 1 이면 남의 눈에 살림(집) 1등이고 도읍이 밀리지 않는 플레이어를 먼저 앞서가는 나라로 (쉬움 빼고 · 위원회 11-08b Q3)'),
    envoyLeague: k(-0.15, -1, 0, 0.05, '합종: 연합에 든 나라에 연합의 과녁이 화친·동맹을 청할 때 받아들일 확률 가산 (음수)'),
    envoyGiftAlways: k(1, 0, 1, 1, '선물은 늘 받는다 (1) — 0 이면 굴린다'),
    envoyJoint: k(0.45, 0, 1, 0.05, '함께 치자 바탕 (동맹)'),
    envoyTroops: k(0.3, 0, 1, 0.05, '군대 빌리기 바탕 (동맹)'),
    aidMaxShare: k(0.25, 0, 1, 0.05, '교역·지원 — 제 창고에서 선뜻 내줄 수 있는 몫 (넘으면 덜 받는다) · 지원은 이 몫까지만 준다'),
    envoySpareCut: k(0.3, 0, 1, 0.05, '교역·지원 — 바라는 것이 내줄 몫의 몇 배인가(1 넘는 만큼)당 받아 줄 확률 감산'),
    troopsSeasons: k(8, 1, 12, 1, '원군(동맹이 보낸 군대)이 우리 고을에 머물며 지키는 계절 · 4 는 짧았다 (형 10-30)', '계절'),
    askJointWeight: k(2, 0, 6, 0.5, '동맹 AI 가 플레이어에게 거는 청 — 함께 치자의 무게'),
    askAidWeight: k(1, 0, 6, 0.5, '동맹 AI 가 플레이어에게 거는 청 — 곡식을 보태 달라의 무게 (곡식이 모자랄 때)'),
    aiJointChance: k(0.3, 0, 1, 0.05, 'AI — 동맹에게 함께 치자는 사신을 보낼 확률 (사신을 보내는 계절에)'),

    /** 철의 쓰임 (형: "철은 언제 어떻게 사용하는건지 모르겠네") — 무장 올리기 · 철검 징병. 한 사람당 드는 철 */
    armIronBronze: k(0.025, 0, 1, 0.0025, '(사람 눈금 ×4 — 옛 0.1) 무장 올리기 — 청동으로 (한 사람당 철)'),
    armIronTip: k(0.05, 0, 1, 0.0025, '(사람 눈금 ×4 — 옛 0.2) 무장 올리기 — 쇠날로 (한 사람당 철)'),
    armIronIron: k(0.0875, 0, 1, 0.0025, '(사람 눈금 ×4 — 옛 0.35) 무장 올리기 — 온 쇠로 (한 사람당 철)'),
    armGrain: k(0.025, 0, 1, 0.0025, '(사람 눈금 ×4 — 옛 0.1) 무장 올리기 — 한 사람당 곡식 (채비)'),
    aiIronKeep: k(10, 0, 100, 1, 'AI — 무장을 올리고도 남겨 두는 철 (교역·제사 몫)'),

    /** 소도 제사의 값 (형: "이득이 있는 것엔 대가가 필요한데") — 봄은 거둘 것의 몫, 가을은 곡식 + 철기 제물 */
    riteSpringShare: k(0.12, 0, 0.5, 0.01, '봄 제사 — 올가을 거둘 것(지금 가호 × 수확)의 몫'),
    riteAutumnGrain: k(30, 0, 300, 5, '가을 제사 — 곡식'),
    riteAutumnIron: k(5, 0, 50, 1, '가을 제사 — 철기 제물'),

    /** 손으로 하는 저장 · 불러오기 (형 10-26: "림월드랑 문명에도 있듯이 수동 저장이랑 불러오기도") — ui/realm/saves.ts */
    saveSlots: k(6, 1, 12, 1, '저장 칸 수 (나라 판 「저장 · 불러오기」)'),
    saveNameMax: k(24, 8, 60, 1, '저장 이름 글자 수 한도'),
    saveFileMaxMB: k(20, 1, 100, 1, '「파일에서 불러오기」가 받는 파일 크기 한도', 'MB'),

    /** 그래픽 단계 저사양 · 보통 · 고사양 (ui/realm/quality.ts · 형 10-29: 폰 절전 모드가 세져 그려야 할 것을 못 그렸다 · "저사양 중간사양 고사양 버전 잘 분리되도록") */
    gfxProbeMs: k(2000, 500, 6000, 100, '그래픽 자동: 프레임을 재는 시간 (지도가 처음 뜬 뒤 · 첫 싸움 · 다시 돌아왔을 때)', 'ms'),
    gfxProbeDelayMs: k(700, 0, 3000, 100, '그래픽 자동: 화면이 뜬 뒤 재기 시작까지 (그림 풀기 덜컥임은 빼고)', 'ms'),
    gfxSlowFrameMs: k(28, 18, 60, 1, '그래픽 자동: 프레임 가운데값이 이보다 길면 한 단계 낮춘다 (절전 모드는 30장으로 묶는다)', 'ms'),
    gfxLongFrameMs: k(50, 30, 200, 5, '그래픽 자동: 긴 프레임으로 세는 길이', 'ms'),
    gfxLongShare: k(0.25, 0.05, 0.8, 0.05, '그래픽 자동: 긴 프레임이 이 몫을 넘으면 한 단계 낮춘다'),
    gfxStepGapS: k(60, 10, 600, 10, '그래픽 자동: 단계를 바꾼 뒤 다시 바꿀 수 있기까지 (오르내림 막기 · 자동은 내리기만)', '초'),
    gfxBatteryLow: k(0.2, 0.05, 0.5, 0.05, '그래픽 자동: 충전 중이 아니고 배터리가 이보다 적으면 한 단계 낮춘다'),
    gfxMemMid: k(4, 1, 8, 1, '그래픽 자동: 기기 메모리가 이 이하면 보통까지만', 'GB'),
    gfxMemLow: k(2, 1, 8, 1, '그래픽 자동: 기기 메모리가 이 이하면 저사양', 'GB'),
    gfxSmoothFrameMs: k(18, 12, 30, 1, '그래픽 자동: 프레임 가운데값이 이 아래로 부드러우면(긴 프레임도 거의 없으면) 내렸던 단계를 한 칸 올린다', 'ms'),
    gfxUpAfterS: k(600, 60, 3600, 30, '그래픽 자동: 내린 뒤 이만큼 지나야 다시 올려 본다 (오르내림 막기)', 's'),
    gfxRememberH: k(3, 0, 48, 1, '그래픽 자동: 낮춘 단계를 다음에 켤 때도 이만큼 기억', '시간'),
    gfxRestS: k(45, 10, 600, 5, '배터리: 아무것도 안 누른 채 이만큼 지나면 꾸밈 움직임(눈·깃발·불티…)을 멈춘다 · 싸움 중엔 안 멈춤', '초'),
  },
} as const

type Spec = typeof SPEC
type Values<T> = { -readonly [K in keyof T]: T[K] extends Knob ? number : Values<T[K]> }

function materialize<T extends object>(spec: T): Values<T> {
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(spec)) {
    // 손잡이(k)는 값으로 · 맨 숫자·글·배열은 그대로 · 묶음만 안으로 — 배열·맨 숫자를 묶음으로 풀면 {} 가 된다
    // (10-24: hireCutMs 가 「not iterable」로 등용 장면이 닫히지 않았고, tutStuckMs·backToastMs·hirePopMs 가 {} 였다)
    out[key] = val !== null && typeof val === 'object' && 'v' in val
      ? (val as Knob).v
      : val === null || typeof val !== 'object' || Array.isArray(val) ? val : materialize(val as object)
  }
  return out as Values<T>
}

/**
 * 살아 있는 튜닝 값. 게임 코드는 오직 이것만 읽는다.
 * 튜닝 콘솔이 런타임에 여기를 직접 덮어쓰므로 구조 분해(`const { drawTime } = P.bow`) 하지 말 것 —
 * 값이 고정돼 슬라이더가 안 먹는다.
 */
export const P: Values<Spec> = materialize(SPEC)

/**
 * 콘솔이 쓰는 경로 접근자. 'bow.drawTime' 같은 점 경로.
 *
 * SPEC의 Knob을 찾아 범위로 클램프한다. 슬라이더는 브라우저가 막아주지만
 * localStorage에 남은 저장본을 되살리는 경로는 무방비였다 — `sim.hz: 0` 하나로
 * w.dt가 Infinity가 되어 판이 통째로 죽는다. 노브 이름·범위를 바꾸면 예전 저장본이
 * 새 범위 밖의 값으로 되살아나므로 이론적인 경로가 아니다.
 * 알 수 없는 경로(사라진 노브의 유령 키)는 조용히 무시한다.
 */
export function setParam(path: string, value: number): void {
  if (!Number.isFinite(value)) return
  const parts = path.split('.')
  const leaf = parts.pop()
  if (leaf === undefined) return

  let spec: unknown = SPEC
  for (const part of parts) {
    if (spec === null || typeof spec !== 'object') return
    spec = (spec as Record<string, unknown>)[part]
  }
  if (spec === null || typeof spec !== 'object') return
  const knob = (spec as Record<string, unknown>)[leaf]
  if (knob === null || typeof knob !== 'object' || !('v' in knob)) return
  const kn = knob as Knob
  const v = value < kn.min ? kn.min : value > kn.max ? kn.max : value

  let node: Record<string, unknown> = P as unknown as Record<string, unknown>
  for (const part of parts) {
    const next = node[part]
    if (next === null || typeof next !== 'object') return
    node = next as Record<string, unknown>
  }
  node[leaf] = v
}

export function getParam(path: string): number | undefined {
  let node: unknown = P
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'number' ? node : undefined
}

/** SPEC을 평평한 목록으로. 콘솔 UI 생성용. */
export function flatKnobs(): Array<{ path: string; group: string; knob: Knob }> {
  const out: Array<{ path: string; group: string; knob: Knob }> = []
  for (const [group, section] of Object.entries(SPEC)) {
    for (const [name, knob] of Object.entries(section as Record<string, Knob>)) {
      out.push({ path: `${group}.${name}`, group, knob })
    }
  }
  return out
}

/**
 * 판 밖 상점에서 살 때의 손맛 (11-23 형 「상점 구매할 때도 제대로 사는 기분 뜨게」 · src/raid/shop-juice.ts · 화면 전용).
 * coins 동전 수(단계가 오를수록 maxExtra 개까지 더) · stagger 동전 사이 초 · fly 날아가는 초 · arc 위로 휘는 px · count 금 숫자가 줄어드는 초
 * pop 칸이 부푸는 배 · popMs 그 길이 · rise 「Lv」 글자가 솟는 px · lift 그 글자가 머무는 초
 */
export const HAEBI_SHOP_FX = { coins: 6, maxExtra: 6, stagger: .045, fly: .42, arc: 70, count: .5, pop: 1.2, popMs: 420, rise: 46, lift: .9 } as const
