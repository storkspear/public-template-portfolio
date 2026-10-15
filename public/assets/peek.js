/**
 * 곁에 보는 글 — 얹는 스크립트.
 *
 * 이 파일이 없어도 기능은 돕니다: 굽기가 「내 글」 링크를 `href="#peek-N"` 으로 내고 blog.css 가
 * `:target` 으로 판 한 장을 여닫습니다. 여기서 더하는 것은 셋뿐입니다.
 *   1. 넓은 화면에서 판을 **두세 장 나란히** 세우고, 넘치면 먼저 연 것부터 뺍니다(큐).
 *   2. 판이 뜨고 닫히며 본문 폭이 바뀔 때 **읽던 자리를 붙잡습니다.**
 *   3. 문단 바로가기가 설 자리가 없어지면 「문단」 단추로 물립니다.
 *
 * 내 글 링크가 있는 글에만 실립니다(굽기의 `postPage`). 그 밖의 페이지는 스크립트가 없습니다.
 * 방문자 스크립트에는 관리자 주소도 편집기 코드도 들어오면 안 됩니다(tools/check-public.mjs).
 */
(() => {
  const main = document.querySelector('main.b-post')
  if (!main) return
  const root = document.documentElement
  const W = 520                                    // 판 한 장의 폭(px)
  const MAX = 3                                    // 나란히 서는 판의 상한
  const rem = parseFloat(getComputedStyle(root).fontSize) || 16
  /* 글줄 폭. 굽기가 <main> 에 적어 둔 값입니다(없으면 기본 38rem) */
  const width = getComputedStyle(main).getPropertyValue('--measure-override').trim() || '38rem'
  /* 전체폭 글, 그리고 px 로 못 바꾸는 폭(`80%`·`50vw` …) — 옮길 양을 셀 수 없어 본문을 줄입니다.
     굽기의 `peekModeCss` 와 같은 판정이어야 합니다(스크립트 없이 도는 한 장과 모양이 갈리지 않게) */
  const full = main.classList.contains('b-full') || !/^[\d.]+(rem|px)$/.test(width)
  const hasJump = !!main.querySelector('.b-jump')
  const measure = () => parseFloat(width) * (width.endsWith('rem') ? rem : 1)
  /* 판을 n 장 세우고도 남아야 하는 폭 — 고정폭 글은 글줄 + 여백 3rem, 전체폭 글은 본문 48rem */
  const need = () => (full ? 48 * rem : measure() + 3 * rem)
  const cap = () => (innerWidth < 1200 ? 0 : Math.max(0, Math.min(MAX, Math.floor((innerWidth - need()) / W))))

  root.classList.add('pk-js')
  const open = []            // { url, el } — 먼저 연 것이 앞
  let stack = null

  /* 구운 판(`section.peek`)마다의 처음 주소. 판 안에서 다른 글로 넘어가거나 창 크기 전환 때 빌려 쓰느라
     iframe 의 주소가 바뀌어도, 본문의 그 링크는 **제 글**을 열어야 합니다 */
  const home = new Map([...document.querySelectorAll('section.peek iframe')].map((f) => [f, f.getAttribute('src')]))
  const srcOf = (sec) => { const f = sec && sec.querySelector('iframe'); return f ? home.get(f) || f.getAttribute('src') : null }
  /* 빌려 썼던 판을 제 글로 되돌립니다 — 지금 열려 있는 판은 건드리지 않습니다 */
  const restore = (except) => { for (const [f, src] of home) if (f.closest('section') !== except && f.getAttribute('src') !== src) f.setAttribute('src', src) }

  /* 기본 방식(:target)으로 열려 있는 판 */
  const cssPanel = () => (/^#peek-[1-9]\d*$/.test(location.hash) ? document.querySelector(`${location.hash}.peek`) : null)
  const abs = (u) => new URL(u, location.href).href

  /**
   * 읽던 자리 붙잡기.
   * 본문 폭이 바뀌면 위쪽 글줄이 다시 잡혀 읽던 줄이 밀립니다. 붙잡을 것 하나(누른 링크, 없으면
   * 화면 가운데쯤의 문단)의 위치를 재 두었다가, 폭을 바꾼 **그 프레임에** 밀린 만큼 스크롤을 되돌립니다.
   */
  let pin = null
  const anchor = () => (pin && pin.isConnected ? pin
    : [...main.querySelectorAll('.prose-body > *:not(.peek)')].find((e) => e.getBoundingClientRect().bottom > innerHeight * 0.4))
  const hold = (change) => {
    const wide = innerWidth >= 1200
    const a = wide && anchor()
    const y0 = a ? a.getBoundingClientRect().top : 0
    const was = wide && !still.matches ? snap() : null
    change(); pin = null
    if (a) scrollBy(0, a.getBoundingClientRect().top - y0)
    if (was) play(was)
  }

  /**
   * 움직임 잇기.
   * 자리는 한 번에 바꾸고(위 `hold`), 옛 자리에서 새 자리까지를 transform 으로 잇습니다. `left` 나 여백을
   * 서서히 바꾸면 프레임마다 자리를 다시 잡아야 하는데, 판 안의 글을 싣는 일이 그 사이에 끼어 화면이 멈춥니다.
   * transform 은 그 일과 따로 돌아 멈추지 않습니다.
   *
   * 본문은 통째(<main>·<article>)가 아니라 **화면에 보이는 문단들**을 옮깁니다. 통째에 transform 을 걸면 그 안의
   * 고정 자리 물건(「문단」 단추, 기본 방식의 판)이 화면이 아니라 그 상자를 기준으로 앉아 엉뚱한 데로 갑니다.
   */
  const still = matchMedia('(prefers-reduced-motion: reduce)')
  const SLIDE = { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' }
  const live = []
  const left = (e) => e.getBoundingClientRect().left
  const fixed = (e) => getComputedStyle(e).position === 'fixed'
  const panels = () => [...document.querySelectorAll('.pkp:not(.out):not(.gone)')]
  /* 제 자리를 따로 재는 것 — 사이트 머리의 항목, 바로가기, 서 있는 판 */
  const own = () => [...document.querySelectorAll('.s-head > *, main.b-post > .b-jump'), ...panels()].filter((e) => !fixed(e))
  const snap = () => ({ main: left(main), own: new Map(own().map((e) => [e, left(e)])) })
  const play = (was) => {
    for (const a of live.splice(0)) a.cancel()          // 앞선 움직임이 남아 있으면 새 자리를 잘못 잽니다
    const go = (e, dx) => { if (Math.abs(dx) >= 1) live.push(e.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], SLIDE)) }
    const dm = was.main - left(main)
    if (Math.abs(dm) >= 1) {
      for (const e of main.querySelectorAll(':scope > .post-head, :scope > article > :not(.prose-body), .prose-body > :not(.peek)')) {
        const r = e.getBoundingClientRect()
        if (r.bottom > -200 && r.top < innerHeight + 200) go(e, dm)
      }
    }
    for (const e of own()) go(e, was.own.has(e) ? was.own.get(e) - left(e) : 0)
    /* 새로 선 판은 화면 오른쪽 밖에서 들어옵니다 */
    for (const e of panels()) if (!was.own.has(e)) go(e, innerWidth - left(e))
  }

  /* 서 있는 판 폭의 합을 CSS 에 알리고, 바로가기가 설 자리가 있는지 봅니다 */
  const apply = () => {
    const css = innerWidth >= 1200 ? cssPanel() : null
    const w = open.length * W
    const taken = w || (css ? css.getBoundingClientRect().width : 0)
    root.style.setProperty('--pk1', `${W}px`)
    root.style.setProperty('--pkw', `${w}px`)
    root.classList.toggle('pk-open', w > 0)
    /* 글줄 + 바로가기(15rem + 간격) + 판이 한 화면에 안 들어가면 바로가기를 단추로 물립니다.
       바로가기가 아예 없는 글도 같은 표식을 답니다 — blog.css 가 이 표식으로 「바로가기 자리(18.5rem)를
       비워 둘지」를 가르는데, 없는 바로가기의 자리까지 비우면 본문이 화면 왼쪽 밖으로 나갑니다 */
    root.classList.toggle('pk-sheet', taken > 0 && (!hasJump || full || innerWidth < measure() + 19.5 * rem + taken))
  }
  /* 판을 넣고 빼는 일(`change`)은 이 안에서 합니다 — 그래야 바꾸기 전 자리를 잴 수 있습니다 */
  const layout = (change) => hold(() => { if (change) change(); apply() })

  const drop = (p, how) => {
    open.splice(open.indexOf(p), 1)
    /* 빠지는 판은 줄에서 떼어 제자리에 둡니다 — 줄에 남으면 새 판과 합쳐 본문 위로 밀려납니다 */
    p.el.style.left = `${p.el.getBoundingClientRect().left}px`
    p.el.classList.add(how)
    setTimeout(() => p.el.remove(), 280)
  }

  /**
   * 뒤로 가기 — 판 하나를 열 때마다 기록 한 칸을 쌓고, 뒤로 가기가 오면 가장 나중 판을 닫습니다.
   * 닫기 단추로 닫을 때는 그 한 칸을 우리가 되돌립니다(`skip`). 안 되돌리면 닫은 뒤의 뒤로 가기가
   * 아무 일도 안 하는 헛걸음이 됩니다.
   */
  let skip = 0
  /* 기록의 칸마다 「그때 판이 몇 장이었나」를 적어 둡니다. 처음 칸은 0 장입니다 */
  const stamp = (n) => history.replaceState({ ...(history.state || {}), peek: n, mine: false }, '')
  if (!history.state || history.state.peek === undefined) stamp(0)
  addEventListener('popstate', (e) => {
    if (skip) { skip -= 1; return }
    /* 장수가 안 적힌 칸은 **방금 생긴 칸**입니다 — 문단 바로가기나 `#peek-N` 처럼 글 안의 자리로 가면
       브라우저가 새 칸을 만들며 이 사건을 냅니다. 닫으라는 뜻이 아니므로 지금 장수를 적어만 둡니다 */
    if (!e.state || e.state.peek === undefined) { stamp(open.length); return }
    /* 도착한 칸의 장수에 맞춥니다. 앞으로 가기는 다시 열지 않습니다 — 닫은 판은 닫힌 채입니다 */
    const want = e.state.peek
    if (open.length > want) layout(() => { while (open.length > want) drop(open[open.length - 1], 'gone') })
  })
  const close = (p) => {
    const top = open[open.length - 1] === p
    layout(() => drop(p, 'gone'))
    /* 맨 위 칸이 방금 닫은 그 판의 것일 때만 한 칸 되돌립니다. 그 사이 다른 칸이 쌓였으면(문단 바로가기)
       되돌리는 것이 그 칸을 지워 화면이 엉뚱한 데로 갑니다 — 그때는 기록을 그대로 둡니다 */
    if (top && history.state && history.state.mine && history.state.peek === open.length + 1) { skip += 1; history.back() }
  }

  const show = (url) => {
    url = abs(url)
    const had = open.find((p) => p.url === url)
    if (had) { had.el.classList.remove('flash'); void had.el.offsetWidth; had.el.classList.add('flash'); return }
    const el = document.createElement('section')
    el.className = 'pkp'
    el.setAttribute('aria-label', '참고 글')
    el.innerHTML = '<header class="peek-bar"><a class="peek-x" href="#" aria-label="닫기"></a></header>'
    const f = document.createElement('iframe')
    f.src = url
    el.append(f)
    const p = { url, el }
    el.querySelector('.peek-x').addEventListener('click', (e) => { e.preventDefault(); close(p) })
    /* 판 안의 글에서 누른 내 글 링크도 같은 큐로 받습니다. 판 안의 글은 같은 사이트의 글이라 들여다볼 수 있습니다 */
    f.addEventListener('load', () => {
      let doc = null
      try { doc = f.contentDocument } catch { /* 다른 오리진으로 넘어갔으면 손대지 않습니다 */ }
      if (!doc) return
      f.title = doc.title
      doc.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a.peek-link')
        if (!a || aside(e, a) || cap() < 2) return     // 한 장 자리뿐이면 판 안에서 넘어가게 둡니다
        e.preventDefault(); show(a.href)
      })
    })
    if (!stack) { stack = document.createElement('div'); stack.className = 'pk-stack'; document.body.append(stack) }
    layout(() => {
      while (open.length >= Math.max(1, cap())) drop(open[0], 'out')      // 큐 — 먼저 연 것부터
      stack.append(el); open.push(p)
    })
    /* `mine` — 판을 열며 **우리가 쌓은 칸**이라는 표식. 닫을 때 이 칸만 되돌립니다(글 안 이동으로 생긴 칸은 장수만 적혀 있습니다) */
    history.pushState({ peek: open.length, mine: true }, '')
  }

  /* ⌘·Ctrl·Shift 클릭과 가운데 클릭은 「새 탭·새 창으로」라는 뜻입니다. `href` 가 판을 여는 자리(`#peek-N`)라
     그대로 두면 이 글이 한 번 더 열립니다 — 그 글의 진짜 주소(`data-href`)로 보냅니다 */
  const aside = (e, a) => {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return false
    const to = a.getAttribute('data-href')
    if (to) { e.preventDefault(); window.open(to, '_blank', 'noopener') }
    return true
  }
  /* 본문의 내 글 링크 */
  const onLink = (e) => {
    const a = e.target.closest('a.peek-link[href^="#peek-"]')
    if (!a || aside(e, a) || e.button !== 0) return
    pin = a
    const sec = document.querySelector(`${a.getAttribute('href')}.peek`)
    const src = srcOf(sec)
    if (!src) return
    if (cap() < 2 && !open.length) {
      /* 한 장 자리뿐 — 기본 방식으로 엽니다. 여는 일만 대신 해서 읽던 자리를 붙잡습니다 */
      restore(null)
      if (innerWidth >= 1200) { e.preventDefault(); if (leaving) leaving.cancel(); hold(() => { location.hash = a.getAttribute('href'); apply() }) }
      return
    }
    e.preventDefault(); show(src)
  }
  document.addEventListener('click', onLink)
  document.addEventListener('auxclick', onLink)
  /* 기본 방식의 닫기도 같은 식으로. `:target` 이 풀리면 판은 그 자리에서 사라지므로, 잠깐 붙들어 두고(`.pk-bye`)
     오른쪽으로 내보냅니다 — 안 그러면 판은 툭 꺼지고 본문만 뒤늦게 돌아옵니다 */
  let leaving = null
  const bye = (sec) => {
    if (still.matches) return
    sec.classList.add('pk-bye')
    const a = leaving = sec.animate([{ transform: 'none' }, { transform: 'translateX(100%)' }], SLIDE)
    const done = () => { sec.classList.remove('pk-bye'); if (leaving === a) leaving = null }
    a.finished.then(done, done)
  }
  document.addEventListener('click', (e) => {
    const x = e.target.closest('.peek:target .peek-x')
    if (!x || innerWidth < 1200) return
    e.preventDefault()
    const sec = x.closest('.peek')
    hold(() => { location.hash = 'peek-0'; apply() })
    bye(sec)
  })
  /* 뒤로 가기·주소 직접 입력으로 기본 방식의 판이 여닫힐 때. 닫힌 판은 제 글로 되돌려 둡니다 */
  addEventListener('hashchange', () => { restore(cssPanel()); apply() })

  /**
   * 창 크기가 바뀌면 두 방식 사이를 넘겨줍니다.
   *   두 장 자리가 없어지면 → 스크립트 판을 걷고 가장 나중 글을 기본 방식에 넘깁니다. 그래야 그 폭의
   *     모양(오른쪽 한 장 · 문단 아래로 펼침 · 화면 전체)이 그대로 나옵니다.
   *   다시 넓어지면 → 기본 방식으로 열린 글을 스크립트 판으로 받습니다.
   */
  const handover = () => {
    if (cap() < 2 && open.length) {
      const url = open[open.length - 1].url
      for (const p of [...open]) { open.splice(0, 1); p.el.remove() }
      apply()
      const all = [...document.querySelectorAll('section.peek')]
      /* 그 글을 싣던 판이 있으면 그것을, 없으면(판 안에서 넘어가 닿은 글) 첫 판을 **빌려** 씁니다.
         빌린 판은 닫히거나 다른 판이 열릴 때 제 글로 돌아갑니다(`restore`) */
      const sec = all.find((s) => abs(srcOf(s)) === url) || all[0]
      if (sec) {
        const f = sec.querySelector('iframe')
        if (abs(f.getAttribute('src')) !== url) f.setAttribute('src', url)
        restore(sec)
        location.hash = sec.id
      }
    } else if (cap() >= 2 && cssPanel()) {
      const f = cssPanel().querySelector('iframe')
      let url = f.getAttribute('src')
      /* 판 안에서 다른 글로 넘어가 있었으면 그 글을 받습니다. 아직 안 실린 iframe 은 던지지 않고
         `about:blank` 를 돌려주므로(늦게 받는 iframe 을 주소로 바로 연 경우) 그때는 처음 주소를 씁니다 */
      try { const at = f.contentWindow.location.href; if (at && at !== 'about:blank') url = at } catch { /* 처음 주소로 */ }
      location.hash = 'peek-0'
      show(url)
    } else {
      layout(() => { while (open.length > Math.max(1, cap())) drop(open[0], 'out') })
    }
    /* 문단 아래로 펼치는 폭으로 들어오면 펼친 상자가 화면 밖일 수 있습니다 — 보이는 데까지만 따라갑니다 */
    const c = cssPanel()
    if (c) { const r = c.getBoundingClientRect(); if (r.top > innerHeight * 0.6 || r.bottom < 0) c.scrollIntoView({ block: 'center' }) }
  }
  addEventListener('resize', handover)
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open.length) close(open[open.length - 1]) })
  handover()
})()
