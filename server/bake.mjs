/**
 * 발행된 글과 작업물을 정적 HTML 로 굽습니다.
 * 출력은 레포 밖(BLOG_DIR, PAGES_DIR)입니다 — 배포가 git pull 이라 추적 중인 파일을 서버에서
 * 고치면 다음 pull 이 충돌로 막힙니다. nginx 가 /blog/ 를 그 폴더로 돌려놨습니다.
 * 본문의 attachment://{id} 는 src·href 속성값일 때만 /uploads/{id} 로 바꿉니다.
 */
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { configureFonts, FONT_VALUES } from './vendor/post-editor-core/vocab.js'
import { SITE_FONTS } from '../site.fonts.mjs'

/**
 * 레포 글꼴을 편집기 라이브러리에 등록. import 바로 다음에 한 번 불러야 합니다.
 * 안 부르면 title.js 의 FONT_VALUES.includes() 가 모르는 글꼴을 null 로 지웁니다.
 * 편집기에서 고른 제목 글꼴이 발행하면 기본 서체로 떨어지는데, 에러가 없어서 못 알아챕니다.
 */
configureFonts({ extra: SITE_FONTS })
import { existsSync, readFileSync } from 'node:fs'
import { renderPostHead, normalizeTitle } from './vendor/post-editor-core/title.js'
import { configureAttachments } from './vendor/post-editor-core/attachments.js'
import { toPublishedHtml } from './vendor/post-editor-core/serialize.js'
import site from '../site.config.mjs'
import { pgSsl } from './local.mjs'
import { BUILTIN_FAVICON, DEFAULTS, inkOn, ITEM_LINKS, ITEM_SIZES, KEYS, NAV_LINKS, SHOT_KNOBS, SHOT_MAX, isExternal, mainStart, mutedOn, normalize, PAGE_SAMPLES, PAGE_SOURCE_MINE,
  ICON_OF, OUTLINE_SKINS, SERVICE_ICONS } from '../shared/site-vocab.mjs'
import { MENU_ICON_OF } from '../shared/menu-icons.mjs'
import { ymd } from '../shared/text.mjs'
import { TAG, esc, summarize, unesc } from './html-text.mjs'
import { nested, okSlug, realOf, unsafeBit, writeAtomic } from './bake-safety.mjs'
import { emitOmit, fontStack, headVars, knobVars, lhVars, menuVars, outlineVars, pageFontVars, themeVars }
  from '../shared/site-css.mjs'
import { DUMMY_POSTS, DUMMY_WORKS } from './dummy.mjs'

/**
 * 첨부 id → 파일 주소 표. 글마다 내용이 달라서 글 하나 굽기 직전에 seedAttachments 가 갈아끼웁니다.
 *
 * 파일은 uploads/{글번호}/ 로 흩어져 있고, 어느 id 가 어디 있는지는 post_attachments.file_path
 * 에만 있습니다. id 에 경로를 안 박는 건 저장소를 옮기면 지난 글을 전부 고쳐야 하기 때문.
 */
let current = new Map()
configureAttachments({ resolve: (id) => current.get(id) ?? null })

const OUT = process.env.BLOG_DIR || (() => { throw new Error('.env 에 BLOG_DIR 이 없습니다') })()

/**
 * site.css?v= 에 붙는 캐시 버스터. public/assets 의 CSS 중 가장 늦게 바뀐 mtime 을 씁니다.
 * 부팅 시각을 쓰면 안 됩니다 — public/ 은 마운트라 CSS 를 고치면 바로 서빙되는데 구운 HTML 은
 * 옛 토큰을 들고 있어 immutable 캐시에 막히고, CSS 고칠 때마다 api 를 재시작해야 합니다.
 * 폴더가 없으면(굽기만 떼어 쓸 때) 부팅 시각으로 폴백합니다.
 */
const CSS_DIR = new URL('../public/assets/', import.meta.url).pathname
const BOOT = Date.now()
/* 시간 기반 캐시 금지. 0.5초만 들고 있어도 그 틈에 고친 CSS 가 옛 토큰으로 구워집니다.
   폴더 항목이 41개(글꼴은 public/fonts/ 에 따로)라 한 바퀴 0.27ms, 아낄 값이 아닙니다.
   mtimeMs 가 소수라 내림합니다. 안 그러면 36진수에 점이 섞입니다. */
