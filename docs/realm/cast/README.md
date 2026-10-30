# 장수 설정 — 대사·목소리를 고치기 전에 사람부터 (형 10-29)

형 (10-29): *"캐릭터들 설정을 더 공고히 해야 대사 만들 때도 안 헷갈릴 거 같음"* · *"대사랑 목소리들은 내가 개편 필요할 거 같으니 어떻게 해야 내가 편하게 너한테 말해 줄 수 있을지"*

초안 넷(194명 · 초상을 한 장씩 보고 씀): [part-1](part-1.md) g-01~g-52 · [part-2](part-2.md) g-53~g-91 · [part-3](part-3.md) g-92~w-48 · [part-4](part-4.md) w-49~w-96

자란 아이(혼인에서 난 장수 · 얼굴 y-g/y-w): [kids](kids.md) — 물려받은 특성이 얼굴의 갈래를 고른다

## 형이 고르는 법 — 채팅으로 틀린 것만

- 한 장수: `서늘: 28살 · 냉정·과묵 · 목소리 w-cool · 대사 고친 안 좋음`
- 한 줄만: `노을 목소리 → w-sly` · `달구 대사 → "…"`
- 묶음째: `part-2 나머지 다 OK`
- 이름이 겹치면 `id`(예: `samul-ruler`)로

받은 것은 내가 한꺼번에 넣는다 — 목소리 결(voice.ts VOICE_OF) · 등용 대사(hire-lines.ts) · 전략 회의·사건 대사 · 바뀐 줄 다시 녹음(AI 스튜디오 TTS).

## 형이 먼저 정할 것 (모두에게 걸린다)

1. **주군을 「그대」로 부르나, 「주군」으로 부르나** — 지금 등용 대사는 거의 다 「그대 · ~겠소」(대등한 하오체). 초안의 고친 안은 모두 「주군 · ~하옵니다」.
2. **목소리 결을 더 만드나** — 지금 아홉(남 다섯 · 여 넷)에 없는 것:
   - 중년 무장 (남 · 35~50) — 마흔 언저리 사내 열둘쯤이 「젊은 사내」에 있다
   - 늙거나 거친 여인 (여 · 40~55) — 무등 · 소금 · 뱃사공 · 물가
   - 여인 「밝은 젊은 여인」 하나에 서른 넘게 몰려 있다 → 초안은 스물 넘게 「서늘한 여장수」로 옮기자고 했는데, 그러면 거기가 붐빈다 — 「차분한 귀한 여인」(왕비·제사장) 하나를 더 두는 것도 안
3. **특성과 그림이 어긋난 장수** — 특성을 그림에 맞출까, 그림을 다시 그릴까:
   - 하늘(무당 그림 · 궁수 특성) · 대소(술잔 · 먹보) · 감나무·부리·구례마(활 · 궁수 특성 없음) · 압(도끼 · 칼 대사)
   - 이슬(창 · 밤눈·장사꾼) · 단비(대장장이 · 농사꾼) · 다솜(소금 · 농사꾼) · 갈매(활 · 물길) · 오름비(말 · 산사람) · 물결 w-22(범 사냥꾼 · 물길)
4. **이름이 겹친다** — 물결(사물 군주 · 비류나 장수)
5. **그림에서 걸리는 것** — 활미(이마 붉은 점이 빈디처럼) · 신지 너울(젖은 얇은 옷)

## 내가 따로 고칠 것

- 큰 그림(bust-hd)이 없는 초상: g-60~g-70 · w-81
- 쇠울: 새로 그린 g-72 가 아무 장수에게도 이어지지 않고 옛 g-88 로 나온다
- 목소리 결 아홉의 「탭 대답」(네? · 부르셨습니까?)도 같은 결로 — 어린애 끝(~요)이 섞인 것 고칠 안을 따로 낸다

## 10-29 새 목소리 결 넷으로 옮김

