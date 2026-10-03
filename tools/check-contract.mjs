#!/usr/bin/env node
/**
 * 계약 검사 — 문자열로만 맺어진 약속이 깨졌는지 봅니다.
 *
 * 이 레포에는 코드 두 곳이 같은 이름을 각자 만들어 내는 자리가 많습니다.
 * 관리자 미리보기(admin/src/look.jsx 의 liveCss)와 굽기(server/bake.mjs 의 style 생성기들)가
 * 같은 CSS 변수 이름을 따로 적고, 어휘의 value 는 문자열 연결로 CSS 클래스 이름이 됩니다.
 * 공유 상수가 없으니 한쪽만 고쳐도 아무것도 깨지지 않은 것처럼 보입니다.
 *
 * 검사 넷:
 *   ① 미리보기와 굽기가 내는 CSS 변수 이름 집합이 같은가
 *   ② 어휘의 value 마다 대응 CSS 규칙이 있는가
 *   ③ 만들어 내는데 아무 CSS 도 안 읽는 변수가 있는가
 *   ④ 갈래 규칙의 명시도가 이겨야 할 바탕보다 센가
 *
 * ④ 는 규칙의 존재와 그 규칙이 실제로 적용되는 것이 다르기 때문에 있습니다. 명시도가 바탕에 지면
 * 파일 순서로만 이기거나 아예 안 먹는데, 문자열 검사는 통과합니다.
 * 이겨야 할 바탕은 header.css 와 blog.css 가 제 주석에 적어 둔 값을 그대로 씁니다.
 *
 * 검사가 대상을 하나도 못 찾으면 통과가 아니라 실패입니다. 빈 집합끼리 비교하면 늘 맞아떨어집니다.
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname
const read = (rel) => readFile(join(ROOT, rel), 'utf8')

const problems = []
const notes = []
const fail = (msg) => problems.push(msg)

/** 대상을 못 찾은 검사는 통과로 세지 않습니다 */
const expectFound = (what, n, least) => {
  if (n < least) fail(`${what}: 검사 대상을 ${n}개만 찾았습니다(최소 ${least}) — 검사가 죽었습니다`)
  return n >= least
}

const [look, bake, headerCss, blogCss] = await Promise.all([
  read('admin/src/look.jsx'),
  read('server/bake.mjs'),
  read('public/assets/templates/header.css'),
  read('public/assets/templates/blog.css'),
])

/**
 * 소비처는 public/assets 의 CSS 전부입니다 — 자동 생성물(prose.css·fonts.css)도 포함합니다.
 * 손으로 고치는 파일만 보면 생성물이 읽는 변수를 죽은 것으로 잘못 짚습니다(--measure-override).
 */
const cssFiles = async (dir) => {
  const out = []
  for (const e of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...await cssFiles(join(dir, e.name)))
    else if (e.name.endsWith('.css')) out.push(join(dir, e.name))
  }
  return out
}
const cssPaths = await cssFiles('public/assets')
const allCss = (await Promise.all(cssPaths.map(read))).join('\n')
const vocab = await import('../shared/site-vocab.mjs')

/* ── ① CSS 변수를 만드는 곳이 하나인가 ─────────────────────────────
   테마·헤더·knob 변수는 shared/site-css.mjs 한 곳에서만 만듭니다. 생성기와 관리자가 각자
   문자열로 적으면 이름이나 계산이 한쪽만 바뀌어 미리보기와 실제 화면이 갈립니다.

   요소마다 값이 다른 인라인 변수(무대 좌표, 푸터 색)는 예외입니다. 그 값들은 항목 단위로
   계산되므로 공유 모듈이 만들 수 없습니다. 목록에 없는 이름이 새로 생기면 검사가 잡습니다. */
