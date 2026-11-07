# 삼한열전 제작 인수인계 — 2026-11-07 KST 스냅샷

이 폴더는 Windows Codex 작업의 **휴대용 읽기 전용 기록**이다. Claude Code 또는 Mac Codex가 읽어도 된다. 여기의 `veo-status.snapshot.json`은 실행 큐가 아니며, JSON의 상태는 작성 시점 이후 바뀔 수 있다. Gemini에 새 요청을 보내기 전에 반드시 Windows 실시간 원장과 브라우저를 대조한다.

## 전투 애니메이션 현황

과거 idle의 PASS 표시는 새 기준을 대신하지 않는다. 아름 w20의 `areum-idle-source.png`는 11월7일 원초상 직접 재대조에서 베이지 안옷/어깨끈 앞치마가 배 노출 짧은 상의로 변경돼 HOLD로 정정했다. 게임에 넣거나 이 복식으로 모션을 추가하지 않는다. 다음 검토 후보 구름 w49는 긴 치마·청동 잔을 유지해야 하며, 전용 치마 보행과 기존 게임 공격 분류 확인이 선행한다. 물결 마법 같은 새 능력을 추정해 만들지 않는다.

| 장수 | 상태 | 검수·적용 근거 |
| --- | --- | --- |
| 갯내 w-37 | 완료·공개 | `public/realm/anim2/gen-gaennae.png` 20셀, 4개의 실제 하체 보행 자세를 각 2틱 사용. 공격 준비→접촉→복귀, 피격·쓰러짐 연결. 공개 배포 기록은 `89496eaa`에 있다. |
| 부들 w-32 | 완료·공개 | `public/realm/anim2/gen-budeul.png` 20셀, SHA-256 `cba88633d7d9bf8a9643493f6fa5b5930499297098ce5d3a0a2cda7971cf16cb`. **갯내의 검수된 짙은 바지·갈색 장화 하체 4자세를 재사용**하고 부들 고유 상체·단검·도롱이·이삭·허리 장식을 유지했다. 1·2·2.5배 실전 렌더러 검수와 새 배포 `f13cd794`, 공개 HTTP 200/140617바이트가 기록됐다. |
| 불매 w-38 | HOLD | 보행 하체 후보는 있으나 오른손 망치의 실제 접촉 자세가 무기·자루 중복 또는 파지 단절로 실패. 최종 20셀 없음. 임의로 접촉 프레임을 채워 적용하지 않는다. |
| 활미 w-65 | HOLD | 전신 보행 시트와 반대발 단독 생성이 앞발 교대·장비 일관성 기준을 통과하지 못했다. 정지 후보가 있어도 완성 모션으로 보지 않는다. |
| 범발 w-68 | HOLD · 독립 검수 정정 | 기존 idle 통과 기록과 달리 실제 원초상의 범가죽 쪽 뺨 줄무늬를 반대 뺨으로 옮겼다. 신규 동작 시트도 같은 문제. idle/동작 각1회 한정 교정이 실패해 중단했다. 무기/범가죽 위치가 정상이라 전체 반전으로 고치지 않는다. 공통 하체 조립과 준비/찌르기/피격 후보는 Windows work에만 있으며 게임 미적용. |
| 소금비 w-44 | 20셀 게임 연결 · 배포 확인 중 | `gen-sogeumbi.png` 5600×160/160272바이트, SHA256 `331bfa5475464ff001e7e923e44a0f25c0176a7abb3325dfa1b3fbb092732a5b`. 원6시트의 손 바뀐 ML/BR은 보류. TR 위검→원래 MR 복귀를 짧은 내려베기 접촉으로 재해석, TL 하체/발 고정. 별도 낙검 컷은 두 손을 놓고 바닥에 같은 검1개를 떨어뜨림. 독립 검수·테스트19·빌드/예산 통과. [규격/출처](../SPRITE-SOGEUMBI.md), 실제 서버 버전/해시로 배포 여부 확인. |

세부 검수·실패 원인은 Windows Codex 산출물 `outputs/sprite-young-generals-20261107-status.md`에 있다. 전투 스프라이트와 Veo 각성 idle 영상은 서로 다른 제작물이다.

## Veo 소유권과 실시간 원장

