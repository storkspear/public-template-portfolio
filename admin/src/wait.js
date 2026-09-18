/**
 * 기다림을 다루는 두 훅 — **글 편집과 작업 편집이 같이 쓴다.**
 *
 * 두 화면이 같은 껍데기(`.peHead` + 나가기 확인 띠)를 쓰면서 이 둘을 각자 베껴 두면
 * 언젠가 갈라진다 — 실제로 작업 편집에는 `aria-busy` 가 빠져 **러너가 평생 안 떴고**,
 * 확인 띠의 자리는 `56` 이 박혀 있어 실제 머리줄(52px)과 4px 어긋나 있었다
 * (2026-09-18). 한 곳에 두고 둘이 부른다.
 */
import { useEffect, useState } from 'react'

/**
 * `on` 이 `ms` 를 **넘게** 이어질 때만 true.
 *
 * 테일넷 안이라 응답이 보통 100ms 안쪽이다. 기다림 표시를 즉시 띄우면 **번쩍하고 사라져**
 * 없느니만 못하다 — 늦을 때만 말한다.
 */
export function useSlow(on, ms = 200) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!on) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(id)
  }, [on, ms])
  return slow
}

/**
 * 머리줄의 **실제** 높이 — 밑에 붙는 것(툴바·확인 띠)이 이 값을 쓴다.
 * 숫자를 박으면 머리줄이 커지는 날 어긋난다.
 *
 * ⚠ 머리줄은 **조건 밖**에 있어야 한다. 불러오는 동안 `return` 으로 통째로 막으면
 *   머리줄이 DOM 에 없는 채로 이 효과가 한 번 돌고 끝나 값이 0 으로 남는다.
 */
export function useHeadH(ref) {
  const [h, setH] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const put = () => setH(Math.round(el.getBoundingClientRect().height))
    put()
    const ro = new ResizeObserver(put)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return h
}
