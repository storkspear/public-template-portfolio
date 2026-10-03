import { useEffect, useRef, useState } from 'react'
import { PostEditor, EMPTY_TITLE } from '@storkspear/post-editor-react'
import { CENTERED_WIDTH } from '@storkspear/post-editor-core/proseWidth'

import '@storkspear/post-editor-core/styles.css'   // 본문 타이포 — 발행 페이지도 같은 파일을 씁니다
import '@storkspear/post-editor-core/fonts.css'    // 글씨체
import '@storkspear/post-editor-react/styles.css'  // 툴바·메뉴 — 편집 화면에만
import './styles.css'

import { api, refresh, logout, setToken as setAccess, setOnExpired, tokenInfo } from './api.js'
import { useToast } from './toast.js'
import { cleanSlug, ymd } from '../../shared/text.mjs'
import { flushUploads, setPostNo, getPostNo, seedAttachments } from './attachments.js'
import { Eye } from './eye.jsx'
import { postUrl, setOrigin } from './urls.js'
import { useHeadH, useSlow } from './wait.js'
import { WorkFolder } from './work.jsx'
import { Look } from './look.jsx'
/* 카테고리 고르기는 홈디자인과 같은 부품(Picker)을 씁니다 — `<select>` 는 OS 메뉴로 그려져 CSS 가 안 먹습니다 */
import { Picker } from '@storkspear/post-editor-react/PickMenu'
import { DEFAULT_LABEL } from '../../shared/category.mjs'

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * 글에 붙는 둘 — 카테고리(식별자, 비면 「기본」)와 태그. `posts.meta` 에 앉습니다(서버의 `normalizeMeta`).
 * 예전 작업물용 다섯 칸(client·year·role·format)은 사라졌습니다 — 작업은 `WorkFolder` 가 맡아 이 편집기에
 * 작업이 올 일이 없고, 그 칸들은 어느 문도 저장하지 않던 죽은 자리였습니다.
 */
const EMPTY_META = { category: '', tags: [] }

/**
 * 작업물이 지금 사이트에 나가는가.
 *
 * 작업물은 모드와 무관하게 DB 에 쌓입니다 — 올리는 자리(왼쪽 메뉴)는 늘 열어 둡니다.
 * 갈리는 것은 굽기뿐이라, 직접 디자인인 동안 쌓아 두었다가 템플릿으로 바꾸면
 * 쌓아 둔 것이 한꺼번에 나갑니다. 그래서 이 값은 메뉴를 숨기는 데 안 쓰고,
 * 목록에 「지금은 안 나갑니다」를 알리는 데만 씁니다.
 */
const worksLive = (conf) => conf?.portfolio?.mode === 'template'
/* 태그 상한 — 서버(`admin-api.mjs` 의 normalizeMeta)와 같은 수여야 합니다.
   화면이 더 받아 두면 저장할 때 400 이 나고, 덜 받으면 화면이 서버보다 좁습니다 */
const TAG_MAX = 20
const TAG_LEN = 30

/**
 * 태그 칸 — 치고 **스페이스**를 누르면 그 자리에서 칩이 됩니다.
 *
 * 처음에는 쉼표로 구분하는 글자 칸 하나였습니다. 「칩 UI 는 배우는 것이 하나 더 느는 값을
 * 못 한다」고 적어 뒀는데, 반대였습니다 — 쉼표 칸은 **몇 개를 넣었는지, 어디서 끊겼는지**가
 * 안 보입니다. 띄어쓰기가 든 태그를 쓸 수 없다는 것도 치고 나서야 압니다.
 *
 * 한글 조합 중에는 스페이스를 **안 먹습니다.** IME 가 음절을 맺는 데 쓰는 키라,
 * `isComposing` 을 안 보면 「개발」을 치다 ㄱ·개 같은 토막이 칩이 됩니다.
 * 같은 이유로 길이는 코드 포인트로 셉니다 — UTF-16 으로 자르면 이모지가 반쪽 납니다.
 *
 * 끊는 키 셋: 스페이스 · 엔터 · 쉼표. 빈 칸에서 백스페이스면 마지막 칩이 지워집니다.
 * 대소문자만 다른 것은 같은 태그로 봅니다(서버와 같은 규율).
 */
/**
 * 태그 하나를 목록에 더합니다 — 화면 밖으로 빼 둔 규칙입니다.
 *
 * 컴포넌트 안에 두면 이 규칙을 확인할 길이 「눌러 보기」뿐입니다. 서버의 `normalizeMeta` 와
 * 같은 규율을 따라야 하는 자리라(상한·길이·중복·`< >`), 돌려 볼 수 있어야 합니다.
 *
 * @returns `{ tags, ok }` — `ok` 가 false 면 친 글자를 **안 지웁니다**(고칠 기회를 남깁니다)
 */
export const addTag = (tags, raw) => {
  const one = [...String(raw ?? '').trim()].slice(0, TAG_LEN).join('')
  if (!one) return { tags, ok: true }                                    // 빈 입력은 그냥 넘깁니다
  if (/[<>]/.test(one)) return { tags, ok: false }                       // 서버가 거절하는 글자
  if (tags.length >= TAG_MAX) return { tags, ok: false }
  if (tags.some((t) => t.toLowerCase() === one.toLowerCase())) return { tags, ok: true }   // 이미 있는 것
  return { tags: [...tags, one], ok: true }
}

function TagField({ tags, onChange }) {
  const [draft, setDraft] = useState('')
  /**
   * 백스페이스로 **잡아 둔** 칩. 네이버는 한 번 누르면 마지막 칩이 어두워지고, 한 번 더
   * 눌러야 지워집니다 — 치던 글자가 비었을 때 바로 지우면 손가락이 한 번 미끄러진 것으로
   * 방금 단 태그가 사라집니다. 칩을 눌러도 같은 상태가 됩니다(마우스로도 지울 수 있어야 합니다).
   */
  const [armed, setArmed] = useState('')
  const inRef = useRef(null)
  const 가득 = tags.length >= TAG_MAX

  const 넣기 = (raw) => {
    const r = addTag(tags, raw)
    setArmed('')
    if (r.tags !== tags) onChange(r.tags)
    return r.ok
  }
  const 지우기 = (t) => { setArmed(''); onChange(tags.filter((x) => x !== t)) }

  return (
    /* 상자 아무 데나 누르면 입력으로 — 칩 사이 빈자리를 눌러도 칸이 잡혀야 합니다 */
    <div className="tagBox" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); inRef.current?.focus() } }}>
      {tags.map((t) => (
        <button type="button" className="tagChip" key={t} data-armed={armed === t ? '' : undefined}
                title={armed === t ? '한 번 더 누르면 지웁니다' : '누르면 지울 준비를 합니다'}
                onClick={() => (armed === t ? 지우기(t) : setArmed(t))}>
          #{t}
        </button>
      ))}
      {/* `#` 은 안내문이 아니라 **늘 있는 글자**입니다 — 칩이 쌓여도 다음 태그 앞에 서 있어야
          여기가 태그 칸이라는 것이 안 흐려집니다(네이버와 같은 자리) */}
      <span className="tagHash" aria-hidden="true">#</span>
      <input ref={inRef} type="text" value={draft} disabled={가득}
             aria-label="태그 입력"
             placeholder={가득 ? `태그는 ${TAG_MAX}개까지입니다` : `태그 입력 (최대 ${TAG_MAX}개)`}
             onChange={(e) => {
               const v = e.target.value
               setArmed('')
               /**
                * 한글은 **조합이 끝나면서** 스페이스가 들어옵니다 — 그 스페이스는 아래 `keydown` 을
                * 안 거칩니다(그때는 `isComposing` 이라 우리가 비켜 줬습니다). 그래서 글자 쪽에서
                * 한 번 더 맺습니다. 이 줄이 없으면 「개발 」처럼 끝에 공백을 단 채 칩이 안 됩니다.
                */
               if (!e.nativeEvent.isComposing && /[,\s]$/.test(v)) {
                 if (넣기(v.slice(0, -1))) setDraft('')
                 return
               }
               setDraft(v)
             }}
             onKeyDown={(e) => {
               /* 조합 중이면 이 키는 IME 의 것입니다 — 가로채면 음절이 잘립니다 */
               if (e.nativeEvent.isComposing) return
               if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
                 e.preventDefault()
                 if (넣기(draft)) setDraft('')
                 return
               }
               if (e.key === 'Backspace' && !draft && tags.length) {
                 e.preventDefault()
                 const 끝 = tags[tags.length - 1]
                 if (armed === 끝) 지우기(끝); else setArmed(끝)
               }
             }}
             /* 칸을 떠날 때도 맺습니다 — 치다 만 글자가 저장에서 조용히 사라지면 안 됩니다 */
             onBlur={() => { setArmed(''); if (넣기(draft)) setDraft('') }} />
    </div>
  )
}

/**
/**
 * 로그인.
 *
 * `over` 면 지금 화면 위에 뜹니다(편집기를 안 내립니다) — 토큰이 만료돼도 쓰던 글은 그대로입니다.
 * 401 에 오류 글자만 띄우고 화면을 그대로 두면 이후 저장이 전부 401 이 되고,
 * 새로고침하는 순간 쓰던 글이 사라집니다.
 */