형: *"우리 무장들이 이미지로는 20대가 많은데 진지하면 목소리가 다 40대 같다 · 진지하면서도 젊은 목소리"* → 결 넷을 더 만들었다(`src/ui/realm/voice-new.ts` · A 칸만 녹음 · 고르기 판 「새 결 넷」).
**61명 + 자란 아이 얼굴 11개를 옮겼다** — 청년 무장 `m-knight` 5명(견지 서늘 · 견사 사냥개 · 매눈 · 온조 둘) + 아이 얼굴 5 · 젊은 여장수 `w-knight` 23명(대사 해달 · 험측 소리 · 견지 아라 · 삼로 단궁 …) + 아이 얼굴 6 · 중년 무장 `m-veteran` 29명(오간 · 두만 · 대왕 다물 · 견지 쇠돌 …) · 나이 든 여인 `w-matron` 4명(무등 · 소금 · 뱃사공 · 물가). 밝고 들뜬 젊은이와 호쾌·먹보·술꾼 사내(멧돌 · 말굽 · 말발굽 · 왜인 우두머리 · 지백호 · 바다쇠 …)는 그대로 두었다. 옮긴 장수의 등용 첫마디(hire/)는 아직 옛 목소리다.

## 10-29 외침·등용 다시 녹음

형: *"외치는 목소리들이 확실하게 흥분되고 격앙되게 · 지금은 방 안에서 아마추어가 독백하는 느낌"* → 외침(기술 외침 · 싸움 맡김 첫마디 · 이김)을 따로 묶어 격앙된 말투로 다시 뽑고, 고친 등용 대사 194줄도 차분한 사극 말투로 다시 녹음한다. 어디까지 했는지·이어 하는 법은 `hire-rerecord.md` 맨 위 「다시 녹음 진행」.

## 성우진 D (Voice Design 시험)

형 10-30: *"Voice Design 으로 새 성우진 해 볼 수 있겠어?"* (AI 스튜디오 말하기가 Gemini 3.8 Flash TTS · `gemini-3.8-flash-tts` 로 바뀜)

**Voice Design 은 아직 유료다.** 계정 넷(authuser 0 roqkfeke12 · 1 retyper92 · 3 yuncheol · 4 jiiyea PRO)에서 Create new voice → Voice Design 을 누르면 모두 *"Voice Design runs on the paid tier. Link a paid API key to continue."* 와 결제 설정 · 유료 API 키 연결 단계가 뜬다. 목소리 검색(2,000+ 목소리 · Extended Voice Library)도 무료로는 *"Link a Paid Key to explore more voices"* 로 막히고, 무료로 고를 수 있는 여자 목소리는 서른여섯 개뿐이다. 공식 문서: 만든 목소리는 프로젝트마다 200개까지, 마지막으로 쓴 뒤 1년 보관. 문서는 말투 칸(style)에 나이 · 성별을 넣지 말고 목소리 자체를 고르라고 한다.

**그래서 무료 길로 시험** — 젊은 여장수 `w-knight` (지금 A Tari · B Erinome) 를 무료 목소리 가운데 아직 아무 성우진도 안 쓴 젊은 결 셋으로. 대사는 `src/ui/realm/voice-new.ts` 의 w-knight 짧은 대답 셋 · 싸움 맡김 첫마디 둘. 대답 묶음과 외침 묶음은 따로 뽑았다. 계정 authuser=4 (10-30 오전 · 여섯 번).
- D 시험 1번 **Leda** (Youthful · Higher pitch) · 2번 **Pulcherrima** (Forward · Middle pitch) · 3번 **Nyla** (Direct and professional · Medium-high pitch)
- 소리: `public/realm/voice/d/try/w-knight-<번호>-<tap1|tap2|tap3|shout1|shout2>.ogg` · 고르기 판 맨 아래 「성우진 D 시험」
- 음높이 중앙값(대략): A Tari 대답 179~195Hz · 외침 207~253Hz / Leda 170~202 · 275~307 / Pulcherrima 135~168 · 225 / Nyla 177~210 · 285~290

대답 말투 칸 (그대로 넣었다):
> Performed by a professional Korean anime and video game voice actress. A young female general reporting to her lord in a Korean historical drama (sageuk). Neat, composed and resolute; serious but with fresh, light, energetic vocal energy, not matronly and not heavy. Crisp, clear diction, short and firm. Full chest voice, never falsetto or head voice, powerful from the diaphragm. Calm and dignified, not shouting. One-second silence between lines.

