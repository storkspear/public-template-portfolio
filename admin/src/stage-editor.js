/**
 * 메인 무대 편집기 — 관리자 미리보기 창 안에 얹는 편집 층.
 *
 * 미리보기는 관리자와 같은 출처라 창의 문서를 직접 만질 수 있습니다. 공개 HTML 에는 아무것도 안 실립니다 —
 * 이 파일은 관리자 번들에만 있고, 층(외곽선·knob·안내선)은 미리보기 문서에만 렌더링됩니다.
 *
 * React 밖의 순수 DOM 입니다. 끄는 동안은 창 안 요소의 CSS 변수(`--sx --sy --sw`)만 고치고,
 * 놓는 순간 한 번 `onChange` 로 알립니다 — 끌 때마다 React 상태를 바꾸면 화면 전체가 다시 렌더링됩니다.
 *
 * 좌표는 늘 1240px 판 단위입니다(어휘의 STAGE_W). 창에서 판이 1000px 로 보이면 화면 1px = 판 1.24.
 */
import { STAGE_W, STAGE_H, ITEM_MAX } from '../../shared/site-vocab.mjs'
import { snapMove, snapRight, guidesFor } from './stage-snap.js'

/** 판면선 — 사이트 본문의 좌우 여백(.wrap 의 40px). 정렬과 안내선이 이 선을 압니다 */
export const MARGIN = 40
/** 안내선에 붙는 거리 — 화면 px(판 단위로 바꾸면 확대 배율마다 느낌이 달라집니다) */
const SNAP_PX = 6
/** 격자 — 12단, 단 사이 24px(판 단위). CSS 의 .se-grid 와 같은 값이어야 붙는 선과 보이는 선이 맞습니다 */
const GUTTER = 24
/**
 * 가장자리 여백 — 비교할 것이 없을 때 기댈 자리입니다.
 *
 * 텅 빈 판에서 맨 왼쪽·맨 위로 끌면 붙을 선이 가장자리(0)뿐이라 안내선이 안 보이고,
 * 어디에 놓았는지 알 수 없습니다. 네 변에서 이만큼 들어온 자리를 늘 둡니다.
 * 본문 판면선(MARGIN 40)과는 다른 것입니다 — 그쪽은 글이 시작하는 자리입니다.
 */
const PAD = 20

/**
 * 층의 옷 — 미리보기 문서에 넣습니다.
 *
 * 선택 테두리는 `box-shadow` 두 겹입니다(바깥 0.5px + 안쪽 0.5px). 선 한가운데가 좌표에
 * 오게 해서 안내선(`.se-g`, `margin:-0.5px` 로 좌표에 걸칩니다)과 정확히 겹칩니다.
 * `outline-offset` 은 브라우저가 정수로 반올림해(크롬: -0.5px → -1px) 반픽셀을 못 씁니다 —
 * 바깥으로 물린 테두리는 선에 붙었는데도 두 선이 어긋나 보입니다.
 */
