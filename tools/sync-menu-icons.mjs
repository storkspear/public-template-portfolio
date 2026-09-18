#!/usr/bin/env node
/**
 * 메뉴 아이콘 도형을 `shared/menu-icons.mjs` 로 굽는다.
 *
 * 푸터의 `sync-icons.mjs` 와 **같은 규약, 다른 세트**다. 왜 갈랐는가:
 *
 *   푸터 아이콘 = 서비스 **브랜드 로고**(GitHub·인스타그램…). 각 회사의 상표라
 *                그 서비스로 가는 링크에만, 모양 그대로 쓴다.
 *   메뉴 아이콘 = **UI 픽토그램**(집·봉투·별…). 상표가 아니라 뜻을 가리키는 그림이고,
 *                어느 링크에 걸어도 된다.
 *
 * 둘은 그리는 법도 다르다. 브랜드 로고는 **채움 도형 하나**(`fill`)이고, Lucide 는
 * **선 그림**(`stroke`, 여러 요소)이다. 그래서 데이터가 `path` 한 줄이 아니라 `body` 다.
 *
 * 왜 npm 인가: 이 레포의 규약이다(`tools/sync-vendor.mjs` 머리말). 손으로 내려받은 그림은
 * 출처를 적을 수 없다. `lucide-static` 은 ISC 로 배포된다 — 상표 제약이 없다.
 *
 *   npm i -D lucide-static && node tools/sync-menu-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'node_modules/lucide-static/icons')
const pkg = JSON.parse(await readFile(join(ROOT, 'node_modules/lucide-static/package.json'), 'utf8'))

/**
 * 메뉴 한 줄에 걸 만한 것 — **포트폴리오·블로그가 실제로 쓰는 말**부터.
 * 라벨은 관리자 고르개에 그대로 나간다. 뜻이 겹치는 것은 안 넣는다(고르는 사람이 헷갈린다).
 *
 * 갈래(`group`)는 고르개를 나누는 데만 쓴다 — 어느 갈래의 아이콘이든 어느 링크에나 걸 수 있다.
 * 서른여덟을 한 줄로 늘어놓으면 못 찾는다.
 */
const WANT = [
  /* ── 기본 — 어느 사이트에나 있는 자리 ─────────────────────────── */
  ['home', 'house', '홈', '기본'],
  ['grid', 'layout-grid', '작업', '기본'],
  ['write', 'pen-line', '글', '기본'],
  ['user', 'user', '소개', '기본'],
  ['mail', 'mail', '메일', '기본'],
  ['image', 'image', '사진', '기본'],
  ['work', 'briefcase', '일', '기본'],
  ['book', 'book-open', '읽기', '기본'],
  ['star', 'star', '추천', '기본'],
  ['calendar', 'calendar', '일정', '기본'],
  ['place', 'map-pin', '위치', '기본'],
  ['phone', 'phone', '전화', '기본'],
  ['link', 'link', '링크', '기본'],
  ['search', 'search', '찾기', '기본'],
  ['tag', 'tag', '분류', '기본'],
  ['talk', 'message-circle', '이야기', '기본'],
  ['download', 'download', '내려받기', '기본'],
  ['out', 'external-link', '바깥으로', '기본'],

  /* ── 포트폴리오 — 무엇을 만드는 사람인가 ────────────────────────── */
  ['design', 'palette', '디자인', '포트폴리오'],
  ['camera', 'camera', '촬영', '포트폴리오'],
  ['video', 'video', '영상', '포트폴리오'],
  ['code', 'code-xml', '개발', '포트폴리오'],
  ['layer', 'layers', '레이어', '포트폴리오'],
  ['web', 'monitor', '웹', '포트폴리오'],
  ['app', 'smartphone', '앱', '포트폴리오'],
  ['product', 'package', '제품', '포트폴리오'],
  ['graphic', 'shapes', '그래픽', '포트폴리오'],
  ['type', 'type', '타이포', '포트폴리오'],
  ['draw', 'pen-tool', '일러스트', '포트폴리오'],
  ['deck', 'presentation', '발표', '포트폴리오'],
  ['award', 'award', '수상', '포트폴리오'],
  ['team', 'users', '팀', '포트폴리오'],

  /* ── 블로그 — 글을 어떻게 묶어 보여 주는가 ───────────────────────── */
  ['news', 'newspaper', '소식', '블로그'],
  ['rss', 'rss', '구독', '블로그'],
  ['bookmark', 'bookmark', '북마크', '블로그'],
  ['recent', 'clock', '최근', '블로그'],
  ['archive', 'archive', '보관', '블로그'],
  ['folder', 'folder', '묶음', '블로그'],
  ['list', 'list', '목록', '블로그'],
  ['idea', 'lightbulb', '아이디어', '블로그'],
  ['quote', 'quote', '인용', '블로그'],
  ['learn', 'graduation-cap', '배움', '블로그'],
  ['daily', 'coffee', '일상', '블로그'],
  ['world', 'globe', '세계', '블로그'],
  ['hot', 'flame', '인기', '블로그'],
  ['like', 'heart', '좋아요', '블로그'],

  /* ── 이력 — 어디서 무엇을 해 왔는가 ──────────────────────────────── */
  ['resume', 'file-text', '이력서', '이력'],
  ['school', 'school', '학력', '이력'],
  ['company', 'building-2', '회사', '이력'],
  ['career', 'trending-up', '성장', '이력'],
  ['cert', 'badge-check', '자격', '이력'],
  ['history', 'history', '연혁', '이력'],
  ['card', 'contact', '명함', '이력'],
  ['language', 'languages', '언어', '이력'],
  ['goal', 'target', '목표', '이력'],
  ['partner', 'handshake', '협업', '이력'],
]

