# 이 템플릿이 함께 배포하는 것

## 글꼴

`public/fonts/` 의 121벌은 전부 npm 패키지에서 왔고, 각 패키지가 함께 낸
라이선스 전문이 `public/fonts/licenses/` 에 그대로 들어 있습니다. 표는 자동 생성이 아니라
손으로 갱신합니다 — `node tools/check-fonts.mjs` 가 빠진 것을 잡습니다.

| 패키지 | 버전 | 라이선스 | 파일 | 전문 |
|---|---|---|---|---|
| `@fontsource/black-han-sans` | 5.3.0 | OFL-1.1 | 2벌 | [`fontsource_black-han-sans.txt`](public/fonts/licenses/fontsource_black-han-sans.txt) |
| `@fontsource/gaegu` | 5.3.0 | OFL-1.1 | 2벌 | [`fontsource_gaegu.txt`](public/fonts/licenses/fontsource_gaegu.txt) |
| `@fontsource/gowun-batang` | 5.3.0 | OFL-1.1 | 3벌 | [`fontsource_gowun-batang.txt`](public/fonts/licenses/fontsource_gowun-batang.txt) |
| `@fontsource/gowun-dodum` | 5.3.0 | OFL-1.1 | 2벌 | [`fontsource_gowun-dodum.txt`](public/fonts/licenses/fontsource_gowun-dodum.txt) |
| `@fontsource/jetbrains-mono` | 5.3.0 | OFL-1.1 | 2벌 | [`fontsource_jetbrains-mono.txt`](public/fonts/licenses/fontsource_jetbrains-mono.txt) |
| `@fontsource/nanum-brush-script` | 5.3.0 | OFL-1.1 | 2벌 | [`fontsource_nanum-brush-script.txt`](public/fonts/licenses/fontsource_nanum-brush-script.txt) |
| `@fontsource/nanum-gothic` | 5.3.0 | OFL-1.1 | 3벌 | [`fontsource_nanum-gothic.txt`](public/fonts/licenses/fontsource_nanum-gothic.txt) |
| `@fontsource/nanum-gothic-coding` | 5.3.0 | OFL-1.1 | 3벌 | [`fontsource_nanum-gothic-coding.txt`](public/fonts/licenses/fontsource_nanum-gothic-coding.txt) |
| `@fontsource/nanum-myeongjo` | 5.3.0 | OFL-1.1 | 3벌 | [`fontsource_nanum-myeongjo.txt`](public/fonts/licenses/fontsource_nanum-myeongjo.txt) |
| `@fontsource/nanum-pen-script` | 5.3.0 | OFL-1.1 | 2벌 | [`fontsource_nanum-pen-script.txt`](public/fonts/licenses/fontsource_nanum-pen-script.txt) |
| `@fontsource/noto-sans-kr` | 5.3.0 | OFL-1.1 | 3벌 | [`fontsource_noto-sans-kr.txt`](public/fonts/licenses/fontsource_noto-sans-kr.txt) |
| `@fontsource/noto-serif-kr` | 5.3.0 | OFL-1.1 | 2벌 | [`fontsource_noto-serif-kr.txt`](public/fonts/licenses/fontsource_noto-serif-kr.txt) |
| `pretendard` | 1.3.9 | OFL-1.1 | 92벌 | [`pretendard.txt`](public/fonts/licenses/pretendard.txt) |

### 글꼴을 더할 때

**npm 패키지에서만 가져오세요.** 손으로 내려받은 파일은 출처를 적을 수 없어
`tools/check-fonts.mjs` 에서 걸립니다. 넣는 법은 `public/assets/fonts.local.css` 에 적혀 있습니다.

넣기 전에 두 가지를 보세요.

1. **라이선스 전문이 패키지 안에 있는가.** 「웹사이트에 임베딩 가능」은 「파일을 재배포해도 된다」가
   아닙니다. OFL 2조는 전문이 글꼴과 함께 가기를 요구합니다.
2. **저작권 줄에 `with Reserved Font Name` 이 있는가.** 있다면 원본을 고친 것(서브셋·포맷 변환 포함)은
   그 이름을 쓸 수 없습니다(OFL 3조). 저작권자가 직접 낸 파일이라면 괜찮습니다.

실제로 걸린 적이 있습니다 — npm `d2coding` 은 `with Reserved Font Name D2Coding` 인 글꼴을
제3자가 서브셋해 올린 것인데 라이선스 전문이 없었습니다. 나눔고딕코딩으로 바꿨습니다.

