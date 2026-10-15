/**
 * 댓글 · 좋아요 — 방문자가 쓰는 유일한 길.
 *
 * 공개면은 원래 읽기 전용 정적 HTML 뿐이었습니다. 여기만 예외로 방문자의 쓰기를 받습니다.
 * 그래서 이 파일은 관리자 API 와 같은 프로세스에 살되 **입구가 따로**입니다:
 *
 *   공개 nginx  →  /api/public/…  만 프록시하고 `X-Public: 1` 을 붙입니다
 *   이 프로세스 →  `X-Public` 이 붙은 요청이 /api/public/ 밖으로 가면 404 (admin-api.mjs)
 *
 * 한쪽 설정이 틀려도 관리자 경로가 공개면에 서지 않게 두 겹입니다.
 *
 * 가입이 없어서 사람을 가르는 것은 IP 뿐입니다. 원래 IP 는 저장하지 않습니다 — 화면용 앞 두 자리와
 * HMAC 해시만 둡니다(sql/schema.sql 의 댓글 절). 진짜 IP 는 공개 nginx 가 `X-Client-IP` 로 넘깁니다
 * (realip 를 거친 `$remote_addr` — Cloudflare 의 CF-Connecting-IP). 그 헤더는 nginx 가 덮어쓰므로
 * 방문자가 지어 보낸 값이 들어오지 않습니다.
 *
 * 속도 제한은 메모리입니다 — 배포하면 풀립니다. 하루 상한만 DB 로 셉니다(재시작으로 안 풀리게).
 * nginx 에도 한 겹 더 있습니다(공개 `/api/public/` 의 limit_req).
 */
import { createHmac } from 'node:crypto'

/** 닉네임을 비우면 화면에 서는 이름. DB 에는 null 로 두어 문구를 바꿔도 지난 댓글이 따라옵니다 */
export const ANON = '익명의 누군가'

const LIMITS = {
  body: 1000,            // 글자(코드포인트) 수
  nick: 20,
  pwMin: 4, pwMax: 32,
  links: 2,
  list: 200,             // 한 글에 보여 줄 댓글 수
  bodyBytes: 8 * 1024,   // 요청 본문 상한 — 관리자 쪽 2MB 와 따로
}

/** 「같은 사람이 너무 자주」를 세는 창. 키마다 최근 시각 목록을 들고, 창 밖은 버립니다 */
class Window {
  constructor(ms, max) { this.ms = ms; this.max = max; this.m = new Map() }
  /** 이번 한 번을 받아도 되면 기록하고 true */
  take(key, now = Date.now()) {
    const xs = (this.m.get(key) || []).filter((t) => now - t < this.ms)
    if (xs.length >= this.max) { this.m.set(key, xs); return false }
    xs.push(now); this.m.set(key, xs); return true
  }
  /** 이미 다 찼는가 — 기록하지 않고 보기만 */
  full(key, now = Date.now()) { return (this.m.get(key) || []).filter((t) => now - t < this.ms).length >= this.max }
  prune(now = Date.now()) {
    for (const [k, xs] of this.m) { const keep = xs.filter((t) => now - t < this.ms); keep.length ? this.m.set(k, keep) : this.m.delete(k) }
  }
}

/** `2001:db8::1` → 여덟 묶음. 못 풀면 null */
const expand6 = (ip) => {
  const [l, r = null, extra] = ip.split('::')
  if (extra !== undefined) return null
  const L = l ? l.split(':') : [], R = r ? r.split(':') : []
  const fill = r === null ? 0 : 8 - L.length - R.length
  if (fill < 0) return null
  const g = [...L, ...Array(fill).fill('0'), ...R]
  return g.length === 8 && g.every((x) => /^[0-9a-f]{1,4}$/.test(x)) ? g.map((x) => x.replace(/^0+(?=.)/, '')) : null
}

