#!/usr/bin/env node
/**
 * 굽기 산출물 골든 스냅샷 — 리팩터가 HTML 을 바꿨는지 바이트로 판정합니다.
 *
 * 설정 한 축씩 바꿔 가며 bakePages 와 블로그 렌더러를 돌리고, 결과를 tools/golden/ 의
 * 기준 파일과 문자 단위로 비교합니다. 다르면 실패하고 첫 차이를 찍습니다.
 *
 * 축을 전부 조합하면 2만 벌이 넘으므로 조합하지 않습니다 — 한 축만 바꾸고 나머지는 기본값입니다.
 * 템플릿끼리 간섭하는 결함은 이 검사가 못 잡습니다. 대신 한 축이 몇 벌이든 비용이 선형입니다.
 *
 * 기준 파일 갱신:  node tools/check-bake.mjs --update
 * 갱신은 HTML 이 바뀌어야 정상인 변경(버그 수정 등)에만 씁니다. 그때도 diff 를 눈으로 보고 갱신합니다.
 *
 * 결정론을 위해 두 가지를 고정합니다.
 *  - 시각: 견본 자료의 published_at 이 Date.now() 로 만들어집니다. import 전에 못 박지 않으면
 *    날짜가 HTML 에 박혀 기준 파일이 매일 어긋납니다.
 *  - 에셋 버전: ?v= 토큰이 public/assets 의 최대 mtime 에서 나옵니다. CSS 를 한 글자만 고쳐도
 *    모든 페이지가 달라지므로 비교 전에 지웁니다.
 */
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, relative } from 'node:path'
import { existsSync } from 'node:fs'

const FROZEN_NOW = Date.UTC(2026, 0, 15, 3, 0, 0)
Date.now = () => FROZEN_NOW

const ROOT = new URL('..', import.meta.url).pathname
const GOLDEN = join(ROOT, 'tools/golden')
const UPDATE = process.argv.includes('--update')

/* 굽기는 모듈을 읽을 때 BLOG_DIR 을 요구하고, 두 폴더가 겹치면 부팅을 막습니다.
   임시 폴더 둘을 따로 주어 그 가드를 정상적으로 통과합니다. */
const TMP = await mkdtemp(join(tmpdir(), 'bake-golden-'))
process.env.BLOG_DIR = join(TMP, 'blog')
process.env.PAGES_DIR = join(TMP, 'www')

const { bakePages, blogPages, listPage, postPage, sweepUnpublished, themeStyle, headStyle, SITE_DEFAULTS } = await import('../server/bake.mjs')
/* 견본 글은 미리보기용으로 여섯이지만, 골든은 앞의 셋으로 봅니다 — 벌마다 글이 늘면 차이만 커지고
   새로 지키는 것이 없습니다 */
const DUMMY_POSTS = (await import('../server/dummy.mjs')).DUMMY_POSTS.slice(0, 3)
const vocab = await import('../shared/site-vocab.mjs')

/** 깊은 사본 — 축을 바꿀 때 기본 설정을 훼손하지 않습니다 */
const clone = (v) => structuredClone(v)

/** 설정 한 축을 바꾼 벌 하나. `posts` 를 주면 블로그를 `blogPages` 로 굽습니다(아래 카테고리 벌) */
const variant = (name, patch, posts = null) => {
  const conf = clone(SITE_DEFAULTS)
  patch(conf)
  return { name, conf, posts }
}

/**
 * 카테고리 벌에 쓰는 카테고리 둘. 모양은 기본을 통째로 베낀 것(`blogLookOf`) — 관리자가 만드는 그대로.
 * 견본 글은 1번 → 개발, 2번 → 일상, 3번 → 카테고리 없음. 셋이 다른 자리에 있어야 「/blog/ 에는 전부,
 * 카테고리에는 제 것만, 없음은 /blog/ 에만」을 한 벌로 지킵니다.
 */
