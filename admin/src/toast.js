/**
 * 알림 토스트 — 목록·홈디자인·작업 편집이 같은 것을 씁니다.
 *
 * 화면 구석에 잠깐 표시되고, 마우스를 올리거나 초점이 오면 시계를 멈춥니다.
 * 읽는 중에 사라지면 안 됩니다(WCAG 2.2.1).
 *
 * 패널 안에 끼워 넣지 않는 이유는, 줄 위에 글자를 한 줄 더하면 아래가 통째로 밀려서
 * 정작 보여 줘야 할 내용이 더 안 보이기 때문입니다.
 */
import { useEffect, useRef, useState } from 'react'

/** 5초 — 권고 범위(3~8초)의 가운데. 3초는 긴 문장을 못 읽습니다 */
const NOTE_MS = 5000
/** 오류는 더 오래 둡니다. 무엇을 잘못했는지 읽고 고쳐야 합니다 */
const ERR_MS = 8000

export function useToast({ noteMs = NOTE_MS, errMs = ERR_MS } = {}) {
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const noteTimer = useRef(null)
  const errTimer = useRef(null)

  /* 올려 두거나 초점이 오면 시계를 멈춥니다 */
  const hold = () => clearTimeout(noteTimer.current)
  const release = () => { hold(); noteTimer.current = setTimeout(() => setNote(''), noteMs) }
  const say = (t) => { setNote(t); release() }
  const fail = (e) => {
    setErr(e?.message || String(e))
    clearTimeout(errTimer.current)
    errTimer.current = setTimeout(() => setErr(''), errMs)
  }
  useEffect(() => () => { clearTimeout(noteTimer.current); clearTimeout(errTimer.current) }, [])

  return { note, setNote, err, setErr, say, fail, hold, release }
}
