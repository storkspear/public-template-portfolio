/**
 * 작업 폴더 — 디자이너가 완성된 그림을 올리는 자리. **편집기를 안 쓴다.**
 *
 * 글쓰기 화면과 일부러 다르게 생겼다. 그쪽은 「쓰는 자리」라 툴바와 본문이 주인공이지만
 * 여기는 「고르는 자리」라 **그림이 화면의 전부**여야 한다. 제목 한 줄과 격자뿐이다.
 *
 * 순서는 끌어서 바꾼다 — 공개면의 세로 스택이 정확히 이 차례로 나간다.
 * 대표(★)는 목록 카드와 공유 그림에 쓰인다.
 */
import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { ACCEPT, uploadMood } from './mood.js'
import { postUrl, workPath } from './urls.js'
import { useHeadH, useSlow } from './wait.js'

const Star = ({ on }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill={on ? 'currentColor' : 'none'}
       stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z" />
  </svg>
)
const Cross = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
)

export function WorkFolder({ slug: openSlug, onBack, onDirtyChange, leaving, live = true }) {
  const [title, setTitle] = useState('')
  const [images, setImages] = useState([])          /* [{id, src, thumb, w, h}] — 차례가 곧 순서 */
  const [cover, setCover] = useState(null)
  const [no, setNo] = useState(null)
  const [pubAt, setPubAt] = useState(null)
  const [hidden, setHidden] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [upl, setUpl] = useState(null)
  const [loaded, setLoaded] = useState(!openSlug)
  const fileRef = useRef(null)

  /* 저장 안 한 변경 — 글쓰기 화면과 같은 규약(`onDirtyChange`)이라 나가기 확인 띠가 그대로 듣는다 */
  const baseRef = useRef(null)
  const dirtyRef = useRef(false)
  const sig = (t, im, cv) => JSON.stringify([t, im.map((x) => x.id), cv])
  const rebase = (t, im, cv) => {
    baseRef.current = sig(t, im, cv)
    if (dirtyRef.current) { dirtyRef.current = false; onDirtyChange?.(false) }
  }
  useEffect(() => {
    if (!loaded || baseRef.current === null) return
    const now = sig(title, images, cover) !== baseRef.current
    if (now !== dirtyRef.current) { dirtyRef.current = now; onDirtyChange?.(now) }
  }, [title, images, cover, loaded])
  useEffect(() => () => onDirtyChange?.(false), [])

  useEffect(() => {
    if (!openSlug) { rebase('', [], null); setLoaded(true); return }
    api(`/works/${encodeURIComponent(openSlug)}`)
      .then((d) => {
        setNo(d.work.no)
        setTitle(d.work.title || '')
        setPubAt(d.work.published_at)
        setHidden(!!d.work.hidden)
        /**
         * ⚠ **`thumb` 의 모양이 두 곳에서 다르다.**
         *   올릴 때(`uploadMood`)  파일 이름 — `abc.webp`
         *   되읽을 때(이 응답)      전체 경로 — `/blog/30/abc.webp`
         * 서버에 저장할 때는 **파일 이름**이어야 한다(`okFileName` 이 거른다). 그래서 들어오는
         * 자리에서 한 모양으로 맞춘다 — 안 맞추면 다시 연 작업이 그림을 잃고(경로가 두 번 겹쳐
         * 붙는다), 다시 저장하면 작은 판이 통째로 날아간다(2026-09-18 사용자 지적).
         */
        const list = d.images.map((a) => ({
          id: a.attachment_id, src: a.file_path,
          thumb: a.thumb ? String(a.thumb).replace(/^.*\//, '') : null, w: a.w, h: a.h,
        }))
        setImages(list)
        const cv = d.images.find((a) => a.kind === 'banner')?.attachment_id || null
        setCover(cv)
        rebase(d.work.title || '', list, cv)
        setLoaded(true)
      })
      .catch((e) => { setErr(e.message); setLoaded(true) })
  }, [openSlug])

  /* 확인 띠가 붙을 자리와 기다림 표시 — 글 편집과 **같은 훅**을 쓴다(`wait.js`) */
  const headRef = useRef(null)
  const headH = useHeadH(headRef)
  const slow = useSlow(!loaded)

  const say = (t) => { setNote(t); setTimeout(() => setNote(''), 4000) }
  const fail = (e) => { setErr(e.message || String(e)); setTimeout(() => setErr(''), 6000) }

  /**
   * 번호를 먼저 받는다 — 사진은 `{번호}/` 폴더에 쌓이므로 올리기 전에 있어야 한다.
   *
   * **도는 약속에 붙는다.** 첫 배치가 번호를 받는 중에 또 끌어다 놓으면 둘 다 `no` 가
   * 비어 있어 번호를 두 번 받고, 폴더가 둘로 갈려 먼저 올린 것이 저장에서 사라진다.
   */
  const noRef = useRef(null)
  const ensureNo = () => {
    if (no) return Promise.resolve(no)
    if (!noRef.current) {
      noRef.current = api('/posts/reserve', { method: 'POST' })
        .then((d) => { setNo(String(d.no)); return String(d.no) })
        .catch((e) => { noRef.current = null; throw e })
    }
    return noRef.current
  }

  /**
   * 고른 파일을 올린다.
   *
   * ⚠ **아무 말 없이 끝나지 않는다.** 폴더를 끌어다 놓거나 그림이 아닌 것만 고르면
   *   목록이 0장이라 예전에는 성공도 실패도 안 말했다 — 누른 사람에게는 「눌렀는데 아무 일도
   *   안 일어남」으로 보인다(2026-09-18 사용자 지적). 걸러진 자리마다 까닭을 댄다.
   */
  const pick = async (files) => {
    const all = [...(files || [])]
    if (!all.length) return say('고른 것이 없습니다 — 그림 파일을 골라 주세요')
    const ok = all.filter((f) => ACCEPT.includes(f.type))
    if (!ok.length) {
      return fail(new Error(all.length === 1
        ? `${all[0].name || '그 파일'} 은 그림이 아닙니다 — JPG·PNG·GIF·WebP·AVIF 만 올라갑니다`
        : `${all.length}개 다 그림이 아닙니다 — JPG·PNG·GIF·WebP·AVIF 만 올라갑니다`))
    }
    const skipped = all.length - ok.length
    setErr(''); setBusy('upload')
    try {
      const n = await ensureNo()
      const { images: added, failed } = await uploadMood(ok, n, setUpl)
      if (added.length) setImages((list) => [...list, ...added])
      if (failed.length) fail(new Error(`${failed.length}장을 못 올렸습니다 — ${failed[0]}`))
      else if (added.length) {
        say(`${added.length}장을 올렸습니다 — 아직 저장하지 않았습니다`
          + (skipped ? ` (그림이 아닌 ${skipped}개는 건너뛰었습니다)` : ''))
      }
    } catch (e) { fail(e) } finally { setBusy(''); setUpl(null) }
  }

  /* 끌어서 순서 바꾸기. 라이브러리를 들이지 않는다 — 격자 한 겹에 쓰기엔 브라우저 것으로 충분하다 */
  const dragFrom = useRef(null)
  const drop = (to) => {
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null || from === to) return
    setImages((list) => {
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  /**
   * 저장 — **서버가 고친 결과를 받아 화면에 앉힌다.**
   *
   * 이 문은 말없이 셋을 고친다: 없는 대표를 첫 장으로, 파일이 없는 작은 판을 `null` 로,
   * 같은 그림을 한 장으로. 예전에는 보낸 값 그대로 「깨끗함」 도장을 찍어, 새로고침 전까지
   * 화면과 DB 가 다른 상태로 갈렸다(2026-09-18 사용자 지적). 이제 응답으로 갈아 끼우고,
   * **달라진 것이 있으면 말해 준다** — 조용히 고치면 다음에 또 같은 자리를 의심하게 된다.
   */
  /* 작업엔 초안이 없다 — 저장은 곧 발행이다. 예전엔 `publish` 를 인자로 받아 본문에도
     실었는데 서버가 그걸 안 읽어, 초안 단추를 되살리는 날 조용히 발행될 자리였다 */
  const save = async () => {
    setErr(''); setBusy('publish')
    try {
      const t = title.trim()
      if (!t) throw new Error('제목을 입력해 주세요')
      const sent = images
      const d = await api('/works', { method: 'POST', body: JSON.stringify({
        no, title: t, cover,
        images: images.map((im) => ({ id: im.id, thumb: im.thumb, w: im.w, h: im.h })),
      }) })
      const n = d.work.no
      setNo(n)
      setPubAt(d.work.published_at)
      /* 새 작업은 주소가 아직 `/works/new` 다 — 갈아 끼우지 않으면 새로고침에 빈 작업이 뜬다 */
      if (!openSlug) history.replaceState(null, '', workPath(n))

      /* 서버가 돌려준 목록이 정본이다. 경로는 화면이 짓는다(서버는 파일 이름만 다룬다) */
      const back = Array.isArray(d.images)
        ? d.images.map((im) => ({ ...im, src: `/blog/${n}/${im.id}` }))
        : sent
      const cv = d.cover ?? null
      setImages(back)
      setCover(cv)
      rebase(t, back, cv)

      if (d?.bakeError) throw new Error('저장은 됐지만 화면을 굽지 못했습니다: ' + d.bakeError)
      /* 고쳐진 자리를 한 줄로 — 여러 개면 제일 눈에 띄는 것 하나만 말한다 */
      const dropped = sent.length - back.length
      const lostThumb = back.some((im, i) => sent[i] && sent[i].thumb && !im.thumb)
      say(dropped > 0 ? `발행했습니다 — 같은 그림 ${dropped}장은 한 장으로 합쳤습니다`
        : cv !== cover ? '발행했습니다 — 대표가 없어 첫 장을 대표로 삼았습니다'
        : lostThumb ? '발행했습니다 — 작은 판이 없어 원본을 씁니다'
        : '발행했습니다')
      return true
    } catch (e) { fail(e); return false } finally { setBusy('') }
  }

  const toggleHidden = async () => {
    setErr(''); setBusy('vis')
    try {
      const d = await api(`/posts/${encodeURIComponent(no)}/visibility`,
        { method: 'POST', body: JSON.stringify({ hidden: !hidden }) })
      setHidden(d.post.hidden)
      say(d.post.hidden ? '공개면에서 내렸습니다' : '다시 올렸습니다')
    } catch (e) { fail(e) } finally { setBusy('') }
  }

  /* 공개 주소는 `site.config.mjs` 의 origin 에서 온다 — 관리자 주소에서 유추하지 않는다.
     관리자와 공개면이 포트로 갈릴 수도, 도메인으로 갈릴 수도 있어서다.
     ⚠ 포트폴리오가 「직접 디자인」이면 굽기가 작업 페이지를 **아예 안 만든다**(bake 의 wantWorks).
        그때 링크를 걸면 404 로 보낸다 — 링크 대신 까닭을 적는다(2026-09-18 사용자 지적) */
  const url = no && live ? postUrl(no, 'work') : null

  return (
    <div className="wf">
      <header className="peHead" ref={headRef} aria-busy={busy || !loaded ? 'true' : undefined}>
        <button type="button" className="peBtn peBack" onClick={onBack} title="목록으로" aria-label="목록으로">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="peStat" role={err ? 'alert' : 'status'}>
          {err ? <span className="peErr">{err}</span>
           : upl ? `올리는 중 ${upl.done}/${upl.total}`
           : note ? note
           : pubAt && (<>
               {hidden ? '내려둠' : live ? '발행됨' : '저장됨'}
               {!hidden && url && (
                 <a className="peSee" href={url} target="_blank" rel="noopener">작업 보기
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                 </a>
               )}
               {/* 안 나가는 동안에는 「발행됨」이 거짓말이다 — 목록 화면과 같은 말을 여기서도 한다 */}
               {!hidden && !live && <span className="wfOff">포트폴리오가 직접 디자인이라 사이트에는 아직 안 나갑니다</span>}
             </>)}
        </span>
        {pubAt && (
          <button type="button" className="peBtn" onClick={toggleHidden} disabled={!!busy}>
            {hidden ? '다시 올리기' : '내려두기'}
          </button>
        )}
        <button type="button" className="pePub peBtn" onClick={() => save()} disabled={!!busy || !loaded}
                data-busy={busy === 'publish' ? '' : undefined}>
          {busy === 'publish' ? '발행 중' : pubAt ? '고쳐서 발행' : '발행'}
        </button>
      </header>

      {leaving && (
        <div className="peAsk" style={{ top: headH }} role="alertdialog" aria-label="저장 안 한 변경이 있습니다">
          <span className="peAskMsg">저장 안 한 변경이 있습니다</span>
          <button type="button" className="peBtn" disabled={!!busy}
                  onClick={async () => { if (await save()) leaving.onLeave() }}>발행하고 나가기</button>
          <button type="button" className="peBtn" disabled={!!busy} onClick={leaving.onLeave}>그냥 나가기</button>
          <button type="button" className="peBtn pePub" autoFocus onClick={leaving.onStay}>머무르기</button>
        </div>
      )}

      {/* 기존 작업을 열 때 본문을 바로 그리면 「아직 없음 / 끌어다 놓으세요」 빈 상태가
          한 번 번쩍인 뒤 사진이 들어온다 — 글쓰기 화면과 같은 뼈대로 그 자리를 채운다.
          ⚠ 여기는 `.adm` **밖**이라 `.adm` 을 전제한 규칙은 안 걸린다. 제 클래스로만 건다 */}
      {!loaded ? (slow && (
        <div className="wfMain wfWait" aria-hidden="true">
          <span className="skb skb-h" />
          <span className="skb skb-p" />
          {/* 격자는 **진짜 `.wfGrid`** 를 쓴다 — 뼈대와 실물의 열 수가 같아야 자리가 안 튄다 */}
          <ul className="wfGrid">
            {[0, 1, 2, 3, 4, 5].map((i) => <li key={i} className="sk"><span className="skb" /></li>)}
          </ul>
        </div>
      )) : (
      /* ⚠ 끌어다 놓기는 **화면 전체**가 받는다. 예전에는 빈 자리(`.wfDrop`)에만 달려 있어,
         사진이 한 장이라도 있으면 끌어다 놓아도 아무 일이 안 일어났다 — 격자 위에 떨어뜨리면
         그건 「순서 바꾸기」로 읽히고 파일은 버려졌다(2026-09-18 하네스가 잡음).
         파일이 실린 끌기만 여기서 받고, 파일이 없는 끌기(타일 순서)는 그대로 지나가게 둔다 */
      <main className="wfMain"
            onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault() }}
            onDrop={(e) => {
              const files = [...e.dataTransfer.files]
              if (!files.length) return
              e.preventDefault()
              pick(files)
            }}>
        <input className="wfTitle" type="text" value={title} placeholder="작업 이름"
               onChange={(e) => setTitle(e.target.value)} />

        {/* 머리줄은 **할 수 있는 일만** 말한다. 빈 화면에서 「끌어서 순서를 바꿉니다 ·
             ★ 는 대표입니다」를 띄우면 아직 끌 것도 고를 대표도 없는 사람에게 설명서를
             읽히는 꼴이다(2026-09-18 사용자 지적). 게다가 대표는 이미 화면이 말한다 —
             검은 테두리와 「대표」 딱지. 남은 건 한 가지, 두 장부터 뜻이 생기는 순서다 */}
        <div className="wfBar">
          <span className="wfSum">
            {images.length > 0 && (
              <>
                {/* 개수는 늘 모노다 — 목록 카드의 곁말(`.fo-sub`)과 같은 글자 */}
                <span className="wfCnt">{images.length}장</span>
                {images.length > 1 && <span className="wfHint">끌어서 순서를 바꿉니다</span>}
              </>
            )}
          </span>
          {/* ⚠ 이 화면은 `.adm` **밖**이라(`main.jsx` 의 분기) `.adm button.primary` 가 안 걸려
               예전에는 운영체제 기본 단추가 떴다. 값을 여기 베끼는 대신 그 규칙의 **선택자에
               `.wf` 를 덧붙였다**(styles.css) — 베끼면 언젠가 두 단추가 갈라진다 */}
          <button type="button" className="primary" disabled={busy === 'upload'}
                  onClick={() => fileRef.current?.click()}>
            {busy === 'upload' ? '올리는 중' : '이미지 올리기'}
          </button>
          <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden
                 /* ⚠ **목록을 먼저 베껴 둔다.** `e.target.files` 는 칸을 따라다니는 살아 있는
                      목록이라, 아래에서 칸을 비우면 **그 목록도 비워진다** — `pick` 은 글 번호를
                      받아 오느라 한 박자 기다리므로, 그 사이에 0장이 되어 아무 일도 안 일어났다
                      (2026-09-18 사용자 지적: 작업 올리기가 안 먹던 것).
                      비우는 까닭은 같은 파일을 다시 골라도 `change` 가 나게 하려는 것이다 */
                 onChange={(e) => { const files = [...e.target.files]; e.target.value = ''; pick(files) }} />
        </div>

        {images.length === 0 ? (
          /* 빈 격자를 그리지 않는다 — 무엇을 해야 하는지 한 줄로 말한다 */
          <button type="button" className="wfDrop" onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  /* ⚠ 파일 칸과 **같은 함정**이다(위 `input` 머리말) — `dataTransfer` 는 이 행사가
                       끝나면 비워지고, `pick` 은 글 번호를 기다리느라 그 뒤에 목록을 읽는다.
                       베껴 두지 않으면 끌어다 놓기가 조용히 0장이 된다 */
                  onDrop={(e) => { e.preventDefault(); pick([...e.dataTransfer.files]) }}>
            완성된 이미지를 끌어다 놓거나 눌러서 고르세요
          </button>
        ) : (
          <ul className="wfGrid">
            {images.map((im, i) => (
              <li key={im.id} draggable
                  onDragStart={() => { dragFrom.current = i }}
                  onDragOver={(e) => e.preventDefault()}
                  /* 파일이 실려 왔으면 순서 바꾸기가 아니다 — 위(`wfMain`)가 받게 지나보낸다 */
                  onDrop={(e) => { if (e.dataTransfer.files.length) return; e.preventDefault(); drop(i) }}
                  data-cover={im.id === cover ? '' : undefined}>
                {/* ⚠ `thumb` 는 **경로가 아니라 파일 이름**이다(서버가 그 모양으로 받고 돌려준다).
                     그대로 `src` 에 넣으면 지금 주소 옆을 가리켜 **그림이 안 뜬다** — 큰 사진일수록
                     작은 판이 따로 생기므로 큰 것만 골라 안 보였다(2026-09-18 사용자 지적).
                     원본 경로의 마지막 칸만 갈아 끼운다(홈디자인의 같은 자리와 같은 셈) */}
                {/* 치수를 적어 둔다 — 그림이 들어오기 전에도 칸 높이가 잡혀 격자가 안 밀린다
                     (공개면 `workImage` 와 같은 까닭) */}
                <img src={im.thumb ? im.src.replace(/[^/]+$/, im.thumb) : im.src} alt=""
                     width={im.w || undefined} height={im.h || undefined} loading="lazy" />
                {/* 차례와 대표를 **한 자리에서** 읽는다. 대표를 글로 설명하는 대신
                     딱지로 붙인다 — 손가락으로 쓰면 별에 마우스를 올릴 수가 없다 */}
                <span className="wfMark">
                  <span className="wfNo">{i + 1}</span>
                  {im.id === cover && <span className="wfTag">대표</span>}
                </span>
                <span className="wfOps">
                  <button type="button" aria-pressed={im.id === cover}
                          title={im.id === cover ? '대표입니다' : '대표로 삼기'}
                          onClick={() => setCover(im.id)}><Star on={im.id === cover} /></button>
                  <button type="button" title="빼기" aria-label="빼기"
                          onClick={() => {
                            setImages((list) => list.filter((x) => x.id !== im.id))
                            if (cover === im.id) setCover(null)
                          }}><Cross /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
      )}
    </div>
  )
}