외침 말투 칸:
> Performed by a professional Korean anime and video game voice actress. A young female general in a Korean historical drama (sageuk). SHOUTED battle cry on a roaring battlefield, commanding hundreds of soldiers over the noise. Highly excited, furious, adrenaline-charged, at the top of the lungs but full chest voice, never falsetto or head voice, powerful from the diaphragm. Fresh, sharp, youthful energy, not matronly. NOT a calm indoor monologue, NOT reading aloud. One-second silence between lines.

형이 번호를 고르면 그 목소리 이름과 위 말투 칸으로 w-knight 의 나머지 줄(분부 · 이김 · 짐 · 기술 외침 · 등용 첫마디)을 다시 뽑는다. 유료 Voice Design 을 쓰기로 하면(결제 키는 형이) 아래 설명으로 시작한다: *"Korean woman in her early twenties, a young general. Clear, firm mid-range chest voice, bright but grounded, crisp diction, serious and resolute, no breathiness, no falsetto."* (아직 안 써 봄)

### 젊은 여장수 새 목소리 (10-30)

형: *"성우진 D 중에서는 Leda 가 제일 젊네."* → `w-knight` A 를 Tari → **Leda**, B 를 Erinome → **Zephyr** 로 다시 녹음 (`src/ui/realm/voice-new.ts` VOICE_NEW · `voice-b.ts` VOICE_B). 결마다 스무 줄(대답 셋 · 분부 셋 · 맡김 셋 · 이김 · 짐 · 기술 외침 아홉) × 2, 그리고 이 결 장수 스물넷의 등용 첫마디를 castOf 대로(A 9명 Leda · B 15명 Zephyr). 신지 너울(`wander-22`)도 이 결로 되돌렸다.
- B 고르기: Laomedeia 와 Zephyr 로 같은 차분한 일곱 줄을 뽑아 견줌 — 같은 말투 칸에서 Laomedeia 가 음높이 가운데 154Hz · 오르내림 4.2반음, Zephyr 165Hz · 3.3반음 (Leda 193Hz · 2.8반음, 옛 Erinome 190Hz · 3.0반음). Laomedeia 가 더 들떠 Zephyr 로. Laomedeia 일곱 줄은 `voice/d/try/w-knight-lao-*.ogg` · 고르기 판 「젊은 여장수 새 목소리」.
- 말투 칸이 "voice dropped low from the chest" 라 차분한 줄은 B 가 옛것보다 낮게 나왔다(Zephyr 165Hz). A Leda 는 그대로 높다. 외침은 A 262Hz(옛 Tari 262) · B 302Hz(옛 Erinome 327).
- 3.8 TTS 규칙 — 말투 칸은 짧게(나이 · 성별 없이), 대본엔 무대 지시 없이 꺾쇠 태그만. 외침 열셋 가운데 여덟 줄 앞에 `<heavy breath>` · `<grunt>` · `<argh>`. 태그 소리 뒤 쉼이 1초 넘게 나온 줄이 있어, 자를 때 한 줄 안의 틈을 0.4초까지만 남겼다.
- 차분한 말투 칸: *Korean historical anime (sageuk) protagonist, performed by a professional anime voice actor. Resolute and restrained but full of feeling, voice dropped low from the chest, measured pace with weighty pauses, crisp formal Korean diction.*
- 외침 말투 칸: *Korean historical anime (sageuk) protagonist, performed by a professional anime voice actor, SHOUTING a battle cry over a roaring battlefield. Furious, adrenaline-charged, top of the lungs, full chest voice, never falsetto; fast, explosive, clipped delivery.*
- 함정: 아홉 줄 등용 묶음에서 첫 줄(대사 해달)이 3.4초로 짧게 나왔다(둘째 문장을 빼먹은 듯 · 같은 줄만 다시 뽑으니 7.6초). 길이 비가 0.7 아래면 다시 뽑는다. 계정 authuser=4 (10-30 낮 · 여덟 번).
