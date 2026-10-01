/**
 * 홈디자인 화면이 쓰는 입력 부품들.
 *
 * look.jsx 에서 떼어냈습니다. 그 파일은 상태·효과·JSX 를 다 들고 있어서, 부품 정의가
 * 섞여 있으면 무엇이 화면이고 무엇이 도구인지 구별하기 어렵습니다.
 * 여기 있는 것은 전부 상태를 밖에서 받는 순수 부품입니다.
 */
import { useState } from 'react'
import { Picker } from '@storkspear/post-editor-react/PickMenu'
import { fontItems } from '@storkspear/post-editor-react/pickItems'
import { ITEM_LINKS, SERVICE_ICONS, ICON_OF, isExternal } from '../../shared/site-vocab.mjs'
import { MENU_ICONS } from '../../shared/menu-icons.mjs'

/** 정렬 여섯 가지. stage 기준이고 아이콘은 Figma 의 정렬 버튼과 같은 형태입니다 */
export const ALIGN_OPS = [
  { how: 'left', label: '왼쪽 맞춤', d: 'M3 2v12M6 5h8v2H6zM6 9h5v2H6z' },
  { how: 'center', label: '가로 가운데 맞춤', d: 'M8 2v12M3 5h10v2H3zM5 9h6v2H5z' },
  { how: 'right', label: '오른쪽 맞춤', d: 'M13 2v12M2 5h8v2H2zM5 9h5v2H5z' },
  { how: 'top', label: '위 맞춤', d: 'M2 3h12M5 6v8h2V6zM9 6v5h2V6z' },
  { how: 'middle', label: '세로 가운데 맞춤', d: 'M2 8h12M5 3v10h2V3zM9 5v6h2V5z' },
  { how: 'bottom', label: '아래 맞춤', d: 'M2 13h12M5 2v8h2V2zM9 5v5h2V5z' },
]

/**
 * 레이아웃 썸네일. 어휘가 [x, y, w, h, 진하기] 로 갖고 있는 값을 SVG 로 렌더링합니다.
 * 「표지 한 장」처럼 글로 적는 것보다 도형 하나가 빠르게 이해됩니다.
 */
/** 「내 파일」 카드의 썸네일. 종이 한 장에 코드 줄 */
export const MINE_ICON = [[0,0,24,18,2],[2,2.2,5,1.2,1],[4,5,12,1.2,0],[4,7.6,9,1.2,0],[4,10.2,14,1.2,0],[2,13,5,1.2,1]]

export const Shape = ({ cells, vh = 20 }) => (
  <svg className="lkShape" viewBox={`-1 -1 26 ${vh}`} style={{ aspectRatio: `26 / ${vh}` }} aria-hidden="true">
    {cells.map(([x, y, w, h, tone], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="0.6" data-tone={tone} />
    ))}
  </svg>
)


/**
 * 글꼴 입력 필드. 편집기의 Picker(버튼 + 메뉴)를 그대로 씁니다.
 * 첫 항목 「기본서체」(빈 값)는 이 화면에서 사이트 기본값을 따른다는 뜻입니다.
 * 버튼에도 선택한 글꼴로 이름을 표시합니다. 목록은 렌더링할 때마다 조회합니다.
 * 사이트 글꼴이 configureFonts 로 나중에 추가될 수 있습니다.
 */
export const FontPick = ({ label, value, onPick }) => (
  <div className="lkField lkFontField">
    <span>{label}</span>
    <Picker title={label} className="lkPicker" width={220} items={fontItems()} value={value}
            style={{ fontFamily: value || undefined }} onPick={onPick} />
  </div>
)

