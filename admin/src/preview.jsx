/* 글쓰기 화면 레이아웃 실측용 하네스. 로그인·API 없이 Editor 와 **같은 껍데기**를 세운다.
 *
 * `?slug=…` 을 붙이면 **기존 글을 여는 경로**로 뜬다 (loaded=false 로 시작).
 * API 가 없어 불러오기는 실패하지만, 문제가 났던 것은 불러오기 결과가 아니라
 * **그 사이에 머리줄이 DOM 에 없다는 것**이었다. 새 글 경로만 태우다 2026-09-14 에
 * 툴바 고정이 깨진 걸 못 잡았다 — 깨지는 경로를 하네스가 반드시 태워야 한다.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@storkspear/post-editor-core/styles.css'
import '@storkspear/post-editor-core/fonts.css'
import '@storkspear/post-editor-react/styles.css'
import './styles.css'
import './attachments.js'   // 사진 저장소를 꽂는다 — 안 꽂으면 넣는 순간 던진다
import './fonts.js'         // 이 레포의 글꼴을 꽂는다 — 안 꽂으면 고르기 목록이 12벌로 준다
import { Editor } from './main.jsx'
import { Look } from './look.jsx'
import { DEFAULTS } from '../../shared/site-vocab.mjs'

const q = new URLSearchParams(location.search)
const slug = q.get('slug')

/* `?look=1` 이면 「모양」 화면을 띄운다. 이쪽은 **API 가 있어야** 그려지므로,
   로그인 없이 보려고 저장·미리보기 호출을 가짜로 가로챈다 — 화면의 생김새와 조작만 본다.
   진짜 배선은 `/api/settings` 를 직접 두드려 확인한다(로그인이 필요한 건 그쪽이다). */
if (q.get('look')) {
  /**
   * 설정 한 벌은 **어휘의 기본값**(`DEFAULTS`)에서 만든다.
   *
   * 손으로 적어 두면 키가 늘 때마다 여기서 썩는다 — 실제로 첫 커밋의 것이 `theme`·`layout`·`home`
   * 셋뿐이라(그 뒤로 키가 여섯이 됐다) 이 하네스는 **빈 화면**만 띄우고 있었다(2026-09-18).
   * 어휘에서 만들면 키가 늘어도 하네스가 따라온다.
   */
  const canned = {
    settings: DEFAULTS,
    /* `site.config.mjs` 의 이메일은 **비어 있는 것이 기본**이다 — 하네스도 그 자리를 태운다
       (빈 상자는 화면에 안 나가고, 그때 관리자가 무엇을 말하는지가 요점이다) */
    stageText: {}, footText: { mail: '', copy: '© 2026 STUDIO. All rights reserved.' },
    /* 사이트 값(site.config.mjs)이 비어 있는 것이 기본이다 — 하네스도 그렇게 둔다 */
    footIcon: {},
    updated: {}, history: {},
  }
  const real = window.fetch
  window.fetch = (url, init) => (String(url).includes('/api/settings')
    ? Promise.resolve(new Response(JSON.stringify(canned), { headers: { 'content-type': 'application/json' } }))
    : real(url, init))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{q.get('look') ? <div className="adm"><Look /></div> : <Editor slug={slug} onBack={() => {}} />}</StrictMode>,
)