- **현재 제출 담당:** Windows Codex의 `veo-1` 예약 작업. 2026-11-07 17:54 KST에 Gemini 사용 가능 여부를 확인하도록 예약된 기록이다. 실제 해제·진행 여부는 그때 브라우저와 원장으로 확인해야 한다. Mac/Claude가 이 시각에 별도 제출하지 않는다.
- `u/0`~`u/5`는 이 Windows 브라우저의 계정 순서다. Mac이나 다른 프로필의 동일 번호가 같은 계정이라는 보장은 없으므로 계정 표시와 기존 대화를 확인한다.
- Windows에서 유지한 `39d1717d94fd67e8` 탭은 **완료된 범발 진각성 대화의 한도 안내 참고용**이다. 다음 인물은 해당 job의 원본·문안으로 새 채팅에서 만들며, 이 옛 대화에 다시 제출하지 않는다.
- **실행 큐:** `C:\Users\my\Documents\Codex\2026-11-06\windows-pc-claude-code-claude-code\outputs\veo-production-queue.json`
- **실행 원장:** `C:\Users\my\Documents\Codex\2026-11-06\windows-pc-claude-code-claude-code\outputs\veo-production-state.json`
- **큐 도구:** `D:/flutter/arrow_game_one/tools/veo/queue.mjs`; Windows 산출물 `outputs/veo-queue-runbook.md`에 claim→submitted→downloaded→review 순서와 복구 절차가 있다.
- **기록 당시:** active 0, claim 0, accepted 2(해솔·별), held 3(매화 2건·달리 1건). `veo-status.snapshot.json`은 이 시점의 복제본이다. 원본이나 크레딧 상태가 바뀌면 즉시 오래된 기록이 된다.
- **다음 안전 후보:** 불매 `t1-bulmae-first` → 시내 `t1-sinae-first` → 쇠눈 `t1-soenun-first` → 범 `t1-beom-first`. 문안은 `veo-prompts/bulmae-t1.txt`, `veo-prompts/sinae-t1.txt`; 입력 그림은 각각 `public/realm/awaken-hd/w-38-sangdang-bulmae.jpg`, `public/realm/awaken-hd/w-61-iseo-sinae.jpg`. 두 문안은 Windows 원문과 SHA-256이 같게 복사했다. 추가 문안은 `veo-prompts/soenun-t1.txt`, `veo-prompts/beom-t1.txt`, 원본은 각각 `public/realm/awaken-hd/w-42-gwanna-soenun.jpg`, `public/realm/awaken-hd/w-60-golbeol-beom.jpg`다. 양손 투구 접촉/전방 발톱 손이 가까이 모여 있어 루트도 직접 원본 구도를 확인했다. 후보 순서도 실제 원장·Gemini 대기·크레딧 재확인 뒤에만 유효하다.
- **초상 교정 대기 25명:** `veo-status.snapshot.json`의 `portraitRepairs`에 목록이 있다. `w66` 포함. 사용자가 교정 이미지를 실제 검수하고 원본/해시를 갱신하기 전에는 자동 해제하지 않는다. 별은 예전 영상이 시각적으로 accepted였으나 현재 초상 교정 대기 목록에도 있으므로 그 승인과 신규 제출 가능성을 혼동하지 않는다.

## 품질·재시도 기준

현재 기준은 [veo-rules.md](veo-rules.md)를 먼저 읽는다. 아래는 제작 상태를 설명하는 요약이다.

Veo는 각성 idle에만 쓰고 장수별로 하나씩 제작한다. 먼저 9:16 머리~골반 구도에서 원본 얼굴·복장·손·무기 연결을 확인한다. 캐릭터 특성에 맞는 한 동작, 자연스러운 호흡·상체 움직임, 표정과 소리의 어울림, 시작·끝 연결을 살핀다. 몸 관통·갑작스러운 회전/점프·중간 장면 전환·정사각 영상과 흐린 띠·불필요한 웃음 반복은 보류한다. 매화 교체본은 중간 포즈가 끊겨 사용자 HOLD, 달리는 부자연스러워 사용자 HOLD다. 해솔·별은 시각 통과했지만 완전한 루프와 직접 청음/립싱크를 검증했다고 주장하지 않는다. 자세한 기준은 Windows `outputs/veo-production-rules.md`에 있다.

한도가 풀리면 한 편을 제출하고 시각·소리·연속성을 검수한 뒤 다음 편을 진행한다. 실패한 동일 문안을 자동 반복하지 않는다. 20셀 스프라이트의 여러 슬롯은 실제 포즈의 hold를 포함할 수 있으며, 20개의 독립 AI 생성 그림이라는 뜻은 아니다. 앞발 교대·무기 파지·투명 배경·워터마크·셀 잘림을 검수한다.

## 과거 영상 식별 근거

`https://gemini.google.com/u/4/app/39d1717d94fd67e8`의 Night-Panther는 업로드 라이트박스 파일명 `w-68-maek-beombal_2c9880.jpg`와 실제 `public/realm/awaken2-hd/w-68-maek-beombal.jpg` 이미지 대조로 **범발 w68 진각성**임을 Windows 브라우저에서 확인했다. 범 w60의 신규 1차각성 후보와 구분한다. 범의 제출 직전에는 Tiger/Claw/Beom 등 현재 Gemini 대화도 확인한다. 같은 대화에서 17:54 KST 한도 안내를 재확인했으며 새 영상은 제출하지 않았다.

## Claude/Mac으로 맡길 때

1. **관찰:** Windows `veo-1` 예약과 실시간 queue/state/claims, Gemini의 생성 중·완료 대화, 다운로드 파일 해시를 확인한다. 스냅샷만 보고 미제출로 판단하지 않는다.
2. **명시 이관:** 사용자 또는 현재 담당이 제출 소유권과 대상 계정·작업 ID를 명시적으로 넘기고, Windows 예약의 중복 제출 경로를 정리한다. 다른 기기에서 같은 요청을 동시에 보내지 않는다.
3. **재개:** 실시간 원장 절차대로 제출 직전에 claim하고, 대화 URL/결과 파일/검수 결과를 기록한다. 불명확한 claim이나 이미 제출된 job을 임의로 삭제·재제출하지 않는다. 교정 대기/held 작업은 새 원본과 별도 승인이 없으면 실행하지 않는다.

이 폴더에 영상이나 고해상 원본은 복사하지 않았다. 경로와 SHA-256으로 현재 게임 자산 및 Windows 원장을 대조한다.
