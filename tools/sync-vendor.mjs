#!/usr/bin/env node
/**
 * 굽기가 쓰는 편집기 라이브러리 조각을 `server/vendor/` 로 복사합니다.
 *
 * 왜 vendor 인가: 서버(`server/`)는 제 `package.json` 으로 도는 별개 구역이고, 편집기는
 * 관리자 화면 쪽 의존성입니다. 서버가 굽기에 필요한 조각 여섯 개만 커밋해서 git 이력에
 * 남깁니다 — 그러면 배포가 `git pull` 하나로 끝나고, 사본이 갈라지면 diff 에 보입니다.
 *
 * `index.js` 는 복사하지 않습니다 — Tiptap 을 통째로 끌어옵니다. 서버에는 편집기가 필요 없습니다.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * 편집기는 npm 에서 옵니다 — `npm i` 로 받은 것을 읽습니다.
 *
 * 편집기 자체를 고치는 중이라면 `npm link` 하거나 `admin/package.json` 의 버전을
 * `file:../경로/packages/core` 로 잠시 바꿔 두면 여기도 그대로 따라옵니다.
 */
const SRC = join(ROOT, 'node_modules/@storkspear/post-editor-core')
const OUT = join(ROOT, 'server/vendor/post-editor-core')

/** 굽기가 실제로 부르는 것과 그 전이 의존만 */
const FILES = ['title.js', 'attachments.js', 'vocab.js', 'serialize.js', 'highlight.js', 'svg.js']

const pkg = JSON.parse(await readFile(join(SRC, 'package.json'), 'utf8'))
await mkdir(OUT, { recursive: true })

/**
 * `dist` 는 번들러용입니다 — `moduleResolution: "bundler"` 라 상대 import 에 확장자가 없습니다
 * (`from './highlight'`). Vite 는 그걸 풀지만 날 Node 는 못 풉니다 — 서버는 날 Node 다.
 * 그대로 복사하면 굽기가 `ERR_MODULE_NOT_FOUND` 로 죽습니다. 즉 발행이 죽습니다.
 *
 * 그래서 옮기면서 확장자를 붙입니다. 붙였다고 믿지 말고 실제로 불러 봅니다(아래 검사).
 */
const addExt = (code) => code.replace(/(\bfrom\s+['"])(\.\.?\/[^'"]+?)(?<!\.js)(['"])/g, '$1$2.js$3')
for (const f of FILES) {
  await writeFile(join(OUT, f), addExt(await readFile(join(SRC, 'dist', f), 'utf8')))
}
/* 옮긴 것이 이 Node 에서 진짜로 로드되는지 봅니다. 문법이 맞아도 경로가 틀리면 여기서 걸립니다 */
for (const f of FILES) {
  await import(pathToFileURL(join(OUT, f)).href).catch((e) => {
    throw new Error(`vendor/${f} 를 Node 가 못 읽습니다 — ${e.message}`)
  })
}
await writeFile(join(OUT, 'VERSION'), `${pkg.name}@${pkg.version}\n`)

/**
 * 발행 페이지가 쓰는 본문 CSS 와 글꼴도 같이 가져옵니다.
 *
 * `public/` 에 두는 이유: 그러면 배포가 `git pull` 하나로 끝납니다. CSS 와 굽기가
 * 서로 다른 경로로 나가면, 한쪽만 올라간 사이 목록이 스타일 없이 뜹니다.
 *
 * `fonts.css` 가 `url('../fonts/…')` 로 부르므로 CSS 는 `assets/`, 글꼴은 `fonts/` 여야 합니다.
 * ## 글꼴은 라이선스 전문 없이는 한 벌도 안 옮깁니다
 *
 * 이 레포는 공개 템플릿이라 `public/fonts/` 에 커밋한 woff2 는 재배포입니다. OFL·Apache 는
 * 「라이선스 전문이 파일과 함께 가야 합니다」를 조건으로 겁니다. 그래서 글꼴을 옮길 때마다
 * 그 npm 패키지의 라이선스 파일을 찾아 `public/fonts/licenses/` 로 같이 옮기고,
 * 못 찾으면 던집니다. 조용히 빠뜨리면 아무도 모르는 채 공개됩니다.
 *
 * 무엇이 어디서 왔는지는 `licenses/INDEX.json` 에 적습니다 — `tools/check-fonts.mjs` 가
 * node_modules 없이 커밋된 상태만 보고 검사할 수 있어야 하기 때문입니다.
 */
