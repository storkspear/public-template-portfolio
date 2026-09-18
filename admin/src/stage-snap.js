/**
 * 무대 편집기의 **붙기와 안내선 계산** — DOM 을 모른다(그래서 node 에서 바로 시험한다).
 *
 * 피그마가 대지에서 하는 세 가지를 한다:
 *   ① 정렬선 — 끄는 요소의 왼·가운데·오른(위·가운데·아래)이 다른 요소나 판의 선과 맞으면 붙고,
 *      **두 요소를 잇는 선분**과 맞닿은 자리의 × 표시를 그린다. 맞는 선은 **전부** 보인다.
 *   ② 같은 간격 — 같은 줄(세로로 겹치는) 요소들 사이의 간격과 같아지면 붙고, 간격마다 빨간 숫자를 띄운다.
 *      두 이웃 사이 **한가운데**(양쪽 간격이 같아지는 자리)에도 붙는다. 세로 방향도 같다.
 *   ③ 판의 선 — 가장자리·판면선(40)·가운데, 격자를 켰으면 단의 양쪽 선.
 *
 * 좌표는 전부 1240px 판 단위. 상자는 `{ key, x, y, w, h }`.
 */

/** 선이 「맞았다」고 보는 차이 — 좌표를 정수로 반올림하므로 1 안쪽은 같은 선이다 */
const EPS = 1

const ext = (b) => ({ ...b, r: b.x + b.w, bt: b.y + b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2 })
const near = (a, b) => Math.abs(a - b) < EPS
/* 가로 간격을 볼 이웃 = 세로로 겹치는 것, 세로 간격을 볼 이웃 = 가로로 겹치는 것 */
const crossY = (a, b) => a.y < b.bt && b.y < a.bt
const crossX = (a, b) => a.x < b.r && b.x < a.r

/**
 * 축 하나의 이름표 — 가로(x)와 세로(y)를 같은 코드로 다룬다.
 * lo=시작, hi=끝, mid=가운데, size=길이, cross=교차축에서 겹치는가
 */
const AX = {
  x: { lo: 'x', hi: 'r', mid: 'cx', size: 'w', cross: crossY, clo: 'y', chi: 'bt' },
  y: { lo: 'y', hi: 'bt', mid: 'cy', size: 'h', cross: crossX, clo: 'x', chi: 'r' },
}

/** 같은 줄 요소들 사이의 간격 — 각 요소에서 **바로 다음** 요소까지만(건너뛴 간격은 간격이 아니다) */
const pairGaps = (items, A) => {
  const out = []
  for (const a of items) {
    const next = items
      .filter((b) => b !== a && b[A.lo] >= a[A.hi] - 0.01)
      .sort((p, q) => p[A.lo] - q[A.lo])[0]
    if (next) out.push({ a, b: next, g: next[A.lo] - a[A.hi] })
  }
  return out
}

/** 끄는 상자의 이웃 둘 — 가운데를 기준으로 앞쪽에서 끝이 가장 가까운 것, 뒤쪽에서 시작이 가장 가까운 것 */
const neighbors = (box, row, A) => {
  const before = row.filter((o) => o[A.hi] <= box[A.mid]).sort((p, q) => q[A.hi] - p[A.hi])[0] || null
  const after = row.filter((o) => o[A.lo] >= box[A.mid]).sort((p, q) => p[A.lo] - q[A.lo])[0] || null
  return { before, after }
}

/** 한 축의 붙을 자리 후보 — 옮길 거리(d)들 */
const candidates = (box, others, lines, A, withGaps) => {
  const out = []
  const mine = [box[A.lo], box[A.mid], box[A.hi]]
  const targets = [...lines]
  for (const o of others) targets.push(o[A.lo], o[A.mid], o[A.hi])
  for (const m of mine) for (const t of targets) out.push({ d: t - m, kind: 'align' })
  if (withGaps) {
    const row = others.filter((o) => A.cross(o, box))
    const { before, after } = neighbors(box, row, A)
    const refs = pairGaps(row, A).map((p) => p.g)
    for (const g of refs) {
      if (before) out.push({ d: before[A.hi] + g - box[A.lo], kind: 'gap' })
      if (after) out.push({ d: after[A.lo] - g - box[A.hi], kind: 'gap' })
    }
    if (before && after) {
      const lo = (before[A.hi] + after[A.lo] - box[A.size]) / 2
      if (lo >= before[A.hi]) out.push({ d: lo - box[A.lo], kind: 'gap' })
    }
  }
  return out
}

const pick = (cands, lim) => {
  let best = null
  for (const c of cands) {
    if (Math.abs(c.d) > lim) continue
    /* 같은 거리면 정렬선이 이긴다 — 줄 맞춤이 간격 맞춤보다 먼저 읽힌다 */
    if (!best || Math.abs(c.d) < Math.abs(best.d) - 1e-9 || (Math.abs(c.d) === Math.abs(best.d) && c.kind === 'align')) best = c
  }
  return best ? best.d : 0
}

