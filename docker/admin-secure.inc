# 관리자 화면의 보안 헤더 — 공개 쪽보다 조입니다.
#   X-Frame-Options DENY   어디에도 iframe 으로 못 넣습니다(클릭재킹)
#   X-Robots-Tag noindex   검색엔진에 관리자 주소가 색인되지 않게
# include 로 빼 둔 이유는 `secure.inc` 주석 참고(add_header 는 상속되지 않습니다).
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header X-Robots-Tag "noindex, nofollow" always;
