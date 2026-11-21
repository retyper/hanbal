# Claude 인수인계 · 64 역할 분담

Codex 마지막 코드카드는전투소개v2만이다. 결과는CODEX61-INTRO-RESULTS.md,최종commit/CI는창고CODEX-TO-CLAUDE-LATEST.md맨위참조. 그뒤src/tests/tools.ts는Claude담당, 그림은Codex/영상은Claude다.

- **Claude즉시:** 58-B다른화면글자후속. 이미실제장수6view/열전7view/전투6view가시최소12px인후보가C outputs/codex61-landscape2/CLAUDE-font-candidates/에있다. appstyle.ts/combat.css/keyboard.css세파일과battle-font-insertion-final.json을검토해적용한다. 통째battlefield복사는금지하고소개v2위에font삽입만. 전투/장수scope scrollWidth8~14px(문서0)은원인미확정, 단련은정상종료저장전제미충족. 해당보고서other-heroes-03/other-raid-04/other-battle-final-02를재사용해중복조사줄일것.
- **그다음62-A:** C outputs/codex62/{PREP.md,RED-CONTRACTS.md,DESCRIPTOR-INVENTORY.json,PREDICTION-NOTE.md}. raid정규칸공격12..17/피격18, duel원본index와혼동금지. 근접피해는수락tick즉시라긴선행예비+sim0+49맞힘동기화를모두달성했다고주장하면안된다. privateviewmemo/실제거리발위상/pause·hidden·hitstop보존. 기존4exactreplaySHA는60 LEGACY-ANCHORS.json재사용.
- **50ms도구:** 같은outputs/codex62/actual-motion-ui.mjs·MOTION-TOOL.md·frame-grid.mjs. before-dana-01은도구QA로55JPEG이며첫두표본gap/공격중stop이있다. TOOL-FIRST-QA.md참조,최종3명전후증거아님. 다음첫키전실JPEG2장+100mspre-roll과poststartcanvasbbox관측만보완하면된다. 실제입력만/상태·시계주입금지/Chrome1개.
- **뒤코드:** 58-A링→59-A타이틀→56-C목책→나머지보스/51교체등64순서. 그림등록/manifest연결/retire-history/CI/운영검수도Claude담당. 63쇠비무기설정은형판정전설정·그림무기변경금지.
- **Codex그림:** 64-1키아트가로/세로02(native,활내림/가로상단하늘/찰갑교정)가D:/에셋창고/에있다. 기존무기보존. 62-B해비8걷기시험1장은codex62/haebi-walk8-01-native.png, alpha미세점/발선/정확위상검토때문에등록HOLD(QA.md). 누적생성26/RAW26, 이번3회/재생성0. 이후62-B나머지→58-C매화→56-C배경/props→55부위→53-B/51→47·48. 시위를당기는자세는앞으로모든문안금지.
- **보존:** D의HANDOFF.md/ART-VIDEO-STATUS.md/CODEX-RESUME-CURRENT.md/CODEX57-RESULTS.md/CODEX60-RESULTS.md와기존untracked산출물은그대로. whitelist stage만, add-A/clean/reset금지. 원본RAW/HOLD/실패보존. 이미쓴prepare/install/finalize/commit카드재실행금지.
- **런타임:** D:/flutter/arrow_game_one, C격리worktrees/dana60는실node_modules설치/symlink0. Node22.19.0/npm10.9.3/CI파일일치. 배포번들PUBLIC_BASE=/hanbal/,정확commit지문비교때GITHUB_SHA=실commit. 시작시현재branch/dirty/gh run list --limit5확인. 끝난후Codex는코드자동대기/조사하지않고그림카드만진행한다.
