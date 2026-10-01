/**
 * 관리자 API 창구. 브라우저는 Postgres 5432 에 못 붙습니다 — 홈서버의 작은 서비스가 대신 붙습니다.
 *
 * 토큰이 둘입니다 (RTR):
 *
 *   액세스   30분. 이 모듈 변수에만 있습니다. 저장소에 안 넣으므로 새로고침하면 사라지고,
 *            XSS 가 `localStorage` 를 뒤져도 거기엔 아무것도 없습니다.
 *   리프레시 7일. httpOnly 쿠키라 자바스크립트가 아예 못 읽습니다. 브라우저가 알아서
 *            `/api/auth/*` 에만 붙여 보냅니다.
 *
 * 그래서 새로고침하면 액세스가 없고, 첫 일로 `/api/auth/refresh` 를 부릅니다. 쿠키는
 * 탭이 아니라 오리진에 붙으므로 새 탭에서도, 배포 뒤에도 로그인이 살아 있습니다.
 */
let access = ''
export const getToken = () => access
export const setToken = (t) => { access = t || '' }

/** 세션이 끝났을 때 화면이 할 일 — `App` 이 꽂습니다(그 자리에 로그인을 덮어 띄웁니다) */
let onExpired = () => {}
export const setOnExpired = (fn) => { onExpired = fn }
/** 세션이 끝났다고 화면에 알립니다 — `api()` 를 안 지나는 길(사진 업로드)이 씁니다 */
export const signalExpired = () => onExpired()

/** 액세스 토큰에 적힌 아이디 — 보여 주기용입니다. 믿는 건 서버뿐 */
export function tokenInfo(t = access) {
  try {
    const b = t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const { sub, exp } = JSON.parse(atob(b + '='.repeat((4 - (b.length % 4)) % 4)))
    return { id: String(sub || ''), exp: Number(exp) || 0 }
  } catch { return { id: '', exp: 0 } }
}

/**
 * 20초. 끊는 장치가 없으면 응답이 안 오는 요청 하나가 화면을 영원히 잠급니다.
 * 서버가 잠들거나 망이 끊기면 실제로 그렇습니다.
 */
const TIMEOUT = 20_000

async function raw(path, opts = {}) {
  const ac = new AbortController()
  const bell = setTimeout(() => ac.abort(), TIMEOUT)
  try {
    return await fetch('/api' + path, {
      ...opts,
      signal: ac.signal,
      headers: {
        'content-type': 'application/json',
        ...(access ? { authorization: 'Bearer ' + access } : {}),
        ...(opts.headers || {}),
      },
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('서버가 응답하지 않습니다 (20초)')
    throw new Error('서버에 닿지 못했습니다')
  } finally { clearTimeout(bell) }
}

/**
 * 갱신 — 한 번에 하나만.
 *
 * 만료된 순간에 요청 셋이 동시에 401 을 받으면 셋 다 갱신하려 듭니다. 그러면 서버가
 * 회전한 토큰을 다른 둘이 다시 들이밀게 되고, 그건 탈취 감지에 걸려 세션이 통째로 죽습니다.
 * 도는 약속이 있으면 거기에 붙습니다.
 */
let inFlight = null
export function refresh() {
  if (!inFlight) {
    inFlight = (async () => {
      const r = await raw('/auth/refresh', { method: 'POST' })
      /**
       * 「로그인이 아니다」와 「서버가 지금 못 합니다」를 가릅니다.
       *
       * 401 만 로그인이 끝난 것입니다. 배포 중에는 nginx 가 살아 있고 그 뒤의 API 만
       * 잠깐 내려가므로 브라우저는 502 라는 멀쩡한 응답을 받습니다 — `fetch` 는 안 던지고
       * `r.ok` 만 false 다. 이걸 「끝났습니다」로 읽으면 쿠키와 세션 행이 그대로인데도
       * 로그인 화면이 뜹니다. 「배포할 때마다 로그인이 풀립니다」의 정체가 이 한 줄이었습니다.
       */
      if (r.status === 401) { access = ''; return false }
      if (!r.ok) throw new Error(`서버가 지금 응답하지 못합니다 (${r.status})`)
      const d = await r.json().catch(() => ({}))
      access = d.token || ''
      return !!access
    })().finally(() => { inFlight = null })
  }
  return inFlight
}

/**
 * 로그아웃. 실패를 삼키지 않습니다 — 서버에 못 닿으면 쿠키와 `sessions` 행은 그대로라,
 * 새로고침하면 다시 로그인된 상태가 됩니다. 「서버에서도 끊깁니다」가 거짓이 되는 경우입니다.
 * 부른 쪽이 알 수 있게 참/거짓을 돌려줍니다.
 */
export async function logout() {
  access = ''
  try {
    const r = await raw('/auth/logout', { method: 'POST' })
    return r.ok
  } catch { return false }
}

export async function api(path, opts = {}) {
  let r = await raw(path, opts)
  /**
   * 401 이면 한 번만 갱신하고 다시 칩니다. 갱신도 실패하면 진짜로 끝난 것입니다.
   *
   * `/auth/*` 는 제외 — 그쪽의 401 은 갱신 실패 그 자체입니다.
   * `/login` 도 제외 — 비밀번호가 틀린 것이지 세션이 끝난 게 아닙니다. 안 빼면
   * 「아이디 또는 비밀번호가 맞지 않습니다」가 「로그인이 만료되었습니다」로 덮이고,
   * 쿠키가 살아 있으면 틀린 비밀번호 한 번이 회전 한 번을 태웁니다.
   */
  if (r.status === 401 && path !== '/login' && !path.startsWith('/auth/')) {
    if (await refresh()) r = await raw(path, opts)
    else { onExpired(); throw new Error('로그인이 만료되었습니다') }
  }
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && path !== '/login') { onExpired(); throw new Error('로그인이 만료되었습니다') }
  if (!r.ok) throw new Error(d.error || `오류 ${r.status}`)
  return d
}
