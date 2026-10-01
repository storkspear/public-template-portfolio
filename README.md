# template-portfolio-blog

정적 포트폴리오 + 글 쓰는 블로그. **방문자에게 JS 0바이트**로 나갑니다.

> English: [README.en.md](README.en.md)

코드 하이라이팅도, 다이어그램도, 글꼴도 **발행하는 순간 정적 HTML 로 구워집니다.**
읽는 사람의 브라우저는 스크립트를 한 줄도 받지 않습니다. 대신 글을 쓰는 화면은
제대로 된 편집기입니다 — 표, 코드, Mermaid·draw.io 다이어그램, 사진, 제목 배너까지.

---

## 필요한 것

- **Docker** — 이것만 있으면 됩니다
- (선택) Node 24 — 관리자 화면을 고칠 때만

## 시작

```bash
git clone https://github.com/storkspear/public-template-portfolio.git my-site
cd my-site
docker compose up -d --build
```

**이게 전부입니다.** Node 도, `npm install` 도, `.env` 도 필요 없습니다 —
관리자 화면은 이미지 안에서 구워지고, 설정은 기본값으로 뜹니다.
처음 뜰 때 스키마를 만들고, 계정을 심고, 예시 글 3편을 넣고, 한 번 구워 둡니다.

| | |
|---|---|
| **공개 화면** | <http://localhost:8080> — 누구나 봅니다 |
| **관리자** | <http://localhost:8081> — 나만 봅니다 |
| **기본 계정** | 아이디 `admin` · 비밀번호 `admin` |

> ⚠ **`admin`/`admin` 은 로컬 전용입니다.**
> `site.config.mjs` 의 `origin` 을 제 도메인으로 바꾸는 순간, 서버가 이 비밀번호로는
> **뜨지 않습니다.** 배포 전에 바꾸는 법은 아래 「배포」에 있습니다.

포트가 이미 쓰이고 있으면 한 번만:

```bash
cp .env.example .env     # 값을 바꾸고 싶을 때만 만듭니다
```

그리고 `.env` 에서 비키세요:

```
WEB_PORT=8088
ADMIN_PORT=8089
```

`.env` 는 **있으면 기본값을 덮어씁니다.** 비밀번호·DB 접속처럼 기계마다 다른 값이
가는 자리이고, git 에는 올라가지 않습니다.

끄기는 `docker compose down`. 글과 사진은 **남습니다**(이름 붙은 볼륨).
정말 비우려면 `docker compose down -v` — 되돌릴 수 없습니다.

---

## 내 사이트로 만들기

### 1. `site.config.mjs` — 한 파일

```js
export default {
  name: 'my-site',                    // DB 스키마·컨테이너 이름의 어근
  origin: 'http://localhost:8080',    // 배포하면 https://example.com
  siteTitle: 'HONG GILDONG',
  brand: '홍길동',
  description: '만들면서 걸린 것을 적어 둡니다.',
  copyright: 'HONG GILDONG',
  github: '',                         // 비우면 푸터에 GitHub 링크를 안 그립니다
  nav: [ … ],
}
```

여기 있는 값은 **발행된 글**(헤더·푸터·`<title>`·정규 URL)과 관리자 화면이 씁니다.

> ⚠ 이 파일을 고친 뒤에는 **`docker compose up -d --build`** 로 다시 올리세요.
> 관리자 화면의 「글 보기」 주소가 빌드할 때 박히기 때문에, `--build` 없이 재시작만 하면
> 옛 주소가 남습니다. (`npm run up` 이 `--build` 를 항상 붙입니다)

### 2. 첫 화면과 포트폴리오 — 두 가지 길

관리자의 **「홈디자인」** 에서 화면마다 고릅니다. `site.config.mjs` 는 안 고칩니다.

**직접 디자인 (기본) — 코드로 고칩니다**

`pages/main.html` 과 `pages/portfolio.html` 을 직접 엽니다. 이 파일들은 `<body>`
**안쪽만** 담습니다 — `<head>`·공통헤더·푸터는 굽기가 붙입니다. 빌드 단계가 없어서
고치고 「사이트에 반영」만 누르면 끝입니다. 지금 들어 있는 내용(홍길동, 가나다소프트…)은
**전부 예시**이고, 주석으로 어디를 고치는지 적어 뒀습니다.

통째로 비우면 **하얀 빈 대지**가 나옵니다. 거기서부터 쓰셔도 됩니다.

**샘플에서 시작하기.** 직접 디자인을 고르면 「사용할 파일」에 **내 파일**과 샘플 다섯 벌이
뜹니다(메인·포트폴리오 각각, `sample-pages/`). 샘플을 누르면 미리보기가 바뀌고, 「사이트에
반영」을 누르면 그 샘플이 그대로 나갑니다 — 파일은 복사하지 않고 **고른 이름만** 설정에 남습니다.
고쳐 쓰려면 `cp sample-pages/main2.html pages/main.html` 로 복사해 고친 뒤 「내 파일」을 고르세요.
샘플 파일 자체는 고치지 마세요(템플릿을 업데이트하면 바뀝니다).

