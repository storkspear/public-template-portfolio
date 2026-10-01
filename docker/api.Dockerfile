# 관리자 API + 굽기.
#
# 관리자 화면(admin/dist)은 여기 안 들어갑니다 — 그건 nginx 가 호스트의 폴더에서
# 바로 줍니다. 그래야 UI 를 고칠 때 `npm run admin:build` 한 번이면 되고,
# 이미지를 다시 굽지 않아도 됩니다.
FROM node:24-alpine

WORKDIR /app

# ── 의존성 먼저 ──────────────────────────────────────────────
# 코드보다 먼저 복사해야, 코드만 고쳤을 때 이 층이 캐시에서 나옵니다.
COPY server/package.json server/package-lock.json* ./server/
# lock 이 있으면 `npm ci`(정확히 그 버전), 없으면 `npm i`.
RUN cd server && (npm ci --omit=dev 2>/dev/null || npm i --omit=dev)

# ── 코드 ────────────────────────────────────────────────────
# 굽기가 실제로 읽는 것만 넣습니다. public/ 과 admin/ 은 nginx 몫입니다.
COPY server/ ./server/
COPY sql/ ./sql/
COPY site.config.mjs site.fonts.mjs ./
COPY shared/ ./shared/
# 「직접 디자인」 화면의 본문 조각 — 굽기가 이걸 읽어 껍데기에 싣습니다
COPY pages/ ./pages/
# 관리자에서 고를 수 있는 샘플 조각 — 「사용할 파일」에서 고르면 pages/ 대신 이걸 읽습니다
COPY sample-pages/ ./sample-pages/

# 구운 HTML 과 사진이 사는 곳. compose 가 여기에 이름 붙은 볼륨을 겁니다.
RUN mkdir -p /data/blog /data/trash

# root 로 돌지 않습니다. node 이미지가 주는 계정을 씁니다.
RUN chown -R node:node /app /data
USER node

# nginx 가 다른 컨테이너라 루프백으로는 못 닿습니다. 대신 이 포트를 밖으로
# 열지 않으므로 compose 망 안에서만 닿습니다 — admin-api.mjs 의 HOST 주석 참고.
ENV HOST=0.0.0.0
EXPOSE 8090

# 부팅 순서(비밀번호 검사 → 마이그레이션 → 예시 글 → 서버)는 start.mjs 안에 있습니다.
CMD ["node", "server/start.mjs"]
