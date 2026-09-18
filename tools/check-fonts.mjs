#!/usr/bin/env node
/**
 * 글꼴 검사 — **재배포해도 되는 것만 실려 있는가.**
 *
 * 이 레포는 공개 템플릿이다. `public/fonts/` 에 커밋한 woff2 는 클론하는 사람마다
 * 한 벌씩 복사되므로 **재배포**다. OFL·Apache 는 거기에 조건을 건다:
 *
 *   1. 라이선스 전문이 글꼴 파일과 **함께 가야 한다** (OFL 2조)
 *   2. 원본을 고친 것(서브셋·포맷 변환 포함)은 **예약된 이름을 쓸 수 없다** (OFL 3조)
 *
 * 1번은 여기서 기계로 본다 — 모든 글꼴이 `licenses/INDEX.json` 에 출처가 적혀 있고,
 * 그 패키지의 라이선스 전문이 `licenses/` 에 있는지. 출처를 적는 것은
 * `tools/sync-vendor.mjs` 고, 라이선스 전문이 없는 패키지는 거기서 **던진다.**
 *
 * 2번은 기계가 못 본다(예약 이름인지 알려면 원본 라이선스를 읽어야 한다). 대신 규칙을
 * 하나로 좁혀 둔다 — **글꼴은 npm 패키지에서만 온다.** 손으로 내려받은 파일은 출처가
 * 없으니 1번에서 걸린다. 직접 넣어야 한다면 `public/assets/fonts.local.css` 를 읽어라.
 *
 * (실제로 걸린 적이 있다: npm `d2coding` 은 `with Reserved Font Name D2Coding` 인
 *  글꼴을 제3자가 서브셋해 올린 것인데 라이선스 전문이 없었다. 나눔고딕코딩으로 바꿨다.)
 *
 * 나머지 셋은 「빠진 것·남는 것」을 본다:
 *   · CSS 가 부르는데 파일이 없다  → 그 글꼴은 조용히 안 뜬다
 *   · 파일은 있는데 아무도 안 부른다 → 30MB 를 이유 없이 배포한다
 *   · `--display`/`--sans`/`--mono` 가 가리키는 이름이 선언돼 있지 않다
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS = join(ROOT, 'public/fonts')
const ASSETS = join(ROOT, 'public/assets')
const LIC = join(FONTS, 'licenses')

const fail = []
const note = (ok, line) => { console.log(`  ${ok ? '✓' : '✗'} ${line}`); if (!ok) fail.push(line) }

const files = (await readdir(FONTS)).filter((f) => /\.(woff2?|otf|ttf)$/i.test(f))
const sheets = {}
for (const f of (await readdir(ASSETS)).filter((f) => f.endsWith('.css'))) {
  sheets[f] = await readFile(join(ASSETS, f), 'utf8')
}
/* 주석 안의 예시(`url('../fonts/MyFont.woff2')`)를 실제 참조로 세면 안 된다 */
const css = Object.values(sheets).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')

console.log(`글꼴 ${files.length}벌 · CSS ${Object.keys(sheets).length}개\n`)

/* ── 1. 출처와 라이선스 ─────────────────────────────────────── */
console.log('출처')
let index = null
try {
  index = JSON.parse(await readFile(join(LIC, 'INDEX.json'), 'utf8'))
} catch {
  note(false, 'licenses/INDEX.json 이 없습니다 — npm run vendor:sync 를 돌리세요')
}
if (index) {
  const noSrc = files.filter((f) => !index.fonts[f])
  note(noSrc.length === 0, noSrc.length === 0
    ? '모든 글꼴에 출처가 적혀 있다'
    : `출처 없는 글꼴 ${noSrc.length}벌 — ${noSrc.join(', ')}`)

  const licFiles = await readdir(LIC)
  const missing = Object.entries(index.packages)
    .filter(([, v]) => !licFiles.includes(v.licenseFile))
    .map(([k]) => k)
  note(missing.length === 0, missing.length === 0
    ? `라이선스 전문 ${Object.keys(index.packages).length}개가 모두 있다`
    : `라이선스 전문이 빠진 패키지 — ${missing.join(', ')}`)

  /* 빈 파일이 통과하지 않게 한다 — 있는 것과 읽히는 것은 다르다 */
  const empty = []
  for (const [name, v] of Object.entries(index.packages)) {
    const body = await readFile(join(LIC, v.licenseFile), 'utf8').catch(() => '')
    if (body.replace(/^.*\n=+\n.*\n=+\n/s, '').trim().length < 200) empty.push(name)
  }
  note(empty.length === 0, empty.length === 0
    ? '라이선스 전문이 모두 비어 있지 않다'
    : `전문이 비었거나 너무 짧은 패키지 — ${empty.join(', ')}`)

  const unknown = Object.entries(index.packages)
    .filter(([, v]) => !/OFL|Apache|MIT|Ubuntu/i.test(v.license)).map(([k, v]) => `${k}(${v.license})`)
  note(unknown.length === 0, unknown.length === 0
    ? '전부 재배포를 허락하는 라이선스다'
    : `확인이 필요한 라이선스 — ${unknown.join(', ')}`)
}

