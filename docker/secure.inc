# 공개 화면의 보안 헤더.
#
# ⚠ 왜 파일로 빼서 location 마다 include 하나:
#   nginx 의 `add_header` 는 **상속되지 않습니다.** location 안에 `add_header` 가 하나라도
#   있으면(캐시 헤더 등) 상위 server 블록의 add_header 가 통째로 무시됩니다.
#   그래서 헤더를 한 곳에 적고 필요한 자리마다 불러 씁니다.
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
