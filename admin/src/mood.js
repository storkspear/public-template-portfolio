/**
 * 무드보드 올리기 — 디자이너가 완성된 그림을 여러 장 던져 넣는 자리.
 *
 * 글의 사진(`attachments.js`)과 다른 길입니다. 그쪽은 편집기 문서 안에 박힌 것을
 * 저장 직전에 한 번에 올리지만, 여기는 고르는 즉시 올립니다 — 격자에 바로 놓여야
 * 순서를 끌어 옮기고 대표를 고를 수 있기 때문입니다.
 *
 * 한 장마다 두 벌을 만듭니다.
 *   원본  긴 변 2000px 까지 (그보다 작으면 건드리지 않습니다)
 *   작은 판 긴 변 720px — 목록 격자가 이걸 씁니다.
 *
 * 작은 판이 없으면 방문자가 격자 한 화면에서 2000px 짜리 열두 장을 통째로 내려받습니다.
 * 서버에서 만들지 않는 이유: 그러려면 이미지 라이브러리를 서버에 들여야 하는데,
 * 브라우저는 이미 그 일을 할 줄 압니다(캔버스). 서버 의존성을 안 늘립니다.
 */
import { getToken, refresh, signalExpired } from './api.js'

const BIG = 2000
const SMALL = 720
/** 받아 주는 형식 — 서버의 `EXT` 표와 같아야 합니다(다르면 415 로 튕깁니다) */
export const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/avif'

/**
 * 긴 변을 `edge` 까지 줄인 WebP. 이미 작으면 원본 그대로 돌려줍니다 —
 * 작은 그림을 다시 굽는 건 화질만 깎고 얻는 게 없습니다.
 */
async function shrink(file, edge, quality) {
  const bmp = await createImageBitmap(file)
  const { width: w, height: h } = bmp
  const scale = Math.min(1, edge / Math.max(w, h))
  if (scale === 1 && file.size < 1.5e6) { bmp.close(); return { blob: file, w, h } }
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const cv = document.createElement('canvas')
  cv.width = cw; cv.height = ch
  cv.getContext('2d').drawImage(bmp, 0, 0, cw, ch)
  bmp.close()
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/webp', quality))
  /* 줄인 것이 원본보다 크면(작은 PNG 에서 흔합니다) 원본을 씁니다 */
  return blob && blob.size < file.size ? { blob, w: cw, h: ch } : { blob: file, w, h }
}

/**
 * 날바이트 한 덩이를 올립니다. `api()` 를 안 지나는 이유는 JSON 이 아니기 때문입니다 —
 * 그래서 401 재시도도 손으로 한 번 합니다(`attachments.js` 의 `put` 과 같은 규약).
 */
async function put(blob, no) {
  const send = () => fetch('/api/media', {
    method: 'POST',
    headers: { 'content-type': blob.type, 'x-post-no': String(no), authorization: 'Bearer ' + getToken() },
    body: blob,
  })
  let r = await send()
  if (r.status === 401 && await refresh()) r = await send()
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) { signalExpired(); throw new Error('로그인이 만료되었습니다') }
  if (!r.ok) throw new Error(d.error || `사진 올리기 실패 (${r.status})`)
  return d
}

/**
 * 파일 여러 장을 올립니다. 한 장이 실패해도 나머지는 올립니다 —
 * 열 장 중 하나가 형식이 틀렸다고 아홉 장을 버리면, 쓰는 사람은 무엇이 문제인지도 모른 채
 * 처음부터 다시 해야 합니다. 실패한 것만 이름을 모아 돌려줍니다.
 */
export async function uploadMood(files, no, onProgress) {
  const done = []
  const failed = []
  const total = files.length
  for (const [i, file] of [...files].entries()) {
    onProgress?.({ done: i, total, name: file.name })
    try {
      const big = await shrink(file, BIG, 0.92)
      const small = await shrink(file, SMALL, 0.86)
      const up = await put(big.blob, no)
      /**
       * 썸네일은 원본보다 작을 때만 따로 올립니다.
       *
       * 같은 Blob 이면(이미 작은 이미지) 올릴 것이 없고, 줄인 쪽이 더 크면(작은 PNG 에서
       * 흔합니다) shrink 가 원본을 돌려주므로 그것을 썸네일로 한 번 더 올리면 목록 카드가
       * 2000px 을 받습니다. 크기로 판정합니다. Blob 비교(===)만으로는 그 경우를 못 잡습니다.
       *
       * 썸네일만 실패해도 원본은 살립니다. 그 장 전체를 실패로 처리하면 이미 업로드된 원본이
       * 어느 목록에도 잡히지 않는 고아가 됩니다.
       */
      let thumb = null
      if (small.blob !== big.blob && small.blob.size < big.blob.size) {
        try { thumb = (await put(small.blob, no)).id } catch { thumb = null }
      }
      done.push({ id: up.id, src: up.path, thumb, w: big.w, h: big.h })
    } catch (e) {
      failed.push(`${file.name}: ${e.message || e}`)
    }
  }
  onProgress?.({ done: total, total, name: '' })
  return { images: done, failed }
}

/** 파비콘으로 올릴 수 있는 형식 — 서버의 `FAVICON_EXT` 와 같아야 합니다 */
export const FAVICON_ACCEPT = 'image/svg+xml,image/png,image/webp'

/**
 * 파비콘 한 장을 올립니다. `/api/media` 가 아니라 `/api/favicon` 입니다.
 *
 * 줄이지 않습니다. `shrink()` 는 캔버스로 다시 그리는데, SVG 를 그렇게 하면 래스터로 굳어
 * 어두운 탭에서 색을 뒤집는 `<style>` 이 통째로 사라집니다. 16px 에 뜨는 그림이라
 * 줄여서 얻을 것도 없습니다(서버 상한이 64KB 입니다).
 */
export async function uploadFavicon(file) {
  const send = () => fetch('/api/favicon', {
    method: 'POST',
    headers: { 'content-type': file.type, authorization: 'Bearer ' + getToken() },
    body: file,
  })
  let r = await send()
  if (r.status === 401 && await refresh()) r = await send()
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) { signalExpired(); throw new Error('로그인이 만료되었습니다') }
  if (!r.ok) throw new Error(d.error || `파비콘 올리기 실패 (${r.status})`)
  return d.path
}
