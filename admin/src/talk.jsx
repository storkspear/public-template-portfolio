import { useEffect, useState } from 'react'
import { api } from './api.js'

/**
 * 댓글 — 방문자가 글 아래에 남긴 것을 보고, 지우고, 되살립니다.
 *
 * 지우기는 소프트 딜리트입니다(행은 남고 지운 시각만 찍힘). 그래서 「삭제 댓글」 칸에서 언제든
 * 되살릴 수 있습니다. 누가 지웠는지도 남습니다 — 쓴 사람이 비밀번호로(작성자) / 여기서(관리자).
 * IP 는 화면과 같은 앞 두 자리뿐입니다. 서버는 원래 IP 를 저장하지 않습니다(server/talk.mjs).
 */
const SHOW = [['all', '전체 댓글'], ['live', '활성 댓글'], ['only', '삭제 댓글']]
const BY = { author: '작성자가 지움', admin: '관리자가 지움' }

const when = (iso) => {
  const d = new Date(iso)
  const p2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function Comments() {
  const [show, setShow] = useState('all')
  const [rows, setRows] = useState(null)
  const [anon, setAnon] = useState('익명의 누군가')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const load = () => {
    setErr('')
    api(`/comments?deleted=${show}`)
      .then((d) => { setRows(d.comments); if (d.anon) setAnon(d.anon) })
      .catch((e) => setErr(e.message))
  }
  useEffect(load, [show])

  const act = async (c, what) => {
    setBusy(c.id); setErr('')
    try { await api(`/comments/${c.id}/${what}`, { method: 'POST' }); load() }
    catch (e) { setErr(e.message) }
    finally { setBusy('') }
  }

  return (
    <div className="cmAdmin">
      <div className="head">
        <h2>댓글 {rows && <span className="cnt">{rows.length}</span>}</h2>
      </div>
      <div className="flt" role="group" aria-label="보기">
        {SHOW.map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={show === v} onClick={() => setShow(v)}>{label}</button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}
      {rows && rows.length === 0 && (
        <p className="empty">{show === 'only' ? '삭제한 댓글이 없습니다.' : '아직 댓글이 없습니다.'}</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="cmList">
          {rows.map((c) => (
            <li key={c.id} className="cmRow" data-deleted={c.deleted_at ? '' : undefined}>
              <div className="cmMeta">
                <b>{c.nickname || anon}</b>
                <span className="cmDim">{c.ip}</span>
                <span className="cmDim">{when(c.created_at)}</span>
                {c.deleted_at && <span className="cmTag">{BY[c.deleted_by] || '지움'} · {when(c.deleted_at)}</span>}
              </div>
              <p className="cmBody">{c.body}</p>
              <div className="cmFoot">
                <a className="cmPost" href={`/blog/${encodeURIComponent(c.slug)}/`} target="_blank" rel="noopener">
                  {c.no}. {c.title}</a>
                {c.deleted_at
                  ? <button type="button" disabled={busy === c.id} onClick={() => act(c, 'restore')}>되살리기</button>
                  : <button type="button" className="cmDel" disabled={busy === c.id} onClick={() => act(c, 'delete')}>지우기</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