/**
 * 숫자 입력 필드. 입력하는 동안은 draft 상태만 갖고 있다가 Enter 또는 blur 때 한 번 반영합니다.
 *
 * 입력할 때마다 반영하면, W 에 300 을 입력하는 동안 첫 글자 3 이 하한 20 으로 보정되어
 * 20 → 200 → 2000 → 1240 으로 튑니다. X, Y 는 글자마다 요소가 이동하고 되돌리기 기록도
 * 글자 수만큼 쌓입니다.
 *
 * ↑↓ 는 즉시 반영합니다(1, Shift 10). 한 번에 한 단계라 draft 가 필요 없습니다.
 * Esc 는 draft 를 버립니다.
 */
export const NumField = ({ label, value, onCommit }) => {
  const [draft, setDraft] = useState(null)
  const parsed = () => (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft)) ? Number(draft) : null)
  const commit = () => {
    const n = parsed()
    setDraft(null)
    if (n !== null && n !== value) onCommit(n)
  }
  return (
    <label className="lkNum">
      <span>{label}</span>
      <input type="text" inputMode="numeric" value={draft ?? String(value)}
             onFocus={(e) => e.target.select()}
             onChange={(e) => setDraft(e.target.value)}
             onBlur={commit}
             onKeyDown={(e) => {
               if (e.key === 'Enter') { e.preventDefault(); commit(); return }
               if (e.key === 'Escape') { e.preventDefault(); setDraft(null); return }
               if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
               e.preventDefault()
               const base = parsed() ?? value
               setDraft(null)
               onCommit(base + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))
             }} />
    </label>
  )
}

/**
 * 선택지 두세 개 중 하나를 고르는 버튼 그룹. 이 화면에서 가장 많이 쓰는 컴포넌트입니다.
 * 어휘가 icon 을 갖고 있으면 템플릿 카드처럼 레이아웃 썸네일을 같이 렌더링합니다.
 * 「헤더」와 「사이드 바」는 글보다 그림으로 빠르게 구별됩니다.
 */
export const Pick = ({ list, value, onPick, two }) => (
  <div className={'lkPick' + (two ? ' lkTwo' : '') + (list.length === 3 ? ' lkThree' : '')
                  + (list.some((o) => o.icon) ? ' lkShapes' : '')}>
    {list.map((o) => (
      <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onPick(o.value)}>
        {o.icon && <Shape cells={o.icon} vh={o.iconH} />}
        <b>{o.label}</b>{o.hint && <em>{o.hint}</em>}
      </button>
    ))}
  </div>
)

/**
 * 색 입력 필드. 일곱 군데(헤더 배경·헤더 글자색·메뉴 글자색·메뉴 배경·콘텐츠 배경·
 * 콘텐츠 글자색·요소 색)가 같은 모양을 씁니다.
 *
 * 되돌리기 버튼이 둘인 것은 뜻이 다르기 때문입니다. 같은 모양으로 표시하되 동작이 다릅니다.
 *   ↺   마지막으로 사이트에 반영한 색으로 되돌립니다. 반영본과 다를 때만 표시됩니다
 *   글자 값을 비워서 상위 색을 따르게 합니다. 값을 지정했을 때만 표시됩니다.
 *        상위 색으로 돌아가는 유일한 경로라서 없애면 되돌릴 방법이 사라집니다
 *
 * shown 은 표시 전용 색입니다. 값이 비어 있으면 따르고 있는 색을 보여 주고,
 * 사용자가 조작하는 순간 그 색으로 고정됩니다.
 */
