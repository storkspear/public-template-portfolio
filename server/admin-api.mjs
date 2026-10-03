/**
 * 관리자 API — 사이트 하나가 이것 하나를 띄웁니다.
 *
 * 브라우저는 Postgres 에 raw TCP 로 못 붙어서 이 서비스가 대신 붙습니다. 이 프로세스는
 * JSON 만 내고 정적 파일과 관리자 화면은 nginx 가 줍니다 — 로컬과 운영이 같은 모양이 됩니다.
 *
 * 사이트마다 다른 것은 `.env` 뿐입니다. 코드는 한 벌이고 프로세스가 사이트마다 하나입니다:
 *
 *   PGSCHEMA=mysite   BLOG_DIR=/data/blog   PORT=8090
 *   PGSCHEMA=other    BLOG_DIR=/data2/blog  PORT=8091
 *
 * 스키마를 연결에 못 박는 까닭은 요청마다 고르면 한 군데만 빠뜨려도 남의 글이 나오기
 * 때문입니다. 계정도 스키마 안(`admins`)에 있어 사이트끼리 섞일 자리가 없습니다.
 * 주의: 이 `search_path` 는 세션 모드에서만 지켜집니다. 커넥션 풀러를 트랜잭션 모드로
 * 끼우면 문장마다 다른 연결에 떨어져 날아가므로, SQL 을 `{스키마}.posts` 로 바꿔야 합니다.
 */
import { createServer } from 'node:http'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, writeFile, rm, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import pg from 'pg'
import { bake, bakePreview, loadConf, SITE_DEFAULTS, stageDefaults, footDefaults, footIconDefaults, siteTextDefaults, siteOrigin } from './bake.mjs'
import { LOCAL, ORIGIN, WEAK, mustBeStrong, pgSsl } from './local.mjs'
import { svgUnsafe } from './bake-safety.mjs'
import { cleanSlug } from '../shared/text.mjs'
import { KEYS, normalize, headerContrast, buttonContrast, footerContrast, INK_MIN } from '../shared/site-vocab.mjs'
import { CATEGORY_ID } from '../shared/category.mjs'
import { configureFonts, FONT_VALUES } from './vendor/post-editor-core/vocab.js'
import { SITE_FONTS } from '../site.fonts.mjs'

/* 글꼴 어휘를 편집기와 같은 목록으로 맞춥니다 — 안 부르면 관리자에서 고를 수 있는 글꼴을
   서버가 「모르는 글꼴」로 거절합니다(굽기도 같은 이유로 같은 줄을 부릅니다) */
configureFonts({ extra: SITE_FONTS })

const need = (k) => process.env[k] || (() => { throw new Error(`.env 에 ${k} 가 없습니다`) })()

/**
 * 기본값을 두지 않습니다. 공용 코드에 한 사이트의 포트를 적어 두면, 두 사이트를 같이
 * 띄울 때 조용히 포트를 다투고 진 쪽이 「왜 옛날 글이 보이지」로 나타납니다.
 * 없으면 크게 실패하는 편이 낫습니다.
 */
const PORT = Number(need('PORT'))
/**
 * 어느 주소에서 들을 것인가. 기본은 `127.0.0.1` — 맨 기계에서 직접 띄웠을 때 앞의 nginx
 * 말고는 아무도 못 붙게 합니다. 실수로 0.0.0.0 에 열면 관리자 API 가 인터넷에 섭니다.
 * 도커에서는 `0.0.0.0` 이어야 합니다(nginx 가 다른 컨테이너라 루프백으로는 못 닿습니다).
 * 대신 compose 가 이 포트를 밖으로 열지 않아 격리 수준은 같습니다.
 */
const HOST = process.env.HOST || '127.0.0.1'
const SCHEMA = need('PGSCHEMA')

const pool = new pg.Pool({
  host: process.env.PGHOST,
  /* 로컬 도커는 5432 가 이미 쓰이고 있을 수 있어 비켜 둡니다 */
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  /* 로컬 도커에는 TLS 가 없습니다. 관리형 Postgres 는 대개 요구합니다 — 판단은 local.mjs 의 pgSsl() */
  ssl: pgSsl(),
  /**
   * 이 연결이 보는 스키마. 이름 없는 `posts` 가 여기서 풀립니다.
   * `extensions` 를 빼면 로그인이 실패합니다 — pgcrypto 가 그 스키마에 있고 로그인 쿼리가
   * `crypt()` 를 씁니다(운영 실측: `search_path=mysite` 는 gen_salt 없음, 뒤에 붙이면 성공).
   * 우리 표는 맨 앞 스키마에서만 찾으므로 뒤에 뭐가 붙어도 격리는 그대로입니다.
   */
  options: `-c search_path=${SCHEMA},extensions,public`,
  max: 3,
  idleTimeoutMillis: 10_000,
})

/**
 * 유휴 커넥션에서 난 오류는 `'error'` 이벤트로 옵니다. 리스너가 없으면 프로세스가 실패합니다 —
 * db 컨테이너가 재시작하는 몇 초 동안 API 가 통째로 크래시 루프에 듭니다.
 * 풀이 알아서 그 커넥션을 버리고 새로 맺으므로, 여기서는 남기기만 합니다.
 */
pool.on('error', (e) => console.error('pg 유휴 커넥션 오류 —', e.message))

/**
 * 로그인은 토큰 둘로 돕니다 (RTR — Refresh Token Rotation).
 *
 *   액세스   서명만 한 짧은 토큰(30분). 서버는 기억하지 않고 검사만 합니다.
 *   리프레시 무작위 32바이트(7일). `sessions` 표에 sha256 만 저장하고, 쓸 때마다 회전합니다.
 *
 * 액세스 하나만 쓰면 끊을 방법이 없습니다 — 새어 나가도 만료까지 유효하고 특정 세션만
 * 죽일 수가 없습니다. 리프레시를 표에 두면 진짜 로그아웃과 탈취 감지가 생깁니다.
 * 상태는 Postgres 에 둡니다. 메모리에 두면 배포가 프로세스를 죽일 때마다 로그인이 풀립니다.
 *
 * 폐기는 액세스 토큰에 못 미칩니다 — 이미 나간 액세스는 서명이 맞는 한 만료(30분)까지
 * 통합니다. 그래서 30분보다 길게 두지 않고, 즉시 끊으려면 `ADMIN_TOKEN_SECRET` 을 갈아야 합니다.
 */
const DAY = 24 * 60 * 60 * 1000
const TOKEN_SECRET = need('ADMIN_TOKEN_SECRET')
if (TOKEN_SECRET.length < 32) throw new Error('ADMIN_TOKEN_SECRET 은 32자 이상이어야 합니다')
/* 「로컬인가」의 판단은 `local.mjs` 한 곳에 있습니다 — start.mjs 와 같은 규칙을 씁니다 */
if (mustBeStrong() && WEAK.has(TOKEN_SECRET)) {
  throw new Error(
    `ADMIN_TOKEN_SECRET 이 .env.example 의 자리표시자입니다 (지금 주소: ${ORIGIN}).\n` +
    `  새로 뽑으세요:  node -p "require('node:crypto').randomBytes(32).toString('base64url')"`)
}
const ACCESS_TTL = Number(process.env.ACCESS_TTL_MS || 30 * 60 * 1000)   // 30분
/* 검증이 없으면 `Number('abc')` → NaN → `exp: null` → 모든 토큰이 무효가 됩니다.
   다른 환경변수는 다 검사하는데 여기만 빠져 있었습니다. */
if (!Number.isFinite(ACCESS_TTL) || ACCESS_TTL < 1000) {
  throw new Error('ACCESS_TTL_MS 가 이상합니다 (1000 이상의 숫자)')
}
const REFRESH_TTL = 7 * DAY             // 7일
/**
 * 회전 유예 10초. 탭 둘이 동시에 갱신하면 둘 다 같은 옛 토큰을 보내는데, 유예가 없으면
 * 뒤에 온 쪽이 「이미 쓴 토큰」으로 읽혀 탭 두 개를 열어 둔 것만으로 로그아웃됩니다.
 * 이 창 안에서 온 재사용은 경합으로 보고 후계자를 돌려줍니다.
 */
const ROTATE_GRACE = 10 * 1000
const TOKEN_MAX = 1024          // 그 이상은 우리 것이 아닙니다 — HMAC 도 안 돌립니다
const B64U = /^[A-Za-z0-9_-]+$/
const COOKIE = 'sid'
/**
 * 쿠키 자리. `/api` 로 둡니다 — `/api/auth` 로 좁히면 로그인 요청에 쿠키가 안 실려서,
 * 다시 로그인해도 서버가 옛 가족이 무엇인지 몰라 끊지 못합니다(「털린 것 같으니 다시
 * 로그인하자」가 아무 효과가 없습니다). 정적 파일에는 여전히 안 실립니다.
 */
const COOKIE_PATH = '/api'
/* `LOCAL` 은 `local.mjs` 에서 옵니다 — 아래 쿠키의 `Secure` 를 가르는 데 씁니다.
   DB 호스트로 가르지 않습니다. 그건 「DB 가 어디 있느냐」지 「이 사이트가 https 로
   서 있느냐」가 아닙니다 — 도커에서는 로컬인데도 `Secure` 가 붙어 http 에서 쿠키가 안 실립니다. */

const sign = (body) => createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')

/** 액세스 토큰. `site` 는 스키마 이름 — 비밀을 실수로 두 사이트에 복붙해도 여기서 갈립니다 */
const mint = (adminId) => {
  const body = Buffer.from(JSON.stringify({
    sub: adminId, site: SCHEMA, exp: Date.now() + ACCESS_TTL,
  })).toString('base64url')
  return `${body}.${sign(body)}`
}

/**
 * 검사 순서가 곧 안전입니다: 길이·모양 → 서명 → 그제야 파싱 → 만료 → 사이트.
 * 서명이 맞기 전에는 `JSON.parse` 도 안 합니다 — 파서에 남의 바이트를 넣지 않습니다.
 * 비교는 인코딩된 문자열끼리 합니다(base64url 디코더는 관대해서 다른 문자열이 같은
 * 바이트로 풀릴 수 있습니다). 길이를 먼저 보는 이유는 timingSafeEqual 이 길이가 다르면 던지기 때문.
 */
const verify = (t) => {
  if (typeof t !== 'string' || !t || t.length > TOKEN_MAX) return null
  const dot = t.indexOf('.')
  if (dot < 1 || t.indexOf('.', dot + 1) !== -1) return null
  const body = t.slice(0, dot), sig = t.slice(dot + 1)
  if (!B64U.test(body) || !B64U.test(sig)) return null
  const want = Buffer.from(sign(body)), got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  let s
  try { s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return null }
  if (!s || typeof s !== 'object' || typeof s.exp !== 'number' || !(s.exp > Date.now())) return null
  if (s.site !== SCHEMA || typeof s.sub !== 'string' || !s.sub) return null
  return s
}

