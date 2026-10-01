#!/usr/bin/env node
/**
 * 글꼴 검사 — 재배포해도 되는 것만 실려 있는가.
 *
 * 엄격한 쪽은 **남이 클론해 가는 레포**입니다. `public/fonts/` 에 커밋한 woff2 가
 * 클론하는 사람마다 한 벌씩 복사되므로 재배포이기 때문입니다. `site.config.mjs` 의
 * `redistributed` 가 그것을 가릅니다 — 공개 템플릿은 `true`, 파생된 개인 사이트는 `false`.
 *
 * `false` 인 레포에서는 손으로 받은 글꼴을 `public/assets/fonts.local.css` 에 `@font-face`
 * 로 선언해 두면 출처 검사를 통과합니다. 그 선언이 「알고 넣었다」는 기록입니다. 선언도
 * 없이 파일만 굴러다니면 그때는 `true` 든 `false` 든 걸립니다.
 *
 * 아래 조건은 `redistributed: true` 일 때 지켜야 하는 것입니다:
 *
 *   1. 라이선스 전문이 글꼴 파일과 함께 가야 합니다 (OFL 2조)
 *   2. 원본을 고친 것(서브셋·포맷 변환 포함)은 예약된 이름을 쓸 수 없습니다 (OFL 3조)
 *
 * 1번은 여기서 기계로 봅니다 — 모든 글꼴이 `licenses/INDEX.json` 에 출처가 적혀 있고,
 * 그 패키지의 라이선스 전문이 `licenses/` 에 있는지. 출처를 적는 것은
 * `tools/sync-vendor.mjs` 고, 라이선스 전문이 없는 패키지는 거기서 던집니다.
 *
 * 2번은 기계가 못 봅니다(예약 이름인지 알려면 원본 라이선스를 읽어야 합니다). 대신 규칙을
 * 하나로 좁혀 둡니다 — 글꼴은 npm 패키지에서만 옵니다. 손으로 내려받은 파일은 출처가
 * 없으니 1번에서 걸립니다. 직접 넣어야 한다면 `public/assets/fonts.local.css` 를 읽어라.
 *
 * (실제로 걸린 적이 있습니다: npm `d2coding` 은 `with Reserved Font Name D2Coding` 인
 *  글꼴을 제3자가 서브셋해 올린 것인데 라이선스 전문이 없었습니다. 나눔고딕코딩으로 바꿨습니다.)
 *
 * 나머지 셋은 「빠진 것·남는 것」을 봅니다:
 *   · CSS 가 부르는데 파일이 없습니다  → 그 글꼴은 조용히 안 뜹니다
 *   · 파일은 있는데 아무도 안 부릅니다 → 30MB 를 이유 없이 배포합니다
 *   · `--display`/`--sans`/`--mono` 가 가리키는 이름이 선언돼 있지 않습니다
 */
import { readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS = join(ROOT, 'public/fonts')
const ASSETS = join(ROOT, 'public/assets')
const LIC = join(FONTS, 'licenses')

/* 이 레포를 남이 클론해 가는가. 공개 템플릿은 true, 파생된 개인 사이트는 false 입니다. */
const { default: conf } = await import(join(ROOT, 'site.config.mjs'))
const REDISTRIBUTED = conf.redistributed !== false
console.log(REDISTRIBUTED
  ? '재배포 전제 — 남이 클론해 가는 레포로 봅니다(엄격)'
  : '재배포 안 함 — 이 레포만 쓰는 글꼴은 fonts.local.css 선언으로 갈음합니다')

const fail = []
const note = (ok, line) => { console.log(`  ${ok ? '✓' : '✗'} ${line}`); if (!ok) fail.push(line) }

const files = (await readdir(FONTS)).filter((f) => /\.(woff2?|otf|ttf)$/i.test(f))
const sheets = {}
for (const f of (await readdir(ASSETS)).filter((f) => f.endsWith('.css'))) {
  sheets[f] = await readFile(join(ASSETS, f), 'utf8')
}
/* 주석 안의 예시(`url('../fonts/MyFont.woff2')`)를 실제 참조로 세면 안 됩니다 */
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
  /* 손으로 받아 `fonts.local.css` 에 선언해 둔 것. 파일 이름이 `url(...)` 에 나오면
     선언된 것으로 봅니다 — 선언이 없으면 브라우저가 부르지도 않으니 파일만 남은 셈입니다. */
  const declaredLocally = new Set(
    [...(sheets['fonts.local.css'] || '').replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/url\(\s*['"]?[^'")]*?([^/'")]+\.(?:woff2?|otf|ttf))['"]?\s*\)/gi)]
      .map((m) => m[1]))

  const noSrc = files.filter((f) => !index.fonts[f]
    && !(!REDISTRIBUTED && declaredLocally.has(f)))
  const okLine = REDISTRIBUTED
    ? '모든 글꼴에 출처가 적혀 있다'
    : `모든 글꼴에 출처가 있다 (npm ${files.length - declaredLocally.size}벌 · 직접 넣은 ${declaredLocally.size}벌은 fonts.local.css 선언으로 갈음)`
  note(noSrc.length === 0, noSrc.length === 0 ? okLine
    : `출처 없는 글꼴 ${noSrc.length}벌 — ${noSrc.join(', ')}`)

  const licFiles = await readdir(LIC)
  const missing = Object.entries(index.packages)
    .filter(([, v]) => !licFiles.includes(v.licenseFile))
    .map(([k]) => k)
  note(missing.length === 0, missing.length === 0
    ? `라이선스 전문 ${Object.keys(index.packages).length}개가 모두 있다`
    : `라이선스 전문이 빠진 패키지 — ${missing.join(', ')}`)

  /* 빈 파일이 통과하지 않게 합니다 — 있는 것과 읽히는 것은 다릅니다 */
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
 * `@font-face` 안의 이름만 선언입니다. 쓰는 자리의 `font-family` 를 같이 세면
 * 「쓰기만 하고 안 실은 글꼴」이 제 이름으로 통과합니다 — 만들 때 실제로 한 번 통과시켰습니다.
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
 * 선언만으로는 부족합니다 — **그 선언이 실린 시트가 화면에 붙어야** 글꼴이 뜹니다.
 *
 * `fonts.local.css` 는 늘 붙지만 `fonts.css` 는 굽기가 판정해서 뺍니다(60KB). 판정이
 * 관리자에서 고른 글꼴만 보던 시절에는, 고른 것이 전부 로컬 시트에 있으면 시트가 빠지면서
 * `--mono: 'JetBrains Mono'` 가 시스템 고정폭으로 떨어졌습니다 — 번호·날짜·꼬리표가 통째로.
 * storkspear 에서 실제로 났습니다.
 *
 * 그래서 굽기의 `fontSheet` 를 **그대로 불러** 판정을 봅니다. 여기서 규칙을 따로 베껴 쓰면
 * 굽기만 고장 나도 이 검사는 초록입니다.
 */
/* 굽기는 모듈을 읽을 때 BLOG_DIR 을 요구하고 PAGES_DIR 과 겹치면 부팅을 막습니다.
   여기서는 아무것도 안 쓰므로 겹치지 않는 이름 둘만 주고 지나갑니다(check-bake.mjs 와 같은 수법) */
process.env.BLOG_DIR ||= join(tmpdir(), 'check-fonts-blog')
process.env.PAGES_DIR ||= join(tmpdir(), 'check-fonts-www')
const { fontSheet } = await import(join(ROOT, 'server/bake.mjs'))
const local = new Set([...(sheets['fonts.local.css'] ?? '').matchAll(/font-family:\s*['"]?([^'";]+?)['"]?\s*;/g)]
  .map((m) => m[1].trim()))
/* 라이브러리 시트가 실제로 들고 있는 이름만 셉니다 — Menlo 같은 시스템 대체본은 웹글꼴이 아닙니다 */
const libDeclared = new Set([...(sheets['fonts.css'] ?? '').matchAll(/@font-face\s*\{[^}]*\}/g)]
  .flatMap((b) => [...b[0].matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1])))
const unreachable = [...used].filter((n) => libDeclared.has(n) && !local.has(n))
/* 고른 글꼴을 하나도 안 넘겨도 링크가 나와야 합니다 — site.css 몫만으로 판정되는지 보는 자리입니다 */
const emits = fontSheet().includes('/assets/fonts.css')
note(emits === (unreachable.length > 0), unreachable.length > 0
  ? (emits
      ? `site.css 의 ${unreachable.join('·')} 이 로컬 시트에 없어 굽기가 fonts.css 를 싣는다`
      : `site.css 가 ${unreachable.join('·')} 을 부르는데 굽기가 fonts.css 를 뺀다 — 그 글꼴이 안 뜬다`)
  : (emits
      ? 'site.css 글꼴이 전부 로컬 시트에 있는데 fonts.css 를 싣는다 — 판정이 헐겁다'
      : 'site.css 글꼴이 전부 로컬 시트에 있어 fonts.css 를 뺀다'))

/**
 * 템플릿이 들고 오는 글꼴 짝이 서버가 받는 이름인가.
 *
 * 어휘(`BLOG_TEMPLATES`)는 템플릿마다 글꼴 짝을 들고 오는데, 그 이름이 `FONT_VALUES`
 * 밖이면 고르는 순간 저장·미리보기가 400 으로 죽습니다 — 굽기까지 못 가므로 화면은
 * 「안 바뀝니다」로 보입니다. 실제로 12벌 중 7벌이 그 상태로 나갔습니다. 값이 데이터라 눈으로는 안 보이므로 여기서 셉니다.
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