**템플릿 — 관리자에서 고릅니다**

색·글꼴·헤더·섹션 순서·틀을 고르면 오른쪽에 바로 미리보기가 뜨고, 「사이트에 반영」을
누르면 굽기가 첫 화면과 작업 목록을 만듭니다. 포트폴리오를 템플릿으로 두면 **작업물**도
글처럼 관리자에서 씁니다(왼쪽 메뉴에 「포트폴리오」가 생깁니다).

| | 직접 디자인 | 템플릿 |
|---|---|---|
| 첫 화면 | `pages/main.html` | 관리자에서 고르고 굽기가 만듦 |
| 포트폴리오 | `pages/portfolio.html` | 작업물을 관리자에서 등록 |
| 고치는 사람 | 코드를 만지는 사람 | 누구나 |
| 되돌리기 | git | 「이전 판으로」 단추 |

두 화면이 **따로** 갈립니다 — 첫 화면은 손으로 쓰고 포트폴리오만 템플릿으로 둘 수 있습니다.

**공통헤더**는 그것과 별개로 화면마다 켜고 끕니다. 기본은 **블로그만 켬**입니다.

첫 화면은 제 이름을 크게 세우는 랜딩이라 헤더를 이지 않고, 포트폴리오는 조각이
**제 헤더를 갖습니다** — 가운데에 「절 바로 가기」가 들어가야 하는데 그건 그 화면에만
있는 링크라, 사이트 전체가 쓰는 공통헤더에는 자리가 없기 때문입니다.

> 조각이 제 `<header>` 를 갖고 있는데 공통헤더까지 켜면 머리가 둘이 됩니다.
> 굽기는 **막지 않고 경고만** 합니다 — 파일 이름을 대고 관리자에 귀띔이 뜹니다.
> 미리보기에 바로 보이고 스위치를 도로 끄면 되돌아가므로 눌러 보셔도 됩니다.


### 3. 푸터

화면 맨 아래의 띠입니다. 관리자 **「홈디자인 → 공통 → 푸터」**에서 꾸밉니다.

**두 벌**입니다 — 첫 화면은 연락이 목적지라 크고(기본 288px), 포트폴리오·블로그는
다 보고 난 자리라 얇습니다(52px). 위에서 어느 푸터를 고칠지 고르면 미리보기도
그 화면으로 갑니다.

| 무엇 | 어떻게 |
|---|---|
| 주소·전화·이메일·이름 | 글자 상자를 **끌어서** 놓습니다(첫 화면 콘텐츠 영역과 같은 판) |
| 서비스 링크 | `＋ 아이콘` — GitHub·Figma·네이버 블로그·티스토리·velog·인스타그램·유튜브·비핸스·노션·X |
| 그 밖의 서비스 | 「직접 입력」 — 로고 대신 **쓴 이름**이 그림이 됩니다 |
| 높이·본문과의 사이·윗선·배경색·글자색 | 슬라이더와 색 칸. 다시 굽지 않고 그 자리에서 바뀝니다 |

글자를 비워 두면 `site.config.mjs` 의 값이 나갑니다(이메일·저작권). 아이콘도 주소를
비우면 거기 적어 둔 GitHub 로 갑니다 — 갈 곳이 아예 없는 아이콘은 그리지 않습니다.

> **직접 디자인** 화면에는 이 푸터가 안 나갑니다. 조각(`pages/*.html`)이 제 푸터를
> 들고 오기 때문입니다 — 관리자가 그 자리에서 알려 줍니다.

### 4. favicon

`public/favicon.svg` 를 갈아 끼우면 됩니다.

---

## 글 쓰기

