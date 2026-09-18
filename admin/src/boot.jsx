/* 진짜 진입점. 부트스트랩을 갈라 두면 미리보기 하네스가 App 까지 같이 띄우지 않는다. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@storkspear/post-editor-core/styles.css'
import '@storkspear/post-editor-core/fonts.css'
import '@storkspear/post-editor-react/styles.css'
import './styles.css'
import './attachments.js'   // 사진 저장소를 꽂는다 — 안 꽂으면 넣는 순간 던진다
import './fonts.js'         // 이 레포가 제 글꼴을 더하는 자리 — 기본은 비어 있다
import { App } from './main.jsx'

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
