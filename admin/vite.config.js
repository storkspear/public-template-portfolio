import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /* React 는 한 벌만 로드돼야 합니다. 두 벌이면 `Invalid hook call` 이 납니다.
     npm 판에서는 잘 안 나지만, 편집기를 고치려고 `file:` 로 바꿔 거는 순간 바로 납니다 —
     그때 원인을 찾느라 헤매지 않도록 항상 못 박아 둡니다. */
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    /**
     * 관리자 UI 를 고칠 때만 쓰는 빠른 길입니다(`npm run admin:dev`).
     *
     * 평소에는 `docker compose up` 하나면 됩니다 — 그쪽이 운영과 같은 모양입니다.
     * 여기서는 compose 가 이미 떠 있다고 보고 그쪽으로 넘깁니다. API 도 사진도
     * 진짜를 보므로, 화면만 고치면서 글은 실제로 저장됩니다.
     */
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.ADMIN_PORT || 8081}`, changeOrigin: false },
      '/blog': { target: `http://127.0.0.1:${process.env.WEB_PORT || 8080}`, changeOrigin: false },
      '/assets': { target: `http://127.0.0.1:${process.env.WEB_PORT || 8080}`, changeOrigin: false },
      '/fonts': { target: `http://127.0.0.1:${process.env.WEB_PORT || 8080}`, changeOrigin: false },
      /* 「설정」의 파비콘 고르기가 「기본」 칸에 이 레포의 파일을 그대로 보여 줍니다.
         안 넘기면 그 칸만 빈 채로 떠서, 고를 수 있는데 못 고르는 것처럼 보입니다 */
      '/favicon.svg': { target: `http://127.0.0.1:${process.env.WEB_PORT || 8080}`, changeOrigin: false },
      /* 「모양」의 미리보기 — nginx 가 PREVIEW_DIR 을 관리자 포트에서만 냅니다.
         슬래시까지 적습니다: '/preview' 로 두면 하네스 페이지(`/preview.html`)까지 삼킵니다 */
      '/preview/': { target: `http://127.0.0.1:${process.env.ADMIN_PORT || 8081}`, changeOrigin: false },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
