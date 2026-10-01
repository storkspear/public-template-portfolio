#!/usr/bin/env node
/**
 * 배선 검사 — 빌드가 통과시키는 두 가지를 잡습니다.
 *
 *  ① JSX 컴포넌트를 쓰면서 임포트하지 않은 것.
 *     esbuild 는 자유 전역 참조를 오류로 보지 않아 빌드가 그냥 성공하고, 화면을 열 때
 *     ReferenceError 로 터집니다. 에러 바운더리가 없어 관리자 화면이 통째로 백지가 됩니다.
 *
 *  ② 닫히지 않은 CSS 주석.
 *     다음 `*​/` 까지 삼키므로 그 사이의 규칙이 조용히 사라집니다. 문법 오류가 아니라
 *     브라우저도 검사도 아무 말을 하지 않습니다.
 *
 * 둘 다 실제로 났습니다: `ItemName` 임포트 누락과 `.m-i[data-w='auto']` 규칙 증발.
 */
import { readFile } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'golden', 'vendor', '.data'])

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const at = join(dir, name)
    const rel = relative(ROOT, at)
    if (SKIP_DIR.has(name)) continue
    if (statSync(at).isDirectory()) walk(at, out)
    else out.push(rel)
  }
  return out
}

const files = walk(ROOT)
const fails = []

/* ── ① JSX 컴포넌트 배선 ──────────────────────────────────────────────── */

/** 이 파일이 이름으로 쓸 수 있는 식별자 전부 — 임포트·선언·구조분해·매개변수. */
const declaredIn = (src) => {
  const names = new Set()
  const add = (s) => { for (const n of String(s).split(',')) { const t = n.trim().split(/\s+as\s+/).pop().trim(); if (t) names.add(t) } }
  for (const m of src.matchAll(/import\s+(?:([\w$]+)\s*,\s*)?\{([^}]*)\}\s*from/g)) { if (m[1]) names.add(m[1]); add(m[2]) }
  for (const m of src.matchAll(/import\s+([\w$]+)\s+from/g)) names.add(m[1])
  for (const m of src.matchAll(/import\s+\*\s+as\s+([\w$]+)/g)) names.add(m[1])
  for (const m of src.matchAll(/(?:^|\s)(?:const|let|var|function|class)\s+([\w$]+)/g)) names.add(m[1])
  /* 구조분해와 매개변수까지 보지는 않습니다 — 대문자 컴포넌트가 거기서 오는 일은 없습니다 */
  return names
}

/* React 가 제공하는 것 + 컴포넌트가 아닌 대문자 JSX 는 여기 적습니다 */
const JSX_OK = new Set(['Fragment'])

for (const rel of files.filter((f) => f.endsWith('.jsx'))) {
  const src = await readFile(join(ROOT, rel), 'utf8')
  const have = declaredIn(src)
  const missing = new Set()
  for (const m of src.matchAll(/<([A-Z][\w$]*)[\s/>]/g)) {
    const name = m[1]
    if (!have.has(name) && !JSX_OK.has(name)) missing.add(name)
  }
  for (const name of missing) fails.push(`${rel}: <${name}> 을 쓰는데 선언도 임포트도 없습니다`)
}

/* ── ② CSS 주석 닫힘 ──────────────────────────────────────────────────── */

/**
 * 삼켜진 규칙 찾기.
 *
 * 닫는 `*​/` 를 빠뜨려도 파서는 다음 주석의 `*​/` 에서 닫으므로 문법 오류가 안 납니다.
 * 그 사이의 규칙만 조용히 사라집니다. 그래서 「주석 안에 왼쪽 끝에서 시작하는 규칙 줄이
 * 있는가」로 봅니다 — 설명하려고 인용한 CSS 는 들여써 있으니 안 걸립니다.
 */
const RULE_LINE = /^[.#@:[a-zA-Z][^;{}]*\{/

for (const rel of files.filter((f) => f.endsWith('.css'))) {
  const src = await readFile(join(ROOT, rel), 'utf8')
  let i = 0
  let line = 1
  while (i < src.length) {
    const open = src.indexOf('/*', i)
    if (open < 0) break
    line += (src.slice(i, open).match(/\n/g) || []).length
    const close = src.indexOf('*/', open + 2)
    if (close < 0) {
      fails.push(`${rel}:${line} 주석이 안 닫혔습니다 — 아래가 통째로 사라집니다`)
      break
    }
    const body = src.slice(open + 2, close).split('\n')
    for (const [n, text] of body.entries()) {
      if (RULE_LINE.test(text)) {
        fails.push(`${rel}:${line + n} 규칙이 주석 안에 있습니다 — ${line}줄 주석의 닫는 표시가 빠졌습니다`)
        break
      }
    }
    line += (src.slice(open, close + 2).match(/\n/g) || []).length
    i = close + 2
  }
}

if (fails.length) {
  console.error('배선 검사 실패')
  for (const f of fails) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`배선 검사 통과 — JSX ${files.filter((f) => f.endsWith('.jsx')).length}개 · CSS ${files.filter((f) => f.endsWith('.css')).length}개`)