function Login({ onDone, over, note }) {
  /* 미리 채우지 않습니다. 계정 이름을 화면이 먼저 알려 주면 무차별 대입에서
     절반을 거저 주는 셈입니다. 자리표시자로도 안 적습니다. */
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      if (!id.trim() || !pw) throw new Error('아이디와 비밀번호를 모두 입력해 주세요')
      const d = await api('/login', { method: 'POST', body: JSON.stringify({ id: id.trim(), password: pw }) })
      /* 액세스는 `api.js` 가 메모리에 듭니다. 리프레시는 서버가 httpOnly 쿠키로 넣었습니다 */
      setAccess(d.token); onDone(d.id)
    } catch (e) {
      setErr(e?.message || '로그인에 실패했습니다')   // 조용히 죽지 않게 반드시 표시
    } finally { setBusy(false) }
  }
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }

  return (
    <div className={'adm login' + (over ? ' over' : '')}
         role={over ? 'dialog' : undefined} aria-modal={over ? 'true' : undefined}
         aria-labelledby="login-h">
      <div className="box">
        <h1 id="login-h"><Paw size={23} />블로그 관리자</h1>
        {note && <p className="hint relog">{note}</p>}
        <div className="field"><label htmlFor="id">아이디</label>
          <input id="id" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={onKey} autoComplete="username" /></div>
        <div className="field"><label htmlFor="pw">비밀번호</label>
          <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onKey}
                 autoComplete="current-password" autoFocus={over} /></div>
        <button className="primary" style={{ width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}</button>
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  )
}

/* ── 아이콘·줄 — 순수 그림이라 `List` 밖에 둡니다. ─────────────────────────
   `List` 안에 정의하면 렌더마다 새 컴포넌트 타입이 되어 React 가 줄 전체를 DOM 에서
   내렸다가 다시 올립니다. 마우스만 쓸 때는 보이지 않지만, 초점을 옮기는 순간(지우기 확인) 초점이
   날아가고 `autoFocus` 가 매 렌더 다시 걸립니다. */

/** 초안 — 아직 쓰는 중이라는 뜻. 연필과 점선 밑줄 */
const Pencil = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12.5 5.5 18 11 8.5 20.5 3 21l.5-5.5 9-10Z" />
    <path d="M3 22h18" strokeDasharray="2 3" />
  </svg>
)


/** 휴지통 — 폭이 안 변합니다(32px). 말은 줄 밑의 띠가 합니다 */
const Trash = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
)

/** 꺾쇠 — 드로어의 지금 상태를 나타냅니다. 오른쪽 = 접힘, 아래(CSS 회전) = 펼침 */
const Chev = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
)

/** 고양이 발자국 — 이름 앞. 작게 쓰므로 선이 아니라 면으로 그립니다.
    색은 `currentColor` 라 검정 헤더에서는 흰색, 흰 로그인 화면에서는 검정이 됩니다. */
const Paw = ({ size = 17 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <ellipse cx="5.2" cy="11.4" rx="2.15" ry="2.7" transform="rotate(-18 5.2 11.4)" />
    <ellipse cx="9.6" cy="7.3" rx="2.2" ry="2.95" transform="rotate(-7 9.6 7.3)" />
    <ellipse cx="14.4" cy="7.3" rx="2.2" ry="2.95" transform="rotate(7 14.4 7.3)" />
    <ellipse cx="18.8" cy="11.4" rx="2.15" ry="2.7" transform="rotate(18 18.8 11.4)" />
    <path d="M12 12.9c3.25 0 5.7 2.3 5.7 4.75 0 2-1.55 3.25-3.5 3.25-1.05 0-1.65-.32-2.2-.32s-1.15.32-2.2.32c-1.95 0-3.5-1.25-3.5-3.25C6.3 15.2 8.75 12.9 12 12.9Z" />
  </svg>
)

const dateOf = (v) => String(v).slice(0, 10).replace(/-/g, '.')

/**
 * 무엇이 없어지는가 — 데이터가 문장을 정합니다.
 *
 * 같은 문구를 모든 줄에 띄우면 아무 말도 안 하는 것과 같습니다. 그리고 무게의 축은
 * 「초안 vs 발행」 기준이 아닙니다. 초안도 저장할 때 사진을 업로드합니다(attachments.js).
 * 삭제하면 원본이 같이 사라집니다. 판단 기준은 사진 장수와 수정 중인 초안의 존재 여부입니다.
 *
 * 한 문장으로 씁니다. 「나간 글을 지웁니다 — 되돌릴 수 없습니다」처럼 토막을 줄표로 잇는 것은
 * 말이 아니라 라벨입니다.
 */
function lossOf(p) {
  const also = []
  if (p.published_at && p.has_draft) also.push('고치던 초안')
  if (p.attachment_count > 0) also.push(`올린 사진 ${p.attachment_count}장`)
  const what = (p.published_at ? '해당 게시글' : '해당 초안') + (also.length ? `과 ${also.join(', ')}` : '')
  return `${what}을 삭제하면 되돌릴 수 없습니다.`
}

/**
 * 지우기 단추 — 휴지통은 폭이 안 변하고, 「묻는 중」이라는 지금 상태만 나타냅니다
 * (`aria-expanded` — 눈·꺾쇠와 같은 문법). 다시 누르면 닫힙니다.
 */
function DelButton({ ref, p, asking, busy, onToggle }) {
  return (
    <button ref={ref} type="button" className="del" disabled={busy}
            aria-expanded={asking ? 'true' : 'false'}
            aria-controls={asking ? `ask-${p.id}` : undefined}
            aria-label={p.published_at ? '이 글 삭제' : '이 초안 삭제'}
            title={asking ? '지금 묻는 중 — 누르면 닫습니다'
                          : p.published_at ? '이 글 삭제' : '이 초안 삭제'}
            onClick={(e) => { e.stopPropagation(); onToggle() }}>
      <Trash />
    </button>
  )
}

/**
 * 묻는 띠 — 줄 밑에 열립니다(드로어와 같은 문법).
 *
 * 모달을 안 쓰는 이유: 화면을 덮으면 무엇을 지우는지 오히려 안 보입니다. 여기는 제목이
 * 바로 위에 있어 대상을 다시 적을 필요가 없습니다.
 * [지우기]는 다음 줄이라 방금 누른 자리(휴지통) 아래에 오지 않습니다 — 연타가 삭제가 될 수 없습니다.
 * 시계는 없습니다: 취소가 보이는데 시계까지 두면 두 번째 누름을 놓치거나 잊은 사이 사라집니다.
 */
function Ask({ p, busy, onYes, onNo }) {
  const noRef = useRef(null)
  /* 열리면 초점은 취소에 — 반사적으로 한 번 더 Enter 를 눌러도 안전한 쪽 */
  useEffect(() => { noRef.current?.focus() }, [])
  const id = `ask-${p.id}`
  return (
    <div id={id} className="ask" role="group" aria-labelledby={`${id}-t`}
         data-hidden={p.hidden ? '' : undefined}
         onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onNo() } }}>
      <span id={`${id}-t`} className="ask-t">{lossOf(p)}</span>
      <span className="ask-b">
        <button ref={noRef} type="button" className="ask-no" disabled={busy} onClick={onNo}>취소</button>
        {/* 단추 글자는 동사 + 목적어입니다 — 「확인」·「예」는 무엇에 동의하는지 안 적혀 있어서,
            머리글을 안 읽고 누르는 사람에게는 아무 말도 안 한 것과 같습니다.
            (GitLab Pajamas·GitHub 이 같은 규칙을 씁니다) */}
        <button type="button" className="ask-go" disabled={busy} aria-describedby={`${id}-t`} onClick={onYes}>
          {busy ? '삭제 중' : p.published_at ? '글 삭제' : '초안 삭제'}</button>
      </span>
    </div>
  )
}

/**
 * 초안 줄 — 표식 칸에 연필. 척추는 발행 줄과 같습니다(표식 2.6rem · 제목 x · 날짜 끝).
 * 짧은 것은 없는 것(주소·눈)이 없어서지, 작게 그려서가 아닙니다.
 */
/**
 * 고르기 칸 — 줄 전체가 「열기」라 여기서는 클릭이 위로 안 올라가게 막습니다(눈·휴지통과 같은 규약).
 * 작업(카드)에는 없습니다. `onPick` 이 없으면 칸을 안 그립니다.
 */
function PickBox({ p, picked, onPick }) {
  /* 편집 모드가 아니면 `onPick` 이 안 옵니다 — 평소 목록에는 칸이 아예 없습니다.
     늘 세워 두면 「고르면 무엇이 되는가」가 안 보이는 채로 자리만 차지합니다(사용자 지적) */
  if (!onPick) return null
  return (
    <input type="checkbox" className="pick" checked={picked} aria-label={`${p.title || '제목 없음'} 고르기`}
           onClick={(e) => e.stopPropagation()} onChange={onPick} />
  )
}
/**
 * 카테고리 칩. 카테고리를 하나도 안 만든 사이트에서는 **안 답니다** — 모든 글이 기본이라
 * 칩이 아무 말도 못 합니다. 하나라도 만들면 그때부터 「기본」도 뜻이 생기므로 옅게 답니다
 * (어느 글이 아직 분류 전인지가 목록에서 바로 보여야 합니다).
 */
const Chip = ({ label, muted = false }) =>
  (label ? <span className="cat" data-muted={muted ? '' : undefined}>{label}</span> : null)

