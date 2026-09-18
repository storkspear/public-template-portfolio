/**
 * 발행된 글을 정적 HTML 로 굽는다.
 *
 * **레포 밖에 굽는다.** 공개 사이트는 `git pull` 로 배포되므로, 추적 중인
 * `public/blog/index.html` 을 서버에서 고쳐 두면 다음 pull 이 로컬 변경과 부딪혀 막힌다.
 * nginx 가 `/blog/` 를 이 디렉터리로 돌려 두었으니 레포는 건드리지 않는다.
 *
 * 본문의 `attachment://{id}` 는 여기서 `/uploads/{id}` 로 푼다 — 라이브러리의
 * `resolveAttachmentSrc` 와 같은 일을, 속성 자리만 바꾸는 같은 방식으로 한다
 * (본문 글자로 적힌 attachment://5 는 건드리지 않는다).
 */
import { mkdir, writeFile, rm, readFile, rename } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { configureFonts, FONT_VALUES } from './vendor/post-editor-core/vocab.js'
import { SITE_FONTS } from '../site.fonts.mjs'

/**
 * 이 레포가 들고 있는 글꼴을 어휘에 더한다. **import 직후에 한 번.**
 *
 * 안 부르면 `title.js` 가 `FONT_VALUES.includes()` 로 걸러 **모르는 글꼴 값을 null 로
 * 지운다** — 편집기에서 고른 제목 글꼴이 발행하면서 기본서체가 된다. 조용히 사라지므로
 * 발행본을 열어 보기 전까지 모른다.
 */
configureFonts({ extra: SITE_FONTS })
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { renderPostHead, normalizeTitle } from './vendor/post-editor-core/title.js'
import { configureAttachments } from './vendor/post-editor-core/attachments.js'
import { toPublishedHtml } from './vendor/post-editor-core/serialize.js'
import site from '../site.config.mjs'
import { pgSsl } from './local.mjs'
import { DEFAULTS, ITEM_LINKS, ITEM_SIZES, KEYS, SHOT_KNOBS, SHOT_MAX, isExternal, mainStart, mutedOn, normalize, PAGE_SAMPLES, PAGE_SOURCE_MINE,
  ICON_OF, SERVICE_ICONS } from '../shared/site-vocab.mjs'
import { MENU_ICON_OF } from '../shared/menu-icons.mjs'
import { DUMMY_POSTS, DUMMY_WORKS } from './dummy.mjs'

/**
 * 첨부를 주소로 푸는 표 — **글마다 다르다.**
 *
 * 파일은 `uploads/{글번호}/` 로 갈라져 있고, 어느 id 가 어디 있는지는 DB 의
 * `post_attachments.file_path` 가 안다. id 에 경로를 박지 않는 이유는 `attachments.ts`
 * 설계 그대로다 — 저장소를 옮기면 지난 글을 전부 고쳐야 한다.
 *
 * 글 하나를 굽기 직전에 이 표를 그 글 것으로 갈아 끼운다.
 */
let current = new Map()
configureAttachments({ resolve: (id) => current.get(id) ?? null })

const OUT = process.env.BLOG_DIR || (() => { throw new Error('.env 에 BLOG_DIR 이 없습니다') })()

/**
 * 판번호 — 브라우저가 CSS 를 제멋대로 오래 들고 있어서, 규칙을 고쳐 올려도 화면이
 * 안 바뀐다(2026-09-14). 레포가 `site.css?v=` 에 쓰는 것과 같은 방식.
 *
 * ⚠ 값은 **CSS 가 마지막으로 바뀐 때**다. 예전에는 「서버가 뜬 시각」이라,
 * `public/` 은 마운트라 고치면 바로 서빙되는데 구운 HTML 은 옛 번호를 들고 있어
 * `immutable` 캐시에 막혀 **화면이 안 바뀌었다** — 고칠 때마다 api 를 다시 띄워야 했다
 * (2026-09-18 사용자 지적). 뜬 시각이 아니라 파일을 보면 그 일이 없어지고, 덤으로
 * CSS 를 안 고친 배포에서는 방문자가 캐시를 그대로 쓴다.
 *
 * 폴더가 없으면(굽기만 떼어 쓰는 환경) 뜬 시각으로 물러선다 — 그 경우 배포가 곧 재시작이다.
 */
const CSS_DIR = new URL('../public/assets/', import.meta.url).pathname
const BOOT = Date.now()
/**
 * ⚠ **기억해 두지 않는다.** 한 번 굽는 동안 열여덟 곳이 부르길래 0.5초만 기억하게 했더니,
 * 방금 고친 CSS 가 그 틈에 들어가 **옛 판번호로 구워졌다**(검사가 잡았다). 그 폴더는
 * 항목 41개(글꼴은 `public/fonts/` 에 따로 산다)라 한 바퀴가 0.27ms 다 — 아낄 값이 아니다.
 *
 * `mtimeMs` 는 소수라 그대로 36진수로 적으면 `mu65b2sj.cwh` 처럼 **점이 섞인다** — 내림한다.
 */
const V = () => {
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
 * 레포가 들고 있는 글꼴(`fonts.local.css`)의 이름들.
 *
 * 화면은 이 시트만 싣는다. 그런데 글꼴 고르개는 에디터 라이브러리 글꼴(`fonts.css` — 본고딕·
 * 본명조·고운체…)까지 보여 줘서, 그걸 고르면 **값은 들어가는데 선언이 없어 기본 글꼴로 떨어졌다**
 * (2026-09-17 실측: 블로그 목록에 Noto Serif KR 선언 0). 고른 글꼴이 여기 없을 때만 큰 시트를 더 싣는다 —
 * 60KB 를 모든 화면에 싣지 않으려고. 글꼴 파일은 어느 쪽이든 쓰인 글자 조각만 받는다.
 */
const LOCAL_FONTS = (() => {
  try {
    const css = readFileSync(new URL('../public/assets/fonts.local.css', import.meta.url), 'utf8')
    return new Set([...css.matchAll(/font-family:\s*['"]?([^'";]+?)['"]?\s*;/g)].map((m) => m[1].trim()))
  } catch { return new Set() }
})()
/** 고른 글꼴 중 하나라도 레포 시트에 없으면 라이브러리 시트 링크를 낸다 */
const fontSheet = (...names) => (names.some((n) => n && !LOCAL_FONTS.has(n))
  ? `<link rel="stylesheet" href="/assets/fonts.css?v=${V()}">\n` : '')

/**
 * 화면(홈·작업 목록·작업 상세)이 구워지는 자리 — **블로그와 다른 폴더**다.
 *
 * 블로그 폴더에는 올린 사진 원본이 같이 산다. 화면 폴더는 100% 다시 만들 수 있는 것만 있어서
 * 통째로 덮어써도 잃을 것이 없다. 둘을 같은 자리로 두면 화면 굽기가 사진을 지운다.
 * 그래서 값이 같으면 **부팅을 막는다** — `.env` 오타 하나가 사진을 지우는 길을 닫는다.
 */
const PAGES = process.env.PAGES_DIR || join(dirname(OUT), 'www')

/**
 * 두 폴더가 **같은 자리인지** 본다.
 *
 * 문자열 비교로는 못 막는다 — `blog/` 처럼 슬래시 하나만 더 붙여도, `www/../blog` 로 적어도,
 * 심볼릭링크로 걸어 두어도 전부 다른 문자열이면서 같은 폴더다(2026-09-16 반박 리뷰가 셋 다
 * 실증했다). 그래서 **실제 경로**로 펴서 보고, 한쪽이 다른 쪽 **안에 들어가는 것도** 막는다.
 * 아직 없는 폴더는 가장 가까운 조상까지 펴서 본다 — 첫 배포에는 `www/` 가 없다.
 */
const realOf = (path) => {
  let at = resolve(path)
  const tail = []
  for (;;) {
    try { return join(realpathSync(at), ...tail.reverse()) } catch { /* 아직 없는 폴더 */ }
    const up = dirname(at)
    if (up === at) return resolve(path)            // 뿌리까지 못 찾았다 — 편 것 없이 그대로
    tail.push(at.slice(up.length + 1))
    at = up
  }
}
/** 한쪽이 다른 쪽이거나 그 안에 들어 있는가 */
const nested = (x, y) => x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)
{
  const a = realOf(PAGES)
  const b = realOf(OUT)
  if (nested(a, b)) {
    throw new Error(`PAGES_DIR(${a}) 과 BLOG_DIR(${b}) 이 같은 자리입니다 — 화면 굽기가 사진을 지웁니다`)
  }
}

/**
 * 반쯤 쓰인 HTML 이 나가지 않게. 다 쓰고 나서 제자리로 옮긴다.
 *
 * 임시 이름은 **점으로 시작한다.** `foo.html.tmp` 로 두면 그 주소가 굽는 동안 열려 있고
 * (`/portfolio/index.html.tmp` 가 200 으로 나왔다), `rename` 이 실패하면 영원히 남는다.
 * 점 파일은 nginx 의 `location ~ /\.` 와 개발 서버가 같이 막는다.
 * 같은 폴더에 두는 것은 `rename` 이 장치를 못 넘기 때문이다.
 */
const writeAtomic = async (path, text) => {
  const tmp = join(dirname(path), `.${basename(path)}.tmp`)
  await writeFile(tmp, text)
  await rename(tmp, path)
}

/**
 * **미리보기 안의 링크를 미리보기 안으로 돌린다.**
 *
 * 구운 화면의 `<a href="/portfolio/">` 는 절대 주소다. 미리보기 iframe 에서 그걸 누르면
 * 브라우저는 **관리자 오리진**의 `/portfolio/` 로 가고, 개발 서버도 nginx 도 거기서
 * 관리자 화면을 돌려준다 — 미리보기 창 안에 관리자가 뜬다(2026-09-16 QA).
 *
 * `<a>` 의 href 만 손댄다. `<link rel=stylesheet>` 와 `<img src>` 는 **진짜 자리**를 봐야 한다
 * (미리보기는 제 옷과 사진을 따로 갖고 있지 않다).
 * `#i1` 같은 조각, `mailto:`, `//바깥주소` 는 `/` 로 시작하지 않거나 `//` 라 안 걸린다.
 */