await writeFile(join(ROOT, 'public/assets/prose.css'), await readFile(join(SRC, 'src/prose.css')))

/**
 * 라이브러리가 파일째 들고 오는 글꼴을 옮깁니다.
 *
 * 지금은 0개입니다 — 편집기는 공개 npm 패키지라 글꼴 바이너리를 싣지 않습니다(의존성으로
 * 끌어옵니다). 이 레포가 제 몫으로 직접 넣은 글꼴이 있다면 `public/assets/fonts.local.css`
 * 가 선언합니다. 이 루프는 그 파일들을 건드리지 않습니다 — 덮어쓰거나 지우면 안 됩니다.
 *
 * 폴더가 아예 없을 수도 있습니다(라이브러리가 글꼴을 하나도 안 실을 때). 그건 오류가 아닙니다.
 */
/**
 * 패키지의 라이선스 전문을 찾습니다. 루트에 없는 경우가 있어(`pretendard` 는 `dist/`)
 * 한 겹 아래까지 봅니다. 못 찾으면 `null` — 부르는 쪽이 던집니다.
 */
const LICENSE_RE = /^(LICENSE|LICENCE|COPYING|OFL)(\.(txt|md))?$/i
async function findLicense(pkgDir) {
  for (const sub of ['', 'dist', 'files']) {
    const dir = sub ? join(pkgDir, sub) : pkgDir
    const hit = (await readdir(dir).catch(() => [])).find((f) => LICENSE_RE.test(f))
    if (hit) return join(dir, hit)
  }
  return null
}
/** `@scope/name/a/b.css` → `@scope/name`,  `name/a/b.css` → `name` */
const pkgOf = (rel) => {
  const seg = rel.split('/')
  return seg[0].startsWith('@') ? seg.slice(0, 2).join('/') : seg[0]
}

const licDir = join(ROOT, 'public/fonts/licenses')
/** woff2 파일 이름 → 패키지 이름 */
const provenance = {}
/** 패키지 이름 → { version, license, file } */
const packages = {}

const fontDir = join(ROOT, 'public/fonts')
await mkdir(fontDir, { recursive: true })
let n = 0
for (const f of await readdir(join(SRC, 'fonts')).catch(() => [])) {
  if (!/\.woff2?$/.test(f)) continue
  await writeFile(join(fontDir, f), await readFile(join(SRC, 'fonts', f)))
  n++
}

/**
 * `fonts.css` 는 그대로 복사하면 안 됩니다.
 *
 * 절반은 `@font-face` + `url('../fonts/…')` 로 직접 호스팅하지만, 나머지는
 * `@import '@fontsource/gaegu/korean-400.css'` 처럼 맨 npm 이름으로 부릅니다
 * (`pretendard/…`·`d2coding/…` 도 마찬가지입니다). 그 이름은 번들러만 풉니다.
 * 편집 화면은 Vite 를 지나니까 떴고, 발행 페이지는 이 파일을 정적으로 받으므로
 * 브라우저가 그 이름을 못 찾아 조용히 실패했습니다 — 그래서 제목에 개구쟁이를 골라
 * 발행하면 편집기와 글씨체가 달랐습니다.
 *
 * 여기서 import 를 실제 `@font-face` 로 펴서 박고, 그 woff2 도 같이 옮깁니다.
 * woff·ttf 대체본과 `local()` 은 버립니다 — 나머지 37벌도 woff2 만 씁니다.
 */
/**
 * `@import '@fontsource/gaegu/korean-400.css'` 를 풀 자리. 글꼴 패키지는 편집기의
 * 의존성이라 `npm i` 가 이 레포의 node_modules 로 끌어옵니다 — 따로 적을 필요가 없습니다.
 * (그게 요점입니다: 글꼴 바이너리는 발행물에 안 실리고, 라이선스는 각 패키지가 들고 옵니다)
 */