/**
 * IPv4 앞 두 자리 / IPv6 앞 두 묶음. `::ffff:1.2.3.4` 는 v4 로 봅니다.
 * `key` 는 「같은 사람」을 가르는 값입니다 — IPv4 는 주소 그대로, **IPv6 는 앞 네 묶음(/64)**.
 * 집 하나·기기 하나가 /64 를 통째로 받아 임시 주소를 계속 바꾸므로, 한 주소(/128)로 세면
 * 속도 제한이 없는 것과 같고 좋아요가 겹치고 제 댓글을 못 지웁니다.
 */
export const ipParts = (raw) => {
  let ip = String(raw || '').trim().toLowerCase()
  const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (m) ip = m[1]
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const [a, b] = ip.split('.')
    return { key: ip, prefix: `${a}.${b}`, shown: `${a}.${b}.***.***` }
  }
  const g = ip.includes(':') ? expand6(ip.replace(/%.*$/, '')) : null
  if (g) {
    const prefix = `${g[0]}:${g[1]}`
    return { key: `${g.slice(0, 4).join(':')}::/64`, prefix, shown: `${prefix}:****:****` }
  }
  return { key: ip || 'unknown', prefix: '?', shown: '?.***.***' }
}

const shownOf = (prefix) => (prefix.includes(':') ? `${prefix}:****:****` : `${prefix}.***.***`)