/* 미리보기가 둘(진짜 자료 · 견본 자료)이라 **어느 쪽으로 돌릴지**를 받는다 */
const previewLinks = (html, base = '/preview') =>
  String(html).replace(/(<a\b[^>]*?\shref\s*=\s*)(["'])\/(?!\/|preview(?:[\/?#"']|$))/gi, `$1$2${base}/`)

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const ymd = (d) => {
  const t = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getFullYear()}.${p(t.getMonth() + 1)}.${p(t.getDate())}`
}

/** 속성 자리의 참조만 주소로 바꾼다. 표에 없는 id 는 **참조를 그대로 둔다** —
    빈 src 로 바꾸면 브라우저가 현재 페이지를 다시 받는다(라이브러리와 같은 규약). */
const resolveAttachments = (html) =>
  String(html || '').replace(
    /(\ssrc=)(["'])attachment:\/\/([^"']+)\2/g,
    (all, lead, q, id) => (current.has(id) ? `${lead}${q}${current.get(id)}${q}` : all),
  )

/**
 * 본문에서 **처음으로 글자가 있는 문단**을 뽑는다.
 *
 * 첫 `<p>` 만 보면 안 된다 — 편집기는 빈 문단을 남기고(사진 아래 빈 줄 하나가 흔하다),
 * 그러면 요약이 빈 문자열이 되어 목록에 아무것도 안 뜬다. 차례로 훑어 첫 알맹이를 쓴다.
 *
 * **실체 참조를 푼다.** 본문은 이미 HTML 이라 `&`는 `&amp;` 로 저장돼 있다. 그대로
 * 돌려주면 부르는 쪽이 `esc()` 를 한 번 더 씌워 `A &amp; B` 가 **글자 그대로** 보인다.
 *
 * **비면 빈 문자열을 돌려준다.** 사이트 설명문으로 떨어뜨리면 목록의 모든 글이
 * 같은 한 줄을 제 요약처럼 달고 선다. 폴백은 `<meta>` 의 몫이다.
 */
/**
 * 코드포인트 하나 — **범위 밖이면 원문을 그대로 둔다.**
 *
 * `String.fromCodePoint` 는 0x10FFFF 를 넘으면 **RangeError 를 던진다.** 글 하나에
 * `&#xFFFFFF;` 가 들어 있으면 굽기 전체가 죽어 사이트가 통째로 안 나간다 —
 * 요약 한 줄 만들자고 낼 대가가 아니다. 아래 `unsafeBit` 의 `safeChar` 와 같은 규약이다.
 */
const codeChar = (n, raw) =>
  (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw)

/**
 * 실체 참조를 푼다 — **반드시 한 패스로.**
 *
 * `replace` 를 여러 번 이어 부르면 **앞 패스가 만든 글자를 뒤 패스가 또 푼다.**
 * 글쓴이가 화면에 `&amp;` 라고 **보이게** 쓰면 본문은 `&#x26;amp;` 로 저장되는데,
 * 16진 패스가 그걸 `&amp;` 로 만들고 이름 패스가 다시 `&` 로 풀어 버린다 —
 * 독자가 보는 글은 `&amp;` 인데 `<meta description>` 만 `&` 가 된다(2026-09-16 리뷰).
 * 교대(`|`) 하나로 훑으면 푼 자리는 다시 안 본다.
 */
const NAMED = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', nbsp: ' ' }
const unesc = (s) =>
  String(s).replace(/&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|quot|apos|amp|nbsp));/gi,
    (m, h, d, name) => (name ? NAMED[name.toLowerCase()]
                             : codeChar(h !== undefined ? parseInt(h, 16) : Number(d), m)))

/**
 * 태그 하나를 훑는 꼴. **속성값 안의 `>` 를 태그 끝으로 착각하지 않는다** —
 * `<p title="a>b">본문` 을 `[^>]*>` 로 읽으면 요약이 `b">본문` 이 되어 그대로
 * `<meta description>` 으로 나간다. 따옴표 묶음을 먼저 건너뛴다.
 */
const TAG = '(?:"[^"]*"|\'[^\']*\'|[^\'">])*'

const summarize = (html, max = 150) => {
  for (const m of String(html || '').matchAll(new RegExp(`<p${TAG}>([\\s\\S]*?)</p>`, 'gi'))) {
    const text = unesc(m[1].replace(new RegExp(`<${TAG}>`, 'g'), ' '))
      /* 제어문자는 버린다 — `&#0;` 는 NUL 을 만들고, NUL 이 든 HTML 은 브라우저가
         U+FFFD 로 바꿔 요약에 검은 마름모가 박힌다 */
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ').trim()
    if (!text) continue
    /* 글자 단위로 자른다 — `.slice()` 는 이모지·일부 한자의 서로게이트 쌍을 반으로 가른다 */
    const chars = [...text]
    return chars.length > max ? chars.slice(0, max).join('').trimEnd() + '…' : text
  }
  return ''
}

/* 사이트 껍데기 — public/blog/index.html 의 머리·머리줄·푸터를 그대로 옮긴 것 */
/**
 * 머리줄 — **모든 화면의 맨 위.** 관리자의 「공통」 탭이 여기를 정한다.
 *
 * 어느 화면이 이것을 이는지는 화면마다의 `chrome` 이 정한다 — 첫 화면은 기본으로 안 인다.
 *
 * 서랍은 **자바스크립트를 안 쓴다.** 숨은 확인칸 하나와 그것을 가리키는 라벨 둘로 여닫는다
 * (작업 확대의 `:target` 과 같은 결이되, 주소·히스토리를 안 건드린다).
 *
 * ⚠ 서랍 판은 `<header>` **밖**에 있다. `.s-head` 가 `backdrop-filter` 를 들고 있어서
 * 그 안의 `position:fixed` 는 뷰포트가 아니라 **머리줄 66px 띠**를 기준으로 잘린다.
 */
const headerHtml = (h, navAll, brand) => {
  /**
   * 메뉴에 거는 곳 — 관리자가 **이름을 바꾸거나 숨긴** 값을 입힌다.
   * 주소로 짝을 짓는다(`/portfolio/` ↔ portfolio). 짝이 없는 항목(바깥 링크 등)은 그대로 둔다 —
   * 관리자에서 고를 수 없는 것을 굽기가 멋대로 지우면 안 된다.
   */
  const byHref = { '/portfolio/': 'portfolio', '/blog/': 'blog' }
  const nav = navAll.flatMap((n) => {
    const l = h.links?.[byHref[n.href]]
    if (!l) return [n]
    return l.show ? [{ ...n, label: l.label || n.label, icon: l.icon }] : []
  })
  /**
   * 차례 — 관리자의 ↑↓ 가 정한 순서로 **짝이 있는 것들끼리만** 자리를 바꾼다.
   *
   * 짝이 없는 항목(`site.config.mjs` 에 직접 적은 바깥 링크 등)은 **제 자리에 못 박는다** —
   * 위 주석과 같은 규율이다: 관리자에서 고를 수 없는 것을 굽기가 멋대로 옮기면 안 된다.
   * 자리를 훑어 가며 옮길 수 있는 것만 차례대로 끼워 넣으므로 고정 항목의 위치가 안 흔들린다.
   */
  const ordered = (() => {
    const movable = nav.filter((n) => byHref[n.href])
      .sort((p, q) => (h.links[byHref[p.href]].order ?? 0) - (h.links[byHref[q.href]].order ?? 0))
    let k = 0
    return nav.map((n) => (byHref[n.href] ? movable[k++] : n))
  })()
  const drawer = h.menu === 'sidebar'
  /* 늘 보이는 기둥은 접히지 않으므로 햄버거가 할 일이 없다 — 없앤다(사용자 결정) */
  /* 「고정」은 늘 서 있으므로 여는 단추가 없다 */
  const burger = drawer && h.sidebar.kind !== 'rail'
  /**
   * 메뉴 아이콘 — **서랍의 「아이콘」 벌일 때만** 낸다.
   *
   * 늘 박고 CSS 로 숨기면 안 쓰는 화면까지 도형 값을 실어 나른다. 벌이 바뀌면 클래스가
   * 바뀌어 어차피 다시 굽으므로, 필요할 때만 내는 편이 싸다.
   *
   * 껍데기(색·굵기)는 여기서 씌운다 — 데이터는 도형만 들고 있다(`shared/menu-icons.mjs`).
   * `currentColor` 라 메뉴 글자색과 오버가 그대로 먹고, `aria-hidden` 이라 읽어 주지 않는다
   * (바로 옆에 같은 뜻의 글자가 있다).
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
  /* 이름 자리 — 글·작업 상세에서는 부르는 쪽이 「← 글 목록」을 넘긴다(돌아갈 곳이 곧 이름 자리다) */
  const name = brand || `<a class="s-name" href="/">${esc(h.title || site.brand)}</a>`
  /**
   * 서랍 여닫개는 **진짜 확인칸**이다 — `hidden` 이 아니라 눈으로만 숨긴다.
   *
   * `hidden` 으로 두었더니 초점을 못 받아 **키보드로는 서랍을 열 방법이 없었고**, 닫힌 서랍의
   * 링크가 화면 밖에서 Tab 을 먼저 가져갔다(반박 리뷰 M3). 확인칸이 초점을 받으면 Space 로
   * 열리고, 화면읽기는 「메뉴, 체크 상자, 선택됨」으로 열림 상태를 읽어 준다.
   * 라벨(햄버거·닫기·막)은 마우스용이라 읽기에서 뺀다 — 같은 것을 두 번 읽으면 헷갈린다.
   * `autocomplete="off"` — 서랍 링크로 나갔다가 뒤로 오면 열린 채 복원되는 것을 줄인다.
   * 기둥은 늘 열려 있어 여닫개가 없다.
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
  /* 격자에 햄버거 칸을 더하는 것은 **햄버거가 있을 때만** — 기둥 모드에 빈 칸이 남아
     이름이 본문 왼쪽 선보다 16px 들어가 있었다(리뷰 minor 7) */
  return `${drawerPart}<header class="s-head s-at-${esc(h.align)} s-w-${esc(h.width)}${burger ? ' s-head-drawer' : ''}">
  <div class="wrap">
${burgerPart}    ${name}
${navPart}  </div>
</header>`
}

/**
 * 공통헤더의 수치 — 값만 갈아 끼우면 모양이 바뀐다(관리자에서 즉시 반영).
 *
 * 색은 **정했을 때만** 낸다. 비어 있으면 변수를 아예 안 만들어야 CSS 의 대체값
 * (본문 테마 색)이 산다 — `--hd-bg: ;` 처럼 빈 값을 내면 대체값도 안 먹고 배경이 사라진다.
 * 글꼴은 늘 낸다: 화면별 본문 글꼴이 바뀌어도 공통헤더는 **한 서체**여야 공통이다.
 */
/**
 * 사이트의 본문 폭 한 줄 — 「화면 폭」이면 제한을 아예 안 건다(`max-width: none`).
 * 자리마다 narrow/wide 를 고르던 것을 **여기 하나로** 모았다(2026-09-18 사용자 지시).
 * 머리줄만 예외로 제 스위치를 갖는다 — 본문은 좁게, 상단 띠는 화면 끝까지가 흔한 판짜기라서다.
 */
const bodyW = (t) => (t.width === 'wide' ? 'none' : `${Math.round(t.bodyWidth)}px`)

/**
 * 푸터 판의 폭 — **본문 폭을 그대로 따르되, 「화면 폭」일 때만 1240 에서 멈춘다.**
 *
 * 판은 제 폭으로 단위(`--u`)를 만들어 좌표·글자·높이가 전부 그 배수다. 본문 폭을 숫자로
 * 고른 사이트는 첫 화면 판도 같은 배수로 커지므로 푸터만 따로 놀 이유가 없다 — 같은 수를
 * 쓰면 푸터의 판면선이 본문 글과 정확히 맞는다(둘 다 그 폭 안에 가운데로 선다).
 *
 * 「화면 폭」(`--body-w: none`)만 다르다: 판이 화면만큼 넓어져 **27인치에서 높이와 글자가
 * 두 배가 된다**(2560px = 2.06배). 푸터는 정보 띠라 그건 사고다 — 거기서만 1240 으로 멈춘다.
 *
 * ⚠ CSS 에서 `min(var(--body-w), 1240px)` 로 하면 안 된다 — 「화면 폭」일 때 `--body-w` 가
 *   `none` 이라 `min()` 이 통째로 무효가 되고, 상한이 **조용히 사라진다**. 숫자로 낸다.
 */
const footW = (t) => (t.width === 'wide' || !Number.isFinite(t.bodyWidth)
  ? '1240px' : `${Math.round(t.bodyWidth)}px`)

/**
 * ⚠ 본문 폭(`--body-w`)을 **여기에도** 낸다. 직접 디자인 화면은 테마(`themeStyle`)를 한 글자도
 * 안 받지만(`pageStyle` 머리말), 그 화면에 공통헤더를 켜면 머리줄은 굽기가 그린 것이라
 * 사이트의 본문 폭을 따라야 한다. `--hd-*` 가 같은 예외를 쓰는 것과 같은 까닭이다.
 */
const headStyle = (h, theme) => `<style data-head>
:root {
  --body-w: ${bodyW(theme)};
  --hd-h: ${Math.round(h.height)}px;
  --hd-size: ${(h.size ?? 100) / 100};
${h.bg ? `  --hd-bg: ${h.bg};\n` : ''}${h.color ? `  --hd-fg: ${h.color};\n` : ''}  --hd-font: ${fontStack(h.font || theme.body, 'sans')};
${btnVars(h)}}
</style>
`

/**
 * 메뉴버튼 색 — 이것도 **정했을 때만** 낸다(비면 헤더 색을 따르는 대체값이 산다).
 * 배경을 정하면 글자가 버튼 가장자리에 붙지 않게 안쪽 여백을 같이 낸다. 「채운 색」 서랍은
 * 바탕을 뒤집어 쓰므로 배경을 정했을 때만 버튼 글자색으로 바꾼다(`--hd-btn-solid-fg`) —
 * 글자색만 정하면 뒤집힌 바탕 위에서 묻힐 수 있다.
 * ⚠ 관리자의 `liveCss` 가 같은 이름을 낸다. 한쪽만 고치면 미리보기가 거짓말을 한다.
 */
/**
 * 메뉴 한 줄의 미세조정 — **자리마다 따로** 낸다(`--nav-*` / `--dr-*`).
 * 예전에는 둘이 `--hd-btn-*` 하나를 겸해, 머리줄을 만지면 사이드바가 같이 바뀌었다.
 *
 * ⚠ **안 정한 값은 안 낸다.** 내면 CSS 의 폴백(`var(--x, 기본)`)이 죽어, 「비우면 윗 색을
 * 따른다」는 규약이 무너진다. 배경을 정했을 때만 안쪽 여백이 같이 오는 것도 그대로다 —
 * 배경 없이 여백만 주면 글자 자리가 이유 없이 밀린다.
 */
const itemVars = (it, pre, headColor) => {
  const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
  let out = ''
  if (it.radius) out += `  --${pre}-radius: ${Math.round(it.radius)}px;\n`
  if (it.border) out += `  --${pre}-border: ${Math.round(it.border)}px;\n`
  if (isHex(it.color)) out += `  --${pre}-fg: ${it.color};\n`
  if (isHex(it.bg)) {
    const fg = [it.color, headColor].find(isHex)
    out += `  --${pre}-bg: ${it.bg};\n  --${pre}-py: 4px;\n  --${pre}-px: 10px;\n`
    out += `  --${pre}-solid-fg: ${fg || 'var(--fg)'};\n`
  }
  return out
}
/** 사이드바 판 — 넓이·배경·글자색. 배경만 주면 글자가 묻히므로 **글자색을 짝으로** 낸다 */
const sideVars = (sb) => {
  const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
  let out = `  --dr-w: ${Math.round(sb.width)}px;\n`
  if (isHex(sb.bg)) out += `  --dr-panel-bg: ${sb.bg};\n`
  if (isHex(sb.color)) out += `  --dr-panel-fg: ${sb.color};\n`
  return out
}
const btnVars = (h) => itemVars(h.nav || {}, 'nav', h.color)
  + itemVars(h.drawer || {}, 'dr', h.color)
  + (h.menu === 'sidebar' ? sideVars(h.sidebar) : '')

/**
 * 글꼴 이름을 CSS 에 넣기 전에 **모양을 확인한다.**
 *
 * 정규화가 글꼴 목록으로 거르지만 굽기는 관대하게 읽는다 — DB 에 `x}</style><script>` 같은 값이
 * 들어 있으면 그대로 공개면 `<style>` 을 닫고 스크립트가 나갔다(반박 리뷰 minor 9).
 * 글꼴 이름은 글자·숫자·공백·하이픈이면 충분하다. 아니면 기본으로 돌린다.
 */
const fontStack = (name, kind) => {
  const safe = /^[\p{L}\p{N} _-]{1,60}$/u.test(String(name || '')) ? String(name) : ''
  return kind === 'display'
    ? `${safe ? `'${safe}', ` : ''}'Apple SD Gothic Neo', serif`
    : `${safe ? `'${safe}', ` : ''}'Apple SD Gothic Neo', system-ui, sans-serif`
}

/** 화면별 글꼴 — 정한 것만 덮는다. 비어 있으면 사이트 기본(themeStyle)이 그대로 산다 */
const pageFontStyle = (font) => (font && (font.display || font.body) ? `<style data-font>
:root {
${font.display ? `  --display: ${fontStack(font.display, 'display')};\n` : ''}${font.body ? `  --sans: ${fontStack(font.body, 'sans')};\n` : ''}}
</style>
` : '')

/** 목록 머리의 모양 — 화면마다 다르다(블로그·포트폴리오가 제 값을 갖는다) */
const lhStyle = (head) => `<style data-lh>
:root {
  --lh-size: ${{ sm: '0.82', md: '1', lg: '1.35' }[head.size] || '1'};
  --lh-align: ${head.align === 'center' ? 'center' : 'left'};
  --lh-gap: ${Math.round(head.gap || 0)}px;
}
</style>
`

const shell = ({
  title, description, canonical, head = '',
  /* 비워 두면 사이트 이름. 글·작업 상세는 여기에 「← 글 목록」을 넘긴다 —
     돌아갈 곳이 곧 이름 자리라는 규약이다. **null 이어야** 머리줄 설정의 제목이 산다 */
  brand = null,
  /* 머리줄 항목 — 지금 보고 있는 화면에 `aria-current` 가 붙어야 해서 화면마다 다르다.
     값은 `navFor()` 가 정한다(`page` = 이 페이지, `true` = 이 페이지를 품은 묶음) */
  nav = navFor(null),
  /* 푸터 셋: 'pages' 는 다 보고 난 자리(글·작업), 'main' 은 연락이 목적지인 홈,
     'none' 은 조각이 제 푸터를 갖고 있는 「직접 디자인」 화면.
     모양은 설정(`footer`)이 정한다 — 안 넘기면 기본값으로 지금 모습 그대로 나간다 */
  foot = 'pages',
  footer = DEFAULTS.footer,
  /* 푸터의 유도색(흐린 글자·선)을 낼 때 기준이 되는 색 묶음 — 안 넘기면 어휘 기본 테마 */
  colors = DEFAULTS.theme,
  /* 색·글꼴을 얹을 자리. **`</head>` 직전**이어야 prose.css 를 이긴다(3단계에서 쓴다) */
  theme = '',
  /**
   * 머리줄의 **모양**. 안 넘기면 사이트 이름 + `site.nav` 로 된 기본 머리줄이 나간다.
   * 이 값은 어느 화면에 머리줄이 붙는지는 안 정한다 — 그건 `chrome` 이 한다.
   */
  header = null,
  /**
   * 이 화면이 **공통헤더를 이는가.** 끄면 머리줄이 한 줄도 안 나간다 —
   * 첫 화면처럼 제 머리를 본문이 직접 갖고 있는 화면을 위한 것이다(`main.chrome`).
   */
  chrome = true,
  body,
}) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="stylesheet" href="/assets/site.css?v=${V()}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
 * 목록 머리 — 「글 / 5편」과 「작업 / 9편」. **두 목록이 같은 부품을 쓴다.**
 *
 * ⚠ 두 목록이 제목 크기·숨기기를 **따로 갖게 두면 갈린다.** 같은 자리에 같은 모양으로
 * 서는 것이면 정하는 자리도 하나다 — 이름·보이기·크기·정렬·편수 전부 각 화면이
 * 같은 모양으로 갖는다(`blog.head`·`portfolio.head`).
 *
 * 숨기면 **아무것도 안 그린다** — 맨 위부터 그림이 차야 숨긴 값어치가 있다.
 */
const listHead = (head, count) => head.show ? `  <div class="lh">
    <h1>${esc(head.name)}</h1>
${head.count && count ? `    <p class="lh-count">${count}편</p>\n` : ''}  </div>
` : ''

/**
 * 「직접 디자인」 화면의 본문 — 레포의 `pages/<이름>.html`(내 파일) 또는 관리자에서 고른
 * `sample-pages/<샘플>.html` 을 그대로 읽는다. 어느 쪽이든 **읽기만** 한다(`PAGE_SAMPLES` 참고).

 *
 * 조각의 정의는 **「`<body>` 안에서 공통헤더를 뺀 전부」**다. 푸터까지 조각이 갖는다 —
 * 그래서 이 길로 굽는 화면은 `foot:'none'` 이다. 머리만 `chrome` 이 위에 얹는다.
 *
 * 없거나 비어 있으면 **빈 문자열**이다(오류가 아니다). 처음부터 쓰는 사람은 하얀 대지에서
 * 시작하고, 관리자 미리보기도 같은 것을 보여 준다 — 미리보기가 거짓말을 안 하는 쪽이다.
 *
 * ⚠ 이 조각은 **레포 파일**이라 `unsafeBit` 의 뜻이 다르다. 관리자로 들어온 남의 HTML 이
 * 아니라 레포를 가진 사람이 쓴 것이므로 `<script>` 가 정당하다 — 검사는 `bakePages` 에서
 * 이 길만 건너뛴다(`tools/check-public.mjs` 가 대신 크기를 잰다).
 */
/**
 * 공통헤더의 옷. **굽기가 머리줄을 그릴 때만 싣는다.**
 *
 * 조각이 제 머리줄을 갖는 화면(`mode:'code'` + 공통헤더 끔)에 이걸 실으면
 * `.s-head > .wrap` 이 격자로 덮여 손으로 맞춘 한 줄이 무너진다 — 정렬 칸(`s-at-*`)이
 * 없는 마크업이라 셋이 왼쪽으로 몰린다.
 *
 * 템플릿 화면은 머리줄을 껐어도 싣는다 — 목록 머리(`.lh`)의 옷이 같은 파일에 있다.
 */
const headerCss = (chrome, mode) =>
  chrome || mode === 'template' ? `<link rel="stylesheet" href="/assets/templates/header.css?v=${V()}">\n` : ''

/**
 * 조각이 **제 머리줄을 갖는가** — 태그가 있느냐가 아니라 **어디에 있느냐**로 가른다.
 *
 * `<header>` 는 문단의 머리에도 쓰는 보통의 태그다. 첫 화면 조각은 `<main>` **안**에
 * `<header class="m-id">`(이름과 역할)를 갖고 있는데, 그건 머리줄이 아니라 그 화면의 내용이다.
 * 있기만 하면 잡는 검사는 그걸 머리줄로 오해해 멀쩡한 조합을 막았다.
 *
 * 머리줄은 **본문보다 위**에 선다. 그래서 첫 `<main` 보다 앞에 `<header` 가 있을 때만 참이다.
 * `<main>` 이 아예 없는 조각은 전부가 본문이므로, 그 안의 `<header>` 도 머리줄로 본다.
 */
const ownsHeader = (src) => {
  const head = src.search(/<header[\s>]/i)
  if (head < 0) return false
  const main = src.search(/<main[\s>]/i)
  return main < 0 || head < main
}

/**
 * 그 화면에 얹을 색·글꼴.
 *
 * **직접 디자인 화면에는 테마를 한 글자도 안 넣는다.** 소스코드로 꾸민다는 것은 색까지
 * 그 사람이 정한다는 뜻이고, 넣으면 `site.css` 에 골라 둔 별색·표제 글꼴을 관리자 값이
 * 말없이 덮는다. 화면별 글꼴(`pageFontStyle`)과 목록 머리 모양도 같은 이유로 안 넣는다 —
 * 그 손잡이들은 직접 디자인에서 잠겨 있으므로, 잠긴 값이 화면에 나가면 앞뒤가 안 맞는다.
 *
 * 머리줄 변수(`--hd-*`)는 **남긴다.** 그 머리줄은 굽기가 그린 것이라 관리자 값이 맞다.
 */
const pageStyle = (ctx, key, extra = '') => ctx[key].mode === 'code'
  ? (ctx[key].chrome ? headStyle(ctx.header, ctx.theme) : '')
  : ctx.style + pageFontStyle(ctx[key].font) + extra

const PAGES_SRC = new URL('../pages/', import.meta.url)
const SAMPLES_SRC = new URL('../sample-pages/', import.meta.url)

/**
 * 그 화면이 **실제로 읽는 파일** — 레포 안의 상대 경로(안내·경고 문구에 그대로 쓴다).
 *
 * `source` 는 정규화를 거쳐 오지만 여기서 **한 번 더** 어휘의 목록과 맞춘다 — 값이 그대로
 * 파일 이름이 되는 자리라, 정규화를 건너뛴 호출이 하나라도 생기면 `../` 로 레포 밖을 읽는다.
 * 목록 밖이면 내 파일로 떨어진다(굽기는 관대하다).
 */
const fragmentPath = (page, source) =>
  source !== PAGE_SOURCE_MINE && (PAGE_SAMPLES[page] || []).some((x) => x.value === source)
    ? { rel: `sample-pages/${source}.html`, url: new URL(`${source}.html`, SAMPLES_SRC) }
    : { rel: `pages/${page}.html`, url: new URL(`${page}.html`, PAGES_SRC) }

/** 조각을 읽는다. 없으면 `missing` — 내 파일이 비어 있는 것은 정상(빈 대지)이지만 고른 샘플이 없는 것은 알린다 */
const readFragment = async (page, source = PAGE_SOURCE_MINE) => {
  const { rel, url } = fragmentPath(page, source)
  let missing = false
  const raw = (await readFile(url, 'utf8').catch(() => { missing = true; return '' })).trim()
  /* 파일 **맨 앞의 주석 한 덩이**는 그 파일의 설명서다(어디를 고치면 되는지). 레포 안에서만
     쓸모가 있으므로 화면으로는 안 내보낸다 — 방문자에게 레포 구조를 알릴 이유가 없다.
     안쪽 주석은 그대로 둔다: 글쓴이가 화면에 남기려고 쓴 것일 수 있다. */
  const html = raw.startsWith('<!--') ? raw.slice(raw.indexOf('-->') + 3).trimStart() : raw
  return { rel, html, missing }
}

/** 100편이면 `001`…`100` — 자릿수가 늘어도 번호 열이 안 흔들린다 */
const digitsOf = (posts) => Math.max(2, String(posts.length).length)
const yearOf = (p) => new Date(p.published_at).getFullYear()
/**
 * 연도 라벨 — 목록이 **두 해 이상**에 걸칠 때만 넣는다.
 * 한 해뿐인데 연도를 찍으면 정보가 아니라 장식이 된다.
 * 포트폴리오의 `.p-group` 과 같은 어휘다 — 라벨 밑에 다음 행의 윗선이 밑줄로 붙는다.
 */
function yearLabel(posts, i, always = false) {
  if (!always && new Set(posts.map(yearOf)).size < 2) return ''
  if (i > 0 && yearOf(posts[i - 1]) === yearOf(posts[i])) return ''
  return `    <li class="b-year"><span>${yearOf(posts[i])}</span></li>\n`
}

/** 연도 라벨을 갖는 갈래 — 줄 계열만(격자에서는 li 하나가 칸 하나라 라벨이 칸을 민다) */
const YEARED = new Set(['rows', 'ledger', 'lines', 'runin', 'feed'])

/**
 * 읽는 시간(분) — 한글은 분당 500자, 라틴은 분당 230단어. 코드 블록은 읽는 글이 아니라 뺀다.
 * 공백까지 세면 영어 1000단어가 「10분」으로 나왔다. 최소 1분. 보일지는 갈래가 정한다
 */
const readMinutes = (html) => {
  const text = unesc(String(html || '')
    .replace(new RegExp(`<pre${TAG}>[\\s\\S]*?</pre>`, 'gi'), ' ')
    .replace(new RegExp(`<${TAG}>`, 'g'), ' '))
  const hangul = (text.match(/[\u3131-\u318e\uac00-\ud7a3]/g) || []).length
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length
  return Math.max(1, Math.round(hangul / 500 + words / 230))
}

/** 날짜 조각 — 「16 / 9월」「2026년 9월 16일」처럼 CSS 가 다시 조립할 수 있게. `ymd` 와 같은 시간대. 숫자뿐이라 주입 통로가 없다 */
const dateAttrs = (d) => {
  const t = new Date(d)
  return ` data-y="${t.getFullYear()}" data-m="${t.getMonth() + 1}" data-d="${t.getDate()}"`
}

/**
 * 첫 문단 한 줄 — **없으면 칸 자체를 안 만든다.**
 *
 * 빈 `<span>` 을 남기면 카드·썸네일에서 `margin-top` 만큼 여백이 생겨, 첫 문단이 있는 글과
 * 없는 글의 줄 높이가 갈린다. 없는 것은 안 그리는 쪽이 목록을 고르게 만든다.
 */
const ledeOf = (p) => {
  const lede = summarize(p.body, 110)
  return lede ? `          <span class="b-lede">${esc(lede)}</span>\n` : ''
}

/**
 * 글 목록 — **열두 벌이 같은 마크업을 쓴다.**
 *
 * 줄마다 번호·대표 이미지·제목·날짜·첫 문단이 다 들어 있고, 무엇을 보여 줄지는
 * CSS 가 정한다(`blog.css` 의 `.bl-*`). 그래서 목록 모양을 바꿔도 굽기는 한 벌이고,
 * 고른 값이 마크업을 안 건드리므로 관리자에서 만지는 즉시 반영된다 — 포트폴리오와 같은 규약.
 *
 * 연도 라벨은 줄 계열(`YEARED`)에서만 뜻이 있다(격자에서는 줄이 아니라 칸이라 자리가 없다).
 * 날짜 조각(`data-y/m/d`)과 읽는 시간(`b-read`)은 늘 굽고, 보일지는 갈래의 CSS 가 정한다.
 */
const listPage = (posts, style, conf = DEFAULTS) => shell({
  theme: style + pageFontStyle(conf.blog.font) + lhStyle(conf.blog.head),
  footer: conf.footer, colors: conf.theme,
  header: conf.header,
  chrome: conf.blog.chrome,
  title: site.siteTitle,
  description: site.description,
  canonical: `${site.origin}/blog/`,
  nav: navFor('/blog/'),
  /* 목록도 글꼴 선언을 실어야 한다 — 표제 글꼴이 이 레포 소유(fonts.local.css)면
     안 실은 목록은 대체 글꼴로 그려져, **같은 제목이 목록과 글에서 서체가 갈린다.** */
  head: `<link rel="stylesheet" href="/assets/blog.css?v=${V()}">
<link rel="stylesheet" href="/assets/templates/blog.css?v=${V()}">
<link rel="stylesheet" href="/assets/templates/header.css?v=${V()}">
${fontSheet(conf.theme.display, conf.theme.body, conf.header?.font, conf.blog.font.display, conf.blog.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${V()}">\n`,
  /* 목록 폭은 제 것이 없다 — `.wrap` 이 사이트의 `--body-w` 를 그대로 따른다 */
  body: `<main class="wrap">

${listHead(conf.blog.head, posts.length)}
  <ul class="bl bl-${esc(conf.blog.template)}">
${posts.map((p, i) => (YEARED.has(conf.blog.template) ? yearLabel(posts, i, conf.blog.template === 'feed') : '') + `    <li class="b-item">
      <a href="/blog/${encodeURIComponent(p.slug)}/">
        <span class="b-no">${String(i + 1).padStart(digitsOf(posts), '0')}</span>
        <span class="b-shot">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : ''}</span>
        <span class="b-body">
          <span class="b-title">${esc(p.title)}</span>
${ledeOf(p)}        </span>
        <span class="b-date"${dateAttrs(p.published_at)}>${ymd(p.published_at)}</span>
        <span class="b-read">${readMinutes(p.body)}분</span>
      </a>
    </li>`).join('\n')}
  </ul>
</main>`,
})