const NM = join(ROOT, 'node_modules')
let css = await readFile(join(SRC, 'src/fonts.css'), 'utf8')
/* 맨 이름만 고릅니다 — `./x.css`·`../x.css`·`url(…)`·http 는 우리 것이 아닙니다 */
const imports = [...css.matchAll(/@import\s+['"](?!\.|https?:|url\()([^'"]+\.css)['"];?/g)]
let m = 0
for (const [line, rel] of imports) {
  const one = await readFile(join(NM, rel), 'utf8')
  const base = dirname(join(NM, rel))
  const name = pkgOf(rel)
  if (!packages[name]) {
    const pj = JSON.parse(await readFile(join(NM, name, 'package.json'), 'utf8'))
    const lic = await findLicense(join(NM, name))
    if (!lic) {
      throw new Error(
        `${name}@${pj.version} 에 라이선스 전문이 없습니다 — 글꼴 파일만 재배포하면 ` +
        `OFL 2조를 어깁니다. 다른 패키지를 쓰거나, 저작권자가 낸 전문을 직접 넣으세요.`)
    }
    packages[name] = { version: pj.version, license: pj.license ?? '(package.json 에 없음)', file: lic }
  }
  let block = ''
  for (const chunk of one.split('@font-face').slice(1)) {
    const face = chunk.slice(0, chunk.indexOf('}') + 1)
    /* 한 face 가 woff2·woff·ttf 를 다 적어 두기도 합니다. 우리는 woff2 한 줄만 남깁니다 */
    const hit = face.match(/url\(\s*['"]?([^'")]+\.woff2)['"]?\s*\)/)
    if (!hit) continue
    const file = hit[1].split('/').pop()
    await writeFile(join(fontDir, file), await readFile(join(base, hit[1])))
    provenance[file] = name
    m++
    block += '@font-face' + face.replace(/src:[\s\S]*?;/, `src: url('../fonts/${file}') format('woff2');`) + '\n'
  }
  if (!block) throw new Error(`${rel} 에서 woff2 를 못 찾았습니다 — 발행 페이지 글씨체가 또 갈립니다`)
  css = css.replace(line, block.trimEnd())
}
/* 주석 밖에 맨 이름이 하나라도 남으면 발행 페이지에서 그 글꼴은 안 뜹니다 */
if (/@import/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  throw new Error('fonts.css 에 풀지 못한 @import 가 남았습니다')
}
await writeFile(join(ROOT, 'public/assets/fonts.css'),
  '/* 자동 생성 — tools/sync-vendor.mjs. 손으로 고치지 마세요.\n' +
  '   원본은 @storkspear/post-editor-core 의 src/fonts.css 이고, 거기 맨 npm 이름으로 쓴\n' +
  '   import 는 번들러만 푸는 것이라 여기서는 font-face 로 펴서 박습니다. */\n' + css)

/**
 * 라이선스 전문을 글꼴 옆으로 옮깁니다. 원문은 한 글자도 안 고칩니다 — 맨 위 안내 줄만 따로
 * 붙인 것이고, 그 아래부터가 원문입니다.
 */
await mkdir(licDir, { recursive: true })
for (const [name, info] of Object.entries(packages)) {
  const body = await readFile(info.file, 'utf8')
  const out = `${name}@${info.version} (${info.license})\n` +
    `${'='.repeat(60)}\n` +
    `아래는 이 패키지가 함께 배포한 라이선스 원문입니다. 고치지 마세요.\n` +
    `${'='.repeat(60)}\n\n${body}`
  await writeFile(join(licDir, name.replace(/[@/]/g, '_').replace(/^_/, '') + '.txt'), out)
}
await writeFile(join(licDir, 'INDEX.json'), JSON.stringify({
  설명: '글꼴 파일이 어느 npm 패키지에서 왔는지. tools/sync-vendor.mjs 가 만든다.',
  packages: Object.fromEntries(Object.entries(packages).map(([k, v]) =>
    [k, { version: v.version, license: v.license, licenseFile: k.replace(/[@/]/g, '_').replace(/^_/, '') + '.txt' }])),
  fonts: Object.fromEntries(Object.entries(provenance).sort()),
}, null, 2) + '\n')

console.log(`vendor 갱신 — ${pkg.name}@${pkg.version}`)
console.log(`  server/vendor ${FILES.length}개 · 본문 CSS 2개`)
console.log(`  글꼴 ${n + m}벌 (직접 호스팅 ${n} + npm 에서 펴서 ${m})`)
console.log(`  라이선스 전문 ${Object.keys(packages).length}개 → public/fonts/licenses/`)
