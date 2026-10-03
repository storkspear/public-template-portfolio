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

const { bakePages, blogPages, listPage, postPage, themeStyle, headStyle, SITE_DEFAULTS } = await import('../server/bake.mjs')
const { DUMMY_POSTS } = await import('../server/dummy.mjs')
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

/* ── 블로그 면에 JS 가 한 바이트도 안 섞였는가 ────────────────────────
   글 페이지가 JS 를 0바이트로 나가는 것은 이 사이트의 약속입니다 — 코드 색칠도 문단 바로가기도
   스크롤 추적도 전부 굽기나 CSS 가 합니다. 그런데 약속은 주석에만 적혀 있었습니다.
   `<script>` 한 줄을 어디선가 템플릿에 넣어도 골든은 그걸 「바뀐 HTML」로만 보고,
   `--update` 한 번이면 조용히 기준이 됩니다. 그래서 따로 셉니다 — 굽힌 적 없는 수입니다. */
{
  const jsIn = []
  let 센면 = 0
  for (const [name, files] of baked) {
    for (const [rel, html] of files) {
      if (!rel.startsWith('blog/')) continue
      센면++
      const n = (html.match(/<script\b/gi) || []).length
      if (n) jsIn.push(`${name}/${rel} — <script> ${n}개`)
    }
  }
  if (!센면) fails.push('블로그 면을 한 장도 못 찾았습니다 — JS 검사가 죽었습니다')
  else if (jsIn.length) fails.push(`블로그 면에 JS 가 들어갔습니다\n${jsIn.map((x) => `    ${x}`).join('\n')}`)
  else console.log(`블로그 면 ${센면}장 — <script> 0개`)
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