function DraftRow({ p, busy, asking, onOpen, onAsk, onNo, onYes, chip = '', chipMuted = false, picked = false, onPick = null }) {
  const delRef = useRef(null)
  const cancel = () => { onNo(); delRef.current?.focus() }   // 취소하면 초점은 누른 자리로
  return (
    <li>
      <div className="row draft" data-asking={asking ? '' : undefined} data-picked={picked ? '' : undefined}
           onClick={() => onOpen(p.slug)}>
        <span className="pen" title="초안"><PickBox p={p} picked={picked} onPick={onPick} /><Pencil /></span>
        <span className="ti">{p.title || '제목 없음'}<Chip label={chip} muted={chipMuted} /></span>
        {/* 조작은 한 칸에 모입니다 — 오른쪽 끝이 세 종류 줄에서 같은 x 에 섭니다 */}
        <span className="ops">
          <DelButton ref={delRef} p={p} asking={asking} busy={busy} onToggle={asking ? cancel : onAsk} />
        </span>
        <span className="meta"><span className="dt">{dateOf(p.created_at)}</span></span>
      </div>
      {asking && <Ask p={p} busy={busy} onYes={onYes} onNo={cancel} />}
    </li>
  )
}

/** 발행·숨김 줄 — live 는 published_at 이 항상 있습니다. 숨김은 눈(감은 눈)과 줄 색이 말합니다 — 글자 칩은 안 답니다
    (테두리 친 「숨김」이 눈 옆에 생기면 누를 수 있는 버튼으로 읽혔습니다) */
function Row({ p, i, busy, asking, onOpen, onVis, onAsk, onNo, onYes, chip = '', chipMuted = false, picked = false, onPick = null }) {
  /* 작업은 제목만 보고 못 고릅니다 — 커버(제목 배너)를 줄 앞에 작게 겁니다 */
  const thumb = p.kind === 'work' && (
    <span className="thumb">{p.cover ? <img src={p.cover} alt="" loading="lazy" /> : null}</span>
  )
  const delRef = useRef(null)
  const cancel = () => { onNo(); delRef.current?.focus() }
  return (
    <li>
      <div className="row" data-hidden={p.hidden ? '' : undefined}
           data-asking={asking ? '' : undefined} data-picked={picked ? '' : undefined} onClick={() => onOpen(p.slug)}>
        <span className="no"><PickBox p={p} picked={picked} onPick={onPick} />{String(i + 1).padStart(2, '0')}</span>
        {thumb}
        <span className="body">
          <span className="ti">{p.title}<Chip label={chip} muted={chipMuted} /></span>
          {/* 나간 글과 따로 고치던 초안이 있습니다 — 공개면은 아직 옛 글입니다 */}
          {p.has_draft && <span className="wip" title="고치던 초안이 있습니다">수정 중</span>}
          <span className="sl">/{p.kind === 'work' ? 'portfolio' : 'blog'}/{p.slug}/</span>
        </span>
        {/* 줄 전체가 「열기」라 여기서는 클릭이 위로 안 올라가게 막습니다 */}
        <span className="ops">
          <button type="button" className="vis" disabled={busy}
                  aria-pressed={p.hidden ? 'true' : 'false'}
                  aria-label={p.hidden ? '공개 페이지에 다시 올리기' : '공개 페이지에서 내리기'}
                  title={p.hidden ? '지금 숨김 — 누르면 다시 보입니다' : '지금 보임 — 누르면 숨깁니다'}
                  onClick={(e) => { e.stopPropagation(); onVis() }}>
            <Eye off={p.hidden} />
          </button>
          <DelButton ref={delRef} p={p} asking={asking} busy={busy} onToggle={asking ? cancel : onAsk} />
        </span>
        <span className="meta">
          <span className="dt">{dateOf(p.published_at)}</span>
        </span>
      </div>
      {asking && <Ask p={p} busy={busy} onYes={onYes} onNo={cancel} />}
    </li>
  )
}