const CSS = `
.se-on .m-i { cursor: move; }
/* 테두리는 선 한가운데가 좌표에 오도록 렌더링합니다. 안내선(.se-g)과 정확히 겹칩니다 */
.se-on .m-i:hover { box-shadow: 0 0 0 0.5px #18a0fb, inset 0 0 0 0.5px #18a0fb; }
.se-on .m-i a { cursor: inherit; }
.se-on .m-i.se-editing, .se-on .m-i.se-editing a { cursor: text; }
.se-on .m-i.se-editing { outline: 2px solid #18a0fb; outline-offset: 3px; }
.se-on .m-i [contenteditable], .se-on .m-i[contenteditable] { caret-color: #18a0fb; }
.se-layer { position: absolute; inset: 0; pointer-events: none; z-index: 30; }
.se-sel { position: absolute; box-shadow: 0 0 0 0.5px #18a0fb, inset 0 0 0 0.5px #18a0fb; }
.se-sel[hidden], .se-hover[hidden] { display: none; }
.se-h {
  position: absolute; top: 50%; right: -8px; width: 9px; height: 9px; margin-top: -4.5px;
  background: #fff; border: 1.5px solid #18a0fb; box-sizing: border-box;
  pointer-events: auto; cursor: ew-resize;
}
.se-badge {
  position: absolute; left: 50%; top: calc(100% + 8px); transform: translateX(-50%);
  padding: 1px 5px; border-radius: 3px; background: #18a0fb; color: #fff;
  font: 500 10px/1.5 system-ui, sans-serif; white-space: nowrap; letter-spacing: 0;
}
.se-g { position: absolute; background: #f24822; }
.se-g.v { width: 1px; margin-left: -0.5px; }
.se-g.h { height: 1px; margin-top: -0.5px; }
/* 맞닿은 자리의 × — 피그마의 그 표시 */
.se-x { position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; }
.se-x::before, .se-x::after {
  content: ''; position: absolute; left: 3px; top: -0.5px; width: 1px; height: 8px; background: #f24822;
}
.se-x::before { transform: rotate(45deg); }
.se-x::after { transform: rotate(-45deg); }
/* 같은 간격 — 간격 선과 빨간 숫자 */
.se-gap { position: absolute; background: #f24822; }
.se-gap.h { height: 1px; margin-top: -0.5px; }
.se-gap.v { width: 1px; margin-left: -0.5px; }
.se-pill {
  position: absolute; transform: translate(-50%, -50%); padding: 0 4px; border-radius: 2px;
  background: #f24822; color: #fff; font: 600 10px/16px system-ui, sans-serif; letter-spacing: 0; white-space: nowrap;
}
.se-grid {
  position: absolute; inset: 0; display: grid; grid-template-columns: repeat(12, 1fr);
  column-gap: calc(${GUTTER} * 100cqw / ${STAGE_W}); padding: 0 calc(${MARGIN} * 100cqw / ${STAGE_W});
}
.se-grid[hidden] { display: none; }
.se-grid i { background: rgba(242, 72, 34, 0.07); border-inline: 1px solid rgba(242, 72, 34, 0.14); }
.se-frame { position: absolute; inset: 0; outline: 1px dashed rgba(24, 160, 251, 0.55); }
`

/**
 * 판 하나를 고릅니다 — 문서에 판이 둘 이상 있을 수 있습니다.
 *
 * 첫 화면의 무대와 푸터가 같은 부품(`.m-board`)을 쓰므로, 그냥 `.m-board` 를 찾으면
 * 무대를 끈 화면에서 편집기가 푸터 판에 붙습니다 — 무대 값을 푸터에 입히는 사고가 납니다.
 * 그래서 부르는 쪽이 어느 판인지 적고, 안 적으면 무대만 봅니다(`.m-stage` 는 굽기가 늘 씌웁니다).
 * 찾는 판이 없으면 안 붙습니다 — 엉뚱한 판에 붙느니 꺼지는 편이 낫습니다.
 */
const boardIn = (doc, root) => (root && typeof root !== 'string' ? root : doc.querySelector(root || '.m-stage .m-board'))

/**
 * 판의 데이터 — 무대와 푸터가 같은 모양입니다(상자 배열 + 판 높이 + 짝짓는 이름).
 * 옛 호출 방식(`{ main }`)도 받습니다 — 부르는 쪽을 한꺼번에 고치지 않아도 되게.
 */
const boardData = (o) => (o.main
  ? { items: o.main.items, height: o.main.stage?.height, template: o.main.template }
  : { items: o.items, height: o.height, template: o.template })

