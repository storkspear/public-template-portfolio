/**
 * 「지금 로컬인가」를 한 곳에서 정합니다.
 *
 * DB 호스트로 가르지 않습니다. 「DB 가 어디 있느냐」는 「이 사이트가 인터넷에
 * 서 있는가」와 다른 질문입니다 — 도커에서는 DB 호스트가 `db` 라, 로컬인데도 운영으로
 * 판정해 부팅이 막힙니다.
 *
 * 기준은 `site.config.mjs` 의 `origin` 입니다. 배포하는 사람은 어차피 그 값을
 * 제 도메인으로 바꿉니다 — 바꾸는 순간 검사가 켜집니다. 따로 기억할 스위치가 없습니다.
 *
 * 이 파일을 `start.mjs` 와 `admin-api.mjs` 가 같이 읽습니다. 규칙이 둘이면 언젠가 갈립니다.
 */
import site from '../site.config.mjs'

export const ORIGIN = String(site?.origin ?? '')

/** localhost·127.0.0.1·[::1] 이면 로컬. 포트는 있어도 되고 없어도 됩니다 */
export const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?\/?$/i.test(ORIGIN)

/**
 * 예시 파일이 주는 값들. 이 목록에 있으면 인터넷에 못 나갑니다.
 * 새 자리표시자를 `.env.example` 에 넣을 때는 여기에도 넣어야 합니다.
 */
export const WEAK = new Set([
  'admin', 'password', '1234', '12345678', 'changeme',
  'local-dev-only-do-not-use-in-production-0123456789',
])

/**
 * 「켭니다」로 읽을 값만 켜기로 봅니다.
 *
 * `!process.env.X` 로 보면 `ALLOW_WEAK_ADMIN=0` 이 가드를 끕니다 — 빈 문자열이
 * 아닌 모든 값이 참이기 때문입니다. 「끄지 않겠습니다」는 뜻으로 0 을 적은 사람이 정반대를 얻습니다.
 */
const on = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase())

/** 로컬이 아니고 빠져나갈 문도 안 열었다면 약한 값을 거부해야 합니다 */
export const mustBeStrong = () => !LOCAL && !on(process.env.ALLOW_WEAK_ADMIN)

/**
 * DB 에 TLS 를 걸 것인가.
 *
 * 파일마다 따로 판단하지 않습니다. 흩어 두면 한 곳만 고쳐져 갈립니다 —
 * 컨테이너 Postgres 는 TLS 가 없어서, 한 자리라도 TLS 를 걸면
 * `The server does not support SSL connections` 로 그 경로만 500 이 납니다.
 *
 * 기준은 둘입니다.
 *   · `PGSSL=on|off` 를 주면 그 말을 따릅니다 (관리형 DB 마다 사정이 달라 도망갈 문이 필요합니다)
 *   · 안 주면 `LOCAL`(=site.config.mjs 의 origin 이 localhost)로 가릅니다
 *
 * `rejectUnauthorized: false` 인 이유: 관리형 Postgres 는 사설 CA 를 쓰는 곳이 많습니다.
 * 검증을 켜려면 `PGSSLROOTCERT` 를 받아 여기에 `ca` 로 넘기는 판을 따로 만들어야 합니다.
 */
export function pgSsl() {
  const v = String(process.env.PGSSL ?? '').toLowerCase()
  if (v === 'off' || v === 'false' || v === '0') return false
  if (v === 'on' || v === 'true' || v === '1') return { rejectUnauthorized: false }
  /**
   * compose 가 띄우는 `postgres:17` 은 TLS 가 없습니다. 주소만 보고 켜면 도메인을 붙이는
   * 순간 첫 쿼리가 `The server does not support SSL connections` 로 죽습니다 —
   * 같은 compose 로 배포한다는 이 레포의 전제가 거기서 깨집니다.
   * 같은 망 안의 컨테이너끼리라 TLS 로 얻을 것도 없습니다.
   */
  if (process.env.PGHOST === 'db' || process.env.PGHOST === 'localhost') return false
  return LOCAL ? false : { rejectUnauthorized: false }
}
