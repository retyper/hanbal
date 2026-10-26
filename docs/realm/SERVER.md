# 서버 — 계정 · 판 맞추기 (SERVER)

> 2026-10-22. BUILD §8-2 Q12 의 ① 파이어베이스를 짓는 설계. 형: "데이터베이스 작업은 설계가 아주 중요하기 때문에 제대로 설계하고 진행해."
> 프로젝트 `chilsippalguk` (콘솔: 형 계정 roqkfeke12) · Firestore 서울(asia-northeast3) · 무료 Spark · Google 로그인.

## 0. 지키는 것

| # | 원칙 | 왜 |
|---|---|---|
| S1 | **기기가 먼저, 서버는 뒤따른다.** 판은 늘 기기에서 돌고 기기에 저장된다. 서버가 없어도·끊겨도·로그인 안 해도 다 된다 | 3초 복귀 · 오프라인 · A1 결정론 — 엔진은 서버를 모른다 |
| S2 | **몰래 덮지 않는다.** 두 기기에서 따로 나아간 판은 사람이 고른다 | 형의 판이 날아가면 안 된다 (BUILD §8-1 의 1번) |
| S3 | **늘기만 하는 것은 합친다** (도감 · 혈통 · 해금·휘장 · 단련 · 유물) | 어느 기기에서 얻었든 잃을 까닭이 없다 |
| S4 | **의존 0.** 파이어베이스 SDK 를 넣지 않고 REST(fetch) 로 | ARCHITECTURE A6 · 웹 묶음 +0KB |
| S5 | **개인 정보는 받지 않는다.** Firestore 에는 uid 밑의 게임 자료만. 이메일·이름은 파이어베이스 인증에만 있다 | 스토어 데이터 안전 항목을 짧게 · 지우기 쉽게 |
| S6 | **무료 칸 안에서.** 쓰기는 몰아서, 읽기는 필요한 칸만 | Spark: 하루 읽기 5만 · 쓰기 2만 · 저장 1GiB |

## 1. 무엇을 올리나

지금 기기 저장(localStorage, BUILD §8-2) 을 셋으로 나눈다.

| 기기 칸 | 서버로 | 까닭 |
|---|---|---|
| `hanbal.realm.v2` 판 (realm · before · report · log) | **판** — `saves/main` | 이어 하기 |
| `.dex` 도감 · `.clan` 혈통 · `.unlock` 해금·난세·휘장 · `.drill` 단련 · `.relics` 유물 · `.retain` 계승 가신 | **판 밖에 쌓인 것** — `users/{uid}.progress` | 합친다 (S3) |
| `.games` 판 기록 (계절마다 명령·보고·누른 것) | **판 기록** — `records/{seed}` | 형 판 기록 원칙 · 끝 화면 연대기(history)가 이 기록을 읽는다 — 다른 기기로 옮겨도 연대기가 이어진다 |
| `.v2.prev` 한 계절 앞 저장 | 안 올림 | 기기 안의 되살리기용 |
| `.draft` 이번 계절 명령 · `.tut` `.seen` `.layers` `.mute` | 안 올림 | 기기마다의 설정·손놀림 |

## 2. 문서 모양

```
users/{uid}                      계정 한 장 — 작다
  v          int     1
  progress   string  JSON {dex, clan, unlock, drill?, relics?} — 합친 결과 (콘솔에서 사람이 읽을 수 있게 문자열)
  updatedAt  timestamp (서버 시각)

users/{uid}/saves/main           판 한 벌 — 계정마다 하나 (나중에 칸을 늘리면 main 옆에 slot2…)
  v          int     1                      이 문서 꼴
  fmt        string  'gz'                   data 가 gzip(JSON(Saved)) 이다
  data       bytes   gzip(JSON(Saved))      Saved 는 realm-main 의 v:2 그대로 (migrate 도 그대로 탄다)
  seed       int     판의 시드 — 판의 이름
  rev        int     log.length — 이 판에서 넘긴 계절 수. 같은 판이면 클수록 새것
  h          string  logHash(log) — 명령 기록의 지문(FNV-1a). "서버 판이 내 판의 앞부분인가"를 data 없이 가린다
  meta       map     {nation, nationName, region, tier, season, outcome?}  고르기 카드용 — data 를 안 풀고 보인다
  device     map     {id, kind: 'web'|'android'|'ios'}
  savedAt    string  기기 시각 (ISO) — 사람에게 "3분 전"
  updatedAt  timestamp (서버 시각)

users/{uid}/records/{seed}       판 기록 한 판에 한 장
  v, fmt:'gz', data: gzip(JSON(GameRecord)), nation, region, started, end (map|null), updatedAt
```

