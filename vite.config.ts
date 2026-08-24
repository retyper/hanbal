import { defineConfig, type Plugin } from 'vite'

/**
 * 튜닝 노브의 한글 라벨(~6KB)은 튜닝 콘솔에서만 쓰인다. 콘솔은 이미 지연 청크지만
 * 라벨은 params.ts(본 번들)에 살아서 C6 예산(150KB)을 밀어냈다. 빌드에서만 벗긴다 —
 * 배포판 콘솔은 라벨 대신 노브 경로(bow.drawTime)를 보여준다 (console.ts 폴백).
 * dev에서는 그대로라 로컬 튜닝 경험은 변하지 않는다.
 */
const stripTuneLabels = (): Plugin => ({
  name: 'hanbal-strip-tune-labels',
  apply: 'build',
  transform(code, id) {
    if (!id.replaceAll('\\', '/').includes('tune/params')) return null
    // esbuild가 먼저 지나가 따옴표가 큰따옴표로 바뀌어 있다 — 양쪽 다 받는다.
    // 라벨 안에 반대쪽 따옴표가 들어 있는 경우('"툭" 음량')가 있어 여는 따옴표를 역참조로 닫는다.
    return code.replace(
      /k\((\s*[^,()]+,\s*[^,()]+,\s*[^,()]+,\s*[^,()]+),\s*(['"])(?:(?!\2).)*\2(?:\s*,\s*(['"])(?:(?!\3).)*\3)?/g,
      "k($1, ''",
    )
  },
})

// base는 GitHub Pages 서브경로 배포를 위해 빌드 시 주입한다.
// 로컬 dev/preview는 '/' 로 동작.
export default defineConfig({
  base: process.env.PUBLIC_BASE ?? '/',
  plugins: [stripTuneLabels()],
  build: {
    target: 'es2022',
    // esbuild 압축이 151KB로 예산(150KB)을 넘겨 terser로 바꿨다 (2026-08-24).
    // terser는 devDependency다 — 런타임 의존성 0(A6)은 그대로다.
    minify: 'terser',
    terserOptions: {
      // passes 3 + 최상위 이름 압축. 151.7KB로 예산(150KB)을 다시 넘겨서 조인다 (2026-08-24).
      compress: { passes: 3, pure_getters: true, unsafe_arrows: true, unsafe_methods: true, drop_console: true },
      mangle: { toplevel: true },
    },
    // 번들 예산: 이 게임의 생명은 "탭 복귀 즉시 플레이"다.
    // 이 경고선을 넘으면 라이브러리를 추가한 게 아닌지 의심할 것.
    chunkSizeWarningLimit: 150,
  },
})