const INLINE_OK = new Set([
  /* 무대·board 가 요소마다 다르게 싣는 좌표와 글꼴·색 */
  'sx', 'sy', 'sw', 'sh', 'sff', 'sc', 'bw',
  /* 푸터 섹션이 제 설정으로 덮는 값 */
  'fgap', 'fline', 'fline-c', 'fbg', 'fg', 'fg-2', 'fg-3', 'line', 'accent', 'hd-bg',
  /* 글 본문 폭 — 글마다 저장돼 있습니다 */
  'measure-override',
  /* 문단 바로가기의 위치 추적 — 링크마다 값이 다릅니다. 굽기가 글의 소제목 수만큼
     규칙을 찍어 내므로 공유 모듈에 둘 수 없습니다(bake.mjs 의 tocTimelineCss) */
  'bjp', 'bjq', 'bje', 'bjk', 'cur',
])
const declared = (src) => new Set(
  [...src.matchAll(/--([a-z][a-z0-9-]*)\s*:/g)].map((m) => m[1]).filter((n) => !n.startsWith('lk-')),
)
const shared = new Set(
  [...(await read('shared/site-css.mjs')).matchAll(/\['([a-z][a-z0-9-]*)',/g)].map((m) => m[1]),
)
if (expectFound('① 공유 모듈의 변수', shared.size, 20)) {
  const stray = []
  for (const [where, src] of [['server/bake.mjs', bake], ['admin/src/look.jsx', look]]) {
    for (const n of declared(src)) {
      if (INLINE_OK.has(n)) continue
      stray.push(`${where} 의 --${n}`)
    }
  }
  if (stray.length) {
    fail(`① shared/site-css.mjs 밖에서 CSS 변수를 만듭니다: ${stray.join(', ')}\n`
       + '    요소마다 값이 다른 것이면 INLINE_OK 에 이름과 까닭을 적고, 아니면 공유 모듈로 옮기세요')
  }
  notes.push(`① 공유 모듈이 만드는 변수 ${shared.size}종 · 인라인 예외 ${INLINE_OK.size}종`)
}

/* ── ② 어휘의 value 가 CSS 규칙을 갖는가 ─────────────────────────────
   value 는 bake.mjs 에서 클래스 이름으로 이어 붙습니다. 이름만 만들고 규칙을 안 쓰면
   그 갈래를 고른 사람에게는 아무 일도 일어나지 않습니다. */
const CLASS_OF = [
  ['NAV_STYLES', (v) => `.s-nav-${v}`, '헤더 메뉴'],
  ['DRAWER_STYLES', (v) => `.s-item-${v}`, '드로어 아이템'],
  ['SIDEBARS', (v) => `.s-drawer-${v}`, '사이드바 모양'],
  ['BLOG_TEMPLATES', (v) => `.bl-${v}`, '블로그 목록'],
  ['OUTLINE_SKINS', (v) => `.bo-${v}`, '카드 테마'],
  ['TOC_SKINS', (v) => `.bj-${v}`, '문단 바로가기 표식'],
  ['CAT_STRIP_STYLES', (v) => `.b-cats-${v}`, '카테고리 줄 모양'],
  ['PORTFOLIO_TEMPLATES', (v) => `.pf-${v}`, '포트폴리오 목록'],
]
let checkedValues = 0
for (const [list, toClass, label] of CLASS_OF) {
  const items = vocab[list]
  if (!items) { fail(`② ${list} 를 어휘에서 못 찾았습니다`); continue }
  for (const { value } of items) {
    checkedValues++
    /* 기본 갈래는 바탕 규칙이 그대로 맡아 제 클래스 규칙이 없을 수 있습니다.
       그래서 첫 값은 건너뛰고 나머지만 봅니다 */
    if (value === items[0].value) continue
    if (!allCss.includes(toClass(value))) {
      fail(`② ${label} '${value}' 의 CSS 규칙이 없습니다 — ${toClass(value)} 를 아무 파일도 안 씁니다`)
    }
  }
}
if (expectFound('② 어휘 value', checkedValues, 20)) {
  notes.push(`② 어휘 value ${checkedValues}종이 CSS 규칙을 갖는지 확인`)
}

/* ── ③ 아무도 안 읽는 변수 ───────────────────────────────────────────
   var(--이름) 으로 읽는 곳이 하나도 없으면 그 변수를 만드는 코드는 죽은 코드입니다.

   소비처는 CSS 파일만이 아닙니다. 굽기가 요소의 인라인 스타일에 var(--x) 를 써 넣는 자리도
   있습니다(--foot-w 를 푸터의 --bw 로 넘기는 것). 소스도 같이 봅니다. */
const consumed = new Set(
  [...`${allCss}\n${bake}\n${look}`.matchAll(/var\(\s*--([a-z][a-z0-9-]*)/g)].map((m) => m[1]),
)
if (expectFound('③ 변수 소비처', consumed.size, 20)) {
  const dead = [...shared].filter((n) => !consumed.has(n))
  if (dead.length) fail(`③ 만들지만 아무 CSS 도 안 읽는 변수: ${dead.join(', ')}`)
  notes.push(`③ CSS 가 읽는 변수 ${consumed.size}종과 대조`)
}

/* ── ④ 갈래 규칙의 명시도 ────────────────────────────────────────────
   (id, 클래스·속성·가상클래스, 요소·가상요소) 셋을 셉니다. 가상요소(::before)는 요소로 셉니다.
   이겨야 할 바탕은 두 CSS 파일이 제 주석에 적어 둔 값입니다. */
const spec = (sel) => {
  let s = sel.trim()
  /* :not(...) 안쪽은 그 자체로 세고 괄호는 안 셉니다 */
  const inner = [...s.matchAll(/:not\(([^)]*)\)/g)].map((m) => m[1])
  s = s.replace(/:not\([^)]*\)/g, ' ')
  const ids = (s.match(/#[\w-]+/g) || []).length
  const cls = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]+\]/g) || []).length
    + (s.match(/(?<!:):(?!:)(?:hover|focus|focus-visible|active|first-child|last-child|nth-child\([^)]*\)|target|checked|is\([^)]*\)|has\([^)]*\))/g) || []).length
  const el = (s.match(/(?:^|[\s>+~])([a-z][\w-]*)/g) || []).length + (s.match(/::[\w-]+/g) || []).length
  const base = [ids, cls, el]
  for (const i of inner) {
    const [a, b, c] = spec(i)
    base[0] += a; base[1] += b; base[2] += c
  }
  return base
}
const beats = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2])