/**
 * 본문 한 벌 — **글과 작업이 같은 길을 쓴다.**
 *
 * **발행 시점 보정을 거친다.** 편집기의 `getHTML()` 을 그대로 쓰면 표 감싸개와 코드
 * 굽기가 빠져 발행 페이지가 편집 화면과 다른 구조로 나간다(attachments.ts 주석 참조).
 * 이 한 줄이 빠져 있던 게 2026-09-14~15 의 「표가 이상하다」였다. 두 번 겪지 않으려고
 * 함수로 묶는다 — 작업 상세가 제 것을 따로 짜면 같은 사고가 그쪽에서 다시 난다.
 *
 * ⚠ 첨부 표(`current`)는 **이 문서를 그리기 전에** 깔려 있어야 한다. 제목 배너도 그 표를
 * 보고 주소를 찾으므로, 배너를 먼저 그리면 `<img src="">` 가 나간다(2026-09-16 에 실제로 났고
 * 굽기의 「빈 주소」 검사가 잡았다). 그래서 표 깔기를 **따로 떼어** 이름을 줬다.
 */
const seedAttachments = (p) => {
  current = new Map((p.attachments || []).map((a) => [a.attachment_id, a.file_path]))
}
const articleBody = (p) => {
  seedAttachments(p)
  return resolveAttachments(toPublishedHtml(p.body || ''))
}