**크기** (`tools/realm-savesize.ts`, planner AI 로 끝까지): 북녘 60계절에 판 313KB · 기록(log) 308KB — before 까지 날것이면 ~930KB 로
**문서 한 장 한계(1MiB) 바로 밑**이다. gzip 하면 판 37KB · log 27KB → 한 벌 ~100KB. 그래서 `data` 는 **gzip 바이트**다
(브라우저 `CompressionStream('gzip')` — 크롬 80 · 사파리 16.4 · 웹뷰 다 있다. 없는 곳은 서버 맞추기를 끈다). 300계절도 ~500KB 안쪽.

`progress` 는 몇십 KB 라 문자열 JSON 그대로 — 콘솔에서 형이 바로 읽는다.

## 3. 맞추기 — 언제 · 무엇을

기기는 마지막으로 맞춘 자리를 적어 둔다: `hanbal.sync` = `{uid, seed, rev, updateTime}` (updateTime 은 서버 문서의 것).

### 3-1. 판 (saves/main)

열 때(로그인돼 있으면) `saves/main` 의 **meta·seed·rev·updateTime 만** 읽는다(field mask — data 는 안 받는다). 그다음:

| 서버 | 이 기기 | 한다 |
|---|---|---|
| 없음 | 있음 | 올린다 |
| 있음 | 없음 | 받는다 (data 를 받아 풀어 기기에 저장) |
| 같은 판(seed 같음), 서버 rev > 기기 rev, 기기는 마지막 맞춤 뒤 안 나아감 | | 받는다 — 다른 기기에서 더 둔 판 |
| 같은 판, 기기 rev > 서버 rev, 서버는 마지막 맞춤 그대로(updateTime 같음) | | 올린다 |
| 둘 다 나아감(처음 맞추는 기기 · 로그아웃 뒤 포함), 같은 판, 기기 rev ≥ 서버 rev, 기기 기록의 앞 rev 계절 지문 = 서버 h | | 올린다 — 서버 판이 내 판의 앞부분이다 |
| 둘 다 나아감, 같은 판, 서버 rev > 기기 rev | | 서버 판을 받아 본다 → 내 기록이 그 앞부분이면 받고(lineage), 아니면 고른다 |
| 그 밖 (같은 판이 갈라짐 · 다른 판) | | **고른다** — 카드 둘: "이 기기 판(사로국 · 3년 봄 · 방금)" / "저 기기 판(구야국 · 1년 가을 · 2시간 전)". 고르지 않은 쪽은 기기의 `.v2.prev` 처럼 한 벌 남긴다(`hanbal.realm.v2.other`) |
| 같음 | 같음 | 아무것도 안 한다 |

올리기:
- **계절을 넘길 때** — 단, 마지막 올림에서 **2분** 안이면 미뤄 둔다(더러움 표시). 쓰기를 아낀다 (S6).
- **탭이 가려질 때 · 앱을 닫을 때**(visibilitychange hidden) 미뤄 둔 것이 있으면 올린다. 이때는 `fetch(keepalive)` — 몸이 64KB 를 넘으면 keepalive 가 안 되니 그냥 다음 열 때 올린다.
- **판이 끝났을 때** 바로.
- 올릴 때 **updateTime 을 조건으로** 건다(`currentDocument.updateTime`). 그사이 다른 기기가 올렸으면 실패한다 → 위 표로 돌아가 고르게 한다. 몰래 덮지 않는다 (S2).

### 3-2. 판 밖에 쌓인 것 (users/{uid}.progress)

합치기 — 순수 함수 `mergeProgress(a, b)` (시험):
- 도감: 장수마다 `f` 는 비트 OR(들음·만남·사로잡음·거느림), `b`(처음 본 판)는 먼저 있던 쪽
- 혈통: 열쇠(`seed:hero`)로 합집합
- 해금: `won` 합집합 · `tiers`·`nations`(휘장) 판마다 큰 값 · `tutorial` 은 done > quit
- 계승 가신: 시드가 다르면 **더 나중에 끝난 판**의 것 (같으면 기기 것)