/**
 * @param {Window} win 미리보기 창
 * @param {{ root?: string|Element, items?: object[], height?: number, template?: string, main?: object,
 *           selected?: string|null, grid?: boolean, defaults?: Record<string,string>,
 *           onSelect: (info: {key: string, x: number, y: number, w: number, h: number}|null) => void,
 *           onChange: (key: string, patch: object) => void }} opts
 *   `root` = 붙을 판(안 주면 무대). `items`·`height`·`template` 가 그 판의 값이고,
 *   `main` 을 주면 거기서 꺼냅니다(옛 방식).
 *   `defaults` = 글자를 비웠을 때 공개면에 나갈 사이트 기본 글자(API 가 줍니다)
 * @returns 편집기 — 판이 없거나(직접 디자인·다른 화면) 좁아서 쌓인 화면이면 `{ off: '이유' }`
 */
/** board 가 세로로 쌓이는 폭. site.css 의 미디어 조건과 같아야 합니다.
    관리자가 창 크기 변화를 이 조건으로 감지합니다 */
export const STACK_MQ = '(max-width: 860px)'

export function attachStage(win, opts) {
  const doc = win.document
  const board = boardIn(doc, opts.root)
  if (!board) return { off: 'none' }
  /* 대표작이 없어 헤드라인 배치로 대신 구운 화면 — 보이는 자리가 데이터와 달라 끌면 엉뚱한 값이 저장됩니다 */
  /* 860px 이하는 판이 아니라 쌓인 모습입니다 — 거기서 끌면 좌표가 뜻을 잃습니다 */
  if (win.matchMedia(STACK_MQ).matches) return { off: 'narrow' }

  const defaults = opts.defaults || {}
  /* 판의 값 — `main` 으로 와도 여기서 한 모양이 됩니다 */
  let data = boardData(opts)
  let selected = null
  let editing = null
  const undo = []

  const style = doc.createElement('style')
  style.setAttribute('data-stage-editor', '')
  style.textContent = CSS
  doc.head.append(style)
  doc.documentElement.classList.add('se-on')

  const layer = doc.createElement('div')
  layer.className = 'se-layer'
  layer.innerHTML = `<div class="se-frame"></div><div class="se-grid" hidden>${'<i></i>'.repeat(12)}</div>` +
    `<div class="se-sel" hidden><span class="se-h" title="폭"></span><span class="se-badge"></span></div>`
  board.append(layer)
  const selBox = layer.querySelector('.se-sel')
  const badge = layer.querySelector('.se-badge')
  const gridEl = layer.querySelector('.se-grid')

  /* 상자는 이제 차례 있는 배열입니다 — id 로 찾습니다 */
  const at = (id) => (data.items || []).find((x) => x.id === id)
  const nodeOf = (key) => board.querySelector(`.m-i[data-i="${key}"]`)
  /**
   * 판 한 칸이 화면에서 몇 px 인가 — 여백을 뺀 안쪽 폭으로 잽니다.
   *
   * `.m-i` 의 단위는 `100cqw / 1240` 이고 `cqw` 는 판의 안쪽(content) 폭입니다. 그런데
   * `getBoundingClientRect()` 는 여백까지 셉니다 — 푸터 판은 좌우 여백이 40px 씩이라
   * 그대로 쓰면 오른쪽 끝(x=1168)에서 선택 네모가 아이콘과 75px 어긋납니다
   *. 무대 판은 여백이 0 이라 값이 같습니다.
   */
  const scale = () => {
    const cs = win.getComputedStyle(board)
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    return (board.getBoundingClientRect().width - pad) / STAGE_W
  }
  const heightOf = () => data.height || 600
  /** 요소의 판 단위 상자 — x·y·w 는 데이터, h 는 글자 양이 정한 실제 높이 */
  const boxOf = (key) => {
    const el = nodeOf(key)
    const v = at(key)
    const r = el ? el.getBoundingClientRect() : null
    /* 글자를 감싸는 상자는 잰 폭이 실제 값입니다 — 저장된 `w` 는 그때 최대 폭일 뿐이라,
       그대로 쓰면 짧은 글자에 넓은 네모가 잡혀 무엇을 고르는지 눈으로 알 수 없습니다 */
    const w = v.auto !== false && r ? Math.round(r.width / scale()) : v.w
    return { key, x: v.x, y: v.y, w, h: Math.round(r ? r.height / scale() : 0) }
  }
  const round = Math.round

  /** 공개면에 나갈 글자 — 굽기의 stageText 와 같은 규칙(앞뒤 공백을 떼고, 비면 기본 글자) */
  const shownText = (key) => (at(key)?.text || '').trim() || defaults[key] || ''
  /**
   * 데이터를 창 안 요소에 입힙니다 — 굽기가 옛 값으로 구운 화면이어도 지금 값이 보이게.
   * 글자도 같이 입힙니다 — 다시 굽기 전에 창이 새로 뜨면 방금 고친 글자가 옛 글자로 보입니다.
   * 맺음말 문장은 소개문을 따르므로 같이 바꿉니다.
   */
  const paintItem = (key) => {
    const el = nodeOf(key)
    const v = at(key)
    /* 감싸기 여부는 속성이라 CSS 변수로 못 넘깁니다 — 창의 요소에 바로 답니다 */
    if (el && v) { if (v.auto !== false) el.setAttribute('data-w', 'auto'); else el.removeAttribute('data-w') }
    if (!el || !v) return
    el.style.setProperty('--sx', String(round(v.x)))
    el.style.setProperty('--sy', String(round(v.y)))
    el.style.setProperty('--sw', String(round(v.w)))
    if (editing === key) return
    const text = shownText(key)
    const t = editTarget(key)
    /* 아이콘은 글자를 안 만집니다(`t` 가 없습니다) — 만지면 그림이 지워집니다 */
    if (text && t && t.innerText !== text) t.innerText = text
  }
  const paintAll = () => {
    board.style.setProperty('--sh', String(round(heightOf())))
    for (const it of data.items || []) paintItem(it.id)
    placeSel()
  }

  const placeSel = () => {
    if (!selected || !nodeOf(selected)) { selBox.hidden = true; return }
    const b = boxOf(selected)
    const k = scale()
    selBox.hidden = false
    Object.assign(selBox.style, { left: `${b.x * k}px`, top: `${b.y * k}px`, width: `${b.w * k}px`, height: `${b.h * k}px` })
    badge.textContent = `${b.w} × ${b.h}`
  }

  const select = (key, notify = true) => {
    if (editing && editing !== key) finishEdit(true)
    selected = key && nodeOf(key) ? key : null
    placeSel()
    if (notify) opts.onSelect(selected ? boxOf(selected) : null)
  }

  /* ── 안내선 ───────────────────────────────────────────────────────
     계산은 stage-snap.js(피그마의 정렬선·같은 간격·판의 선). 여기서는 그리기만 합니다. */
  const guides = []
  const clearGuides = () => { while (guides.length) guides.pop().remove() }
  const put = (cls, css, text) => {
    const g = doc.createElement('div')
    g.className = cls
    Object.assign(g.style, css)
    if (text !== undefined) g.textContent = text
    layer.append(g)
    guides.push(g)
  }
  const drawGuides = (box, mode) => {
    clearGuides()
    const k = scale()
    const px = (n) => `${n * k}px`
    const { lines, marks, gaps } = guidesFor(box, drag.others, drag.board, mode)
    for (const l of lines) {
      if (l.x1 === l.x2) put('se-g v', { left: px(l.x1), top: px(l.y1), height: px(l.y2 - l.y1) })
      else put('se-g h', { left: px(l.x1), top: px(l.y1), width: px(l.x2 - l.x1) })
    }
    for (const m of marks) put('se-x', { left: px(m.x), top: px(m.y) })
    for (const g of gaps) {
      if (g.y1 === g.y2) put('se-gap h', { left: px(g.x1), top: px(g.y1), width: px(g.x2 - g.x1) })
      else put('se-gap v', { left: px(g.x1), top: px(g.y1), height: px(g.y2 - g.y1) })
      put('se-pill', { left: px((g.x1 + g.x2) / 2), top: px((g.y1 + g.y2) / 2) }, String(g.value))
    }
  }
  /** 판의 선과 다른 요소들 — 끌기를 시작할 때 한 번 잽니다(끄는 동안 다른 요소는 안 움직입니다) */
  const surroundings = (skip) => {
    const H = heightOf()
    const xs = [0, PAD, MARGIN, STAGE_W / 2, STAGE_W - MARGIN, STAGE_W - PAD, STAGE_W]
    /* 격자를 켰으면 단의 양쪽 선에도 붙습니다 — 보이는 선에는 붙어야 합니다 */
    if (!gridEl.hidden) {
      const col = (STAGE_W - MARGIN * 2 - GUTTER * 11) / 12
      for (let i = 0; i < 12; i++) xs.push(MARGIN + i * (col + GUTTER), MARGIN + i * (col + GUTTER) + col)
    }
    const others = (data.items || []).filter(({ id }) => id !== skip && nodeOf(id)).map(({ id }) => boxOf(id))
    /* 세로도 같습니다 — 예전에는 가운데와 끝뿐이라 위아래 가장자리에 안내선이 없었습니다 */
    return { board: { w: STAGE_W, h: H, xs, ys: [0, PAD, H / 2, H - PAD, H] }, others }
  }

  /* ── 끌기 · 폭 바꾸기 ──────────────────────────────────────────────── */
  let drag = null
  const onDown = (e) => {
    if (e.button !== 0) return
    const handle = e.target.closest?.('.se-h')
    const el = handle ? nodeOf(selected) : e.target.closest?.('.m-i')
    if (!el || !board.contains(el)) {
      if (board.contains(e.target) && !editing) select(null)
      return
    }
    const key = el.dataset.i
    if (editing === key) return            /* 글자를 고치는 중에는 커서를 놓게 둡니다 */
    e.preventDefault()                      /* 끄는 동안 글자가 선택되지 않게 */
    /* 누르기를 막으면 초점이 이 창으로 안 옵니다 — 방향키·⌘Z 를 이 창이 받으려면 직접 옮깁니다 */
    win.focus()
    if (selected !== key) select(key)
    const v = at(key)
    /**
     * 포인터를 붙잡습니다 — 끌다가 창 밖(관리자 패널)에서 놓아도 끌기가 끝나야 합니다.
     * 누른 요소를 붙잡습니다. 판을 붙잡으면 뗄 때·클릭·더블클릭의 대상이 판으로 바뀌어
     *   두 번 눌러 글자 고치기가 안 열립니다.
     */
    const grab = handle || el
    /* 셈의 바탕은 보이는 상자입니다(`w0` 만 저장값 — 되돌리기가 옛 최대 폭을 돌려줘야 합니다).
       옆 상자들도 `boxOf` 로 재 두므로, 여기만 저장값을 쓰면 나 혼자 다른 자로 재는 셈이었습니다 */
    const b = boxOf(key)
    drag = { key, mode: handle ? 'w' : 'move', sx: e.clientX, sy: e.clientY, x: v.x, y: v.y, w: b.w, w0: v.w,
             h: b.h, auto: v.auto !== false, moved: false, pointer: e.pointerId, grab, ...surroundings(key) }
    try { grab.setPointerCapture(e.pointerId) } catch { /* 붙잡기를 못 하는 환경 */ }
    doc.addEventListener('pointermove', onMove)
    doc.addEventListener('pointerup', onUp)
    doc.addEventListener('pointercancel', onUp)
    grab.addEventListener('lostpointercapture', onUp)
  }
  const onMove = (e) => {
    if (!drag) return
    const k = scale()
    const dx = (e.clientX - drag.sx) / k
    const dy = (e.clientY - drag.sy) / k
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return
    drag.moved = true
    const v = at(drag.key)
    /* 붙는 거리는 화면 6px — 판 단위로 바꿔 넘깁니다. Alt 를 누르면 안 붙습니다(피그마와 같습니다) */
    const lim = e.altKey ? 0 : SNAP_PX / k
    if (drag.mode === 'move') {
      const at = snapMove({ key: drag.key, x: drag.x + dx, y: drag.y + dy, w: drag.w, h: drag.h }, drag.others, drag.board, lim)
      v.x = clamp(round(at.x), 0, STAGE_W - Math.min(drag.w, STAGE_W))
      v.y = clamp(round(at.y), 0, STAGE_H.max)
    } else {
      const at = snapRight({ key: drag.key, x: drag.x, y: drag.y, w: drag.w + dx, h: drag.h }, drag.others, drag.board, lim)
      v.w = clamp(round(at.w), 20, STAGE_W - drag.x)
      /* 폭을 손으로 정하는 순간 고정 폭이 됩니다 — 피그마에서 knob 을 끌면 hug 가 풀리는 것과 같습니다 */
      v.auto = false
    }
    /* 안내선은 놓인 자리에 표시합니다 — 붙지 않았어도 우연히 맞은 선은 보여야 합니다 */
    drawGuides({ key: drag.key, x: v.x, y: v.y, w: v.w, h: drag.h }, drag.mode)
    paintItem(drag.key)
    placeSel()
    /* 속성 칸의 숫자도 따라오게 — 한 프레임에 한 번만(끌 때마다 React 전체가 다시 그려지지 않게) */
    if (!drag.raf) {
      const key = drag.key
      drag.raf = win.requestAnimationFrame(() => { if (drag) drag.raf = 0; opts.onSelect(boxOf(key)) })
    }
  }
  const onUp = () => {
    doc.removeEventListener('pointermove', onMove)
    doc.removeEventListener('pointerup', onUp)
    doc.removeEventListener('pointercancel', onUp)
    const d = drag
    drag = null
    clearGuides()
    if (d) {
      d.grab.removeEventListener('lostpointercapture', onUp)
      try { d.grab.releasePointerCapture(d.pointer) } catch { /* 이미 놓였습니다 */ }
    }
    if (!d?.moved) return
    if (d.raf) win.cancelAnimationFrame(d.raf)
    opts.onSelect(boxOf(d.key))
    const v = at(d.key)
    const before = d.mode === 'move' ? { x: d.x, y: d.y } : { w: d.w0, auto: d.auto }
    const after = d.mode === 'move' ? { x: v.x, y: v.y } : { w: v.w, auto: false }
    undo.push({ key: d.key, before })
    opts.onChange(d.key, after)
  }

  /* ── 글자 고치기 — 두 번 누르면 그 자리에서 ─────────────────────────────
     링크 요소는 `<a>` 안의 글자를 고칩니다(요소 자체를 고치면 링크가 지워집니다).
     Enter 는 끝내기, Shift+Enter 는 줄바꿈, Esc 는 취소. */
  let editBefore = ''
  /**
   * 글자를 고치는 자리 — 아이콘 상자에는 없습니다.
   * 아이콘은 그림 하나가 전부라, 두 번 눌러 고칠 글자가 없습니다(주소는 관리자 패널에서 넣습니다).
   */
  const isIcon = (key) => nodeOf(key)?.dataset.k === 'icon'
  const editTarget = (key) => {
    if (isIcon(key)) return null
    const el = nodeOf(key)
    return el && (el.querySelector('a') || el)
  }
  const onDbl = (e) => {
    const el = e.target.closest?.('.m-i')
    if (!el || !board.contains(el)) return
    const key = el.dataset.i
    e.preventDefault()
    select(key)
    const t = editTarget(key)
    /* 아이콘은 고를 수만 있습니다 — 고칠 글자가 없으므로 편집으로 안 들어갑니다 */
    if (!t) return
    editing = key
    editBefore = t.innerText
    el.classList.add('se-editing')
    t.contentEditable = 'plaintext-only'
    if (t.contentEditable !== 'plaintext-only') t.contentEditable = 'true'
    t.focus()
    const r = doc.createRange()
    r.selectNodeContents(t)
    const s = win.getSelection()
    s.removeAllRanges()
    s.addRange(r)
  }
  const finishEdit = (keep) => {
    if (!editing) return
    const key = editing
    editing = null
    const el = nodeOf(key)
    const t = editTarget(key)
    if (!el || !t) return
    el.classList.remove('se-editing')
    t.removeAttribute('contenteditable')
    win.getSelection()?.removeAllRanges()
    if (!keep) { t.innerText = editBefore; placeSel(); return }
    /* 글자 수 상한은 어휘와 같습니다 — 글자 단위로 자릅니다(UTF-16 으로 자르면 이모지 반쪽이 남아 저장이 500).
       `<` `>` 는 서버가 거절하므로 빼 두고, 앞뒤 공백은 굽기와 같게 뗍니다 */
    const text = [...t.innerText.replace(/\r/g, '').replace(/[<>]/g, '').trim()].slice(0, ITEM_MAX).join('')
    const prev = (at(key).text || '').trim()
    if (text !== prev) {
      undo.push({ key, before: { text: at(key).text }, shown: editBefore })
      at(key).text = text
      opts.onChange(key, { text })
    }
    /* 다 지웠으면 공개면에 나갈 기본 글자로 보입니다 — 빈칸으로 두면 미리보기와 사이트가 달랐습니다 */
    t.innerText = shownText(key) || editBefore
    paintItem(key)
    placeSel()
  }
  const onFocusOut = (e) => {
    if (editing && e.target === editTarget(editing)) finishEdit(true)
  }

  /* ── 자판 ── 방향키 1 · Shift 10 / Esc 해제 / ⌘Z 되돌리기 */
  const onKey = (e) => {
    if (editing) {
      if (e.key === 'Escape') { e.preventDefault(); finishEdit(false) }
      else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); finishEdit(true) }
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      /* ⌘⇧Z(다시 하기)는 없습니다 — 되돌리기로 오해하지 않게 그냥 둡니다 */
      if (e.shiftKey) return
      const last = undo.pop()
      if (!last) return
      e.preventDefault()
      Object.assign(at(last.key), last.before)
      /* 글자는 보이던 글자로 되돌립니다 — 데이터의 빈 값은 「사이트 기본 글자」라 여기서는 모릅니다 */
      if (last.shown !== undefined) { const t = editTarget(last.key); if (t) t.innerText = last.shown }
      paintItem(last.key)
      select(last.key)
      opts.onChange(last.key, last.before)
      return
    }
    if (!selected) return
    if (e.key === 'Escape') { select(null); return }
    const step = e.shiftKey ? 10 : 1
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!mv) return
    e.preventDefault()
    set(selected, { x: at(selected).x + mv[0], y: at(selected).y + mv[1] }, true)
  }

  /** 바깥(속성 칸)에서 바꾼 값 — 창에 바로 입히고, `commit` 이면 되돌리기 기록과 함께 알립니다 */
  const set = (key, patch, commit = false) => {
    const v = at(key)
    if (!v) return
    const next = { ...patch }
    /* 판 밖으로 못 나가게 — 끌기와 같은 규칙(x + w ≤ 1240). 숫자 칸·방향키·정렬이 모두 이 길을 지납니다.
       보이는 폭으로 잽니다. 감싸기(auto) 상자의 저장된 `w` 는 「이만큼까지는 안 넘깁니다」는
       최대 폭일 뿐이라, 글자가 219px 인데 1160 으로 막아 x 가 80 에서 멈췄습니다 —
       상자는 왼쪽 구석에서 못 벗어나고, 오른쪽 정렬도 제자리였습니다 */
    /* 아이콘은 누르는 버튼입니다 — 24 아래로 줄면 손가락이 못 닿습니다(글자 상자는 20) */
    const wMin = isIcon(key) ? 24 : 20
    const w0 = next.w !== undefined ? clamp(round(next.w), wMin, STAGE_W) : boxOf(key).w
    if (next.x !== undefined) next.x = clamp(round(next.x), 0, STAGE_W - w0)
    if (next.w !== undefined) next.w = clamp(w0, wMin, STAGE_W - (next.x ?? v.x))
    if (next.y !== undefined) next.y = clamp(round(next.y), 0, STAGE_H.max)
    if (commit) undo.push({ key, before: Object.fromEntries(Object.keys(next).map((k) => [k, v[k]])) })
    Object.assign(v, next)
    paintItem(key)
    placeSel()
    if (key === selected) opts.onSelect(boxOf(key))
    if (commit) opts.onChange(key, next)
  }

  /** 정렬 — 판면선(좌우 40px)과 판의 세로 가운데·위아래 여백에 맞춥니다 */
  const align = (key, how) => {
    const b = boxOf(key)
    const H = heightOf()
    const at = {
      left: { x: MARGIN }, center: { x: (STAGE_W - b.w) / 2 }, right: { x: STAGE_W - MARGIN - b.w },
      top: { y: MARGIN }, middle: { y: (H - b.h) / 2 }, bottom: { y: H - MARGIN - b.h },
    }[how]
    if (at) set(key, at, true)
  }

  const clickGuard = (e) => {
    /* 무대 안의 링크(작업 보기·블로그)는 눌러도 가지 않습니다 — 누르는 것은 고르는 일입니다 */
    if (board.contains(e.target) && e.target.closest?.('a')) e.preventDefault()
  }

  const ro = new win.ResizeObserver(() => placeSel())
  ro.observe(board)
  board.addEventListener('pointerdown', onDown)
  board.addEventListener('dblclick', onDbl)
  board.addEventListener('click', clickGuard)
  doc.addEventListener('focusout', onFocusOut)
  doc.addEventListener('keydown', onKey)

  data = structuredClone(data)
  paintAll()
  if (opts.selected) select(opts.selected, true)
  if (opts.grid) gridEl.hidden = false

  return {
    off: null,
    /** React 쪽 값이 바뀌었을 때 — 끄는 중이 아니면 창을 그 값으로 맞춥니다 */
    sync(next) {
      if (drag || editing) return
      /* 세 가지 모양을 받습니다: 판의 값 그대로 · `{ main }` · 옛 방식의 메인 설정 통째로(`stage` 가 있습니다) */
      const now = boardData(next.main ? next : next.stage ? { main: next } : next)
      /* 템플릿이 바뀌면 배치가 통째로 달라졌습니다 — 옛 배치의 되돌리기 기록을 섞지 않습니다 */
      if (now.template !== data.template) undo.length = 0
      data = structuredClone(now)
      paintAll()
      if (selected) opts.onSelect(boxOf(selected))
    },
    set,
    align,
    select: (key) => select(key),
    /** 다시 굽기 직전 — 고치던 글자·끌던 자리를 지금 값으로 확정합니다(창이 갈리며 사라지지 않게) */
    flush() {
      if (editing) finishEdit(true)
      if (drag) onUp()
    },
    /** 서버에서 판을 되돌렸을 때 — 편집기의 되돌리기 기록은 옛 값입니다 */
    resetHistory() { undo.length = 0 },
    grid(on) { gridEl.hidden = !on },
    detach() {
      if (drag) onUp()
      ro.disconnect()
      board.removeEventListener('pointerdown', onDown)
      board.removeEventListener('dblclick', onDbl)
      board.removeEventListener('click', clickGuard)
      doc.removeEventListener('focusout', onFocusOut)
      doc.removeEventListener('keydown', onKey)
      layer.remove()
      style.remove()
      doc.documentElement.classList.remove('se-on')
    },
  }
}

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), Math.max(lo, hi))
