# 리소스 제작 도구 검토 — 2026-11-08 확인 보완

사용자가 쇼츠에서 본 기존3개와 추가4개를 제작자 공식 저장소/문서로 짧게 확인했다. **이번 작업에서는 설치·실행·서비스 전환하지 않았다.** 아래는 문서에 적힌 기능과 후속 시험 후보이며, 우리 캐릭터의 손·무기/복식 일관성이나 비용 절감을 실제 검증한 결과가 아니다. 게임 실행의 필수 의존성도 아니다. 현재 Jay 한도 마감과 Claude 인수인계를 먼저 완료한다.

| 도구 | 확인한 역할 | 삼한열전에서의 다음 판단 |
|---|---|---|
| sprite-gen | 스프라이트 생성·알파 정리·시트 추출·아틀라스·모션 검사. 다른 도구의 기존 에셋도 처리 가능 | 기존 Gemini 결과의 추출/검사 유틸리티부터 1장수로 시험할 가치. 생성 공급자를 곧바로 바꾸지 않는다 |
| 2dimg2motion | 원화 정체성/손·무기 잠금, 전체 키포즈와 중간 동작 생성, 기본14프레임 흐름 | 손·하체 합성 실패를 겪은 전투 제작과 직접 관련. 우리20칸(대기4/보행8/공격6/피격1/쓰러짐1) 및12→14→17 타이밍에 맞게 검증해야 함 |
| pixelfx | 코드 기반 픽셀 타격·마법·날씨 등 효과와 동작 연출 | 화풍을 그대로 섞기보다 예고→접촉→피격→회복 타이밍/효과 구조 참고. 현재 회화풍과의 실제 장면 적합성부터 시험 |

도구 소개만으로 손·무기 일관성이나 비용 절감을 보장하지 않는다. 같은 장수 하나를 기준으로 원화 일관성, 실제 발 교대, 파지, 경계/색점, 타격점, 재작업 횟수를 비교한 뒤 채택한다. 현재 Gemini 브라우저 제작과 다른 생성 공급자/인증·비용 경로가 될 수 있어, 설치만으로 무료 생성이라 가정하지 않는다.

