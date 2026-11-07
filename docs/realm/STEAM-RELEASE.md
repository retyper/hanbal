# 삼한열전 Steam 판매 준비 인수인계

마지막 정리: **2026-11-07**. 같은 날 확인한 공개 1차 공식 자료를 재사용했다. 이번 문서 작성에서는 웹 조사를 반복하지 않았다. Claude/Codex 어느 PC의 세션에서든 저장소 기준으로 이어 읽는다.

## 현재 상태

**조사 완료, 출시 준비 대기.** 이 준비 작업에서는 Steam 제품 등록·수수료 결제·계약 서명·빌드 업로드·Coming Soon 게시를 하지 않았다. 기존 Steam 계정/파트너 계정 보유 여부도 접속해 확인하지 않았다. 판매 절차 질문은 가입·지출·등록·공개 실행 허가로 취급하지 않는다.

현재 프로젝트는 TypeScript + Vite 웹 게임이다. [package.json](../../package.json)에 개발·타입검사·테스트·웹 빌드·예산 검사가 있으며, 삼한열전 진입점은 [realm.html](../../realm.html), [src/realm-main.ts](../../src/realm-main.ts)다. **Steam에서 설치·실행할 데스크톱 패키징 방식과 그 빌드의 작동 여부는 미확인**이다. 웹판이 동작하거나 GitHub Pages 배포가 성공했다는 사실을 Steam 실행형 출시 준비 완료로 바꾸어 기록하지 않는다.

## 확인 완료한 요건

| 항목 | 2026-11-07 확인 내용 |
|---|---|
| 가입 주체 | 개인 소유 콘텐츠는 Sole Proprietorship 유형으로 가입 가능. 법적 실명과 수익금 은행 계좌 명의 일치 필요 |
| 제품 수수료 | 제품당 US$100 또는 지역별 상당 금액. 해당 국가의 소비세 추가 가능 |
| 수수료 회수 | 환불은 아님. 해당 제품의 Steam 상점/인앱 Adjusted Gross Revenue가 US$1,000 이상이 된 뒤 정산에서 회수 가능 |
| 첫 타이틀들 대기 | 제품 수수료 납부 후 **21일** |
| Coming Soon | 신규 제품은 공개 출시 예정 페이지를 **최소 2주** 유지한 뒤 출시 |
| 상점/빌드 심사 | 전용 검토 문서는 보통 **3~5영업일**, 수정 여유 포함 **최소 7영업일 전** 제출 권고 |
| 신원·세금 검증 | 별도 절차. 가입 소개는 전체 15~30일, Onboarding은 세금 확인에 최대30일·추가 서류 가능 안내 |