const CATS = () => [
  { id: 'cgaebal', label: '개발', slug: 'gaebal', show: true, look: vocab.blogLookOf(SITE_DEFAULTS.blog) },
  { id: 'cilsang', label: '일상', slug: 'ilsang', show: true, look: vocab.blogLookOf(SITE_DEFAULTS.blog) },
]
const CAT_POSTS = DUMMY_POSTS.map((p, i) => ({ ...p, meta: i === 0 ? { category: 'cgaebal' } : i === 1 ? { category: 'cilsang' } : null }))

/**
 * 「내 글」 링크 벌에 쓰는 글 셋. 편집기가 저장하는 꼴 그대로(`<a href data-post>`) 본문에 넣습니다.
 *   1번(개발) → 2번을 문단에서, 3번을 목록 안에서, 없는 글(d-9)을 문단에서 가리킵니다.
 *   2번(일상) → 1번을 가리킵니다(판 안에 들어가는 벌에도 링크가 있어야 그 벌의 링크 처리를 봅니다).
 *   3번        → 링크 없음. 이 글의 HTML 은 링크가 없던 때와 같아야 합니다.
 */
const linkTo = (slug, text) => `<a href="/blog/${slug}/" data-post="${slug}">${text}</a>`
const PEEK_POSTS = (widths = []) => CAT_POSTS.map((p, i) => ({
  ...p, width: widths[i] ?? p.width,
  body: p.body + (i === 0
    ? `<p>둘째 글은 ${linkTo('d-2', '여기')}에 있고, 없는 글은 ${linkTo('d-9', '이쪽')}입니다.</p><ul><li><p>목록 안에서 ${linkTo('d-3', '셋째 글')}</p></li></ul><p>끝 문단.</p>`
    : i === 1 ? `<p>첫 글로 ${linkTo('d-1', '돌아가기')}.</p>` : ''),
}))

const values = (list) => vocab[list].map((x) => x.value)

/**
 * 검사할 설정 목록 — 한 축에 한 벌씩.
 *
 * 메인과 포트폴리오는 mode 를 template 으로 올려야 템플릿이 실제로 렌더링됩니다.
 * SITE_DEFAULTS 의 main.mode 가 code 라서, 그대로 두면 템플릿을 바꿔도 조각 HTML 만
 * 출력되어 템플릿 스윕이 아무것도 검사하지 못합니다.
 */