/**
 * 들어와도 되는 것만 통과시킨다 — 도형 요소 일곱과 그 치수 속성뿐이다.
 * **이것이 이 도구의 안전장치다.** 남의 파일에서 읽은 글자를 그대로 HTML 에 박으므로,
 * `<script>` 든 `onload=` 든 하나라도 새면 굽기가 주입 통로가 된다.
 */
const TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'])
const ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
                       'width', 'height', 'points'])
/* 값에 들어와도 되는 글자 — path 명령과 숫자다. 따옴표·괄호·글자는 못 들어온다 */
const SAFE = /^[MmZzLlHhVvCcSsQqTtAa0-9 .,eE+-]+$/
/* `fill` 만 예외다 — 속이 찬 점(`tag` 의 구멍)에 쓴다. **값을 둘로 못 박는다**:
   글자를 열어 주면 `url(#…)` 같은 것이 들어와 도형이 아닌 것을 가리킬 수 있다 */
const FILLS = new Set(['none', 'currentColor'])

/** SVG 파일에서 **도형만** 꺼낸다. `<svg>` 껍데기(색·굵기)는 굽기가 제 것으로 다시 씌운다 */
const bodyOf = (svg, name) => {
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')
  const out = []
  for (const m of inner.matchAll(/<([a-z]+)\b([^>]*?)\/?>/g)) {
    const [, tag, rest] = m
    if (!TAGS.has(tag)) throw new Error(`${name}: 도형이 아닌 요소 <${tag}> 가 있습니다`)
    const attrs = []
    /* ⚠ 이름에 **숫자가 들어간다**(`x1`·`y2`). 빼먹으면 `<line>` 의 치수를 통째로 못 읽는다.
       그리고 안 읽힌 것은 **조용히 버려지지 않아야 한다** — 일부만 버려지면 모양이 틀린 채
       통과한다. 그래서 아래에서 「속성처럼 생긴 것」의 수와 읽은 수를 맞춰 본다 */
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

const rows = []
for (const [value, file, label, group] of WANT) {
  const svg = await readFile(join(DIR, `${file}.svg`), 'utf8').catch(() => {
    throw new Error(`lucide-static 에 ${file}.svg 가 없습니다 — 이름이 바뀌었습니다`)
  })
  rows.push({ value, label, group, file, body: bodyOf(svg, value) })
}

const out = `/* 자동 생성 — tools/sync-menu-icons.mjs. 손으로 고치지 마세요.
   출처: lucide-static@${pkg.version} (ISC). 상표가 아니라 UI 픽토그램이라 쓰는 자리에 제약이 없습니다.
   푸터의 서비스 로고(\`site-icons.mjs\`)와는 **다른 세트**입니다 — CREDITS.md 의 「메뉴 아이콘」. */

/**
 * 메뉴 한 줄에 거는 아이콘 — **굽기와 관리자가 같은 데이터로 그린다.**
 *
 * \`body\` 는 24×24 격자의 **선 그림**이다(채움이 아니다). 굽기가 껍데기를 씌운다:
 *
 *   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
 *        stroke-linecap="round" stroke-linejoin="round">{body}</svg>
 *
 * 색이 \`currentColor\` 라 메뉴 글자색·오버가 그대로 먹는다(그림 파일이면 안 먹는다).
 * 굵기를 2 로 고정하는 것은 Lucide 의 기본값이다 — 글자 크기를 키워도 선은 안 두꺼워진다.
 */
export const MENU_ICONS = [
${rows.map((r) => `  { value: '${r.value}', label: '${r.label}', group: '${r.group}',\n    body: '${r.body}' },`).join('\n')}
]

/** 값 → 도형. 굽기·관리자가 같이 쓴다. 없는 값이면 \`undefined\` — 부르는 쪽이 안 그린다 */
export const MENU_ICON_OF = Object.fromEntries(MENU_ICONS.map((i) => [i.value, i.body]))

/** 고르개가 쓰는 갈래 차례 — 데이터에 나온 순서 그대로다(가나다순이 아니다) */
export const MENU_ICON_GROUPS = [...new Set(MENU_ICONS.map((i) => i.group))]
`

await writeFile(join(ROOT, 'shared/menu-icons.mjs'), out)
console.log(`shared/menu-icons.mjs — ${rows.length}벌 (lucide-static@${pkg.version}, ISC)`)
for (const r of rows) console.log(`  ${r.group.padEnd(6)} ${r.value.padEnd(10)} ${r.label.padEnd(6)} ${r.file}`)