const readAssetVersion = () => {
  try {
    let last = 0
    for (const e of readdirSync(CSS_DIR, { recursive: true, withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.css')) continue
      const m = statSync(join(e.parentPath || e.path, e.name)).mtimeMs
      if (m > last) last = m
    }
    return (Math.floor(last) || BOOT).toString(36)
  } catch { return BOOT.toString(36) }
}

/**
 * 한 번 생성하는 동안만 기억합니다. 한 페이지에 여섯 번, 한 바퀴에 스무 번 가까이 불리는데
 * 매번 폴더를 훑을 이유가 없습니다.
 *
 * 시간 기반 캐시는 안 됩니다. 0.5초만 들고 있어도 그 틈에 고친 CSS 가 옛 토큰으로 생성됩니다.
 * 생성이 시작될 때 resetAssetVersion() 으로 버리므로, 다음 생성은 반드시 다시 읽습니다.
 */
let assetVersionToken = null
const assetVersion = () => (assetVersionToken ??= readAssetVersion())
const resetAssetVersion = () => { assetVersionToken = null }

/**
 * fonts.local.css 에 선언된 글꼴 이름들. 화면은 기본적으로 이 시트만 싣습니다.
 *
 * 글꼴 피커는 편집기 라이브러리 글꼴(fonts.css)까지 보여줍니다. 그쪽을 고르면 값은 저장되는데
 * @font-face 가 없어서 기본 서체로 떨어집니다. 그래서 고른 글꼴이 여기 없을 때만 60KB 시트를 더 싣습니다.
 */
const sheetFonts = (file) => {
  try {
    const css = readFileSync(new URL(`../public/assets/${file}`, import.meta.url), 'utf8')
    return new Set([...css.matchAll(/font-family:\s*['"]?([^'";]+?)['"]?\s*;/g)].map((m) => m[1].trim()))
  } catch { return new Set() }
}
const LOCAL_FONTS = sheetFonts('fonts.local.css')

/**
 * site.css 가 제 이름으로 부르는 글꼴 중, 아직 안 실린 것.
 *
 * 아래 fontSheet 는 **관리자에서 고른 글꼴만** 보고 판정했습니다. 그런데 site.css 의 :root 는
 * 피커를 안 지나는 글꼴을 따로 부릅니다 — `--mono` 가 부르는 'JetBrains Mono' 가 그렇습니다. 고른 것이
 * 전부 레포 시트에 있으면 라이브러리 시트가 빠지고, 그 순간 번호·날짜·꼬리표가 시스템 고정폭으로
 * 조용히 떨어집니다(storkspear 에서 실제로 났습니다). 그래서 판정에 함께 넣습니다.
 *
 * 두 갈래를 봅니다. `--display`/`--sans`/`--mono` 는 스택의 **맨 앞 한 이름**만 — 뒤는 시스템
 * 대체본입니다. 그리고 본문에서 따옴표로 직접 부르는 이름(`font-family: 'Nanum Pen Script', …`)도
 * 같은 처지라 함께 셉니다. 둘 다 라이브러리 시트가 실제로 들고 있는 것만 남깁니다 —
 * Georgia 처럼 어느 시트에도 없는 이름은 웹글꼴이 아니라 대체본이라 시트를 부를 이유가 없습니다
 * (없는 이름 자체는 tools/check-fonts.mjs 가 잡습니다).
 *
 * 글 상세는 여기 안 걸립니다 — 그 화면은 fonts.css 를 조건 없이 싣습니다.
 * 판정이 맞는지는 tools/check-fonts.mjs 가 이 모듈의 fontSheet 를 불러 확인합니다.
 */
const CSS_WEBFONTS = (() => {
  const inLibrary = sheetFonts('fonts.css')
  try {
    const css = readFileSync(new URL('../public/assets/site.css', import.meta.url), 'utf8')
    const out = new Set()
    const add = (name) => { if (inLibrary.has(name)) out.add(name) }
    /* 찾는 변수 이름을 이어 붙여 만듭니다. 정규식에 그 이름을 콜론까지 붙여 적으면
       tools/check-contract.mjs 가 「굽기가 CSS 변수를 만든다」로 읽습니다 — 읽기만 하는데도 */
    const rootVars = new RegExp(`--(?:${['display', 'sans', 'mono'].join('|')})\\s*:\\s*([^;]+);`, 'g')
    for (const [, stack] of css.matchAll(rootVars)) {
      add(stack.split(',')[0].trim().replace(/^['"]|['"]$/g, ''))
    }
    for (const [, name] of css.matchAll(/font-family:[^;}]*?'([^']+)'/g)) add(name)
    return [...out]
  } catch { return [] }
})()

/**
 * 고른 글꼴이나 site.css 가 부르는 글꼴 중 하나라도 레포 시트에 없으면 라이브러리 시트를 냅니다.
 * `tools/check-fonts.mjs` 가 이 함수를 그대로 불러 판정을 검사하므로 export 합니다 —
 * 검사가 같은 규칙을 따로 베껴 쓰면 굽기만 고장 나도 초록이 나옵니다.
 */
export const fontSheet = (...names) => ([...names, ...CSS_WEBFONTS].some((n) => n && !LOCAL_FONTS.has(n))
  ? `<link rel="stylesheet" href="/assets/fonts.css?v=${assetVersion()}">\n` : '')

/**
 * 홈·작업 목록·작업 상세가 나가는 폴더. 블로그 폴더와 달라야 합니다.
 *
 * 블로그 폴더에는 업로드한 사진 원본이 같이 있습니다. 이쪽은 전부 다시 만들 수 있는 것만 있어서
 * 통째로 덮어써도 됩니다. 두 값이 같으면 화면 굽기가 사진을 지우니까 부팅을 막습니다.
 */
const PAGES = process.env.PAGES_DIR || join(dirname(OUT), 'www')

{
  const a = realOf(PAGES)
  const b = realOf(OUT)
  if (nested(a, b)) {
    throw new Error(`PAGES_DIR(${a}) 과 BLOG_DIR(${b}) 이 같은 자리입니다 — 화면 굽기가 사진을 지웁니다`)
  }
}

/**
 * 미리보기 안의 절대 링크를 /preview/ 아래로 다시 붙입니다. 안 붙이면 구운 화면의
 * <a href="/portfolio/"> 를 누를 때 관리자 오리진으로 이동해 iframe 안에 관리자가 뜹니다.
 * <a href> 만 바꿉니다 — stylesheet 와 img src 는 실제 자리를 봐야 합니다(미리보기가 CSS·사진을
 * 따로 갖고 있지 않습니다). base 를 받는 것은 미리보기가 real·dummy 두 벌이기 때문입니다.
 */
const previewLinks = (html, base = '/preview') =>
  String(html).replace(/(<a\b[^>]*?\shref\s*=\s*)(["'])\/(?!\/|preview(?:[\/?#"']|$))/gi, `$1$2${base}/`)

/* 속성값 자리만 바꿉니다. 표에 없는 id 는 참조를 그대로 남깁니다.
   빈 src 로 두면 브라우저가 현재 페이지를 한 번 더 받습니다. */
const resolveAttachments = (html) =>
  String(html || '').replace(
    /(\ssrc=)(["'])attachment:\/\/([^"']+)\2/g,
    (all, lead, q, id) => (current.has(id) ? `${lead}${q}${current.get(id)}${q}` : all),
  )

/**
 * 공통 헤더. 관리자 「공통」 탭에서 정하고, 어느 화면이 싣는지는 화면별 chrome 이 정합니다
 * (메인은 기본으로 안 싣습니다).
 * 드로어는 JS 없이 동작합니다 — 숨은 checkbox 하나 + 그걸 가리키는 label 둘로 여닫습니다.
 * 드로어 패널은 <header> 밖에 둬야 합니다: .s-head 에 backdrop-filter 가 걸려 있어 그 안의
 * position:fixed 는 뷰포트가 아니라 헤더 띠를 기준으로 잘립니다.
 */
const headerHtml = (h, navAll, brand) => {
  /* 관리자에서 바꾼 라벨·표시 여부를 입힙니다. href 로 짝을 짓습니다.
     짝이 없는 항목(site.config.mjs 에 직접 적은 외부 링크 등)은 그대로 둡니다.
     관리자에서 손댈 수 없는 걸 굽기가 지우면 안 됩니다. */
  const byHref = { '/portfolio/': 'portfolio', '/blog/': 'blog' }
  const nav = navAll.flatMap((n) => {
    const l = h.links?.[byHref[n.href]]
    if (!l) return [n]
    return l.show ? [{ ...n, label: l.label || n.label, icon: l.icon }] : []
  })
  /* 관리자에서 ↑↓ 로 정한 순서를 적용. 짝이 있는 것끼리만 자리를 바꿉니다.
     짝 없는 항목은 위와 같은 이유로 제자리에 고정. 자리를 훑으며 옮길 수 있는 것만
     차례로 끼워넣으니 고정 항목 위치는 안 흔들립니다. */
  const ordered = (() => {
    const movable = nav.filter((n) => byHref[n.href])
      .sort((p, q) => (h.links[byHref[p.href]].order ?? 0) - (h.links[byHref[q.href]].order ?? 0))
    let k = 0
    return nav.map((n) => (byHref[n.href] ? movable[k++] : n))
  })()
  const drawer = h.menu === 'sidebar'
  /* rail 은 늘 펼쳐져 있어서 여는 버튼이 필요 없습니다 */
  const burger = drawer && h.sidebar.kind !== 'rail'
  /**
   * 메뉴 아이콘. 드로어 icon 스타일일 때만 냅니다. 늘 넣고 CSS 로 숨기면 안 쓰는 화면까지
   * path 를 싣습니다. 스타일이 바뀌면 클래스가 바뀌어 어차피 다시 구우니 그때만 내면 됩니다.
   *
   * 색·선굵기는 여기서 씌우고 shared/menu-icons.mjs 는 path 만 들고 있습니다. currentColor 라
   * 메뉴 글자색과 hover 가 그대로 적용됩니다. 옆에 같은 뜻의 글자가 있으니 aria-hidden 으로 숨깁니다.
   */
  const iconSvg = (v) => {
    const body = MENU_ICON_OF[v]
    if (!body) return ''
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"` +
           ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  }
  const withIcon = drawer && h.drawer.style === 'icon'
  const a = (n) => `<a href="${esc(n.href)}"${n.current ? ` aria-current="${esc(n.current)}"` : ''}` +
                   `${n.external ? ' rel="me noopener" target="_blank"' : ''}>` +
                   `${withIcon ? iconSvg(n.icon) : ''}${esc(n.label)}</a>`
  /* 사이트 이름 자리. 글·작업 상세에서는 부르는 쪽이 「← 목록」 링크를 넘겨 이 자리를 대신합니다 */
  const name = brand || `<a class="s-name" href="/">${esc(h.title || site.brand)}</a>`
  /**
   * 드로어 토글은 진짜 checkbox 입니다. hidden 이 아니라 눈에만 안 보이게 숨깁니다 — hidden 이면
   * 포커스를 못 받아 키보드로 열 방법이 없고, 닫힌 드로어의 링크가 화면 밖에서 Tab 을 먼저
   * 가져갑니다. checkbox 면 Space 로 열리고 스크린리더가 열림 상태를 읽어 줍니다.
   * label(햄버거·닫기·스크림)은 마우스용이라 aria-hidden 으로 뺍니다(안 그러면 두 번 읽습니다).
   * autocomplete=off 는 뒤로 왔을 때 열린 채 복원되는 것을 줄입니다. rail 은 늘 열려 토글이 없습니다.
   */
  const toggle = burger ? `<input class="s-toggle" type="checkbox" id="site-menu" autocomplete="off" aria-label="메뉴">
<label class="s-scrim" for="site-menu" aria-hidden="true"></label>
` : ''
  const drawerPart = drawer ? `${toggle}<nav class="s-drawer s-drawer-${esc(h.sidebar.kind)} s-item-${esc(h.drawer.style)}" aria-label="메뉴">
${burger ? '  <label class="s-x" for="site-menu" aria-hidden="true"></label>\n' : ''}${ordered.map((n) => '  ' + a(n)).join('\n')}
</nav>
` : ''
  const navPart = drawer ? '' : `    <nav class="s-nav s-nav-${esc(h.nav.style)}">
${ordered.map((n) => '      ' + a(n)).join('\n')}
    </nav>
`
  const burgerPart = burger
    ? '    <label class="s-burger" for="site-menu" aria-hidden="true"><span></span></label>\n' : ''
  /* 햄버거 칸은 햄버거가 있을 때만 그리드에 더합니다. 없는데 칸을 두면 빈 칸이 남아서
     사이트 이름이 본문 왼쪽 선보다 안으로 밀립니다 */
  return `${drawerPart}<header class="s-head s-at-${esc(h.align)} s-w-${esc(h.width)}${burger ? ' s-head-drawer' : ''}">
  <div class="wrap">
${burgerPart}    ${name}
${navPart}  </div>
</header>`
}

/**
 * 공통헤더의 수치 — 값만 갈아 끼우면 모양이 바뀝니다(관리자에서 즉시 반영).
 * 색은 정했을 때만 냅니다. 비어 있으면 변수를 아예 안 만들어야 CSS 의 대체값(본문 테마 색)이
 * 삽니다 — `--hd-bg: ;` 처럼 빈 값을 내면 대체값도 안 먹고 배경이 사라집니다.
 * 글꼴은 늘 냅니다: 화면별 본문 글꼴이 바뀌어도 공통헤더는 한 서체여야 공통입니다.
 */
/**
 * 헤더가 쓰는 CSS 변수. 값 계산은 shared/site-css.mjs 가 하고 여기서는 style 태그로 감쌉니다.
 * --body-w 를 여기에도 냅니다 — code 모드 화면은 themeStyle 을 받지 않는데(pageStyle 참고)
 * 거기서 공통 헤더를 켜면 그 헤더는 생성기가 렌더링한 것이라 사이트 본문 폭을 따라야 합니다.
 */
export const headStyle = (h, theme) => `<style data-head>
:root {
${emitOmit([...headVars(h, theme), ...menuVars(h)])}}
</style>
`

/** 화면별 글꼴. 지정한 것만 덮습니다. 비우면 사이트 기본값(themeStyle)이 그대로 쓰입니다 */
const pageFontStyle = (font) => {
  const vars = pageFontVars(font)
  return vars.length ? `<style data-font>
:root {
${emitOmit(vars)}}
</style>
` : ''
}

/**
 * 「카드」 갈래의 선 색·배경·모서리.
 *
 * **그 갈래일 때만** 냅니다. 다른 갈래를 고른 사이트에 이 블록이 실리면, 읽는 CSS 도 없는
 * 변수 때문에 목록 HTML 이 갈래마다 달라집니다.
 *
 * 하나도 안 고쳤으면 블록 자체를 안 냅니다 — `pageFontStyle` 과 같은 규약입니다.
 * 껍데기만 내면 골든 쉰네 벌이 이유 없이 흔들립니다.
 */
const outlineStyle = (blog) => {
  if (blog.template !== 'outline') return ''
  const vars = emitOmit(outlineVars(blog.outline))
  return vars ? `<style data-outline>
:root {
${vars}}
</style>
` : ''
}

/**
 * 고른 테마를 목록에 클래스로 답니다. 기본 테마면 아무것도 안 답니다 —
 * 지금까지의 HTML 과 한 바이트도 달라지지 않아야 합니다.
 */
const skinCls = (blog) =>
  (blog.template === 'outline' && blog.outline.skin !== OUTLINE_SKINS[0].value
    ? ` bo-${esc(blog.outline.skin)}` : '')

/** 목록 제목(.lh)의 모양. 블로그와 포트폴리오가 값을 따로 갖습니다 */
const lhStyle = (head) => `<style data-lh>
:root {
${emitOmit(lhVars(head))}}
</style>
`

/**
 * 브라우저 탭에 뜨는 이름. 관리자의 「설정 → 사이트 명」이 있으면 그것, 비었으면
 * site.config.mjs 의 값입니다(공통헤더 제목과 같은 규약 — 없음과 빈 값이 같은 뜻입니다).
 *
 * 한 칸이 다섯 화면을 다 정합니다. 지금까지는 `siteTitle`(블로그 목록·글 상세·작업 상세)과
 * `home.title`(메인)·`works.title`(포트폴리오 목록) 셋이 나눠 맡았습니다. 관리자에 칸이 생긴
 * 이상 그 칸을 고쳤는데 탭 이름이 반만 바뀌면 고친 사람은 결함으로 읽습니다.
 *
 * OG 제목은 안 건드립니다 — 공유 카드의 제목은 탭 이름과 다르게 쓰는 자리라
 * site.config.mjs 에 `ogTitle` 이 따로 있습니다.
 */
const siteName = (conf, fallback) => conf?.site?.title || fallback

/**
 * `<link rel="icon">` 에 넣을 주소.
 *
 * 색을 안 고르면 파일 주소 그대로입니다 — 기본 파비콘은 제 안에 `prefers-color-scheme` 을
 * 갖고 있어 밝은 탭에서 검정, 어두운 탭에서 흰색으로 저절로 뒤집힙니다.
 *
 * 색을 골랐으면 그 자리에서 색을 입혀 **data: 주소**로 넣습니다. 파일을 새로 굽지 않는 까닭:
 *   · `public/` 은 git 이 들고 있고 배포가 `git pull` 이라, 굽기가 거기 쓰면 다음 배포가 막힙니다
 *   · `PAGES_DIR` 에 쓰면 nginx 에 `/favicon.svg` 덮어쓰기 자리를 새로 파야 합니다(설정 두 벌)
 *   · 색까지 고른 사람에게만 붙고, 붙어 봐야 한 화면에 600바이트 남짓입니다
 * 색을 고르면 자동 뒤집기는 버립니다 — 색을 정한 사람이 원한 것은 그 색입니다.
 *
 * 올린 파일에는 색을 안 입힙니다. 그 파일은 올린 사람이 그린 것이고, 우리가 아는 규약
 * (`.s` 클래스와 `#0b0d10`)을 따를 이유가 없습니다.
 */
const faviconHref = (set) => {
  const v = `?v=${assetVersion()}`
  /* 비어 있음 = 「안 골랐다」이고, 안 골랐으면 이 사이트의 기본 아이콘입니다.
     그것도 없으면(config 에 안 적었거나 이름이 틀렸으면) 레포 파일로 떨어집니다 */
  const at = set?.favicon || faviconOfConfig() || '/favicon.svg'
  const bgRect = (w, h, fill) =>
    `<rect x="0" y="0" width="${w}" height="${h}" rx="${(w * 0.22).toFixed(2)}" fill="${fill}"/>`
  const hit = BUILTIN_FAVICON.exec(at)
  /* 색은 레포가 가진 그림에만 입힙니다 — 기본으로 주는 것들과 `public/favicon.svg` 입니다.
     올린 파일은 올린 사람이 그린 것이고 우리 규약(`.s` 와 `#0b0d10`)을 따를 이유가 없습니다 */
  const own = hit ? `assets/favicons/${hit[1]}.svg` : at === '/favicon.svg' ? 'favicon.svg' : null
  const bg = set?.faviconBg || ''
  /* 바탕을 깔면 그림색도 정해집니다 — 안 고르면 그 바탕에서 잘 보이는 쪽(검정/흰색) */
  const ink = set?.faviconColor || (bg ? inkOn(bg) : '')
  if (!own || (!ink && !bg)) return at + v
  let svg
  try {
    svg = readFileSync(new URL(`../public/${own}`, import.meta.url), 'utf8')
  } catch { return at + v }
  /* 격자 크기는 파일마다 다릅니다 — 손으로 그린 둘은 64, Lucide 에서 온 것들은 24 */
  const box = (svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || [, '24', '24']).slice(1).map(Number)
  const [w, h] = box
  let painted = svg
    /* 주석은 레포 안에서만 쓸모가 있습니다 — 주소에 실어 보낼 이유가 없습니다 */
    .replace(/<!--[\s\S]*?-->/g, '')
    /* 색을 정했으므로 어두운 탭에서 뒤집는 규칙은 뺍니다 */
    .replace(/@media \(prefers-color-scheme: dark\)[^{]*\{[^{}]*\{[^{}]*\}[^{}]*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  if (ink) painted = painted.replaceAll('#0b0d10', ink)
  if (bg) {
    /**
     * 바탕을 그림 **뒤에** 깝니다. `</style>` 바로 뒤가 첫 자식 자리입니다.
     *
     * 그림은 조금 줄입니다 — 바탕 끝까지 꽉 찬 그림은 탭에서 테두리에 물려 답답합니다.
     * 남의 사이트 파비콘이 대개 여백을 두는 까닭이고, 0.62 는 그 관습에 맞춘 값입니다.
     * 가운데를 축으로 줄여야 그림이 한쪽으로 쏠리지 않습니다.
     */
    const c = [(w / 2).toFixed(2), (h / 2).toFixed(2)]
    painted = painted
      .replace('</style>', `</style>${bgRect(w, h, bg)}`)
      .replace('<g class="s"', `<g class="s" transform="translate(${c[0]} ${c[1]}) scale(.62) translate(-${c[0]} -${c[1]})"`)
  }
  painted = painted.replace(/\s+/g, ' ').trim()
  /* `#` 을 안 바꾸면 주소가 거기서 끊깁니다(조각 식별자). 나머지는 그대로 둬야 짧습니다 */
  return `data:image/svg+xml,${encodeURIComponent(painted)}`
}

/**
 * site.config.mjs 의 `favicon` 이름을 주소로. 목록 밖의 이름이면 정규화가 걸러 빈 값이 되고,
 * 그때는 `public/favicon.svg` 로 떨어집니다 — 이름을 잘못 적어도 아이콘이 사라지지는 않습니다.
 */
const faviconOfConfig = () => (site.favicon ? `/assets/favicons/${site.favicon}.svg` : '')

/** shell 에 넘길 모양. 형식은 주소가 정합니다 — `type` 이 틀리면 브라우저가 아이콘을 버립니다 */
const faviconOf = (set) => {
  const href = faviconHref(set)
  const type = /\.png(\?|$)/.test(href) ? 'image/png'
    : /\.webp(\?|$)/.test(href) ? 'image/webp' : 'image/svg+xml'
  return { href, type }
}

const shell = ({
  title, description, canonical, head = '',
  /* 비우면 사이트 이름. 글·작업 상세는 「← 목록」 링크를 넘겨 이 자리를 대신합니다.
     null 로 둬야 헤더 설정의 제목이 쓰입니다 */
  brand = null,
  /* 헤더 메뉴 항목. 지금 화면에 aria-current 가 붙어야 해서 화면마다 다릅니다.
     navFor() 가 만듭니다 (page = 이 페이지, true = 이 페이지가 속한 섹션) */
  nav = navFor(null),
  /* 푸터 세 종류. pages = 다 읽고 난 자리(글·작업), main = 연락이 목적지인 홈,
     none = HTML 이 제 푸터를 갖고 있는 code 모드 화면. 모양은 footer 설정이 정합니다 */
  foot = 'pages',
  footer = DEFAULTS.footer,
  /* 푸터의 흐린 글자·선 색을 mutedOn 으로 계산할 때 쓰는 기준 색 */
  colors = DEFAULTS.theme,
  /* 색·글꼴이 들어가는 자리. </head> 직전이어야 prose.css 를 순서로 이깁니다 */
  theme = '',
  /**
   * 헤더의 모양. 안 넘기면 사이트 이름 + site.nav 로 된 기본 헤더가 출력됩니다.
   * 이 값은 어느 화면에 헤더가 붙는지는 안 정합니다 — 그건 `chrome` 이 합니다.
   */
  header = null,
  /* 공통 헤더를 포함할지. 끄면 헤더가 한 줄도 출력되지 않습니다.
     메인처럼 본문이 제 머리를 직접 갖는 화면용(main.chrome) */
  chrome = true,
  /* 파비콘. `faviconHref()` 가 만든 { href, type } 입니다. 안 넘기면 레포의 public/favicon.svg —
     받은 사람이 그 파일만 갈아 끼우던 길(README)이 그대로 삽니다 */
  favicon = faviconOf(null),
  body,
}) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="stylesheet" href="/assets/site.css?v=${assetVersion()}">
<link rel="icon" href="${esc(favicon.href)}" type="${favicon.type}">
${head}${theme}</head>
<body>

${!chrome ? '' : header ? headerHtml(header, nav, brand) : `<header class="s-head">
  <div class="wrap">
    ${brand || `<a class="s-name" href="/">${esc(site.brand)}</a>`}
    <nav class="s-nav">
${nav.map((n) => `      <a href="${esc(n.href)}"${n.current ? ` aria-current="${esc(n.current)}"` : ''}${n.external ? ' rel="me noopener" target="_blank"' : ''}>${esc(n.label)}</a>`).join('\n')}
    </nav>
  </div>
</header>`}

${body}

${foot === 'none' ? '' : footHtml(footer?.[foot], foot, colors)}

</body>
</html>
`

/**
 * 목록 제목 — 「글 / 5편」, 「작업 / 9편」. 블로그와 포트폴리오가 같은 컴포넌트를 씁니다.
 * 설정 모양도 같습니다(blog.head / portfolio.head): 이름·표시·크기·정렬·편수. 같은 자리에
 * 같은 모양으로 서는 것이라 설정이 갈리면 두 목록이 달라집니다.
 * 숨기면 아무것도 렌더링하지 않습니다 — 맨 위부터 내용이 차야 숨긴 뜻이 있습니다.
 */
const listHead = (head, count) => head.show ? `  <div class="lh">
    <h1>${esc(head.name)}</h1>
${head.count && count ? `    <p class="lh-count">${count}편</p>\n` : ''}  </div>
` : ''

/**
 * header.css 를 실을지. 굽기가 헤더를 렌더링할 때만 싣습니다.
 * 제 헤더를 직접 가진 화면(code 모드 + 공통 헤더 끔)에 실으면 .s-head > .wrap 이 그리드로
 * 덮여 손으로 맞춘 한 줄이 무너집니다(s-at-* 정렬 칸이 없어 요소가 왼쪽으로 몰립니다).
 * template 모드는 헤더를 껐어도 싣습니다 — 목록 제목(.lh) CSS 가 같은 파일에 있습니다.
 */
const headerCss = (chrome, mode) =>
  chrome || mode === 'template' ? `<link rel="stylesheet" href="/assets/templates/header.css?v=${assetVersion()}">\n` : ''

/**
 * 이 HTML 이 제 헤더를 갖고 있나. 태그가 있냐가 아니라 어디 있냐로 봅니다.
 * <header> 는 문단 머리에도 쓰는 일반 태그입니다 — 메인 쪽 HTML 은 <main> 안에
 * <header class="m-id">(이름·역할)를 갖는데 그건 화면 내용입니다.
 * 헤더는 본문보다 위에 표시되므로, 첫 <main 보다 앞에 <header 가 있을 때만 true 입니다.
 * <main> 이 없으면 전부가 본문이라 그 안의 <header> 도 헤더로 봅니다.
 */
const ownsHeader = (src) => {
  const head = src.search(/<header[\s>]/i)
  if (head < 0) return false
  const main = src.search(/<main[\s>]/i)
  return main < 0 || head < main
}

/** 「공통 → 메뉴」에서 숨긴 항목의 주소. 아무것도 안 숨겼으면 빈 배열입니다 */
const hiddenNavHrefs = (header) =>
  NAV_LINKS.filter((l) => header?.links?.[l.key] && !header.links[l.key].show).map((l) => l.href)

/**
 * 숨긴 주소를 가리키는 <a> 의 **여는 태그** 정규식 조각.
 * 끝 빗금은 있어도 없어도 같은 곳이라 `/?` 로 받습니다(`/blog` 와 `/blog/`).
 */
const navAnchor = (hrefs) => {
  const alt = hrefs
    .map((h) => h.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/?')
    .join('|')
  return `<a\\b[^>]*\\shref\\s*=\\s*(["'])(?:${alt})\\1[^>]*>`
}

/**
 * 조각(직접 디자인)의 메뉴에서 숨긴 링크를 걷어냅니다.
 *
 * 공통헤더는 숨김을 그대로 따릅니다(headerHtml 의 nav 필터). 그런데 직접 디자인 화면은
 * 헤더를 제 손으로 그리므로 그 필터가 닿지 않습니다. 블로그를 숨겨도 조각에 박아 둔
 * <a href="/blog/"> 가 그대로 나가, 다른 화면에서는 사라진 메뉴가 이 화면에만 남습니다.
 *
 * 걷어내는 자리는 <nav> 안쪽뿐입니다. 숨김은 **메뉴에서 뺀다**이지 화면을 없앤다가 아니고
 * (/blog/ 는 계속 구워집니다), 본문에 쓴 「스튜디오 노트 보기」 같은 링크까지 지우면
 * 쓴 사람이 세운 글을 굽기가 무너뜨리는 셈이 됩니다. 메뉴를 <nav> 로 감싸는 것은
 * 이 레포 조각들의 규약입니다(`s-nav` · `m-links` · `m5-links`).
 *
 * <li> 하나에 링크 하나만 있던 자리는 빈 <li> 가 남으므로 같이 지웁니다. <nav> 가 통째로
 * 비면 그 <nav> 도 지웁니다 — 안 그러면 flex 간격만 남은 빈 띠가 섭니다.
 */
const dropHiddenNav = (html, hrefs) => {
  if (!hrefs.length || !html) return html
  const anchor = new RegExp(`${navAnchor(hrefs)}[\\s\\S]*?<\\/a>`, 'gi')
  return html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, (block) => {
    const open = block.slice(0, block.indexOf('>') + 1)
    const body = block.slice(open.length, -'</nav>'.length)
    const left = body.replace(anchor, '').replace(/<li\b[^>]*>\s*<\/li>/gi, '')
    return left.trim() ? `${open}${left}</nav>` : ''
  })
}

/**
 * 그 화면에 얹을 색·글꼴.
 * code 모드에는 테마를 안 넣습니다 — 코드로 꾸미는 사람은 색까지 직접 정하는데, 넣으면
 * site.css 에 골라둔 accent·제목 글꼴을 관리자 값이 조용히 덮습니다. 화면별 글꼴
 * (pageFontStyle)과 목록 제목도 같은 이유로 안 넣습니다(그 knob 들은 code 모드에서 잠깁니다).
 * --hd-* 는 남깁니다 — 그 헤더는 굽기가 출력한 것이라 관리자 값이 맞습니다.
 */
const pageStyle = (ctx, key, extra = '') => ctx[key].mode === 'code'
  ? (ctx[key].chrome ? headStyle(ctx.header, ctx.theme) : '')
  : ctx.style + pageFontStyle(ctx[key].font) + extra

const PAGES_SRC = new URL('../pages/', import.meta.url)
const SAMPLES_SRC = new URL('../sample-pages/', import.meta.url)

/**
 * 실제로 읽을 파일의 레포 기준 상대 경로. 경고 문구에 그대로 씁니다.
 *
 * source 는 정규화를 거쳐 오지만 여기서 PAGE_SAMPLES 와 한 번 더 맞춥니다. 값이 그대로
 * 파일 이름이 되는 자리라, 정규화를 건너뛴 호출이 하나라도 생기면 ../ 로 레포 밖을 읽습니다.
 * 목록에 없으면 pages/ 로 떨어집니다.
 */
const fragmentPath = (page, source) =>
  source !== PAGE_SOURCE_MINE && (PAGE_SAMPLES[page] || []).some((x) => x.value === source)
    ? { rel: `sample-pages/${source}.html`, url: new URL(`${source}.html`, SAMPLES_SRC) }
    : { rel: `pages/${page}.html`, url: new URL(`${page}.html`, PAGES_SRC) }

/**
 * code 모드 화면의 본문 HTML 을 읽어옵니다 — pages/<page>.html 아니면
 * sample-pages/<source>.html. 둘 다 읽기만 합니다.
 * 이 HTML 은 <body> 안쪽 전체입니다. 푸터도 여기 들어 있어 foot: 'none' 으로 굽고,
 * 헤더만 chrome 옵션에 따라 shell 이 위에 얹습니다.
 * 파일이 없으면 빈 문자열입니다(처음 쓰는 사람은 빈 화면에서 시작합니다). 단, 샘플을
 * 골랐는데 파일이 없으면 warn 에 담습니다.
 * script 태그 검사(unsafeBit)는 이 HTML 만 건너뜁니다 — 관리자로 들어온 남의 HTML 이 아니라
 * 레포 주인이 쓴 파일이라 script 가 정당합니다. 크기는 tools/check-public.mjs 가 잽니다.
 */
const readFragment = async (page, source = PAGE_SOURCE_MINE) => {
  const { rel, url } = fragmentPath(page, source)
  let missing = false
  const raw = (await readFile(url, 'utf8').catch(() => { missing = true; return '' })).trim()
  /* 파일 맨 앞의 주석 한 덩이는 그 파일의 설명서입니다(어디를 고치면 되는지). 레포 안에서만
     쓸모가 있으므로 화면으로는 안 내보냅니다 — 방문자에게 레포 구조를 알릴 이유가 없습니다.
     안쪽 주석은 그대로 둡니다: 글쓴이가 화면에 남기려고 쓴 것일 수 있습니다. */
  const html = raw.startsWith('<!--') ? raw.slice(raw.indexOf('-->') + 3).trimStart() : raw
  return { rel, html, missing }
}

/** 100편이면 `001`…`100` — 자릿수가 늘어도 번호 열이 안 흔들립니다 */
const digitsOf = (posts) => Math.max(2, String(posts.length).length)
const yearOf = (p) => new Date(p.published_at).getFullYear()
/**
 * 연도 라벨 — 목록이 두 해 이상에 걸칠 때만 넣습니다.
 * 한 해뿐인데 연도를 찍으면 정보가 아니라 장식이 됩니다.
 * 포트폴리오의 `.p-group` 과 같은 어휘입니다 — 라벨 밑에 다음 행의 윗선이 밑줄로 붙습니다.
 */
function yearLabels(posts, always = false) {
  /* 두 해에 걸치는지 한 번만 셉니다. 글마다 세면 목록 길이의 제곱이 됩니다 */
  if (!always && new Set(posts.map(yearOf)).size < 2) return posts.map(() => '')
  let prev = null
  return posts.map((p) => {
    const y = yearOf(p)
    if (y === prev) return ''
    prev = y
    return `    <li class="b-year"><span>${y}</span></li>\n`
  })
}

/** 연도 라벨을 갖는 갈래 — 줄 계열만(격자에서는 li 하나가 칸 하나라 라벨이 칸을 밉니다) */
const YEARED = new Set(['rows', 'ledger', 'lines', 'runin', 'feed'])

/**
 * 읽는 시간(분) — 한글은 분당 500자, 라틴은 분당 230단어. 코드 블록은 읽는 글이 아니라 뺍니다.
 * 공백까지 세면 영어 1000단어가 「10분」으로 나왔습니다. 최소 1분. 보일지는 갈래가 정합니다
 */
const readMinutes = (html) => {
  const text = unesc(String(html || '')
    .replace(new RegExp(`<pre${TAG}>[\\s\\S]*?</pre>`, 'gi'), ' ')
    .replace(new RegExp(`<${TAG}>`, 'g'), ' '))
  const hangul = (text.match(/[\u3131-\u318e\uac00-\ud7a3]/g) || []).length
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length
  return Math.max(1, Math.round(hangul / 500 + words / 230))
}

/** 날짜 조각 — 「16 / 9월」「2026년 9월 16일」처럼 CSS 가 다시 조립할 수 있게. `ymd` 와 같은 시간대. 숫자뿐이라 주입 통로가 없습니다 */
const dateAttrs = (d) => {
  const t = new Date(d)
  return ` data-y="${t.getFullYear()}" data-m="${t.getMonth() + 1}" data-d="${t.getDate()}"`
}

/**
 * 첫 문단 한 줄 — 없으면 칸 자체를 안 만듭니다.
 *
 * 빈 `<span>` 을 남기면 카드·썸네일에서 `margin-top` 만큼 여백이 생겨, 첫 문단이 있는 글과
 * 없는 글의 줄 높이가 달라집니다. 없으면 렌더링하지 않는 쪽이 목록을 고르게 만듭니다.
 */
const ledeOf = (p) => {
  const lede = summarize(p.body, 110)
  return lede ? `          <span class="b-lede">${esc(lede)}</span>\n` : ''
}

/**
 * 글 목록 — 열두 벌이 같은 마크업을 씁니다.
 * 줄마다 번호·대표 이미지·제목·날짜·첫 문단이 다 들어 있고, 무엇을 보여 줄지는 CSS 가
 * 정합니다(`blog.css` 의 `.bl-*`). 고른 값이 마크업을 안 건드리므로 관리자에서 만지는 즉시
 * 반영됩니다 — 포트폴리오와 같은 규약.
 * 연도 라벨은 리스트형 템플릿(YEARED)에서만 냅니다. 그리드형은 줄이 아니라 칸이라 자리가 없습니다.
 */
export const listPage = (posts, style, conf = DEFAULTS) => shell({
  theme: style + pageFontStyle(conf.blog.font) + lhStyle(conf.blog.head) + outlineStyle(conf.blog),
  footer: conf.footer, colors: conf.theme,
  header: conf.header,
  chrome: conf.blog.chrome,
  title: siteName(conf, site.siteTitle), favicon: faviconOf(conf.site),
  description: site.description,
  canonical: `${site.origin}/blog/`,
  nav: navFor('/blog/'),
  /* 목록도 글꼴 선언을 실어야 합니다. 제목 글꼴이 fonts.local.css 쪽이면 안 실은 목록은
     대체 글꼴로 렌더링되어 같은 제목의 서체가 목록과 글에서 달라집니다. */
  head: `<link rel="stylesheet" href="/assets/blog.css?v=${assetVersion()}">
<link rel="stylesheet" href="/assets/templates/blog.css?v=${assetVersion()}">
<link rel="stylesheet" href="/assets/templates/header.css?v=${assetVersion()}">
${fontSheet(conf.theme.display, conf.theme.body, conf.header?.font, conf.blog.font.display, conf.blog.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${assetVersion()}">\n`,
  /* 목록에 제 폭이 없습니다. .wrap 이 사이트 --body-w 를 그대로 따릅니다 */
  body: `<main class="wrap">

${listHead(conf.blog.head, posts.length)}
  <ul class="bl bl-${esc(conf.blog.template)}${skinCls(conf.blog)}">
${(() => { const ys = YEARED.has(conf.blog.template) ? yearLabels(posts, conf.blog.template === 'feed') : posts.map(() => '')
    return posts.map((p, i) => ys[i] + `    <li class="b-item">
      <a href="/blog/${encodeURIComponent(p.slug)}/">
        <span class="b-no">${String(i + 1).padStart(digitsOf(posts), '0')}</span>
        <span class="b-shot">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : ''}</span>
        <span class="b-body">
          <span class="b-title">${esc(p.title)}</span>
${ledeOf(p)}        </span>
        <span class="b-date"${dateAttrs(p.published_at)}>${ymd(p.published_at)}</span>
        <span class="b-read">${readMinutes(p.body)}분</span>
      </a>
    </li>`).join('\n') })()}
  </ul>
</main>`,
})

/**
 * 본문 HTML. 글과 작업 상세가 같은 함수를 씁니다.
 * toPublishedHtml 로 발행 시점 보정을 거쳐야 합니다 — 편집기의 getHTML() 을 그대로 쓰면
 * 표 래퍼와 코드 하이라이트가 누락되어 발행 페이지가 편집 화면과 다른 구조로 출력됩니다.
 * 첨부 표(current)는 이 문서를 렌더링하기 전에 깔려 있어야 합니다. 제목 배너도 그 표에서
 * 주소를 찾으므로 배너를 먼저 렌더링하면 <img src=""> 가 출력됩니다.
 */
const seedAttachments = (p) => {
  current = new Map((p.attachments || []).map((a) => [a.attachment_id, a.file_path]))
}
/**
 * 본문의 절 제목에 `id` 를 달고, 그 목록을 같이 돌려줍니다 — 「절 바로 가기」가 쓸 것입니다.
 *
 * **굽기에서 하는 까닭**: 편집기 라이브러리는 제목을 안 건드립니다(`toPublishedHtml` 은
 * 코드·다이어그램·그림·표만 굽습니다). 그쪽을 고치려면 편집기 스키마까지 손대야 하는데,
 * `server/vendor/` 와 `public/assets/prose.css` 는 `tools/sync-vendor.mjs` 가 통째로
 * 덮어써서 고쳐도 다음 동기화에 사라집니다. 게다가 `id` 는 **발행본에만** 필요합니다 —
 * 편집 화면에는 목차가 없습니다.
 *
 * 이미 `id` 가 있으면 그대로 둡니다. 라이브러리가 보존하는 값이라 글쓴이가 손으로 넣었을
 * 수 있습니다.
 *
 * 주소는 `s1`·`s2` 처럼 **번호**입니다. 제목 글자에서 뽑지 않는 까닭: 한글 제목은 ASCII
 * 슬러그가 비고, 굽기에 「빈 href 면 생성을 통째로 던진다」는 가드가 있습니다. 제목이 같은
 * 절이 둘이면 중복까지 따로 피해야 합니다. 번호는 그 둘을 한 번에 없앱니다.
 *
 * 정규식이 `TAG` 를 쓰는 것은 `<h2 title="a>b">` 때문입니다 — `[^>]*>` 로 읽으면 태그 끝을
 * 잘못 잡습니다(html-text.mjs 의 그 주석과 같은 함정).
 */
const HEADING = new RegExp(`<(h[23])(${TAG})>([\\s\\S]*?)</\\1>`, 'gi')
const withAnchors = (html) => {
  const items = []
  let n = 0
  const out = String(html).replace(HEADING, (all, tag, attrs, inner) => {
    /* 글자가 없는 제목은 건너뜁니다 — 목차에 빈 줄이 생기고 누를 것도 없습니다 */
    const text = unesc(inner.replace(new RegExp(`<${TAG}>`, 'g'), ' ')).replace(/\s+/g, ' ').trim()
    if (!text) return all
    n += 1
    const had = attrs.match(new RegExp(`\\sid\\s*=\\s*"([^"]*)"`, 'i'))
    const id = had ? had[1] : `s${n}`
    items.push({ id, text, sub: tag.toLowerCase() === 'h3' })
    return had ? all : `<${tag}${attrs} id="${id}">${inner}</${tag}>`
  })
  return { html: out, items }
}

/**
 * 절 바로 가기. 제목이 없으면 **아무것도 안 냅니다** — 빈 칸을 두면 본문 옆에 이유 없는
 * 여백이 섭니다. 껍데기라도 내면 골든 쉰세 벌이 통째로 흔들립니다.
 * 이름이 「목차」가 아닌 까닭: 블로그 템플릿 `lines` 의 라벨이 이미 「목차」라 코드에서
 * 구별이 안 됩니다. 화면 조각의 `.s-jump` 와 같은 말을 씁니다.
 */
const jumpHtml = (items) => (!items.length ? '' : `
  <aside class="b-jump" aria-label="절 바로 가기">
    <nav>
${items.map((it) => `      <a href="#${esc(it.id)}"${it.sub ? ' class="sub"' : ''}>${esc(it.text)}</a>`).join('\n')}
    </nav>
  </aside>
`)

/* 표는 부르는 쪽이 이미 깔아 둡니다(postPage 가 제목 배너보다 먼저 깝니다).
   여기서 다시 깔면 글마다 Map 을 두 번 만듭니다 */
const articleBody = (p) => withAnchors(resolveAttachments(toPublishedHtml(p.body || '')))

/**
 * 글의 본문 폭 → CSS 변수. 값은 **라이브러리 어휘 셋**입니다(post-editor-core 의
 * `proseWidthStyle`) — 여기가 그 셋을 다 알아야 편집 화면과 발행 화면의 폭이 같습니다.
 *
 *   없음 · 'measure'  아무것도 안 얹습니다 → prose.css 의 38rem
 *   'full'            100% — 툴바의 「전체폭」
 *   CSS 길이          그대로 ('68rem' 은 툴바의 「가운데폭」)
 *
 * `'full'` 을 몰랐던 탓에 「전체폭」으로 저장한 글이 아무 값도 못 받고 38rem 으로
 * **좁아졌습니다.** 「가운데폭」(68rem)보다 좁아져서 단추 이름과 정반대로 움직였습니다.
 *
 * 변수를 둘 얹는 것도 라이브러리와 같습니다. `--wide-override` 를 빼면 유튜브 상자만
 * 52rem 에 머물러(prose.css) 글 폭을 넓혀도 그것 하나가 안 따라옵니다.
 *
 * CSS 길이가 아니면 버립니다. 이 값은 글의 칸에서 오고 서버는 그 칸을 해석하지 않습니다 —
 * 무효값이 들어가면 그 선언이 통째로 죽어 화면이 무너집니다.
 *
 * **따로 두고 내보내는 까닭**: 규칙을 여기 한 줄로 복제해 두면 라이브러리가 어휘를 늘릴 때
 * 조용히 갈라집니다. `tools/check-contract.mjs` 의 ⑤ 가 이 함수를 **직접 불러** 라이브러리의
 * `proseWidthStyle` 과 견줍니다(글꼴 시트에서 같은 종류의 결함을 겪고 세운 규약입니다).
 */
export const proseWidthVars = (width) => {
  const w = width === 'full' ? '100%' : width
  if (!w || !/^-?[\d.]+(px|rem|em|%|vw|ch)$/.test(w)) return null
  return { '--measure-override': w, '--wide-override': w }
}

/** 변수 표를 style 속성으로. 빈 표면 속성 자체를 안 냅니다 */
const styleAttr = (vars) =>
  (vars ? ` style="${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}"` : '')

/**
 * 글 상세는 **목록 템플릿을 안 따라갑니다.**
 *
 * 예전에는 `bp-${conf.blog.template}` 을 달아서 목록에서 고른 갈래가 글의 제목 블록까지
 * 바꿨습니다 — 「카드」를 고르면 제목 위에 4px 먹선이 서고, 「사진 행」을 고르면 날짜가
 * 제목 위로 올라갔습니다. 목록과 글을 한 벌로 보이게 하려던 것인데, 고르는 화면은 목록인데
 * 바뀌는 것은 글이라 **왜 바뀌었는지 보이지 않았습니다**(사용자 지적).
 *
 * 목록의 갈래는 목록에서만 씁니다. 글은 한 가지 모양입니다 — 제목·날짜·본문.
 * 그 모양은 `public/assets/blog.css` 의 `.b-post` 규칙과 라이브러리의 제목 렌더러가 정합니다.
 * 갈래마다 다르게 하고 싶어지면 목록 값을 다시 끌어오지 말고 **상세 제 손잡이**를 만드세요.
 */

/**
 * 글 상세의 <style> 두 줄(html·body 의 overflow-x)이 한 짝인 까닭.
 *
 * ① `html { overflow-x: hidden }` — 제목 배너가 `width: 100vw` 로 화면을 채우는데 100vw 는
 *    **세로 스크롤바 폭을 포함**합니다. 안 막으면 스크롤바가 자리를 차지하는 환경에서 가로
 *    스크롤이 생깁니다. html 은 클래스로 가를 수 없어 페이지 안에 둡니다.
 *
 * ② `body { overflow-x: clip }` — ①의 대가를 갚습니다. html 이 제 overflow 를 가지면
 *    site.css 의 body 규칙(overflow-x: hidden)이 더는 화면으로 넘어가지 못하고 **body 가
 *    진짜 스크롤 상자**가 됩니다. 그런데 실제로 구르는 것은 화면이라, body 안의 sticky 는
 *    「한 번도 안 구르는 상자」를 기준으로 삼아 영영 안 붙습니다. 공통헤더와 절 바로 가기가
 *    **글 상세에서만** 안 따라오던 까닭입니다(목록·메인·작업에는 ①이 없어 멀쩡했습니다).
 *    clip 은 자르기만 하고 스크롤 상자를 만들지 않습니다. 실측으로 셋을 갈랐습니다 —
 *      body hidden  → 안 붙음 · 가로 넘침 0
 *      body clip    → 붙음   · 가로 넘침 0   ← 이것
 *      body visible → 붙음   · 가로 넘침 있음
 *
 * ①만 두고 ②를 지우면 sticky 가 다시 죽습니다. ②만 두고 ①을 지우면 가로 스크롤이 돌아옵니다.
 */
export const postPage = (p, styleTag, conf = DEFAULTS) => {
  seedAttachments(p)                         /* 제목 배너도 이 표를 참조하므로 본문보다 먼저 준비합니다 */
  const { html: body, items } = articleBody(p)
  const jump = conf.blog.toc.show ? jumpHtml(items) : ''
  const widthAttr = styleAttr(proseWidthVars(p.width))
  /**
   * 「전체폭」은 **화면 끝까지**입니다 — 편집 화면이 그렇게 보여 주고, 라이브러리도 그 값을
   * 「글줄까지 화면 끝까지」라고 적어 둡니다. 변수(`--measure-override: 100%`)만으로는
   * `.wrap` 의 `max-width`(사이트 본문 폭, 기본 1240px)에 갇혀 「100% of 1160px」이 됩니다.
   * 그래서 그 천장을 이 글에서만 걷는 클래스를 같이 답니다.
   */
  const fullCls = p.width === 'full' ? ' b-full' : ''
  /**
   * 제목과 배너는 라이브러리(renderPostHead)가 렌더링합니다. 여기서 직접 마크업을 작성하면
   * 편집 화면과 발행 페이지의 DOM 이 갈라져 배너 위치·글꼴·크기가 조용히 달라집니다.
   * 작성 일시는 제목과 같은 블록 안에 넣습니다 — 본문 위에 따로 한 줄로 두면 배너와 본문
   * 사이에 띠가 하나 생깁니다. 라이브러리가 만든 문자열의 닫는 태그 앞에 끼워 넣습니다.
   * title_doc 이 없는 옛 글도 같은 렌더러를 태웁니다.
   */
  const t = normalizeTitle(p.title_doc || { text: p.title })
  /* 날짜는 제목 옆이라 정렬을 같이 따라가야 합니다. 가운데 제목 밑에 왼쪽 날짜가 붙으면 어긋납니다 */
  const when = `<time class="b-when" datetime="${new Date(p.published_at).toISOString()}"` +
               ` style="text-align:${t.align}">${ymd(p.published_at)}</time>`
  const head = '  ' + renderPostHead(t, 'viewport').replace(/<\/header>\s*$/, when + '</header>')
  return shell({
    theme: styleTag + pageFontStyle(conf.blog.font),
    footer: conf.footer, colors: conf.theme,
    chrome: conf.blog.chrome,
    header: conf.header,
    title: `${p.title} — ${siteName(conf, site.siteTitle)}`, favicon: faviconOf(conf.site),
    description: summarize(body) || site.description,
    canonical: `${site.origin}/blog/${encodeURIComponent(p.slug)}/`,
    nav: navFor(`/blog/${encodeURIComponent(p.slug)}/`),
    /* 글을 읽는 중에는 사이트 이름 자리가 「← 목록」이 됩니다.
       본문 위에 따로 줄을 만들면 배너가 헤더에서 떨어지고, 이름 옆에 덧붙이면
       헤더 항목이 셋이 되어 어디를 눌러야 목록인지 인지하기 어려워집니다. */
    brand: '<a class="s-name s-back" href="/blog/"><span aria-hidden="true">←</span>글 목록</a>',
    head: `<link rel="stylesheet" href="/assets/blog.css?v=${assetVersion()}">
<link rel="stylesheet" href="/assets/templates/blog.css?v=${assetVersion()}">
<link rel="stylesheet" href="/assets/fonts.css?v=${assetVersion()}">
<link rel="stylesheet" href="/assets/templates/header.css?v=${assetVersion()}">
<link rel="stylesheet" href="/assets/fonts.local.css?v=${assetVersion()}">
<link rel="stylesheet" href="/assets/prose.css?v=${assetVersion()}">
<style>
  /* 배너의 100vw 를 자릅니다. 둘은 한 짝입니다 — 까닭은 굽기의 postPage 주석에. */
  html { overflow-x: hidden; }
  body { overflow-x: clip; }
</style>
`,
    /* 갈래 이름을 안 답니다 — 글은 한 가지 모양입니다(위 postPage 주석).
       `b-post` 만으로 blog.css 가 제목·날짜·본문 여백을 정합니다 */
    body: `<main class="wrap b-post${fullCls}"${widthAttr}>
${head}
${jump}
  <article class="prose">
    <div class="prose-body">
${body}
    </div>
  </article>
</main>`,
  })
}

/* ── 홈 · 작업 목록 · 작업 상세 ────────────────────────────────────────
   출력 폴더는 PAGES 로, 블로그와 다릅니다. nginx 가 이 둘만 덮어씁니다. */

/**
 * 헤더 메뉴에 aria-current 를 붙입니다. 값이 두 가지입니다.
 * 그 주소가 지금 페이지면 page, 지금 페이지가 속한 섹션이면 true.
 *
 * 글 상세에서 「블로그」에 page 를 붙이면 스크린리더가 「현재 페이지」로 읽는데 눌러 보면
 * 다른 데로 갑니다. 섹션은 섹션이라고 말해야 합니다.
 */
const navFor = (here) => site.nav.map(({ current, ...n }) => {
  if (n.external || !here) return n
  if (n.href === here) return { ...n, current: 'page' }
  return here.startsWith(n.href) ? { ...n, current: 'true' } : n
})

/** 작업 주소. 여기서만 만듭니다. 링크와 폴더 이름이 갈리면 죽은 링크가 됩니다 */
const workHref = (slug) => `/portfolio/${encodeURIComponent(slug)}/`

/** og 메타 태그. 작업물은 공유용이라 링크 미리보기에 그림이 같이 가야 합니다 */
const ogTags = ({ type, title, description, url, image }) => [
  `<meta property="og:type" content="${esc(type)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  `<meta property="og:url" content="${esc(url)}">`,
  ...(image ? [`<meta property="og:image" content="${esc(site.origin + image)}">`,
               '<meta name="twitter:card" content="summary_large_image">'] : []),
].join('\n') + '\n'

/**
 * 작업 카드 한 장. 홈의 대표작과 작업 목록이 같은 카드를 씁니다.
 * 캡션은 <figure> 안에 둡니다 — 밖에 두면 보조기기가 그림과 캡션을 따로 읽습니다.
 * 그림 자르기는 .w-shot 이 맡습니다(figure 에 걸면 캡션까지 잘립니다). img 의 alt 를 비운
 * 것은 바로 밑 캡션이 같은 말을 하기 때문입니다.
 * zoom 이 popup 이면 상세로 가지 않고 목록 위에 그 작업을 엽니다(#w-번호). 카드에 id 를
 * 주는 것은 닫을 때 보던 자리로 돌아오기 위해서입니다 — # 로 닫으면 맨 위로 튑니다.
 */
const workCard = (w, popup = false) => `<li${popup ? ` id="c-${esc(w.slug)}"` : ''}><a class="w-card" href="${popup ? `#w-${esc(w.slug)}` : workHref(w.slug)}">
      <figure>
        <span class="w-shot">${w.cover ? `<img src="${esc(w.cover)}" alt="" loading="lazy">` : ''}</span>
        <figcaption><span class="w-title">${esc(w.title)}</span></figcaption>
      </figure></a></li>`

/**
 * 글 카드. 작업 카드와 같은 마크업(.w-card)을 씁니다. 한 화면에 두 목록이 나란히 표시되므로
 * 모양이 갈리면 안 됩니다. 다른 것은 주소뿐입니다.
 */
const postCard = (p) => `<li><a class="w-card" href="/blog/${encodeURIComponent(p.slug)}/">
      <figure>
        <span class="w-shot">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : ''}</span>
        <figcaption><span class="w-title">${esc(p.title)}</span></figcaption>
      </figure></a></li>`

/** 목록이 비었을 때 쓰는 문구. 빈 화면만 내면 왜 비었는지 알 수 없습니다 */
const nothing = (what) => `<p class="w-none">${what}</p>`

/**
 * 메인의 섹션들. 순서는 설정 배열 순서이고 여기서는 하나씩 그리기만 합니다.
 * 인자가 ctx 하나뿐이라 섹션이 이웃을 모릅니다. 그래서 순서 조합이 그냥 덧셈으로 끝납니다.
 * works 와 posts 는 같은 카드 컴포넌트(workCard, postCard)를 씁니다.
 */
const SECTION_HTML = {
  /* 이 객체가 아래 세 함수보다 먼저 평가되므로 이름을 그대로 담으면 TDZ 에 걸립니다.
     한 겹 감싸면 부를 때 찾으니 선언 순서에 안 묶입니다 */
  stage: (ctx) => stageHtml(ctx),
  shots: (ctx) => shotsHtml(ctx),
  slides: (ctx) => slidesHtml(ctx),
  works: ({ featured }) => `  <section class="sec-grid">
    <div class="wrap">
${featured.length ? `      <ul class="w-cards">
        ${featured.map((w) => workCard(w)).join('\n        ')}
      </ul>
      <p class="sec-grid-more"><a href="/portfolio/">작업 전부 보기</a></p>` : `      ${nothing('작성된 작업물이 없습니다.')}`}
    </div>
  </section>`,

  posts: ({ recent }) => `  <section class="sec-grid sec-posts">
    <div class="wrap">
${recent.length ? `      <ul class="w-cards">
        ${recent.map((p) => postCard(p)).join('\n        ')}
      </ul>
      <p class="sec-grid-more"><a href="/blog/">글 전부 보기</a></p>` : `      ${nothing('작성된 글이 없습니다.')}`}
    </div>
  </section>`,
}

/**
 * 템플릿이 포함하는 텍스트 박스의 기본 문구. 비워 두면 이 값이 출력됩니다.
 * site.config.mjs 를 고치면 메인이 따라 바뀝니다.
 *
 * 사용자가 직접 더한 박스는 이 표에 없어서 비우면 아무것도 안 보입니다.
 * 직접 쓴 글자가 그 박스의 전부입니다.
 */
const STAGE_TEXT = {
  brand: () => site.brand,
  title: () => site.home.ogTitle,
  text: () => site.home.description,
  goWorks: () => '작업 보기',
  goBlog: () => '블로그',
}
const boxText = (it) => String(it?.text || '').trim() || (STAGE_TEXT[it?.id] ? STAGE_TEXT[it.id]() : '')
/* 관리자 편집기가 「다 지우면 무엇이 보이나」를 표시하려고 API 로 받아 갑니다 */
export const stageDefaults = () => Object.fromEntries(Object.entries(STAGE_TEXT).map(([k, f]) => [k, f()]))

/**
 * stage — 메인 첫 화면. 텍스트 박스들이 1240px board 위의 좌표에 배치됩니다.
 * board 는 화면 폭에 맞춰 글자 크기까지 통째로 줄고 늘어납니다(CSS 컨테이너 단위).
 * 860px 이하에서는 board 를 버리고 세로로 쌓는데, 쌓이는 순서가 마크업 순서라 여기서
 * y → x 순으로 정렬해 냅니다.
 * 박스가 인라인으로 싣는 값은 좌표(--sx --sy --sw)와 직접 정한 것(--sff 글꼴, --sc 색)뿐입니다.
 * 크기·줄 높이·자간·글꼴 갈래는 data-s 가 CSS 에서 정합니다 — 다섯 값을 인라인으로 실으면
 * 사이트 전체의 일관성이 박스마다 달라집니다.
 */
/**
 * 콘텐츠 영역의 사진 한 장. width·height 를 반드시 적습니다(workImage 와 같은 이유) —
 * 비율을 미리 알려 주지 않으면 사진이 뜰 때마다 아래 내용이 밀려 내려갑니다.
 * 앞 두 장만 eager 로 받고 나머지는 미룹니다. 여기서는 한 장이 화면 폭을 전부 차지하므로
 * 썸네일은 안 씁니다.
 */
const shotImg = (im, i, cls = '') => {
  const size = im.w && im.h ? ` width="${im.w}" height="${im.h}"` : ''
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(im.src)}" alt=""${size} loading="${i < 2 ? 'eager' : 'lazy'}">`
}

/**
 * 푸터의 기본 문구. 비워 두면 이 값이 출력됩니다(STAGE_TEXT 와 같은 규약).
 * site.config.mjs 를 고치면 푸터가 따라 바뀌고, 연도는 구울 때마다 새로 읽습니다.
 */
const FOOT_TEXT = {
  mail: () => site.email,
  copy: () => `© ${new Date().getFullYear()} ${site.copyright}. All rights reserved.`,
}
const footText = (it) => String(it?.text || '').trim() || (FOOT_TEXT[it?.id] ? FOOT_TEXT[it.id]() : '')
/* stageDefaults 와 같은 이유로 관리자에 넘깁니다 */
export const footDefaults = () => Object.fromEntries(Object.entries(FOOT_TEXT).map(([k, f]) => [k, f()]))
/**
 * 주소를 안 넣어도 갈 곳이 있는 아이콘. 지금은 GitHub 하나입니다(iconHref 와 같은 규칙).
 * 관리자가 이 값을 알아야 「주소가 비어서 화면에 안 나옵니다」를 잘못 띄우지 않습니다.
 */
export const footIconDefaults = () => ({ github: site.github || '' })
/**
 * 「설정」 탭이 빈 칸에 보여 줄 귀띔. 값이 아니라 **비웠을 때 무엇이 나가는지**입니다.
 * 제목을 비우면 site.config.mjs 의 값이 나가는데, 관리자가 그 값을 모르면 빈 칸이
 * 「이름이 없다」로 보입니다(푸터의 `footDefaults` 와 같은 뜻입니다).
 */
export const siteTextDefaults = () => ({ title: site.siteTitle || '', favicon: faviconOfConfig() })

/** 공개면 주소 — 관리자가 「글 보기」 링크를 만들 때 씁니다(`SITE_ORIGIN` 이 포트를 맞춰 줍니다) */
export const siteOrigin = () => String(site.origin || '').replace(/\/+$/, '')

/**
 * 아이콘의 링크 주소. 정한 값이 없으면 site.config.mjs 의 GitHub 를 씁니다.
 * 그래서 설정을 한 번도 안 건드린 사이트도 푸터에 GitHub 하나가 표시됩니다.
 * 갈 곳이 없으면 빈 문자열입니다. 그때는 링크가 아니라 span 으로 렌더링합니다(boardHtml).
 */
const iconHref = (it) => {
  const url = String(it?.url || '').trim()
  if (isExternal(url)) return url
  return it?.service === 'github' && site.github ? site.github : ''
}

/**
 * 텍스트 박스의 링크 주소. 내부 페이지면 ITEM_LINKS 에서 찾고, 외부 주소면 그대로 씁니다.
 *
 * mailto:, tel: 은 그 박스에 입력한 글자로 만듭니다. 같은 값을 두 군데 입력하게 하지 않습니다.
 * 전화는 숫자와 + 만 남깁니다. tel: 은 공백·하이픈을 기기마다 다르게 해석합니다.
 * 어느 쪽도 아니면 링크를 붙이지 않습니다.
 */
const boxHref = (it, text) => {
  if (it.link === 'mail') return text.includes('@') ? `mailto:${text}` : ''
  if (it.link === 'tel') { const d = text.replace(/[^\d+]/g, ''); return d ? `tel:${d}` : '' }
  return ITEM_LINKS.find((l) => l.value === it.link)?.href || (isExternal(it.link) ? it.link : '')
}

/**
 * 「직접 입력」 칩의 높이(board 단위). site.css 의 .m-ico-t 와 같은 값입니다 —
 * 글자 15u + 줄 높이 1.1 + 위아래 여백 0.7em + 테두리 1px 두 겹.
 * 여백을 바깥 .m-i 가 아니라 안쪽 .m-ico-t 에 지정하는 까닭: 바깥의 em 은 상속받은 본문
 * 글자(17px 고정)라 board 가 좁아져도 줄지 않아 이 계산과 11~47% 어긋납니다.
 * 이 값을 고치면 site.css 의 .m-ico-t 도 같이 고쳐야 합니다 — 한쪽만 고치면 좁은 화면에서
 * 쌓이는 순서가 어긋납니다.
 */
const CHIP_H = Math.round(15 * 1.1 + 15 * 0.7 * 2 + 2)

/**
 * board 하나를 렌더링합니다. stage 와 푸터가 같이 씁니다. 박스 배열을 1240 좌표계에 배치합니다.
 *
 * 마크업 순서가 좁은 화면의 쌓임 순서라 여기서 정렬해서 출력합니다. y 만 보고 정렬하면
 * 같은 줄에 나란히 표시되는 것들(연락처 옆 아이콘)이 몇 px 차이로 위아래가 뒤집힙니다.
 * 그래서 세로로 겹치는 박스를 한 줄로 묶고 그 안에서 x 순으로 정렬합니다.
 */
const boardHtml = (items, { height, bw, text = boxText, h1 = null, pad = '      ' }) => {
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  /* 아이콘은 주소가 없어도 렌더링합니다. 추가해 놓고 표시되지 않으면 어디에 배치됐는지 몰라
     위치를 조정할 수 없습니다. 갈 곳이 없으면 링크 대신 span 으로 출력됩니다.
     텍스트 박스는 글자가 비면 렌더링할 내용이 없어서 제외합니다 */
  const shown = items.filter((it) => it.show && (it.kind === 'icon' ? true : !!text(it)))
  if (!shown.length) return ''
  /* 세로로 겹치는 것끼리 한 줄로 묶습니다. 높이는 아이콘이면 자기 크기, 글자면 data-s 의 한 줄.
     「직접 입력」 칩만 예외입니다. 폭은 이름 길이가 정하고 높이는 글자 크기가 정해서 정사각이
     아닙니다. 폭을 높이로 계산하면 이름이 긴 칩이 아랫줄을 자기 줄에 포함시켜 쌓임 순서가
     뒤집힙니다 */
  const hOf = (it) => (it.kind === 'icon'
    ? (it.service === 'link' ? CHIP_H : n(it.w, 52))
    : Math.round((ITEM_SIZES.find((z) => z.value === it.size)?.u || 18.4) * 1.7))
  const rows = []
  for (const it of [...shown].sort((p, q) => n(p.y) - n(q.y) || n(p.x) - n(q.x))) {
    const row = rows.find((r) => n(it.y) < r.bottom)
    if (row) { row.list.push(it); row.bottom = Math.max(row.bottom, n(it.y) + hOf(it)) }
    else rows.push({ bottom: n(it.y) + hOf(it), list: [it] })
  }
  const ordered = rows.flatMap((r) => r.list.sort((p, q) => n(p.x) - n(q.x)))

  const el = (it) => {
    const style = `--sx:${n(it.x)};--sy:${n(it.y)};--sw:${n(it.w, 200)}`
    if (it.kind === 'icon') {
      const svc = SERVICE_ICONS.find((x) => x.value === it.service)
      const name = String(it.text || '').trim() || svc?.label || ''
      /* 「직접 입력」은 로고가 없어서 입력한 이름이 곧 아이콘이자 설명입니다 */
      const inner = it.service === 'link' && name
        ? `<span class="m-ico-t">${esc(name)}</span>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_OF[it.service] || ''}"/></svg>`
      const to = iconHref(it)
      const base = `class="m-i" data-i="${esc(it.id)}" data-k="icon" data-svc="${esc(it.service)}" style="${style}"`
      /**
       * 갈 곳이 있으면 <a>, 없으면 <span> 으로 출력합니다. 빈 href 를 지정하면 브라우저가 현재
       * 페이지를 다시 요청합니다. 대신 마우스를 올리거나 누르면 왜 동작하지 않는지 툴팁으로
       * 안내합니다(data-tip). 툴팁은 site.css 의 CSS 만으로 구현합니다 — 방문자에게 전달되는
       * JS 는 0바이트입니다. tabindex 도 그 때문입니다(탭과 누름이 곧 포커스라 터치에서도 뜹니다).
       */
      return to
        ? `${pad}<a ${base} href="${esc(to)}" rel="me noopener" target="_blank" aria-label="${esc(name)}">${inner}</a>`
        : `${pad}<span ${base} data-empty tabindex="0" role="img"` +
          ` aria-label="${esc(name)} — 링크 연결 주소 없음" data-tip="링크 연결 주소 없음">${inner}</span>`
    }
    const full = style
      + (it.font ? `;--sff:${fontStack(it.font, it.size === 'xl' || it.size === 'display' ? 'display' : 'sans')}` : '')
      + (it.color ? `;--sc:${it.color}` : '')
    const tag = it === h1 ? 'h1' : 'p'
    const t = text(it)
    const href = boxHref(it, t)
    const body = href ? `<a href="${esc(href)}">${esc(t)}</a>` : esc(t)
    const auto = it.auto !== false ? ' data-w="auto"' : ''
    return `${pad}<${tag} class="m-i" data-i="${esc(it.id)}" data-s="${esc(it.size)}"${auto} style="${full}">${body}</${tag}>`
  }
  return `${pad.slice(2)}<div class="m-board" style="--sh:${n(height, 600)};--bw:${bw}">\n${ordered.map(el).join('\n')}\n${pad.slice(2)}</div>`
}

/**
 * 푸터. footer.main 또는 footer.pages 를 board 하나로 렌더링합니다.
 * <section> 이 화면 끝까지 이어지는 윗선과 배경을 맡고, board 는 본문 폭 안에서 좌표를 씁니다.
 * 색을 지정한 푸터는 그 안에서 --fg, --bg 계열을 전부 덮어씁니다 — 아이콘 테두리와 흐린
 * 저작권 글자까지 그 배경 위에서 판독돼야 합니다. 흐린 색은 관리자와 같은 mutedOn 으로 계산합니다.
 */
const footHtml = (set, kind, theme) => {
  if (!set) return ''
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  const board = boardHtml(set.items || [], {
    height: set.height, bw: 'var(--foot-w, 1240px)', text: footText, pad: '      ',
  })
  if (!board) return ''
  const fg = set.color || ''
  const bg = set.bg || ''
  const vars = `--fgap:${n(set.gap)};--fline:${n(set.line?.width, 1)}`
    + (set.line?.color ? `;--fline-c:${set.line.color}` : '')
    + (bg ? `;--fbg:${bg}` : '')
    /* 글자색을 지정했으면 거기서 파생되는 색까지 다시 계산합니다. 안 그러면 어두운 푸터에
       밝은 배경용 흐린 색이 그대로 남습니다 */
    + (fg ? `;--fg:${fg};--fg-2:color-mix(in srgb, ${fg} 72%, ${bg || theme.paper});`
      + `--fg-3:${mutedOn(fg, bg || theme.paper)};--line:color-mix(in srgb, ${fg} 24%, ${bg || theme.paper})` : '')
  return `<section class="foot" data-foot="${kind}"${kind === 'main' ? ' id="contact"' : ''} style="${vars}">
${board}
</section>`
}

/**
 * stage 섹션. 텍스트 board 만 렌더링합니다. 사진은 shotsHtml, slidesHtml 이 따로 렌더링합니다.
 * 마크업 순서가 좁은 화면의 쌓임 순서라 여기서 y → x 순으로 정렬해서 출력합니다.
 */
const stageHtml = (ctx) => {
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  const m = ctx.main
  /* 글자가 있는 박스만 */
  const shown = (m.items || [])
    .filter((it) => it.show && !!boxText(it))
    .sort((p, q) => n(p.y) - n(q.y) || n(p.x) - n(q.x))

  /* 배경 이미지. 관리자에서 업로드한 사진 경로이고, 비면 적용하지 않습니다 */
  const bg = typeof m.stage?.bg === 'string' ? m.stage.bg : ''
  /* 렌더링할 내용이 없으면 아무것도 출력하지 않습니다. 다른 템플릿의 배치를 대신 렌더링하면
     관리자의 「요소」 목록과 화면이 어긋나서 무엇이 켜져 있는지 알 수 없습니다.
     대신 템플릿의 시작 배치를 이미지 없이도 읽히게 구성해 둡니다 */
  if (!shown.length && !bg) return ''
  /* h1 은 하나만 출력합니다. data-s 가 가장 큰 박스가 맡습니다 */
  const rank = (it) => ITEM_SIZES.findIndex((z) => z.value === it.size)
  const big = [...shown].sort((p, q) => rank(p) - rank(q))[0]
  const h1 = big?.size === 'xl' || big?.size === 'display' ? big : null

  /* board 폭은 사이트 본문 폭을 그대로 따릅니다. 별도 설정이 없습니다.
     좌표계는 1240(STAGE_W) 고정입니다. board 가 좁아지면 --u(=100cqw/1240)가 같이 줄어서
     글자와 좌표가 비례해서 작아질 뿐, 저장된 x·y·w 는 변하지 않습니다 */
  const bw = 'var(--body-w, 1240px)'
  const board = shown.length ? boardHtml(shown, { height: m.stage?.height, bw, h1 }) : ''
  /* 높이를 섹션에도 지정합니다. 텍스트 board 가 없으면(배경만 지정했을 때) 자식이 전부
     absolute 라서 기준이 없어 높이가 0 이 됩니다. board 가 있으면 이 값은 쓰이지 않습니다 */
  return `  <section class="m-stage${bg ? ' has-img' : ''}" style="--sh:${n(m.stage?.height, 600)}">
${bg ? `    <img class="m-bg" src="${esc(bg)}" alt="">\n` : ''}${board}
  </section>`
}

/**
 * 사진을 세로로 나열하는 섹션. 높이는 각 사진의 비율이 정합니다.
 * knob 넷은 CSS 변수로 출력합니다(knobStyle 이 포트폴리오에 하는 것과 같은 방식).
 * 마크업이 아니라 변수라서 관리자에서 슬라이더를 조작하면 미리보기가 즉시 반영됩니다.
 */
const shotsHtml = (ctx) => {
  const list = (ctx.main.stage?.shots || []).slice(0, SHOT_MAX.shots)
  if (!list.length) return ''
  const k = ctx.main.stage?.shotKnobs || {}
  const n = (v, d) => (Number.isFinite(v) ? Math.round(v) : d)
  const style = SHOT_KNOBS.map((x) => `--m${x.key}:${n(k[x.key], x.d)}`).join(';')
  return `  <section class="m-shots" style="${style}">
${list.map((im, i) => `    ${shotImg(im, i)}`).join('\n')}
  </section>`
}

/**
 * 슬라이드. 배너가 화면을 채우고 좌우로 넘어갑니다. JS 가 0바이트입니다 — scroll-snap 이
 * 기반이라 드래그·휠·키보드·터치가 모든 브라우저에서 동작합니다.
 * 점과 화살표는 ::scroll-marker, ::scroll-button() 을 지원하는 브라우저에만 site.css 가
 * 추가하고, 미지원 브라우저에는 얇은 스크롤바를 남겨 뒤에 더 있다는 것을 알립니다.
 */
const slidesHtml = (ctx) => {
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  const list = (ctx.main.stage?.slides || []).slice(0, SHOT_MAX.slides)
  if (!list.length) return ''
  return `  <section class="m-slides" style="--sh:${n(ctx.main.stage?.slideH, 480)}">
    <div class="m-rail" tabindex="0" role="group" aria-label="사진 ${list.length}장">
${list.map((im, i) => `      ${shotImg(im, i, 'm-slide')}`).join('\n')}
    </div>
  </section>`
}

/** 섹션 순서. 설정 배열 순서를 그대로 씁니다. stage 도 그 안에 있어서 목록보다 뒤로 갈 수 있습니다 */
const mainOrder = (m) => (m.sections || []).filter((x) => x.show).map((x) => x.key)

const homePage = (ctx, fragment = '') => {
  /* code 모드면 stage 도 목록도 렌더링하지 않습니다. 본문 전체가 조각 HTML 입니다 */
  const code = ctx.main.mode === 'code'
  const order = code ? [] : mainOrder(ctx.main)
  const body = order.map((b) => (SECTION_HTML[b] ? SECTION_HTML[b](ctx) : '')).filter(Boolean)
  return shell({
    header: ctx.header,
    chrome: ctx.main.chrome,
    title: siteName(ctx, site.home.title), favicon: faviconOf(ctx.site),
    description: site.home.description,
    canonical: `${site.origin}/`,
    nav: navFor('/'),
    footer: ctx.footer, colors: ctx.theme,
    /* 홈은 항상 메인 푸터를 씁니다. 목록 유무에 따라 다른 푸터로 바꾸면 「메인 푸터」를
       수정해도 대부분의 홈에 반영되지 않아서 무엇이 바뀌었는지 확인할 수 없습니다.
       얇게 쓰려면 메인 푸터의 높이를 줄이면 됩니다.
       code 모드는 조각 HTML 이 제 푸터를 갖고 있어서 붙이지 않습니다 */
    foot: code ? 'none' : 'main',
    theme: pageStyle(ctx, 'main'),
    head: ogTags({ type: 'website', title: site.home.ogTitle, description: site.home.description,
                   url: `${site.origin}/`, image: ctx.cover?.cover }) +
          headerCss(ctx.main.chrome, ctx.main.mode) +
          `${fontSheet(ctx.theme.display, ctx.theme.body, ctx.header?.font, ctx.main.font.display, ctx.main.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${assetVersion()}">\n`,
    body: code ? fragment : `<main>
${body.join('\n\n')}
</main>`,
  })
}

/**
 * 선택한 색과 글꼴을 CSS 로 출력합니다. </head> 직전에 인라인으로 넣습니다 — theme.css 로
 * 따로 빼면 캐시가 CSS 와 HTML 을 다른 시점의 것으로 섞어 색만 옛 값으로 남는 구간이 생깁니다.
 *
 * --accent 는 두 군데에 출력합니다(글 본문의 링크색은 .prose 스코프라 :root 가 안 닿습니다).
 * 나머지 색은 선택한 세 색에서 color-mix 로 파생합니다 — 열두 개를 다 고르게 하면 하나만
 * 어긋나도 전체 색감이 탁해집니다.
 * --fg-3(흐린 글자)만 혼합 비율이 아니라 대비로 계산합니다. 전경색과 배경색의 거리가
 * 테마마다 달라 고정 비율로는 어떤 테마든 4.5:1 에 미달합니다(mutedOn, shared/site-vocab.mjs).
 *
 * 이 설명을 템플릿 문자열 밖에 둔 까닭은, CSS 주석으로 안에 넣으면 모든 공개 페이지에
 * 내부 메모가 그대로 출력되기 때문입니다.
 */
export const themeStyle = (t) => `<style data-theme>
:root {
${emitOmit(themeVars(t))}}
.prose { --accent: ${t.accent}; }
</style>
`

/**
 * 포트폴리오 knob 을 CSS 변수로 출력합니다. 값만 바꾸면 화면이 바뀝니다.
 *
 * 마크업을 건드리지 않는 것이 핵심입니다. 그래서 관리자에서 슬라이더를 조작하는 동안
 * 서버를 거치지 않고 미리보기 문서의 이 블록만 교체하면 즉시 반영됩니다.
 */
const knobStyle = (pf) => `<style data-knobs>
:root {
${emitOmit(knobVars(pf.knobs))}}
</style>
`

/* 작업 목록. 이미지 비율을 자르지 않습니다. 포스터와 책이 섞여 있어서 같은 크기로 자르면
   어느 쪽도 원래 모양이 아니게 됩니다 */
const worksPage = (works, ctx, fragment = '') => shell({
  theme: pageStyle(ctx, 'portfolio', lhStyle(ctx.portfolio.head)),
  header: ctx.header,
  chrome: ctx.portfolio.chrome,
  foot: ctx.portfolio.mode === 'code' ? 'none' : 'pages',
  footer: ctx.footer, colors: ctx.theme,
  title: siteName(ctx, site.works.title), favicon: faviconOf(ctx.site),
  description: site.works.description,
  canonical: `${site.origin}/portfolio/`,
  nav: navFor('/portfolio/'),
  head: ogTags({ type: 'website', title: site.works.title, description: site.works.description,
                 url: `${site.origin}/portfolio/`, image: works.find((w) => w.cover)?.cover }) +
        (ctx.portfolio.mode === 'template' ? `<link rel="stylesheet" href="/assets/templates/portfolio.css?v=${assetVersion()}">\n` : '') +
        headerCss(ctx.portfolio.chrome, ctx.portfolio.mode) +
        `${fontSheet(ctx.theme.display, ctx.theme.body, ctx.header?.font, ctx.portfolio.font.display, ctx.portfolio.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${assetVersion()}">\n`,
  body: ctx.portfolio.mode === 'code' ? fragment : `<main>
${listHead(ctx.portfolio.head, works.length)}${works.length ? `  <ul class="pf pf-${esc(ctx.portfolio.template)}">
    ${works.map((w) => workCard(w, ctx.portfolio.zoom === 'popup')).join('\n    ')}
  </ul>${ctx.portfolio.zoom === 'popup' ? `\n${works.map(workPop).join('\n')}` : ''}` : `  ${nothing('작성된 작업물이 없습니다.')}`}
</main>`,
})

/**
 * 작업 상세의 이미지 한 장. 무드보드에 업로드한 이미지를 순서대로, 원래 비율로,
 * 지정한 간격으로 세로 나열합니다. 간격이 0 이면 한 장처럼 이어 붙습니다.
 *
 * width·height 를 반드시 지정합니다. 비율을 미리 알려주지 않으면 이미지가 로드될 때마다
 * 아래 내용이 밀려 내려가서 읽던 위치를 잃습니다.
 */
const workImage = (im, i, zoomOn) => {
  const size = im.w && im.h ? ` width="${im.w}" height="${im.h}"` : ''
  const img = `<img src="${esc(im.src)}" alt=""${size} loading="${i < 2 ? 'eager' : 'lazy'}">`
  /* 확대가 popup 이면 이미지를 <a> 로 감싸고 오버레이를 같이 출력합니다. JS 없이 주소의
     # 만으로 열고 닫습니다(:target). 이동 모드면 이미지만 출력합니다 */
  return zoomOn
    ? `    <a class="wk-shot" id="s${i}" href="#i${i}" aria-label="${i + 1}번째 그림 크게 보기">${img}</a>`
    : `    <span class="wk-shot">${img}</span>`
}

/* 닫기 링크는 # 이 아니라 보고 있던 이미지의 앵커를 가리킵니다. # 로 두면 주소에서 앵커가
   사라져 브라우저가 문서 맨 위로 이동합니다. 이미지가 여러 장인 작업에서 아래쪽 이미지를
   닫으면 처음으로 돌아갑니다. 뒤로가기로 닫는 경로는 그대로 동작합니다 */
const workZoom = (im, i, total) => `  <div class="wk-zoom" id="i${i}" role="dialog" aria-modal="true" aria-label="${i + 1} / ${total}">
    <a class="wk-zoom-close" href="#s${i}" aria-label="닫기"></a>
    <img src="${esc(im.src)}" alt="" loading="lazy">
    <span class="wk-zoom-no">${i + 1} / ${total}</span>
  </div>`

/**
 * 목록 위에 여는 작업 오버레이. 상세 페이지의 이미지 영역과 같은 마크업(.wk-stack, .wk-shot)을
 * 써서 --wk-gap, --wk-radius knob 이 그대로 적용되고 팝업과 페이지가 같은 모양이 됩니다.
 * 「페이지로 보기」 링크는 두지 않습니다 — 팝업을 고른 사용자에게 페이지로 가는 길을 또
 * 보여 주면 무엇이 상세인지 혼동됩니다. 이미지는 전부 lazy 입니다.
 */
const workPop = (w) => {
  const images = Array.isArray(w.images) ? w.images : []
  const slug = esc(w.slug)
  return `  <div class="pf-pop" id="w-${slug}" role="dialog" aria-modal="true" aria-label="${esc(w.title)}">
    <div class="pf-pop-bar">
      <h2>${esc(w.title)}</h2>
      <a class="pf-pop-close" href="#c-${slug}">닫기</a>
    </div>
    <section class="wk-stack">
${images.length ? images.map((im) => `      <span class="wk-shot"><img src="${esc(im.src)}" alt=""${im.w && im.h ? ` width="${im.w}" height="${im.h}"` : ''} loading="lazy"></span>`).join('\n') : '      <p class="w-none">아직 올린 그림이 없습니다.</p>'}
    </section>
  </div>`
}

const workPage = (w, near, ctx) => {
  const images = Array.isArray(w.images) ? w.images : []
  /* 상세 안의 이미지 확대는 항상 켭니다. zoom 설정은 목록 카드가 상세를 어떻게 여는지를 정합니다 */
  const zoomOn = true
  return shell({
    header: ctx.header,
    /* 상세도 목록과 같은 설정을 따릅니다. 한 섹션 안에서 헤더 표시 여부가 달라지면 안 됩니다 */
    chrome: ctx.portfolio.chrome,
    footer: ctx.footer, colors: ctx.theme,
    title: `${w.title} — ${siteName(ctx, site.siteTitle)}`, favicon: faviconOf(ctx.site),
    description: `${w.title} — ${site.works.description}`,
    canonical: `${site.origin}${workHref(w.slug)}`,
    /* 작업을 보는 중에는 사이트 이름 자리가 「← 작업」이 됩니다. 글 상세와 같은 방식(.s-back) */
    brand: '<a class="s-name s-back" href="/portfolio/"><span aria-hidden="true">←</span>작업</a>',
    nav: navFor(workHref(w.slug)),
    head: ogTags({ type: 'article', title: w.title, description: site.works.description,
                   url: `${site.origin}${workHref(w.slug)}`, image: w.cover }) +
          `<link rel="stylesheet" href="/assets/templates/header.css?v=${assetVersion()}">
${fontSheet(ctx.theme.display, ctx.theme.body, ctx.header?.font, ctx.portfolio.font.display, ctx.portfolio.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${assetVersion()}">\n`,
    theme: ctx.style + pageFontStyle(ctx.portfolio.font),
    body: `<main class="wk">
  <div class="wrap wk-top"><h1>${esc(w.title)}</h1></div>

  <section class="wk-stack">
${images.length ? images.map((im, i) => workImage(im, i, zoomOn)).join('\n') : '    <p class="w-none">아직 올린 그림이 없습니다.</p>'}
  </section>
${zoomOn && images.length ? `
${images.map((im, i) => workZoom(im, i, images.length)).join('\n')}
` : ''}
  <div class="wrap work-next">
${near ? `    <span class="work-next-label">다음 작업</span>
    <a href="${workHref(near.slug)}">${esc(near.title)}</a>` : `    <a href="/portfolio/">작업 목록으로</a>`}
  </div>
</main>`,
  })
}

/**
 * 메인과 포트폴리오를 생성합니다. 두 화면 모두 항상 생성하고, 달라지는 것은 본문을 누가
 * 만드는지(mode)입니다 — template 이면 고른 모양대로, code 면 레포의 pages/*.html 을 그대로.
 * 이 폴더에는 다시 만들 수 있는 것만 있습니다(`.env.example` 의 PAGES_DIR 설명).
 * 만들고 → 검사하고 → 씁니다. 쓰고 나서 보면 nginx 는 이미 그 파일을 내고 있습니다.
 */
/**
 * @param dummy  참이면 DB 를 안 읽고 견본 내용을 세웁니다(server/dummy.mjs 주석 참고).
 *               고르는 중에는 빈 목록보다 찬 목록이 판짜기를 더 정직하게 보여 줍니다.
 * @param rebase 미리보기 주소(`/preview/...`) — 주면 `<a>` 를 그 안으로 돌립니다
 */
export async function bakePages(pool, { into = PAGES, conf = DEFAULTS, rebase = false, dummy = false } = {}) {
  resetAssetVersion()
  /**
   * 작업물은 글과 같은 표에 삽니다 — 다른 건 `kind` 한 칸뿐입니다(sql/schema.sql 참고).
   * 작업은 본문이 없고 무드보드 폴더에 올린 그림 목록이 곧 내용입니다. 목록 카드에는
   * 대표(`kind='banner'`)의 작은 판을, 상세에는 전부를 차례대로 겁니다.
   */
  /* 포트폴리오를 직접 디자인하는 사이트에는 작업물이 발행될 자리가 없습니다 —
     `/portfolio/{이름}/` 을 아무도 안 만들므로 질의도 하지 않습니다 */
  /* 견본은 포트폴리오 모드와 무관하게 세웁니다. 메인의 작업 목록은 메인 판짜기의
     일부라, 포트폴리오를 직접 디자인한다고 해서 고를 때 빈 칸으로 둘 이유가 없습니다.
     아래 상세 굽기 고리가 `works` 를 그대로 도므로 견본 카드도 눌러서 들어갈 수 있습니다 */
  const wantWorks = conf.portfolio.mode === 'template'
  const { rows: works } = dummy ? { rows: DUMMY_WORKS } : !wantWorks ? { rows: [] } : await pool.query(
    `select p.slug, p.no, p.title, p.published_at,
            (select coalesce(a.thumb, a.file_path) from post_attachments a
              where a.post_id = p.id and a.kind = 'banner' limit 1) as cover,
            coalesce((select json_agg(json_build_object(
                        'src', a.file_path, 'thumb', a.thumb, 'w', a.w, 'h', a.h) order by a.ord nulls last)
                        from post_attachments a
                       where a.post_id = p.id and a.kind in ('mood', 'banner')), '[]'::json) as images
       from posts p
      where p.kind = 'work' and p.published_at is not null and not p.hidden
      order by p.ord nulls last, p.published_at desc`,
  )

  /* 메인에 글 목록을 켠 사이트만 — 안 켰으면 질의도 안 합니다 */
  const wantPosts = conf.main.mode === 'template' && (conf.main.sections || []).some((x) => x.key === 'posts' && x.show)
  const { rows: recent } = !wantPosts ? { rows: [] } : dummy ? { rows: DUMMY_POSTS.slice(0, 3) } : await pool.query(
    `select p.slug, p.title, p.published_at,
            (select coalesce(a.thumb, a.file_path) from post_attachments a
              where a.post_id = p.id and a.kind = 'banner' limit 1) as cover
       from posts p
      where p.kind = 'post' and p.published_at is not null and not p.hidden
      order by p.published_at desc
      limit 3`,
  )

  /* ① 만듭니다 — 아직 디스크에는 손대지 않습니다 */
  /* 표지로 걸 수 있는 건 그림이 있는 작업뿐입니다. 그림 없는 작업을 세우면
     `<img src="">` 가 나가고, 빈 src 는 브라우저가 현재 페이지를 다시 받습니다
     (라이브러리가 첨부에서 같은 이유로 피하는 그 함정입니다) */
  const cover = works.find((w) => w.cover) || null
  const featured = works.slice(0, 3)
  /* 섹션 렌더러가 참조하는 값 전부. 섹션은 이웃을 모르기 때문에 순서 조합이 단순 덧셈입니다 */
  const ctx = { ...conf, cover, featured, works, recent, style: themeStyle(conf.theme) + knobStyle(conf.portfolio) + headStyle(conf.header, conf.theme) }

  /* made 의 셋째 값은 레포 주인이 작성한 파일인지 여부입니다. 그 경우 <script> 가 정당합니다 */
  const none = { rel: '', html: '', missing: false }
  const [mainFrag, worksFrag] = await Promise.all([
    conf.main.mode === 'code' ? readFragment('main', conf.main.source) : none,
    conf.portfolio.mode === 'code' ? readFragment('portfolio', conf.portfolio.source) : none,
  ])
  /* 숨긴 메뉴는 직접 디자인 화면에서도 빠져야 합니다 — 조각은 헤더를 제 손으로 그리므로
     공통헤더의 필터가 닿지 않습니다. 조각을 고칠 필요 없이 설정을 따라갑니다 */
  const hidden = hiddenNavHrefs(conf.header)
  const mainHtml = dropHiddenNav(mainFrag.html, hidden)
  const worksHtml = dropHiddenNav(worksFrag.html, hidden)
  /**
   * 헤더가 둘이 되는 조합은 막지 않고 경고만 합니다. 공통 헤더는 mode 와 별개의 설정이라
   * code 모드에서도 켤 수 있어야 하는데, 생성기가 막으면 조각 HTML 을 고치기 전에는 켤 방법이
   * 없습니다. 켜면 띠가 두 줄 표시되지만 미리보기에 바로 보이고 되돌리기도 한 번이면 됩니다.
   */
  const warn = []
  const leftover = hidden.length ? new RegExp(navAnchor(hidden), 'i') : null
  for (const [frag, html, on, isMine] of [[mainFrag, mainHtml, conf.main.chrome, conf.main.source === PAGE_SOURCE_MINE],
                                          [worksFrag, worksHtml, conf.portfolio.chrome, conf.portfolio.source === PAGE_SOURCE_MINE]]) {
    /* pages/ 쪽 파일이 없으면 빈 화면에서 시작한다는 뜻이라 경고하지 않습니다.
       선택한 샘플 파일이 없으면 레포를 덜 받은 것이므로 경고합니다 */
    if (frag.missing && !isMine) warn.push(`${frag.rel} 이 없습니다 — 빈 화면으로 구웠습니다`)
    if (on && ownsHeader(frag.html)) {
      warn.push(`${frag.rel} 이 제 헤더를 갖고 있어 헤더가 둘입니다 — 그 <header> 를 지우거나 공통헤더를 끄세요`)
    }
    /* <nav> 밖에 쓴 링크는 본문 링크일 수 있어 그대로 둡니다. 다만 숨겼는데 화면에 남아 있으면
       고장으로 보이므로, 어느 파일인지 알려 주고 지울지는 쓴 사람이 정하게 합니다 */
    if (leftover?.test(html)) {
      warn.push(`${frag.rel} 에 숨긴 메뉴의 링크가 <nav> 밖에 남아 있습니다 — 본문 링크가 아니면 지우세요`)
    }
  }

  const made = []
  made.push(['index.html', homePage(ctx, mainHtml), conf.main.mode === 'code'])
  made.push(['portfolio/index.html', worksPage(works, ctx, worksHtml), conf.portfolio.mode === 'code'])

  for (const [i, w] of works.entries()) {
    if (!okSlug(w.slug)) throw new Error(`작업 주소로 쓸 수 없는 이름입니다: ${JSON.stringify(w.slug)}`)
    /* 「다음 작업」은 순환합니다. 마지막에서 첫 항목으로 돌아가고, 한 개뿐이면 링크를 만들지 않습니다 */
    const near = works.length > 1 ? works[(i + 1) % works.length] : null
    /* 상세에는 code 모드가 없습니다. 이미지를 순서대로 나열하는 것이 전부라 교체할 마크업이
       없습니다. 모양은 knob(간격·모서리)과 확대 방식으로 조정합니다 */
    made.push([`portfolio/${w.slug}/index.html`, workPage(w, near, ctx), false])
  }

  /* ② 검사합니다. 하나라도 걸리면 아무것도 쓰지 않습니다 */
  const willExist = new Set(made.map(([rel]) => rel))
  for (const [rel, html, trusted] of made) {
    /* 카드가 가리키는 대상을 이번에 같이 생성하는지 확인합니다. 디스크를 기준으로 하면
       지난번에 생성된 오래된 파일이 검사를 통과시킵니다. 이번 생성 결과끼리만 대조합니다.
       직접 작성한 조각 HTML 은 건너뜁니다. 그 링크는 작성한 사람이 관리합니다 */
    for (const [, enc] of trusted ? [] : html.matchAll(/href="\/portfolio\/([^"/]+)\/"/g)) {
      const slug = decodeURIComponent(enc)          // 주소는 인코딩된 상태, 폴더 이름은 원문
      if (!willExist.has(`portfolio/${slug}/index.html`)) {
        throw new Error(`${rel}: 없는 작업을 가리킵니다 — /portfolio/${slug}/`)
      }
    }
/* 생성된 화면에는 자바스크립트를 포함하지 않습니다. 관리자에서 입력된 값(제목·이름·
       색)이 태그로 빠져나가는 길을 막는 자리입니다. 조각(`trusted`)은 이 검사를 안 받습니다:
       레포를 가진 사람이 쓴 것이라 `<script>` 가 정당하고, 크기는 `tools/check-public.mjs`
       가 잽니다. */
    const bad = trusted ? null : unsafeBit(html)
    if (bad) throw new Error(`${rel}: 공개 화면에 실행되는 것이 들어왔습니다 — ${bad}`)
    /* 블로그 생성이 검사하는 항목을 화면 쪽도 같이 검사합니다. 안 그러면 nginx 가 서빙하는
       경로 중 한쪽만 검사 대상이 됩니다 */
    if (html.includes('attachment://')) throw new Error(`${rel}: 주소로 못 푼 첨부가 남았습니다`)
    if (/X-Amz-Signature/i.test(html)) throw new Error(`${rel}: 서명된 임시 주소가 박혔습니다`)
    /* 빈 주소는 현재 페이지를 다시 요청합니다. 로딩이 느려지고 접속 기록이 두 배가 됩니다 */
    if (/\s(?:src|href)=""/.test(html)) throw new Error(`${rel}: 빈 주소(src/href)가 있습니다`)
    /* .prose > .prose-body 두 겹 검사는 글에만 적용합니다(bakeNow). 폭·여백 규칙이 그 두 겹에
       걸려 있어서 한 겹이면 조용히 깨집니다. 작업은 편집기를 쓰지 않고 이미지만 나열하므로
       그 구조가 없습니다. 여기서 요구하면 작업을 올릴 때마다 생성이 실패합니다 */
    if (/<link[^>]+rel=["']?stylesheet[^>]*href=["']?(https?:)?\/\//i.test(html) || /@import\s+url\(\s*["']?(https?:)?\/\//i.test(html)) {
      throw new Error(`${rel}: 바깥에서 스타일시트를 끌어옵니다`)
    }
  }

  /* ③ 디스크에 씁니다 */
  const written = []
  for (const [rel, html] of made) {
    const at = `${into}/${rel}`
    await mkdir(dirname(at), { recursive: true })
    await writeAtomic(at, rebase ? previewLinks(html, rebase) : html)
    written.push(rel)
  }

  /* 내린 작업의 폴더를 정리합니다. 먼저 쓰고 나중에 지우므로 빈 화면 구간이 없습니다.
     PAGES 에는 사진 원본이 없어서(원본은 BLOG_DIR/{번호}/) 통째로 지워도 됩니다 */
  const { readdir } = await import('node:fs/promises')
  const keep = new Set(works.map((w) => w.slug))
  for (const e of await readdir(`${into}/portfolio`, { withFileTypes: true }).catch(() => [])) {
    if (e.isDirectory() && !keep.has(e.name)) await rm(`${into}/portfolio/${e.name}`, { recursive: true, force: true })
    /* 쓰다 만 임시 파일. rename 이 실패하면 남습니다. 점 파일이라 서빙되지는 않지만 정리합니다 */
    if (e.isFile() && e.name.startsWith('.') && e.name.endsWith('.tmp')) await rm(`${into}/portfolio/${e.name}`, { force: true })
  }
  return { pages: written.length, works: works.length, warn }
}

/**
 * 발행된 글을 읽는 질의. 미리보기와 공개 생성이 같은 문장을 쓰고 limit 만 다릅니다
 * (미리보기 12편, 공개 생성 전부).
 * cover 는 배너를 우선하고 없으면 본문에 먼저 나오는 사진을 씁니다(라이브러리의
 * coverAttachmentId 와 같은 규칙). 찾는 대상은 참조(attachment://{id})이지 파일 주소가
 * 아닙니다 — presigned URL 은 만료되고 저장 위치도 바뀌므로 라이브러리가 id 만 남깁니다.
 */
const POSTS_SQL = (limit) => `select p.slug, p.no, p.title, p.body, p.width, p.title_doc, p.published_at,
            (select coalesce(a.thumb, a.file_path) from post_attachments a
              where a.post_id = p.id
                and (a.kind = 'banner' or position('attachment://' || a.attachment_id in p.body) > 0)
              order by (a.kind = 'banner') desc, position('attachment://' || a.attachment_id in p.body)
              limit 1) as cover,
            coalesce(
              (select json_agg(json_build_object('attachment_id', a.attachment_id, 'file_path', a.file_path))
                 from post_attachments a where a.post_id = p.id), '[]'::json) as attachments
       from posts p
      where p.kind = 'post' and p.published_at is not null and not p.hidden
      order by p.published_at desc${limit ? ` limit ${limit}` : ''}`

/**
 * 미리보기. 같은 생성 함수를 다른 폴더로 한 번 더 실행합니다.
 * 렌더러를 두 벌 만들면 미리보기와 실제 화면이 달라지므로 같은 함수를 씁니다.
 * 결과는 관리자 vhost 의 /preview/ 에서만 서빙합니다. 공개면에는 노출하지 않습니다.
 */
export async function bakePreview(pool, conf) {
  resetAssetVersion()
  const into = process.env.PREVIEW_DIR || join(dirname(OUT), 'preview')
  /* 같은지만 비교하면 BLOG_DIR/preview 가 통과합니다. 그러면 저장 전 상태가 /blog/preview/ 로
     공개면에 서빙됩니다. 위 PAGES 가드와 같은 포함 관계 검사를 씁니다 */
  for (const [name, other] of [['BLOG_DIR', OUT], ['PAGES_DIR', PAGES]]) {
    if (nested(realOf(into), realOf(other))) {
      throw new Error(`PREVIEW_DIR 이 ${name} 와 겹칩니다 — 저장 전 모양이 공개면으로 샙니다`)
    }
  }
  /**
   * 두 벌을 생성합니다 — 실제 자료 한 벌, 견본 자료 한 벌.
   * 관리자 미리보기 창은 견본 쪽을 표시합니다. 아무것도 등록하지 않은 사이트에서 빈 목록만
   * 보면 레이아웃을 눈으로 비교할 수 없습니다.
   * 한 벌이 40ms 정도라 400ms 디바운스에 묻힙니다. 버튼을 누를 때만 생성하면 그 버튼이 링크가
   * 아니게 되고 새 탭 여는 시점이 밀려 팝업 차단에 걸립니다.
   * 이전 버전의 출력이 into 바로 아래에 남아 있으면 계속 표시되므로 정리합니다.
   */
  const { readdir: readPrev } = await import('node:fs/promises')
  for (const e of await readPrev(into, { withFileTypes: true }).catch(() => [])) {
    if (e.name !== 'real' && e.name !== 'dummy') await rm(`${into}/${e.name}`, { recursive: true, force: true })
  }
  const r = await bakePages(pool, { into: `${into}/real`, conf, rebase: '/preview/real' })
  const d = await bakePages(pool, { into: `${into}/dummy`, conf, rebase: '/preview/dummy', dummy: true })

  /**
   * 블로그도 같이 생성합니다. 관리자의 블로그 탭이 이 경로를 참조합니다.
   * 생성하지 않으면 그 탭이 404 를 표시하고, 사용자는 무엇이 잘못됐는지 알 수 없습니다.
   *
   * 공개 생성과 같은 함수(listPage, postPage)를 씁니다. 다른 것은 출력 위치뿐입니다.
   * 글이 없으면 목록만 생성합니다. 빈 목록도 목록의 모양을 보여 줍니다.
   */
  const style = themeStyle(conf.theme) + headStyle(conf.header, conf.theme)
  const { rows } = await pool.query(POSTS_SQL(12))
  /* 목록에 표시된 글은 상세까지 전부 생성합니다(최대 12편). 위에서 링크를 미리보기 경로로
     바꿨으므로 생성하지 않은 글을 누르면 404 가 표시됩니다 */
  const blog = async (where, list) => {
    const base = `/preview/${where}`
    await mkdir(`${into}/${where}/blog`, { recursive: true })
    await writeAtomic(`${into}/${where}/blog/index.html`, previewLinks(listPage(list, style, conf), base))
    for (const p of list) {
      await mkdir(`${into}/${where}/blog/${p.slug}`, { recursive: true })
      await writeAtomic(`${into}/${where}/blog/${p.slug}/index.html`, previewLinks(postPage(p, style, conf), base))
    }
  }
  await blog('real', rows)
  /* 견본 글도 상세까지 생성합니다. 목록만 견본이면 제목을 눌렀을 때 404 가 표시됩니다 */
  await blog('dummy', DUMMY_POSTS)
  return { ...r, dummy: d.pages, blog: rows.length }
}

/**
 * 설정을 한 번도 저장하지 않은 사이트의 기본 모양. 어휘 기본값에 이 레포의 색·글꼴을 얹습니다.
 * site.config.mjs 의 theme 이 public/assets/site.css 의 :root 와 같은 값을 갖고 있어야
 * 설정을 안 건드린 사이트의 화면이 안 바뀝니다. 값이 잘못되면 어휘 기본값으로 떨어집니다.
 * 생성기와 관리자 API 가 같은 값을 참조해야 합니다 — 한쪽만 쓰면 미리보기와 실제 화면이
 * 다른 색으로 나갑니다.
 */
export const SITE_DEFAULTS = {
  ...DEFAULTS,
  theme: normalize('theme', site.theme, FONT_VALUES).value || DEFAULTS.theme,
  /* 제목은 여기서 안 채웁니다. 채우면 아무도 안 건드린 사이트의 탭 이름까지 지금 당장
     바뀝니다 — 포트폴리오 목록이 「작업 — 이름」에서 「이름」으로. 빈 값이 곧 site.config.mjs
     를 따른다는 뜻이고(공통헤더 제목과 같은 규약), 관리자에는 그 값을 귀띔으로 보여 줍니다
     (`/api/settings` 의 `siteText`).

     파비콘은 반대로 채웁니다. 관리자의 고르는 칸은 늘 하나가 눌려 있어야 하는데, 비워 두면
     고르는 칸 중 아무것도 안 눌린 채로 떠서 「지금 무엇이 쓰이나」를 화면이 못 말합니다.
     사이트마다 제 아이콘이 다르므로 site.config.mjs 에서 읽습니다. */
  site: normalize('site', { title: '', favicon: faviconOfConfig() }).value || DEFAULTS.site,
}

/**
 * 현재 설정을 읽습니다. site_settings 는 append-only 라 키마다 rev 가 가장 큰 행이 현재
 * 값이고, 행이 없으면 기본값을 씁니다.
 * 생성기는 잘못된 항목을 버리고 나머지로 계속합니다 — 설정 한 줄 때문에 배포가 멈추면
 * 글 하나 고치려던 사용자가 사이트 전체를 잃습니다. 엄격한 쪽은 관리자 API 입니다.
 */
export async function loadConf(pool) {
  const conf = { ...SITE_DEFAULTS }
  /* 테이블이 아직 없는 경우만 허용합니다(첫 배포). 권한·연결 오류까지 삼키면 저장한 색이
     조용히 기본값으로 구워지고 아무 데도 자국이 안 남습니다 */
  const { rows } = await pool.query(
    `select distinct on (key) key, value from site_settings order by key, rev desc`)
    .catch((e) => { if (e.code === '42P01') return { rows: [] }; throw e })
  for (const r of rows) {
    if (!KEYS.includes(r.key)) continue
    /* 글꼴 목록을 넘깁니다. 빈 목록이면 글꼴 검증을 건너뛰어서 DB 에 저장된 아무 문자열이
       CSS 로 나갔습니다. 굽기 쪽 fontStack 도 한 번 더 거릅니다 */
    const { value } = normalize(r.key, r.value, FONT_VALUES)
    if (value) conf[r.key] = value
  }
  return conf
}

/**
 * 발행된 글 전체를 다시 생성합니다. 번호(01, 02…)와 편수가 목록 전체에 걸려 있어 한 편만
 * 고치면 나머지 번호가 어긋나기 때문입니다.
 * 생성은 한 번에 하나만 실행합니다 — 둘이 동시에 돌면 원자적 쓰기의 임시 파일을 서로 뺏고
 * (ENOENT rename) 정리 루프가 상대가 방금 쓴 폴더를 지웁니다. 발행과 설정 저장이 같은 순간에
 * 오면 실제로 납니다. 생성을 부르는 곳이 이 API 하나뿐이라 프로세스 안에서만 막아도 됩니다.
 */
let baking = Promise.resolve()
export function bake(pool) {
  const next = baking.then(() => bakeNow(pool), () => bakeNow(pool))
  baking = next.catch(() => {})            /* 실패가 다음 굽기를 막지 않게 */
  return next
}

async function bakeNow(pool) {
  resetAssetVersion()
  const conf = await loadConf(pool)
  const { rows } = await pool.query(POSTS_SQL(0))
  /**
   * 글 폴더에는 올린 사진도 같이 삽니다 — 통째로 지우고 다시 만들면 원본이 날아갑니다.
   * `index.html` 만 덮어쓰고, 글 자체가 없어진 폴더만 지웁니다.
   * 초안(발행 취소)과 삭제를 가릅니다: 초안은 글이 살아 있으므로 폴더를 남기고 `index.html`
   * 만 치웁니다. 안 그러면 발행을 내렸다가 다시 올릴 때 사진이 사라집니다.
   */
  /**
   * 「존재하는 글」과 「공개 중인 글」은 다릅니다. 숨긴 글은 폴더를 남기고 index.html 만
   * 삭제합니다 — 사진 원본이 그 폴더에 있어 다시 공개할 때 살아나야 합니다.
   *
   * BLOG_DIR 안에는 폴더 이름이 두 종류 섞여 있습니다.
   *   {슬러그}/index.html   글 페이지    (postPage 가 씁니다)
   *   {번호}/{첨부id}       업로드 사진  (admin-api 가 씁니다)
   *
   * 숫자 이름 폴더만 순회하면 슬러그를 지정한 글이 빠져, 글을 내려도 {슬러그}/index.html 이
   * 남아 계속 공개됩니다. 그래서 DB 의 슬러그를 기준으로 순회합니다 — 디스크를 훑지 않으므로
   * 생성기가 만들지 않은 폴더는 건드리지 않습니다.
   */
  /* 글만 훑습니다. 작업(`kind='work'`)은 `/portfolio/{번호}/` 로 나가지 루트의
       `{슬러그}/` 가 아닙니다 — 종류를 안 가르면 작업 슬러그가 같은 이름의 글 폴더를 겨눈다 */
  const alive = await pool.query(
    `select slug, (published_at is not null and not hidden) as pub from posts where kind = 'post'`)
  /** 슬러그 → 공개 중인지 여부 */
  const bySlug = new Map(alive.rows.map((r) => [r.slug, r.pub]))

  await mkdir(OUT, { recursive: true })
  /**
   * 폴더를 삭제하지 않습니다. DB 에 없는 폴더를 rm -rf 하면 안 됩니다. 사진은 글 저장보다
   * 먼저 업로드되므로(번호를 미리 발급해 쌓는 구조) 저장 전인 글의 원본이 그 조건에 걸려
   * 영구히 사라집니다. 삭제한 글의 폴더는 삭제 API 가 이미 휴지통으로 옮깁니다.
   *
   * 비공개 글은 index.html 만 삭제합니다. 키는 슬러그입니다(위 주석 참고).
   */
  for (const [slug, pub] of bySlug) {
    if (!pub) await rm(`${OUT}/${slug}/index.html`, { force: true })
  }
  /**
   * 색과 글꼴은 사이트 전체 설정입니다. 블로그만 옛 색이면 같은 사이트로 인식되지 않습니다.
   * 글 본문의 글꼴은 글마다 저장돼 있어 여기서 안 건드립니다(편집 화면과 달라집니다).
   * 초기 테마는 site.config.mjs 의 theme 에서 옵니다 — 그 값이 레포의 site.css 팔레트와 같아야
   * 설정을 저장하지 않은 사이트의 화면이 안 바뀝니다.
   */
  const style = themeStyle(conf.theme) + headStyle(conf.header, conf.theme)
  await writeFile(`${OUT}/index.html`, listPage(rows, style, conf))
  for (const p of rows) {
    await mkdir(`${OUT}/${p.slug}`, { recursive: true })
    await writeFile(`${OUT}/${p.slug}/index.html`, postPage(p, style, conf))
  }

  /* 생성 결과를 스스로 검사합니다. 생성된 글은 public/ 밖의 볼륨에 있어서 레포를 검사하는
     도구로는 닿지 않습니다. 검사는 결과를 만든 쪽이 합니다 */
  /* 디스크를 세면 생성기가 만들지 않은 폴더까지 세어져서, 손으로 복구한 휴지통 폴더 하나가
     모든 굽기를 영원히 실패시킵니다. 이번에 쓴 것과 발행 수를 맞춥니다 */
  const made = rows.filter((p) => existsSync(`${OUT}/${p.slug}/index.html`))
  if (made.length !== rows.length) {
    throw new Error(`구운 글 ${made.length} ≠ 발행 글 ${rows.length} — 굽기가 빠뜨렸습니다`)
  }
  for (const p of rows) {
    const html = await readFile(`${OUT}/${p.slug}/index.html`, 'utf8')
    /* 폭·여백 규칙이 .prose > .prose-body 두 겹에 걸려 있습니다. 한 겹이면 조용히 깨집니다 */
    if (!/class="prose"/.test(html) || !/class="prose-body"/.test(html)) {
      throw new Error(`${p.slug}: .prose > .prose-body 두 겹이 없습니다`)
    }
    if (html.includes('attachment://')) {
      throw new Error(`${p.slug}: 주소로 못 푼 첨부가 남았습니다`)
    }
    /* 첨부 표에 없는 id 는 라이브러리가 src="" 로 바꿉니다. 그래서 위 검사에 걸리지 않습니다.
       빈 주소는 브라우저가 현재 페이지를 한 번 더 받는 함정이라 여기서 따로 봅니다 */
    if (/\s(?:src|href)=""/.test(html)) {
      throw new Error(`${p.slug}: 빈 주소(src/href)가 있습니다 — 첨부 기록이 빠졌습니다`)
    }
  }
  /* 화면은 블로그 생성이 끝난 뒤에 생성합니다. 화면 생성이 실패해도 블로그는 이미 서빙됩니다 */
  const { pages, works, warn } = await bakePages(pool, { conf })
  return { count: rows.length, pages, works, warn }
}

/** 글 폴더만 골라냅니다. 이름이 숫자인 것만 대상이고 assets, fonts 는 건드리지 않습니다 */
/** 명령줄에서 한 번 굽고 끝냅니다 — `npm run bake` */
export async function bakeOnce() {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({
    host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE,
    user: process.env.PGUSER, password: process.env.PGPASSWORD,
    ssl: pgSsl(),
    /* extensions 를 빼면 crypt()·gen_salt() 를 못 찾습니다 — admin-api.mjs 주석 참조 */
    options: `-c search_path=${process.env.PGSCHEMA},extensions,public`,
    max: 1,
  })
  const r = await bake(pool)
  await pool.end()
  console.log(JSON.stringify(r))
  return r
}
