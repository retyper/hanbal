# 열전 스킬 표시명 개선 — 2026-11-21

승인한 주 이름26개를 적용했다. `폭렬비도`, `파천일섬`을 포함하고 root 조정 `질풍회륜`·`진탕격`과 패시브6개를 반영했다. ID·수치·효과·부모·선행조건·title·weapon·UI요소는 바꾸지 않았다. source는 검수 후 고정하며 커밋·푸시는 root 담당이다.

## 최종26개

| 경로 | 이전 | 최종 |
|---|---|---|
| POWERS.tempo | 몰아치는 기세 | **맹공** |
| POWERS.reach | 큰 물결 | **확산** |
| POWERS.spear | 꿰뚫는 창 | **관통창** |
| POWERS.skip | 물수제비 | **연환석** |
| POWERS.tough | 단단한 몸 | **철벽** |
| POWERS.breath | 숨 고르기 | **재생** |
| POWERS.nimble | 날랜 발 | **신속** |
| POWERS.stout | 굳센 몸 | **불굴** |
| KITS.axe.skill | 천지 가르기 | **천지개벽** |
| KITS.bow.skill | 하늘 꿰뚫기 | **파천일섬** |
| KITS.sword.skill | 번개 베기 | **섬광참** |
| KITS.dagger.skill | 그림자 베기 | **환영난무** |
| KITS.magic.skill | 하늘 굿 | **천벌** |
| NODE_TEXT.axe.capA | 땅 가르기 | **대지파쇄** |
| NODE_TEXT.axe.capB | 돌아오는 회오리 | **질풍회륜** |
| NODE_TEXT.bow.capA | 꿰뚫는 일제 | **관통일제** |
| NODE_TEXT.spear.capA | 삼지창 | **삼방관통** |
| NODE_TEXT.spear.capB | 솟는 창 | **대지창격** |
| NODE_TEXT.dagger.capA | 독 묻은 쌍검 | **맹독쌍검** |
| NODE_TEXT.dagger.capB | 터지는 비도 | **폭렬비도** |
| NODE_TEXT.magic.capB | 갈라지는 혼불 | **분열혼불** |
| NODE_TEXT.sling.capB | 끝없는 물수제비 | **연쇄격** |
| COMBOS.boomerang | 돌아오는 창 | **회귀창** |
| COMBOS.splitwave | 갈라지는 검기 | **분열검기** |
| COMBOS.boulder | 굴러가는 바위 | **거암돌진** |
| COMBOS.daze | 어지럼 돌 | **진탕격** |

`연환석` 자기참조가 구명칭으로 돌아가지 않도록 숙련 표시1개(`물수제비 숙련→연환석 숙련`)와 관련설명3곳의 이름만 연동했다. 신규개명26개와 별도인 의존문구 정합성 수정이다. `NODE_TEXT.sling.b=물수제비`는 기존 갈래분류값이므로 보존했다. capC 반격설명과 진비기는 `KITS.skill`에서 자동파생되며 코드변경이 필요없었다.

## 직접 확인한 불변 근거

- 실제 변경전 모듈 스냅샷과 변경후 모듈에서 name/desc/title/skill만 제외한 데이터가 deep equal. ID/needs/max/icon/color 및7개kit의 branchNodes/powerParents/kitPowers/combo needs/treeTotal 전후동일. title/weapon도 별도동일확인.
- TypeScript AST에서 표시문자열4종만 마스킹하고 주석을 제외해 출력한 실행코드 SHA가 전후동일. 기준 e184fe3e 소스의 SHA가 편집전 실제스냅샷과일치함도 확인했다.
- 정의데이터 SHA 전후 `3a06c492bc04244f634f03900033e7c038b3060c59e8cae9226aa3da5c6c56cb`. 부모/갈래/needs계산 SHA 전후 `1ac7c349ccdb655e691d72e4599522122408a1c017b69b6ac6ee5d785212f6c4`.
- `treeSvg`/`powerTooltip` 기존렌더러를 실제 createHaebi(seed7,stage,kit)로7종 실행: 승인26명칭26/26표시, 구기술명표시0. 반격설명/진접두7종 자동연동. 이것은 렌더러HTML검사이며 실제브라우저클릭검사는 아니다.

## 검수

- Node22.19.0/npm10.9.3 고정판 일치. `npm run typecheck` 통과.
- 관련기존8파일62검사 통과, 실패0·skip0. tree/52부모·갈래·비기·돌팔매·무기묶음 포함. 실제 gameplay/데이터변경없는이름작업이라 전체1682/빌드는 반복하지 않았다.
- 신규테스트0. 기존검사 제목과 기존`진 천벌`표시기대값만 연동했다. haebi-view 변경은 현재기술명을설명하는주석뿐이다.
- 52증거원본·BALANCE·과거문서수정0, 가로UI새요소0, 53-A기능코드0. 기존타세션변경·미추적에셋보존.

## 한계와 인수인계

실제 브라우저 글자배치·컷인입력은 root검수대상이며 본 작업자브라우저사용0. full검사·빌드·커밋·푸시0. 다음은 root의52CI확인→이름커밋/푸시/CI이며53-A는별도GO전까지시작하지않는다.

세부스냅샷/전체비교/로그: `C:/Users/my/Documents/Codex/2026-11-17/detail-bad-request/outputs/codex53/NAMES-RESULT.json`.
