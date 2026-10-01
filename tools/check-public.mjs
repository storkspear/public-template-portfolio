#!/usr/bin/env node
/**
 * 공개 산출물 검사.
 *
 * 이 사이트가 지켜야 하는 것은 「인터넷에 나가는 것은 읽기 전용 정적 HTML 뿐」입니다.
 * 사람이 지키기로 한 규칙은 언젠가 깨지므로, 깨지는 순간 알려면 검사가 있어야 합니다.
 *
 * `npm run build` 끝 · `publish.sh` 안(실패하면 배포 스왑 없음) · pre-push 훅에서 돕니다.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/* 검사 대상은 nginx 가 실제로 내는 것입니다 — 빌드 산출물이 아니라 배포되는 폴더를
   봐야 검사가 의미를 갖습니다. */
const DIST = join(ROOT, 'public')
const fails = []
const notes = []
const skipped = []

if (!existsSync(DIST)) {
  console.error('public/ 이 없습니다')
  process.exit(1)
}

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

/**
 * 조각도 같이 잽니다. 「직접 디자인」 화면의 본문은 `pages/*.html` 에 있고, 그 안의
 * `<script>` 가 그대로 방문자에게 나갑니다. `public/` 만 보면 이 검사는 늘 0.0KB 를 찍는데,
 * 그건 「가볍습니다」가 아니라 아무것도 재지 않았습니다는 뜻입니다.
 */
const PAGES = join(ROOT, 'pages')
/* 샘플도 관리자에서 고르면 그대로 나갑니다 — 조각과 같이 잽니다 */
const SAMPLES = join(ROOT, 'sample-pages')
const files = [...(await walk(DIST)),
  ...(existsSync(PAGES) ? await walk(PAGES) : []), ...(existsSync(SAMPLES) ? await walk(SAMPLES) : [])]
const text = files.filter((f) => ['.html', '.js', '.css'].includes(extname(f)))
const read = new Map()
for (const f of text) read.set(f, await readFile(f, 'utf8'))

const rel = (f) => (f.startsWith(PAGES + '/') ? 'pages/' + f.slice(PAGES.length + 1)
  : f.startsWith(SAMPLES + '/') ? 'sample-pages/' + f.slice(SAMPLES.length + 1) : f.slice(DIST.length + 1))

// ── 1. 편집기·관리자가 공개 산출물에 섞였는가 ─────────────────────────
//
// 글 내용과 실행 코드를 갈라야 합니다. 「tiptap 으로 편집기를 만들며」 같은 글을 쓰면 그 단어가
// 본문 HTML 에 들어가는데, 그건 편집기가 실린 것이 아닙니다. 그래서
//   - .js 는 통째로 봅니다 (실행 코드니까)
//   - .html 은 <script>·<link> 가 무엇을 끌어오는지만 봅니다 (본문 텍스트는 글쓴이의 것)
//   - .css 의 .ProseMirror 셀렉터는 편집 상태 스타일이라 공개 CSS 에도 정상적으로 남습니다
//   - 주소(canonical·og:url)는 보지 않습니다. 「tiptap」 태그 페이지의 URL 에 그 단어가 들어갈 뿐입니다
/**
 * 주석을 먼저 걷어냅니다. 주석은 실행되지 않는데, 안 걷으면 주석에 적힌 `<scr`+`ipt>`
 * 라는 글자가 여는 태그로 읽혀 거기서부터 진짜 닫는 태그까지가 통째로 「스크립트」가 됩니다
 * (`pages/portfolio.html` 의 설명 주석 하나가 인라인 JS 를 1.5KB → 33KB 로 부풀렸습니다).
 * 이 파일의 규약대로 본문 텍스트는 글쓴이의 것이고, 주석도 본문입니다.
 */
const noComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const SCRIPTS = /<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*src=[^>]*>/gi
const STYLESHEETS = /<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi
const executable = new Map()
for (const [f, s] of read) {
  if (extname(f) === '.js') executable.set(f, s)
  else if (extname(f) === '.css') executable.set(f, s)
  else if (extname(f) === '.html') {
    const live = noComments(s)
    executable.set(f, [...(live.match(SCRIPTS) ?? []), ...(live.match(STYLESHEETS) ?? [])].join('\n'))
  }
}

