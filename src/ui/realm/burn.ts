// 타오르는 불 — 그린 불 그림이 아니라 지금 타는 불 (형 11-01: "채워진 게 아니라 불타는 듯한 연출이 필요")
//
// 요즘 게임 VFX 의 불 셰이더를 작게 옮긴다 (realtimevfx · godotshaders 의 stylized fire 갈래):
//  1. 흐름 — 잡음(fbm 3옥타브)을 위로 흘려 불 모양의 UV 를 비튼다. 비틂은 위로 갈수록 크다 (밑동은 붙어 있고 끝이 넘실댄다)
//  2. 깎기(erosion) — 열에서 문턱을 빼 가장자리를 찢는다. 불이 붙을 때 문턱이 내려가며 「번진다」
//  3. 그레이디언트 맵 — 열 하나를 흰 심 → 노랑 → 주황 → 붉은 끝 → 투명으로
//  4. 테두리 불(burning paper) — 띠에서 떨어진 거리로 열의 근원을 잡고 그 위로 혀가 솟는다
// 폰: 옥타브 셋 · 작은 캔버스 · 화면 배율 1.5 까지 · 한 번에 몇 개만 (각성 연출 한 장면). 탭이 숨으면 rAF 가 멈춘다 (규칙 4).

const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'

const FS = `precision mediump float;
varying vec2 v;
uniform float uT, uOn, uSeed, uMode, uTop, uSide, uBot;
uniform vec3 uC0, uC1, uC2, uC3;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5*noise(p);p*=2.03;a+=.25*noise(p);p*=2.01;a+=.125*noise(p);return a/.875;}
vec4 ramp(float h){
  vec3 c=mix(uC0,uC1,smoothstep(.12,.42,h));
  c=mix(c,uC2,smoothstep(.42,.68,h));
  c=mix(c,uC3,smoothstep(.7,.95,h));
  float a=smoothstep(.06,.28,h);
  return vec4(c*a,a);
}
// 불혀 하나: s 밑동 · w 너비 · ht 높이 (캔버스 비율)
float tongue(vec2 uv,vec2 s,float w,float ht,float sd){
  vec2 q=(uv-s)/vec2(w,ht);
  if(q.y<-.35||q.y>1.25||abs(q.x)>1.4)return 0.;
  float n=fbm(vec2(q.x*1.8+sd,q.y*1.4-uT*2.1));
  q.x+=(n-.5)*1.1*clamp(q.y,0.,1.);
  float body=1.-smoothstep(0.,.55*(1.-q.y*.82),abs(q.x));
  float base=smoothstep(-.35,.02,q.y);
  float flick=fbm(vec2(q.x*3.5-sd,q.y*2.6-uT*3.3));
  return body*base*(1.12-q.y)*(.55+.9*flick);
}
void main(){
  vec2 uv=v;
  float h=0.;
  if(uMode<.5){
    // 청동 불꽃 자리: 우묵한 속 밑에서 피어 끝 위로 넘실
    // 가운데 큰 혀 하나 + 양옆 작은 혀 둘이 어긋나 넘실댄다 (한 줄기 촛불처럼 보이지 않게)
    h=tongue(uv,vec2(.5,.12),.62,.56,uSeed);
    h=max(h,.85*tongue(uv,vec2(.38,.13),.36,.38,uSeed+5.));
    h=max(h,.85*tongue(uv,vec2(.62,.13),.36,.42,uSeed+9.));
  }else if(uMode<1.5){
    // 액자: 불 캔버스는 액자 그림 뒤에 깔린다. 띠 위의 불은 청동에 가려지고 바깥 테 너머로 혀가 솟는다
    // 캔버스는 액자보다 위로 uTop · 아래로 uBot · 양옆으로 uSide 만큼 크다. cy 는 액자 높이 비율 (0 아랫변 · 1 윗변)
    float cy=uv.y*(1.+uTop+uBot)-uBot;
    float x=uv.x*(1.+2.*uSide)-uSide;
    // 근원은 바깥 테 둘레 전체 (burning paper): 바깥 테에서 떨어진 거리 e. 불은 위로 타므로 옆은 .09 · 위는 uTop · 아래는 uBot 로 잰다
    float ox=max(max(-x,x-1.),0.);
    float above=max(cy-1.,0.);
    float below=max(-cy,0.);
    float e=length(vec2(ox/.075,above/uTop+below/max(uBot,.001)));
    if(e<1.){
      // 혀로 갈라지게: 흐름 잡음으로 x 를 비틀고, 능선 잡음(1-|2n-1|)으로 가는 혀를 세운 뒤, 근원에서 멀수록 문턱을 올려 끝이 끊긴다
      // 옆의 불도 위로 흐른다 (세로로 길게 늘인 잡음) · 혀마다 키가 다르다(col)
      float w=fbm(vec2(x*4.+uSeed,cy*1.6-uT*1.5));
      float n=fbm(vec2(x*11.+(w-.5)*2.2,cy*2.2-uT*2.8));
      float ridge=1.-abs(2.*n-1.);
      float col=fbm(vec2(x*6.-uSeed,cy*1.2+uT*.6));
      float topw=.45+.55*smoothstep(.1,1.,cy); // 윗변 쪽이 더 세다: 열은 위로 모인다 · 아랫변은 낮게 그을린다
      h=(ridge*1.5-.25-e*(2.3-col*1.3))*(1.-smoothstep(.8,1.,e))*topw;
    }
    // 액자 안(띠와 초상 창)에는 불을 두지 않는다: 띠는 청동이 가리지만 창은 비치므로
    if(x>.025&&x<.975&&cy>.025&&cy<.975)h=0.; // 액자 그림 둘레의 빈 여백까지는 불이 채운다 (검은 테가 안 보이게)
  }else{
    // 바닥 불: 화면 아래에서 낮게 넘실 (그린 불벽 대신 · 같은 불 말씨)
    float w=fbm(vec2(uv.x*3.+uSeed,uv.y*1.4-uT*1.2));
    float n=fbm(vec2(uv.x*7.+(w-.5)*2.,uv.y*1.8-uT*2.2));
    float ridge=1.-abs(2.*n-1.);
    float col=fbm(vec2(uv.x*5.,uT*.4));
    h=ridge*1.3-.15-uv.y*(2.-col*1.2);
  }
  h-=(1.-uOn)*.9; // 깎기: 붙는 동안 문턱이 내려가며 번진다
  gl_FragColor=ramp(clamp(h,0.,1.));
}`