열 때 받아서 합치고, 합친 것이 서버와 다르면 올린다. 판을 넘길 때마다가 아니라 **도감·해금이 바뀐 계절**에만, 판과 같은 2분 묶음으로.

### 3-3. 판 기록 (records/{seed})

판이 끝날 때와, 판 올리기와 같은 박자(2분 묶음)로 지금 판의 기록 한 장을 덮어쓴다. 기록은 받지 않는다 — 다른 기기에서 그 판을 이어 하게 되면 그때 받아 기기의 기록 앞에 잇는다(같은 seed).

## 4. 로그인 (SDK 없이)

웹:
1. 「구글로 이어 하기」 → `accounts.google.com/o/oauth2/v2/auth` 로 보낸다 (`response_type=id_token`, 파이어베이스가 만든 웹 OAuth 클라이언트 id, `nonce`, `redirect_uri` = 지금 realm.html).
2. 돌아오면 주소 조각(#id_token=…)을 읽고 곧바로 지운다(history.replaceState).
3. `identitytoolkit.googleapis.com/v1/accounts:signInWithIdp` (postBody `id_token=…&providerId=google.com`) → 파이어베이스 `idToken`(1시간) · `refreshToken` · `localId`(uid).
4. `refreshToken` 만 기기에 둔다(`hanbal.auth`). idToken 은 메모리 — 끝나면 `securetoken.googleapis.com/v1/token` 으로 새로.

앱(Capacitor, 출시 때): 기기 로그인 플러그인이 구글·**애플** id_token 을 주면 3번부터 같다(`providerId=apple.com`). 애플 4.8 — 구글을 두면 애플도.

구글 클라우드 콘솔에 할 일: 웹 OAuth 클라이언트의 **승인된 자바스크립트 원본**(https://retyper.github.io · http://localhost:5173)과 **리디렉션 URI**(https://retyper.github.io/hanbal/realm.html · http://localhost:5173/realm.html).

## 5. 계정 지우기 (애플 5.1.1(v) · 구글 플레이)

나라 판 「계정」 → 「계정 지우기」 → 두 번 묻는다 → `records/*` · `saves/main` · `users/{uid}` 지우기 → `accounts:delete` → 기기의 `hanbal.auth`·`hanbal.sync` 지우기. **기기의 판은 남긴다**(손님으로 계속).
로그아웃은 `hanbal.auth`·`hanbal.sync` 만 지운다.

## 6. 보안 규칙 (`firestore.rules`)

- `users/{uid}` 와 그 밑은 **로그인한 그 사람만** 읽고 쓴다.
- 쓸 때 꼴을 본다: 정해 둔 필드만(`keys().hasOnly`) · `data` 는 bytes 이고 900KB 아래 · `progress` 는 문자열 200KB 아래 · 판 칸 이름은 `main`(과 나중의 slot2…)만.
- 남의 것을 읽는 길은 없다. 형(개발자)은 콘솔에서 본다.

## 7. 무료 칸 셈 (S6)

한 사람 하루: 열 때 읽기 2~3(계정 · 판 meta · 필요하면 판 data) · 판 넘김 40계절이면 올리기 ~10~20(2분 묶음) + 기록 같은 수 + 도감 몇.
→ 한 사람 하루 쓰기 ~50 · 읽기 ~10. **쓰기 2만/일이면 하루 400명** 남짓까지 무료. 넘기 전에 묶음 간격(2분)을 늘리거나 Blaze(쓴 만큼, 10만 쓰기 ≈ 0.18달러)로.

## 8. 짓는 차례 (작게 끊어서 · 늘 돌아가는 상태)

1. **이 문서 · 규칙** (지금)
2. `src/net/firestore.ts` — REST 꼴 바꾸기(JSON ↔ Firestore Value: string·int·double·bool·map·array·bytes·null·timestamp) · get(필드 마스크)/patch(updateTime 조건)/delete. 시험: 꼴 바꾸기 왕복
3. `src/net/bundle.ts` — 기기 칸 모으기·풀기 · `mergeProgress` · 맞추기 결정표(§3-1)를 순수 함수 `plan(local, remote, last)` 로. 시험: 표의 줄마다
4. `src/net/auth.ts` — §4 (구글 클라우드 콘솔 리디렉션 설정 먼저)
5. `src/net/sync.ts` — 열 때·넘길 때·가려질 때 · 2분 묶음 · gzip
6. 화면: 나라 판 「계정」(로그인/로그아웃/지우기/마지막 맞춘 때) · 고르기 카드 둘 · 첫 화면에 「구글로 이어 하기」 작은 줄
7. 형이 폰·피시에서 로그인해 같은 판이 이어지는지 본다 (구글 로그인 창은 내가 누르지 못한다 — 형이 누른다)

## 9. 검토에서 고친 것 (2026-10-22 · 다른 눈으로 본 뒤)

| 구멍 | 고침 |
|---|---|
| 기기 판이 맞춘 자리보다 **물러났는데**(저장 칸이 차서 쓰기 실패 · 옛 저장으로 떨어짐 · 묵은 탭) "나아갔다"로 보고 서버를 덮음 | 맞춘 자리에 기록 지문(h)도 적는다. 서버가 그대로여도 기기 판이 그 자리의 뒤를 이은 것일 때만 올리고, 아니면 받아 보고(lineage) 가린다 |
| 맞추는 사이(네트워크 기다림) 형이 계절을 넘기거나 새 판을 열었는데 **받기가 덮음** | 받기 직전에 기기 판이 셈할 때 그대로인지 다시 본다 — 다르면 처음부터 다시 셈한다. 맞추는 중에 들어온 계절은 "한 번 더"로 받아 둔다 |
| 다른 기기 판을 고르고 새로고침하는 순간 **가려질 때 올리기가 버린 판을 올림** | 서버 판으로 바꾸는 중(adopting)에는 아무것도 올리지 않는다 · 고르기·맞추는 중에는 가려질 때 올리기를 안 한다 |
| 받은 판을 기기에 못 썼는데 "맞췄다"고 적어 다음에 옛 판을 올림 | 기기에 쓴 뒤에만 적는다 (adopt 가 성공 여부를 돌려준다) |
| 계승 가신이 서버에서 되살아나 같은 셋이 또 따라옴 | 계승 가신은 맞추지 않는다 (기기마다) |
| 쓰기(commit)의 404 를 성공으로 침 | 404 는 읽기에서만 "없음", 쓰기에서는 실패 |
| 판 밖에 쌓인 것이 실패하면 판 올리기까지 멈춤 | 따로 감싸 실패해도 판은 맞춘다 |
| 두 기기가 서로 제 것을 번갈아 올리는 핑퐁 (이긴 판 차례 · 겹친 값) | 이긴 판은 정렬 · 겹치면 늘 서버 쪽 |
| 계정 지우기에서 로그인이 오래돼 계정은 남았는데 맞추기가 살아 다시 올림 | 그때는 로그아웃까지 하고 "다시 들어와 한 번 더" 안내 |
| 토큰이 죽어도(다른 기기에서 계정을 지움) 오류로 굳음 | 그때는 로그아웃 → 손님 |
| keepalive 몸 크기를 gzip 바이트로 잼 (실제는 base64 + JSON) | 보낼 JSON 길이로 잰다 |
| 고르기에서 남긴 한 벌을 평범한 받기마다 덮음 | 한 벌은 고르기에서만 남긴다 (평범한 받기는 기기 판이 서버 판의 앞부분이라 잃는 것이 없다) |

남은 것 (출시 전에):
- **혼자 무료 칸을 다 태우는 길** — 아무 구글 계정이나 제 칸(records)에 무한히 쓸 수 있다. 출시 전에 **App Check**(웹: reCAPTCHA Enterprise · 앱: Play Integrity / App Attest)를 붙이고, 판 기록 칸 수를 묶는다.
- iOS 홈 화면 앱은 로그인 갔다 오면 sessionStorage 가 달라 state 가 안 맞을 수 있다 — 앱(Capacitor)은 기기 로그인 플러그인으로 가니 웹 홈 화면 앱에서만 본다.
- 저장 칸이 차서 기기 저장이 실패할 때 화면에 알리기 (지금은 조용하다 — 서버를 덮지는 않게 됐다).