const asTemplate = (c) => { c.main.mode = 'template'; c.portfolio.mode = 'template' }
const CASES = [
  variant('base', () => {}),
  /* 기본값(code 모드)과 템플릿 모드를 둘 다 봅니다 */
  variant('base-template', asTemplate),
  /* 메뉴에서 블로그를 숨긴 벌. 템플릿 쪽은 공통헤더가 거르고(headerHtml), 직접 디자인 쪽은
     굽기가 조각의 <nav> 안을 걷어냅니다(dropHiddenNav). 두 화면이 같아야 합니다 */
  variant('hide-blog', (c) => { c.header.links.blog.show = false }),
  variant('hide-blog-template', (c) => { asTemplate(c); c.header.links.blog.show = false }),
  ...values('MAIN_TEMPLATES').map((v) => variant(`main-${v}`, (c) => { asTemplate(c); c.main.template = v })),
  ...values('PORTFOLIO_TEMPLATES').map((v) => variant(`portfolio-${v}`, (c) => { asTemplate(c); c.portfolio.template = v })),
  /* 메인 섹션을 하나씩만 켠 벌 — stage·works·posts·shots·slides 렌더러를 각각 태웁니다.
     shots 와 slides 는 이미지가 없으면 빈 문자열을 반환하므로 견본 이미지를 넣습니다 */
  ...['stage', 'works', 'posts', 'shots', 'slides'].map((k) => variant(`section-${k}`, (c) => {
    asTemplate(c)
    c.main.sections = c.main.sections.map((x) => ({ ...x, show: x.key === k }))
    if (k === 'shots' || k === 'slides') c.main.stage[k] = vocab.SAMPLE_SHOTS
  })),
  ...values('BLOG_TEMPLATES').map((v) => variant(`blog-${v}`, (c) => { c.blog.template = v })),
  /* 갈래의 글꼴 짝을 실은 벌 — 목록 제목(「글」)과 카테고리 줄은 그 짝이 아니라 사이트 글꼴을
     따라야 합니다(`--site-*`). 위 벌들은 글꼴 칸이 비어 있어 이 갈림을 못 봅니다 */
  /* 댓글·좋아요를 켠 사이트 — 글 페이지에 자리(`section.b-talk`)와 talk.js 하나가 붙습니다 */
  variant('talk-on', (c) => { c.blog.talk = { on: true } }),
  variant('blog-font', (c) => {
    c.blog.template = 'magazine'; c.blog.font = { display: 'Gowun Batang', body: 'Gowun Dodum' }
    c.blog.categories = CATS()
  }, CAT_POSTS),
  /* 글 상세의 문단 바로가기 — 켠 벌입니다. 기본이 꺼짐이라 위의 벌들은 전부 끈 쪽을 봅니다.
     이 한 벌이 <aside> 마크업과 제목의 id 주입을 지킵니다 */
  variant('blog-toc', (c) => { c.blog.toc.show = true }),
  /* 표식 모양 — 기본(diamond)은 바로 위 `blog-toc` 가 봅니다. 나머지 셋만 봅니다.
     마크업에서 달라지는 것은 <aside> 의 클래스 한 장입니다 */
  ...values('TOC_SKINS').filter((v) => v !== 'diamond')
    .map((v) => variant(`toc-${v}`, (c) => { c.blog.toc.show = true; c.blog.toc.skin = v })),
  /* 색을 고친 벌 하나 — <style data-toc> 가 실제로 나가는지 지킵니다 */
  variant('toc-tuned', (c) => { c.blog.toc.show = true; c.blog.toc.ink = '#bb3d30' }),
  /* 카테고리 줄 모양 — 첫 값(dots)은 위의 `cats-strip` 이 이미 봅니다. 나머지만 봅니다 */
  ...values('CAT_STRIP_STYLES').filter((v) => v !== 'dots')
    .map((v) => variant(`cats-${v}`, (c) => {
      c.blog.catStrip = v
      c.blog.categories = [{ id: 'cgaebal', label: '개발', slug: 'gaebal', show: true,
        look: vocab.blogLookOf(SITE_DEFAULTS.blog) }]
    })),
  /* 카드 갈래의 테마 — 기본(plain)은 위의 `blog-outline` 이 이미 봅니다. 나머지만 봅니다.
     클래스 한 장이 전부라 벌마다 달라지는 것은 <ul> 한 줄입니다 */
  ...values('OUTLINE_SKINS').filter((v) => v !== 'plain')
    .map((v) => variant(`skin-${v}`, (c) => { c.blog.template = 'outline'; c.blog.outline.skin = v })),
  /* 색·모서리를 고친 벌 하나 — <style data-outline> 이 실제로 나가는지 지킵니다 */
  variant('skin-tuned', (c) => {
    c.blog.template = 'outline'
    Object.assign(c.blog.outline, { skin: 'terminal', ink: '#ff8800', bg: '#101014', radius: 6 })
  }),
  /* 갈래 밑의 모양 — 첫 값은 위의 `blog-<갈래>` 가 이미 봅니다. 나머지만 봅니다.
     클래스 한 장이 전부라 벌마다 달라지는 것은 <ul> 한 줄입니다 */
  ...Object.entries(vocab.DECK_STYLES).flatMap(([tpl, list]) => list.slice(1)
    .map(({ value }) => variant(`deck-${tpl}-${value}`, (c) => { c.blog.template = tpl; c.blog.deck[tpl] = value }))),
  /* 종이 카드의 장식 둘과 바탕색 — <style data-deck> 이 실제로 나가는지 지킵니다 */
  ...values('PAPER_DECOS').slice(1).map((v) => variant(`deck-paper-${v}`, (c) => {
    c.blog.template = 'cards'; Object.assign(c.blog.deck, { cards: 'paper', deco: v, paper: '#eaf1f7' })
  })),
  ...values('NAV_STYLES').map((v) => variant(`nav-${v}`, (c) => { c.header.menu = 'header'; c.header.nav.style = v })),
  /* 드로어 갈래와 사이드바 모양은 메뉴가 사이드바일 때만 마크업에 나옵니다 */
  ...values('DRAWER_STYLES').map((v) => variant(`drawer-${v}`, (c) => { c.header.menu = 'sidebar'; c.header.drawer.style = v })),
  ...values('SIDEBARS').map((v) => variant(`sidebar-${v}`, (c) => { c.header.menu = 'sidebar'; c.header.sidebar.kind = v })),
  ...values('ALIGNS').map((v) => variant(`align-${v}`, (c) => { c.header.align = v })),
  ...values('WIDTHS').map((v) => variant(`width-${v}`, (c) => { c.header.width = v })),
  /* ── 카테고리 ──
     위 벌들은 카테고리가 없어 줄도 카테고리 페이지도 드로어 하위 항목도 안 나옵니다 — 그래서 한 바이트도
     안 흔들립니다. 아래 벌만 공개 굽기와 같은 길(`blogPages`)을 지나 그 셋을 지킵니다. */
  /* 줄이 서고, 카테고리 페이지가 제 글만 싣고, 글의 「← 목록」이 제 카테고리로 돌아갑니다 */
  variant('cats-strip', (c) => { c.blog.categories = CATS() }, CAT_POSTS),
  /* 비공개 — 「일상」의 페이지도 그 글(2번)도 디스크에 안 씁니다. 줄에도 /blog/ 에도 없습니다 */
  variant('cats-private', (c) => { c.blog.categories = CATS(); c.blog.categories[1].show = false }, CAT_POSTS),
  /* 드로어 — 블로그 줄 밑에 하위 항목이 섭니다(메인·포트폴리오 화면에도) */
  variant('cats-drawer', (c) => { c.blog.categories = CATS(); c.header.menu = 'sidebar' }, CAT_POSTS),
  /* 카테고리마다 제 모양 — 「개발」만 카드·터미널·바로가기 켬·타이틀 이름·공통헤더 끔.
     /blog/ 와 「일상」은 기본 그대로여야 합니다(한 페이지 뒤에 설정 블록이 하나뿐인지) */
  variant('cats-look', (c) => {
    c.blog.categories = CATS()
    Object.assign(c.blog.categories[0].look, {
      template: 'outline', chrome: false,
      outline: { ...c.blog.categories[0].look.outline, skin: 'terminal' },
      toc: { ...c.blog.categories[0].look.toc, show: true },
      head: { ...c.blog.categories[0].look.head, name: '개발 노트' },
    })
  }, CAT_POSTS),

  /* ── 내 글 링크(곁에 보는 글) ──
     링크가 판으로 바뀌고, 판 안에 들어가는 벌(`peek/`)이 글마다 서고, 스크립트는 링크가 있는 글에만 실립니다 */
  /* 기본 폭 + 문단 바로가기 — 목록 안의 링크는 판이 그 목록 뒤에 서고, 없는 글(d-9)은 글자만 남습니다 */
  variant('peek-link', (c) => { c.blog.categories = CATS(); c.blog.toc.show = true }, PEEK_POSTS()),
  /* 대상이 비공개 카테고리 — 2번이 안 나가므로 1번의 그 링크는 풀려 글자만 남고, 2번의 벌도 없습니다 */
  variant('peek-private', (c) => { c.blog.categories = CATS(); c.blog.categories[1].show = false }, PEEK_POSTS()),
  /* 본문 폭이 다른 글 — 비켜서는 경계가 글마다 달라집니다(1번 68rem, 2번 전체폭) */
  variant('peek-wide', (c) => { c.blog.categories = CATS(); c.blog.toc.show = true }, PEEK_POSTS(['68rem', 'full'])),
]