/* ── 리프레시 토큰 ──────────────────────────────────────────────────── */

/** 표에는 해시만 넣습니다 — DB 가 새도 세션이 안 넘어갑니다 */
const hashOf = (t) => createHash('sha256').update(t).digest()

/** 쿠키 한 줄 읽기. 라이브러리를 들이기엔 아까운 일입니다 */
const cookieOf = (req, name) => {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return ''
}

/**
 * 예전에 쓰던 쿠키 자리. 지우기만 합니다.
 * 쿠키 경로를 `/api/auth` 에서 `/api` 로 넓히면 더 구체적인 옛 쿠키가 이깁니다(RFC 6265) —
 * `/api/auth/refresh` 에 죽은 쿠키가 실려 오고 새 쿠키는 가려진 채 401 이 납니다.
 * 로그인할 때 한 줄 더 보내 옛 자리를 비웁니다.
 */
const OLD_COOKIE_PATHS = ['/api/auth']

/** `Secure` 는 로컬에서 빼야 합니다 — 사파리는 http://localhost 의 Secure 쿠키를 버립니다 */
const setCookie = (res, value, maxAgeSec, alsoClearOld = false) => {
  const one = (path, v, age) =>
    `${COOKIE}=${v}; HttpOnly; SameSite=Strict; Path=${path}; Max-Age=${age}` + (LOCAL ? '' : '; Secure')
  const lines = [one(COOKIE_PATH, value, maxAgeSec)]
  if (alsoClearOld) for (const p of OLD_COOKIE_PATHS) lines.push(one(p, '', 0))
  res.setHeader('set-cookie', lines)
}
const clearCookie = (res) => setCookie(res, '', 0, true)

/**
 * 새 리프레시를 발급하고 쿠키에 넣습니다. `family` 를 안 주면 새 가족(= 새 로그인).
 *
 * 회전할 때 만료를 미루지 않습니다. `now() + 7일` 로 매번 다시 쓰면 30분마다 갱신만
 * 해도 세션이 영원히 삽니다 — 절대 상한이 사라집니다. 가족은 로그인으로부터 7일입니다.
 */
const issueRefresh = async (res, adminId, ua, family = null, until = null, fresh = false) => {
  const raw = randomBytes(32).toString('base64url')
  const { rows } = await pool.query(
    `insert into sessions (family, token_hash, admin_id, expires_at, ua)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3,
             coalesce($4::timestamptz, now() + $5::interval), $6)
     returning family, expires_at`,
    [family, hashOf(raw), adminId, until, `${REFRESH_TTL} milliseconds`,
     String(ua || '').slice(0, 200)])
  const left = Math.max(1, Math.floor((new Date(rows[0].expires_at) - Date.now()) / 1000))
  setCookie(res, raw, left, fresh)
  return rows[0]
}

/**
 * bcrypt 세기. pgcrypto 의 `gen_salt('bf')` 기본값은 6 이고, 그게 지금 운영에 깔린 값입니다
 *. 12 는 6보다 64배 느립니다 — 털리는 쪽도 그만큼 느려집니다.
 */
const BCRYPT_COST = 12

/**
 * 로그인 시도 제한 — 기다리게 하는 것이 먼저입니다. 0.25초에서 배로 늘려 8초에서 멈추고,
 * 그것만으로 초당 수천이 분당 일곱이 됩니다. 완전히 막는 것은 그 뒤이고 문턱을 높게 둡니다 —
 * 낮게 잡으면 오타 몇 번에 내가 잠기고 풀어 줄 사람이 없습니다(혼자 쓰는 관리자입니다).
 *
 * 요청은 전부 nginx 를 거쳐 `127.0.0.1` 에서 오므로 주소로 가를 수가 없습니다 — 사실상
 * 하나짜리 계수기입니다. XFF 는 신뢰할 근거가 없어 쓰지 않습니다.
 * 상태는 메모리라 배포하면 풀립니다. 표를 하나 더 둘 값어치는 이 규모에 없습니다.
 */
const GATE_MAX = 20                 // 이만큼 틀리면 잠시 닫습니다. 오타로는 닿기 어렵습니다
const GATE_WINDOW = 10 * 60 * 1000  // 마지막 실패로부터 10분이 지나면 기록이 사라집니다
const GATE_DELAY_MAX = 8000
let gate = null                     // { n, at }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const gateWait = () => {
  if (!gate || Date.now() - gate.at > GATE_WINDOW) { gate = null; return 0 }
  if (gate.n >= GATE_MAX) return null                       // 닫힘
  return Math.min(250 * 2 ** (gate.n - 1), GATE_DELAY_MAX)
}
const gateFail = () => {
  gate = !gate || Date.now() - gate.at > GATE_WINDOW
    ? { n: 1, at: Date.now() } : { n: gate.n + 1, at: Date.now() }
}
const gateOk = () => { gate = null }

/** 만료된 지 오래인 행은 치웁니다. 로그인·회전 때 곁다리로 — 따로 도는 것을 안 만듭니다 */
const sweep = () => pool.query(`delete from sessions where expires_at < now() - interval '7 days'`)
  .catch((e) => console.error('sessions 청소 실패:', e.message))

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/**
 * 요청 쪽 잘못 — 깨진 JSON·너무 큰 본문. 이걸 그냥 던지면 아래 catch 가 500 으로 답해
 * 「서버가 고장났습니다」로 읽힙니다. 번호를 달아 두면 catch 가 그 번호로 답합니다.
 */
const clientError = (status, message) => Object.assign(new Error(message), { status })

/**
 * 요청 본문을 JSON 으로. 청크를 문자열로 이어 붙이면 안 됩니다 — `s += c` 는 조각마다
 * `toString()` 을 불러, 3바이트 한글이 경계에 걸리면 양쪽이 `U+FFFD` 로 풀리고
 * `JSON.parse` 는 그대로 통과합니다. 조각을 모아 끝에 한 번 디코드하고, 상한도 바이트로 셉니다.
 */
const BODY_MAX = 2_000_000
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0, over = false
    req.on('data', (c) => {
      if (over) return                    // 넘친 뒤로는 쌓지 않고 흘려보냅니다
      size += c.length
      if (size > BODY_MAX) { over = true; chunks.length = 0; reject(clientError(413, '본문이 너무 큽니다')); return }
      chunks.push(c)
    })
    req.on('end', () => {
      if (over) return
      const text = Buffer.concat(chunks).toString('utf8')
      let parsed
      try { parsed = text ? JSON.parse(text) : {} }
      catch { return reject(clientError(400, '본문이 JSON 이 아닙니다')) }
      /* `null`·배열·숫자가 오면 아래가 전부 `b.x` 로 읽어 500 이 됩니다 — 여기서 막습니다 */
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reject(clientError(400, '본문이 객체가 아닙니다'))
      }
      resolve(parsed)
    })
    req.on('error', reject)
  })

/**
 * 첨부가 놓이는 곳 — 레포 밖입니다. 공개 사이트는 git pull 로 배포되므로 `public/` 안에
 * 쓰면 체크아웃을 정리하는 날 같이 날아갑니다. nginx 가 admin 과 공개 양쪽에서 같은
 * `/uploads/` 로 내주므로 `attachment://{id}` 는 편집 화면에서도 발행 뒤에도 같은 주소입니다.
 */
/**
 * 글 한 편이 사는 곳 — 구운 HTML 과 올린 사진이 같은 폴더입니다.
 *
 *   {BLOG_DIR}/12/index.html      구운 글
 *   {BLOG_DIR}/12/ab3f….webp      그 글에 올린 사진
 *
 * 갈라 두면 삭제가 두 곳이고 한쪽만 지우면 고아가 남습니다. 합쳐 두면 `rm -rf {BLOG_DIR}/12`
 * 한 줄이고 nginx 도 `/blog/` 하나만 내주면 됩니다.
 * 이 폴더는 git 체크아웃 밖에 있어야 합니다 — 올린 사진은 커밋으로 다시 만들 수 없는
 * 원본인데 `git clean -fdx` 는 ignore 된 것을 지우라는 명령입니다.
 * 굽기는 폴더를 통째로 지우지 않고 index.html 만 덮어쓰며, 글이 없어졌을 때만 지웁니다.
 */
const SITE = need('BLOG_DIR')
/**
 * 휴지통 — `BLOG_DIR` 의 형제 폴더. nginx 는 `BLOG_DIR` 만 alias 하므로 밖으로 안 나갑니다.
 * 화면에는 되돌리기가 없습니다(파일을 먼저 지우는 구조라 진짜 undo 는 못 만듭니다). 다만 잘못
 * 지운 사진 원본이 영구히 사라지지 않게 `rm` 대신 여기로 옮깁니다. 비우기는 손으로: `rm -rf trash/*`
 */
const TRASH = process.env.TRASH_DIR || `${dirname(SITE)}/trash`
/**
 * 받을 사진 종류. SVG 는 제외했습니다 — 그림이 아니라 스크립트가 도는 문서입니다.
 * 올라간 파일은 `/blog/` 로 나가는데 그 자리를 관리자 오리진도 alias 하므로, 올린 SVG 의
 * 스크립트가 관리자 화면과 같은 오리진에서 실행됩니다.
 */
const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'image/webp': '.webp', 'image/avif': '.avif',
}
const MAX_UPLOAD = 25 * 1024 * 1024

/**
 * 파비콘으로 받는 형식. 위 `EXT` 와 달리 **SVG 가 있습니다** — 까닭과 방어는
 * `POST /api/favicon` 주석에 적었습니다. 대신 사진 형식은 둘로 줄였습니다(파비콘은
 * 사진이 아닙니다). GIF 를 빼는 이유는 움직이는 파비콘을 만들 이유가 없어서입니다.
 */
const FAVICON_EXT = { 'image/svg+xml': '.svg', 'image/png': '.png', 'image/webp': '.webp' }
/** 16px 에 뜨는 그림입니다. 이보다 크면 그림이 아니라 다른 것입니다 */
const FAVICON_MAX = 64 * 1024

/** 앞머리 바이트가 그 형식인가 — 확장자와 알맹이가 어긋난 것을 거릅니다 */
const looksLike = (ext, b) => (ext === '.png'
  ? b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  : b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP')

/** 날것 바이트로 읽습니다 — readBody 는 JSON 파서라 사진에 못 씁니다 */
const readBytes = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let n = 0, over = false
    req.on('data', (c) => {
      if (over) return
      n += c.length
      /* 소켓을 끊지 않습니다 — `req.destroy()` 는 413 응답이 나가기 전에 연결을 닫아
         화면이 「파일이 너무 큽니다」 대신 연결 오류를 받습니다. 나머지는 흘려보냅니다 */
      if (n > MAX_UPLOAD) { over = true; chunks.length = 0; reject(clientError(413, '파일이 너무 큽니다 (25MB 상한)')); return }
      chunks.push(c)
    })
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks)) })
    req.on('error', reject)
  })