관리자(<http://localhost:8081>)에서 씁니다.

- **초안**과 **발행**이 다른 자리에 저장됩니다 — 초안은 아무도 못 봅니다
- 발행하면 그 자리에서 정적 HTML 로 구워져 공개 화면에 뜹니다
- 내리면(숨김) 페이지는 사라지고 **사진 원본은 남습니다** — 다시 올리면 그대로 살아납니다
- 사진은 글 번호별 폴더에 쌓입니다. 글을 지우면 사진까지 같이 지워집니다

### 글 주소

글은 **`/blog/{글 번호}/`**, 작업은 **`/portfolio/{번호}/`** 가 됩니다. 번호는 글을 만들 때
한 번 정해지고 바뀌지 않습니다.

**문자 주소(`/blog/my-post/`)는 지원하지 않습니다.** 한글 제목을 주소로 바꾸면
`%ED%95%9C…` 가 되고, 번호를 쓰면 올린 사진이 사는 폴더와 자리가 같아져 글 하나가
한 폴더에 모입니다. 글을 내리거나 지울 때 치울 자리도 하나입니다.

### 무엇이 구워지나

| | |
|---|---|
| 코드 블록 | 하이라이팅이 **발행 시점에** 계산돼 HTML 에 박힙니다 |
| 다이어그램 | Mermaid·draw.io 를 SVG 로 구워 넣습니다 |
| 제목 | 글꼴·크기·색·배너가 글의 일부로 저장됩니다 |
| 사진 | 원본 파일 + 본문의 `attachment://` 를 실제 주소로 |

---

## 배포

**한 대에 통째로** 올립니다. compose 가 공개 화면·관리자·DB 를 함께 띄웁니다.

```bash
# 1. 주소를 제 도메인으로
#    site.config.mjs 의 origin → https://example.com

# 2. 비밀번호와 토큰 비밀을 새로 (이걸 안 하면 서버가 뜨지 않습니다)
node -p "require('node:crypto').randomBytes(32).toString('base64url')"
#    결과를 .env 의 ADMIN_TOKEN_SECRET 에

docker compose up -d --build db api          # api 는 아직 거부합니다 — 정상입니다
docker compose exec api node server/set-password.mjs admin
#    .env 의 ADMIN_PASSWORD 는 비워 두세요

docker compose up -d --build
```

도메인과 TLS 는 각자 붙이세요. `docker/nginx.conf` 의 `server_name` 두 줄과 `listen` 만
고치면 됩니다 — **그 파일은 혼자 섭니다**(바깥 설정에 기대지 않습니다).

관리자 포트(8081)는 인터넷에 열지 마세요. 방화벽이나 VPN 뒤에 두거나,
nginx 앞에 인증을 한 겹 더 두는 편이 낫습니다.

---

## 관리자 UI 를 고칠 때

compose 를 다시 굽는 게 느리면:

```bash
docker compose up -d          # API·DB·공개 화면은 그대로 두고
npm install
npm run admin:dev             # http://localhost:5173
```

Vite 가 `/api`·`/blog`·`/assets` 를 compose 쪽으로 넘겨줍니다 — **진짜 API 와 진짜 사진**을
보면서 화면만 고칩니다. 다 고쳤으면 `npm run admin:build`.

---

## 검사

```bash
npm run check
```

| | |
|---|---|
| `check-public.mjs` | 공개 페이지에 JS 가 새지 않았는지, 8가지 |
| `check-summary.mjs` | 목록의 첫 문단을 뽑는 규칙이 안 깨졌는지, 18가지 |
| `check-contract.mjs` | 관리자와 굽기가 같은 이름·같은 값을 쓰는지, 5가지 |
| `check-bake.mjs` | 구운 HTML 이 기준과 바이트로 같은지 (아래 참고) |
| `check-fonts.mjs` | 실린 글꼴이 전부 **재배포해도 되는 것**인지, 7가지 |
| `check-routes.mjs` | 관리자 API 주소 목록이 그대로인지 |
| `check-refs.mjs` | JSX·CSS 가 없는 것을 가리키지 않는지 |

**처음 한 번은 `npm run golden:update` 를 돌리세요.** `check-bake` 는 「지금 굽기 결과」를
저장해 둔 기준과 바이트로 견주는데, 그 기준이 레포에 없습니다 — 사이트마다 설정이 달라
남의 기준은 쓸모가 없기 때문입니다. 한 번 돌려 **제 기준**을 만들어 두면, 그 뒤로는
코드를 고쳤을 때 화면이 뜻밖에 바뀌면 바로 잡아 줍니다.

발행할 때는 굽기가 **제 산출물을 스스로 봅니다** — 빠진 글, 안 풀린 첨부,
무너진 구조를 그 자리에서 잡습니다.

---

## 라이선스와 글꼴

- 코드: **MIT** ([LICENSE](LICENSE))
- 글꼴: 전부 **OFL** — 121벌 모두 npm 패키지에서 오고, 라이선스 전문이
  `public/fonts/licenses/` 에 같이 들어 있습니다. 자세한 것은 [CREDITS.md](CREDITS.md)

**글꼴을 더할 때는 CREDITS.md 를 먼저 읽으세요.** 「웹사이트 임베딩 가능」은
「파일을 재배포해도 된다」가 아닙니다. `npm run check:fonts` 가 걸러 줍니다.

---

## 구조

```
public/            공개되는 것 — 첫 화면·포트폴리오·CSS·글꼴
  assets/          site.css(직접 관리) · fonts.css·prose.css(vendor:sync 가 생성)
    templates/     pages:true 일 때 구운 화면이 쓰는 CSS
  fonts/           글꼴 + licenses/ (라이선스 전문)
admin/             관리자 SPA (React + @storkspear/post-editor-react)
shared/            관리자와 굽기가 **같이 쓰는** 어휘 — 색·글꼴·틀의 정의와 검사
server/            API + 굽기. 제 package.json 으로 도는 별개 구역
  vendor/          편집기에서 가져온 굽기용 조각 (vendor:sync 가 갱신)
  seed/            예시 글 — 처음 한 번만 심습니다
docker/            nginx.conf · api.Dockerfile · web.Dockerfile
sql/schema.sql     표 정의 (글·작업물·사이트 모양)
site.config.mjs    ★ 사이트 고유값 — pages 스위치가 여기
```

편집기 자체는 [`@storkspear/post-editor-react`](https://www.npmjs.com/package/@storkspear/post-editor-react)
로 npm 에 있습니다. 올라가면 `npm update` 로 받습니다.