/** 제어 문자를 걷습니다(줄바꿈은 본문에서만 남김). 화면은 textContent 로 그리지만 저장도 깨끗하게 */
const clean = (s, keepNewline) => String(s ?? '')
  .replace(keepNewline ? /[\u0000-\u0009\u000b-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g
                       : /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
  .replace(/\r\n?/g, '\n')
const len = (s) => [...s].length

export const makeTalk = ({ pool, secret, isOn, catHidden }) => {
  /* 해시 열쇠는 토큰 비밀에서 갈라 씁니다 — 같은 값을 두 용도로 그대로 쓰지 않습니다.
     토큰 비밀을 갈면 해시도 바뀌어 「같은 사람」 판별이 처음부터 다시 시작됩니다(좋아요가 다시 눌림). */
  const key = createHmac('sha256', secret).update('talk/ip-hash/v1').digest()
  const hashIp = (ip) => createHmac('sha256', key).update(ip).digest('base64url')

  const writeMin = new Window(60_000, 3)          // 댓글: 1분 3개
  const likeMin = new Window(60_000, 20)          // 좋아요: 1분 20번
  const likeGap = new Window(3_000, 1)            // 같은 글 좋아요 상태 바꾸기: 3초에 한 번
  const delFail = new Map()                       // `${id}:${hash}` → { n, at } 틀린 비밀번호
  const delFailIp = new Window(10 * 60_000, 30)   // 한 사람이 여러 댓글을 두드리는 것까지
  const DEL_LOCK_N = 5, DEL_LOCK_MS = 10 * 60_000
  setInterval(() => {
    const now = Date.now()
    for (const w of [writeMin, likeMin, likeGap, delFailIp]) w.prune(now)
    for (const [k, v] of delFail) if (now - v.at > DEL_LOCK_MS) delFail.delete(k)
  }, 5 * 60_000).unref()

  const send = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  const no = (res, code, error) => send(res, code, { error })

  /** 작은 본문만 받습니다. 넘치면 413, JSON 이 아니면 400 */
  const readSmall = (req) => new Promise((resolve, reject) => {
    const chunks = []; let size = 0, over = false
    req.on('data', (c) => {
      if (over) return
      size += c.length
      if (size > LIMITS.bodyBytes) { over = true; chunks.length = 0; reject(Object.assign(new Error('본문이 너무 큽니다'), { status: 413 })); return }
      chunks.push(c)
    })
    req.on('end', () => {
      if (over) return
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0
        resolve(v)
      } catch { reject(Object.assign(new Error('본문이 JSON 이 아닙니다'), { status: 400 })) }
    })
    req.on('error', reject)
  })

  /**
   * 다른 사이트가 보낸 쓰기는 받지 않습니다(CSRF). 남의 페이지에 숨긴 `fetch(…, {mode:'no-cors'})` 나
   * `enctype=text/plain` 폼은 사전 요청 없이 그 방문자의 IP 로 들어와, IP 마다 거는 제한을 전부 비켜 갑니다.
   *   ① 본문은 `application/json` 만 — 이 형식은 다른 출처에서 보내려면 사전 요청이 필요합니다
   *   ② `Sec-Fetch-Site` 가 있으면 same-origin 만, `Origin` 이 있으면 호스트가 같아야 합니다
   * 우리 talk.js 는 같은 출처에서 JSON 으로 보내므로 셋을 다 지납니다.
   */
  const sameSite = (req) => {
    if (!/^application\/json(\s*;|$)/i.test(String(req.headers['content-type'] || ''))) return false
    const site = req.headers['sec-fetch-site']
    if (site && site !== 'same-origin') return false
    const origin = req.headers.origin
    if (origin) {
      try { if (new URL(origin).hostname !== String(req.headers.host || '').replace(/:\d+$/, '')) return false }
      catch { return false }
    }
    return true
  }
  /** 비밀번호 — bcrypt 는 72바이트 뒤를 버리고 NUL 에서 끊습니다. 둘 다 미리 거릅니다 */
  const pwBad = (pw) => len(pw) < LIMITS.pwMin || len(pw) > LIMITS.pwMax || Buffer.byteLength(pw) > 72 || pw.includes('\0')

  /** 댓글을 받을 수 있는 글인가 — 발행됐고, 내리지 않았고, 비공개 카테고리가 아닌 글만 */
  const openPost = async (n) => {
    if (!/^\d{1,12}$/.test(n)) return null
    const { rows } = await pool.query(
      `select id, meta->>'category' as cat from posts
        where no = $1 and kind = 'post' and published_at is not null and not hidden`, [n])
    if (!rows.length) return null
    if (rows[0].cat && await catHidden(rows[0].cat)) return null
    return rows[0].id
  }

  const who = (req) => {
    /* `X-Client-IP` 는 공개 nginx 가 덮어써 보낸 것일 때만 믿습니다(그때는 `X-Public` 이 같이 옵니다).
       관리자 쪽 nginx 는 이 헤더를 덮어쓰지 않아서, 거기로 온 값은 보낸 사람이 지어낼 수 있습니다 */
    const viaPublic = req.headers['x-public'] === '1'
    const parts = ipParts((viaPublic && req.headers['x-client-ip']) || req.socket.remoteAddress)
    return { ...parts, hash: hashIp(parts.key) }
  }

  const listOf = async (postId, me) => {
    const [{ rows: cs }, { rows: lk }] = await Promise.all([
      pool.query(
        `select id, nickname, body, ip_prefix, created_at, ip_hash = $3 as mine from comments
          where post_id = $1 and deleted_at is null order by created_at limit $2`, [postId, LIMITS.list, me]),
      pool.query(
        `select count(*)::int as n, coalesce(bool_or(ip_hash = $2), false) as mine
           from post_likes where post_id = $1`, [postId, me]),
    ])
    return {
      /* `mine` — 지금 보는 사람이 쓴 댓글인가(같은 IP). 삭제 단추는 이것만 섭니다. 해시는 내보내지 않습니다 */
      comments: cs.map((c) => ({ id: c.id, nickname: c.nickname, body: c.body, ip: shownOf(c.ip_prefix), at: c.created_at, mine: c.mine })),
      likes: lk[0].n,
      liked: lk[0].mine,
    }
  }

  /**
   * 공개 경로. 처리했으면 true. 오류 문구는 사람에게 보일 한 줄만 — 관리자 쪽처럼 내부 메시지를
   * 내보내지 않습니다(방문자에게 스키마·쿼리를 보여 줄 까닭이 없습니다).
   */
  const handlePublic = async (req, res, p) => {
    try {
      if (!(await isOn())) return no(res, 404, '댓글이 꺼져 있습니다')
      if (req.method === 'POST' && !sameSite(req)) return no(res, 403, '이 사이트에서만 쓸 수 있습니다')

      let m = p.match(/^\/api\/public\/posts\/([^/]+)\/talk$/)
      if (m && req.method === 'GET') {
        const postId = await openPost(m[1])
        if (!postId) return no(res, 404, '없는 글입니다')
        return send(res, 200, await listOf(postId, who(req).hash))
      }

      m = p.match(/^\/api\/public\/posts\/([^/]+)\/comments$/)
      if (m && req.method === 'POST') {
        const b = await readSmall(req)
        const me = who(req)
        /* 숨은 칸 — 사람은 못 보고 봇은 채웁니다. 성공한 척 돌려보내 다시 시도하지 않게 합니다 */
        if (String(b.website ?? '').trim()) return send(res, 201, { ok: true })
        const body = clean(b.body, true).trim()
        const nick = clean(b.nickname, false).trim()
        const pw = String(b.password ?? '')
        if (!body) return no(res, 400, '내용을 적어 주세요')
        if (len(body) > LIMITS.body) return no(res, 400, `내용은 ${LIMITS.body}자까지입니다`)
        if (len(nick) > LIMITS.nick) return no(res, 400, `닉네임은 ${LIMITS.nick}자까지입니다`)
        if (pwBad(pw)) return no(res, 400, `비밀번호는 ${LIMITS.pwMin}~${LIMITS.pwMax}자입니다`)
        if ((body.match(/https?:\/\/|www\./gi) || []).length > LIMITS.links) return no(res, 400, `링크는 ${LIMITS.links}개까지입니다`)
        const postId = await openPost(m[1])
        if (!postId) return no(res, 404, '없는 글입니다')
        if (!writeMin.take(me.hash)) return no(res, 429, '조금 뒤에 다시 써 주세요')
        const { rows: day } = await pool.query(
          `select count(*)::int as n from comments where ip_hash = $1 and created_at > now() - interval '1 day'`, [me.hash])
        if (day[0].n >= 30) return no(res, 429, '오늘은 더 쓸 수 없습니다')
        await pool.query(
          `insert into comments (post_id, nickname, body, password_hash, ip_prefix, ip_hash)
           values ($1, $2, $3, crypt($4, gen_salt('bf', 10)), $5, $6)`,
          [postId, nick || null, body, pw, me.prefix, me.hash])
        return send(res, 201, await listOf(postId, me.hash))
      }

      m = p.match(/^\/api\/public\/comments\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/delete$/)
      if (m && req.method === 'POST') {
        const b = await readSmall(req)
        const me = who(req)
        const k = `${m[1]}:${me.hash}`
        const f = delFail.get(k)
        if (f && f.n >= DEL_LOCK_N && Date.now() - f.at < DEL_LOCK_MS) return no(res, 429, '비밀번호를 여러 번 틀렸습니다. 10분 뒤에 다시 해 주세요')
        /* 한 사람이 댓글을 바꿔 가며 두드리는 것 — 대조하기 **전에** 막습니다(대조는 bcrypt 라 비쌉니다) */
        if (delFailIp.full(me.hash)) return no(res, 429, '잠시 뒤에 다시 해 주세요')
        const pw = String(b.password ?? '')
        if (pwBad(pw)) return no(res, 403, '비밀번호가 맞지 않습니다')
        /* 쓴 곳(같은 IP)에서만 지웁니다 — 화면은 남의 댓글에 삭제 단추를 안 세우지만, 단추를 숨기는 것만으로는
           요청을 직접 보내는 사람을 못 막습니다. IP 가 같고 비밀번호도 맞아야 지워집니다 */
        const { rows: own } = await pool.query(`select ip_hash = $2 as mine from comments where id = $1 and deleted_at is null`, [m[1], me.hash])
        if (!own.length) return no(res, 404, '이미 지워졌거나 없는 댓글입니다')
        if (!own[0].mine) return no(res, 403, '댓글을 쓴 곳에서만 지울 수 있습니다')
        const { rows } = await pool.query(
          `update comments set deleted_at = now(), deleted_by = 'author'
            where id = $1 and deleted_at is null and ip_hash = $3 and password_hash = crypt($2, password_hash)
            returning post_id`, [m[1], pw, me.hash])
        if (rows.length) {
          delFail.delete(k)
          return send(res, 200, await listOf(rows[0].post_id, me.hash))
        }
        const { rows: ex } = await pool.query(`select 1 from comments where id = $1 and deleted_at is null`, [m[1]])
        if (!ex.length) return no(res, 404, '이미 지워졌거나 없는 댓글입니다')
        delFail.set(k, { n: (f && Date.now() - f.at < DEL_LOCK_MS ? f.n : 0) + 1, at: Date.now() })
        delFailIp.take(me.hash)
        return no(res, 403, '비밀번호가 맞지 않습니다')
      }

      m = p.match(/^\/api\/public\/posts\/([^/]+)\/like$/)
      if (m && req.method === 'POST') {
        const b = await readSmall(req)
        if (typeof b.want !== 'boolean') return no(res, 400, 'want 는 참·거짓입니다')
        const me = who(req)
        const postId = await openPost(m[1])
        if (!postId) return no(res, 404, '없는 글입니다')
        /* 토글이 아니라 「원하는 상태」를 받습니다 — 같은 요청이 겹쳐 와도 결과가 하나입니다.
           CTE 안의 쓰기는 같은 문장의 읽기에 안 보이므로 개수는 바뀐 행 수를 더하고 뺍니다 */
        if (!likeGap.take(`${postId}:${me.hash}`) || !likeMin.take(me.hash)) return no(res, 429, '조금 천천히 눌러 주세요')
        const sql = b.want
          ? `with w as (insert into post_likes (post_id, ip_hash) values ($1, $2) on conflict do nothing returning 1)
             select (select count(*) from post_likes where post_id = $1)::int + (select count(*) from w)::int as n`
          : `with w as (delete from post_likes where post_id = $1 and ip_hash = $2 returning 1)
             select (select count(*) from post_likes where post_id = $1)::int - (select count(*) from w)::int as n`
        const { rows } = await pool.query(sql, [postId, me.hash])
        return send(res, 200, { likes: rows[0].n, liked: b.want })
      }

      return no(res, 404, '없는 경로입니다')
    } catch (e) {
      if (e.status) return no(res, e.status, e.message)
      console.error('talk:', e)
      return no(res, 500, '잠시 뒤에 다시 시도해 주세요')
    }
  }

  /** 관리자 경로(인증은 부르는 쪽이). 처리했으면 true */
  const handleAdmin = async (req, res, p, url) => {
    if (req.method === 'GET' && p === '/api/comments') {
      const show = url.searchParams.get('deleted')           // 'only' | 'all' | 그 밖 = 살아 있는 것만
      const where = show === 'only' ? 'c.deleted_at is not null' : show === 'all' ? 'true' : 'c.deleted_at is null'
      const { rows } = await pool.query(
        `select c.id, c.nickname, c.body, c.ip_prefix, c.created_at, c.deleted_at, c.deleted_by,
                p.no, p.title, p.slug
           from comments c join posts p on p.id = c.post_id
          where ${where} order by c.created_at desc limit 500`)
      send(res, 200, { comments: rows.map((r) => ({ ...r, ip: shownOf(r.ip_prefix), ip_prefix: undefined })), anon: ANON })
      return true
    }
    const m = p.match(/^\/api\/comments\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(delete|restore)$/)
    if (m && req.method === 'POST') {
      const { rowCount } = m[2] === 'delete'
        ? await pool.query(`update comments set deleted_at = now(), deleted_by = 'admin' where id = $1 and deleted_at is null`, [m[1]])
        : await pool.query(`update comments set deleted_at = null, deleted_by = null where id = $1 and deleted_at is not null`, [m[1]])
      send(res, rowCount ? 200 : 404, rowCount ? { ok: true } : { error: '바꿀 댓글이 없습니다' })
      return true
    }
    return false
  }

  return { handlePublic, handleAdmin }
}