const postPage = (p, theme, conf = DEFAULTS) => {
  seedAttachments(p)                         /* 제목 배너도 이 표를 본다 — 본문보다 먼저 깐다 */
  const body = articleBody(p)
  /* 폭은 글마다 저장돼 있다 — 안 적혀 있으면 라이브러리 기본(38rem) 이 산다 */
  const w = p.width && /^-?[\d.]+(px|rem|em|%|vw|ch)$/.test(p.width) ? p.width : null
  const widthAttr = w ? ` style="--measure-override:${w}"` : ''
  /**
   * 제목·배너는 **라이브러리가 그린다.** 여기서 손으로 마크업을 짜면 편집 화면과
   * 발행 페이지의 DOM 이 갈라져, 배너 위치·글꼴·크기가 조용히 달라진다.
   * 편집기가 `bleed="viewport"` 로 그리므로 여기도 같은 값을 준다.
   */
  /**
   * 작성 일시는 **제목과 같은 덩어리** 안에 넣는다. 본문 위에 따로 한 줄로 두면
   * 배너와 본문 사이에 낯선 띠가 하나 생긴다.
   *
   * `renderPostHead` 는 라이브러리가 그리므로 결과 문자열의 닫는 태그 앞에 끼워 넣는다 —
   * 여기서 머리줄 마크업을 직접 짜면 편집 화면과 DOM 이 갈라진다.
   */
  /* 제목 값은 한 벌만 만든다. title_doc 이 없는 옛 글도 **같은 렌더러**를 태운다 —
     손으로 마크업을 짜면 인라인 style 이 빠져 서체·크기·정렬이 조용히 달라진다. */
  const t = normalizeTitle(p.title_doc || { text: p.title })
  /* 날짜는 제목의 이웃이라 정렬도 따라가야 한다. 가운데 제목 밑에 왼쪽 날짜가 붙으면 어긋난다 */
  const when = `<time class="b-when" datetime="${new Date(p.published_at).toISOString()}"` +
               ` style="text-align:${t.align}">${ymd(p.published_at)}</time>`
  const head = '  ' + renderPostHead(t, 'viewport').replace(/<\/header>\s*$/, when + '</header>')
  return shell({
    theme: theme + pageFontStyle(conf.blog.font),
    footer: conf.footer, colors: conf.theme,
    chrome: conf.blog.chrome,
    header: conf.header,
    title: `${p.title} — ${site.siteTitle}`,
    description: summarize(body) || site.description,
    canonical: `${site.origin}/blog/${encodeURIComponent(p.slug)}/`,
    nav: navFor(`/blog/${encodeURIComponent(p.slug)}/`),
    /* 글을 읽는 중에는 이름 자리가 **돌아갈 곳**이다.
       본문 위에 따로 줄을 만들면 배너가 머리줄에서 떨어지고, 이름 옆에 덧붙이면
       머리줄에 항목이 셋이 되어 어디를 눌러야 목록인지 흐려진다. */
    brand: '<a class="s-name s-back" href="/blog/"><span aria-hidden="true">←</span>글 목록</a>',
    head: `<link rel="stylesheet" href="/assets/blog.css?v=${V()}">
<link rel="stylesheet" href="/assets/templates/blog.css?v=${V()}">
<link rel="stylesheet" href="/assets/fonts.css?v=${V()}">
<link rel="stylesheet" href="/assets/templates/header.css?v=${V()}">
<link rel="stylesheet" href="/assets/fonts.local.css?v=${V()}">
<link rel="stylesheet" href="/assets/prose.css?v=${V()}">
<style>
  /* 배너가 화면 끝까지 가려고 width:100vw 를 쓴다. 100vw 는 세로 스크롤바 폭을
     포함하므로, 막지 않으면 스크롤바가 자리를 차지하는 환경에서 가로 스크롤이 생긴다.
     라이브러리는 남의 html 을 못 건드리므로 소비자인 여기서 막는다.
     **이 한 줄만 페이지 안에 둔다** — html 은 클래스로 가를 수 없어서다. 나머지는 blog.css. */
  html { overflow-x: hidden; }
</style>
`,
    /* 목록과 **한 벌**로 움직인다 — 몸통에 같은 이름을 달아 활자 크기·여백이 따라간다.
       마크업은 그대로고 옷만 갈린다(`templates/blog.css` 의 `.bp-*`) */
    body: `<main class="wrap b-post bp-${esc(conf.blog.template)}"${widthAttr}>
${head}

  <article class="prose">
    <div class="prose-body">
${body}
    </div>
  </article>
</main>`,
  })
}

/* ── 화면: 홈 · 작업 목록 · 작업 상세 ────────────────────────────────────────
   블로그와 달리 이 셋은 **`blog.config.mjs` 의 `pages` 를 켠 사이트만** 굽는다.
   끈 사이트는 레포의 `public/*.html` 이 그대로 나간다 — 코드를 직접 고쳐 쓰는 길이다.
   산출물은 `PAGES`(블로그와 다른 폴더), 서빙은 nginx 가 이 둘만 덮어쓴다. */

/**
 * 머리줄에서 지금 자리를 표시한다. **두 값을 가른다** —
 * 그 주소가 곧 지금 페이지면 `page`, 지금 페이지를 품은 묶음이면 `true`.
 *
 * 글 상세에서 「블로그」에 `page` 를 붙이면 스크린리더는 「현재 페이지」라고 읽는데
 * 눌러 보면 다른 데로 간다. 묶음은 묶음이라고 말해야 한다.
 */
const navFor = (here) => site.nav.map(({ current, ...n }) => {
  if (n.external || !here) return n
  if (n.href === here) return { ...n, current: 'page' }
  return here.startsWith(n.href) ? { ...n, current: 'true' } : n
})

/** 작업 주소. **한 곳에서만 만든다** — 링크와 폴더 이름이 갈리면 죽은 링크가 된다 */
const workHref = (slug) => `/portfolio/${encodeURIComponent(slug)}/`

/**
 * 폴더 이름으로 쓸 수 있는 슬러그인가.
 *
 * `../../blog` 같은 이름은 굽기를 **PAGES 밖으로** 내보낸다 — 2026-09-16 반박 리뷰가
 * 블로그 폴더를 덮어쓰는 것으로 실증했다. 관리자가 주소를 직접 받으므로 **쓰기 전에** 막는다.
 */
const okSlug = (slug) => {
  const s = String(slug ?? '')
  /* 길이도 본다 — 파일 이름 상한(255바이트)을 넘으면 `mkdir` 이 ENAMETOOLONG 으로 죽는데,
     그때는 이미 홈과 목록을 써 버린 뒤라 **없는 작업을 가리키는 홈**이 나간다 */
  if (!s || Buffer.byteLength(s) > 120) return false
  return s !== '.' && s !== '..' && !/[/\\]/.test(s) && !s.startsWith('.') && !/[\u0000-\u001f]/.test(s)
}

/** 링크 미리보기 — 작업물은 공유되라고 만드는 것이라 그림이 같이 가야 한다 */
const ogTags = ({ type, title, description, url, image }) => [
  `<meta property="og:type" content="${esc(type)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  `<meta property="og:url" content="${esc(url)}">`,
  ...(image ? [`<meta property="og:image" content="${esc(site.origin + image)}">`,
               '<meta name="twitter:card" content="summary_large_image">'] : []),
].join('\n') + '\n'

/**
 * 작업 카드 한 장 — 홈의 대표작과 목록이 **같은 카드**를 쓴다.
 *
 * 캡션은 `<figure>` **안**에 둔다. 밖에 두면 그림과 묶이지 않아 보조기기가 둘을
 * 남남으로 읽는다. 그림을 자르는 것은 `.w-shot` 이 맡는다 — `<figure>` 에 걸면
 * 그 상자가 캡션까지 품어서 잘라 낸다.
 * 사진의 `alt` 를 비운 건 바로 밑 캡션이 같은 것을 말하고 있어서다(두 번 읽히면 소음).
 */
/**
 * 작업 카드. `popup` 이면 **상세로 가지 않고** 목록 위에 그 작업을 연다(`#w-번호`).
 *
 * 설정 이름은 처음부터 「목록에서 누르면 → 그 자리에서 크게 / 상세로 이동」이었는데, 값은
 * **상세 페이지 안의 그림 확대**만 켜고 끄고 있었다 — 카드는 늘 상세로 가는 링크라
 * 「팝업」을 골라도 페이지가 넘어갔다(2026-09-17 사용자 발견). 이제 이 값이 카드를 정한다.
 * 카드에 id 를 주는 것은 닫을 때 **보던 카드 자리로** 돌아오기 위해서다(`#` 로 닫으면 맨 위로 튄다).
 */
const workCard = (w, popup = false) => `<li${popup ? ` id="c-${esc(w.slug)}"` : ''}><a class="w-card" href="${popup ? `#w-${esc(w.slug)}` : workHref(w.slug)}">
      <figure>
        <span class="w-shot">${w.cover ? `<img src="${esc(w.cover)}" alt="" loading="lazy">` : ''}</span>
        <figcaption><span class="w-title">${esc(w.title)}</span></figcaption>
      </figure></a></li>`

/**
 * 글 카드 — 작업 카드와 **같은 마크업**이다(`.w-card`). 한 화면에 두 목록이 서므로
 * 결이 갈리면 안 된다. 다른 것은 주소와, 그림이 없을 때 날짜를 대신 세우는 것뿐이다.
 */
const postCard = (p) => `<li><a class="w-card" href="/blog/${encodeURIComponent(p.slug)}/">
      <figure>
        <span class="w-shot">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : ''}</span>
        <figcaption><span class="w-title">${esc(p.title)}</span></figcaption>
      </figure></a></li>`

/** 아직 아무것도 없을 때. 빈 화면을 내는 것보다 **왜 비었는지** 말하는 편이 낫다 */
const nothing = (what) => `<p class="w-none">${what}</p>`

/**
 * 메인의 목록 덩이. **차례는 설정의 배열 차례**이고, 여기서는 하나씩 그릴 뿐이다.
 * 시그니처는 `(ctx)` 하나다 — 이웃을 모르므로 차례 조합이 덧셈으로 끝난다.
 * 둘이 **같은 카드 부품**(`workCard`·`postCard`)을 쓴다 — 한 화면에 두 결이 서면 안 된다.
 */
const SECTION_HTML = {
  /* ⚠ 이 표는 아래 세 함수보다 **먼저** 평가된다 — 이름을 그대로 담으면 TDZ 에 걸린다.
     감싸 두면 부르는 시점에 찾으므로 자리 순서에 안 묶인다 */
  stage: (ctx) => stageHtml(ctx),
  shots: (ctx) => shotsHtml(ctx),
  slides: (ctx) => slidesHtml(ctx),
  works: ({ featured }) => `  <section class="sec-grid" data-sec="works">
    <div class="wrap">
${featured.length ? `      <ul class="w-cards">
        ${featured.map((w) => workCard(w)).join('\n        ')}
      </ul>
      <p class="sec-grid-more"><a href="/portfolio/">작업 전부 보기</a></p>` : `      ${nothing('작성된 작업물이 없습니다.')}`}
    </div>
  </section>`,

  posts: ({ recent }) => `  <section class="sec-grid sec-posts" data-sec="posts">
    <div class="wrap">
${recent.length ? `      <ul class="w-cards">
        ${recent.map((p) => postCard(p)).join('\n        ')}
      </ul>
      <p class="sec-grid-more"><a href="/blog/">글 전부 보기</a></p>` : `      ${nothing('작성된 글이 없습니다.')}`}
    </div>
  </section>`,
}

/**
 * **템플릿이 싣는 일곱 상자**의 기본 글자 — 비워 두면 이것이 나간다.
 *
 * `site.config.mjs` 를 고치면 메인이 따라 바뀌는 길이다. 사용자가 [T] 로 더한 상자는
 * 이 표에 없으므로 **비면 안 보인다** — 제가 쓴 글자가 곧 그 상자의 전부다.
 */
const STAGE_TEXT = {
  brand: () => site.brand,
  title: () => site.home.ogTitle,
  text: () => site.home.description,
  tagline: () => site.home.tagline,
  goWorks: () => '작업 보기',
  goBlog: () => '블로그',
}
const boxText = (it) => String(it?.text || '').trim() || (STAGE_TEXT[it?.id] ? STAGE_TEXT[it.id]() : '')
/** 비워 두면 나갈 글자 전부 — 관리자 편집기가 「다 지우면 무엇이 보이나」를 알아야 해서 API 로 준다 */
export const stageDefaults = () => Object.fromEntries(Object.entries(STAGE_TEXT).map(([k, f]) => [k, f()]))

/**
 * 무대 — 메인의 첫 화면. **글자 상자들이 1240px 판 위의 자리**에 선다.
 *
 * 판은 화면 폭에 맞춰 통째로 줄었다 늘어난다(글자 크기까지, CSS 컨테이너 단위) — 그래서 넓은
 * 화면 어디서나 놓은 모양 그대로다. 860px 이하에서는 판을 버리고 쌓는데, 쌓이는 차례가
 * **마크업 차례**라 여기서 y → x 순으로 정렬해 낸다.
 *
 * 상자가 싣는 것은 자리(`--sx --sy --sw`)와 **제가 정한 것만**(`--sff` 글꼴 · `--sc` 색)이다.
 * 크기·줄 높이·자간·글꼴 갈래는 `data-s`(칸)가 CSS 에서 정한다 — 상자마다 다섯 값을 인라인으로
 * 실으면 같은 사이트의 결이 상자마다 갈린다.
 */
/**
 * 콘텐츠 영역의 사진 한 장.
 *
 * `width`·`height` 를 반드시 적는다 — `workImage` 와 같은 까닭이다. 비율을 미리 알려 주지
 * 않으면 사진이 뜰 때마다 아래 내용이 밀려 내려간다. 앞 두 장만 바로 받고 나머지는 미룬다.
 * 작은 판(`thumb`)은 안 쓴다 — 여기서는 한 장이 화면 폭을 통째로 먹는다.
 */
const shotImg = (im, i, cls = '') => {
  const size = im.w && im.h ? ` width="${im.w}" height="${im.h}"` : ''
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(im.src)}" alt=""${size} loading="${i < 2 ? 'eager' : 'lazy'}">`
}

