#!/usr/bin/env node
/**
 * 기본으로 주는 파비콘을 `public/assets/favicons/` 로 생성합니다.
 *
 * 손으로 그리지 않습니다. 이 레포에는 이미 메뉴 아이콘 배관이 있고(`tools/sync-menu-icons.mjs`
 * → `shared/menu-icons.mjs`, Lucide·ISC), 파비콘도 같은 그림을 쓰면 관리자에서 고른 메뉴
 * 아이콘과 파비콘이 한 집안으로 보입니다. 출처도 이미 `CREDITS.md` 에 적혀 있습니다.
 *
 * 열 개 중 둘(새싹·황새)은 이 레포가 손으로 그린 것이라 **건드리지 않습니다.**
 * `FAVICONS` 에서 `icon` 이 없는 항목이 그것입니다. 파일이 없으면 여기서 실패합니다 —
 * 목록에는 있는데 파일이 없으면 관리자에서 고르는 순간 파비콘이 사라집니다.
 *
 * 크기 규약은 그 두 파일에 맞춥니다.
 *   · 선 굵기의 비율이 같습니다 — 새싹은 64 격자에 5(7.8%), Lucide 는 24 격자에 2(8.3%)
 *   · 어두운 탭에서 검정은 사라지므로 `prefers-color-scheme` 으로 흰색으로 뒤집습니다
 *
 *   node tools/sync-favicons.mjs
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { lucideBody, lucideVersion } from './lucide.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/assets/favicons')

const { FAVICONS } = await import(join(ROOT, 'shared/site-vocab.mjs'))
const { MENU_ICON_OF } = await import(join(ROOT, 'shared/menu-icons.mjs'))
const VER = await lucideVersion()

/* 두 파일이 쓰는 것과 같은 문구입니다. 여기만 고치면 생성본 전부가 따라갑니다 */
const DARK = `  <style>
    /* 어두운 탭에서 검정은 사라진다. 눈에 보이는 쪽(밝은 탭)은 검정 그대로 두고,
       어두운 탭에서만 흰색으로 뒤집는다. */
    .s { fill: none; stroke: #0b0d10; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round }
    @media (prefers-color-scheme: dark) { .s { stroke: #ffffff } }
  </style>`

await mkdir(OUT, { recursive: true })

let made = 0
const missing = []
for (const f of FAVICONS) {
  if (!f.icon && !f.lucide) {
    /* 손으로 그린 것 — 둘 중 어느 출처도 안 적힌 항목입니다. 있는지만 봅니다 */
    await readFile(join(OUT, `${f.value}.svg`), 'utf8').catch(() => missing.push(f.value))
    continue
  }
  /**
   * 그림은 두 곳에서 옵니다.
   *   `icon`   메뉴 아이콘에 이미 있는 것 — 그걸 그대로 씁니다. 관리자에서 고른 메뉴 아이콘과
   *            파비콘이 한 집안으로 보입니다.
   *   `lucide` 메뉴에 없는 것 — lucide 에서 직접 꺼냅니다. `server`·`library` 를 「메뉴에 거는
   *            아이콘」이라 부르기는 어색하고, 메뉴 목록을 늘리면 관리자 피커가 같이 길어집니다.
   * 검사(`bodyOf`)는 두 길이 같은 한 벌을 씁니다 — tools/lucide.mjs
   */
  const body = f.icon
    ? MENU_ICON_OF[f.icon]
    : await lucideBody(f.lucide, f.value)
  if (!body) throw new Error(`메뉴 아이콘에 ${f.icon} 이 없습니다 — shared/menu-icons.mjs 를 보세요`)
  await writeFile(join(OUT, `${f.value}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${f.label}">\n` +
    `${DARK}\n` +
    `  <!-- 자동 생성 — tools/sync-favicons.mjs. 손으로 고치지 마세요.\n` +
    `       출처: lucide-static@${VER} (ISC) — ${f.icon ? `메뉴 아이콘 '${f.icon}' 과 같은 그림` : `lucide 의 '${f.lucide}'`}. -->\n` +
    `  <g class="s">${body}</g>\n</svg>\n`)
  made++
}

if (missing.length) {
  throw new Error(`손으로 그린 파비콘이 없습니다 — ${missing.map((v) => `${v}.svg`).join(', ')}`)
}
console.log(`파비콘 ${made}벌을 생성했습니다 (손으로 그린 ${FAVICONS.length - made}벌은 그대로)`)