- [sprite-gen 공식 저장소](https://github.com/aldegad/sprite-gen)
- [2dimg2motion 공식 SKILL.md](https://github.com/WU-HAOTIAN34/2dimg2motion/blob/main/SKILL.md)
- [pixelfx 공식 저장소](https://github.com/patch-gg/pixelfx)

## 추가4개 — 설치 없는 후보 조사

| 도구·공식1차출처 | 공식 문서에서 확인한 역할 | 삼한열전에서 남길 후보/한계 |
|---|---|---|
| [Agent Sprite Forge](https://github.com/0x0funky/agent-sprite-forge) | 승인한 master still에서 동작별 영상 생성, 키잉·정렬·루프/타이밍·프레임 패키징까지 연결. 기존 clip 처리 경로도 설명 | 생성 전환보다 기존 영상/시트 후처리·QA 구조 참고 후보. 동작별 영상 생성은 현재 ‘Veo는 초상 idle 전용’ 계약과 별도이며 자동 도입하지 않음. 공급자/API·로그인 CLI·한도는 현재 Jay 무료 UI와 같다고 가정하지 않음 |
| [Codixel](https://github.com/mankidev/codixel) | 참조이미지→코드로 조립/뼈대→픽셀 변환/애니메이션, 프레임별·실제 장면 검수를 안내하는 스킬 | 작은 효과/장식이나 참조 기반 동작 설계 후보. 현재 회화풍 성인 장수20칸의 대체 생성기로 검증된 것은 아님 |
| [Pixelbolt](https://github.com/skulitom/Pixelbolt) · [제작자 공식 소개](https://skulitom.github.io/Pixelbolt/) | 편집 가능한 JSON 레시피를 로컬 CLI/MCP/스튜디오에서 PNG·APNG·GIF·아틀라스로 렌더. 공식 소개상 이미지 모델/API키 없이 동작 | 반복 가능한 효과·타일·아이콘 제작 후보. 사진/회화풍 원화를 그대로 애니메이션화하는 모델로 보지 않으며 현재 장수 화풍/손파지 유지 성능은 미검증 |
| [Sprite Sheet Diffusion](https://github.com/chenganhsieh/Sprite-Sheet-Diffusion) · [저자 논문](https://arxiv.org/abs/2412.03685) | Animate Anyone 계열을 바탕으로 한 캐릭터 애니메이션 연구 코드. 사전학습 가중치와 참조/동작 설정, 시퀀스 품질·일관성 평가를 안내 | 연구용 장기 후보. 현재 Windows에서 즉시 실행 가능한 환경·필요 자원·우리 원화에 대한 품질/비용은 이번 문서 확인만으로 **확인불가**. 설치·가중치 다운로드 없음 |

2026-11-08 기존3개의 공식 README/SKILL도 재확인했다. sprite-gen은 기존 이미지/그리드 추출·후처리/검사 경로를,2dimg2motion은 기본14프레임과 고정 기준/키포즈를, pixelfx는 코드 기반 픽셀 효과/스프라이트시트 사용을 문서화한다. 위 기존 판단은 유지하되, 공급자/생성 경로와 우리20칸·실제 타격점 계약의 호환은 후속1장수 시험에서 확인한다. 이 검토로 어떤 스킬도 설치하거나 실행하지 않았다.

달리 실패 원인을 재현해 해결할 수 있는지 먼저 본다. 전체 캐릭터를 새로 만들거나 성공한 기존 에셋을 일괄 교체하는 작업은 시작하지 않았다.

## 11-08 추가 조사 (Claude 에이전트 · 설치 0 · 공식 문서 기준 · [미확인]은 출처로 못 박지 못한 것)

전제: GTX 1050 Ti 4GB · Ryzen 5 1600 · Python 3.9 · Node 20 · 유료 API 없음.

핵심 넷:
1. **Gemini API 이미지 모델은 무료 티어가 없다**(gemini-2.5-flash-image·3.1-flash-image·nano-banana 등 전부 Free tier "Not available"). AI Studio 웹 UI 사용만 무료. 스크립트 자동화 무료 경로는 없고 브라우저 UI 가 유일.
2. **Hugging Face ZeroGPU 무료 하루 5분**(24시간 리셋). 포즈 이식·보간 모델을 4GB 대신 여기서 돌리는 게 현실적.
3. **4GB 에서 도는 것은 사실상 셋**: Meta Animated Drawings(CPU 뼈대 퍼펫) · SD1.5+ControlNet(2GB) · rtmlib/DWPose(CPU 포즈 추정). MimicMotion·MusePose·Moore-AnimateAnyone(16GB)·UniAnimate(12~26GB)·ToonCrafter(26GB)·Wan2.2 5B(8GB)·FramePack(6GB)·AnimateDiff(6~8GB) 전부 불가.
4. **라이선스**: MimicMotion·MusePose 가중치는 비상업 연구용 → 유료 게임 최종 아트에 못 씀. Qwen-Image-Edit·Animated Drawings(MIT)·CMU 모캡·Mixamo(로열티 무료·원본 재배포 금지)는 됨.

| 순위 | 도구 | 무엇 | 4GB/무료 | 20셀에 맞추는 법 | 장수 1명 | 위험 |
|---|---|---|---|---|---|---|
| 1 | Meta Animated Drawings (MIT · 2025-09 아카이브) | PNG + 16관절 yaml → BVH 모캡을 2D 퍼펫으로 · 투명 GIF | CPU 됨 | 걷기 BVH 는 cgspeed CMU 클립 · 공격은 Mixamo FBX→Blender→BVH · 측면 투영 sagittal/pca | 첫 1일, 이후 1~2h [추정] | 윈도 빌드 이슈(#239 scikit-learn) · 종이인형 느낌 |
| 2 | Qwen-Image-Edit-2511 AnyPose HF Space (linoyts) | 그림 A 사람에 그림 B 포즈 이식, 정체성 유지 | 무료 ZeroGPU 5분/일 | idle + 포즈 참조 → 키프레임 14장 · rembg 키잉 | 하루 1장수 [미확인] | 비공식 Space 소멸 가능 · 손/무기 일관성은 모델 재량 |
| 3 | ToonCrafter / Framer Space | 키프레임 2장 → 16프레임 보간(Framer 는 점 궤적 지정) | 무료 ZeroGPU | 접지 포즈 2장 사이 보간 → 8칸 추출 | 하루 1~2장수 [추정] | 회화풍 번짐 |
| 4 | rtmlib (DWPose · onnxruntime CPU) | 133점 키포인트 | CPU · Python 3.11 venv | **QA 자동화**: 발목 y 로 접지·교대 판정 · 손목 분산으로 파지 점수 | 수 초 | 160px 정확도 [미확인] → 512px 원본에 |
| 5 | COA Tools 2 (Blender 애드온 GPL) | 컷아웃 리깅 · 액션 재사용 | 무료 CPU | idle 을 팔다리 레이어로 잘라 리그 → 걷기/공격 액션을 70명에 재사용 | 첫 4~5h, 이후 2~3h [추정] | 관절 티 · Blender 학습 |
| 6 | Kaggle T4 + Moore-AnimateAnyone | 참조+포즈 영상→애니 | 무료 GPU | 참조·타이밍용 | 환경 1일 | 가중치 라이선스 [미확인] |
| 7 | SD1.5 + ControlNet OpenPose + IP-Adapter | 골격대로 새 포즈 | 4GB 가능(느림) | rtmlib 골격 · img2img 저노이즈 | 1~2h+리롤 | 한복·맥궁 약함 · 손 깨짐 |
| 8 | Pixelorama 1.2.4 · rembg isnet-anime · Wan2GP | 보정/키잉/저VRAM 허브 | 무료 | 보조 | - | Wan2GP 4GB 모델 [미확인] |

기부자(다리 공여) 후보: OGA 「wizard character (animated)」(ruberboy · CC0 · 손그림 회화풍 · walk/run/idle/attack/damage/die · PSD·DragonBones 동봉) 1순위 · Mixamo(측면 직교 렌더 = 포즈 참조) · CMU BVH. 한국풍 CC0 회화 스프라이트는 없음 → 다리 교대만 빌리고 그림은 우리 것.

파일럿 권장: **A안 Animated Drawings 를 1장수로 하루 안에 시험**(교대·파지를 구조적으로 보장하는지) → 그림 품질이 모자라면 그 결과를 **B안 Qwen AnyPose 의 포즈 참조**로 넣어 회화풍을 다시 입히는 결합. C안(COA Tools)은 둘 다 티 날 때.

```
git clone https://github.com/facebookresearch/AnimatedDrawings.git && cd AnimatedDrawings
py -3.9 -m venv .venv && .venv\Scripts\activate && pip install -e .
python -c "from animated_drawings import render; render.start('./my/walk_mvc.yaml')"
py -3.11 -m venv qa && qa\Scripts\activate && pip install rtmlib onnxruntime opencv-python "rembg[cpu,cli]"
```

출처: aistudio.google.com/docs/pricing · huggingface.co/docs/hub/spaces-zerogpu · github.com/facebookresearch/AnimatedDrawings · huggingface.co/spaces/linoyts/Qwen-Image-Edit-2511-AnyPose · huggingface.co/spaces/wwen1997/Framer · huggingface.co/spaces/Doubiiu/tooncrafter · github.com/Tau-J/rtmlib · github.com/Aodaruma/coa_tools2 · opengameart.org/content/wizard-characteranimated · huggingface.co/tencent/MimicMotion/blob/main/NOTICE
