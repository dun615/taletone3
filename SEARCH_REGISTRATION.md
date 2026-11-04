# 검색엔진과 링크 미리보기 반영 절차

코드가 만드는 것(사이트맵, canonical, hreflang, 구조화 데이터, 소유 확인 태그, 링크 미리보기 이미지)과 별개로, 사이트 소유자 계정에서 해야 하는 작업을 기록합니다.

## 배포할 때마다
1. https://taletone.net/version.txt 에서 배포된 커밋을 확인합니다.

## 페이지 구성이나 문구가 크게 바뀌었을 때
1. Google Search Console(기존 taletone.net 속성): 사이트맵 https://taletone.net/sitemap.xml 을 제출하거나 확인하고, 아래 다섯 주소의 URL 검사에서 색인 생성을 요청합니다.
2. 네이버 서치어드바이저(기존 소유 확인 사이트): 같은 사이트맵을 제출하고, 아래 주소의 웹 페이지 수집을 요청합니다. 예전에 제출한 RSS가 남아 있으면 삭제합니다(RSS는 종료했습니다).
3. Bing Webmaster Tools: 같은 사이트맵을 제출합니다.
4. Google 리치 결과 테스트로 홈의 구조화 데이터(Organization, WebSite)를 확인합니다.

## 링크 미리보기 이미지가 바뀌었을 때
메신저와 SNS는 미리보기를 캐시하므로, 각 도구에서 다시 불러옵니다.
- 카카오톡: 카카오 개발자 사이트의 공유 디버거에서 캐시 초기화
- Facebook: Sharing Debugger
- LinkedIn: Post Inspector

## 주소
| 챕터 | URL |
| --- | --- |
| Home | https://taletone.net/ |
| About | https://taletone.net/about/ |
| Approach | https://taletone.net/approach/ |
| Discography | https://taletone.net/discography/ |
| Contact | https://taletone.net/contact/ |

영어는 /en/, 일본어는 /ja/ 접두사를 씁니다. 사이트맵에는 다섯 챕터의 세 언어 주소만 들어갑니다(총 15개).

## 종료하거나 옮긴 주소
- /members/ → /about/, /story-types/와 /projects/ → /approach/, /works/ → /discography/, /preview/… → 같은 챕터: canonical과 즉시 이동(meta refresh와 JavaScript)으로 옮깁니다. GitHub Pages는 서버 301을 설정할 수 없으므로 301이라고 표기하지 않습니다.
- 작품별 상세 페이지(/discography/<곡>/, /works/<곡>/), News, RSS: 종료했고 404로 응답합니다. 작품은 /discography/?work=<곡> 으로 열 수 있지만 색인 대상은 아닙니다.
- robots.txt는 아무것도 막지 않습니다. 크롤러가 옮긴 주소와 종료된 주소를 직접 확인할 수 있게 하기 위해서입니다.

공식 안내:
- Google 사이트맵: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google 재수집: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- Naver: https://searchadvisor.naver.com/doc/wmt_guide_ps_websearch.pdf
