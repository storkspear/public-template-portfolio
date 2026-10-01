# 공개 화면 + 관리자 화면을 내주는 nginx.
#
# 관리자 SPA 를 여기서 굽습니다. 이미지 안에서 구우면 `docker compose up` 하나로 끝납니다.
#
# 호스트의 `admin/dist` 를 마운트하면 안 됩니다. 그 폴더는 `.gitignore` 에 있어
#   클론 직후에는 없고, 도커가 빈 폴더를 만들어 마운트해 관리자 화면이 403 이 납니다.
#
# 공개 화면(`public/`)은 마운트 그대로 둡니다 — HTML 을 고치고 새로고침하면 바로
# 보여야 하기 때문입니다. 굽는 단계가 없는 정적 파일이라 이미지에 넣을 값어치가 없습니다.

FROM node:24-alpine AS build
WORKDIR /app

# 의존성 먼저 — 코드만 고쳤을 때 이 층이 캐시에서 나옵니다.
COPY package.json package-lock.json* ./
COPY admin/package.json ./admin/
RUN npm ci 2>/dev/null || npm i

# `admin/vite.config.js` 가 `../site.config.mjs` 를 읽습니다.
# 그래서 site.config.mjs 의 `origin` 을 바꾸면 이미지를 다시 구워야 합니다
#   (`docker compose up -d --build`). 관리자의 「글 보기」 주소가 거기서 박힙니다.
# 관리자 화면이 레포 위쪽에서 가져오는 것 둘 — 빠뜨리면 `vite build` 가 죽습니다.
#   site.config.mjs      「글 보기」 주소·사이트 이름
#   shared/site-vocab.mjs 「모양」 화면과 굽기가 같이 쓰는 어휘(색·글꼴·틀)
COPY site.config.mjs ./
COPY shared/ ./shared/
COPY admin/ ./admin/
RUN npm run admin:build

FROM nginx:alpine
COPY --from=build /app/admin/dist /srv/admin
