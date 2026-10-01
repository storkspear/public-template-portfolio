#!/usr/bin/env node
/**
 * 관리자 API 의 라우트 목록이 그대로인지 봅니다.
 *
 * server/admin-api.mjs 는 한 핸들러 안에 if 열넷이 이어진 구조입니다. 이 레포에는 API 를
 * 부르는 테스트가 없어서, 라우트 하나가 사라지거나 메서드가 바뀌어도 굽기 골든과 빌드는
 * 그대로 통과합니다. 구조를 손볼 때 그 사고를 막으려고 목록만 따로 붙잡아 둡니다.
 *
 * 하는 일은 소스에서 라우트 조건을 긁어 tools/routes.json 과 대조하는 것뿐입니다.
 * 동작까지 보지는 않습니다 — 그건 docker 로 띄워서 확인해야 합니다.
 *
 * 목록 갱신:  node tools/check-routes.mjs --update
 * 라우트를 일부러 더하거나 뺐을 때만 씁니다.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname
const LIST = `${ROOT}tools/routes.json`
const UPDATE = process.argv.includes('--update')

const src = await readFile(`${ROOT}server/admin-api.mjs`, 'utf8')

/* p === '/api/x' 와 req.method 를 같은 조건 안에서 짝지어 뽑습니다.
   one·oneWork·vis 처럼 미리 계산한 조건은 이름 그대로 남깁니다 */
const found = []
for (const m of src.matchAll(/if \(([^)]*?p === '\/api\/[^']+'[^)]*|req\.method === '[A-Z]+' && (?:one|oneWork|vis))\)/g)) {
  const cond = m[1].replace(/\s+/g, ' ').trim()
  const method = cond.match(/req\.method === '([A-Z]+)'/)?.[1] || '*'
  const path = cond.match(/p === '(\/api\/[^']+)'/)?.[1]
    || cond.match(/(one|oneWork|vis)\b/)?.[1]
  found.push(`${method} ${path}`)
}
found.sort()

if (!found.length) {
  console.error('라우트를 하나도 못 찾았습니다 — 검사가 죽었습니다')
  process.exit(1)
}

if (UPDATE || !existsSync(LIST)) {
  await writeFile(LIST, JSON.stringify(found, null, 2) + '\n')
  console.log(`라우트 목록을 갱신했습니다 — ${found.length}개`)
  process.exit(0)
}

const want = JSON.parse(await readFile(LIST, 'utf8'))
const gone = want.filter((r) => !found.includes(r))
const added = found.filter((r) => !want.includes(r))
if (gone.length || added.length) {
  if (gone.length) console.error(`  사라진 라우트: ${gone.join(', ')}`)
  if (added.length) console.error(`  새 라우트: ${added.join(', ')}`)
  console.error('\n라우트 검사 — 목록이 달라졌습니다. 의도한 변경이면 --update 로 갱신하세요')
  process.exit(1)
}
console.log(`라우트 검사 — ${found.length}개 그대로`)