/** 비교에서 빼는 값 — 코드와 무관하게 바뀌는 것들 */
const normalize = (html) => html.replace(/\?v=[0-9a-z]+/g, '?v=VER')

/** 폴더 안의 모든 파일을 [상대경로, 내용] 으로 */
const collect = async (dir, base = dir) => {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const at = join(dir, e.name)
    if (e.isDirectory()) out.push(...await collect(at, base))
    else out.push([relative(base, at), normalize(await readFile(at, 'utf8'))])
  }
  return out.sort(([a], [b]) => a.localeCompare(b))
}

/**
 * 한 벌을 굽습니다.
 *
 * bakePages 는 메인과 포트폴리오만 굽습니다. 블로그 목록·상세는 미리보기 굽기가 부르는
 * 렌더러를 여기서 직접 불러 같은 자리에 담습니다 — 안 그러면 블로그 템플릿 열두 벌이 검사 밖입니다.
 */
const render = async (name, conf, posts = null) => {
  const into = join(TMP, 'out', name)
  await bakePages(null, { into, conf, dummy: true })
  const style = themeStyle(conf.theme) + headStyle(conf.header, conf.theme)
  /* 카테고리 벌은 공개 굽기와 같은 함수로 — 어느 페이지가 만들어지고 어느 글이 안 만들어지는지까지 봅니다 */
  if (posts) {
    for (const [rel, html] of blogPages(posts, style, conf)) await put(join(into, rel), html)
    return collect(into)
  }
  await mkdir(join(into, 'blog'), { recursive: true })
  await writeFile(join(into, 'blog/index.html'), listPage(DUMMY_POSTS, style, conf))
  await writeFile(join(into, 'blog/post.html'), postPage(DUMMY_POSTS[0], style, conf))
  return collect(into)
}

