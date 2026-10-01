#!/usr/bin/env node
/**
 * 푸터 아이콘 도형을 `shared/site-icons.mjs` 로 굽습니다.
 *
 * 왜 데이터로 박는가: 아이콘은 굽기(정적 HTML)와 관리자 화면이 같이 렌더링합니다. 파일 하나(SVG
 * 스프라이트)로 두면 관리자가 그것을 또 받아야 하고, `<img>` 로 걸면 `currentColor` 가 안 먹어
 * 호버·어두운 푸터에서 색이 안 따라옵니다. 도형이 짧은 `path` 하나뿐이라 데이터가 제일 저렴합니다.
 *
 * 왜 npm 인가: 이 레포의 규약입니다(`tools/sync-vendor.mjs` 주석). 손으로 내려받은 그림은
 * 출처를 적을 수 없습니다. `simple-icons` 는 CC0 로 배포됩니다.
 *
 * 도형이 CC0 인 것과 상표는 다른 이야기입니다. 로고는 각 회사의 상표이므로 이 템플릿은
 *   「그 서비스로 가는 링크」에만, 모양·비율을 그대로 씁니다(`CREDITS.md` 의 「푸터 아이콘」 절).
 *   LinkedIn 은 상표권자의 요청으로 simple-icons 에서 빠졌습니다 — 넣지 않습니다(「직접 입력」으로 겁니다).
 *
 *   npm i -D simple-icons && node tools/sync-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'tools/'))
const si = require('simple-icons')
const pkg = JSON.parse(await readFile(join(ROOT, 'node_modules/simple-icons/package.json'), 'utf8'))

/**
 * 푸터에 걸 서비스 — 한국 포트폴리오에서 실제로 쓰는 것부터.
 * 라벨은 화면에 그대로 나가는 말이고, `hint` 는 관리자 주소 칸의 자리표시자입니다.
 */
const WANT = [
  ['github', 'siGithub', 'GitHub', 'github.com/아이디'],
  ['figma', 'siFigma', 'Figma', 'figma.com/@아이디'],
  ['naver', 'siNaver', '네이버 블로그', 'blog.naver.com/아이디'],
  ['tistory', 'siTistory', '티스토리', '아이디.tistory.com'],
  ['velog', 'siVelog', 'velog', 'velog.io/@아이디'],
  ['instagram', 'siInstagram', '인스타그램', 'instagram.com/아이디'],
  ['youtube', 'siYoutube', '유튜브', 'youtube.com/@아이디'],
  ['behance', 'siBehance', '비핸스', 'behance.net/아이디'],
  ['notion', 'siNotion', '노션', '아이디.notion.site'],
  ['x', 'siX', 'X', 'x.com/아이디'],
]

/* 도형에 들어와도 되는 글자만 — path 명령과 숫자입니다. 다른 것이 섞이면 SVG 가 아니라 주입입니다 */
const SAFE = /^[MmZzLlHhVvCcSsQqTtAa0-9 .,eE+-]+$/

const rows = WANT.map(([value, key, label, hint]) => {
  const icon = si[key]
  if (!icon) throw new Error(`simple-icons 에 ${key} 가 없습니다 — 이름이 바뀌었거나 상표권자 요청으로 빠졌습니다`)
  if (!SAFE.test(icon.path)) throw new Error(`${value}: path 에 도형이 아닌 글자가 있습니다`)
  return { value, label, hint, title: icon.title, path: icon.path, source: icon.source }
})

/**
 * 「직접 입력」 — 목록에 없는 서비스로 갈 때. 상표가 아닌 우리가 그린 사슬이라
 * 어느 주소에 걸어도 문제가 없습니다. 24 격자, 채움 하나(세트의 다른 아이콘과 같은 규칙).
 */
rows.push({
  value: 'link',
  label: '직접 입력',
  hint: 'https://…',
  title: '링크',
  path: 'M10.6 13.4a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 1.4l-1.4 1.4a1 1 0 0 1-1.4 0zM8.5 15.5a4 4 0 0 1 0-5.7l2.8-2.8a4 4 0 0 1 5.7 5.7l-1.4 1.4a1 1 0 1 1-1.4-1.4l1.4-1.4a2 2 0 1 0-2.9-2.9l-2.8 2.8a2 2 0 0 0 0 2.9 1 1 0 1 1-1.4 1.4zm-2.1 2.1a4 4 0 0 1 0-5.7l1.4-1.4a1 1 0 1 1 1.4 1.4l-1.4 1.4a2 2 0 1 0 2.9 2.9l2.8-2.8a2 2 0 0 0 0-2.9 1 1 0 0 1 1.4-1.4 4 4 0 0 1 0 5.7l-2.8 2.8a4 4 0 0 1-5.7 0z',
  source: '이 레포가 직접 그림',
})

const body = `/* 자동 생성 — tools/sync-icons.mjs. 손으로 고치지 마세요.
   출처: simple-icons@${pkg.version} (CC0). 도형은 CC0 이지만 상표는 각 회사의 것입니다.
   그 서비스로 가는 링크에만, 모양·비율을 그대로 쓰세요(CREDITS.md 의 「푸터 아이콘」). */

/**
 * 푸터에 거는 서비스 아이콘. 생성기와 관리자가 같은 데이터로 렌더링합니다.
 *
 * \`path\` 는 24×24 격자의 채움 도형 하나다. 굽기는 \`<svg viewBox="0 0 24 24"><path d="…"></svg>\`
 * 로 박고 색은 \`currentColor\` 를 따르므로, 푸터 글자색·호버가 그대로 먹는다(그림 파일이면 안 먹는다).
 *
 * \`hint\` 는 관리자 주소 칸의 자리표시자다. 주소는 사용자가 넣는다 — 여기에는 안 적는다.
 */
export const SERVICE_ICONS = [
${rows.map((r) => `  { value: '${r.value}', label: '${r.label}', hint: '${r.hint}',\n    path: '${r.path}' },`).join('\n')}
]

/** 값 → 도형. 굽기·관리자가 같이 쓴다 */
export const ICON_OF = Object.fromEntries(SERVICE_ICONS.map((i) => [i.value, i.path]))
`

await writeFile(join(ROOT, 'shared/site-icons.mjs'), body)
console.log(`shared/site-icons.mjs — ${rows.length}벌 (simple-icons@${pkg.version}, CC0)`)
for (const r of rows) console.log(`  ${r.value.padEnd(10)} ${r.title.padEnd(14)} ${r.source}`)
