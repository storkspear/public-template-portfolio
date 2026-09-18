# public-template-portfolio

포트폴리오 + 블로그 템플릿. **방문자에게 JS 0바이트**로 나갑니다.

글을 쓰는 화면은 제대로 된 편집기(표·코드·다이어그램·사진)지만, 발행하는 순간
**정적 HTML 로 구워집니다.** 읽는 사람의 브라우저는 스크립트를 한 줄도 받지 않습니다.

> 자세한 설명은 [README.en.md](README.en.md) (English) 에 더 길게 있습니다.

---

## 1. 띄우기

**Docker 만 있으면 됩니다.**

```bash
git clone https://github.com/storkspear/public-template-portfolio.git my-site
cd my-site
docker compose up -d --build
```

| | |
|---|---|
| **공개 화면** | <http://localhost:8080> |
| **관리자** | <http://localhost:8081> |
| **기본 계정** | 아이디 `admin` · 비밀번호 `admin` |

처음 뜰 때 데이터베이스를 만들고, 계정을 심고, 예시 글 3편을 넣고, 한 번 구워 둡니다.
`npm install` 도 `.env` 도 필요 없습니다.

포트가 겹치면 `.env.example` 을 `.env` 로 복사해 `WEB_PORT`·`ADMIN_PORT` 를 바꾸세요.

끄기는 `docker compose down`. 글과 사진은 남습니다 — 정말 비우려면 `docker compose down -v`.

## 2. 내 것으로 바꾸기

**`site.config.mjs` 한 파일**에 이름·주소·연락처가 다 있습니다.

```js
brand: '홍길동',                          // 머리줄에 서는 이름
origin: 'http://localhost:8080',          // 배포할 도메인
email: 'hello@example.com',               // 푸터의 큰 연락처 줄
github: 'https://github.com/hong-gildong', // 푸터 아이콘이 갈 곳
```

나머지 생김새는 전부 **관리자 「홈디자인」**에서 고릅니다 — 코드를 안 만집니다.

| 갈피 | 무엇 |
|---|---|
| **공통** | 메뉴 자리·모양 · 헤더 · 본문 폭·색·글꼴 · **푸터** |
| **메인** | 첫 화면 — 템플릿을 고르거나 직접 디자인 |
| **포트폴리오** | 작업 목록 판짜기(칸 수·비율·간격) |
| **블로그** | 글 목록 판짜기 |

고른 것은 바로 옆 미리보기에 뜨고, **「사이트에 적용」**을 눌러야 공개 화면으로 나갑니다.
잘못 눌렀으면 **「되돌리기」**로 직전 판으로 돌아갑니다.

### 첫 화면·포트폴리오는 두 가지 길

| | 직접 디자인 | 템플릿 |
|---|---|---|
| 어떻게 | `pages/main.html`·`pages/portfolio.html` 을 손으로 씀 | 관리자에서 고름 |
| 누가 | 코드를 만지는 사람 | 누구나 |
| 되돌리기 | git | 「되돌리기」 단추 |

직접 디자인은 **견본 다섯 벌**(`sample-pages/`)이 들어 있어 관리자에서 골라 바로 쓸 수 있습니다.

### 푸터

화면 맨 아래 띠. 관리자 **「공통 → 푸터」**에서 **메인용(큰 것)**과
**포트폴리오·블로그용(얇은 것)** 두 벌을 따로 꾸밉니다.

- 연락처·주소 같은 글자 상자를 **끌어서** 놓습니다
- GitHub·Figma·인스타그램 등 **서비스 아이콘**을 더하고 주소를 겁니다
- 높이·간격·윗선·배경색·글자색은 미끄럼자와 색 칸으로

## 3. 글 쓰기

관리자 → **블로그** → 「새 글」. 표·코드·인용·사진·Mermaid/draw.io 다이어그램을 넣을 수 있고,
**발행**을 누르면 그 자리에서 정적 HTML 로 구워집니다.

작업물(포트폴리오)은 관리자 → **포트폴리오**에서 등록합니다.

## 4. 배포

```bash
# 1. site.config.mjs 의 origin 을 제 도메인으로
# 2. 비밀번호와 토큰 비밀을 새로 (안 하면 서버가 뜨지 않습니다)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
#    결과를 .env 의 ADMIN_TOKEN_SECRET 에
docker compose run --rm api node server/set-password.mjs <아이디>
# 3. docker compose up -d --build
```

`admin`/`admin` 은 로컬 전용입니다 — 도메인을 바꾸는 순간 그 비밀번호로는 서버가 뜨지 않습니다.

## 5. 라이선스

이 레포의 코드는 [MIT](LICENSE) 입니다.

글꼴·아이콘·예시 그림은 **각자의 라이선스**를 따릅니다 — [CREDITS.md](CREDITS.md) 에
어디서 왔고 무엇을 지켜야 하는지 적어 두었습니다. 배포 전에 한 번 읽어 주세요.
