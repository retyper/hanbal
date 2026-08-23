---
name: ship
description: 빌드하고 GitHub Pages에 배포한다. "배포해줘", "올려줘", "웹에서 되게 해줘" 같은 요청에 사용.
---

# 배포

## 사전 확인 (전부 통과해야 진행)

```bash
npm run typecheck
npm test
npm run build
```

번들 크기를 확인한다. **150KB 초과면 배포 전에 형에게 보고한다** (제약 C6).
튜닝 콘솔(`src/tune/console.ts`)이 프로덕션 번들에 들어갔는지 확인 — `import.meta.env.DEV` 가드가 있어야 한다.

## 최초 1회 세팅

`gh auth status` 로 로그인 확인. 안 돼 있으면 **형에게 직접 실행을 요청한다** (대화형이라 대신 못 한다):
```
! gh auth login
```

그다음:
```bash
git init && git add -A && git commit -m "초기 커밋"
gh repo create hanbal --public --source=. --push
```

레포 생성·공개는 되돌리기 어려운 외부 행위다. **실행 전에 형에게 확인받는다.**
공개(`--public`)로 할지 비공개(`--private`)로 할지도 물어본다.

GitHub Pages는 Actions 워크플로(`.github/workflows/deploy.yml`)로 배포한다.
`PUBLIC_BASE=/<레포명>/` 를 빌드에 주입해야 서브경로에서 애셋이 깨지지 않는다.

## 이후 배포

```bash
git add -A && git commit -m "<변경 요약>" && git push
```
Actions가 자동으로 빌드·배포한다. 완료 후 URL을 형에게 알려준다.

## 배포 후 확인
- 실제 URL을 열어 첫 페인트가 0.3초 안에 되는지 (제약 C6)
- 세이브가 정상 로드되는지
- 모바일 폭에서 캔버스가 깨지지 않는지