/**
 * 끄는 상자를 붙인다.
 * @param box    끄는 상자(붙이기 전 자리)
 * @param others 다른 요소 상자들
 * @param board  `{ w, h, xs, ys }` — xs·ys 는 판의 선(가장자리·판면선·가운데·격자)
 * @param lim    붙는 거리(판 단위)
 */
export function snapMove(box, others, board, lim) {
  const b = ext(box)
  const os = others.map(ext)
  const dx = pick(candidates(b, os, board.xs, AX.x, true), lim)
  const dy = pick(candidates(b, os, board.ys, AX.y, true), lim)
  return { x: box.x + dx, y: box.y + dy }
}

/** 폭 손잡이 — 오른쪽 끝만 붙는다 */
export function snapRight(box, others, board, lim) {
  const b = ext(box)
  const targets = [...board.xs]
  for (const o of others.map(ext)) targets.push(o.x, o.cx, o.r)
  return { w: box.w + pick(targets.map((t) => ({ d: t - b.r, kind: 'align' })), lim) }
}

/**
 * 지금 자리에서 그릴 안내선 — **맞는 것 전부.**
 * @returns `{ lines: [{x1,y1,x2,y2}], marks: [{x,y}], gaps: [{x1,y1,x2,y2,value}] }`
 */
export function guidesFor(box, others, board, mode = 'move') {
  const b = ext(box)
  const os = others.map(ext)
  const lines = []
  const marks = []
  const gaps = []
  const seen = new Set()
  const addLine = (l) => {
    const id = [l.x1, l.y1, l.x2, l.y2].map((n) => Math.round(n)).join(',')
    if (!seen.has(id)) { seen.add(id); lines.push(l) }
  }
  /* 선이 맞닿는 자리 — 모서리 선이면 양 끝, 가운데 선이면 가운데 한 점 */
  const markOn = (o, A, which, at) => {
    if (which === 'mid') marks.push(A === AX.x ? { x: at, y: o.cy } : { x: o.cx, y: at })
    else if (A === AX.x) marks.push({ x: at, y: o.y }, { x: at, y: o.bt })
    else marks.push({ x: o.x, y: at }, { x: o.r, y: at })
  }

  for (const [axis, boardLines] of [['x', board.xs], ['y', board.ys]]) {
    const A = AX[axis]
    const mine = mode === 'w'
      ? (axis === 'x' ? [['hi', b.r]] : [])
      : [['lo', b[A.lo]], ['mid', b[A.mid]], ['hi', b[A.hi]]]
    for (const [which, m] of mine) {
      /* 판의 선 — 판 끝에서 끝까지 */
      if (boardLines.some((t) => near(t, m))) {
        addLine(axis === 'x' ? { x1: m, y1: 0, x2: m, y2: board.h } : { x1: 0, y1: m, x2: board.w, y2: m })
      }
      /* 다른 요소 — 두 요소를 잇는 선분 */
      const hits = []
      for (const o of os) {
        const w = [['lo', o[A.lo]], ['mid', o[A.mid]], ['hi', o[A.hi]]].find(([, v]) => near(v, m))
        if (w) hits.push([o, w[0]])
      }
      if (!hits.length) continue
      const lo = Math.min(b[A.clo], ...hits.map(([o]) => o[A.clo]))
      const hi = Math.max(b[A.chi], ...hits.map(([o]) => o[A.chi]))
      addLine(axis === 'x' ? { x1: m, y1: lo, x2: m, y2: hi } : { x1: lo, y1: m, x2: hi, y2: m })
      markOn(b, A, which, m)
      for (const [o, w] of hits) markOn(o, A, w, m)
    }

    if (mode !== 'move') continue
    /* 같은 간격 — 끄는 상자와 이웃 사이 간격이 같은 줄의 다른 간격(또는 반대쪽 간격)과 같으면 전부 띄운다 */
    const row = os.filter((o) => A.cross(o, b))
    const { before, after } = neighbors(b, row, A)
    const refs = pairGaps(row, A)
    const mineGaps = []
    if (before) mineGaps.push({ a: before, b, g: b[A.lo] - before[A.hi] })
    if (after) mineGaps.push({ a: b, b: after, g: after[A.lo] - b[A.hi] })
    const shown = new Set()
    const addGap = (p) => {
      const id = `${p.a.key}>${p.b.key}`
      if (shown.has(id) || p.g < 1) return
      shown.add(id)
      /* 선은 두 상자가 교차축에서 겹치는 구간의 가운데를 지난다 */
      const c = (Math.max(p.a[A.clo], p.b[A.clo]) + Math.min(p.a[A.chi], p.b[A.chi])) / 2
      const s = p.a[A.hi]
      const e = p.b[A.lo]
      gaps.push(axis === 'x' ? { x1: s, y1: c, x2: e, y2: c, value: Math.round(p.g) }
                             : { x1: c, y1: s, x2: c, y2: e, value: Math.round(p.g) })
    }
    for (const mg of mineGaps) {
      const same = refs.filter((r) => near(r.g, mg.g))
      const other = mineGaps.find((x) => x !== mg && near(x.g, mg.g))
      if (!same.length && !other) continue
      addGap(mg)
      if (other) addGap(other)
      same.forEach(addGap)
    }
  }
  return { lines, marks, gaps }
}
