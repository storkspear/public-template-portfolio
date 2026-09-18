/**
 * 사진을 어디에 둘지 — **소비자가 정한다.**
 *
 * 라이브러리는 저장소를 안 들고 있고(`attachments.ts`), 꽂지 않으면 넣는 순간 던진다.
 * 규약은 이렇다:
 *
 *   쓰는 동안   브라우저 안에만 둔다. `local:n` 이라는 임시 id 와 blob: 주소.
 *               타이핑하다 사진 하나 넣었다고 서버에 파일이 쌓이지 않는다.
 *   저장할 때   flushUploads() 가 남은 blob 을 `uploads/{글번호}/` 로 올리고 진짜 id 로 바꾼다.
 *
 * 초안 저장에서도 올린다 — blob: 주소는 새로고침하면 죽어서, 안 올리고 저장하면
 * 초안을 다시 열었을 때 사진만 조용히 사라진다.
 *
 * **id 에는 폴더를 안 넣는다.** 라이브러리가 첨부 id 를 `/^[\w.:-]{1,200}$/` 로 검사해
 * 슬래시를 안 받고, 무엇보다 경로를 id 에 박으면 저장소를 옮기는 날 지난 글을 전부 고쳐야 한다.
 * `id → 경로` 는 DB 의 `post_attachments` 가 들고, 화면은 그걸 받아 이 표에 담는다.
 */
import { configureAttachments } from '@storkspear/post-editor-core'
import { api, getToken, refresh, signalExpired } from './api.js'

const LOCAL = 'local:'
/** localId → { blob, url } — 아직 안 올린 것 */
const pending = new Map()
/** localId → 올리고 받은 진짜 id. 두 번 저장해도 다시 올리지 않는다 */
const uploaded = new Map()
/** 진짜 id → 주소. 업로드 응답과 글을 다시 열 때 서버가 준 것으로 채운다 */
const paths = new Map()
let seq = 0

/** 지금 편집 중인 글의 번호. 새 글이면 첫 업로드 직전에 서버에서 받아 온다 */
let postNo = null
export const setPostNo = (no) => { postNo = no ? String(no) : null }
export const getPostNo = () => postNo

/** 글을 다시 열 때 — 서버가 준 `id → 경로` 를 담는다. 없으면 사진이 빈칸이 된다 */
export function seedAttachments(rows) {
  for (const r of rows || []) paths.set(r.attachment_id, r.file_path)
}

configureAttachments({
  upload: async (blob) => {
    const id = LOCAL + ++seq
    pending.set(id, { blob, url: URL.createObjectURL(blob) })
    return { id }
  },
  /* 아직 안 올린 것은 blob:, 올라간 것·다시 연 글은 서버가 알려 준 경로 */
  resolve: (id) => (id.startsWith(LOCAL) ? pending.get(id)?.url ?? null : paths.get(id) ?? null),
})

const isLocal = (v) => typeof v === 'string' && v.startsWith('attachment://' + LOCAL)
const idOf = (v) => v.slice('attachment://'.length)

/** 문서를 훑어 아직 안 올린 id 를 모은다 */
function collectLocal(node, out = new Set()) {
  if (!node || typeof node !== 'object') return out
  if (isLocal(node.attrs?.src)) out.add(idOf(node.attrs.src))
  node.content?.forEach((c) => collectLocal(c, out))
  return out
}

/** 값을 바꾼 **새 문서**를 만든다 — 편집기가 들고 있는 것은 건드리지 않는다 */
function swap(node, map) {
  if (!node || typeof node !== 'object') return node
  const next = { ...node }
  const src = node.attrs?.src
  if (isLocal(src) && map.has(idOf(src))) {
    next.attrs = { ...node.attrs, src: 'attachment://' + map.get(idOf(src)) }
  }
  if (node.content) next.content = node.content.map((c) => swap(c, map))
  return next
}

/** 새 글이면 번호를 먼저 받아 둔다 — 시퀀스라 저장 전에 뽑을 수 있다 */
async function ensureNo() {
  if (postNo) return postNo
  const d = await api('/posts/reserve', { method: 'POST' })
  postNo = String(d.no)
  return postNo
}

/**
 * 사진 한 장. **여기는 `api()` 를 안 지난다** — JSON 이 아니라 날바이트를 보내야 해서다.
 * 그래서 401 재시도도 손으로 한 번 한다(액세스가 30분이라 긴 저장 중에 만료될 수 있다).
 */
async function put(blob) {
  const no = await ensureNo()
  const send = () => fetch('/api/media', {
    method: 'POST',
    headers: { 'content-type': blob.type, 'x-post-no': no, authorization: 'Bearer ' + getToken() },
    body: blob,
  })
  let r = await send()
  if (r.status === 401 && await refresh()) r = await send()
  const d = await r.json().catch(() => ({}))
  /* 재시도까지 401 이면 세션이 진짜 끝난 것이다. 여기서 알리지 않으면
     「사진 업로드 실패 (401)」만 뜨고 다시 로그인할 길이 화면에 안 나온다. */
  if (r.status === 401) { signalExpired(); throw new Error('로그인이 만료되었습니다') }
  if (!r.ok) throw new Error(d.error || `사진 업로드 실패 (${r.status})`)
  paths.set(d.id, d.path)
  return d.id
}

/**
 * 저장 직전에 부른다. 남은 blob 을 올리고, **저장할 사본**의 id 를 진짜 것으로 바꿔 돌려준다.
 *
 * 편집기가 들고 있는 문서는 일부러 그대로 둔다 — 바꾼 문서를 `value` 로 되먹이면
 * 문서가 통째로 다시 깔려 커서가 맨 앞으로 튄다. 화면은 blob 으로 계속 보이고,
 * 다시 열 때 DB 의 진짜 id 가 서버가 준 경로로 풀린다.
 */
export async function flushUploads(json, html, title, onProgress) {
  /* 제목의 배너도 사진이다 — 본문만 훑으면 배너를 올린 글이 조용히 배너 없이 발행된다 */
  const all = collectLocal(json)
  if (isLocal(title?.banner?.src)) all.add(idOf(title.banner.src))

  /* 사진이 여러 장이면 저장이 몇 초 걸린다 — 몇 장째인지 화면에 말해 준다.
     사진이 없으면 onProgress 는 한 번도 안 불린다. */
  let done = 0
  for (const id of all) {
    if (uploaded.has(id)) continue
    const p = pending.get(id)
    if (!p) continue                       // 넣었다가 지운 사진 — 올릴 필요가 없다
    onProgress?.(done, all.size)
    uploaded.set(id, await put(p.blob))
    onProgress?.(++done, all.size)
  }
  const map = new Map([...all].map((id) => [id, uploaded.get(id)]).filter(([, v]) => v))
  if (!map.size) return { json, html, title }

  let out = html
  for (const [from, to] of map) out = out.split('attachment://' + from).join('attachment://' + to)

  const tsrc = title?.banner?.src
  const nextTitle = isLocal(tsrc) && map.has(idOf(tsrc))
    ? { ...title, banner: { ...title.banner, src: 'attachment://' + map.get(idOf(tsrc)) } }
    : title

  return { json: swap(json, map), html: out, title: nextTitle }
}
