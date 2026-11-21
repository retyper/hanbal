# 전투 시작 소개 v2 · 64 마지막 코드

작은 초상 compact333945는 사용자 거부로 보존하고 배포하지 않는다. 큰 양쪽 초상·중앙VS·전투명으로 재구성했다. 가로844 초상frame179.4/VS97.5px, PC1280에서는331.2/180px다. 세로 기존초상 크기는 유지하면서 여백과 하단정보를 정리했다. 긴 지형 설명은 기존 준비 화면의 동일terrChips tooltip로 확인한다. 기존10.6초 소개 시계·클릭건너뛰기·그림·sim·RNG·저장·JS는 그대로이고 WAR_CSS만 바뀌었다.

실제3가로(844×390/915×412/1280×720)+4세로(360/375/390/412×844) 소개에서 overflowX/Y0, 필수내용bbox화면밖0, nativewheel이동0, 가시글자최소12px를 확인했다. root가7크기PNG를 봤다. 원형844는461px, 세로360는62px/390는2px 넘침이 관측됐다. 연습전투의 상대·지형은 달라 동일장면픽셀비교라고 주장하지 않는다. 기본등장장식은 바깥wopen이clip하되 내용bbox를 따로 확인했다.

이번64지시에 따라 **제품변경은battlefield.ts소개CSS 한 파일뿐**이다. 장수/열전/전투 글자후속3파일과별도전투font삽입후보는C outputs/codex61-landscape2/CLAUDE-font-candidates/에보존해Claude로넘긴다. 그후속의실측12px를이번배포의완료로합산하지않는다.

정확한소개-only소스: typecheck0,전체1893/1891pass/0fail/기존skip2,121.534초,build5050.4KBraw/1575.6KBgzip. Node22.19.0/npm10.9.3. 로컬PUBLIC_BASE=/hanbal/로CI와맞췄으며realm.html200/실JS9개200/SHA일치, compiled실제소개844추가7검사PASS/JS0/sourceStable/프로필정리완료. root는compiledPNG도직접봤다. 공식filechooser로가져온선언한합성저장이며실유저소유증거는아니다. runtime상태/시간주입0, 자연시계/native입력만썼다.

초기로컬compiled1회는PUBLIC_BASE누락으로root/assets가404여서실패했다. 실패보고서는보존했고같은/hanbal/설정으로다시빌드해위검사를통과했다. PC1280전용프로필정리지연1회는Chrome종료/해당프로세스0을확인한후검수전용정확경로만정리했다. 원본/거부후보/실패보고서를삭제하거나덮어쓰지않았다.

증거 C outputs/codex61-landscape2/intro-only-checks/ 및local-intro-only-realm.json, outputs/codex61-landscape/intro-{v2-*,final-1280-01,only-compiled-844-02}/. 사진 D:/에셋창고/codex61-landscape/intro-v2-*.png. 최종commit/CI/운영확인은D:/에셋창고/CODEX-TO-CLAUDE-LATEST.md맨위숫자가정본이다. 코드작업은이단계뒤Claude, Codex는64그림만.