const auth = (req) => verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))

/**
 * 글 번호 — 주소가 됩니다(`/blog/12/`). 시퀀스가 줍니다: `max(no)+1` 은 같은 순간에 두 번
 * 저장하면 겹치고, 날짜+무작위는 주소가 길어집니다. 시퀀스는 저장 전에 뽑을 수 있어
 * 사진을 `uploads/{번호}/` 에 바로 쌓을 수 있습니다 — 나중에 파일을 옮기는 단계가 없습니다.
 */
const reserveNo = async () =>
  String((await pool.query(`select nextval('posts_no_seq') as n`)).rows[0].n)

/**
 * 문서와 제목이 실제로 쓰고 있는 첨부 id.
 *
 * 화면이 보내 준 목록을 그대로 신뢰하지 않습니다. 추가했습니다 삭제한 사진이 목록에 남아 있으면
 * 영영 안 지워지는 파일이 됩니다. 정본은 본문입니다.
 */
function referencedIds(doc, titleDoc) {
  const out = new Set()
  const SCHEME = 'attachment://'
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    const src = n.attrs?.src
    if (typeof src === 'string' && src.startsWith(SCHEME)) out.add(src.slice(SCHEME.length))
    n.content?.forEach(walk)
  }
  walk(doc)
  const b = titleDoc?.banner?.src
  if (typeof b === 'string' && b.startsWith(SCHEME)) out.add(b.slice(SCHEME.length))
  return out
}

/**
 * 무드보드 이미지 목록을 정규화합니다 — 작업 하나가 들고 있는 그림 전부.
 * 디스크에 실제로 있는 것만 남깁니다. 화면이 보낸 id 를 그대로 적어 두면 올리다 끊긴
 * 그림이 목록에 남아 공개면에서 깨진 그림으로 나갑니다. 보낸 차례가 곧 `ord` 입니다.
 */
const MOOD_MAX = 200
const okFileName = (v) => typeof v === 'string' && /^[0-9a-f]{32}\.[a-z0-9]{2,5}$/.test(v)

const normalizeImages = (list, no) => {
  const problems = []
  if (!Array.isArray(list)) return { images: [], problems: ['이미지 목록이 배열이 아닙니다'] }
  if (list.length > MOOD_MAX) problems.push(`이미지는 ${MOOD_MAX}장까지입니다`)
  const seen = new Set()
  const images = []
  for (const raw of list.slice(0, MOOD_MAX)) {
    const it = raw && typeof raw === 'object' ? raw : {}
    if (!okFileName(it.id)) { problems.push(`이상한 그림 이름입니다: ${String(it.id).slice(0, 40)}`); continue }
    if (seen.has(it.id)) continue                       /* 같은 그림을 두 번 — 조용히 한 번만 */
    if (!existsSync(`${SITE}/${no}/${it.id}`)) { problems.push(`올라오지 않은 그림입니다: ${it.id}`); continue }
    seen.add(it.id)
    /* 작은 판은 있으면 쓰고 없으면 원본입니다 — 없다고 저장을 막지 않습니다 */
    const thumb = okFileName(it.thumb) && existsSync(`${SITE}/${no}/${it.thumb}`) ? it.thumb : null
    const size = (v) => (Number.isInteger(v) && v > 0 && v < 100000 ? v : null)
    images.push({ id: it.id, thumb, w: size(it.w), h: size(it.h) })
  }
  return { images, problems }
}

/**
 * 판을 하나 쌓습니다 — `max(rev)+1` 은 동시에 부르면 같은 번호를 두 번 계산합니다.
 * READ COMMITTED 에서 실제로 났습니다: 다섯을 동시에 보내니 하나가 기본키 충돌로 500 이었습니다.
 * 트랜잭션을 여는 대신 진 쪽이 다시 세게 합니다 — 판은 늘 하나씩 늘어납니다.
 *
 * `db` 는 보통 풀입니다. 카테고리 삭제처럼 **글을 고치는 것과 한 트랜잭션**이어야 하는 자리는
 * 제 커넥션을 넘깁니다 — 설정만 먼저 바뀌고 글이 안 바뀐 채 끝나면 그 사이 굽기가 그 글을
 * 「기본」으로 읽어 `/blog/` 에 내보냅니다(비공개 카테고리였다면 그 순간 새어 나갑니다).
 */
const appendRev = async (key, value, by, via = null, tries = 5, db = pool) => {
  for (let i = 0; ; i++) {
    try {
      return await db.query(
        `insert into site_settings (key, rev, value, created_by, via)
         select $1, coalesce(max(rev), 0) + 1, $2::jsonb, $3, $4 from site_settings where key = $1
         returning rev`, [key, JSON.stringify(value), by, via])
    } catch (e) {
      if (e.code !== '23505' || i >= tries) throw e     // 23505 = 기본키 충돌
    }
  }
}

/* 주소로 쓸 수 없는 낱말(`RESERVED`)은 `shared/category.mjs` 로 갔습니다 — 카테고리 주소를 관리자가
   저장 전에 같은 목록으로 거르려면 브라우저도 알아야 해서입니다. 여기서는 안 씁니다: 글 주소는
   시퀀스가 준 정수뿐이고, 카테고리 주소는 정규화(`normCategories`)가 그 목록으로 거릅니다 */

/**
 * 글에 붙는 것 둘 — 카테고리(식별자 하나)와 태그(글자 목록). `posts.meta` / `draft_meta` 에 앉습니다.
 *
 * 이 두 열은 작업물용으로 파 두고 **아무 문도 안 쓰던** 자리였습니다 — 받는 값을 거르는 곳도
 * 없었습니다. jsonb 라 아무 모양이나 들어가므로 여기서 모양을 못 박습니다: `{ category, tags }`.
 * 둘 다 비면 `null` — 카테고리를 안 쓰는 글의 행은 지금과 같은 모습으로 남습니다.
 *
 * 카테고리는 **식별자**로 가리킵니다(이름·주소가 아니라). 이름을 바꿔도 글이 고아가 안 됩니다.
 * 지금 설정에 없는 식별자는 거절합니다 — 관리자가 들고 있던 목록이 낡았을 수 있어서(다른 탭에서
 * 지웠거나), 조용히 받으면 「개발에 넣었다」고 믿은 글이 `/blog/` 에만 나갑니다.
 *
 * 태그는 **입력과 저장까지만**입니다 — 태그 페이지도 목록도 아직 없습니다(사용자 결정).
 * 대소문자만 다른 태그는 하나로 봅니다. `< >` 는 거절합니다 — 언젠가 화면에 찍힐 값입니다.
 *
 * 「안 보냈다」와 「비웠다」를 **가려서** 돌려줍니다(`sent`·`empty`). 초안 열은 발행본 위에
 * `coalesce(draft_meta, meta)` 로 겹쳐 읽히기 때문입니다 — 비운 초안을 null 로 저장하면
 * 발행본의 카테고리가 도로 비쳐, 글을 다시 열었을 때 분명히 뺀 카테고리가 그대로 있습니다.
 * 초안은 비워도 **빈 객체**를 적어 발행본을 가려야 합니다. 부르는 쪽이 그 판단을 합니다.
 */
const TAG_MAX = 20
const TAG_LEN = 30
const normalizeMeta = (raw, knownIds) => {
  const problems = []
  /* 주석에 「엄격한 문」이라 적어 두고 모양이 틀린 값을 조용히 빈 것으로 읽고 있었습니다 —
     `meta:"cgaebal"` 을 보내면 200 에 카테고리만 사라졌습니다. `normalizeImages` 와 같은 규율로 맞춥니다 */
  const 객체 = raw === undefined || raw === null || (typeof raw === 'object' && !Array.isArray(raw))
  if (!객체) problems.push('카테고리·태그는 { category, tags } 꼴이어야 합니다')
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  let category = ''
  if (src.category !== undefined && src.category !== null && src.category !== '') {
    if (typeof src.category !== 'string' || !CATEGORY_ID.test(src.category)) problems.push('카테고리 식별자가 이상합니다')
    else if (!knownIds.has(src.category)) problems.push('없는 카테고리입니다 — 홈디자인 → 블로그에서 먼저 만들어 주세요')
    else category = src.category
  }
  const tags = []
  if (src.tags !== undefined && src.tags !== null) {
    if (!Array.isArray(src.tags)) problems.push('태그는 목록이어야 합니다')
    else {
      const seen = new Set()
      for (const t of src.tags) {
        /* 글자 단위로 자릅니다 — UTF-16 단위로 자르면 이모지 반쪽이 남아 JSON 저장이 500 으로 실패합니다 */
        const one = [...String(t ?? '').trim()].slice(0, TAG_LEN).join('')
        if (!one) continue
        if (/[<>]/.test(one)) { problems.push(`태그에 < > 는 쓸 수 없습니다 (${one})`); continue }
        const key = one.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        tags.push(one)
      }
      if (tags.length > TAG_MAX) problems.push(`태그는 ${TAG_MAX}개까지입니다 (${tags.length}개)`)
    }
  }
  const sent = raw !== undefined && raw !== null
  return { value: { category, tags }, sent, empty: !category && !tags.length, problems }
}

/** 지금 설정의 카테고리 식별자들 — 글이 가리켜도 되는 것 */
const knownCategoryIds = async () =>
  new Set(((await loadConf(pool)).blog.categories || []).map((c) => c.id))

/**
 * 「이 블로그 설정을 넣으면 **주인 잃은 글**이 생기는가」를 묻습니다. 생기면 저장을 막습니다.
 *
 * 카테고리를 제대로 지우는 문(`POST /api/categories/delete`)은 한 트랜잭션으로 그 글들을 초안으로
 * 내려 이 구멍을 막아 둡니다. 그런데 **블로그 설정을 그냥 저장하거나 되돌리면** 그 보호가 없습니다 —
 * 카테고리만 목록에서 빠지고 글의 `meta.category` 는 그대로 남습니다.
 *
 * 남으면 굽기가 그 글을 「모르는 식별자」로 읽습니다. 비공개 카테고리의 글이었다면 그 순간
 * 공개 목록에 실립니다 — 「주소로도 안 열리게」가 거짓이 됩니다. 도달하는 길이 둘 있습니다:
 *   · 관리자 「되돌리기」 한 번 (카테고리가 생기기 전 판으로 가면 전부 주인을 잃습니다)
 *   · 오래 열어 둔 탭의 「사이트에 적용」 (그 탭이 모르는 카테고리가 목록에서 빠집니다)
 *
 * 그래서 **여기가 난간입니다.** 지우려면 카테고리 삭제 문으로 가야 합니다 — 거기가 글을 챙깁니다.
 * 초안은 공개면이 없으므로 세지 않습니다.
 */