/**
 * 푸터의 **기본 글자** — 비워 두면 이것이 나간다(무대의 `STAGE_TEXT` 와 같은 규약).
 * `site.config.mjs` 를 고치면 푸터가 따라 바뀌는 길이고, 연도는 구울 때마다 새로 든다.
 */
const FOOT_TEXT = {
  mail: () => site.email,
  copy: () => `© ${new Date().getFullYear()} ${site.copyright}. All rights reserved.`,
}
const footText = (it) => String(it?.text || '').trim() || (FOOT_TEXT[it?.id] ? FOOT_TEXT[it.id]() : '')
/** 비워 두면 나갈 글자 전부 — 관리자 편집기가 「다 지우면 무엇이 보이나」를 알아야 해서 API 로 준다 */
export const footDefaults = () => Object.fromEntries(Object.entries(FOOT_TEXT).map(([k, f]) => [k, f()]))
/**
 * 주소를 안 넣어도 **갈 곳이 있는** 아이콘 — 지금은 GitHub 하나다(`iconHref` 와 같은 규칙).
 * 관리자가 이것을 알아야 「주소가 비어 화면에 안 나옵니다」를 **거짓말로** 하지 않는다.
 */
export const footIconDefaults = () => ({ github: site.github || '' })
/** 공개면 주소 — 관리자가 「글 보기」 링크를 만들 때 쓴다(`SITE_ORIGIN` 이 포트를 맞춰 준다) */
export const siteOrigin = () => String(site.origin || '').replace(/\/+$/, '')

/**
 * 아이콘이 가는 곳 — 정한 주소가 없으면 `site.config.mjs` 의 GitHub 를 쓴다.
 * 그래서 설정을 한 번도 안 건드린 사이트의 푸터가 지금처럼 GitHub 하나를 단다.
 * 갈 곳이 없으면 **빈 문자열** — 그때는 링크가 아니라 **말하는 도형**으로 그린다(아래 `boardHtml`).
 */
const iconHref = (it) => {
  const url = String(it?.url || '').trim()
  if (isExternal(url)) return url
  return it?.service === 'github' && site.github ? site.github : ''
}

/**
 * 상자의 링크 — 안쪽 이름이면 표에서, **글자에서 오는 것**(이메일·전화)은 그 글자로,
 * 바깥 주소면 그 자체. 어느 쪽도 아니면 링크가 아니다.
 *
 * `mailto:`·`tel:` 은 **그 상자의 글자**로 만든다 — 같은 값을 두 자리에 적게 하지 않는다.
 * 전화는 숫자와 `+` 만 남긴다(`tel:` 은 공백·하이픈을 기기마다 다르게 읽는다).
 */
const boxHref = (it, text) => {
  if (it.link === 'mail') return text.includes('@') ? `mailto:${text}` : ''
  if (it.link === 'tel') { const d = text.replace(/[^\d+]/g, ''); return d ? `tel:${d}` : '' }
  return ITEM_LINKS.find((l) => l.value === it.link)?.href || (isExternal(it.link) ? it.link : '')
}

/**
 * 「직접 입력」 칩의 높이(판 단위) — `site.css` 의 `.m-ico-t` 와 **같은 수**다:
 * 글자 15u · 줄 높이 1.1 · 위아래 여백 0.7em · 테두리 1px 두 겹.
 *
 * ⚠ 여백을 **글자 상자 안쪽**(`.m-ico-t`)에 준 까닭이 이것이다. 바깥 `.m-i` 에 주면 그 `em` 은
 *   물려받은 본문 글자(17px 고정)라 판이 좁아져도 안 줄고, 여기 셈과 11~47% 어긋난다
 *   (반박 리뷰 M2). 안쪽에 주면 `em` 이 곧 15u 라 판이 커지든 작아지든 이 수가 맞는다.
 */
const CHIP_H = Math.round(15 * 1.1 + 15 * 0.7 * 2 + 2)

/**
 * 판 하나 — **무대와 푸터가 같이 쓴다.** 상자 배열을 1240 좌표계 판으로 그린다.
 *
 * 마크업 차례가 곧 좁은 화면의 쌓임 차례라 여기서 정렬해 낸다. 순수 y 순으로 하면
 * 같은 줄에 나란히 선 것들(연락처 옆 아이콘)이 몇 px 차이로 위아래가 뒤집히므로,
 * **세로가 겹치는 상자는 한 줄로 묶어** 그 안에서 x 순으로 낸다.
 *
 * 상자가 싣는 것은 자리(`--sx --sy --sw`)와 **제가 정한 것만**(`--sff` 글꼴 · `--sc` 색)이다.
 * 크기·줄 높이·자간·글꼴 갈래는 `data-s`(칸)가 CSS 에서 정한다.
 */
const boardHtml = (items, { height, bw, text = boxText, h1 = null, pad = '      ' }) => {
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  /**
   * 아이콘은 **주소가 없어도 그린다**(2026-09-18 사용자 결정) — 더해 놓고 안 보이면 어디에
   * 놓였는지 몰라 자리를 잡을 수가 없다. 갈 곳이 없는 것은 링크 대신 **말하는 도형**이 된다.
   * 글자 상자는 그대로다: 빈 글자는 그릴 것이 없다.
   */
  const shown = items.filter((it) => it.show && (it.kind === 'icon' ? true : !!text(it)))
  if (!shown.length) return ''
  /* 세로로 겹치는 것끼리 한 줄 — 높이는 아이콘이면 제 크기, 글자면 칸의 한 줄.
     ⚠ 「직접 입력」 칩만 예외다: 폭은 **이름이** 정하고 높이는 글자가 정하므로(정사각이 아니다)
     폭을 높이로 읽으면 이름이 긴 칩이 아랫줄을 제 줄로 빨아들인다 — 좁은 화면 쌓임 차례가 뒤집힌다 */
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
      /* 「직접 입력」은 로고가 없다 — 쓴 이름이 곧 그림이자 설명이다 */
      const inner = it.service === 'link' && name
        ? `<span class="m-ico-t">${esc(name)}</span>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_OF[it.service] || ''}"/></svg>`
      const to = iconHref(it)
      const base = `class="m-i" data-i="${esc(it.id)}" data-k="icon" data-svc="${esc(it.service)}" style="${style}"`
      /**
       * 갈 곳이 있으면 **링크**, 없으면 **말하는 도형**이다.
       *
       * 빈 `href` 를 달면 브라우저가 지금 페이지를 다시 받는다 — 그래서 주소가 없을 때는
       * `<a>` 를 아예 안 쓴다. 대신 눌러 보면(또는 올려 보면) 왜 안 움직이는지 말한다
       * (`data-tip`, 그림은 `site.css` 의 CSS 만으로 — 방문자에게 JS 0바이트 규약).
       * `tabindex` 를 주는 까닭도 그것이다: 누름·탭이 곧 초점이라 손가락으로도 뜬다.
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
 * 푸터 — 한 벌(`footer.main`·`footer.pages`)을 판 하나로 그린다.
 *
 * 섹션이 **화면 끝까지** 가는 윗선·배경을 맡고, 판은 본문 폭 안에서 좌표를 든다(머리줄·본문과
 * 같은 판면선). 색을 정한 푸터는 그 안에서 `--fg`·`--bg` 계열을 통째로 덮는다 — 그래야
 * 아이콘 테두리와 흐린 글자(저작권)까지 그 배경 위에서 읽힌다. 흐린 색은 관리자와 **같은 함수**
 * (`mutedOn`)로 낸다. 보이는 것이 하나도 없으면 푸터를 안 그린다.
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
    /* 글자색을 정했으면 유도색까지 다시 낸다 — 안 그러면 어두운 푸터에 옛 흐린 색이 남는다 */
    + (fg ? `;--fg:${fg};--fg-2:color-mix(in srgb, ${fg} 72%, ${bg || theme.paper});`
      + `--fg-3:${mutedOn(fg, bg || theme.paper)};--line:color-mix(in srgb, ${fg} 24%, ${bg || theme.paper})` : '')
  return `<section class="foot" data-foot="${kind}"${kind === 'main' ? ' id="contact"' : ''} style="${vars}">
${board}
</section>`
}

/**
 * 콘텐츠 영역 — **글자 판만** 그린다. 사진은 제 자리(`shotsHtml`·`slidesHtml`)가 그린다.
 *
 * **마크업 차례**라 여기서 y → x 순으로 정렬해 낸다.
 *
 * 상자가 싣는 것은 자리(`--sx --sy --sw`)와 **제가 정한 것만**(`--sff` 글꼴 · `--sc` 색)이다.
 * 크기·줄 높이·자간·글꼴 갈래는 `data-s`(칸)가 CSS 에서 정한다 — 상자마다 다섯 값을 인라인으로
 * 실으면 같은 사이트의 결이 상자마다 갈린다.
 */
const stageHtml = (ctx) => {
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  const m = ctx.main
  /* 나갈 글자가 있는 상자만 */
  const shown = (m.items || [])
    .filter((it) => it.show && !!boxText(it))
    .sort((p, q) => n(p.y) - n(q.y) || n(p.x) - n(q.x))

  /* 배경 그림 — 관리자에서 올린 사진의 경로. 비면 안 깐다 */
  const bg = typeof m.stage?.bg === 'string' ? m.stage.bg : ''
  /**
   * **데이터가 곧 화면이다.** 예전에는 걸 그림이 없으면 다른 템플릿의 배치를 말없이 대신
   * 그렸는데, 그러면 관리자의 「요소」 목록(데이터)과 화면이 어긋나 무엇이 켜져 있는지
   * 알 수 없었다. 대신 **템플릿의 시작 배치 자체가 그림 없이도 읽히게** 짜 둔다.
   */
  if (!shown.length && !bg) return ''
  /* 제목 하나는 h1 — **제일 큰 칸**이 맡는다. 굽기가 하나만 나가게 지킨다 */
  const rank = (it) => ITEM_SIZES.findIndex((z) => z.value === it.size)
  const big = [...shown].sort((p, q) => rank(p) - rank(q))[0]
  const h1 = big?.size === 'xl' || big?.size === 'display' ? big : null

  /**
   * 판 폭은 사이트의 본문 폭을 그대로 따른다 — 제 스위치가 없다.
   *
   * ⚠ **좌표계는 1240 그대로다**(`STAGE_W`). 판이 좁아지면 `--u`(=`100cqw/1240`)가 같이
   * 줄어 글자와 좌표가 **비례해서** 작아질 뿐, 저장된 x·y·w 는 한 글자도 안 바뀐다.
   */
  const bw = 'var(--body-w, 1240px)'
  const board = shown.length ? boardHtml(shown, { height: m.stage?.height, bw, h1 }) : ''
  /* 높이를 **칸에도** 싣는다 — 글자 판이 없으면(배경만 깔았을 때) 자식이 전부 absolute 라
     기댈 곳이 없어 높이가 0 이 된다. 판이 서면 판이 높이를 정하므로 이 값은 안 쓰인다 */
  return `  <section class="m-stage${bg ? ' has-img' : ''}" style="--sh:${n(m.stage?.height, 600)}">
${bg ? `    <img class="m-bg" src="${esc(bg)}" alt="">\n` : ''}${board}
  </section>`
}

/**
 * 이미지 콘텐츠 영역 — 사진을 **세로로 잇는다**. 제 비율대로 높이가 정해진다.
 *
 * 손잡이 넷은 CSS 변수로 싣는다(`knobStyle` 이 포트폴리오에 하는 것과 같은 규약) —
 * 값이 마크업이 아니라 변수라, 관리자가 끌면 창이 그 자리에서 바뀐다.
 */
const shotsHtml = (ctx) => {
  const list = (ctx.main.stage?.shots || []).slice(0, SHOT_MAX.shots)
  if (!list.length) return ''
  const k = ctx.main.stage?.shotKnobs || {}
  const n = (v, d) => (Number.isFinite(v) ? Math.round(v) : d)
  const style = SHOT_KNOBS.map((x) => `--m${x.key}:${n(k[x.key], x.d)}`).join(';')
  return `  <section class="m-shots" data-sec="shots" style="${style}">
${list.map((im, i) => `    ${shotImg(im, i)}`).join('\n')}
  </section>`
}

/**
 * 슬라이드 — 배너가 화면을 꽉 채우고 옆으로 넘어간다.
 *
 * 자바스크립트가 한 바이트도 없다. `scroll-snap` 이 바탕이라 밀기·휠·키보드·터치가
 * 어느 브라우저에서나 되고, 점과 화살표는 `::scroll-marker`·`::scroll-button()` 을
 * 아는 브라우저에만 CSS 가 덤으로 붙인다(site.css). 그쪽을 모르는 브라우저에는
 * **얇은 스크롤바를 남겨** 뒤에 더 있다는 것을 알린다.
 */
const slidesHtml = (ctx) => {
  const n = (v, d = 0) => (Number.isFinite(v) ? Math.round(v) : d)
  const list = (ctx.main.stage?.slides || []).slice(0, SHOT_MAX.slides)
  if (!list.length) return ''
  return `  <section class="m-slides" data-sec="slides" style="--sh:${n(ctx.main.stage?.slideH, 480)}">
    <div class="m-rail" tabindex="0" role="group" aria-label="사진 ${list.length}장">
${list.map((im, i) => `      ${shotImg(im, i, 'm-slide')}`).join('\n')}
    </div>
  </section>`
}

/** 차례 — **설정의 배열 차례**다. 무대도 그 안에 있어 목록보다 뒤로 갈 수 있다(「그리드 먼저」) */
const mainOrder = (m) => (m.sections || []).filter((x) => x.show).map((x) => x.key)

