# 검색엔진 반영 절차

이 문서는 코드 설정과 별개인 계정 측 작업을 기록합니다. 아직 운영 배포나 검색엔진 제출을 실행한 것은 아닙니다.

1. 수정 커밋 배포 후 /version.txt와 운영 HTML을 확인합니다.
2. Google Search Console의 기존 taletone.net 속성에서 사이트맵 https://taletone.net/sitemap.xml 을 제출/확인합니다. URL 검사에서 아래 5개 주소의 게시된 URL 테스트와 색인 생성 요청을 실행합니다.
3. 네이버 서치어드바이저의 기존 소유확인 사이트에서 요청 → 사이트맵 제출에 같은 주소를 넣고, 아래 주소의 웹페이지 수집을 요청합니다. 이전 RSS 제출이 남아 있으면 삭제합니다. RSS 대체 제출은 하지 않습니다.
4. 기존 News 주소는 대체 페이지 없이 종료했으므로 404로 응답합니다. sitemap과 내부 링크에서 제외했고 robots.txt로 차단하지 않아 크롤러가 삭제 사실을 확인할 수 있습니다. Google/Naver의 기존 뉴스 검색 노출은 재수집 후 갱신되며 즉시 사라진다고 보장하지 않습니다.
5. 도메인은 같으므로 별도 사이트 신규 등록이나 소유권 토큰 재발급을 가정하지 않습니다. HTML의 기존 Naver/Bing 확인 값도 유지했습니다.

| 챕터 | URL |
| --- | --- |
| Home | https://taletone.net/ |
| About | https://taletone.net/about/ |
| Approach | https://taletone.net/approach/ |
| Discography | https://taletone.net/discography/ |
| Contact | https://taletone.net/contact/ |

영어는 /en, 일본어는 /ja 접두사를 사용합니다. 사이트맵에는 5개 챕터의 3개 언어 주소만 포함합니다(총 15개). 개별 곡 상세 페이지는 사이트에서 계속 열리지만 사이트맵에서는 제외합니다.

공식 안내:
- Google: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google 재수집: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- Naver: https://searchadvisor.naver.com/doc/wmt_guide_ps_websearch.pdf

URL 이전: /members/ → /about/, /story-types/ 및 /projects/ → /approach/, /works/ 및 상세 경로 → /discography/ 및 같은 슬러그. 구 주소는 사이트맵에서 제외합니다. 현재 GitHub Pages의 정적 호스팅에서는 HTTP 301/308 규칙을 설정할 수 없어 canonical과 즉시 HTML(meta refresh)·JavaScript 이동을 함께 생성합니다. 서버 301 응답이라고 표기하지 않습니다.