export interface BurnOpts {
  readonly mode: 'socket' | 'frame' | 'ground'
  /** 불이 붙기 시작하는 때 (지금부터 ms) · 번지는 데 걸리는 ms */
  readonly at: number
  readonly ramp: number
  /** 액자 — 캔버스 위쪽에 불이 솟을 몫 (액자 높이 비율) */
  readonly top?: number
  /** 액자 — 캔버스 양옆에 더 둔 몫 (액자 너비 비율) */
  readonly side?: number
  /** 액자 — 캔버스 아래로 더 둔 몫 (아랫변이 그을릴 자리) */
  readonly bot?: number
  readonly seed?: number
  /** 그레이디언트 넷 (짙은 끝 · 가운데 · 밝은 · 심) — 각성의 기운 색 (ascend.ts ELEM). 없으면 불 */
  readonly colors?: readonly [string, string, string, string]
}

/** 불의 그레이디언트 — 옛 셰이더 값 그대로 */
const FIRE: readonly (readonly [number, number, number])[] = [[0.5, 0.05, 0.02], [1, 0.4, 0.05], [1, 0.8, 0.28], [1, 0.97, 0.86]]
const rgb = (hex: string): readonly [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** 캔버스에 불을 피운다 — 캔버스가 문서에서 빠지면 저절로 멈춘다. WebGL 이 없으면 false (부른 쪽이 그린 불로 대신한다) */
export function burn(cv: HTMLCanvasElement, o: BurnOpts): boolean {
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
  if (gl === null) return false
  const sh = (type: number, src: string): WebGLShader | null => {
    const s = gl.createShader(type)
    if (s === null) return null
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) === true ? s : null
  }
  const vs = sh(gl.VERTEX_SHADER, VS)
  const fs = sh(gl.FRAGMENT_SHADER, FS)
  const pr = gl.createProgram()
  if (vs === null || fs === null || pr === null) return false
  gl.attachShader(pr, vs)
  gl.attachShader(pr, fs)
  gl.linkProgram(pr)
  if (gl.getProgramParameter(pr, gl.LINK_STATUS) !== true) return false
  gl.useProgram(pr)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(pr, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u = (n: string): WebGLUniformLocation | null => gl.getUniformLocation(pr, n)
  const [uT, uOn, uSeed, uMode, uTop, uSide, uBot] = [u('uT'), u('uOn'), u('uSeed'), u('uMode'), u('uTop'), u('uSide'), u('uBot')]
  gl.uniform1f(uSeed, o.seed ?? 0)
  gl.uniform1f(uMode, o.mode === 'ground' ? 2 : o.mode === 'frame' ? 1 : 0)
  gl.uniform1f(uTop, o.top ?? 0)
  gl.uniform1f(uSide, o.side ?? 0)
  gl.uniform1f(uBot, o.bot ?? 0)
  const cs = o.colors !== undefined ? o.colors.map(rgb) : FIRE
  ;(['uC0', 'uC1', 'uC2', 'uC3'] as const).forEach((n, i) => gl.uniform3f(u(n), ...cs[i]!))
  const t0 = performance.now()
  const fit = (): void => {
    const k = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.max(1, Math.round(cv.clientWidth * k))
    const h = Math.max(1, Math.round(cv.clientHeight * k))
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h) }
  }
  const frame = (now: number): void => {
    if (!cv.isConnected) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return }
    fit()
    const ms = now - t0
    const on = Math.min(1, Math.max(0, (ms - o.at) / Math.max(1, o.ramp)))
    // 동작 줄이기여도 불은 탄다 — 멈춘 불은 그린 불만 못하다 (형 11-03 맥북: "불도 안 움직이던데")
    gl.uniform1f(uT, ms / 1000)
    gl.uniform1f(uOn, on)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return true
}