const orphanedByBlog = async (nextBlog) => {
  const keep = new Set((nextBlog.categories || []).map((c) => c.id))
  const { rows } = await pool.query(
    `select meta->>'category' as id, count(*)::int as n
       from posts
      where kind = 'post' and published_at is not null and meta->>'category' is not null
      group by 1`)
  const now = (await loadConf(pool)).blog.categories || []
  const 이름 = new Map(now.map((c) => [c.id, c.label]))
  return rows.filter((r) => r.id && !keep.has(r.id))
    .map((r) => ({ id: r.id, label: 이름.get(r.id) || r.id, n: r.n }))
}

/** 난간에 걸렸을 때 사람에게 보일 한 줄 */
const orphanError = (lost, what) =>
  `${what} 「${lost.map((o) => `${o.label}」의 발행 글 ${o.n}편`).join(', 「')}이 주인을 잃습니다`
  + ' — 카테고리를 지우려면 그 줄의 × 를 쓰세요(글을 초안으로 내려 줍니다)'

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  try {
    if (req.method === 'POST' && p === '/api/login') {
      const wait = gateWait()
      if (wait === null) return json(res, 429, { error: '잠시 뒤에 다시 시도해 주세요' })
      if (wait) await sleep(wait)

      const b = await readBody(req)
      /* `String()` 으로 못 고정합니다. 판정만 문자열로 하고 원본을 SQL 에 넘기면
         배열·객체가 그대로 들어갑니다(바인딩이라 주입은 아니지만 형이 엉킵니다). */
      const id = String(b?.id ?? '').trim()
      const password = String(b?.password ?? '')

      /* 계정은 이 스키마의 `admins` 다. search_path 가 가르므로 사이트 간 검사가 따로 없습니다.
         비교는 DB 안에서 `crypt()` 가 합니다 — 해시가 제 알고리즘을 들고 있습니다. */
      const { rows } = await pool.query(
        `select id, password_hash from admins
          where id = $1 and password_hash = crypt($2, password_hash)`, [id, password])
      if (!rows.length) {
        gateFail()
        return json(res, 401, { error: '아이디 또는 비밀번호가 맞지 않습니다' })
      }
      gateOk()

      /**
       * 해시 올리기 — 평문을 아는 유일한 순간이 여깁니다.
       * 옛 계정은 `gen_salt('bf')` 기본값(cost 6)으로 만들어졌습니다. 다음 로그인 한 번으로
       * cost 12 가 되고, 쓰는 사람은 아무것도 안 해도 됩니다.
       */
      if (!rows[0].password_hash.startsWith(`$2a$${BCRYPT_COST}$`)) {
        await pool.query(
          `update admins set password_hash = crypt($2, gen_salt('bf', ${BCRYPT_COST})),
                             updated_at = now() where id = $1`, [id, password])
          .catch((e) => console.error('해시 올리기 실패:', e.message))
      }

      /* 이 기기의 옛 가족을 끊습니다 — 「털린 것 같으니 다시 로그인」이 실제로 듣게 하려면
         필요합니다. 쿠키 자리를 `/api` 로 넓힌 덕에 로그인 요청에도 쿠키가 실려 옵니다.
         다른 기기의 가족은 건드리지 않습니다(그건 비밀번호 바꾸기가 할 일입니다). */
      const old = cookieOf(req, COOKIE)
      if (old) {
        await pool.query(
          `update sessions set revoked_at = now()
            where family = (select family from sessions where token_hash = $1)
              and revoked_at is null`, [hashOf(old)])
      }
      /* 로그인은 새 출발입니다 — 옛 경로에 남은 쿠키도 여기서 비웁니다 */
      await issueRefresh(res, id, req.headers['user-agent'], null, null, true)
      sweep()
      return json(res, 200, { token: mint(id), id })
    }

    /**
     * 갱신 — RTR 의 심장. 쿠키의 리프레시를 해시로 찾아 회전합니다: 옛 행에 `used_at` 을 찍고
     * 같은 가족으로 새 행을 만듭니다. 이미 쓴 토큰이 또 오면 둘 중 하나입니다 —
     *   · 유예(10초) 안이면 탭 경합입니다. 후계자를 그대로 씁니다
     *   · 그 밖이면 탈취입니다. 그 가족을 통째로 죽입니다
     */
    if (req.method === 'POST' && p === '/api/auth/refresh') {
      const raw = cookieOf(req, COOKIE)
      if (!raw) return clearCookie(res), json(res, 401, { error: '로그인이 필요합니다' })
      const { rows } = await pool.query(
        `select id, family, admin_id, used_at, revoked_at, expires_at,
                expires_at < now() as dead
           from sessions where token_hash = $1`, [hashOf(raw)])
      const row = rows[0]
      if (!row || row.revoked_at || row.dead) {
        return clearCookie(res), json(res, 401, { error: '로그인이 필요합니다' })
      }
      if (row.used_at) {
        if (Date.now() - new Date(row.used_at).getTime() > ROTATE_GRACE) {
          await pool.query(
            `update sessions set revoked_at = now() where family = $1 and revoked_at is null`,
            [row.family])
          console.error(`리프레시 재사용 감지 — 가족 ${row.family} 폐기`)
          return clearCookie(res), json(res, 401, { error: '로그인이 필요합니다' })
        }
        /**
         * 유예 안 — 탭 경합이거나 앞선 회전의 응답이 유실된 경우입니다.
         * 여기서 쿠키를 다시 안 심으면 브라우저가 이미 쓴 토큰을 계속 들고 있다가 10초 뒤에
         * 탈취로 읽혀 세션이 통째로 실패합니다. 유예 안이라는 것 자체가 우리 클라이언트라는 뜻입니다.
         */
        await issueRefresh(res, row.admin_id, req.headers['user-agent'], row.family, row.expires_at)
        return json(res, 200, { token: mint(row.admin_id), id: row.admin_id })
      }
      /**
       * 회전은 한 문장으로 선택합니다 — `used_at is null` 을 조건에 넣어야 한 번만 이깁니다.
       * 조회와 갱신을 갈라 두면 동시 요청이 전부 「아직 안 썼습니다」를 보고 각자 새 토큰을 만듭니다.
       * 실제로 5개를 동시에 보내니 회전이 3번 일어나 살아 있는 리프레시가 셋이 됐습니다.
       * 조건부 갱신 하나면 진 쪽의 `rowCount` 가 0 입니다.
       */
      const claim = await pool.query(
        `update sessions set used_at = now() where id = $1 and used_at is null returning id`,
        [row.id])
      if (!claim.rowCount) {
        /* 찰나에 다른 요청이 먼저 돌렸습니다. 새 토큰을 또 만들지 않습니다 —
           쿠키는 이긴 쪽이 이미 심었고, 이 응답은 액세스만 줍니다 */
        return json(res, 200, { token: mint(row.admin_id), id: row.admin_id })
      }
      await issueRefresh(res, row.admin_id, req.headers['user-agent'], row.family, row.expires_at)
      sweep()
      return json(res, 200, { token: mint(row.admin_id), id: row.admin_id })
    }

    /* 로그아웃 — 이제 진짜로 끊깁니다. 그 가족의 리프레시가 전부 실패합니다 */
    if (req.method === 'POST' && p === '/api/auth/logout') {
      const raw = cookieOf(req, COOKIE)
      if (raw) {
        await pool.query(
          `update sessions set revoked_at = now()
            where family = (select family from sessions where token_hash = $1)
              and revoked_at is null`, [hashOf(raw)])
      }
      clearCookie(res)
      return json(res, 200, { ok: true })
    }

    /* 새 글의 번호를 미리 받아 갑니다 — 사진을 저장 전에 그 번호 폴더로 올리려고 */
    if (req.method === 'POST' && p === '/api/posts/reserve') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      return json(res, 200, { no: await reserveNo() })
    }

    /**
     * 여러 글의 카테고리를 한 번에 — 카테고리를 지우면 거기 있던 글이 전부 초안이 되는데,
     * 그걸 한 편씩 열어 다시 앉히게 두면 열 편만 돼도 일입니다. 목록에서 골라 한 번에 보냅니다.
     * 빈 카테고리(`''`)는 「기본」 — 카테고리에서 뺍니다.
     *
     * `meta` 와 `draft_meta` **둘 다** 고칩니다. 목록·편집기는 `coalesce(draft_meta, meta)` 를 보고,
     * 발행 때 편집기가 들고 있던 값이 `meta` 로 옮겨 갑니다 — 한쪽만 고치면 고치던 초안이 있는 글은
     * 화면에 옛 카테고리가 남고 다음 발행에 되돌아갑니다. 태그는 그대로 둡니다.
     * 한 문장으로 끝내려고 `unnest` 로 폅니다(`/api/works/order` 와 같은 수법).
     *
     * `/api/posts/:slug` 보다 **앞**에 있어야 합니다 — 그 정규식이 `category` 도 글 주소로 읽습니다.
     */
    if (req.method === 'POST' && p === '/api/posts/category') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const b = await readBody(req)
      const slugs = Array.isArray(b.slugs) ? b.slugs.map(String).slice(0, 500) : null
      if (!slugs?.length) return json(res, 400, { error: '고른 글이 없습니다' })
      /* 「빼기」(`''`)는 명시적 선택이어야 합니다. 누락의 기본값이 파괴적이면, 키 하나 빠진 요청이
         고른 글 전부를 말없이 「기본」으로 내립니다 — 글 메타는 판을 안 쌓아 되돌릴 문이 없습니다 */
      if (b.category === undefined) return json(res, 400, { error: '어느 카테고리로 옮길지 안 보냈습니다 (빼려면 빈 문자열)' })
      const { value, problems } = normalizeMeta({ category: b.category }, await knownCategoryIds())
      if (problems.length) return json(res, 400, { error: problems.join(' / '), problems })
      const category = value.category
      const { rowCount } = await pool.query(
        `update posts p
            set meta = jsonb_set(coalesce(p.meta, '{}'::jsonb), '{category}', to_jsonb($2::text)),
                draft_meta = case when p.draft_meta is null then null
                                  else jsonb_set(p.draft_meta, '{category}', to_jsonb($2::text)) end
           from (select unnest($1::text[]) as slug) x
          where p.slug = x.slug and p.kind = 'post'`, [slugs, category])
      /* 발행된 글이 섞여 있으면 카테고리 페이지가 바뀝니다 — 다시 굽습니다 */
      let bakeError = null
      try { await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
      return json(res, 200, { ok: true, count: rowCount, category, bakeError })
    }

    /**
     * 카테고리 삭제 — 설정에서 빼는 것과 거기 있던 글을 **한 트랜잭션**으로 묶습니다.
     *
     * 왜 `/api/settings` 로 안 하는가: 설정 저장은 값을 쌓을 뿐 글을 모릅니다. 카테고리만 먼저
     * 사라지면 그 사이 굽기가 그 글을 「모르는 식별자 → 기본」으로 읽어 `/blog/` 에 내보냅니다 —
     * 비공개 카테고리였다면 지우는 순간 새어 나가는 셈입니다. 그래서 글을 먼저 초안으로 돌리고
     * 같은 트랜잭션에서 판을 쌓습니다.
     *
     * 거기 있던 글은 **초안**이 됩니다(`published_at = null`). 「기본」으로 옮기지 않는 까닭:
     * 카테고리를 지운 사람이 그 글들을 어디에 둘지는 그 사람이 정할 일이고, 조용히 `/blog/` 에
     * 내보내면 지운 줄 알았던 글이 공개면에 남습니다. 지워진 글이 아니므로 폴더(사진)는 그대로이고
     * 굽기가 `index.html` 만 치웁니다. 어디에 둘지는 목록의 「카테고리 지정」이 맡습니다.
     *
     * 저장된 판(`loadConf`)에서 뺍니다 — 관리자가 아직 반영 안 한 다른 수정을 같이 저장해 버리지
     * 않으려고. 관리자는 돌려받은 값으로 「마지막 반영」만 갱신하고 제 수정은 그대로 둡니다.
     */
    if (req.method === 'POST' && p === '/api/categories/delete') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const b = await readBody(req)
      const id = String(b.id || '')
      const conf = await loadConf(pool)
      const cat = (conf.blog.categories || []).find((c) => c.id === id)
      if (!cat) return json(res, 404, { error: '없는 카테고리입니다' })
      const next = { ...conf.blog, categories: conf.blog.categories.filter((c) => c.id !== id) }
      const c = await pool.connect()
      let drafted = 0
      let rev = null
      try {
        await c.query('begin')
        /* 발행 중이던 글 수 — 화면이 「N편이 초안이 됐습니다」를 말하려고 */
        const was = await c.query(
          `select count(*)::int as n from posts
            where kind = 'post' and published_at is not null and meta->>'category' = $1`, [id])
        drafted = was.rows[0].n
        /* 발행본(meta)이 이 카테고리면 초안으로. 초안 그림자(draft_meta)의 참조도 같이 지웁니다 —
           식별자가 남으면 다음 발행 때 「없는 카테고리」로 400 이 나서 발행이 막힙니다 */
        await c.query(
          `update posts
              set published_at = case when meta->>'category' = $1 then null else published_at end,
                  meta = case when meta->>'category' = $1 then meta - 'category' else meta end,
                  draft_meta = case when draft_meta->>'category' = $1 then draft_meta - 'category' else draft_meta end
            where kind = 'post' and (meta->>'category' = $1 or draft_meta->>'category' = $1)`, [id])
        const { rows } = await appendRev('blog', next, auth(req)?.sub || null, null, 5, c)
        rev = rows[0].rev
        await c.query('commit')
      } catch (e) { await c.query('rollback').catch(() => {}); throw e } finally { c.release() }
      /* 굽기가 옛 `/blog/<slug>/index.html` 을 치웁니다(bake.mjs 의 `sweepCategories`) */
      let bakeError = null
      try { await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
      return json(res, 200, { ok: true, rev, value: next, drafted, bakeError })
    }

    if (p === '/api/posts') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })

      if (req.method === 'GET') {
        /* 글과 작업은 섞이지 않습니다. 안 적으면 글입니다 — 옛 화면이 그대로 돕니다 */
        const kind = url.searchParams.get('kind') || 'post'
        if (kind !== 'post' && kind !== 'work') return json(res, 400, { error: '없는 종류입니다' })
        /* 목록에는 body/doc 을 싣지 않습니다 — 글이 쌓이면 응답이 통째로 무거워집니다 */
        const { rows } = await pool.query(
          `select id, no, slug, title, published_at, hidden, created_at, updated_at, kind, ord,
                  coalesce(draft_meta, meta) as meta,
                  (draft_at is not null) as has_draft,
                  length(body) as body_len,
                  -- 작업 목록은 글자가 아니라 이미지로 구별합니다.
                  -- 썸네일이 있으면 그것을 씁니다. 목록에 2000px 원본을 쓸 이유가 없습니다
                  (select coalesce(a.thumb, a.file_path) from post_attachments a
                    where a.post_id = posts.id and a.kind = 'banner' limit 1) as cover,
                  (select count(*)::int from post_attachments a
                    where a.post_id = posts.id and a.kind in ('mood', 'banner')) as image_count,
                  -- 지우기 전에 「사진 몇 장이 같이 없어지는가」를 화면이 말해야 한다
                  (select count(*)::int from post_attachments a where a.post_id = posts.id)
                    as attachment_count
             from posts
            where kind = $1
            -- 작업물은 손으로 정한 순서가 먼저다. 글은 ord 가 늘 비어 있어 옛 순서 그대로다
            order by ord nulls last, coalesce(published_at, created_at) desc`,
          [kind],
        )
        return json(res, 200, { posts: rows })
      }

      if (req.method === 'POST') {
        const b = await readBody(req)
        const title = String(b.title || '').trim()
        if (!title) return json(res, 400, { error: '제목을 입력해 주세요' })

        /* 주소는 글 번호입니다. 한글 제목을 자동 변환하면 %ED%95%9C… 가 되고,
           날짜는 같은 날 여러 편을 쓰면 뒤에 무작위를 붙여야 해서 길어집니다. */
        const no = String(b.no || '').match(/^\d+$/) ? String(b.no) : await reserveNo()
        /**
         * 주소는 글 번호입니다. 사진도 번호로 쌓이므로(`{BLOG_DIR}/{번호}/`) 글 하나가
         * 한 폴더에 모입니다 — 쓸 자리도 하나, 내릴 때 치울 자리도 하나입니다.
         * 주소와 번호를 갈라 두면 삭제가 `{번호}` 폴더만 치워 `{주소}/index.html` 이
         *   공개면에 남습니다. 자유 주소를 주려면 청소와 업로드를 같이 옮겨야 합니다.
         */
        const slug = no

        /**
         * 이 문은 글만 다룹니다. 작업은 제 문(`/api/works`)이 있습니다.
         * 여기서 `kind` 를 받으면 안 됩니다 — 작업 번호를 보내면 아래의 첨부 재작성이 「본문이 쓰는
         * 것」 기준으로 돌아 무드보드 그림이 통째로 지워집니다. 종류는 만들 때 정해집니다.
         */

        /**
         * 초안과 발행은 다른 열에 씁니다. 열이 하나뿐일 때는 발행한 글에서 초안 저장을 누르면
         * 나간 글이 그 자리에서 바뀌었고 굽기까지 돌았습니다 — 두 단추가 같은 일을 했습니다.
         * 이제 초안은 `draft_*` 에만 앉고, 발행을 누를 때 본 열로 옮겨 갑니다.
         */
        const publish = b.publish !== false
        /* 카테고리·태그 — 초안이면 `draft_meta`, 발행이면 `meta` 에 앉습니다(본문과 같은 초안 그림자).
           여기가 엄격한 문입니다: 모양이 틀리면 고쳐서 저장하지 않고 돌려보냅니다 */
        const { value: meta, sent: metaSent, empty: metaEmpty, problems: metaProblems } =
          normalizeMeta(b.meta, await knownCategoryIds())
        if (metaProblems.length) return json(res, 400, { error: metaProblems.join(' / '), problems: metaProblems })
        /**
         * 발행 열(`meta`)은 아래에 겹쳐 읽는 것이 없으므로 비면 null 로 둡니다 — 카테고리를 안 쓰는
         * 글의 행이 예전과 같은 모습으로 남습니다.
         *
         * 초안 열(`draft_meta`)은 다릅니다. **비웠다는 사실 자체를 적어야** 합니다 —
         * null 로 두면 `coalesce(draft_meta, meta)` 가 발행본의 카테고리를 끌어올려, 카테고리를
         * 빼고 저장한 글을 다시 열면 뺀 적이 없는 것처럼 보입니다. 저장은 되는데 되읽기가 안 되는
         * 꼴이라 화면만 보고는 못 알아챕니다. 안 보낸 요청(옛 화면)은 예전처럼 null 입니다.
         */
        const metaJson = metaEmpty && (publish || !metaSent) ? null : JSON.stringify(meta)
        const { rows } = publish
          ? await pool.query(
              `insert into posts (no, slug, title, body, doc, width, title_doc, published_at, meta)
                    values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, now(), $8::jsonb)
               on conflict (slug) do update
                    set title = excluded.title, body = excluded.body, doc = excluded.doc,
                        width = excluded.width, title_doc = excluded.title_doc,
                        -- 안 보냈으면 그대로 둡니다. 조건 없이 덮으면 meta 를 안 싣는 도구가
                        -- (tools/draft-to-post.mjs) 글을 다시 발행할 때 카테고리를 말없이 지웁니다.
                        -- 그 카테고리가 비공개였다면 다음 굽기에 그 글이 공개 목록으로 새어 나갑니다.
                        meta = case when $9 then excluded.meta else posts.meta end,
                        published_at = coalesce(posts.published_at, excluded.published_at),
                        -- 발행했으니 들고 있던 초안은 비운다. 안 비우면 다음에 열 때
                        -- 방금 내보낸 글이 아니라 옛 초안이 뜬다
                        draft_body = null, draft_doc = null, draft_title = null,
                        draft_title_doc = null, draft_width = null, draft_meta = null, draft_at = null
                 where posts.kind = 'post'
                 returning id, no, slug, title, published_at, hidden, kind, meta`,
              [no, slug, title, String(b.body || ''), b.doc ? JSON.stringify(b.doc) : null,
               b.width ? String(b.width) : null, b.titleDoc ? JSON.stringify(b.titleDoc) : null, metaJson,
               metaSent],
            )
          : await pool.query(
              /* 새 글의 첫 초안은 본 열을 비운 채 행만 만듭니다 — 발행 전에는 공개면이 없습니다 */
              `insert into posts (no, slug, title, body, draft_body, draft_doc, draft_title,
                                  draft_title_doc, draft_width, draft_at, draft_meta)
                    values ($1, $2, $3, '', $4, $5::jsonb, $3, $6::jsonb, $7, now(), $8::jsonb)
               on conflict (slug) do update
                    set draft_body = excluded.draft_body, draft_doc = excluded.draft_doc,
                        draft_title = excluded.draft_title, draft_title_doc = excluded.draft_title_doc,
                        draft_width = excluded.draft_width, draft_meta = excluded.draft_meta, draft_at = now(),
                        -- 발행 전(published_at is null)인 글은 목록에 제목이 보여야 하므로
                        -- 제목만 본 열에도 같이 둔다. 발행된 글은 건드리지 않는다
                        title = case when posts.published_at is null then excluded.title else posts.title end
                 where posts.kind = 'post'
                 returning id, no, slug, title, published_at, hidden, kind, coalesce(draft_meta, meta) as meta`,
              [no, slug, title, String(b.body || ''), b.doc ? JSON.stringify(b.doc) : null,
               b.titleDoc ? JSON.stringify(b.titleDoc) : null, b.width ? String(b.width) : null, metaJson],
            )

        /* 첨부 기록을 본문 기준으로 다시 맞춥니다. 넣었다가 지운 사진은 여기서 제외되고,
           그러면 고아 파일 찾기(`referencedIds` 에 없는 파일)가 그걸 잡아냅니다. */
        const post = rows[0]
        /* 조건부 upsert 가 아무것도 안 돌려줬습니다 = 그 번호는 작업입니다. 첨부를 건드리기 전에 멈춥니다 */
        if (!post) return json(res, 409, { error: `${no} 번은 작업입니다 — 글로 못 씁니다` })
        /* 초안이든 발행이든 지금 문서가 쓰는 것을 기록합니다. 초안에만 있는 사진도
           파일은 이미 올라가 있으므로, 안 적어 두면 고아 파일 찾기가 그걸 지웁니다. */
        const used = referencedIds(b.doc, b.titleDoc)
        const bannerId = (() => {
          const src = b.titleDoc?.banner?.src
          return typeof src === 'string' && src.startsWith('attachment://') ? src.slice(13) : null
        })()
        await pool.query(`delete from post_attachments where post_id = $1`, [post.id])
        for (const id of used) {
          await pool.query(
            `insert into post_attachments (post_id, attachment_id, file_path, kind)
                  values ($1, $2, $3, $4)
             on conflict (post_id, attachment_id) do update set file_path = excluded.file_path, kind = excluded.kind`,
            [post.id, id, `/blog/${post.no}/${id}`, id === bannerId ? 'banner' : 'body'],
          )
        }

        /* 굽기가 실패하면 조용히 넘어가지 않습니다 — DB 에는 들어갔는데 공개 페이지에는
           안 보이는 상태가 「발행했는데 안 써집니다」의 정체입니다. 저장은 끝났으므로 글은
           잃지 않고, 대신 무엇이 실패했는지 화면까지 올려 보냅니다. */
        /* 초안 저장은 굽지 않습니다. 공개면은 발행한 것만 보여 줍니다 */
        let baked = null, bakeError = null
        if (publish) {
          try { baked = await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
        }
        return json(res, 200, { post: rows[0], baked, bakeError })
      }
    }

    /**
     * 작업(무드보드 폴더) — 글과 다른 문입니다.
     * 글 저장은 첨부 기록을 본문이 참조하는 것 기준으로 지우고 다시 넣는데(referencedIds),
     * 작업에는 본문이 없어 그 길을 타면 올린 그림이 다음 저장에서 통째로 사라집니다.
     * 그래서 제목과 그림 목록을 한 번에 받아 목록 그대로 적습니다 — 보낸 차례가 곧 순서입니다.
     * 글과 같은 표(`posts`, `post_attachments`)를 쓰므로 번호·숨김·휴지통·굽기 청소는 그대로
     * 따라옵니다. 다른 건 `kind` 와 이 문뿐입니다.
     */
    if (req.method === 'POST' && p === '/api/works') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const b = await readBody(req)
      const title = String(b.title || '').trim()
      if (!title) return json(res, 400, { error: '제목을 입력해 주세요' })

      const no = String(b.no || '').match(/^\d+$/) ? String(b.no) : await reserveNo()
      const { images, problems } = normalizeImages(b.images, no)
      if (problems.length) return json(res, 400, { error: problems.join(' / '), problems })

      /* 대표는 목록 안의 한 장입니다. 안 고르면 첫 장. 공개면의 카드·공유 그림이 이것입니다 */
      const cover = images.some((i) => i.id === b.cover) ? b.cover : images[0]?.id || null

      /**
       * 작업에는 본문도 편집 정본도 없습니다 — 빈 값으로 못 고정합니다.
       * 종류 검사를 고친 뒤에 하면 늦습니다: 글 번호로 이 문을 두드리면 제목이 이미 바뀐 뒤에
       * 400 이 나가고, 초안이던 글은 `published_at` 까지 찍혀 빈 글이 발행됩니다. 그래서
       * `where posts.kind = 'work'` 를 upsert 안에 겁니다.
       * 저장은 늘 발행입니다 — 「아직 안 보이게」는 `hidden` 이 맡습니다. 초안 축을 하나 더 두면
       * 본 열을 고치면서 굽기만 건너뛰는 상태가 생겨 다음 굽기에 준비 중인 것이 나갑니다.
       */
      const { rows } = await pool.query(
        /* `$1` 을 번호(정수)와 주소(글자) 두 자리에 쓰므로 형을 못 고정합니다 —
           안 박으면 Postgres 가 「형을 정할 수 없습니다」로 거절합니다 */
        `insert into posts (no, slug, title, body, kind, published_at)
              values ($1::bigint, $1::text, $2, '', 'work', now())
         on conflict (slug) do update
              set title = excluded.title,
                  published_at = coalesce(posts.published_at, now()),
                  draft_at = null
            where posts.kind = 'work'
           returning id, no, slug, title, published_at, hidden, kind`,
        [no, title])
      const work = rows[0]
      if (!work) return json(res, 409, { error: `${no} 번은 글입니다 — 작업으로 못 씁니다` })

      /**
       * 그림 목록을 통째로 갈아 끼웁니다. 지운 그림의 행은 사라지고 파일만 남는데, 글 쪽과 같은
       * 규약입니다(폴더째 휴지통으로 갑니다). 대표 한 장만 `kind='banner'` — 카드 커버 질의
       * (`kind='banner' limit 1`)가 그대로 반영됩니다.
       */
      /* 지우기와 넣기를 한 트랜잭션으로. 나눠 두면 같은 작업을 두 탭에서 저장할 때
         한쪽의 delete 와 다른 쪽의 insert 가 엇갈려 기본키 충돌(500)이 나거나,
         두 요청의 행이 섞인 채 남습니다 */
      const c = await pool.connect()
      try {
        await c.query('begin')
        /* 작업 행을 먼저 잠급니다. 트랜잭션만으로는 부족합니다 — 둘이 같이 돌면 각자
           옛 행만 지우고 같은 id 를 넣어 기본키 충돌(500)이 납니다. 여기서 줄을 세우면
           뒤에 온 쪽은 앞엣것이 끝난 뒤에 보므로 지울 것도 넣을 것도 어긋나지 않습니다 */
        await c.query(`select 1 from posts where id = $1 for update`, [work.id])
        await c.query(`delete from post_attachments where post_id = $1`, [work.id])
        if (images.length) {
          await c.query(
            `insert into post_attachments (post_id, attachment_id, file_path, kind, ord, w, h, thumb)
             select $1, x.id, $2 || x.id, case when x.id = $3 then 'banner' else 'mood' end,
                    x.i - 1, x.w, x.h, case when x.thumb = '' then null else $2 || x.thumb end
               from unnest($4::text[], $5::int[], $6::int[], $7::text[])
                    with ordinality as x(id, w, h, thumb, i)`,
            [work.id, `/blog/${no}/`, cover,
             images.map((i) => i.id), images.map((i) => i.w), images.map((i) => i.h),
             images.map((i) => i.thumb || '')])
        }
        await c.query('commit')
      } catch (e) { await c.query('rollback').catch(() => {}); throw e } finally { c.release() }

      let baked = null, bakeError = null
      try { baked = await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
      /**
       * 고친 결과를 통째로 돌려줍니다. 이 문은 말없이 셋을 고칩니다 — 없는 대표를 첫 장으로 바꾸고,
       * 파일이 없는 작은 판을 `null` 로 내리고, 같은 그림을 한 장으로 합칩니다. 개수만 돌려주면
       * 화면이 제 값을 「저장됐습니다」로 믿어 새로고침 전까지 화면과 DB 가 달라집니다.
       * `images` 는 파일 이름 모양 그대로이고, 경로는 화면이 `/blog/{번호}/` 로 짓습니다.
       */
      return json(res, 200, { work, images, count: images.length, cover, baked, bakeError })
    }

    /**
     * 작업 차례 — 관리자에서 끌어 옮긴 그 순서가 공개면 목록의 순서입니다.
     *
     * 보낸 목록에 없는 작업은 건드리지 않습니다(숨긴 것·다른 사람이 방금 올린 것).
     * 한 문장으로 끝내려고 `unnest` 로 번호를 매깁니다 — N 번 왕복하지 않습니다.
     */
    if (req.method === 'POST' && p === '/api/works/order') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const b = await readBody(req)
      const order = Array.isArray(b.order) ? b.order.map(String).slice(0, 500) : null
      if (!order?.length) return json(res, 400, { error: '순서가 비었습니다' })
      await pool.query(
        `update posts p set ord = x.i
           from (select unnest($1::text[]) as slug, generate_subscripts($1::text[], 1) as i) x
          where p.slug = x.slug and p.kind = 'work'`, [order])
      let bakeError = null
      try { await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
      return json(res, 200, { ok: true, count: order.length, bakeError })
    }

    /* 작업 하나 열기 — 제목과 그림 목록. 편집기를 안 쓰므로 doc·body 는 안 줍니다 */
    const oneWork = p.match(/^\/api\/works\/([^/]+)$/)
    if (req.method === 'GET' && oneWork) {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const { rows } = await pool.query(
        `select id, no, slug, title, published_at, hidden from posts where slug = $1 and kind = 'work'`,
        [decodeURIComponent(oneWork[1])])
      if (!rows.length) return json(res, 404, { error: '없는 작업입니다' })
      const att = await pool.query(
        `select attachment_id, file_path, kind, ord, w, h, thumb
           from post_attachments where post_id = $1 order by ord nulls last, attachment_id`,
        [rows[0].id])
      return json(res, 200, { work: rows[0], images: att.rows })
    }

    /* 다시 열어 고칠 때 — 편집 정본(doc)까지 내려줍니다 */
    const one = p.match(/^\/api\/posts\/([^/]+)$/)
    if (req.method === 'GET' && one) {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      /* 글 주소로 작업을 열면 작업 칸이 없는 편집기가 뜹니다 — 그 상태로 저장하면
         메타가 날아갑니다. 종류가 다르면 없는 글입니다(화면이 옳은 주소로 가게 둡니다) */
      const wantKind = url.searchParams.get('kind') || 'post'
      const { rows } = await pool.query(
        /* 고치던 초안이 있으면 그것을 엽니다 — 없으면 나간 글을 엽니다.
           `has_draft` 로 화면이 「지금 보고 있는 게 초안인가」를 압니다. */
        `select id, no, slug, published_at, hidden,
                coalesce(draft_title, title)         as title,
                coalesce(draft_body, body)           as body,
                coalesce(draft_doc, doc)             as doc,
                coalesce(draft_width, width)         as width,
                coalesce(draft_title_doc, title_doc) as title_doc,
                coalesce(draft_meta, meta)           as meta,
                kind, ord,
                (draft_at is not null)               as has_draft
           from posts where slug = $1 and kind = $2`,
        [decodeURIComponent(one[1]), wantKind],
      )
      if (!rows.length) return json(res, 404, { error: '없는 글입니다' })
      /* 첨부는 id 만 본문에 있고 주소는 여기 있습니다 — 안 주면 다시 열었을 때 사진이 빈칸이 됩니다 */
      const att = await pool.query(
        `select attachment_id, file_path, kind from post_attachments where post_id = $1`, [rows[0].id])
      return json(res, 200, { post: rows[0], attachments: att.rows })
    }

    /* 사진 올리기 — 본문에는 주소가 아니라 id 만 남습니다(attachments.ts 의 계약) */
    if (req.method === 'POST' && p === '/api/media') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const ext = EXT[type]
      /* 받는 형식을 적어 둔 것만 받습니다 — 확장자를 요청이 정하게 두면 .html 을 올려
         같은 도메인에서 실행시킬 수 있습니다 */
      if (!ext) return json(res, 415, { error: `지원하지 않는 형식입니다 (${type || '없음'})` })
      /* 어느 글의 사진인지 받습니다 — 글마다 폴더를 갈라야 글을 지울 때 통째로 치울 수 있습니다.
         번호는 시퀀스라 저장 전에 미리 뽑아 둘 수 있습니다(`POST /api/posts/reserve`). */
      const no = String(req.headers['x-post-no'] || '')
      if (!/^\d+$/.test(no)) return json(res, 400, { error: '글 번호가 없습니다' })
      const bytes = await readBytes(req)
      if (!bytes.length) return json(res, 400, { error: '빈 파일입니다' })
      await mkdir(`${SITE}/${no}`, { recursive: true })
      const id = randomBytes(16).toString('hex') + ext
      await writeFile(`${SITE}/${no}/${id}`, bytes)
      /* 화면은 id 만 본문에 넣고, 주소는 이 경로를 씁니다. 같은 값이 저장 때 DB 에도 들어갑니다 */
      return json(res, 200, { id, path: `/blog/${no}/${id}` })
    }

    /**
     * 파비콘 올리기. `/api/media` 와 나눈 자리입니다.
     *
     * 나눈 까닭은 **SVG** 입니다. 글 첨부는 SVG 를 안 받습니다(위 EXT 주석) — 그 파일은
     * `/blog/` 로 나가고 그 자리를 관리자 오리진도 alias 해서, 열면 관리자와 같은 오리진에서
     * 스크립트가 돕니다. 그런데 파비콘은 SVG 여야 제 몫을 합니다: 16px 에서 안 뭉개지고,
     * 어두운 탭에서 색을 뒤집습니다(레포가 주는 열 개가 전부 그렇게 돼 있습니다).
     *
     * 그래서 여기만 열되 문을 셋으로 잠급니다.
     *   ① `svgUnsafe` 가 **거부**합니다 — 살균이 아닙니다(빠뜨린 것이 통과하면 아무도 모릅니다)
     *   ② nginx 가 이 자리의 .svg 에 `CSP: default-src 'none'` 을 겁니다 (deploy/nginx.conf)
     *   ③ 상한이 64KB 입니다 — 파비콘이 그보다 클 이유가 없고, 큰 것은 그림이 아닙니다
     *
     * 자리는 `/blog/0/` 입니다. 글 번호는 1부터라 0 은 어느 글에도 안 속하는 사이트 전용
     * 폴더가 됩니다(메인 배경 이미지가 쓰는 그 자리입니다). 굽기는 글 폴더를 안 지웁니다.
     */
    if (req.method === 'POST' && p === '/api/favicon') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const ext = FAVICON_EXT[type]
      if (!ext) return json(res, 415, { error: `파비콘은 SVG·PNG·WebP 만 됩니다 (${type || '없음'})` })
      const bytes = await readBytes(req)
      if (!bytes.length) return json(res, 400, { error: '빈 파일입니다' })
      if (bytes.length > FAVICON_MAX) {
        return json(res, 413, { error: `파비콘이 너무 큽니다 (${Math.round(FAVICON_MAX / 1024)}KB 상한)` })
      }
      if (ext === '.svg') {
        const bad = svgUnsafe(bytes.toString('utf8'))
        if (bad) return json(res, 400, { error: `이 SVG 는 쓸 수 없습니다 — ${bad}` })
      } else if (!looksLike(ext, bytes)) {
        /* 확장자와 알맹이가 다르면 거부합니다. 안 보면 SVG 를 image/png 로 적어 올려
           `.png` 로 저장시킬 수 있습니다 — 그러면 위 ① 을 지나칩니다 */
        return json(res, 400, { error: '파일 알맹이가 형식과 다릅니다' })
      }
      await mkdir(`${SITE}/0`, { recursive: true })
      const id = randomBytes(16).toString('hex') + ext
      await writeFile(`${SITE}/0/${id}`, bytes)
      return json(res, 200, { id, path: `/blog/0/${id}` })
    }

    /**
     * 숨김 / 보임 — 발행은 그대로 두고 공개 페이지에서만 내립니다.
     * `published_at` 을 지워 숨기지 않는 까닭: 발행일이 사라져 다시 보일 때 오늘 날짜가 되고
     * 목록 순서가 틀어집니다. 「한 번도 안 내보냄(초안)」과 「내렸음(숨김)」은 다른 축입니다.
     */
    const vis = p.match(/^\/api\/posts\/([^/]+)\/visibility$/)
    if (req.method === 'POST' && vis) {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const b = await readBody(req)
      const { rows } = await pool.query(
        `update posts set hidden = $2 where slug = $1 returning no, slug, hidden, published_at`,
        [decodeURIComponent(vis[1]), b.hidden === true],
      )
      if (!rows.length) return json(res, 404, { error: '없는 글입니다' })
      let bakeError = null
      try { await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
      return json(res, 200, { post: rows[0], bakeError })
    }

    /**
     * 글 삭제 — 파일을 먼저 옮기고 행을 나중에 지웁니다.
     *
     * 순서가 바뀌면 `on delete cascade` 가 경로를 먼저 날려, 어떤 파일을 지워야 할지 모르는
     * 고아가 남습니다. 옮기기가 실패하면 행이 남으므로 다시 지울 수 있습니다 — 반대는 회복이 없습니다.
     */
    if (req.method === 'DELETE' && one) {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const { rows } = await pool.query(
        `select id, no, row_to_json(posts) as snapshot,
                (select json_agg(a) from post_attachments a where a.post_id = posts.id) as attachments
           from posts where slug = $1`, [decodeURIComponent(one[1])])
      if (!rows.length) return json(res, 404, { error: '없는 글입니다' })
      /* 글 폴더(구운 HTML + 사진 원본)를 통째로 휴지통으로. 사진을 한 번도 안 올린 초안은
         폴더가 없습니다 — 그때는 행 기록(post.json)만 남깁니다. */
      const dst = `${TRASH}/${rows[0].no}-${Date.now()}`
      await mkdir(TRASH, { recursive: true })
      await rename(`${SITE}/${rows[0].no}`, dst).catch(async (e) => {
        if (e.code !== 'ENOENT') throw e
        await mkdir(dst, { recursive: true })
      })
      await writeFile(`${dst}/post.json`,
        JSON.stringify({ post: rows[0].snapshot, attachments: rows[0].attachments }, null, 2))
      await pool.query(`delete from posts where id = $1`, [rows[0].id])
      let bakeError = null
      try { await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
      return json(res, 200, { ok: true, bakeError })
    }

    /**
     * 사이트의 모양 — 틀 · 색·글꼴 · 메인 섹션 순서 · 직접 만든 화면.
     *
     * 저장은 덧붙임입니다(`site_settings` 의 rev 가 하나 늘어납니다). 그래서 되돌리기가
     * 「옛 판을 새 판으로 다시 넣기」 한 번이고, 무엇을 언제 바꿨는지가 표에 남습니다.
     */
    if (p === '/api/settings') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })

      if (req.method === 'GET') {
        const { rows } = await pool.query(
          `select distinct on (key) key, rev, value, created_at, via
             from site_settings order by key, rev desc`)
        /* 굽기와 같은 기본값을 씁니다 — 어휘의 것만 쓰면 아무것도 안 고른 사이트에서
           관리자에는 어휘 기본색이, 진짜 화면에는 레포 색이 나가 둘이 갈립니다 */
        const now = { ...SITE_DEFAULTS }
        const revs = {}
        const updated = {}
        for (const r of rows) {
          if (!KEYS.includes(r.key)) continue
          const { value } = normalize(r.key, r.value, FONT_VALUES)
          if (value) {
            now[r.key] = value; revs[r.key] = r.rev
            /* 마지막 판이 되돌리기면 되돌릴 「반영」이 없습니다 — 짐작에서 뺍니다(N3) */
            if (r.via !== 'undo') updated[r.key] = r.created_at
          }
        }
        /* 되돌릴 자리가 있는지도 같이 줍니다 — 화면이 「되돌리기」를 켤지 말지 압니다.
           `updated` 는 키마다 마지막으로 반영한 시각입니다. 공통 탭은 키 둘을 한 번에 반영하므로,
           화면이 같은 반영에 들어간 키만 골라 되돌리는 데 씁니다 */
        const { rows: hist } = await pool.query(
          `select key, count(*)::int as revs from site_settings group by key`)
        /**
         * 카테고리마다 글이 몇 편인가 — 관리자가 지우기 전에 「N편이 초안이 됩니다」를 말해야 합니다.
         * 발행 글은 발행본(`meta`)의 카테고리를, 초안은 고치던 초안(`coalesce(draft_meta, meta)`)의
         * 카테고리를 셉니다 — 목록 화면이 보는 값과 같아야 숫자가 맞습니다. 빈 키는 「기본」입니다.
         */
        const { rows: cc } = await pool.query(
          `select coalesce(meta->>'category', '') as pid,
                  coalesce(coalesce(draft_meta, meta)->>'category', '') as did,
                  (published_at is not null) as pub
             from posts where kind = 'post'`)
        const categoryCounts = {}
        for (const r of cc) {
          const k = r.pub ? r.pid : r.did
          const at = (categoryCounts[k] ??= { published: 0, drafts: 0 })
          if (r.pub) at.published += 1; else at.drafts += 1
        }
        return json(res, 200, {
          settings: now, revs, updated,
          history: Object.fromEntries(hist.map((h) => [h.key, h.revs])),
          categoryCounts,
          /* 메인 무대의 기본 글자 — 편집기에서 글자를 다 지우면 이것이 보여야 공개면과 같습니다 */
          stageText: stageDefaults(),
          /* 푸터의 상자도 비우면 사이트 값이 나갑니다 — 편집기가 「다 지우면 무엇이 보이나」를 알아야 합니다 */
          footText: footDefaults(),
          /* 주소를 안 넣어도 갈 곳이 있는 아이콘(지금은 GitHub) — 관리자의 「주소 없음」이 거짓이 되지 않게 */
          footIcon: footIconDefaults(),
          /* 「설정」 탭의 귀띔. 사이트 명을 비우면 site.config.mjs 의 값이 나가는데, 관리자가
             그 값을 모르면 빈 칸이 「이름이 없다」로 보입니다. 채워 넣지 않고 placeholder 로만 씁니다 */
          siteText: siteTextDefaults(),
          /* 공개면 주소 — 관리자의 「글 보기」·「작업 보기」가 씁니다. 포트를 바꿔도 서버는 제 주소를
             알고 있습니다(`SITE_ORIGIN`). 브라우저에 굳은 값으로 두면 8080 을 가리켜 404 가 납니다 */
          origin: siteOrigin(),
        })
      }

      if (req.method === 'POST') {
        const b = await readBody(req)
        const key = String(b.key || '')
        if (!KEYS.includes(key)) return json(res, 400, { error: `모르는 설정입니다 (${key.slice(0, 20)})` })

        /* 여기가 엄격한 문입니다. 정규화에서 걸린 것을 고쳐서 넘기지 않고 되돌려 줍니다 —
           조용히 고치면 고른 사람은 제가 고른 대로 저장된 줄 압니다. 굽기는 반대로 관대합니다. */
        const { value, problems } = normalize(key, b.value, FONT_VALUES)
        if (problems.length) return json(res, 400, { error: problems.join(' / '), problems })

        /* 미리보기는 디스크에만 그리므로 막지 않습니다 — 막는 것은 **저장**뿐입니다 */
        if (key === 'blog' && b.preview !== true) {
          const lost = await orphanedByBlog(value)
          if (lost.length) return json(res, 400, { error: orphanError(lost, '이 설정을 넣으면') })
        }

        /* 미리보기는 저장하지 않습니다. 같은 굽기 함수를 다른 폴더로 한 번 더 돌립니다 —
           렌더러를 두 벌 만들면 미리보기와 진짜가 갈라지고, 그 순간 미리보기를 믿을 수 없게 됩니다. */
        if (b.preview === true) {
          /**
           * 고르는 중인 값 전부를 한 번에 받습니다. 키 하나씩 받아 `저장된 값 + 이 키` 로 구우면
           * 안 됩니다 — 미리보기는 사이트 한 벌을 통째로 다시 생성하므로, 키를 차례로 보내면 뒤
           * 요청이 앞 요청을 저장된 값으로 덮어써 마지막 것만 남습니다.
           */
          /* also 가 여섯 키를 다 실어 오면 저장된 값을 읽을 필요가 없습니다. 어차피 전부
             덮어쓰므로 DB 질의 한 번과 정규화 여섯 번이 그대로 버려집니다.
             화면은 항상 전부 보내지만, 덜 보내는 요청도 받아야 하므로 그때만 읽습니다 */
          const alsoKeys = new Set([key, ...Object.keys(b.also || {}).filter((k) => KEYS.includes(k))])
          const conf = KEYS.every((k) => alsoKeys.has(k))
            ? { [key]: value }
            : { ...(await loadConf(pool)), [key]: value }
          for (const [k, v] of Object.entries(b.also || {})) {
            if (!KEYS.includes(k) || k === key) continue
            const r = normalize(k, v, FONT_VALUES)
            if (r.problems.length) return json(res, 400, { error: r.problems.join(' / '), problems: r.problems })
            conf[k] = r.value
          }
          try {
            const r = await bakePreview(pool, conf)
            return json(res, 200, { preview: true, ...r })
          } catch (e) {
            return json(res, 400, { error: String(e.message || e) })
          }
        }

        /**
         * 합쳐서 읽히는지 봅니다. 같이 반영하는 짝(`also`)이 있으면 그 값으로 — 테마를 먼저 저장하는
         * 순간 옛 헤더·옛 푸터와 부딪혀 거절되면 한 번에 반영하는 길이 막힙니다.
         * 헤더와 푸터를 한 블록에서 봅니다: 테마 저장은 둘 다 건드리므로 갈라 두면 설정을 두 번 읽고
         * `also` 병합도 두 벌이 됩니다.
         * `also` 는 요청자의 말이지 저장의 보증이 아닙니다 — 이 검사는 못 읽는 조합이 실수로 나가는
         * 것을 막는 난간이고, 진짜 화면은 저장된 값으로 굽습니다.
         */
        if (key === 'theme' || key === 'header' || key === 'footer') {
          const merged = { ...(await loadConf(pool)), [key]: value }
          for (const k of ['theme', 'header', 'footer']) {
            if (k !== key && b.also && b.also[k] !== undefined) {
              const r = normalize(k, b.also[k], FONT_VALUES)
              if (!r.problems.length) merged[k] = r.value
            }
          }
          if (key !== 'footer') {
            const hc = headerContrast(merged.theme, merged.header || {})
            if (hc < INK_MIN) return json(res, 400, { error: `공통헤더 글자와 배경의 대비가 ${hc.toFixed(1)}:1 입니다 — ${INK_MIN}:1 이상이어야 읽힙니다` })
            const bc = buttonContrast(merged.theme, merged.header || {})
            if (bc < INK_MIN) return json(res, 400, { error: `메뉴버튼 글자와 배경의 대비가 ${bc.toFixed(1)}:1 입니다 — ${INK_MIN}:1 이상이어야 읽힙니다` })
          }
          /* 푸터는 벌마다 따로 재서 어느 푸터가 안 읽히는지 말해 줍니다 */
          if (key !== 'header') {
            for (const kind of ['main', 'pages']) {
              const fc = footerContrast(merged.theme, merged.footer?.[kind])
              if (fc < INK_MIN) {
                const what = kind === 'main' ? '메인 푸터' : '포트폴리오·블로그 푸터'
                return json(res, 400, { error: `${what} 글자와 배경의 대비가 ${fc.toFixed(1)}:1 입니다 — ${INK_MIN}:1 이상이어야 읽힙니다` })
              }
            }
          }
        }
        const { rows } = await appendRev(key, value, auth(req)?.sub || null)
        let baked = null, bakeError = null
        try { baked = await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
        return json(res, 200, { key, rev: rows[0].rev, value, baked, bakeError })
      }
    }

    /** 되돌리기 — 옛 판을 새 판으로 다시 넣습니다. 이력은 지우지 않습니다 */
    if (req.method === 'POST' && p === '/api/settings/undo') {
      if (!auth(req)) return json(res, 401, { error: '로그인이 필요합니다' })
      const b = await readBody(req)
      const key = String(b.key || '')
      if (!KEYS.includes(key)) return json(res, 400, { error: `모르는 설정입니다 (${key.slice(0, 20)})` })
      /**
       * 지금과 다른 마지막 판으로 갑니다. 바로 앞 판만 보면, 같은 값을 두 번 저장한 뒤
       * (「반영됐나?」 싶어 한 번 더 누르는 흔한 조작) 되돌리기가 성공을 보고하면서
       * 아무것도 안 바꿉니다 — 망쳤을 때 돌아갈 길이 그 자리에서 사라집니다.
       */
      const { rows } = await pool.query(
        `select rev, value from site_settings where key = $1 order by rev desc limit 50`, [key])
      if (!rows.length) return json(res, 400, { error: '되돌릴 이전 판이 없습니다' })
      const now = JSON.stringify(rows[0].value)
      /**
       * 앞 판이 없으면 기본값으로 돌아갑니다. 첫 반영을 되돌리는 것은 「반영 전」으로 가는 것이고,
       * 반영 전은 기본값이었습니다.
       * 여기서 400 을 내면 관리자가 그 키를 건너뛰어 일부만 되돌아갑니다 —
       *   테마만 되돌아가고 헤더가 남으면 검은 바탕에 전경색 글자가 공개면에 나갑니다.
       */
      const back = rows.slice(1).find((r) => JSON.stringify(r.value) !== now)
        || (JSON.stringify(SITE_DEFAULTS[key]) !== now ? { value: SITE_DEFAULTS[key] } : null)
      if (!back) return json(res, 400, { error: '되돌릴 이전 판이 없습니다 — 지금까지 판이 전부 같습니다' })
      /* 옛 판도 다시 다듬어서 넣습니다 — 어휘가 바뀐 뒤라면 그때 값이 지금은 이상할 수 있습니다 */
      const { value: backValue, problems: backProblems } = normalize(key, back.value, FONT_VALUES)
      if (backProblems.length) return json(res, 400, { error: `이전 판을 쓸 수 없습니다: ${backProblems.join(' / ')}` })
      /* 카테고리가 생기기 전 판으로 가면 거기 있던 글이 전부 주인을 잃습니다 — 저장 문과 같은 난간 */
      if (key === 'blog') {
        const lost = await orphanedByBlog(backValue)
        if (lost.length) return json(res, 400, { error: orphanError(lost, '이전 판으로 가면') })
      }
      /* 되돌리기도 합쳐서 봅니다 — 테마만 옛 판으로 가면 지금 헤더·푸터와 부딪힐 수 있습니다.
         설정은 한 번만 읽습니다(저장 쪽과 같은 이유) */
      if (key === 'theme' || key === 'header' || key === 'footer') {
        const merged = { ...(await loadConf(pool)), [key]: backValue }
        if (key !== 'footer') {
          const hc = headerContrast(merged.theme, merged.header || {})
          if (hc < INK_MIN) {
            return json(res, 400, { error: `되돌리면 공통헤더 글자가 읽히지 않습니다(${hc.toFixed(1)}:1) — 공통헤더 색을 먼저 되돌리세요` })
          }
          const bc = buttonContrast(merged.theme, merged.header || {})
          if (bc < INK_MIN) {
            return json(res, 400, { error: `되돌리면 메뉴버튼 글자가 읽히지 않습니다(${bc.toFixed(1)}:1) — 공통헤더 색을 먼저 되돌리세요` })
          }
        }
        if (key !== 'header') {
          for (const kind of ['main', 'pages']) {
            const fc = footerContrast(merged.theme, merged.footer?.[kind])
            if (fc < INK_MIN) {
              const what = kind === 'main' ? '메인 푸터' : '포트폴리오·블로그 푸터'
              return json(res, 400, { error: `되돌리면 ${what} 글자가 읽히지 않습니다(${fc.toFixed(1)}:1) — 푸터 색을 먼저 되돌리세요` })
            }
          }
        }
      }
      const { rows: ins } = await appendRev(key, backValue, auth(req)?.sub || null, 'undo')
      let bakeError = null
      try { await bake(pool) } catch (e) { bakeError = String(e.message || e); console.error(e) }
      return json(res, 200, { key, rev: ins[0].rev, value: backValue, bakeError })
    }

    if (req.method === 'GET' && p === '/api/health') {
      const { rows } = await pool.query('select count(*)::int n from posts')
      return json(res, 200, { ok: true, posts: rows[0].n })
    }

    json(res, 404, { error: '없는 경로입니다' })
  } catch (e) {
    if (e.status) return json(res, e.status, { error: e.message })
    console.error(e)
    json(res, 500, { error: String(e.message || e) })
  }
}).listen(PORT, HOST, () => console.log(`admin-api http://${HOST}:${PORT}`))