for (const [needle, why] of [
  ['tiptap', '편집기'],
  ['ProseMirror', '편집기'],
  ['prosemirror', '편집기'],
  ['/api/admin', '관리자 API 경로'],
  ['admin_token', '관리자 토큰 키'],
]) {
  const hits = [...executable].filter(([f, s]) =>
    s.includes(needle) && !(extname(f) === '.css' && /ProseMirror/i.test(needle)))
  if (hits.length) fails.push(`① ${why}(${needle}) 가 실행 코드에: ${hits.slice(0, 3).map(([f]) => rel(f)).join(', ')}`)
}

// ── 2. 소스 경계 ─────────────────────────────────────────────────────
//
// 굽기·API 는 편집기를 끌어오면 안 됩니다. `post-editor-core` 의 배럴(`index.js`)은
// Tiptap 확장 여섯 개를 통째로 import 하므로, 그 한 줄이 서버에 편집기를 통째로 들입니다.
// 그래서 vendor 에도 배럴을 복사하지 않았고(`tools/sync-vendor.mjs`), 여기서 다시 막습니다.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const serverFiles = (await walk(join(ROOT, 'server'))).filter(
  (f) => /\.mjs$/.test(f) && !f.includes('/node_modules/'),
)
for (const f of serverFiles) {
  const s = strip(await readFile(f, 'utf8'))
  for (const [re, why] of [
    [/from ['"][^'"]*post-editor-core\/index\.js['"]/, '서버가 core 배럴을 import (배럴은 Tiptap 을 통째로 끌고 온다 — 서브패스로)'],
    [/from ['"]@tiptap\//, '서버가 tiptap 을 import'],
    [/from ['"][^'"]*post-editor-react/, '서버가 편집기 React 패키지를 import'],
  ]) if (re.test(s)) fails.push(`② ${f.slice(ROOT.length + 1)}: ${why}`)
}

// ── 3. JS 예산 ───────────────────────────────────────────────────────
//
// 인라인까지 셉니다. 이 사이트는 .js 파일이 0개입니다 — 토글·톤 같은 잔 스크립트를 Astro 가
// HTML 안에 바로 넣기 때문입니다. 파일만 재던 동안 이 검사는 늘 0.0KB 를 찍었고, 그건
// 「가볍습니다」가 아니라 아무것도 재지 않았습니다는 뜻이었습니다.
// 상한은 없습니다. 예전에 여기 「≤30KB」가 박혀 있었지만 그건 사용자가 요구한 적 없는
// 제가 정한 숫자였고, 디자인을 좁히는 쪽으로만 작용했습니다. 편집기·관리자가 공개 페이지에
// 안 섞이는 진짜 계약은 ①②와 패키지 경계가 지킵니다.
// 그래도 숫자는 찍습니다 — 어느 날 몇 배가 되면 그건 알아야 할 일입니다.
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
let fileBytes = 0
for (const f of files.filter((f) => extname(f) === '.js')) fileBytes += (await stat(f)).size
let inlineBytes = 0
for (const [f, s] of read) {
  if (extname(f) !== '.html') continue
  for (const m of noComments(s).matchAll(INLINE_SCRIPT)) inlineBytes += Buffer.byteLength(m[1], 'utf8')
}
const jsBytes = fileBytes + inlineBytes
notes.push(`공개 JS ${(jsBytes / 1024).toFixed(1)}KB (파일 ${(fileBytes / 1024).toFixed(1)} + 인라인 ${(inlineBytes / 1024).toFixed(1)})`)

// ── 4. 글 페이지 ─ 여기서 안 봅니다 ────────────────────────────────
//
// 블로그는 이제 `public/` 밖(BLOG_DIR)에서 구워지고 nginx 가 `/blog/` 를 그리로 alias 합니다.
// 그래서 글 수·본문 구조는 굽기가 제 산출물을 보고 검사합니다(bake.mjs 끝).
// 여기 두면 `content-cache/posts.json` 이라는 죽은 픽스처를 정본으로 삼게 됩니다.
skipped.push('④ 글 페이지(굽기가 검사)')

// ── 5. 만료되는 주소가 새어 나갔는가 ─────────────────────────────────
// 여기도 글 내용과 가릅니다 — 본문에 `attachment://5` 를 글자로 적는 글이 있을 수 있습니다.
// 문제가 되는 것은 속성 자리에 남은 것(안 풀린 참조)과 어디에든 박힌 presigned 서명입니다.
for (const [re, why] of [
  [/\s(?:src|href|srcset)=["']attachment:\/\//i, '첨부 참조가 속성에 그대로 남음(안 풀림)'],
  [/X-Amz-Signature=/i, 'presigned 서명이 박힘 — 몇 분 뒤 깨진다'],
  [/X-Amz-Credential=/i, 'presigned 자격이 박힘'],
]) {
  const hits = [...read].filter(([, s]) => re.test(s))
  if (hits.length) fails.push(`⑤ ${why}: ${hits.slice(0, 3).map(([f]) => rel(f)).join(', ')}`)
}

// ── 6. 글꼴 출처 표기 ────────────────────────────────────────────────
for (const [f, s] of read) {
  if (extname(f) !== '.html') continue
  if (/JalnanGothic/.test(s) && !/위드이노베이션/.test(s)) {
    fails.push(`⑥ ${rel(f)}: 잘난체를 쓰는데 출처 표기가 없습니다`)
  }
}

// ── 7. 시안 랩이 새어 나갔는가 ───────────────────────────────────────
// 랩은 LAB=1 일 때만 경로가 생기지만, 그 조건이 언젠가 흐트러져도 여기서 걸립니다.
const labPages = files.filter((f) => /(^|\/)lab\//.test(rel(f)))
if (labPages.length) {
  fails.push(`⑦ 시안 랩이 공개 산출물에 들어왔습니다: ${labPages.slice(0, 3).map(rel).join(', ')}`)
}

// ── 8. 판화·사진 출처 표기 ───────────────────────────────────────────
// 퍼블릭 도메인이라도 「어디서 왔는지」는 남겨야 합니다. 원작이 PD 여도 고해상 스캔에
// 별도 권리가 주장되는 경우가 있고, 그때 기댈 것은 우리가 적어 둔 기록뿐입니다.
const creditsPath = join(ROOT, 'CREDITS.md')
const plates = [...new Set(
  [...read].filter(([f]) => extname(f) === '.html')
    .flatMap(([, s]) => [...s.matchAll(/\/plates\/([\w.-]+)/g)].map((m) => m[1])),
)]
if (plates.length) {
  const credits = existsSync(creditsPath) ? await readFile(creditsPath, 'utf8') : ''
  const missing = plates.filter((n) => !credits.includes(n))
  if (missing.length) fails.push(`⑧ CREDITS.md 에 출처가 없는 판화: ${missing.join(', ')}`)
}
notes.push(`판화 ${plates.length}점`)

// ── 9. 글꼴이 정말 닿는가 ────────────────────────────────────────
// fonts.css 원본은 절반을 @import '@fontsource/…' 로 부르는데, 그 이름은 번들러만
// 풉니다.** 편집 화면은 Vite 를 지나니까 떴고 발행 페이지는 정적이라 조용히 실패했습니다 —
// 제목에 고른 글씨체가 발행하면 딴 것으로 나왔습니다. 눈으로만 알 수 있던 종류라
// 검사로 못 박습니다: 풀리지 않는 이름이 남았거나, 부르는 woff2 가 없으면 실패.
const fontsCss = join(DIST, 'assets/fonts.css')
if (!existsSync(fontsCss)) {
  fails.push('⑨ public/assets/fonts.css 가 없습니다 — `npm run vendor:sync` 를 돌리세요')
} else {
  /* 주석은 걷어내고 봅니다 — 이 파일 머리에 「@fontsource 를 폈습니다」고 적혀 있어서,
     그대로 재면 제 설명문에 제가 걸립니다. */
  const css = (await readFile(fontsCss, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
  if (/@import|@fontsource/.test(css)) {
    fails.push('⑨ fonts.css 에 번들러만 푸는 이름이 남았습니다 — 브라우저는 못 찾습니다')
  }
  const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1])
  const gone = urls.filter((u) => !existsSync(join(DIST, 'assets', u)))
  if (gone.length) {
    fails.push(`⑨ fonts.css 가 없는 글꼴을 부릅니다: ${gone.slice(0, 3).join(', ')}`)
  }
  notes.push(`글꼴 ${urls.length}벌`)
}

console.log(`\n공개 산출물 검사 — ${notes.join(' · ')}`)
if (fails.length) {
  console.error('\n위반:')
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`  ✓ ${9 - skipped.length}개 검사 통과${skipped.length ? ` · 건너뜀 ${skipped.join(', ')}` : ''}\n`)
