#!/usr/bin/env node
/**
 * 컨테이너의 진입점 — 부팅 순서를 한 곳에 모읍니다.
 *
 *   1. 약한 비밀번호가 인터넷에 나가려 하면 거부합니다
 *   2. 스키마를 만듭니다(여러 번 돌려도 같습니다)
 *   3. 처음 한 번만 예시 글을 심습니다
 *   4. 관리자 API 를 띄웁니다
 *
 * 왜 한 파일인가: 이 넷을 compose 의 `command:` 에 `&&` 로 늘어놓으면, 어디서 죽었는지가
 * 로그 한 줄로 안 보이고 조건문을 YAML 안에 쓰게 됩니다. 스크립트가 읽기 쉽습니다.
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCAL, ORIGIN, WEAK, mustBeStrong } from './local.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const run = (file, args = []) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [join(HERE, file), ...args], { stdio: 'inherit' })
  p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${file} 가 ${code} 로 끝났습니다`))))
  p.on('error', reject)
})

/* ── 1. 약한 비밀번호는 로컬에서만 ───────────────────────────
 *
 * `.env.example` 이 `admin`/`admin` 을 주는 것은 받자마자 돌려 보라는 뜻입니다.
 * 그 편의가 그대로 인터넷에 나가면 사고가 됩니다. 그래서 여기서 막습니다.
 *
 * 무엇이 「로컬」인가는 `site.config.mjs` 의 `origin` 이 정합니다 — 배포하는 사람은
 * 어차피 그 값을 제 도메인으로 바꾸므로, 바꾸는 순간 이 검사가 켜집니다.
 * 별도로 기억해야 할 스위치를 만들지 않는 것이 요점입니다.
 */
if (mustBeStrong()) {
  const bad = []
  if (WEAK.has(String(process.env.ADMIN_PASSWORD ?? ''))) bad.push('ADMIN_PASSWORD')
  if (WEAK.has(String(process.env.ADMIN_TOKEN_SECRET ?? ''))) bad.push('ADMIN_TOKEN_SECRET')
  if (bad.length) {
    console.error(`
─────────────────────────────────────────────────────────────
 기본값 그대로는 로컬 밖에서 뜨지 않습니다.

   문제: ${bad.join(', ')} 가 예시 파일의 값 그대로입니다.
   지금 주소: ${ORIGIN || '(site.config.mjs 의 origin 이 비었습니다)'}

 고치는 법
   비밀번호   node --env-file=.env server/set-password.mjs ${process.env.ADMIN_ID || 'admin'}
              (그리고 .env 의 ADMIN_PASSWORD 는 비우세요)
   토큰 비밀  node -p "require('node:crypto').randomBytes(32).toString('base64url')"
              결과를 .env 의 ADMIN_TOKEN_SECRET 에

 정말 이대로 띄워야 한다면 ALLOW_WEAK_ADMIN=1 을 주세요. 권하지 않습니다.
─────────────────────────────────────────────────────────────`)
    process.exit(1)
  }
}
console.log(LOCAL ? '로컬 모드 — 약한 비밀번호를 허용합니다' : `배포 모드 — ${ORIGIN}`)

/* ── 2·3. 스키마와 예시 글 ───────────────────────────────────
 *
 * `--local` 은 pgcrypto 와 시드 계정을 같이 심습니다. 로컬이 아니면 스키마만 만듭니다 —
 * 배포본에 예시 글이 딸려 들어가면 첫 화면이 남의 글로 찹니다.
 */
await run('migrate.mjs', LOCAL ? ['--local'] : [])
if (LOCAL) await run('seed-posts.mjs')

/**
 * 부팅할 때 한 번 굽습니다.
 *
 * 안 하면 `docker compose up` 직후 `/blog/` 가 404 다 — DB 에는 글이 있는데 HTML 이
 * 아직 없기 때문입니다. 받은 사람이 제일 먼저 누르는 곳이 거기라, 「받자마자 깨져 있습니다」로 읽힙니다.
 *
 *
 * 매번 굽는 값은 저렴합니다 — 글 수만큼의 파일 쓰기입니다. 대신 볼륨과 DB 가 어긋난 채로 뜨는 일이
 * 없어집니다(볼륨만 삭제했거나, 생성하다 만 상태로 종료됐거나).
 *
 * 실패해도 서버는 띄웁니다. 굽기가 안 된다고 관리자까지 못 들어가면 고칠 방법이 없습니다.
 */
try {
  const { bakeOnce } = await import('./bake.mjs')
  const { count } = await bakeOnce()
  console.log(`구운 글 ${count}편`)
} catch (e) {
  console.error(`부팅 중 굽기 실패 — 관리자에서 아무 글이나 다시 발행하면 복구됩니다:\n  ${e.message}`)
}

/* ── 4. 본체 ────────────────────────────────────────────────
 * `spawn` 이 아니라 import 다 — 프로세스를 하나로 두어야 도커가 보내는
 * SIGTERM 이 곧장 서버에 전달됩니다. 중간에 셸이 끼면 10초를 기다렸다가 강제 종료합니다.
 */
await import('./admin-api.mjs')
