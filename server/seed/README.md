# 예시 글

여기 있는 `*.json` 을 `server/seed-posts.mjs` 가 **처음 한 번만** 심습니다.
「한 번」은 `site_settings` 의 `seeded` 표식으로 기억합니다 — **지운 글은 다시 나타나지 않습니다.**

로컬(`site.config.mjs` 의 `origin` 이 localhost)에서만 돕니다. 배포본에는 안 심습니다.

예시 글이 아예 필요 없으면 이 폴더의 `.json` 을 지우고 `docker compose up -d --build` 하세요.
이미 심어진 글은 관리자에서 지우면 됩니다.

## 한 파일의 모양

```json
{
  "title": "첫 글",
  "width": "narrow",
  "body": "<p>발행본이 되는 HTML 입니다.</p>",
  "doc": { "type": "doc", "content": [ … ] },
  "title_doc": { "type": "doc", "content": [ … ] }
}
```

**`slug` 는 적지 않습니다.** 주소는 글 번호로 정해집니다(`/blog/{번호}/`) — 서버가 저장할 때
`slug = no` 로 못 박기 때문입니다. 파일에 slug 를 적으면 심기가 거부합니다.

| | |
|---|---|
| `title` | **필수.** 나머지는 없어도 됩니다 |
| `body` | 발행본이 되는 HTML. 없으면 **빈 글**이 발행됩니다 |
| `doc` | 편집기가 다시 열 때 쓰는 정본. 없으면 `body` 를 파싱해서 엽니다 |
| `title_doc` | 제목의 글꼴·크기·색·배너 |
| `width` | 가운데폭/전체폭 |

## 만드는 법

**손으로 쓰지 마세요.** 관리자에서 글을 하나 쓰고 발행한 뒤,
`GET /api/posts/{번호}` 의 응답에서 그대로 옮기는 편이 정확합니다 —
여기 있는 셋도 그렇게 만들었습니다.
