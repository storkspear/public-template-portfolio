# 「모양」 화면의 미리보기 헤더.
#
# 관리자 쪽 다른 자리와 달리 `SAMEORIGIN` 입니다. 미리보기는 관리자 화면이 제 iframe
#   안에 끼워 보는 것이라, `DENY` 로 두면 관리자가 제 미리보기조차 띄우지 못합니다
#   (iframe 이 조용히 빈 채로 남고 `contentDocument` 가 null 이 됩니다).
#   다른 사이트가 끼우는 것은 `SAMEORIGIN` 이 그대로 막습니다.
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header X-Robots-Tag "noindex, nofollow" always;