function List({ kind, onNew, onOpen, reloadKey, worksLive = true, cats = [] }) {
  /* 글과 작업은 같은 표·같은 화면을 씁니다 — 다른 건 말과 카드 그림뿐입니다 */
  const isWork = kind === 'work'
  const W = isWork
    ? { one: '포트폴리오', add: '작업 올리기', none: '아직 올린 작업이 없습니다.' }
    : { one: '블로그',     add: '글쓰기',      none: '아직 발행한 글이 없습니다.' }
  const [posts, setPosts] = useState(null)
  const [err, setErr] = useState('')
  /* 지운 결과. 목록 안에 끼우지 않습니다 — 줄 위에 글자를 한 줄 더하면 아래가 통째로
     밀려서, 정작 보여 줘야 할 「무엇이 사라졌나」가 더 안 보입니다. 화면 구석에 잠깐 뜹니다. */
  const { note, setNote, say, hold, release } = useToast()
  const [busy, setBusy] = useState(null)
  /* 지우기를 묻는 중인 줄 — 한 번에 하나. 시계는 없습니다(취소·Esc·휴지통 다시 누르기가 닫습니다) */
  const [asking, setAsking] = useState(null)
  useEffect(() => {
    if (!asking) return
    const onKey = (e) => { if (e.key === 'Escape') setAsking(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [asking])
  /**
   * 카테고리로 거르기 — `all`(거르지 않음) · `''`(카테고리 없음) · 식별자. 작업에는 없습니다.
   * 「카테고리 없음」이 따로 있는 까닭: 카테고리를 지우면 거기 있던 글이 전부 여기로 떨어지므로,
   * 그 글들만 모아 한 번에 앉힐 자리가 있어야 합니다.
   */
  const [filter, setFilter] = useState('all')
  /**
   * 편집 모드. 홈디자인의 카테고리 관리와 같은 규약입니다 — 평소에는 읽는 화면이고,
   * 누르면 고르는 칸이 서고 고른 글을 한 번에 옮길 수 있습니다. 카테고리를 하나도
   * 안 만든 사이트에는 옮길 데가 없어 단추도 안 냅니다.
   */
  const [edit, setEdit] = useState(false)
  /* 여러 편을 골라 카테고리를 한 번에 — 고른 글의 주소들. 목록을 다시 받으면 비웁니다 */
  const [picked, setPicked] = useState(() => new Set())
  const [bulkCat, setBulkCat] = useState('')
  const labelOfCat = (id) => cats.find((c) => c.id === id)?.label || ''
  /* 초안 그룹을 접어 두면 다음에도 접힌 채로 — 글이 쌓이면 초안이 목록 위쪽을 다 차지합니다 */
  const [openDraft, setOpenDraft] = useState(() => {
    try { return localStorage.getItem('adm.drafts') !== 'closed' } catch { return true }
  })
  const foldDraft = (v) => {
    setOpenDraft(v)
    try { localStorage.setItem('adm.drafts', v ? 'open' : 'closed') } catch {}
  }

  useEffect(() => {
    setPicked(new Set())
    api(`/posts?kind=${kind}`).then((d) => setPosts(d.posts))
      /* 이 경로만 사라지는 타이머가 없었습니다 — 다른 자리와 맞춥니다 */
      .catch((e) => { setErr(e.message); setTimeout(() => setErr(''), 5000) })
  }, [reloadKey, kind])

  /** 이 글의 카테고리 식별자 — 목록이 받은 `meta` 는 `coalesce(draft_meta, meta)` 라 고치던 초안이 먼저입니다 */
  const catOf = (p) => (typeof p.meta?.category === 'string' ? p.meta.category : '')
  const inFilter = (p) => filter === 'all' || catOf(p) === filter
  const togglePick = (slug) => setPicked((set) => {
    const next = new Set(set)
    if (next.has(slug)) next.delete(slug); else next.add(slug)
    return next
  })
  /**
   * 고른 글에 카테고리를 한 번에 — `POST /api/posts/category`. 서버가 `meta`·`draft_meta` 둘 다 고치고
   * 발행 글이 섞여 있으면 다시 굽습니다. 화면은 돌려받은 값으로 그 자리에서 바꿉니다(새로고침 전까지
   * 눈앞과 DB 가 다르면 안 됩니다).
   */
  const assign = async () => {
    if (!picked.size) return
    setErr(''); setBusy('bulk')
    try {
      const slugs = [...picked]
      const d = await api('/posts/category', { method: 'POST', body: JSON.stringify({ slugs, category: bulkCat }) })
      setPosts((list) => list.map((x) => (picked.has(x.slug)
        ? { ...x, meta: { ...(x.meta || {}), category: d.category } } : x)))
      setPicked(new Set())
      say(d.category ? `${d.count}편을 「${labelOfCat(d.category)}」에 넣었습니다` : `${d.count}편을 카테고리에서 뺐습니다`)
      if (d?.bakeError) { setErr('바꿨지만 페이지를 굽지 못했습니다: ' + d.bakeError); setTimeout(() => setErr(''), 3000) }
    } catch (e) { setErr(e.message); setTimeout(() => setErr(''), 3000) }
    finally { setBusy(null) }
  }

  /* 첫 목록을 기다리는 중. 200ms 를 넘겨야 뼈대를 보여 줍니다 */
  const slow = useSlow(!posts && !err)

  /** 숨김 / 보임 — 발행은 그대로 두고 공개 페이지에서만 내립니다 */
  const toggle = async (p) => {
    setErr(''); setBusy(p.slug)
    try {
      const d = await api(`/posts/${encodeURIComponent(p.slug)}/visibility`,
        { method: 'POST', body: JSON.stringify({ hidden: !p.hidden }) })
      if (d?.bakeError) throw new Error('바꿨지만 페이지를 굽지 못했습니다: ' + d.bakeError)
      setPosts((list) => list.map((x) => (x.slug === p.slug ? { ...x, hidden: d.post.hidden } : x)))
    } catch (e) { setErr(e.message); setTimeout(() => setErr(''), 3000) }
    finally { setBusy(null) }
  }

  const ask = (slug) => { setErr(''); setAsking(slug) }

  /**
   * 지우기 — 서버가 파일을 먼저 휴지통으로 옮기고 행을 나중에 지웁니다.
   *
   * 굽기가 실패해도 글은 이미 없습니다 — 줄은 빼고 오류만 알립니다.
   * 여기서 던지면 지워진 글이 목록에 남고, 그 줄을 다시 지르면 404 가 납니다.
   */
  const remove = async (p) => {
    setErr(''); setBusy(p.slug)
    try {
      const d = await api('/posts/' + encodeURIComponent(p.slug), { method: 'DELETE' })
      setAsking(null)
      setPosts((list) => list.filter((x) => x.slug !== p.slug))
      /* 무엇을 지웠는지는 줄이 사라진 것이 이미 말합니다. 제목을 다시 읊으면 말이 겹칩니다 */
      say('삭제했습니다')
      if (d?.bakeError) {
        setErr('지웠지만 페이지를 굽지 못했습니다: ' + d.bakeError)
        setTimeout(() => setErr(''), 3000)
      }
    } catch (e) { setErr(e.message); setTimeout(() => setErr(''), 3000) }   // 띠는 열린 채 — 다시 누르거나 취소
    finally { setBusy(null) }
  }

  /**
   * 초안과 발행을 다른 그룹으로 가릅니다. 나간 글과 안 나간 글은 하는 일이 다릅니다.
   * 발행 그룹 안에서는 숨긴 글이 맨 아래 — 지금 공개돼 있는 것이 위입니다. 둘 다 최신순.
   */
  const ts = (p) => Date.parse(p.published_at || p.created_at) || 0
  /* 작업은 손으로 정한 차례가 있습니다(`ord`). 여기서 시간순으로 다시 세우면
     끌어 옮긴 순서가 화면에서 도로 사라집니다 — 서버가 준 차례를 그대로 씁니다.
     글은 `ord` 가 늘 비어 있어 예전처럼 최신순입니다. */
  const rank = (p) => (Number.isInteger(p.ord) ? p.ord : Number.MAX_SAFE_INTEGER)
  const drafts = (posts || []).filter((p) => !p.published_at && inFilter(p)).sort((a, b) => ts(b) - ts(a))
  const live = (posts || []).filter((p) => p.published_at && inFilter(p)).sort((a, b) => (
    a.hidden !== b.hidden ? (a.hidden ? 1 : -1)
      : isWork ? (rank(a) - rank(b) || ts(b) - ts(a))
        : ts(b) - ts(a)))

  /* 끌어서 순서 바꾸기. 놓는 즉시 서버에 적습니다 — 「저장」 단추가 따로 없는 화면이라
     손을 떼는 것이 곧 저장이어야 합니다. 실패하면 되돌리고 말합니다. */
  const dragFrom = useRef(null)
  const moveTo = async (to) => {
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null || from === to) return
    const before = posts
    const next = [...live]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    /* `ord` 도 같이 고칩니다. 목록은 매 렌더 `ord` 로 다시 세우므로, 차례만 바꿔 두면
       화면이 그 자리에서 옛 순서로 되돌아갑니다 — 서버엔 새 순서, 눈앞엔 옛 순서가 됩니다 */
    const reordered = next.map((x, i) => ({ ...x, ord: i + 1 }))
    setPosts((all) => [...reordered, ...all.filter((x) => !reordered.some((y) => y.id === x.id))])
    try {
      await api('/works/order', { method: 'POST', body: JSON.stringify({ order: reordered.map((x) => x.slug) }) })
      say('순서를 바꿨습니다')
    } catch (e) {
      setPosts(before)
      setErr(e.message); setTimeout(() => setErr(''), 3000)
    }
  }

  /* 편집을 끄면 고른 것도 풉니다 — 칸이 사라진 뒤에도 선택이 남아 있으면 다시 켤 때
     모르는 글이 골라져 있습니다 */
  const toggleEdit = () => setEdit((v) => { if (v) setPicked(new Set()); return !v })

  const rowProps = (p) => ({
    busy: busy === p.slug, asking: asking === p.slug, onOpen,
    onAsk: () => ask(p.slug), onNo: () => setAsking(null), onYes: () => remove(p),
    /* 글에만 — 카테고리 칩과 고르기 칸. 작업은 카드라 이 줄을 안 씁니다.
       칩은 카테고리를 만든 사이트에서만 뜨고, 분류 안 한 글에는 「기본」이 옅게 붙습니다 */
    chip: isWork || !cats.length ? '' : (labelOfCat(catOf(p)) || DEFAULT_LABEL),
    chipMuted: !isWork && cats.length > 0 && !labelOfCat(catOf(p)),
    /* 고르기 칸은 편집 모드에서만 — `onPick` 이 없으면 `PickBox` 가 아무것도 안 그립니다 */
    picked: picked.has(p.slug),
    onPick: isWork || !edit ? null : () => togglePick(p.slug),
  })
  /* 거른 결과 전부(초안 포함) — 「모두 고르기」의 대상 */
  const shown = [...drafts, ...live]
  const allPicked = shown.length > 0 && shown.every((p) => picked.has(p.slug))

  return (
    <section>
      {/* 초안은 절이 아니라 드로어입니다 — 검정 헤더에 붙고, 접히면 knob 44px 만 남습니다.
          제목이 사라지는 게 아니라 제목이었던 것이 knob 으로 내려앉는 것이라 개수는 늘 보입니다. */}
      {drafts.length > 0 && (
        <div className="tray">
          <button type="button" className="bar" aria-expanded={openDraft} aria-controls="drafts"
                  title={openDraft ? '지금 펼침 — 누르면 접습니다' : '지금 접힘 — 누르면 펼칩니다'}
                  onClick={() => foldDraft(!openDraft)}>
            <span className="chev"><Chev /></span>
            <span className="lb">초안 <span className="cnt">{drafts.length}</span></span>
          </button>
          {openDraft && (
            <ul id="drafts" className="list">
              {drafts.map((p) => <DraftRow key={p.id} p={p} {...rowProps(p)} />)}
            </ul>
          )}
        </div>
      )}

      {/* 페이지 — 제목은 하나. 드로어가 있든 없든, 열렸든 닫혔든 위 여백이 같습니다 */}
      <div className="head">
        <h2>{W.one} {live.length > 0 && <span className="cnt">{live.length}</span>}</h2>
        {/* 편집 — 카테고리를 하나라도 만든 블로그에만. 옮길 데가 없으면 고르는 뜻도 없습니다 */}
        {!isWork && cats.length > 0 && (
          <button type="button" className="headEdit" aria-pressed={edit} onClick={toggleEdit}>
            {edit ? '편집 중' : '편집'}
          </button>
        )}
        <button className="primary" onClick={onNew}>{W.add}</button>
      </div>
      {/* 작업물은 모드와 무관하게 쌓입니다 — 다만 지금 나가는지는 말해 줍니다.
          직접 디자인인 동안 미리 쌓아 두었다가 템플릿으로 바꾸면 한꺼번에 나갑니다. */}
      {isWork && !worksLive && (
        <p className="lsNote">
          지금 포트폴리오는 <b>직접 디자인</b>이라, 여기 쌓은 작업물은 사이트에 안 나옵니다.
          {' '}미리 쌓아 두셔도 됩니다 — <b>홈디자인 → 포트폴리오 → 템플릿</b> 으로 바꾸면 한꺼번에 나갑니다.
        </p>
      )}
      {/* 카테고리로 거르기 + 여러 편 한 번에 앉히기. 카테고리를 하나도 안 만든 사이트에는 안 나옵니다 —
          고를 것이 「카테고리 없음」뿐이면 거르는 뜻이 없습니다 */}
      {!isWork && cats.length > 0 && (
        <div className="flt" role="group" aria-label="카테고리로 거르기">
          {[['all', '모두'], ['', '카테고리 없음'], ...cats.map((c) => [c.id, c.label])].map(([v, label]) => (
            <button key={v} type="button" className="chip" aria-pressed={filter === v}
                    onClick={() => setFilter(v)}>{label}</button>
          ))}
          {edit && (
            <label className="pickAll">
              <input type="checkbox" checked={allPicked}
                     onChange={() => setPicked(allPicked ? new Set() : new Set(shown.map((p) => p.slug)))} />
              모두 고르기
            </label>
          )}
        </div>
      )}
      {/* 편집 모드면 늘 보입니다. 고른 것이 없을 때도 띄우는 까닭: 체크 칸만 서 있고 아무 말이 없으면
          「골라서 무엇을 하는가」를 알 수 없습니다 — 고르기 전에 먼저 말해 둡니다 */}
      {!isWork && edit && cats.length > 0 && (
        <div className="bulk" role="group" aria-label="고른 글의 카테고리">
          <span className="bulkN">
            {picked.size ? <><b>{picked.size}</b>편 고름</> : '옮길 글을 고르세요'}
          </span>
          <Picker title="카테고리" className="lkPicker bulkPick" width={220} value={bulkCat}
                  items={[{ value: '', label: `${DEFAULT_LABEL} (카테고리에서 빼기)` },
                    ...cats.map((c) => ({ value: c.id, label: c.label + (c.show ? '' : ' (비공개)') }))]}
                  onPick={setBulkCat} />
          <button type="button" className="primary" disabled={!picked.size || busy === 'bulk'} onClick={assign}>
            {busy === 'bulk' ? '지정 중' : '카테고리 지정'}</button>
          {picked.size > 0 && <button type="button" onClick={() => setPicked(new Set())}>고른 것 풀기</button>}
        </div>
      )}
      {/* 오류는 눈을 누른 자리(목록) 바로 위에 — 드로어는 헤더에 붙어 있어야 합니다 */}
      {err && <p className="err">{err}</p>}
      {/* 작업은 제목이 아니라 그림으로 고릅니다 — 줄 목록에 썸네일을 끼우는 대신
          카드 격자로 냅니다. 공개면 목록과 같은 결이라 무엇을 고치는 중인지 바로 보입니다.
          순서는 끌어서 바꿉니다(공개면 카드 차례가 이것입니다). */}
      {live.length > 0
        ? isWork
          ? <ul className="folders">
              {live.map((p, i) => (
                <li key={p.id} draggable data-hidden={p.hidden ? '' : undefined}
                    onDragStart={() => { dragFrom.current = i }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); moveTo(i) }}>
                  <button type="button" className="fo" onClick={() => onOpen(p.slug)}>
                    <span className="fo-shot">{p.cover ? <img src={p.cover} alt="" loading="lazy" /> : null}</span>
                    <span className="fo-name">{p.title || '이름 없음'}</span>
                    <span className="fo-sub">
                      {p.image_count ? `${p.image_count}장` : '비어 있음'}
                      {p.hidden ? ' · 내려둠' : ''}
                    </span>
                  </button>
                  <span className="fo-ops">
                    <button type="button" className="vis" disabled={busy === p.slug}
                            aria-label={p.hidden ? '다시 올리기' : '내려두기'}
                            title={p.hidden ? '지금 내려둠 — 누르면 올립니다' : '지금 보임 — 누르면 내립니다'}
                            onClick={(e) => { e.stopPropagation(); toggle(p) }}><Eye off={p.hidden} /></button>
                    <DelButton p={p} asking={asking === p.slug} busy={busy === p.slug}
                               onToggle={asking === p.slug ? () => setAsking(null) : () => ask(p.slug)} />
                  </span>
                  {asking === p.slug && <Ask p={p} busy={busy === p.slug} onYes={() => remove(p)} onNo={() => setAsking(null)} />}
                </li>
              ))}
            </ul>
          : <ul className="list">
              {live.map((p, i) => <Row key={p.id} p={p} i={i} onVis={() => toggle(p)} {...rowProps(p)} />)}
            </ul>
        : posts && <p className="empty">{W.none}</p>}

      {/* 기다림은 올 것의 모양으로 말합니다. 「불러오는 중…」 한 줄은 자리를 안 잡아 줘서
          도착하는 순간 화면이 통째로 튀었습니다. 줄의 척추를 그대로 쓰면 높이가 안 바뀝니다. */}
      {!posts && !err && slow && (
        <ul className="list" aria-hidden="true">
          {['70%', '52%', '61%'].map((w, i) => (
            <li key={i}><div className="row sk">
              <span className="skb skb-no" />
              <span className="body">
                <span className="skb skb-ti" style={{ width: w }} />
                <span className="skb skb-sl" />
              </span>
              <span />
              <span className="skb skb-dt" />
            </div></li>
          ))}
        </ul>
      )}

      {/* 토스트 — 흐름 밖이라 목록을 밀지 않습니다. `role="status"` 라 읽어 주되
          초점은 안 뺏습니다(초점을 옮기면 키보드로 하던 일이 끊깁니다).
          저절로 사라지는 알림에도 닫기 단추를 둡니다 — 화면을 직접 치우고 싶은 사람이 있고,
          접근성 권고이기도 합니다. 되돌리기는 안 답니다: 서버가 파일을 먼저 옮기고 행을
          지우므로 지금 구조에서 되돌릴 수 없습니다. 못 지킬 약속을 단추로 만들지 않습니다. */}
      {note && (
        <p className="toast" role="status"
           onMouseEnter={hold} onMouseLeave={release} onFocus={hold} onBlur={release}>
          <span className="toast-t">{note}</span>
          <button type="button" className="toast-x" aria-label="알림 닫기"
                  onClick={() => { hold(); setNote('') }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </p>
      )}
    </section>
  )
}

/**
 * 편집 화면.
 *
 * 주소(`location`)를 여기서 읽지 않습니다. `preview.jsx` 하네스가 이 컴포넌트를
 * 쿼리스트링으로 직접 세우기 때문입니다. 그 하네스는 툴바 고정이 깨졌던 경로를 재현하려고
 * 남겨 둔 것입니다. 히스토리 처리는 전부 App 이 합니다.
 * 여기는 「고쳤습니다」를 위로 알리기만 하고(`onDirtyChange`), 나갈지 말지는 `App` 이 묻습니다.
 */
export function Editor({ slug: openSlug, kind = 'post', cats = [], onBack, onDirtyChange, leaving }) {
  const isWork = kind === 'work'
  const [title, setTitle] = useState(EMPTY_TITLE)
  /* 카테고리·태그. 저장 때 본문과 같이 갑니다 — 초안이면 초안 그림자(`draft_meta`)에 앉습니다 */
  const [meta, setMeta] = useState(EMPTY_META)
  const [doc, setDoc] = useState({ json: null, html: '' })
  /* 툴바의 「가운데폭 / 전체폭」. 초깃값은 버튼이 켜져 보이는 그 폭이어야 합니다 —
     'measure'(38rem)로 두면 가운데폭이 눌린 것처럼 보이는데 실제 글줄은 더 좁습니다. */
  const [width, setWidth] = useState(CENTERED_WIDTH)
  const [slug, setSlug] = useState(openSlug || '')
  /* 어느 단추가 도는 중인가 — 'draft' | 'publish' | null. 둘을 갈라야 도는 쪽만 켜집니다 */
  const [act, setAct] = useState(null)
  /**
   * 발행 패널이 열렸는가.
   *
   * 카테고리·태그 칸을 본문 위에 늘 세워 뒀더니 글을 쓰는 내내 자리를 차지했습니다 —
   * 한 글에 한 번 정하는 것이라 늘 보일 값이 없습니다. 「발행」을 누를 때 그 단추 밑으로
   * 떨어뜨립니다. 정하는 자리와 내보내는 자리가 같아야 빠뜨리지 않습니다.
   */
  const [pubOpen, setPubOpen] = useState(false)
  const pubRef = useRef(null)
  /* 서버에 마지막으로 남긴 것. 1.8초 토스트가 아니라 계속 남습니다 —
     「정말 써졌나」는 사라지는 글자가 아니라 남아 있는 줄이 답합니다 */
  const [last, setLast] = useState(null)
  const [pubAt, setPubAt] = useState(null)
  /* 발행본과 따로 들고 있는 고치던 초안이 있는가 */
  const [hasDraft, setHasDraft] = useState(false)
  const [upl, setUpl] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!openSlug)
  /* 불러오기가 200ms 를 넘길 때만 뼈대를 표시합니다 */
  const slow = useSlow(!loaded)

  /**
   * 저장 안 한 변경이 있는가.
   *
   * 기준(`baseRef`)은 「불러온 직후」와 「저장 직후」의 문서입니다. 매 타자마다 문서를 통째로
   * 직렬화하면 긴 글에서 무겁습니다 — 마지막 입력 400ms 뒤에 한 번만 잽니다.
   * 상태가 아니라 ref 인 이유: 이 값이 바뀔 때마다 편집기를 다시 그릴 이유가 없습니다.
   */
  const baseRef = useRef(null)
  const dirtyRef = useRef(false)
  const sig = (t, j, w, m) => JSON.stringify([t ?? null, j ?? null, w ?? null, m ?? null])
  /* 타이머가 지금 값을 보게 하는 창구 — 효과 클로저에 갇힌 옛 값을 재면 안 됩니다 */
  const curRef = useRef(null)
  curRef.current = { title, json: doc.json, width, meta }
  /** 지금을 새 기준으로 사용합니다 — 저장 직후 */
  const rebase = (t, j, w, m) => {
    baseRef.current = sig(t, j, w, m)
    if (dirtyRef.current) { dirtyRef.current = false; onDirtyChange?.(false) }
  }
  /** 기준을 다시 잡으라고 표시만 합니다 — 값은 아래 효과가 편집기에게 물어서 채웁니다 */
  const unbase = () => {
    baseRef.current = null
    if (dirtyRef.current) { dirtyRef.current = false; onDirtyChange?.(false) }
  }

  /**
   * 기준은 편집기가 문서를 한 번 다듬고 난 뒤의 모습입니다.
   *
   * 빈 글을 `null` 로 짐작해 두면 새 글이 열자마자 dirty 로 읽힙니다 — 편집기가 빈 문단
   * 하나를 만들어 넣기 때문입니다.
   * 화면이 가라앉은 뒤의 진짜 모습을 기준으로 사용합니다.
   */
  useEffect(() => {
    if (!loaded || baseRef.current !== null) return
    const id = setTimeout(() => {
      const c = curRef.current
      baseRef.current = sig(c.title, c.json, c.width, c.meta)
    }, 150)
    return () => clearTimeout(id)
  }, [loaded])

  /* 고쳤는가 — 마지막 입력 400ms 뒤에 한 번만 잽니다 */
  useEffect(() => {
    if (!loaded || baseRef.current === null) return
    const id = setTimeout(() => {
      const now = sig(title, doc.json, width, meta) !== baseRef.current
      if (now !== dirtyRef.current) { dirtyRef.current = now; onDirtyChange?.(now) }
    }, 400)
    return () => clearTimeout(id)
  }, [title, doc, width, meta, loaded])
  /* 화면을 떠나면 「고치는 중」도 같이 끝납니다 — 안 풀면 목록에서 계속 물어봅니다 */
  useEffect(() => () => onDirtyChange?.(false), [])

  /* 툴바가 붙을 자리 = 헤더의 실제 높이. 숫자를 고정하면 헤더 크기가 바뀔 때 어긋납니다.
     작업 편집도 같은 훅을 씁니다(wait.js) */
  const headRef = useRef(null)
  const headH = useHeadH(headRef)

  useEffect(() => {
    /* 화면이 바뀌면 이전 글의 번호·경로표가 남아 있으면 안 됩니다 */
    if (!openSlug) setPostNo(null)
    if (!openSlug) { unbase(); return }
    api(`/posts/${encodeURIComponent(openSlug)}?kind=${kind}`)
      .then((d) => {
        const p = d.post
        /* 사진은 본문에 id 만 있습니다. 경로표를 먼저 심지 않으면 빈칸으로 표시됩니다 */
        setPostNo(p.no)
        seedAttachments(d.attachments)
        /* 제목은 글자만이 아닙니다 — 배너·글꼴·크기·색이 같이 삽니다.
           title_doc 이 있으면 그걸 쓰고, 옛 글(글자만 저장된 것)은 글자로 되살립니다. */
        setTitle(p.title_doc ? { ...EMPTY_TITLE, ...p.title_doc }
                             : p.title ? { ...EMPTY_TITLE, text: p.title } : EMPTY_TITLE)
        setPubAt(p.published_at)
        setHasDraft(!!p.has_draft)
        /* 서버가 모양을 못 박아 두므로(`normalizeMeta`) 두 키만 받습니다 — 옛 작업물 메타가 섞여 있어도 안 들입니다 */
        setMeta({ category: p.meta?.category || '', tags: Array.isArray(p.meta?.tags) ? p.meta.tags : [] })
        /* 열자마자 「발행됨 · 날짜 · 글 보기」가 보이게 — 상태 칸은 늘 서버의 마지막 상태입니다 */
        if (p.has_draft) setLast({ kind: 'draft', at: '고치는 중', url: null })
        else if (p.published_at) setLast({ kind: 'publish', at: ymd(p.published_at), url: postUrl(p.slug, kind) })
        if (p.width) setWidth(p.width)
        setDoc({ json: p.doc || null, html: p.body || '' })
        unbase()          /* 기준은 화면이 가라앉은 뒤에 위 효과가 잡습니다 */
        setLoaded(true)
      })
      .catch((e) => { setErr(e.message); unbase(); setLoaded(true) })
  }, [openSlug])

  /** 성공하면 true — 「저장하고 나가기」가 이 값을 보고 나갈지 정합니다 */
  /* 바깥을 누르거나 Esc 면 닫습니다. 칸에 친 값은 그대로 들고 있습니다 —
     패널은 값을 담는 그릇이 아니라 보여 주는 창이고, 값은 `meta` 가 들고 있습니다 */
  useEffect(() => {
    if (!pubOpen) return undefined
    const 바깥 = (e) => { if (pubRef.current && !pubRef.current.contains(e.target)
      && !e.target.closest?.('.pePub')) setPubOpen(false) }
    const 키 = (e) => { if (e.key === 'Escape') setPubOpen(false) }
    document.addEventListener('mousedown', 바깥)
    document.addEventListener('keydown', 키)
    return () => { document.removeEventListener('mousedown', 바깥); document.removeEventListener('keydown', 키) }
  }, [pubOpen])

  const save = async (publish) => {
    setErr(''); setAct(publish ? 'publish' : 'draft'); setBusy(true)
    /* 기준은 부르는 시점의 문서입니다. 저장하는 동안 더 쳤다면 그건 또 안 저장한 변경입니다 */
    const snap = { t: title, j: doc.json, w: width, m: meta }
    try {
      const t = (title?.text || '').trim()
      if (!t) throw new Error('제목을 입력해 주세요')
      /* 사진은 쓰는 내내 브라우저 안에만 있었습니다 — 여기서 한 번에 올리고 진짜 id 로 바꿉니다 */
      const up = await flushUploads(doc.json, doc.html, title, (done, total) => setUpl({ done, total }))
      const d = await api('/posts', { method: 'POST', body: JSON.stringify({
        title: t, titleDoc: up.title, slug, no: getPostNo(),
        body: up.html, doc: up.json, width, publish,
        kind, meta }) })
      if (d?.post?.no) setPostNo(d.post.no)
      if (d?.post?.slug) setSlug(d.post.slug)   /* 주소는 서버가 자동으로 만듭니다 */
      /* 굽기가 실패하면 발행은 됐어도 공개 페이지에는 안 보입니다 — 조용히 넘기지 않습니다 */
      if (d?.bakeError) throw new Error('발행은 됐지만 페이지를 굽지 못했습니다: ' + d.bakeError)
      /* 관리자를 떠나지 않습니다. 발행 뒤 공개 사이트로 보내면 뒤로 가기가
         관리자가 아니라 공개 사이트 안에서 움직입니다. 「정말 써졌나」는
         상태 칸에 남는 「글 보기 ↗」(새 탭)가 답합니다. */
      setPubAt(d?.post?.published_at ?? (publish ? new Date().toISOString() : pubAt))
      setHasDraft(!publish)
      setLast({
        kind: publish ? 'publish' : 'draft',
        at: hhmm(new Date()),
        url: publish && d?.post?.slug ? postUrl(d.post.slug, kind) : null,
      })
      rebase(snap.t, snap.j, snap.w, snap.m)
      return true
    } catch (e) { setErr(e.message); setTimeout(() => setErr(''), 3000); return false }
    finally { setBusy(false); setAct(null); setUpl(null) }
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /**
   * 헤더는 불러오는 중에도 렌더링합니다.
   *
   * `if (!loaded) return …` 로 통째로 막으면 안 됩니다. 기존 글은 `loaded=false` 로
   * 시작하므로 헤더가 DOM 에 없는 채로 위의 효과가 한 번 돌고 끝나, `headH` 가
   * 영원히 0 으로 남습니다 → `stickyTop=0` → 툴바가 헤더 뒤로 파고듭니다.
   * 새 글은 `loaded` 가 처음부터 true 라, 증상이 「기존 글에서만」 나 찾기 어렵습니다.
   *
   * 조건부 마운트를 없애면 이 부류가 통째로 사라집니다. 덤으로 불러오는 동안에도 ← 로 나갈 수 있습니다.
   */
  return (
    <>
      {/* 편집기와 같은 결로 — 흰 바탕, #dedbd4 경계, 반경 7px, 눌린 것은 #1a1a1a */}
      <header className="peHead" ref={headRef} aria-busy={busy || !loaded ? 'true' : undefined}>
        <button type="button" className="peBtn peBack" onClick={onBack} title="목록으로" aria-label="목록으로">
          {/* 글자 「←」는 서체마다 모양이 다르고 시스템 폴백에 걸립니다 — SVG 로 못 고정합니다 */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="peStat" role={err ? 'alert' : 'status'}>
          {err ? <span className="peErr">{err}</span>
           : upl ? `사진 올리는 중 ${upl.done}/${upl.total}`
           : last && (
             <>
               {last.kind === 'publish' ? '발행됨' : '초안 저장됨'}
               <span className="peWhen"> · {last.at}</span>
               {last.url && (
                 <a className="peSee" href={last.url} target="_blank" rel="noopener">{isWork ? '작업 보기' : '글 보기'}
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                 </a>
               )}
             </>
           )}
        </span>

        {/* 발행된 글에는 「초안 저장」이 없습니다 — 서버가 published_at 을 지킨 채 굽기까지 해서
            그 글에서는 두 단추가 같은 일을 합니다. 같은 일을 하는 단추가 둘이면 차이가 있는 줄 알고 잘못 누릅니다. */}
        {/* 초안은 `draft_*` 열에 따로 앉습니다 — 발행된 글을 고치는 동안 나간 글은 그대로입니다.
            그래서 발행된 글에서도 이 단추가 제 일을 합니다. */}
        <button type="button" className="peDraft peBtn" onClick={() => save(false)}
                disabled={busy || !loaded}
                data-dirty={hasDraft ? '' : undefined}
                data-busy={busy && act === 'draft' ? '' : undefined}>
          {busy && act === 'draft' ? '저장 중' : '초안 저장'}
        </button>
        {/* 글은 발행 전에 카테고리·태그를 정합니다 — 단추가 패널을 엽니다.
            작업(`work`)에는 카테고리가 없어 지금처럼 바로 내보냅니다 */}
        <button type="button" className="pePub peBtn" title={isWork ? '발행 (⌘S)' : '발행 (⌘S)'}
                onClick={() => (isWork ? save(true) : setPubOpen((o) => !o))}
                aria-expanded={isWork ? undefined : pubOpen}
                disabled={busy || !loaded} data-busy={busy && act === 'publish' ? '' : undefined}>
          {busy && act === 'publish' ? '발행 중' : '발행'}
        </button>

        {/* 발행 패널 — 단추 바로 밑에 붙습니다. 헤더 안에 두어야 단추를 기준으로 설 수 있습니다.
            모달이 아닙니다: 화면을 덮으면 무엇을 내보내는지가 안 보이고, 이 패널은 쓰던 글 위에
            잠깐 떨어지는 것이라 바깥을 누르면 그냥 닫힙니다(아무것도 안 바꿉니다). */}
        {pubOpen && !isWork && (
          <div className="pePanel" ref={pubRef} role="dialog" aria-label="발행 설정">
            <div className="pePanelRow">
              <span>카테고리</span>
              <div>
                <Picker title="카테고리" className="lkPicker pePanelPick" width={240} value={meta.category || ''}
                        items={[{ value: '', label: DEFAULT_LABEL },
                          ...cats.map((c) => ({ value: c.id, label: c.label + (c.show ? '' : ' (비공개)') }))]}
                        onPick={(v) => setMeta((m) => ({ ...m, category: v }))} />
                {/* 들고 있던 식별자가 목록에 없습니다 — 다른 탭에서 지웠거나 목록이 낡은 것.
                    그대로 내보내면 서버가 400 으로 돌려보냅니다 */}
                {meta.category && !cats.some((c) => c.id === meta.category) && (
                  <em className="pePanelWhy">없는 카테고리입니다 — 다시 골라 주세요</em>
                )}
              </div>
            </div>
            <div className="pePanelRow pePanelTags">
              <span id="tagLb">태그</span>
              <TagField tags={meta.tags || []} onChange={(t) => setMeta((m) => ({ ...m, tags: t }))} />
            </div>
            <div className="pePanelFoot">
              <span className="pePanelNote">{pubAt ? '이미 나간 글입니다 — 고친 내용으로 다시 굽습니다' : '누르면 공개면에 올라갑니다'}</span>
              <button type="button" className="peBtn pePub" disabled={busy}
                      onClick={async () => { if (await save(true)) setPubOpen(false) }}>
                {busy && act === 'publish' ? '발행 중' : '발행'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 저장 안 한 채 나가려 할 때. 모달을 안 씁니다 — 화면을 덮으면 무엇을 두고
          나가는지 오히려 안 보입니다. 헤더 바로 아래 같은 검정 띠로 붙어 글이 계속 보입니다.
          자리는 헤더의 잰 높이를 씁니다(숫자를 박으면 헤더가 커지는 날 어긋납니다). */}
      {leaving && (
        <div className="peAsk" style={{ top: headH }} role="alertdialog"
             aria-label="저장 안 한 변경이 있습니다">
          <span className="peAskMsg">저장 안 한 변경이 있습니다</span>
          <button type="button" className="peBtn" disabled={busy}
                  onClick={async () => { if (await save(false)) leaving.onLeave() }}>
            {busy && act === 'draft' ? '저장 중' : '초안 저장하고 나가기'}
          </button>
          <button type="button" className="peBtn" disabled={busy}
                  onClick={leaving.onLeave}>그냥 나가기</button>
          {/* 머무르기가 닫힌 도형 — 아무 생각 없이 누르면 글이 안 날아가는 쪽입니다 */}
          <button type="button" className="peBtn pePub" autoFocus
                  onClick={leaving.onStay}>머무르기</button>
        </div>
      )}

      {/* 여기는 `.adm` 밖입니다 — `App` 이 `.adm` 없이 `<Editor>` 를 바로 돌려줍니다.
          `.adm .empty` 처럼 `.adm` 을 전제한 규칙은 하나도 안 걸려 맨 검정 왼쪽 정렬이
          나옵니다. 제 클래스(`.peWait`)로만 겁니다.
          헤더의 러너가 「기다립니다」를 말하고, 여기는 「무엇이 올지」를 말합니다. */}
      {!loaded ? (
        slow && (
          <div className="peWait" aria-hidden="true">
            <span className="skb skb-h" />
            <span className="skb skb-p" />
            <span className="skb skb-p short" />
          </div>
        )
      ) : (
        <main className="peMain">
          <PostEditor
            title={title}
            onTitleChange={setTitle}
            /* `doc` 이 없으면 본문 HTML 로 엽니다. `value` 는 JSON 도 HTML 문자열도 받고,
               노드들이 `data-*` 로 왕복하도록 돼 있어 표·인용·다이어그램까지 살아납니다.
               이게 없으면 `doc` 이 빈 글(시드로 심은 글, 옮겨 온 글)이 빈 화면으로 열려
               저장하는 순간 본문이 통째로 날아갑니다. */
            value={doc.json || doc.html || undefined}
            onChange={(json, html) => setDoc({ json, html })}
            width={width}
            onWidthChange={setWidth}
            bleed="viewport"
            stickyTop={headH}
            autofocus
          />
        </main>
      )}
    </>
  )
}

/**
 * 주소 ↔ 화면. 히스토리 배선은 App 에만 둡니다 (이유는 `Editor` 주석 참고).
 *
 * 글:   목록 `/` · 새 글 `/new` · 고치기 `/{번호}`
 * 작업: 목록 `/works` · 새 작업 `/works/new` · 고치기 `/works/{주소}`
 * 공개 주소(`/blog/3/`·`/portfolio/3/`)와 결이 같습니다.
 * nginx 도 vite 도 어떤 경로든 `index.html` 로 넘겨 주므로 서버 쪽에 고칠 것이 없습니다.
 *
 * 카테고리 주소(`/blog/<slug>/`)는 예약어를 못 씁니다(`shared/category.mjs` 의 `RESERVED`).
 */
/**
 * 왼쪽 메뉴 — 이 사이트에서 손댈 수 있는 것 전부가 여기 있습니다.
 *
 * 위 탭으로 두면 「글/작업」은 보이는데 「홈디자인」은 헤더 구석에 단추로 남아,
 * 같은 무게의 일 셋이 서로 다른 자리에 흩어집니다. 셋을 한 줄에 세우면 무엇을 할 수
 * 있는지가 한눈에 끝납니다. 주소가 곧 지금 자리라(`/look`·`/`·`/works`) 새로고침해도 그대로입니다.
 */
const MENU = [
  { view: { name: 'look', kind: 'post' }, label: '홈디자인' },
  { view: { name: 'list', kind: 'post' }, label: '블로그' },
  { view: { name: 'list', kind: 'work' }, label: '포트폴리오' },
]
/** 지금 있는 자리가 메뉴의 어느 줄인가 — 글쓰기 화면에서도 온 자리를 표시합니다 */
const menuAt = (v) => (v.name === 'look' ? '홈디자인' : v.kind === 'work' ? '포트폴리오' : '블로그')

/**
 * 주소 → 화면. 설정을 안 봅니다 — 첫 그림이 설정보다 먼저 그려지기 때문입니다.
 *
 * 작업물을 안 쓰는 사이트에서 `/works` 로 들어온 사람은 빈 목록을 봅니다. 그쪽이
 * 「주소는 맞는데 아무것도 없습니다」로 읽혀, 글 목록으로 몰래 바꿔치는 것보다 낫습니다.
 */
const viewOf = (path) => {
  const s = decodeURIComponent(path || '/').replace(/^\/+|\/+$/g, '')
  if (!s) return { name: 'list', kind: 'post', slug: null }
  if (s === 'look') return { name: 'look', kind: 'post', slug: null }
  if (s === 'new') return { name: 'edit', kind: 'post', slug: null }
  if (s === 'works') return { name: 'list', kind: 'work', slug: null }
  if (s === 'works/new') return { name: 'edit', kind: 'work', slug: null }
  if (s.startsWith('works/')) return { name: 'edit', kind: 'work', slug: s.slice(6) }
  return { name: 'edit', kind: 'post', slug: s }
}
const pathOf = (v) => {
  if (v.name === 'look') return '/look'
  const base = v.kind === 'work' ? '/works' : ''
  if (v.name !== 'edit') return base || '/'
  return v.slug ? `${base}/${encodeURIComponent(v.slug)}` : `${base}/new`
}

export function App() {
  const [who, setWho] = useState('')
  const [ready, setReady] = useState(false)
  const [view, setView] = useState(() => viewOf(location.pathname))
  const [reloadKey, setReloadKey] = useState(0)
  /* 이동하려다 중단된 지점 { to }. 값이 있으면 편집 화면에 확인 배너를 표시합니다 */
  const [leave, setLeave] = useState(null)
  /* 토큰이 동작하지 않았습니다 — 지금 화면 위에 로그인을 띄웁니다. 편집기는 그대로 삽니다 */
  const [relogin, setRelogin] = useState(false)
  useEffect(() => { setOnExpired(() => setRelogin(true)) }, [])
  /* 편집기가 알려 주는 「저장 안 한 변경」. 리스너가 늘 최신 값을 보게 ref 로 둡니다 */
  const dirtyRef = useRef(false)
  const viewRef = useRef(view)
  viewRef.current = view

  /**
   * 첫 일은 갱신입니다.
   *
   * 액세스는 메모리에만 있으므로 새로고침하면 없습니다. 리프레시 쿠키가 살아 있으면 여기서
   * 새 액세스를 받아 그대로 들어갑니다.
   *
   * 「로그인이 아니다」와 「서버에 못 닿았습니다」를 가릅니다.
   *   `refresh()` 는 401 일 때만 false 를 돌려주고, 못 닿으면 던집니다. 둘을 뭉뚱그려
   *   로그인 화면을 띄우면, 배포 중(`bootout` → `bootstrap` 사이)에 새로고침한 사람은
   *   멀쩡한 세션을 두고 로그인 화면을 봅니다 — 「배포하면 풀립니다」로 읽히는 바로 그 증상입니다.
   *   못 닿았을 때는 그렇게 말하고 다시 시도할 길을 줍니다.
   */
  const [down, setDown] = useState('')
  /**
   * 작업물이 지금 사이트에 나가는가 — 목록 맨 위의 알림에만 씁니다(메뉴는 늘 보입니다).
   * 참으로 시작하지 않습니다: 설정이 도착하기 전에 「나갑니다」라고 말하면 거짓이 됩니다.
   */
  const [live, setLive] = useState(true)
  /* 카테고리 목록 — 글 목록(거르기·칩)과 편집기(고르기)가 씁니다. 홈디자인이 바꾸면 `onCats` 로 따라옵니다 */
  const [cats, setCats] = useState([])
  /* 배포는 API 를 1~3초 내렸다가 다시 올립니다. 그 사이에 걸린 새로고침 한 번 때문에
     「다시 시도」를 누르게 하지 않습니다 — 조용히 한 번 더 해 보고, 그래도 안 되면 그때 말합니다 */
  const boot = (retry = 1) => {
    setDown(''); if (retry) setReady(false)
    refresh()
      .then((ok) => { if (ok) setWho(tokenInfo().id) })
      .catch((e) => {
        if (retry > 0) return setTimeout(() => boot(retry - 1), 2000)
        setDown(e?.message || '서버에 닿지 못했습니다')
      })
      .finally(() => setReady(true))
  }
  useEffect(boot, [])

  /* 로그인한 뒤에 한 번 — 설정은 로그인해야 읽힙니다. 못 읽으면 조용히 기본값(안 띄움)입니다 */
  useEffect(() => {
    if (!who) return
    api('/settings').then((d) => {
      setOrigin(d.origin); setLive(worksLive(d.settings)); setCats(d.settings.blog?.categories || [])
    }).catch(() => {})
  }, [who])

  /**
   * 히스토리 심기 — 딱 한 번.
   *
   * /3 을 주소창에 바로 입력해 들어오면 뒤로 갈 곳이 없습니다. 그대로 두면 ← 와 두 손가락
   * 스와이프가 사이트를 통째로 떠납니다. 목록 자리를 먼저 깔고 그 위에 글을 얹어서
   * 뒤로가기가 항상 목록에 닿게 합니다.
   *
   * 어느 목록인지 보고 깝니다. 무조건 / 를 깔면, 작업을 열어 둔 채 새로고침했을 때 바닥이
   * 블로그라서 ← 가 블로그 목록으로 갑니다. 편집이 아닐 때 주소를 / 로 덮지도 않습니다.
   * /works 나 /look 에서 새로고침하면 주소만 / 로 바뀌어, 한 번 더 새로고침하면
   * 블로그로 떨어집니다.
   */
  useEffect(() => {
    const v = viewOf(location.pathname)
    const home = pathOf({ name: 'list', kind: v.kind })
    if (v.name !== 'edit') { history.replaceState(null, '', pathOf(v)); return }
    history.replaceState(null, '', home)
    history.pushState(null, '', pathOf(v))
  }, [])

  /* 뒤로/앞으로 — 두 손가락 스와이프도 결국 이것입니다.
     `popstate` 는 취소할 수 없습니다. 그래서 막을 때는 제자리로 다시 밀어 넣고 묻습니다. */
  useEffect(() => {
    const onPop = () => {
      const next = viewOf(location.pathname)
      const now = viewRef.current
      if (now.name === 'edit' && next.name !== 'edit' && dirtyRef.current) {
        history.pushState(null, '', pathOf(now))
        setLeave({ to: next })
        return
      }
      setLeave(null)
      setView(next)
      if (next.name === 'list') setReloadKey((k) => k + 1)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /* 탭 닫기·새로고침은 히스토리가 아닙니다 — 브라우저 기본 확인창으로만 막을 수 있습니다 */
  useEffect(() => {
    const onUnload = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  /* 토큰을 확인하는 동안. `return null` 로 두면 빈 흰 화면이 떴다가 끝나는 순간
     레이아웃이 통째로 들어서서 최대치로 튑니다. 다음 화면에도 있는 헤더를 먼저 세워 둡니다.
     (토큰이 없으면 `setReady` 가 동기로 끝나므로 이 껍데기는 아예 안 보입니다) */
  if (!ready) return (
    <div className="adm">
      <header aria-busy="true"><div className="wrap">
        <span className="brand"><Paw />블로그 관리자</span>
      </div></header>
    </div>
  )
  const done = (v) => { setWho(v); setRelogin(false) }
  /* 서버에 못 닿은 것뿐입니다 — 로그인 화면을 띄우면 세션이 끝난 것처럼 보입니다 */
  if (!who && down) return (
    <div className="adm login">
      <div className="box">
        <h1><Paw size={23} />블로그 관리자</h1>
        <p className="hint relog">{down}<br />서버가 배포 중이면 곧 돌아옵니다.</p>
        <button className="primary" style={{ width: '100%' }} onClick={() => boot()}>다시 시도</button>
      </div>
    </div>
  )
  if (!who) return <Login onDone={done} />

  const go = (v) => { history.pushState(null, '', pathOf(v)); setLeave(null); setView(v) }
  /* ← 와 제스처가 같은 길을 씁니다. 두 길이 갈리면 둘이 어긋나기 시작합니다 */
  const back = () => history.back()

  /* 만료 재로그인 — 어느 화면이든 그 위에 얹습니다 */
  const over = relogin && (
    <Login over onDone={done}
           note={view.name === 'edit'
                 ? '로그인이 만료되었습니다. 쓰던 글은 그대로 있습니다 — 다시 로그인한 뒤 저장을 한 번 더 눌러 주세요.'
                 : '로그인이 만료되었습니다.'} />
  )

  /* 글쓰기에서는 사이트 헤더를 걷어냅니다 — 제 껍데기가 편집기 위에 겹치면
     툴바가 두 겹이 되고 쓰는 자리가 아래로 밀립니다. */
  /* 작업은 편집기를 안 씁니다 — 제목과 그림 격자뿐인 제 화면으로 갑니다 */
  if (view.name === 'edit' && view.kind === 'work') return (<>
    {/* `live` = 포트폴리오가 지금 사이트에 나가는가(`worksLive`). 목록에만 말해 주던 것을
        편집 화면에도 넘깁니다 — 안 나가는 동안에도 「발행됨 · 작업 보기」가 떠서 404 로 갔습니다 */}
    <WorkFolder slug={view.slug} onBack={back} live={live}
                onDirtyChange={(d) => { dirtyRef.current = d }}
                leaving={leave && {
                  onStay: () => setLeave(null),
                  onLeave: () => { dirtyRef.current = false; setLeave(null); history.back() },
                }} />
    {over}
  </>)

  if (view.name === 'edit') return (<>
    <Editor slug={view.slug} kind={view.kind} cats={cats} onBack={back}
            onDirtyChange={(d) => { dirtyRef.current = d }}
            leaving={leave && {
              onStay: () => setLeave(null),
              /* 되돌려 놓은 한 칸을 다시 물립니다 — 이제 dirty 가 아니라 그냥 지나갑니다 */
              onLeave: () => { dirtyRef.current = false; setLeave(null); history.back() },
            }} />
    {over}
  </>)

  return (
    <div className="adm">
      <header><div className="wrap">
        <span className="brand"><Paw />관리자</span>
        <span>
          <span className="who">{who}</span>
          <button style={{ marginLeft: '.8rem', padding: '.4rem .8rem', fontSize: '.85rem' }}
                  title="이 기기에서 로그아웃됩니다 — 서버에서도 끊깁니다"
                  onClick={async () => {
                    /* 서버에 못 닿으면 쿠키와 세션 행이 그대로라 새로고침하면 도로
                       로그인된 상태가 됩니다 — 그걸 「로그아웃됐습니다」로 보여 주지 않습니다 */
                    if (await logout()) setWho('')
                    else setDown('로그아웃하지 못했습니다 — 서버에 닿지 못했습니다')
                  }}>로그아웃</button></span>
      </div></header>
      {down && <p className="wrap err">{down}</p>}
      <div className="shell">
        {/* 「홈디자인」과 「블로그」는 어느 사이트에나 있습니다 — 메뉴는 늘 표시합니다 */}
        <nav className="side" aria-label="메뉴">
          {MENU.map((m) => (
            <button key={m.label} type="button"
                    aria-current={menuAt(view) === m.label ? 'page' : undefined}
                    onClick={() => go({ ...m.view, slug: null })}>{m.label}</button>
          ))}
        </nav>
        <main className={view.name === 'look' ? 'lkHost' : 'wrap'}>
          {view.name === 'look'
            ? <Look onWorks={setLive} onCats={setCats} />
            : <List kind={view.kind} reloadKey={reloadKey} worksLive={live} cats={cats}
                    onNew={() => go({ name: 'edit', kind: view.kind, slug: null })}
                    onOpen={(s) => go({ name: 'edit', kind: view.kind, slug: s })} />}
        </main>
      </div>
      {over}
    </div>
  )
}