const put = async (at, text) => { await mkdir(dirname(at), { recursive: true }); await writeFile(at, text) }

/** 첫 차이의 줄 번호와 양쪽 줄 — 어디가 달라졌는지 바로 보이게 */
const firstDiff = (a, b) => {
  const x = a.split('\n'), y = b.split('\n')
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return { line: i + 1, want: x[i] ?? '(없음)', got: y[i] ?? '(없음)' }
  }
  return null
}

let pass = 0
const fails = []
/* 구운 것을 모아 둡니다 — 골든 비교와 별개로 전수로 세는 검사가 아래에 있습니다 */
const baked = []

for (const { name, conf, posts } of CASES) {
  let files
  try {
    files = await render(name, conf, posts)
  } catch (e) {
    fails.push(`${name}: 굽기가 실패했습니다 — ${e.message}`)
    continue
  }
  if (!files.length) { fails.push(`${name}: 구운 파일이 0개입니다`); continue }
  baked.push([name, files])

  if (UPDATE) {
    await rm(join(GOLDEN, name), { recursive: true, force: true })
    for (const [rel, html] of files) await put(join(GOLDEN, name, rel), html)
    pass++
    continue
  }

  const dir = join(GOLDEN, name)
  if (!existsSync(dir)) { fails.push(`${name}: 기준 파일이 없습니다 — --update 로 만드세요`); continue }
  const want = await collect(dir)

  const wantNames = want.map(([r]) => r).join('|')
  const gotNames = files.map(([r]) => r).join('|')
  if (wantNames !== gotNames) {
    fails.push(`${name}: 파일 목록이 다릅니다\n    기준: ${wantNames}\n    지금: ${gotNames}`)
    continue
  }

  const bad = []
  for (const [i, [rel, html]] of files.entries()) {
    if (want[i][1] === html) continue
    const d = firstDiff(want[i][1], html)
    bad.push(`    ${rel} ${d.line}번째 줄\n      기준: ${d.want.trim().slice(0, 160)}\n      지금: ${d.got.trim().slice(0, 160)}`)
  }
  if (bad.length) fails.push(`${name}: HTML 이 달라졌습니다\n${bad.join('\n')}`)
  else pass++
}

