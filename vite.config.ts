import { defineConfig } from 'vite'

// base는 GitHub Pages 서브경로 배포를 위해 빌드 시 주입한다.
// 로컬 dev/preview는 '/' 로 동작.
export default defineConfig({
  base: process.env.PUBLIC_BASE ?? '/',
  build: {
    target: 'es2022',
    // esbuild 압축이 151KB로 예산(150KB)을 넘겨 terser로 바꿨다 (2026-08-24).
    // terser는 devDependency다 — 런타임 의존성 0(A6)은 그대로다.
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
    },
    // 번들 예산: 이 게임의 생명은 "탭 복귀 즉시 플레이"다.
    // 이 경고선을 넘으면 라이브러리를 추가한 게 아닌지 의심할 것.
    chunkSizeWarningLimit: 150,
  },
})
