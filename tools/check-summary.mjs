/**
 * 요약 뽑기 검사 — bake.mjs 의 summarize() 를 그대로 불러 돌립니다.
 *
 * 이 한 줄이 목록의 첫 문단과 <meta name="description"> 둘 다를 만듭니다. 여기가 틀어지면
 * 검색 결과에까지 그대로 나가고, 한 번은 글 하나 때문에 굽기 전체가 죽었습니다
 * (`&#xFFFFFF;` 를 String.fromCodePoint 에 넘겨 RangeError).
 *
 * 사례마다 옛 구현도 같이 돌립니다. 옛 것이 전부 통과하면 그 사례는 아무것도 안 지키는
 * 것이므로 옛 구현이 떨어진 개수를 같이 찍습니다 — 검사는 먼저 실패시켜 보고 믿습니다.
 *
 * summarize 는 server/html-text.mjs 가 내보냅니다. 그 모듈은 부작용도 환경변수도 없어서
 * 검사가 그냥 부를 수 있습니다. 소스를 문자열로 잘라 쓰지 않습니다 — 자르는 기준이 주석
 * 문구가 되면 주석을 한 글자 고칠 때 검사가 대상을 못 찾고 죽습니다.
 */
import { summarize } from '../server/html-text.mjs'

/** 리뷰가 잡기 전의 구현. 부르는 쪽의 110자 자르기까지 흉내 냅니다 */
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
  /* 글쓴이가 화면에 `&amp;` 라고 보이게 쓰면 본문은 `&#x26;amp;` 로 저장됩니다.
     한 패스로 안 풀면 16진 패스의 출력을 이름 패스가 또 풀어 `&` 가 됩니다 */
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
  /* 110번째 UTF-16 칸이 이모지 한가운데 오게 맞춥니다 — 옛 구현은 여기서 반쪽을 남겼습니다 */
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
