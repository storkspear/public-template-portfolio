/**
 * 좋아요와 댓글 — 글 페이지의 `<section class="b-talk" data-no="N">` 을 채웁니다.
 *
 * 사이트에서 두 번째로 허락된 방문자 스크립트입니다(첫째는 peek.js). 굽기가 댓글을 페이지에
 * 굽지 않으므로(댓글마다 사이트를 통째로 다시 굽게 됩니다) 여기서 공개 API 로 불러 그립니다.
 * 서버는 server/talk.mjs, 길은 공개 nginx 의 `/api/public/` 하나뿐입니다.
 *
 * 글자는 전부 `textContent` 로 넣습니다 — 방문자가 쓴 글이 HTML 로 풀릴 틈을 두지 않습니다.
 * 좋아요는 누르면 바로 바뀌고(응답을 기다리지 않음), 취소는 확인을 한 번 거칩니다 — 연타로
 * 켰다 껐다를 되풀이하지 못하게. 서버도 같은 글은 3초에 한 번만 받습니다.
 */
(() => {
  const root = document.querySelector('section.b-talk[data-no]')
  if (!root) return
  const no = root.dataset.no
  const api = (p) => `/api/public${p}`
  const ANON = '익명의 누군가'

  /* 작은 DOM 도우미 — 속성과 자식을 받아 요소를 만듭니다. 글자는 항상 textContent */
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue
      if (k === 'class') el.className = v
      else if (k === 'text') el.textContent = v
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
      else el.setAttribute(k, v === true ? '' : v)
    }
    for (const k of kids) if (k != null) el.append(k)
    return el
  }

  const when = (iso) => {
    const d = new Date(iso)
    const p2 = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
  }

  /** 응답은 JSON 이 아닐 수도 있습니다(nginx 가 몰아치는 요청을 HTML 429 로 끊습니다) */
  const call = async (method, path, body) => {
    let res
    try {
      res = await fetch(api(path), {
        method, credentials: 'omit', cache: 'no-store',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch { return { ok: false, status: 0, data: { error: '연결이 끊겼습니다. 잠시 뒤에 다시 해 주세요' } } }
    let data = null
    try { data = await res.json() } catch { /* HTML 오류 쪽 */ }
    if (!data) data = { error: res.status === 429 ? '조금 천천히 해 주세요' : '잠시 뒤에 다시 시도해 주세요' }
    return { ok: res.ok, status: res.status, data }
  }

  /* 닉네임은 이 브라우저에만 기억합니다 — 다음 댓글에서 다시 안 치게. 비밀번호는 기억하지 않습니다 */
  const NICK = 'b-talk-nick'
  const remembered = () => { try { return localStorage.getItem(NICK) || '' } catch { return '' } }
  const remember = (v) => { try { v ? localStorage.setItem(NICK, v) : localStorage.removeItem(NICK) } catch { /* 사생활 보호 모드 */ } }

  let state = { comments: [], likes: 0, liked: false }
  let likeBusy = false

  /* ── 좋아요 ─────────────────────────────────────────────── */
  const likeBtn = h('button', { type: 'button', class: 'b-like', 'aria-pressed': 'false' })
  const likeNum = h('span', { class: 'b-like-n' })
  const likeLbl = h('span', { class: 'b-like-t', text: '좋아요' })
  likeBtn.append(h('span', { class: 'b-like-i', 'aria-hidden': 'true' }), likeLbl, likeNum)
  const likeNote = h('span', { class: 'b-like-note', role: 'status' })
  const confirmBox = h('div', { class: 'b-like-ask', role: 'dialog', 'aria-label': '좋아요 취소', hidden: true })

  const paintLike = () => {
    likeBtn.setAttribute('aria-pressed', String(state.liked))
    likeBtn.classList.toggle('is-on', state.liked)
    likeNum.textContent = String(state.likes)
    likeBtn.setAttribute('aria-label', `좋아요 ${state.likes}개${state.liked ? ', 누름' : ''}`)
  }
  const note = (el, msg) => {
    el.textContent = msg
    clearTimeout(el._t)
    if (msg) el._t = setTimeout(() => { el.textContent = '' }, 3200)
  }

  const sendLike = async (want) => {
    if (likeBusy) return
    likeBusy = true; likeBtn.disabled = true
    const before = { likes: state.likes, liked: state.liked }
    state.liked = want; state.likes = Math.max(0, state.likes + (want ? 1 : -1)); paintLike()
    const r = await call('POST', `/posts/${no}/like`, { want })
    if (r.ok) { state.likes = r.data.likes; state.liked = r.data.liked }
    else { Object.assign(state, before); note(likeNote, r.data.error) }
    paintLike()
    likeBusy = false; likeBtn.disabled = false
  }

  const closeAsk = () => { confirmBox.hidden = true; document.removeEventListener('keydown', escAsk); likeBtn.focus() }
  const escAsk = (e) => { if (e.key === 'Escape') closeAsk() }
  confirmBox.append(
    h('p', { text: '좋아요를 취소할까요?' }),
    h('div', { class: 'b-like-ask-btns' },
      h('button', { type: 'button', class: 'b-btn b-btn-quiet', text: '그대로 두기', onclick: closeAsk }),
      h('button', { type: 'button', class: 'b-btn', text: '취소하기', onclick: () => { closeAsk(); sendLike(false) } })))

  likeBtn.addEventListener('click', () => {
    if (likeBusy) return
    if (!state.liked) return sendLike(true)
    confirmBox.hidden = false
    document.addEventListener('keydown', escAsk)
    confirmBox.querySelector('.b-btn-quiet').focus()
  })

  /* ── 댓글 목록 ──────────────────────────────────────────── */
  const count = h('span', { class: 'b-talk-n' })
  const list = h('ol', { class: 'b-cmts' })
  const empty = h('p', { class: 'b-cmts-empty', text: '첫 댓글을 남겨 주세요.' })

  const delForm = (c, li) => {
    const old = li.querySelector('.b-cmt-del'); if (old) { old.remove(); return }
    const pw = h('input', { type: 'password', class: 'b-in', placeholder: '쓸 때 정한 비밀번호', autocomplete: 'off', maxlength: '32', 'aria-label': '비밀번호' })
    const msg = h('span', { class: 'b-form-msg', role: 'status' })
    const go = h('button', { type: 'submit', class: 'b-btn', text: '지우기' })
    const f = h('form', { class: 'b-cmt-del' }, pw, go,
      h('button', { type: 'button', class: 'b-btn b-btn-quiet', text: '닫기', onclick: () => f.remove() }), msg)
    f.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (!pw.value) return note(msg, '비밀번호를 적어 주세요')
      go.disabled = true
      const r = await call('POST', `/comments/${c.id}/delete`, { password: pw.value })
      go.disabled = false
      if (r.ok) { state = { ...state, ...r.data }; paintList() }
      else { note(msg, r.data.error); pw.select() }
    })
    li.append(f); pw.focus()
  }

  const paintList = () => {
    count.textContent = String(state.comments.length)
    list.replaceChildren(...state.comments.map((c) => {
      const li = h('li', { class: 'b-cmt' })
      li.append(
        h('div', { class: 'b-cmt-meta' },
          h('b', { class: 'b-cmt-who', text: c.nickname || ANON }),
          h('span', { class: 'b-cmt-ip', text: c.ip }),
          h('time', { class: 'b-cmt-at', datetime: c.at, text: when(c.at) }),
          /* 내가 쓴 댓글(같은 IP)에만 섭니다. 서버도 같은 IP 가 아니면 지우지 않습니다 */
          c.mine ? h('button', { type: 'button', class: 'b-cmt-x', text: '삭제', onclick: () => delForm(c, li) }) : null),
        h('p', { class: 'b-cmt-body', text: c.body }))
      return li
    }))
    empty.hidden = state.comments.length > 0
  }

  /* ── 쓰기 ───────────────────────────────────────────────── */
  const body = h('textarea', { class: 'b-in b-in-body', rows: '3', maxlength: '1000', placeholder: '댓글을 남겨 주세요', 'aria-label': '댓글 내용', required: true })
  const nick = h('input', { class: 'b-in', maxlength: '20', placeholder: `닉네임 (${ANON})`, 'aria-label': '닉네임', autocomplete: 'nickname', value: remembered() })
  const pw = h('input', { class: 'b-in', type: 'password', maxlength: '32', minlength: '4', placeholder: '비밀번호 (삭제 시 필요)', 'aria-label': '비밀번호', autocomplete: 'new-password', required: true })
  /* 사람은 못 보는 칸 — 봇이 채우면 서버가 받은 척만 합니다 */
  const trap = h('input', { name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', class: 'b-trap' })
  const send = h('button', { type: 'submit', class: 'b-btn', text: '등록' })
  const formMsg = h('span', { class: 'b-form-msg', role: 'status' })
  /* 쓰는 칸은 접어 둡니다 — 읽으러 온 사람에게 입력칸 넷이 먼저 보이지 않게. 「댓글 쓰기」로 엽니다 */
  const openBtn = h('button', { type: 'button', class: 'b-btn b-btn-quiet b-cmt-open', text: '댓글 쓰기', 'aria-expanded': 'false' })
  const close = h('button', { type: 'button', class: 'b-btn b-btn-quiet', text: '닫기' })
  const form = h('form', { class: 'b-cmt-form', hidden: true },
    body, h('div', { class: 'b-cmt-row' }, nick, pw, close, send), trap, formMsg)
  const setOpen = (on) => {
    form.hidden = !on; openBtn.hidden = on
    openBtn.setAttribute('aria-expanded', String(on))
    if (on) body.focus(); else openBtn.focus()
  }
  openBtn.addEventListener('click', () => setOpen(true))
  close.addEventListener('click', () => setOpen(false))
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!body.value.trim()) return note(formMsg, '내용을 적어 주세요')
    if (pw.value.length < 4) return note(formMsg, '비밀번호는 4자 이상입니다')
    send.disabled = true
    const r = await call('POST', `/posts/${no}/comments`, { body: body.value, nickname: nick.value, password: pw.value, website: trap.value })
    send.disabled = false
    if (!r.ok) return note(formMsg, r.data.error)
    remember(nick.value.trim())
    body.value = ''; pw.value = ''
    if (r.data.comments) { state = { ...state, ...r.data }; paintList(); paintLike() }
    setOpen(false)
    list.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })

  root.replaceChildren(
    h('div', { class: 'b-like-row' }, likeBtn, likeNote, confirmBox),
    h('h2', { class: 'b-talk-h' }, '댓글 ', count),
    list, empty, openBtn, form)

  call('GET', `/posts/${no}/talk`).then((r) => {
    if (!r.ok) { root.replaceChildren(h('p', { class: 'b-talk-off', text: r.status === 404 ? '' : r.data.error })); return }
    state = r.data; paintLike(); paintList()
  })
})()