/* ── 블로그 면의 스크립트는 약속한 그 하나뿐인가 ────────────────────────
   글 페이지는 스크립트 없이 나가는 것이 기본입니다 — 코드 색칠도 문단 바로가기도 스크롤 추적도
   전부 굽기나 CSS 가 합니다. 예외는 하나, 「내 글」 링크가 있는 글에 실리는 `peek.js` 입니다
   (판을 여러 장 세우고 읽던 자리를 붙잡는 일 — 없어도 판 한 장은 CSS 로 열립니다).

   골든만으로는 못 지킵니다. `<script>` 한 줄을 어디선가 템플릿에 넣어도 골든은 「바뀐 HTML」로만
   보고, `--update` 한 번이면 조용히 기준이 됩니다. 그래서 따로 셉니다:
     링크가 있는 글        → 정확히 `<script src="/assets/peek.js?v=…" defer></script>` 하나
     댓글을 켠 사이트의 글 → `talk.js` 하나 더(peek.js 뒤). 자리(`section.b-talk`)가 있는 면에만
     그 밖의 블로그 면     → 0개 (목록, 링크 없는 글, 판 안에 들어가는 벌 전부) */
{
  const PEEK_JS = /^<script src="\/assets\/peek\.js\?v=[0-9a-zA-Z]+" defer><\/script>$/
  const TALK_JS = /^<script src="\/assets\/talk\.js\?v=[0-9a-zA-Z]+" defer><\/script>$/
  const jsIn = []
  let 센면 = 0, 실린면 = 0, 댓글면 = 0
  for (const [name, files] of baked) {
    for (const [rel, html] of files) {
      if (!rel.startsWith('blog/')) continue
      센면++
      const tags = html.match(/<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*>/gi) || []
      const linked = /class="[^"]*\bpeek-link\b[^"]*"[^>]*href="#peek-|href="#peek-\d+"/.test(html) && !rel.endsWith('/peek/index.html')
      const talk = /<section class="b-talk" data-no="\d+"/.test(html)
      if (linked) 실린면++
      if (talk) 댓글면++
      const want = [linked && PEEK_JS, talk && TALK_JS].filter(Boolean)
      if (tags.length !== want.length || !want.every((re, i) => re.test(tags[i]))) {
        jsIn.push(`${name}/${rel} — 스크립트 ${tags.length}개, 약속은 ${want.length}개` +
          `(${[linked && 'peek.js', talk && 'talk.js'].filter(Boolean).join('·') || '없음'})`)
      }
    }
  }
  if (!센면) fails.push('블로그 면을 한 장도 못 찾았습니다 — JS 검사가 죽었습니다')
  else if (!실린면) fails.push('내 글 링크가 있는 글을 한 장도 못 찾았습니다 — peek.js 검사가 죽었습니다')
  else if (!댓글면) fails.push('댓글 자리가 있는 글을 한 장도 못 찾았습니다 — talk.js 검사가 죽었습니다')
  else if (jsIn.length) fails.push(`블로그 면의 스크립트가 약속과 다릅니다\n${jsIn.map((x) => `    ${x}`).join('\n')}`)
  else console.log(`블로그 면 ${센면}장 — 스크립트는 내 글 링크가 있는 ${실린면}장에 peek.js, 댓글을 켠 ${댓글면}장에 talk.js, 나머지 0개`)
}