export const ColorField = ({ id, label, value, shown, applied, onPick, followLabel, disabled, hint }) => (
  <div className="lkColor">
    <label htmlFor={id}>{label}</label>
    {/* 되돌리기 버튼 둘을 같은 줄에 둡니다. 「따르기」만 아래로 내리면 필드마다 높이가 달라지고,
         이 줄(.lkRow)이 align-items:flex-end 라서 라벨이 어긋납니다.
         한 줄에 두면 필드 높이가 항상 같아서 줄이 맞습니다 */}
    <span className="lkColorRow">
      <input id={id} type="color" value={shown} disabled={disabled}
             onChange={(e) => onPick(e.target.value)} />
      {/* 못 쓰는 자리에서는 색값 대신 까닭을 적습니다 — 흐린 색칸만 있으면 왜 안 되는지 모릅니다 */}
      <output>{disabled ? hint : shown}</output>
      {!disabled && applied !== undefined && applied !== value && (
        <button type="button" className="lkColorBack" aria-label={`${label} 적용된 색으로`}
                title="마지막으로 사이트에 적용한 색으로 되돌립니다"
                onClick={() => onPick(applied)}>↺</button>
      )}
      {!disabled && followLabel && value && (
        <button type="button" className="lkReset" onClick={() => onPick('')}>{followLabel}</button>
      )}
    </span>
  </div>
)


/**
 * 요소 목록의 이름 칸 — 그 자리에서 글자를 고칩니다.
 *
 * 예전에는 목록에서 고른 뒤 아래 판의 글상자로 내려가 고쳤습니다. 같은 글을 두 자리에서
 * 보여 주면서 고치는 곳은 하나라 어디를 만져야 하는지가 안 보였습니다.
 *
 * 치는 동안은 초안만 듭니다(숫자 칸 `NumField` 와 같은 규약): Enter 나 ✓ 로 반영,
 * Esc 로 버리기, 칸을 벗어나면 반영. 글자마다 반영하면 되돌리기 기록이 글자 수만큼 쌓이고
 * 미리보기가 타자마다 다시 렌더링됩니다.
 */
export const ItemName = ({ value, placeholder, icon, onFocus, onCommit }) => {
  const [draft, setDraft] = useState(null)
  const dirty = draft !== null && draft !== value
  const commit = () => { const v = draft; setDraft(null); if (v !== null && v !== value) onCommit(v) }
  return (
    <span className="lkItemName lkItemEdit">
      <i aria-hidden="true">{icon}</i>
      <input className="lkItemText" type="text" value={draft ?? value} placeholder={placeholder} aria-label="글자"
             onFocus={onFocus} onChange={(e) => setDraft(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') { e.preventDefault(); commit() }
               if (e.key === 'Escape') { e.preventDefault(); setDraft(null); e.currentTarget.blur() }
             }}
             onBlur={commit} />
      {/* ✓ 는 고친 뒤에만 뜹니다 — 늘 서 있으면 줄마다 단추가 하나씩 더 있는 꼴입니다.
           `onMouseDown` 을 막는 까닭: 안 막으면 칸이 먼저 흐려지며 blur 가 반영해 버려 ✓ 가 사라집니다 */}
      {dirty && (
        <button type="button" className="lkItemOk" title="적용(Enter)" aria-label="글자 적용"
                onMouseDown={(e) => e.preventDefault()} onClick={commit}>✓</button>
      )}
    </span>
  )
}

/**
 * 「선택한 요소」 판 — 무대와 푸터가 같이 씁니다. 피그마의 오른쪽 칸처럼 숫자로 고칩니다.
 *
 * 두 판이 같은 부품(`.m-board`·`.m-i`)을 쓰므로 고치는 칸도 하나여야 합니다 — 갈라 두면
 * 한쪽에만 고친 것이 다른 쪽에 안 오고, 같은 화면에서 두 결이 섭니다.
 *
 * 아이콘 줄은 글꼴·크기 칸 대신 서비스·주소를 듭니다: 로고는 글자가 아니라 도형이고,
 * 색은 푸터 글자색을 따릅니다. 「직접 입력」만 이름 칸을 갖습니다 — 그 이름이 곧 그림이기 때문입니다.
 */
