/**
 * 요약 뽑기 검사 — `bake.mjs` 의 `summarize()` 를 **파일에서 그대로 떼어** 돌린다.
 *
 * 복사본을 시험하면 시험이 거짓말을 한다. 그래서 소스를 잘라 와 import 한다.
 *
 * 이 한 줄이 목록의 첫 문단과 `<meta name="description">` 둘 다를 만든다. 여기가 틀어지면
 * 검색 결과에까지 그대로 나가고, 한 번은 **글 하나 때문에 굽기 전체가 죽기까지 했다**
 * (`&#xFFFFFF;` → `String.fromCodePoint` RangeError, 2026-09-16).
 *
 * 사례마다 **옛 구현도 같이 돌린다.** 옛 것이 전부 통과하면 그 사례는 아무것도 안 지키는
 * 것이므로 「몇 개를 떨어뜨렸는지」를 같이 찍는다 — 검사는 먼저 실패시켜 보고 믿는다.
 */
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../server/bake.mjs', import.meta.url), 'utf8')
const from = src.indexOf('/**\n * 코드포인트 하나')
const to = src.indexOf("\n  return ''\n}\n", from)
if (from < 0 || to < 0) {
  console.error('bake.mjs 에서 summarize 를 못 찾았습니다 — 이름이나 모양이 바뀌었나요?')
  process.exit(1)
}
const { summarize } = await import(
  'data:text/javascript;charset=utf-8,' +
  encodeURIComponent(src.slice(from, to + 14) + '\nexport { summarize }\n'))

/** 리뷰가 잡기 전의 구현. 부르는 쪽의 110자 자르기까지 흉내 낸다 */
const site = { description: '(사이트 설명문)' }
const old = (html) => {
  const m = String(html || '').match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  const text = (m ? m[1] : '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 110) : site.description
}

const lone = (s) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)
const BEL = String.fromCharCode(7)
const CASES = [
  ['실체 참조',      '<p>A &amp; B &lt;태그&gt;</p>',        (r) => r === 'A & B <태그>'],
  ['이중 인코딩',    '<p>A &amp;amp; B</p>',                 (r) => r === 'A &amp; B'],
  /* 글쓴이가 화면에 `&amp;` 라고 **보이게** 쓰면 본문은 `&#x26;amp;` 로 저장된다.
     한 패스로 안 풀면 16진 패스의 출력을 이름 패스가 또 풀어 `&` 가 된다(2026-09-16 리뷰) */
  ['16진→이름 재스캔', '<p>A &#x26;amp; B</p>',                (r) => r === 'A &amp; B'],
  ['16진→lt 재스캔',   '<p>&#x26;lt;br&#x26;gt;</p>',          (r) => r === '&lt;br&gt;'],
  ['16진→nbsp 재스캔', '<p>앞&#x26;nbsp;뒤</p>',                (r) => r === '앞&nbsp;뒤'],
  ['16진→숫자 재스캔', '<p>&#x26;#39;</p>',                    (r) => r === '&#39;'],
  ['&nbsp;',        '<p>앞&nbsp;&nbsp;뒤</p>',              (r) => r === '앞 뒤'],
  ['숫자 참조',      '<p>&#48148;&#45716; &#x1F600;</p>',    (r) => r === '바는 😀'],
  ['범위 밖 16진',   '<p>가&#xFFFFFF;나</p>',                (r) => r === '가&#xFFFFFF;나'],
  ['범위 밖 10진',   '<p>가&#99999999;나</p>',               (r) => r === '가&#99999999;나'],
  ['제어문자',       `<p>가&#0;나${BEL}다</p>`,               (r) => r === '가나다'],
  ['빈 첫 문단',     '<p></p><p><br></p><p>진짜 문단</p>',    (r) => r === '진짜 문단'],
  ['문단 없음',      '<figure><img src="a.png"></figure>',   (r) => r === ''],
  ['공백만',        '<p>   </p>',                           (r) => r === ''],
  ['속성 속 꺾쇠',   '<p title="a>b">본문</p>',              (r) => r === '본문'],
  ['속성 속 꺾쇠 2', '<p>앞 <img alt="x>y"> 뒤</p>',          (r) => r === '앞 뒤'],
  ['대문자 태그',    '<P>대문자도</P>',                       (r) => r === '대문자도'],
  /* 110번째 **UTF-16 칸**이 이모지 한가운데 오게 맞춘다 — 옛 구현은 여기서 반쪽을 남겼다 */
  ['서로게이트',     `<p>${'가'.repeat(109)}😀😀뒤</p>`,       (r) => !lone(r) && [...r].length === 111],
]

let bad = 0
let caught = 0
for (const [name, input, ok] of CASES) {
  const before = old(input)
  const now = summarize(input, 110)
  if (!ok(before)) caught++
  if (ok(now)) continue
  bad++
  console.error(`  ✗ ${name}\n      받은 것 ${JSON.stringify(now)}`)
}
if (bad) {
  console.error(`\n요약 검사 — ${bad}개 실패`)
  process.exit(1)
}
console.log(`요약 검사 — ${CASES.length}개 통과 · 옛 구현을 ${caught}개 떨어뜨림(검사가 살아 있습니다)`)