/* ── 2. 빠진 것·남는 것 ─────────────────────────────────────── */
console.log('\n파일')
const wanted = [...new Set([...css.matchAll(/url\(\s*['"]?(?:\.\.|)\/fonts\/([^'")]+)['"]?\s*\)/g)].map((m) => m[1]))]
const gone = wanted.filter((f) => !files.includes(f))
note(gone.length === 0, gone.length === 0
  ? `CSS 가 부르는 ${wanted.length}벌이 모두 있다`
  : `CSS 가 부르는데 없는 글꼴 — ${gone.join(', ')}`)

const orphan = files.filter((f) => !css.includes(f))
note(orphan.length === 0, orphan.length === 0
  ? '아무도 안 부르는 글꼴이 없다'
  : `안 쓰는 글꼴 ${orphan.length}벌 — ${orphan.join(', ')}`)

/* ── 3. 이름이 실제로 선언돼 있나 ───────────────────────────── */
console.log('\n이름')
/**
 * **`@font-face` 안의 이름만** 선언이다. 쓰는 자리의 `font-family` 를 같이 세면
 * 「쓰기만 하고 안 실은 글꼴」이 제 이름으로 통과한다 — 만들 때 실제로 한 번 통과시켰다.
 */
const declared = new Set([...css.matchAll(/@font-face\s*\{[^}]*\}/g)]
  .flatMap((b) => [...b[0].matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1])))
const site = sheets['site.css'] ?? ''
const used = new Set([...site.matchAll(/font-family:[^;}]*?'([^']+)'/g)].map((m) => m[1]))
for (const [, v, stack] of site.matchAll(/--(display|sans|mono):\s*([^;]+);/g)) {
  const first = stack.trim().split(',')[0].trim().replace(/^'|'$/g, '')
  if (!/^(-apple-system|system-ui|ui-|sans-serif|serif|monospace)/.test(first)) used.add(first)
  void v
}
const undeclared = [...used].filter((n) => !declared.has(n))
note(undeclared.length === 0, undeclared.length === 0
  ? `site.css 가 부르는 이름 ${used.size}개가 모두 선언돼 있다`
  : `선언이 없는 이름 — ${undeclared.join(', ')}`)

/**
 * **템플릿이 들고 오는 글꼴 짝이 서버가 받는 이름인가.**
 *
 * 어휘(`BLOG_TEMPLATES`)는 템플릿마다 글꼴 짝을 들고 오는데, 그 이름이 `FONT_VALUES`
 * 밖이면 **고르는 순간 저장·미리보기가 400 으로 죽는다** — 굽기까지 못 가므로 화면은
 * 「안 바뀐다」로 보인다. 실제로 12벌 중 7벌이 그 상태로 나갔다(2026-09-18 사용자 지적:
 * 「안되는게 9할이상임」). 값이 데이터라 눈으로는 안 보이므로 여기서 센다.
 */
{
  const { BLOG_TEMPLATES, MAIN_TEMPLATES, PORTFOLIO_TEMPLATES } = await import('../shared/site-vocab.mjs')
  const { FONT_VALUES } = await import('../server/vendor/post-editor-core/vocab.js')
  const ok = new Set(FONT_VALUES)
  const bad = []
  for (const [what, list] of [['블로그', BLOG_TEMPLATES], ['메인', MAIN_TEMPLATES], ['포트폴리오', PORTFOLIO_TEMPLATES]]) {
    for (const t of list) {
      for (const role of ['display', 'body']) {
        const name = t.font?.[role]
        if (name && !ok.has(name)) bad.push(`${what} ${t.label} ${role}=${name}`)
      }
    }
  }
  note(bad.length === 0, bad.length === 0
    ? '템플릿이 들고 오는 글꼴이 모두 쓸 수 있는 것이다'
    : `서버가 거절할 글꼴 — ${bad.join(' / ')}`)
}

console.log(fail.length === 0 ? '\n글꼴 검사 통과' : `\n글꼴 검사 실패 ${fail.length}건`)
process.exit(fail.length === 0 ? 0 : 1)