/**
 * 두 선택자가 같은 것을 겨냥하는가 — 마지막 조각의 요소 이름과 가상요소로 봅니다.
 * `.s-nav.s-nav-box a:hover` 와 `.s-head .s-nav a:not([aria-current])` 는 둘 다 a 라서 다툽니다.
 * `.s-nav.s-nav-index` 는 nav 를 겨냥하므로 다투지 않습니다.
 */
const subject = (sel) => {
  const last = sel.trim().split(/[\s>+~]+/).pop() || ''
  const el = last.match(/^[a-z][\w-]*/)
  const pseudo = last.match(/::[\w-]+/)
  return `${el ? el[0] : ''}${pseudo ? pseudo[0] : ''}`
}
const sameSubject = (a, b) => subject(a) === subject(b)

/** 최상위 쉼표로만 쪼갭니다 — 괄호 안의 쉼표는 :is()·:not() 의 일부입니다 */
const splitTop = (sel) => {
  const out = []
  let depth = 0, cur = ''
  for (const ch of sel) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}

/* 레포가 적어 둔 계약: [파일, 갈래 클래스 접두, 이겨야 할 바탕 선택자] */
const SPEC_RULES = [
  [headerCss, 's-nav-', '.s-head .s-nav a:not([aria-current])'],
  [blogCss, 'bl-', '.bl .b-item'],
]
let checkedSelectors = 0
for (const [css, prefix, baseSel] of SPEC_RULES) {
  const need = spec(baseSel)
  /* 선택자만 뽑습니다 — 여는 중괄호 앞의 한 줄 */
  for (const m of css.matchAll(/(^|\n)\s*([^{}\n@][^{}\n]*?)\s*\{/g)) {
    const sel = m[2]
    if (sel.startsWith('/*') || !sel.includes(`.${prefix}`)) continue
    /* 쉼표로 묶인 것은 각각 따로 봅니다. 단 :is(a, b) 처럼 괄호 안의 쉼표는 구분자가 아닙니다 */
    for (const one of splitTop(sel)) {
      if (!one.includes(`.${prefix}`)) continue
      /* 바탕과 같은 것을 겨냥하는 규칙만 견줍니다. 감싸는 요소에 거는 규칙
         (.s-nav-index 의 counter-reset 처럼)은 a 의 색과 다투지 않습니다 */
      if (!sameSubject(one, baseSel)) continue
      checkedSelectors++
      if (beats(spec(one), need) < 0) {
        fail(`④ 명시도가 바탕에 집니다 — ${one.trim()} (${spec(one).join(',')}) < ${baseSel} (${need.join(',')})`)
      }
    }
  }
}
if (expectFound('④ 갈래 선택자', checkedSelectors, 20)) {
  notes.push(`④ 갈래 선택자 ${checkedSelectors}개의 명시도 확인`)
}

/**
 * ⑤ 글의 본문 폭 — 굽기의 규칙이 편집기 라이브러리의 규칙과 같은가.
 *
 * 왜 문자열 검사로 안 되는가: 이 약속은 「같은 이름을 쓴다」가 아니라 「같은 값을 낸다」입니다.
 * 라이브러리가 어휘를 늘리면(예전에 `'full'` 이 그랬습니다) 굽기는 그 값을 모른 채 조용히
 * **아무 값도 안 내고**, 발행된 글만 기본 폭으로 돌아갑니다. 검사가 통과한 채로요.
 * 그래서 양쪽 함수를 **직접 불러** 결과를 견줍니다(글꼴 시트에서 같은 종류의 결함을 겪었습니다).
 */
const WIDTHS_TO_TRY = [undefined, null, '', 'measure', 'full', '68rem', '100%', '800px', '52ch',
                       '38rem', 'wide', ';color:red', 'calc(100% - 2rem)', '-5rem']
/**
 * 라이브러리는 관리자 쪽 의존성입니다. 어디에 놓이는지는 레포마다 다릅니다 —
 * `admin` 이 npm 워크스페이스라 보통 **레포 루트로 끌어올려지고**, 편집기를 같이 고치는
 * 레포에서는 그 자리가 `lib-post-editor` 를 가리키는 **심볼릭 링크**입니다.
 * 한 경로만 박아 두면 그런 레포에서 「못 찾았습니다」로 헛되이 빨개집니다. 둘 다 봅니다.
 *
 * 못 찾으면 통과시키지 않습니다 — 빈 비교는 늘 맞아떨어집니다.
 */
const LIB_AT = ['node_modules', 'admin/node_modules']
  .map((d) => join(ROOT, d, '@storkspear/post-editor-core/dist/proseWidth.js'))
const LIB = LIB_AT.find((f) => existsSync(f))
if (!LIB) {
  fail(`⑤ 편집기 라이브러리를 못 찾았습니다 — npm i 를 먼저 하세요 (본 자리: ${LIB_AT.join(' · ')})`)
} else {
  /* 굽기를 불러오려면 출력 경로가 있어야 합니다. 아무것도 안 쓰지만 모듈이 부팅에서 던집니다 */
  process.env.BLOG_DIR ||= join(tmpdir(), 'check-contract-blog')
  process.env.PAGES_DIR ||= join(tmpdir(), 'check-contract-pages')
  const [{ proseWidthStyle }, { proseWidthVars }] = await Promise.all([
    import(pathToFileURL(LIB).href),
    import(pathToFileURL(join(ROOT, 'server/bake.mjs')).href),
  ])
  const norm = (o) => JSON.stringify(o ? Object.fromEntries(Object.entries(o).sort()) : null)
  let sameCount = 0
  for (const w of WIDTHS_TO_TRY) {
    const lib = norm(proseWidthStyle(w))
    const ours = norm(proseWidthVars(w))
    if (lib !== ours) fail(`⑤ 본문 폭 ${JSON.stringify(w)} — 라이브러리 ${lib} vs 굽기 ${ours}`)
    else sameCount++
  }
  if (expectFound('⑤ 본문 폭', sameCount, WIDTHS_TO_TRY.length)) {
    notes.push(`⑤ 본문 폭 어휘 ${sameCount}가지가 라이브러리와 같은 값을 낸다`)
  }
}

/* ── ⑥ 코드 언어마다 발행본에 색이 나가는가 ───────────────────────────
   편집 화면은 ProseMirror 데코레이션으로 색을 입히고, 발행본은 굽기가 `<span class="hljs-…">`
   을 미리 박습니다. 둘은 다른 경로라 한쪽만 되는 상태가 **에러 없이** 성립합니다.

   실제로 그랬습니다 — 굽기가 문법을 안 싣고 `toPublishedHtml` 을 불러 rust·go·csharp·
   markdown·nginx·php 여섯이 흑백으로 나갔습니다. 글쓴이 화면에는 색이 보여서 몇 달을 몰랐습니다.

   그래서 두 가지를 봅니다. 문법을 싣기 전에는 **반드시 몇 종이 깜깜해야** 하고(안 그러면
   이 검사는 아무것도 안 재고 있는 것입니다), 싣고 나면 **한 종도 깜깜하면 안 됩니다.**
   싣는 일은 굽기 모듈이 해야 하므로 그 호출이 거기 적혀 있는지도 글자로 확인합니다. */
{
  const HL = pathToFileURL(join(ROOT, 'server/vendor/post-editor-core/highlight.js')).href
  const { LANGUAGES, preloadLanguages } = await import(HL)
  const SER = pathToFileURL(join(ROOT, 'server/vendor/post-editor-core/serialize.js')).href
  const { toPublishedHtml } = await import(SER)
  /* 표본은 그 언어가 토큰으로 읽을 만한 몇 줄이면 됩니다 — 「무엇이 몇 개」가 아니라 「0인가」만 봅니다 */
  const 표본 = [
    '{ "a": 1, "b": "두" }', 'if (a == 1) { return "hi"; }', '# 주석 한 줄',
    '<a href="/b">다</a>', 'SELECT 1 FROM t WHERE x = 2;', '@@ -1,2 +1,2 @@', '+더한 줄', '-뺀 줄',
  ].join('\n')
  const 깜깜 = () => {
    const out = []
    for (const l of LANGUAGES) {
      const id = typeof l === 'string' ? l : (l.id ?? l.value)
      if (!id) continue
      const html = `<details data-code="" data-lang="${id}"><summary><span class="cb-lang">x</span></summary>`
        + `<pre><code>${표본.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre></details>`
      if (!/hljs-/.test(toPublishedHtml(html))) out.push(id)
    }
    return out
  }
  /* 「싣기 전」은 **딴 프로세스**에서 잽니다. 이 프로세스는 ⑤ 에서 이미 굽기 모듈을 들여왔고
     그 모듈이 최상단에서 문법을 싣기 때문에, 여기서 재면 늘 0 이 나옵니다 — 그러면 이 검사는
     아무것도 안 재면서 초록입니다. 깨끗한 프로세스를 하나 띄워 「고치기 전의 상태」를 확인합니다. */
  const 전 = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    const { LANGUAGES } = await import(${JSON.stringify(HL)})
    const { toPublishedHtml } = await import(${JSON.stringify(SER)})
    const 표본 = ${JSON.stringify(표본)}
    const out = []
    for (const l of LANGUAGES) {
      const id = typeof l === 'string' ? l : (l.id ?? l.value)
      if (!id) continue
      const html = '<details data-code="" data-lang="' + id + '"><summary><span class="cb-lang">x</span></summary>'
        + '<pre><code>' + 표본.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</code></pre></details>'
      if (!/hljs-/.test(toPublishedHtml(html))) out.push(id)
    }
    process.stdout.write(JSON.stringify(out))
  `], { encoding: 'utf8' }))
  if (!전.length) fail('⑥ 문법을 싣기 전인데 깜깜한 언어가 하나도 없습니다 — 이 검사가 죽었습니다')
  await preloadLanguages()
  const 후 = 깜깜()
  if (후.length) fail(`⑥ 발행본에 색이 안 나가는 언어 ${후.length}종 — ${후.join(' · ')}`)
  /* 싣는 일은 굽기가 해야 합니다. 여기서 부른 것으로 통과하면 굽기가 안 불러도 초록입니다 */
  const bakeSrc = await read('server/bake.mjs')
  if (!/^await preloadLanguages\(\)/m.test(bakeSrc)) {
    fail('⑥ server/bake.mjs 가 최상단에서 `await preloadLanguages()` 를 안 부릅니다')
  }
  const 센것 = LANGUAGES.length
  if (expectFound('⑥ 코드 언어', 센것, 20) && !후.length) {
    notes.push(`⑥ 코드 언어 ${센것}종 — 싣기 전 ${전.length}종이 깜깜, 싣고 나면 0종`)
  }
}

for (const n of notes) console.log(`  ${n}`)
if (problems.length) {
  console.log('')
  for (const p of problems) console.log(`  ${p}`)
  console.log(`\n계약 검사 — ${problems.length}건 실패`)
  process.exit(1)
}
console.log('계약 검사 — 통과')