/* ── 공개되지 않은 글로 가는 링크는 풀리고, 알려지는가 ──────────────────
   숨긴 글·비공개 카테고리 글·없는 글을 가리키는 링크가 판으로 나가면 404 가 뜨거나(운이 좋을 때)
   숨긴 글의 본문이 읽힙니다(벌이 남아 있을 때). 골든은 「지금 HTML」만 보므로 따로 못 박습니다 */
{
  const conf = clone(SITE_DEFAULTS); conf.blog.categories = CATS(); conf.blog.categories[1].show = false
  const warn = []
  const pages = new Map(blogPages(PEEK_POSTS(), themeStyle(conf.theme) + headStyle(conf.header, conf.theme), conf, { warn }))
  const one = pages.get('blog/d-1/index.html') || ''
  const bad = []
  if (pages.has('blog/d-2/peek/index.html') || pages.has('blog/d-2/index.html')) bad.push('비공개 카테고리 글(d-2)이 구워졌습니다')
  if (/\/blog\/d-2\//.test(one)) bad.push('1번 글에 비공개 글(d-2)의 주소가 남았습니다')
  if (/\/blog\/d-9\//.test(one)) bad.push('1번 글에 없는 글(d-9)의 주소가 남았습니다')
  if (!/<iframe[^>]*src="\/blog\/d-3\/peek\/"/.test(one)) bad.push('공개 글(d-3)로 가는 판이 없습니다')
  if (warn.filter((w) => /d-2|d-9/.test(w)).length !== 2) bad.push(`경고가 둘이어야 합니다(d-2, d-9) — ${warn.length}건`)
  /* 맨 위 단계에 맨몸으로 놓인 링크(문단에 안 싸인 것)도 같은 길을 타야 합니다 */
  const bare = PEEK_POSTS().map((p, i) => (i === 2 ? { ...p, body: `${linkTo('d-9', '없는 글')}${linkTo('d-1', '첫 글')}${p.body}` } : p))
  const bareWarn = []
  const three = new Map(blogPages(bare, themeStyle(conf.theme) + headStyle(conf.header, conf.theme), conf, { warn: bareWarn })).get('blog/d-3/index.html') || ''
  if (/\/blog\/d-9\//.test(three)) bad.push('맨 위 단계 링크: 없는 글(d-9)의 주소가 남았습니다')
  if (!/<iframe[^>]*src="\/blog\/d-1\/peek\/"/.test(three)) bad.push('맨 위 단계 링크: 공개 글(d-1)로 가는 판이 없습니다')
  if (!bareWarn.some((w) => /글 d-3 .*d-9/.test(w))) bad.push('맨 위 단계 링크: 경고가 없습니다')
  if (bad.length) fails.push(`내 글 링크의 공개 여부 처리가 틀렸습니다\n${bad.map((x) => `    ${x}`).join('\n')}`)
  else console.log('내 글 링크 — 공개되지 않은 대상은 풀리고 경고가 섭니다')
}

/* ── 내린 글의 구운 페이지가 정말 지워지는가 ────────────────────────────
   위 검사는 「이번에 무엇을 굽는가」만 봅니다. 지난번에 구워 디스크에 남은 것은 못 봅니다 — 글을 숨긴 뒤에도
   `/blog/<번호>/peek/` 가 살아 있으면 숨긴 글의 본문이 그대로 읽힙니다. 굽기가 쓰는 그 함수를 직접 부릅니다 */
{
  const dir = join(TMP, 'sweep')
  for (const s of ['hidden', 'orphan', 'alive']) {
    await put(join(dir, s, 'index.html'), 'x'); await put(join(dir, s, 'peek/index.html'), 'x'); await put(join(dir, s, 'photo.webp'), 'x')
  }
  await sweepUnpublished(dir, new Map([['hidden', false], ['orphan', true], ['alive', true]]), new Set(['orphan']))
  const has = (rel) => existsSync(join(dir, rel))
  const bad = []
  for (const s of ['hidden', 'orphan']) {
    if (has(`${s}/index.html`)) bad.push(`${s}: index.html 이 남았습니다`)
    if (has(`${s}/peek/index.html`)) bad.push(`${s}: peek/index.html 이 남았습니다 — 내린 글의 본문이 계속 읽힙니다`)
    if (!has(`${s}/photo.webp`)) bad.push(`${s}: 올린 사진까지 지웠습니다`)
  }
  if (!has('alive/index.html') || !has('alive/peek/index.html')) bad.push('alive: 공개 중인 글의 페이지를 지웠습니다')
  if (bad.length) fails.push(`내린 글 치우기가 틀렸습니다\n${bad.map((x) => `    ${x}`).join('\n')}`)
  else console.log('내린 글 — index.html 과 peek/ 가 함께 지워지고 사진은 남습니다')
}

await rm(TMP, { recursive: true, force: true })

if (UPDATE) {
  console.log(`기준 파일을 갱신했습니다 — ${pass}벌`)
  process.exit(0)
}

console.log(`굽기 골든 — ${pass}/${CASES.length}벌 통과`)
if (fails.length) {
  console.log('')
  for (const f of fails) console.log(`  ${f}`)
  console.log(`\n${fails.length}벌이 기준과 다릅니다.`)
  console.log('HTML 이 바뀌어야 정상인 변경이라면 diff 를 확인한 뒤 --update 로 갱신하세요.')
  process.exit(1)
}
