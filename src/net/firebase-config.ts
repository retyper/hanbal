/**
 * 파이어베이스 웹 앱 설정 (프로젝트 chilsippalguk · 서울 asia-northeast3) — BUILD §8-2 Q12
 * 웹 apiKey 는 비밀이 아니다(브라우저에 그대로 실린다). 지키는 것은 Firestore 보안 규칙: users/{uid}/** 는 로그인한 그 사람만.
 */
export const FIREBASE = {
  apiKey: 'AIzaSyBMpSBSeJ8LudK03uCT-Ir-Ut4Cz8o8sM4',
  authDomain: 'chilsippalguk.firebaseapp.com',
  projectId: 'chilsippalguk',
  storageBucket: 'chilsippalguk.firebasestorage.app',
  messagingSenderId: '301142621904',
  appId: '1:301142621904:web:f45dec2ce95ce3b15628d5',
} as const

/** 구글 로그인 — 파이어베이스가 만든 웹 OAuth 클라이언트 (구글 클라우드 콘솔 「Web client (auto created by Google Service)」) */
export const GOOGLE_CLIENT_ID = '301142621904-q1cul3q4iv76ml9v0iulv5e75vavc66p.apps.googleusercontent.com'