### 출처를 밝혀야 하는 글꼴

지금은 없습니다. OFL 은 출처 표기를 의무로 걸지 않습니다(전문 동봉만 요구합니다).
다만 「○○체」처럼 제작사가 표기를 요구하는 글꼴을 더한다면 여기에 적으세요 —
`tools/check-public.mjs` 가 그 의무를 강제합니다.

## 샘플 디자인 그림

`public/assets/sample-pages/fluent/` 의 PNG 25장(`sample-pages/*.html` 이 씁니다)은
[Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 의 3D 그림입니다 — **MIT**.
전문은 같은 폴더의 `LICENSE.txt` 입니다. 샘플을 안 쓰면 폴더째 지워도 됩니다.

## 메뉴 아이콘

`shared/menu-icons.mjs` 의 도형 쉰여섯 벌은 [Lucide](https://lucide.dev) (**ISC**)에서
`npm run menu-icons:sync` 로 가져옵니다. 피커를 위해 네 그룹으로 묶어 뒀습니다 —
기본 18 · 포트폴리오 14 · 블로그 14 · 이력 10. 갈래는 **찾기 쉬우라고** 나눈 것이라
어느 갈래의 아이콘이든 어느 메뉴 항목에나 걸 수 있습니다.

> 푸터 아이콘과 **다른 세트**입니다. 이쪽은 상표가 아니라 뜻을 가리키는 UI 픽토그램(집·봉투·별…)
> 이라, 어느 메뉴 항목에 걸어도 됩니다. 모양을 고쳐 쓰는 것도 ISC 가 허락합니다.
> 선 그림이라 `currentColor`·굵기 2 를 그대로 따릅니다 — 메뉴 글자색과 오버가 같이 먹습니다.

## 파비콘

`public/assets/favicons/` 의 **스무 벌**입니다. 브라우저 탭에 뜨는 그림이고, 관리자의
「공통 → 설정」에서 고릅니다. `npm run favicons:sync` 가 굽습니다.

출처가 셋으로 갈립니다.

| | 몇 벌 | 어디서 |
|---|---|---|
| 손으로 그린 것 | 2 (새싹·황새) | 이 레포가 직접 그렸습니다. 도구가 **안 건드립니다** |
| 메뉴 아이콘과 같은 그림 | 8 | 위 「메뉴 아이콘」과 같은 Lucide 도형을 씁니다 |
| Lucide 에서 직접 | 10 | 메뉴에 없는 것들(`server`·`library`·`bot` 등) |

뒤의 둘은 [Lucide](https://lucide.dev) (**ISC**)입니다. 파일마다 머리에 판번호를 박아 두므로
어느 판에서 왔는지 그 파일을 열면 나옵니다. 도형만 꺼내는 검사(`tools/lucide.mjs` 의
`bodyOf`)는 메뉴 아이콘 도구와 **같은 한 벌**을 씁니다 — 보안 검사라 복사해 두면 한쪽만
고쳐지는 날이 옵니다.

## 푸터 아이콘

`shared/site-icons.mjs` 의 도형 열 벌은 [simple-icons](https://github.com/simple-icons/simple-icons) (**CC0**)에서
`npm run icons:sync` 로 가져옵니다. 「직접 입력」의 사슬 하나는 이 레포가 그렸습니다(MIT).

> ⚠ **도형이 CC0 인 것과 상표는 다릅니다.** GitHub·Figma·네이버·티스토리·velog·인스타그램·유튜브·
> 비핸스·노션·X 는 각 회사의 상표입니다. 이 템플릿은 **그 서비스로 가는 링크**에만, 모양과 비율을
> 그대로(단색) 씁니다. 로고를 고치거나 다른 그림과 합치지 마세요. 자기 서비스를 가리키는 용도가
> 아니라면 「직접 입력」으로 글자 링크를 쓰세요.
>
> LinkedIn 은 상표권자의 요청으로 simple-icons 에서 빠졌습니다 — 목록에 없습니다.

## 그 밖에

- 코드: MIT (`LICENSE`)
- 글 편집기: [`@storkspear/post-editor-core`](https://www.npmjs.com/package/@storkspear/post-editor-core) ·
  [`@storkspear/post-editor-react`](https://www.npmjs.com/package/@storkspear/post-editor-react) — MIT

