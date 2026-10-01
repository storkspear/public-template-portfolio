#!/usr/bin/env node
/**
 * lucide-static 에서 도형만 꺼내는 자리. **두 도구가 같이 씁니다** —
 * `sync-menu-icons.mjs`(메뉴 아이콘)와 `sync-favicons.mjs`(파비콘).
 *
 * 한 벌로 두는 까닭: 이건 보안 검사입니다. 복사해 두 벌로 만들면 한쪽만 고쳐지는 날이 오고,
 * 그날 뚫리는 쪽은 아무도 안 보는 쪽입니다.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const LUCIDE_DIR = join(ROOT, 'node_modules/lucide-static/icons')

/** 지금 설치된 lucide-static 판번호 — 생성물 머리에 박아 출처를 남깁니다 */
export const lucideVersion = async () =>
  JSON.parse(await readFile(join(ROOT, 'node_modules/lucide-static/package.json'), 'utf8')).version

/** 이름으로 한 벌 읽어 도형만 돌려줍니다. 이름이 바뀌었으면 거기서 멈춥니다 */
export const lucideBody = async (file, name = file) => {
  const svg = await readFile(join(LUCIDE_DIR, `${file}.svg`), 'utf8').catch(() => {
    throw new Error(`lucide-static 에 ${file}.svg 가 없습니다 — 이름이 바뀌었습니다`)
  })
  return bodyOf(svg, name)
}

/**
 * 화이트리스트 — 도형 요소 일곱과 그 치수 속성만 통과시킵니다.
 * 외부 파일에서 읽은 문자열을 그대로 HTML 에 넣으므로, `<script>` 나 `onload=` 가
 * 하나라도 새면 생성 과정이 XSS 통로가 됩니다.
 */
const TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'])
const ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
                       'width', 'height', 'points'])
/* 값에 허용하는 문자 — path 명령과 숫자뿐입니다. 따옴표·괄호·알파벳은 통과하지 못합니다 */
const SAFE = /^[MmZzLlHhVvCcSsQqTtAa0-9 .,eE+-]+$/
/* `fill` 만 예외입니다 — 속이 찬 점(`tag` 의 구멍)에 씁니다. 값은 둘로 못 박습니다:
   임의 문자열을 열어 주면 `url(#…)` 처럼 도형이 아닌 것을 가리킬 수 있습니다 */
const FILLS = new Set(['none', 'currentColor'])

/** SVG 파일에서 도형만 꺼냅니다. `<svg>` 껍데기(색·굵기)는 생성기가 다시 씌웁니다 */
export const bodyOf = (svg, name) => {
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')
  const out = []
  for (const m of inner.matchAll(/<([a-z]+)\b([^>]*?)\/?>/g)) {
    const [, tag, rest] = m
    if (!TAGS.has(tag)) throw new Error(`${name}: 도형이 아닌 요소 <${tag}> 가 있습니다`)
    const attrs = []
    /* 속성 이름에 숫자가 들어갑니다(`x1`·`y2`). 빼먹으면 `<line>` 의 치수를 통째로 못 읽습니다.
       못 읽은 것을 조용히 버리면 일부만 빠진 채로 통과해 모양이 틀어지므로, 아래에서
       「속성처럼 생긴 것」의 개수와 실제로 읽은 개수를 맞춰 봅니다 */
    for (const a of rest.matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) {
      const [, key, val] = a
      if (key === 'fill') {
        if (!FILLS.has(val)) throw new Error(`${name}: fill 값이 ${val} 입니다 — none·currentColor 만 됩니다`)
        attrs.push(`fill="${val}"`)
        continue
      }
      if (!ATTRS.has(key)) throw new Error(`${name}: 허락하지 않은 속성 ${key}`)
      if (!SAFE.test(val)) throw new Error(`${name}: ${key} 에 도형이 아닌 글자가 있습니다`)
      attrs.push(`${key}="${val}"`)
    }
    const seen = (rest.match(/[^\s=]+\s*=\s*"/g) || []).length
    if (seen !== attrs.length) throw new Error(`${name}: <${tag}> 의 속성 ${seen}개 중 ${attrs.length}개만 읽혔습니다`)
    if (!attrs.length) throw new Error(`${name}: <${tag}> 에 치수가 없습니다`)
    out.push(`<${tag} ${attrs.join(' ')}/>`)
  }
  if (!out.length) throw new Error(`${name}: 도형이 하나도 없습니다`)
  return out.join('')
}