const homePage = (ctx, fragment = '') => {
  /* 「직접 디자인」이면 무대도 목록도 안 그린다 — 본문은 통째로 조각이다 */
  const code = ctx.main.mode === 'code'
  const order = code ? [] : mainOrder(ctx.main)
  const body = order.map((b) => (SECTION_HTML[b] ? SECTION_HTML[b](ctx) : '')).filter(Boolean)
  return shell({
    header: ctx.header,
    chrome: ctx.main.chrome,
    title: site.home.title,
    description: site.home.description,
    canonical: `${site.origin}/`,
    nav: navFor('/'),
    footer: ctx.footer, colors: ctx.theme,
    /**
     * 홈은 **늘 「메인 푸터」**를 쓴다. 조각은 제 푸터를 갖고 있으므로 굽기가 안 붙인다.
     *
     * 예전에는 목록이 하나라도 서면 얇은 푸터로 바꿨는데, 그러면 「메인 푸터」를 고쳐도
     * 대부분의 홈에서는 안 나가 **고친 것이 어디로 갔는지 알 수 없었다**. 얇게 쓰고 싶으면
     * 메인 푸터의 높이를 줄이면 된다 — 고르는 자리가 하나여야 한다(2026-09-18 사용자 결정).
     */
    foot: code ? 'none' : 'main',
    theme: pageStyle(ctx, 'main'),
    head: ogTags({ type: 'website', title: site.home.ogTitle, description: site.home.description,
                   url: `${site.origin}/`, image: ctx.cover?.cover }) +
          headerCss(ctx.main.chrome, ctx.main.mode) +
          `${fontSheet(ctx.theme.display, ctx.theme.body, ctx.header?.font, ctx.main.font.display, ctx.main.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${V()}">\n`,
    body: code ? fragment : `<main>
${body.join('\n\n')}
</main>`,
  })
}

/**
 * 고른 색·글꼴을 CSS 로. **`<head>` 맨 끝**에 인라인으로 낸다 —
 * 따로 `theme.css` 를 구우면 캐시가 CSS 와 HTML 을 다른 시점의 것으로 섞어,
 * 색만 옛 것으로 남는 창이 생긴다. 한 파일로 나가면 그 창이 없다.
 *
 * `--accent` 는 **두 곳**에 낸다. 글 본문의 링크색은 `.prose` 스코프라 `:root` 가 안 닿는다.
 * 나머지 색(선·흐린 글자·바탕 둘째)은 고른 셋에서 `color-mix` 로 유도한다 —
 * 열두 개를 다 고르게 하면 그중 하나만 어긋나도 화면이 탁해진다.
 */
/* 흐린 글자(--fg-3)만 **섞기가 아니라 대비로** 정한다 — 먹과 종이의 거리가 테마마다 달라서
   고정 비율로는 어떤 테마가 늘 미달한다(48%는 넷 다, 62%는 「그레이」가 4.15:1).
   mutedOn 이 4.5:1 을 넘는 가장 옅은 값을 찾는다(shared/site-vocab.mjs).
   ⚠ 설명은 **이 밖에** 둔다. CSS 주석으로 템플릿 안에 넣었더니 모든 공개 페이지에
   내부 설계 메모가 그대로 실려 나갔다(반박 리뷰 minor 10). */
const themeStyle = (t) => `<style data-theme>
:root {
  --bg: ${t.paper};
  --fg: ${t.ink};
  --accent: ${t.accent};
  --bg-2: color-mix(in srgb, ${t.ink} 6%, ${t.paper});
  --fg-2: color-mix(in srgb, ${t.ink} 72%, ${t.paper});
  --fg-3: ${mutedOn(t.ink, t.paper)};
  --line: color-mix(in srgb, ${t.ink} 14%, ${t.paper});
  --line-2: color-mix(in srgb, ${t.ink} 24%, ${t.paper});
  --display: ${fontStack(t.display, 'display')};
  --sans: ${fontStack(t.body, 'sans')};
  --body-w: ${bodyW(t)};
  --foot-w: ${footW(t)};
}
.prose { --accent: ${t.accent}; }
</style>
`

/**
 * 손잡이를 CSS 변수로 낸다 — **값만 갈아 끼우면 화면이 바뀐다.**
 *
 * 마크업을 안 건드리는 것이 요점이다. 그래서 관리자에서 미끄럼자를 끄는 동안
 * 서버를 안 거치고 미리보기 창의 이 한 덩이만 고쳐 넣으면 그 자리에서 반영된다.
 */
const knobStyle = (pf) => {
  const k = pf.knobs
  const px = (n) => `${Math.round(n)}px`
  return `<style data-knobs>
:root {
  --pf-cols: ${k.cols};
  --pf-ratio: ${k.ratio === 'auto' ? 'auto' : k.ratio};
  --pf-radius: ${px(k.radius)};
  --pf-gap-y: ${px(k.gapY)};
  --pf-gap-x: ${px(k.gapX)};
  --pf-pad: ${px(k.pad)};
  --pf-max: var(--body-w, 1240px);
  --wk-gap: ${px(k.detailGap)};
  --wk-top: ${px(k.detailTop ?? 48)};
  --wk-radius: ${px(k.radius)};
}
</style>
`
}

/* 벽돌쌓기 — **비율을 자르지 않는다.** 포스터와 책이 섞여 있어 같은 크기로 자르면 어느 쪽도 제 모양이 아니다 */
const worksPage = (works, ctx, fragment = '') => shell({
  theme: pageStyle(ctx, 'portfolio', lhStyle(ctx.portfolio.head)),
  header: ctx.header,
  chrome: ctx.portfolio.chrome,
  foot: ctx.portfolio.mode === 'code' ? 'none' : 'pages',
  footer: ctx.footer, colors: ctx.theme,
  title: site.works.title,
  description: site.works.description,
  canonical: `${site.origin}/portfolio/`,
  nav: navFor('/portfolio/'),
  head: ogTags({ type: 'website', title: site.works.title, description: site.works.description,
                 url: `${site.origin}/portfolio/`, image: works.find((w) => w.cover)?.cover }) +
        (ctx.portfolio.mode === 'template' ? `<link rel="stylesheet" href="/assets/templates/portfolio.css?v=${V()}">\n` : '') +
        headerCss(ctx.portfolio.chrome, ctx.portfolio.mode) +
        `${fontSheet(ctx.theme.display, ctx.theme.body, ctx.header?.font, ctx.portfolio.font.display, ctx.portfolio.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${V()}">\n`,
  body: ctx.portfolio.mode === 'code' ? fragment : `<main>
${listHead(ctx.portfolio.head, works.length)}${works.length ? `  <ul class="pf pf-${esc(ctx.portfolio.template)}">
    ${works.map((w) => workCard(w, ctx.portfolio.zoom === 'popup')).join('\n    ')}
  </ul>${ctx.portfolio.zoom === 'popup' ? `\n${works.map(workPop).join('\n')}` : ''}` : `  ${nothing('작성된 작업물이 없습니다.')}`}
</main>`,
})

/**
 * 작업 상세 — **무드보드 폴더를 세로로 편다.**
 *
 * 디자이너는 글을 쓰지 않는다. 올린 그림이 곧 내용이고, 이 화면이 하는 일은
 * 그것을 **차례대로, 원래 비율로, 정한 간격으로** 쌓는 것뿐이다.
 * 간격이 0이면 한 장처럼 딱 붙는다 — 받은 영상의 그 일체감이 여기서 나온다.
 *
 * `width`·`height` 를 반드시 적는다. 비율을 미리 알려 주지 않으면 그림이 뜰 때마다
 * 아래 내용이 밀려 내려가, 읽던 자리를 잃는다.
 */
const workImage = (im, i, zoomOn) => {
  const size = im.w && im.h ? ` width="${im.w}" height="${im.h}"` : ''
  const img = `<img src="${esc(im.src)}" alt=""${size} loading="${i < 2 ? 'eager' : 'lazy'}">`
  /* 확대가 「팝업」이면 그림을 앵커로 감싸고 오버레이를 같이 낸다 — 자바스크립트 없이
     주소의 `#` 만으로 열고 닫는다(`:target`). 「이동」이면 그냥 그림이다. */
  return zoomOn
    ? `    <a class="wk-shot" id="s${i}" href="#i${i}" aria-label="${i + 1}번째 그림 크게 보기">${img}</a>`
    : `    <span class="wk-shot">${img}</span>`
}

/* 닫기는 `#` 이 아니라 **보던 그림의 앵커**로 간다. `#` 로 두면 주소에서 자리 표시가 사라져
   브라우저가 맨 위로 튄다 — 열두 장짜리 작업에서 아래쪽 그림을 닫으면 처음으로 돌아간다
   (2026-09-16 리뷰가 scrollY 2059 → 0 으로 실측). 뒤로가기로 닫는 길은 그대로다. */
const workZoom = (im, i, total) => `  <div class="wk-zoom" id="i${i}" role="dialog" aria-modal="true" aria-label="${i + 1} / ${total}">
    <a class="wk-zoom-close" href="#s${i}" aria-label="닫기"></a>
    <img src="${esc(im.src)}" alt="" loading="lazy">
    <span class="wk-zoom-no">${i + 1} / ${total}</span>
  </div>`