개인 가입·정보·대기 요건 출처: [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding), [한국어 가입 절차](https://partner.steamgames.com/doc/gettingstarted/onboarding?l=koreana), [Steam Direct](https://partner.steamgames.com/steamdirect). 비용 출처: [Steam Direct Fee](https://partner.steamgames.com/doc/gettingstarted/appfee). 게시·심사 출처: [Coming Soon](https://partner.steamgames.com/doc/store/coming_soon), [Review Process](https://partner.steamgames.com/doc/store/review_process).

검색 스니펫의 오래된 문안에는 30-day waiting period가 있었으나, [그 URL의 실제 본문](https://partner.steamgames.com/doc/gettingstarted/onboarding?language=english&pubDate=20250716)도 당시에는21일이었다. 확인한 Steam Direct·Onboarding 영어/한국어 본문 사이의 21/30일 모순은 없었다. **수수료 후21일과 세금 검증 최대30일은 서로 다른 기간**이다. 모든 요건이 충족되어야 하므로 결제 후 정확히21일 출시를 보장하거나,21일+2주를 무조건 순차 합산하지 않는다. 실제 지출·출시일 결정 때에는 공식 요건을 다시 확인한다.

## 아직 확정하지 않은 것

- **판매 가능한 빌드:** 데스크톱 패키징 선택, 지원 OS, 설치·기동·저장/복구·영상/소리 재생·종료, 배포 용량/성능을 Steam용 환경에서 검증하지 않았다.
- **정식/앞서 해보기 선택:** Early Access도 구매 시점에 실제 플레이 가능한 알파/베타와 현재 가격에 맞는 가치가 필요하다. 미래 완성 약속만으로 개발비를 먼저 받는 제도가 아니다. 지금 빌드가 이 수준인지 판매 준비 검수는 아직 하지 않았다. [Early Access](https://partner.steamgames.com/doc/store/earlyaccess)
- **한국 판매 등급·표시·사업 주체:** 확인한 게임산업법 제21조는 유통 전 등급분류를 원칙으로 하고 예외를 따로 두며, 제33조는 제작/배급자 상호·등급·내용정보 표시를 규정한다. 조회한 조문 버전은 제21조2025-10-23시행, 제33조2024-10-22시행이었다. 유료 판매 계획이므로 비영리 예외를 자동 적용하지 않는다. 이 게임에 맞는 신청 경로·등급·비용·지원/감면·사업자 관련 자격은 미확정이다. Steam 개인 가입 허용과 한국의 사업/세무 요건을 혼동하지 않는다. [제21조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025570237), [제33조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0033&lsiSeq=265811&urlMode=lsScJoRltInfoR), [GCRB 공식 안내](https://www.gcrb.or.kr/English/Enforcement/Enforcement.aspx)
- **한국 등급의 자동 처리 여부:** Steam 콘텐츠 설문만으로 한국 등급 취득까지 완료된다는 공식 근거는 당시 확인하지 못했다. 국내 판매 전 GCRB/GRAC에 PC 유료 배급 방식과 실제 콘텐츠를 제시해 확인해야 한다. 총 출시비를$100뿐이라고 확정하지 않는다.
- **AI 소재의 판매 권리:** 플레이어가 소비할 게임 내 AI 이미지·Veo 영상/소리는 개발 중 미리 만든 **Pre-Generated** 콘텐츠 신고 범주로 정리한다. 저장된 MP4 재생은 게임 실행 중 생성하는 Live-Generated와 구분한다. 신고만으로 권리가 생기지는 않는다. 입력 이미지·도구/모델·생성 당시 이용 조건·폰트/음악/효과음 출처와 이용 범위를 확인해야 한다. 기존 모든 소재의 상업 이용권을 검증 완료한 상태는 아니다. 성인/폭력 콘텐츠도 실제 포함 내용대로 신고한다. [Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey), [배포 가이드라인](https://partner.steamgames.com/steamdirect)

기존 각성 영상/제작의 연속성은 같은 저장소의 [VEO-PRODUCTION.md](VEO-PRODUCTION.md)를 함께 참고한다. Steam 준비를 이유로 이미 완성된 이미지·영상을 다시 만들지 않는다.

## 다음 작업 — 먼저 비용 없이 준비

1. [CLAUDE.md](../../CLAUDE.md)와 현재 Git 변경을 확인해 진행 중인 게임 개발을 보존한다. 이 문서의 확인 완료 항목부터 재검색하지 말고 미확정 항목을 작은 작업으로 나눈다.
2. 지원 OS와 판매 범위를 제안하고, 기존 웹판을 설치·실행할 수 있는 패키징 후보를 좁힌다. 사용자가 구현을 요청하면 격리된 작업 단위에서 시제품을 만들고 실제 실행·저장·영상·종료를 검수한다. 아직 특정 프레임워크나 배포 방식을 채택한 것은 아니다.
3. 실제 제공 기능/미완성 기능, 핵심 플레이 가치, 가격 초안을 정리한다. 기존 게임 플레이를 보여주는 스토어 문안·스크린샷·트레일러 초안을 만든다. 미래 기능을 현재 구현된 기능처럼 쓰지 않는다.
4. 기존 소재의 출처/조건/AI 사용 목록을 작성하고 한국 등급·사업 주체 경로와 비용을 확인한다. 계정 비밀정보 없이 판단에 필요한 결과만 기록한다.
5. 사용자가 출시 진행과 지출을 선택한 후, 본인 절차를 거쳐 제품 수수료·상점·Coming Soon·빌드/콘텐츠 설문 심사를 진행한다. 준비 상태와 실제 공식 대기 요건이 확인되기 전에는 판매일을 확정하지 않는다.

## 사용자가 직접 할 일

- 판매 주체·명의, 지원 플랫폼, 국내 판매 범위, 정식/앞서 해보기 방향, 지출 상한을 결정한다.
- 신원확인 서류·실명·은행 계좌·세금 설문은 공식 Steamworks 절차에서 직접 제출한다. 계약 서명과 수수료 결제는 사용자가 실제 조건을 보고 결정한다.
- 한국 등급/사업·세무 요건의 본인 상황에 따른 확인과 필요한 신청을 처리한다. 조사 결과의 일반적인 개인 가입 허용을 국내 법적 요건 충족으로 간주하지 않는다.

계좌·신분증·세금 식별번호·비밀번호·토큰·세션 원문은 이 문서/저장소에 보관하지 않는다. 후속 세션은 완료·대기·검수 결과·다음 행동을 이 문서에 짧게 갱신하되, 가입/지출/공개가 실제로 이루어지지 않았다면 완료로 표시하지 않는다.