export const SelPanel = ({ sel, item, defaults, sizes, applied, icons, href, off, onPatch, onAlign, onNum, onClose }) => {
  const isIcon = item.kind === 'icon'
  const svc = isIcon ? SERVICE_ICONS.find((x) => x.value === item.service) : null
  const named = isIcon && item.service === 'link'
  /* 화면에 안 나가는 요소 — 빈 글자 상자뿐입니다(아이콘은 주소가 없어도 표시됩니다) */
  const gone = !isIcon && !(String(item.text || '').trim() || defaults[item.id])
  return (
    <div className="lkSel" aria-label="선택한 요소">
      <div className="lkSelHead">
        {/* 이름 칸이 곧 글자 칸입니다 — 보여 주기만 했더니 목록에서 고른 상자의 말을
             미리보기에서 두 번 누르지 않고는 못 고쳤습니다.
             `text` 는 `shape` 에 없습니다: 다시 굽지 않고 편집기가 창에 바로 입힙니다.
             로고 아이콘은 글자를 표시하지 않습니다 — 칸 대신 무엇인지만 적습니다 */}
        {/* 글자는 위 목록 줄에서 고칩니다 — 여기서는 무엇을 고르고 있는지만 보입니다.
             같은 글을 두 자리에서 고치게 두지 않습니다 */}
        {isIcon && !named ? (
          <span className="lkSelIcon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON_OF[item.service] || ''} /></svg>
            {svc?.label || '아이콘'}
          </span>
        ) : (
          <span className="lkSelName">{String(item.text || '').trim() || defaults[item.id] || '빈 글자'}</span>
        )}
        <button type="button" className="lkSelX" onClick={onClose} aria-label="선택 해제">×</button>
      </div>
      {/* 정렬은 그려진 것의 크기를 재서 맞춥니다 — 화면에 없는 요소에는 잴 것이 없습니다 */}
      {!off && (
        <div className="lkAlign" role="group" aria-label="판 기준 정렬">
          {ALIGN_OPS.map((a) => (
            <button key={a.how} type="button" title={a.label} aria-label={a.label} onClick={() => onAlign(a.how)}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d={a.d} /></svg>
            </button>
          ))}
        </div>
      )}
      {gone && (
        <p className="lkHint warn">글자가 비어 화면에 안 나옵니다 — 위 칸에 글자를 넣으면 나타납니다</p>
      )}
      <div className="lkNumRow">
        {[['x', 'X'], ['y', 'Y'], ['w', isIcon ? '크기' : 'W']].map(([k, label]) => (
          <NumField key={`${sel.key}-${k}`} label={label} value={sel[k]} onCommit={(n) => onNum(k, n)} />
        ))}
        {/* 높이는 그려진 것을 잰 값입니다 — 화면에 없으면 잴 것이 없어 칸도 안 냅니다 */}
        {!off && (
          <span className="lkNum is-auto" title={isIcon && !named ? '아이콘은 정사각입니다' : '글자 양이 정합니다'}>
            <span>H</span><output>{sel.h}</output>
          </span>
        )}
      </div>
      {isIcon ? (<>
        <div className="lkRow">
          <div className="lkField"><span>서비스</span>
            <Picker title="서비스" className="lkPicker" width={200} value={item.service}
                    items={icons.map((i) => ({ value: i.value, label: i.label }))}
                    onPick={(v) => onPatch({ service: v })} />
          </div>
        </div>
        <div className="lkRow">
          <label className="lkField"><span>주소</span>
            <input type="url" value={item.url || ''} placeholder={svc?.hint ? `https://${svc.hint}` : 'https://…'}
                   onChange={(e) => onPatch({ url: e.target.value })} />
          </label>
        </div>
        {!item.url?.trim() && href && (
          <p className="lkHint">비워 두면 사이트에 적어 둔 곳으로 갑니다 — <b>{href}</b></p>
        )}
        {/* 주소가 아예 없을 때 — 아이콘은 그려지되 링크가 아니다(누르면 귀띔만 뜹니다) */}
        {!item.url?.trim() && !href && (
          <p className="lkHint">주소가 없어 눌러도 안 움직입니다 — 화면에서는 「링크 연결 주소 없음」이 뜹니다</p>
        )}
        {/* 쓰다 만 주소 — 저장하면 조용히 비워집니다(굽기가 안 겁니다). 그 전에 말해 줍니다 */}
        {!!item.url?.trim() && !isExternal(item.url) && (
          <p className="lkHint warn">아직 주소가 아닙니다 — <b>https://</b> 로 시작해야 저장됩니다</p>
        )}
      </>) : (<>
        <div className="lkRow">
          <label className="lkField"><span>크기</span>
            <select value={item.size} onChange={(e) => onPatch({ size: e.target.value })}>
              {sizes.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </label>
          <label className="lkField"><span>URL 연결</span>
            {/* 피커는 「직접 입력」을 보이지만 저장되는 것은 주소 그 자체입니다 */}
            <select value={isExternal(item.link) || item.link === 'https://' ? 'custom' : item.link}
                    onChange={(e) => onPatch({
                      link: e.target.value === 'custom' ? (isExternal(item.link) ? item.link : 'https://') : e.target.value,
                    })}>
              {ITEM_LINKS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>
        {(isExternal(item.link) || item.link === 'https://') && (
          <div className="lkRow">
            <label className="lkField"><span>주소</span>
              <input type="url" value={item.link} placeholder="https://example.com"
                     onChange={(e) => onPatch({ link: e.target.value })} />
            </label>
          </div>
        )}
        <div className="lkRow">
          <label className="lkField"><span>글꼴</span>
            <select value={item.font} onChange={(e) => onPatch({ font: e.target.value })}>
              <option value="">기본 서체</option>
              {fontItems().filter((f) => f.value).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <ColorField id="lk-item-color" label="색" value={item.color}
                      shown={item.color || '#111111'} followLabel="기본 서체색 따르기"
                      applied={applied} onPick={(v) => onPatch({ color: v })} />
        </div>
      </>)}
      <p className="lkSelTip">{isIcon
        ? '자리는 끌어서 옮기고, Alt 를 누르고 끌면 안내선에 붙지 않습니다 · 로고는 두 번 눌러도 글자가 안 열립니다'
        : '글자는 위 목록에서, 또는 미리보기에서 두 번 눌러 고칩니다 · 자리는 끌어서 옮기고, Alt 를 누르고 끌면 안내선에 붙지 않습니다'}</p>
    </div>
  )
}

/** 「사이트에 반영」 버튼 아이콘. 완료를 뜻하는 체크 표시 */
export const IconApply = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12.5l5.5 5.5L20 6.5" />
  </svg>
)
/** 사진 추가 아이콘. 사진 프레임에 더하기 표시. [T](글자 추가) 옆에 같은 크기로 배치됩니다 */
export const IconPic = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8.5" />
    <path d="M3 15l4-4 4.5 4.5" />
    <circle cx="14.5" cy="8.5" r="1.4" />
    <path d="M18 16.5v5M15.5 19h5" />
  </svg>
)
/** 되돌리기 아이콘. 왼쪽으로 도는 화살표 */
export const IconUndo = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9h11a6 6 0 1 1 0 12H8" /><path d="M7 5L3 9l4 4" />
  </svg>
)


/**
 * 메뉴 아이콘. bake.mjs 의 iconSvg 와 같은 SVG 속성을 씌웁니다.
 * 한쪽만 수정하면 관리자에서 본 것과 사이트에 출력된 것이 달라집니다.
 */
export const MenuIcon = ({ value }) => {
  const i = MENU_ICONS.find((x) => x.value === value)
  if (!i) return null
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: i.body }} />
}
/* path 는 tools/sync-menu-icons.mjs 가 허용 목록으로 걸러 생성한 것이라 임의 문자열이
   섞일 수 없습니다. 외부 입력이 아니므로 dangerouslySetInnerHTML 이 안전합니다 */
export const iconLabel = (v) => MENU_ICONS.find((x) => x.value === v)?.label || '아이콘 없음'