/**
 * 목록 위에 여는 작업 하나 — **상세 페이지의 그림 묶음과 같은 마크업**(.wk-stack·.wk-shot).
 * 「페이지로 보기」 링크는 두지 않는다 — 팝업을 고른 사람에게 페이지로 가는 길을 또 보이면
 * 무엇이 상세인지 헷갈린다(2026-09-17 사용자 지시). 닫기 하나만 둔다.
 * 간격·모서리 손잡이(--wk-gap·--wk-radius)가 그대로 먹어, 팝업과 페이지가 같은 결로 보인다.
 * 그림은 전부 `lazy` — 닫혀 있는 동안(display:none)은 받지 않는다.
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
  /* 상세 안의 그림 확대는 늘 켠다. 설정(zoom)은 이제 **목록 카드**가 상세를 어떻게 여느냐다 */
  const zoomOn = true
  return shell({
    header: ctx.header,
    /* 상세도 목록과 같은 갈피를 따른다 — 한 화면 묶음 안에서 머리가 있다 없다 하면 안 된다 */
    chrome: ctx.portfolio.chrome,
    footer: ctx.footer, colors: ctx.theme,
    title: `${w.title} — ${site.siteTitle}`,
    description: `${w.title} — ${site.works.description}`,
    canonical: `${site.origin}${workHref(w.slug)}`,
    /* 작업을 보는 중에는 이름 자리가 **돌아갈 곳**이다 — 글 상세와 같은 규약(`.s-back`) */
    brand: '<a class="s-name s-back" href="/portfolio/"><span aria-hidden="true">←</span>작업</a>',
    nav: navFor(workHref(w.slug)),
    head: ogTags({ type: 'article', title: w.title, description: site.works.description,
                   url: `${site.origin}${workHref(w.slug)}`, image: w.cover }) +
          `<link rel="stylesheet" href="/assets/templates/header.css?v=${V()}">
${fontSheet(ctx.theme.display, ctx.theme.body, ctx.header?.font, ctx.portfolio.font.display, ctx.portfolio.font.body)}<link rel="stylesheet" href="/assets/fonts.local.css?v=${V()}">\n`,
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
 * 실행되는 것이 섞였는지 본다 — **펴고 나서** 본다.
 *
 * 정규식 목록만으로는 못 막는다 — `<script/src=…>`,
 * `<img src=x/onerror=…>`, `java&#115;cript:`, 탭 낀 `java\tscript:` 가 전부 뚫는다.
 * 그래서 먼저 실체 참조를 글자로 되돌리고, 태그·속성 이름에 붙은 `/` 를 공백으로 바꾸고,
 * **태그 안에서만** 속성 검사를 한다(본문 글자의 「only=」 같은 것을 잡지 않으려고).
 */
const safeChar = (code, fallback) =>
  (Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback)

const unsafeBit = (html) => {
  const flat = String(html)
    /* 범위를 벗어난 값(`&#x110000;`)에 `fromCodePoint` 가 던진다 — 그러면 굽기 오류가
       날 JS 오류로 나가 무엇이 문제인지 아무도 모른다. 못 읽는 것은 그냥 둔다 */
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => safeChar(parseInt(h, 16), m))
    .replace(/&#(\d+);?/g, (m, d) => safeChar(Number(d), m))
    .replace(/&(lt|gt|quot|apos|amp|colon|tab|newline|sol);/gi,
      (_, n) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', colon: ':', tab: '\t', newline: '\n', sol: '/' })[n.toLowerCase()])
    .replace(/<([a-z][a-z0-9-]*)\//gi, '<$1 ')            // `<script/src=…`
    .replace(/\/+(?=[a-z][a-z0-9-]*\s*=)/gi, ' ')          // `<img src=x/onerror=…`
  const tags = flat.match(/<[^>]*>/g) || []
  const banned = /^<\s*(script|iframe|object|embed|base|noscript|frame|frameset|applet)\b/i
  for (const tag of tags) {
    const m = tag.match(banned)
    if (m) return `<${m[1].toLowerCase()}>`
    if (/[\s"'/]on[a-z-]+\s*=/i.test(tag)) return 'on… 속성'
    /**
     * `<meta http-equiv="refresh">` 는 스크립트도 아니고 `on…` 도 아닌데 **페이지를 통째로
     * 남의 주소로 넘긴다.** `<body>` 안에 있어도 먹는다(2026-09-16 에 헤드리스로 실측).
     * 「방문자에게 JS 0바이트」를 지키는 자리라 여기서 같이 막는다.
     */
    if (/^<\s*meta\b/i.test(tag) && /http-equiv\s*=\s*["']?\s*refresh/i.test(tag)) return 'meta 새로고침'
    /* 바깥에서 스타일시트를 끌어오면 방문자 주소가 새고, 셀렉터로 내용까지 읽힌다.
       `rel` 과 `href` 의 **순서를 안 따진다** — 순서를 전제하면 뒤바꿔 쓴 것이 샌다 */
    if (/^<\s*link\b/i.test(tag) && /rel\s*=\s*["']?stylesheet/i.test(tag)
        && /href\s*=\s*["']?\s*(https?:)?\/\//i.test(tag)) return '바깥 스타일시트'
    /* 주소 안의 안 보이는 글자는 브라우저가 버린다 — 우리도 버리고 나서 본다 */
    const urls = tag.replace(/[\s\u0000-\u001f]+/g, '')
    if (/(javascript|vbscript|data):(?!image\/)/i.test(urls) || /data:text\/html/i.test(urls)) {
      return '실행되는 주소'
    }
  }
  /* 스타일 블록 안의 `@import` 는 태그가 아니라 글자다 — 따로 본다(`url()` 없는 형태 포함) */
  if (/@import\s+(url\(\s*)?["']?\s*(https?:)?\/\//i.test(flat)) return '바깥 스타일시트(@import)'
  if (/@font-face[^}]*url\(\s*["']?\s*(https?:)?\/\//i.test(flat)) return '바깥 글꼴'
  return null
}

/**
 * 메인과 포트폴리오를 굽는다. **두 화면 다 언제나 굽는다** — 갈리는 것은 본문을 누가
 * 만드느냐다(`mode`). `template` 이면 고른 모양대로 만들고, `code` 면 레포의
 * `pages/*.html` 조각을 그대로 싣는다.
 *
 * 이 폴더에는 **다시 만들 수 있는 것만** 있다(`.env.example` 의 PAGES_DIR 설명) —
 * 사진 원본은 `BLOG_DIR` 에 있고, 여기는 통째로 지워도 잃을 것이 없다.
 *
 * **만들고 → 검사하고 → 쓴다.** 순서가 이래야 검사가 의미가 있다. 쓰고 나서 보면
 * nginx 는 이미 그 파일을 내고 있고, 관리자 화면에 뜨는 건 사후 통보다(반박 리뷰 M-1).
 */
/**
 * @param dummy  참이면 **DB 를 안 읽고 견본 내용**을 세운다(server/dummy.mjs 머리말 참고).
 *               고르는 중에는 빈 목록보다 찬 목록이 판짜기를 더 정직하게 보여 준다.
 * @param rebase 미리보기 주소(`/preview/...`) — 주면 `<a>` 를 그 안으로 돌린다
 */
async function bakePages(pool, { into = PAGES, conf = DEFAULTS, rebase = false, dummy = false } = {}) {
  /**
   * 작업물은 글과 **같은 표**에 산다 — 다른 건 `kind` 한 칸뿐이다(sql/schema.sql 참고).
   *
   * 작업은 본문이 없다. 무드보드 폴더에 올린 **그림 목록이 곧 내용**이다.
   * 목록 카드에는 대표(`kind='banner'`)의 **작은 판**을, 상세에는 전부를 차례대로 건다.
   */
  /* 포트폴리오를 직접 디자인하는 사이트에는 작업물이 **발행될 자리가 없다** —
     `/portfolio/{이름}/` 을 아무도 안 만들므로 질의도 하지 않는다 */
  /* 견본은 **포트폴리오 모드와 무관하게** 세운다. 메인의 작업 목록은 메인 판짜기의
     일부라, 포트폴리오를 직접 디자인한다고 해서 고를 때 빈 칸으로 둘 이유가 없다.
     아래 상세 굽기 고리가 `works` 를 그대로 도므로 견본 카드도 눌러서 들어갈 수 있다 */
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

  /* 메인에 글 목록을 켠 사이트만 — 안 켰으면 질의도 안 한다 */
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

  /* ① 만든다 — 아직 디스크에는 손대지 않는다 */
  /* 표지로 걸 수 있는 건 **그림이 있는 작업**뿐이다. 그림 없는 작업을 세우면
     `<img src="">` 가 나가고, 빈 src 는 브라우저가 **현재 페이지를 다시 받는다**
     (라이브러리가 첨부에서 같은 이유로 피하는 그 함정이다) */
  const cover = works.find((w) => w.cover) || null
  const featured = works.slice(0, 3)
  /* 섹션 렌더러가 보는 것 전부. **이웃을 모른다** — 순서 조합이 덧셈으로 끝나는 이유다 */
  const ctx = { ...conf, cover, featured, works, recent, style: themeStyle(conf.theme) + knobStyle(conf.portfolio) + headStyle(conf.header, conf.theme) }
  const cards = (list) => list.map((w) => workCard(w)).join('\n')

  /* 셋째 칸은 **레포가 쓴 것인가**. 조각은 레포 주인이 쓴 것이라 `<script>` 가 정당하다 */
  const none = { rel: '', html: '', missing: false }
  const [mainFrag, worksFrag] = await Promise.all([
    conf.main.mode === 'code' ? readFragment('main', conf.main.source) : none,
    conf.portfolio.mode === 'code' ? readFragment('portfolio', conf.portfolio.source) : none,
  ])
  /**
   * **머리가 둘이 되는 조합은 말해 주기만 한다.**
   *
   * 공통헤더는 모드와 **별개의 스위치**다 — 직접 디자인이어도 켤 수 있어야 한다. 굽기가
   * 막으면 그 스위치가 「안 먹는」 것이 되고, 조각을 손보기 전에는 켤 방법이 없어진다.
   * 조각이 제 머리줄을 갖고 있는데 켜면 띠가 두 줄 쌓이지만, 그건 **미리보기에 바로 보이는**
   * 결과이고 되돌리기도 한 번이다. 무엇을 하면 되는지 한 줄로 일러 주고 굽는다.
   */
  const warn = []
  for (const [frag, on, isMine] of [[mainFrag, conf.main.chrome, conf.main.source === PAGE_SOURCE_MINE],
                                    [worksFrag, conf.portfolio.chrome, conf.portfolio.source === PAGE_SOURCE_MINE]]) {
    /* 내 파일이 없는 것은 빈 대지로 시작한다는 뜻이라 말하지 않는다. **고른 샘플**이 없는 것은 레포가 덜 받아진 것이다 */
    if (frag.missing && !isMine) warn.push(`${frag.rel} 이 없습니다 — 빈 화면으로 구웠습니다`)
    if (on && ownsHeader(frag.html)) {
      warn.push(`${frag.rel} 이 제 머리줄을 갖고 있어 머리가 둘입니다 — 그 <header> 를 지우거나 공통헤더를 끄세요`)
    }
  }

  const made = []
  made.push(['index.html', homePage(ctx, mainFrag.html), conf.main.mode === 'code'])
  made.push(['portfolio/index.html', worksPage(works, ctx, worksFrag.html), conf.portfolio.mode === 'code'])

  for (const [i, w] of works.entries()) {
    if (!okSlug(w.slug)) throw new Error(`작업 주소로 쓸 수 없는 이름입니다: ${JSON.stringify(w.slug)}`)
    /* 「다음 작업」은 고리처럼 돈다 — 마지막에서 첫 장으로. 한 편뿐이면 제 자신을 가리키게 두지 않는다 */
    const near = works.length > 1 ? works[(i + 1) % works.length] : null
    /* 상세에는 「직접 올리기」가 없다 — 그림을 차례대로 쌓는 것이 전부라 갈아 끼울 마크업이 없다.
       모양을 바꾸고 싶으면 손잡이(간격·모서리)와 확대 방식으로 한다 */
    made.push([`portfolio/${w.slug}/index.html`, workPage(w, near, ctx), false])
  }

  /* ② 검사한다 — 하나라도 걸리면 **아무것도 안 쓴다** */
  const willExist = new Set(made.map(([rel]) => rel))
  for (const [rel, html, trusted] of made) {
    /* 카드가 가리키는 곳을 이번에 **같이 만드는가**. 디스크를 보면 지난번에 구운
       낡은 파일이 통과 도장을 찍는다 — 이번 굽기의 산출물끼리 맞춰 본다.
       손으로 쓴 조각은 건너뛴다 — 제 링크는 쓴 사람이 안다 */
    for (const [, enc] of trusted ? [] : html.matchAll(/href="\/portfolio\/([^"/]+)\/"/g)) {
      const slug = decodeURIComponent(enc)          // 주소는 인코딩돼 있고 폴더 이름은 날것이다
      if (!willExist.has(`portfolio/${slug}/index.html`)) {
        throw new Error(`${rel}: 없는 작업을 가리킵니다 — /portfolio/${slug}/`)
      }
    }
/* 굽기가 만든 화면에는 **자바스크립트를 싣지 않는다** — 관리자에서 들어온 값(제목·이름·
       색)이 태그로 빠져나가는 길을 막는 자리다. 조각(`trusted`)은 이 검사를 안 받는다:
       레포를 가진 사람이 쓴 것이라 `<script>` 가 정당하고, 크기는 `tools/check-public.mjs`
       가 잰다. */
    const bad = trusted ? null : unsafeBit(html)
    if (bad) throw new Error(`${rel}: 공개 화면에 실행되는 것이 들어왔습니다 — ${bad}`)
    /* 블로그 굽기가 보는 것들을 화면도 똑같이 본다 — 안 그러면 nginx 가 내는 쪽만 검사 밖이다 */
    if (html.includes('attachment://')) throw new Error(`${rel}: 주소로 못 푼 첨부가 남았습니다`)
    if (/X-Amz-Signature/i.test(html)) throw new Error(`${rel}: 서명된 임시 주소가 박혔습니다`)
    /* 빈 주소는 **현재 페이지를 한 번 더 받는다** — 화면이 느려지고 접속 기록이 두 배가 된다 */
    if (/\s(?:src|href)=""/.test(html)) throw new Error(`${rel}: 빈 주소(src/href)가 있습니다`)
    /* 작업 상세는 글과 같은 본문 계약을 쓴다 — 폭·여백 규칙이 `.prose > .prose-body`
       **두 겹**에 걸려 있어 한 겹이면 조용히 무너진다(블로그 굽기가 보는 것과 같은 자리) */
    /* `.prose > .prose-body` 두 겹 검사는 **글에만** 건다(`bakeNow`).
       작업은 편집기를 안 쓰고 그림을 쌓을 뿐이라 그 계약이 없다 — 여기서 요구하면
       작업 하나 올릴 때마다 굽기가 실패한다. */
    if (/<link[^>]+rel=["']?stylesheet[^>]*href=["']?(https?:)?\/\//i.test(html) || /@import\s+url\(\s*["']?(https?:)?\/\//i.test(html)) {
      throw new Error(`${rel}: 바깥에서 스타일시트를 끌어옵니다`)
    }
  }

  /* ③ 쓴다 */
  const written = []
  for (const [rel, html] of made) {
    const at = `${into}/${rel}`
    await mkdir(dirname(at), { recursive: true })
    await writeAtomic(at, rebase ? previewLinks(html, rebase) : html)
    written.push(rel)
  }

  /* 내린 작업의 폴더를 치운다. 먼저 쓰고 나중에 지우므로 **빈 화면 구간이 없다**.
     `www/` 에는 사진 원본이 없어(원본은 `BLOG_DIR/{번호}/`) 통째로 지워도 잃을 것이 없다 */
  const { readdir } = await import('node:fs/promises')
  const keep = new Set(works.map((w) => w.slug))
  for (const e of await readdir(`${into}/portfolio`, { withFileTypes: true }).catch(() => [])) {
    if (e.isDirectory() && !keep.has(e.name)) await rm(`${into}/portfolio/${e.name}`, { recursive: true, force: true })
    /* 쓰다 만 임시 파일 — `rename` 이 실패하면 남는다. 점 파일이라 서빙되지는 않지만 치운다 */
    if (e.isFile() && e.name.startsWith('.') && e.name.endsWith('.tmp')) await rm(`${into}/portfolio/${e.name}`, { force: true })
  }
  return { pages: written.length, works: works.length, warn }
}

/**
 * 미리보기 — **같은 굽기 함수**를 다른 폴더로 한 번 더 돌린다.
 *
 * 렌더러를 두 벌 만들지 않는 이유: 두 벌이 되는 순간 미리보기는 거짓말이 된다.
 * 결과는 관리자 vhost 의 `/preview/` 가 낸다(공개면에는 열지 않는다).
 */
export async function bakePreview(pool, conf) {
  const into = process.env.PREVIEW_DIR || join(dirname(OUT), 'preview')
  /* 등호만 보면 `BLOG_DIR/preview` 가 통과한다 — 그러면 **저장 전 모양이 공개면으로 샌다**
     (`/blog/preview/` 로 그대로 서빙된다). 위 PAGES 가드와 같은 포함관계 검사를 쓴다 */
  for (const [name, other] of [['BLOG_DIR', OUT], ['PAGES_DIR', PAGES]]) {
    if (nested(realOf(into), realOf(other))) {
      throw new Error(`PREVIEW_DIR 이 ${name} 와 겹칩니다 — 저장 전 모양이 공개면으로 샙니다`)
    }
  }
  /**
   * **두 벌을 굽는다** — 진짜 자료 한 벌, 견본 자료 한 벌.
   *
   * 관리자 패널의 창은 견본 쪽을 본다: 아무것도 안 올린 사이트에서 템플릿을 고를 때
   * 빈 목록만 보면 판짜기를 눈으로 고를 수 없다. 「실제 자료로 확인」을 누르면 진짜 쪽이
   * 새 탭에 뜬다 — 방문자가 볼 바로 그 화면이다.
   *
   * 두 번 굽는 값이 싼가: 한 벌이 40ms 안쪽이라(2026-09-17 실측 중앙값 39ms) 400ms
   * 디바운스에 묻힌다. 눌러야 굽는 길로 만들면 단추가 링크가 아니게 되고, 새 탭을
   * 여는 시점이 굽기 뒤로 밀려 브라우저의 팝업 차단에 걸린다.
   */
  /* 옛 판은 `${into}` 바로 밑에 썼다 — 안 치우면 `/preview/` 로 들어간 사람에게
     지난 판 화면이 계속 나온다(2026-09-18 반박 리뷰 L4). 새 자리 둘은 건드리지 않는다 */
  const { readdir: readPrev } = await import('node:fs/promises')
  for (const e of await readPrev(into, { withFileTypes: true }).catch(() => [])) {
    if (e.name !== 'real' && e.name !== 'dummy') await rm(`${into}/${e.name}`, { recursive: true, force: true })
  }
  const r = await bakePages(pool, { into: `${into}/real`, conf, rebase: '/preview/real' })
  const d = await bakePages(pool, { into: `${into}/dummy`, conf, rebase: '/preview/dummy', dummy: true })

  /**
   * 블로그도 같이 굽는다 — 관리자의 「블로그」 탭이 이 자리를 본다.
   * 안 구우면 그 탭은 404 를 띄우고, 고르는 사람은 무엇이 고장 났는지 모른다.
   *
   * 공개 굽기와 **같은 함수**(`listPage`·`postPage`)를 쓴다. 다른 것은 어디에 쓰느냐뿐이다.
   * 글이 없으면 목록만 — 빈 목록도 목록의 모양이다.
   */
  const style = themeStyle(conf.theme) + headStyle(conf.header, conf.theme)
  const { rows } = await pool.query(
    `select p.slug, p.no, p.title, p.body, p.width, p.title_doc, p.published_at,
            (select coalesce(a.thumb, a.file_path) from post_attachments a
              where a.post_id = p.id
                and (a.kind = 'banner' or position('attachment://' || a.attachment_id in p.body) > 0)
              /* 배너가 먼저, 없으면 본문에 먼저 나오는 사진을 대표로 — 라이브러리의
                 coverAttachmentId (배너 → 본문 첫 사진 → 없음)와 같은 규약이다.

                 ⚠ 찾는 것은 **참조(attachment://{id})** 이지 파일 주소가 아니다.
                 본문에는 주소를 안 박는다 — presigned URL 은 만료되고 저장 위치도 바뀌므로
                 라이브러리가 id 만 남긴다(post-editor-core/attachments.js 머리말).
                 파일 주소로 찾던 판은 **한 번도 안 맞는 죽은 코드**였다(2026-09-16 리뷰).
                 ⚠ 이 주석은 JS 템플릿 리터럴 안이라 백틱을 쓰면 문자열이 끊긴다. */
              order by (a.kind = 'banner') desc, position('attachment://' || a.attachment_id in p.body)
              limit 1) as cover,
            coalesce(
              (select json_agg(json_build_object('attachment_id', a.attachment_id, 'file_path', a.file_path))
                 from post_attachments a where a.post_id = p.id), '[]'::json) as attachments
       from posts p
      where p.kind = 'post' and p.published_at is not null and not p.hidden
      order by p.published_at desc limit 12`)
  /* 목록에 뜬 글은 **전부** 상세를 굽는다. 목록과 상세가 한 벌이라 둘을 같이 봐야 하고,
     위에서 링크를 미리보기 안으로 돌렸으므로 안 구운 글을 누르면 404 가 뜬다(최대 12편). */
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
  /* 견본 글도 상세까지 굽는다 — 목록만 견본이면 제목을 눌렀을 때 404 가 뜬다 */
  await blog('dummy', DUMMY_POSTS)
  return { ...r, dummy: d.pages, blog: rows.length }
}

/**
 * 아무것도 안 고른 사이트의 모양 — 어휘의 기본값에 **이 레포의 색·글꼴**을 얹은 것이다.
 *
 * `site.config.mjs` 의 `theme` 이 `public/assets/site.css` 의 `:root` 와 같은 값을 들고
 * 있어, 설정을 한 번도 안 건드린 사이트의 화면이 안 바뀐다. 이상한 값이면 어휘의
 * 기본값으로 떨어진다 — 설정 한 줄 때문에 배포가 멈추지는 않는다.
 *
 * ⚠ **굽기와 관리자 API 가 같은 것을 봐야 한다.** 한쪽만 이 씨앗을 쓰면 미리보기에는
 * 어휘 기본색이, 진짜 화면에는 레포 색이 나가 둘이 갈린다.
 */
export const SITE_DEFAULTS = {
  ...DEFAULTS,
  theme: normalize('theme', site.theme, FONT_VALUES).value || DEFAULTS.theme,
}

/**
 * 지금 모양을 읽는다. **키마다 가장 큰 rev** 가 지금 값이다(덧붙임 전용).
 * 행이 없으면 기본값 — 즉 설정을 한 번도 안 건드린 사이트는 지금 화면 그대로다.
 *
 * 굽기는 **관대하다**: 이상한 항목은 버리고 나머지를 굽는다. 설정 한 줄 때문에
 * 배포가 멈추면 글 하나 고치려던 사람이 사이트를 통째로 잃는다.
 * 엄격한 쪽은 관리자 API 다 — 거기서 무엇이 왜 틀렸는지 알려 준다.
 */
export async function loadConf(pool) {
  const conf = { ...SITE_DEFAULTS }
  /* **표가 아직 없는 서버만** 봐준다(첫 배포). 권한·연결 오류까지 삼키면 고른 색이
     조용히 기본값으로 구워지고 아무 데도 자국이 안 남는다 */
  const { rows } = await pool.query(
    `select distinct on (key) key, value from site_settings order by key, rev desc`)
    .catch((e) => { if (e.code === '42P01') return { rows: [] }; throw e })
  for (const r of rows) {
    if (!KEYS.includes(r.key)) continue
    /* 글꼴 목록을 넘긴다 — 빈 목록이면 글꼴 검사를 통째로 건너뛰어, DB 에 들어간 아무 문자열이
       CSS 로 나갔다(리뷰 minor 9). 굽기 쪽 fontStack 도 한 번 더 거른다 */
    const { value } = normalize(r.key, r.value, FONT_VALUES)
    if (value) conf[r.key] = value
  }
  return conf
}

/**
 * 발행된 글 전부를 다시 굽는다.
 *
 * 통째로 다시 굽는 이유: 번호(01·02…)와 편수가 목록 전체에 걸려 있어서, 한 편만
 * 고쳐 쓰면 나머지 번호가 어긋난다. 글이 수백 편이 되기 전에는 이게 제일 싸고 안전하다.
 * 지운 글의 폴더가 남지 않도록 글 디렉터리는 매번 비우고 새로 만든다.
 */
/**
 * 굽기는 **한 번에 하나만** 돈다.
 *
 * 둘이 같이 돌면 원자적 쓰기의 임시 파일을 서로 뺏고(`ENOENT … rename`), 청소 루프가
 * 상대가 방금 쓴 폴더를 지운다. 「발행」과 「모양 저장」이 같은 순간에 오면 실제로 그랬다.
 * 프로세스 안에서만 막으면 충분하다 — 굽기를 부르는 건 이 API 하나다.
 */
let baking = Promise.resolve()
export function bake(pool) {
  const next = baking.then(() => bakeNow(pool), () => bakeNow(pool))
  baking = next.catch(() => {})            /* 실패가 다음 굽기를 막지 않게 */
  return next
}

async function bakeNow(pool) {
  const conf = await loadConf(pool)
  const { rows } = await pool.query(
    `select p.slug, p.no, p.title, p.body, p.width, p.title_doc, p.published_at,
            (select coalesce(a.thumb, a.file_path) from post_attachments a
              where a.post_id = p.id
                and (a.kind = 'banner' or position('attachment://' || a.attachment_id in p.body) > 0)
              /* 배너가 먼저, 없으면 본문에 먼저 나오는 사진을 대표로 — 라이브러리의
                 coverAttachmentId (배너 → 본문 첫 사진 → 없음)와 같은 규약이다.

                 ⚠ 찾는 것은 **참조(attachment://{id})** 이지 파일 주소가 아니다.
                 본문에는 주소를 안 박는다 — presigned URL 은 만료되고 저장 위치도 바뀌므로
                 라이브러리가 id 만 남긴다(post-editor-core/attachments.js 머리말).
                 파일 주소로 찾던 판은 **한 번도 안 맞는 죽은 코드**였다(2026-09-16 리뷰).
                 ⚠ 이 주석은 JS 템플릿 리터럴 안이라 백틱을 쓰면 문자열이 끊긴다. */
              order by (a.kind = 'banner') desc, position('attachment://' || a.attachment_id in p.body)
              limit 1) as cover,
            coalesce(
              (select json_agg(json_build_object('attachment_id', a.attachment_id, 'file_path', a.file_path))
                 from post_attachments a where a.post_id = p.id), '[]'::json) as attachments
       from posts p
      where p.kind = 'post' and p.published_at is not null and not p.hidden
      order by p.published_at desc`,
  )
  /**
   * 글 폴더에는 **올린 사진도 같이 산다.** 그래서 통째로 지우고 다시 만들면 원본이 날아간다.
   * `index.html` 만 덮어쓰고, **글 자체가 없어진 폴더만** 지운다.
   *
   * 초안(발행 취소)과 삭제를 가른다 — 초안은 글이 살아 있으므로 폴더를 남기고
   * `index.html` 만 치운다. 안 그러면 발행을 내렸다가 다시 올릴 때 사진이 사라진다.
   */
  /**
   * 「살아 있는 글」과 「지금 보이는 글」은 다르다 — 숨긴 글은 폴더를 남기고 index.html 만
   * 지운다. 사진 원본이 거기 있으므로 다시 보이게 할 때 그대로 살아나야 한다.
   *
   * ⚠ **폴더 이름이 두 종류다.**
   *     `{슬러그}/index.html`   글 페이지        (postPage 가 여기에 쓴다)
   *     `{번호}/{첨부id}`       올린 사진        (admin-api 가 여기에 쓴다)
   *   슬러그를 따로 안 주면 슬러그 = 번호라 둘이 한 폴더가 된다. 그래서 예전 판은
   *   **숫자 이름 폴더만** 훑었는데, 슬러그를 준 글은 거기 안 걸렸다:
   *     · 글을 내려도 `{슬러그}/index.html` 이 안 지워져 **계속 공개됐다**
   *     · 발행할 때마다 「구운 글 0 ≠ 발행 글 1」로 bakeError 가 떴다
   *   (2026-09-16 실측: slug=hello-docker 를 hidden 으로 돌린 뒤에도 200 이 떴다)
   *   이제 **DB 의 슬러그**를 훑는다 — 디스크를 훑지 않으므로 우리가 안 만든 폴더는 건드리지 않는다.
   */
  /* ⚠ **글만** 훑는다. 작업(`kind='work'`)은 `/portfolio/{번호}/` 로 나가지 루트의
       `{슬러그}/` 가 아니다 — 종류를 안 가르면 작업 슬러그가 같은 이름의 글 폴더를 겨눈다 */
  const alive = await pool.query(
    `select slug, (published_at is not null and not hidden) as pub from posts where kind = 'post'`)
  /** 슬러그 → 지금 보이는가 */
  const bySlug = new Map(alive.rows.map((r) => [r.slug, r.pub]))

  await mkdir(OUT, { recursive: true })
  /**
   * ⚠ **폴더를 지우지 않는다.** 「우리 표에 없는 폴더」를 `rm -rf` 하면 안 된다 — 사진은
   * 저장보다 먼저 올라가므로(번호를 미리 뽑아 쌓는 구조) **저장 전인 글의 원본이 그 그물에
   * 걸려 영구히 사라진다.** 지운 글의 폴더는 삭제 API 가 이미 휴지통으로 옮긴다 —
   * 굽기가 또 지울 이유가 없다.
   *
   * 안 보이는 글은 `index.html` 만 치운다. **키는 슬러그다** — 위 주석 참고.
   */
  for (const [slug, pub] of bySlug) {
    if (!pub) await rm(`${OUT}/${slug}/index.html`, { force: true })
  }
  /**
   * 색·글꼴은 **사이트 전체의 것**이다 — 블로그만 옛 색이면 같은 사이트로 안 읽힌다.
   * 글 본문의 글꼴은 글마다 저장돼 있어 여기서 안 건드린다(편집 화면과 갈라지므로).
   *
   * 첫 테마는 `site.config.mjs` 의 `theme` 에서 온다(`DEFAULT_THEME`). 그 값을 레포의
   * `site.css` 팔레트와 같게 실어야 아무것도 안 고른 사이트의 화면이 안 바뀐다 —
   * 어긋나면 별색·표제 글꼴이 말없이 덮인다(2026-09-16 에 실제로 겪었다).
   */
  const style = themeStyle(conf.theme) + headStyle(conf.header, conf.theme)
  await writeFile(`${OUT}/index.html`, listPage(rows, style, conf))
  for (const p of rows) {
    await mkdir(`${OUT}/${p.slug}`, { recursive: true })
    await writeFile(`${OUT}/${p.slug}/index.html`, postPage(p, style, conf))
  }

  /**
   * 제 산출물을 스스로 본다 — 구운 글은 `public/` 밖(볼륨)에 있어 레포를 보는 검사로는
   * 닿지 않는다. 검사는 산출물을 만든 쪽이 한다.
   */
  /* 디스크를 세면 **우리가 안 만든 폴더**까지 세어져, 손으로 되돌려 놓은 휴지통 폴더 하나가
     모든 굽기를 영원히 실패시킨다. 이번에 쓴 것과 발행 수를 맞춘다 */
  const made = rows.filter((p) => existsSync(`${OUT}/${p.slug}/index.html`))
  if (made.length !== rows.length) {
    throw new Error(`구운 글 ${made.length} ≠ 발행 글 ${rows.length} — 굽기가 빠뜨렸습니다`)
  }
  for (const p of rows) {
    const html = await readFile(`${OUT}/${p.slug}/index.html`, 'utf8')
    /* 폭·여백 규칙이 `.prose > .prose-body` 두 겹에 걸려 있다. 한 겹이면 조용히 무너진다 */
    if (!/class="prose"/.test(html) || !/class="prose-body"/.test(html)) {
      throw new Error(`${p.slug}: .prose > .prose-body 두 겹이 없습니다`)
    }
    if (html.includes('attachment://')) {
      throw new Error(`${p.slug}: 주소로 못 푼 첨부가 남았습니다`)
    }
    /* 첨부 표에 없는 id 는 라이브러리가 `src=""` 로 바꿔 버린다 — 그래서 위 검사에 안 걸린다.
       빈 주소는 브라우저가 **현재 페이지를 한 번 더 받는** 함정이라 여기서 따로 본다 */
    if (/\s(?:src|href)=""/.test(html)) {
      throw new Error(`${p.slug}: 빈 주소(src/href)가 있습니다 — 첨부 기록이 빠졌습니다`)
    }
  }
  /* 화면은 블로그가 다 끝난 뒤에 굽는다 — 화면 굽기가 실패해도 블로그는 이미 나가 있다 */
  const { pages, works, warn } = await bakePages(pool, { conf })
  return { count: rows.length, pages, works, warn }
}

/** 글 폴더만 골라낸다 — 이름이 숫자인 것. assets·fonts 는 건드리지 않는다 */
/** 명령줄에서 한 번 굽고 끝낸다 — `npm run bake` */
export async function bakeOnce() {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({
    host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE,
    user: process.env.PGUSER, password: process.env.PGPASSWORD,
    ssl: pgSsl(),
    /* extensions 를 빼면 crypt()·gen_salt() 를 못 찾는다 — admin-api.mjs 주석 참조 */
    options: `-c search_path=${process.env.PGSCHEMA},extensions,public`,
    max: 1,
  })
  const r = await bake(pool)
  await pool.end()
  console.log(JSON.stringify(r))
  return r
}
