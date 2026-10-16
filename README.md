# TALETONE MUSIC 사이트

https://taletone.net — GitHub Pages로 배포되는 정적 사이트입니다.

## 어디를 고치면 되나

| 바꾸고 싶은 것 | 편집할 파일 |
| --- | --- |
| 화면 구조·섹션 마크업·인라인 스타일 | `src/app/template.html` |
| 화면 동작(스크롤, 챕터 전환, 언어 전환 등) | `src/app/component.js` |
| 문구·멤버·뉴스·파트너 등 콘텐츠 | `assets/data/site-content.json` |
| 페이지별 SEO 제목·설명 | `assets/data/seo-content.json` |
| Works 목록 | `assets/data/works-data.json` |
| Works 화면 스타일·동작 | `assets/css/works.css`, `assets/js/works.js` |
| 페이지별 `<head>`(메타·OG·JSON-LD)와 `<noscript>` | 각 페이지의 `index.html` |

다음 파일은 **빌드가 만들어내는 결과물**이라 직접 고치지 않습니다.

- 6개 페이지(`index.html`, `story-types/`, `members/`, `works/`, `news/`, `contact/`) 안의 base64 블록 두 개
- `assets/data/site-content.js`, `assets/data/seo-content.js`

`support.js`는 Claude Design에서 내보낸 런타임(dc-runtime)이며 역시 직접 고치지 않습니다.

## 작업 순서

필요한 것: Node.js 24 이상 (의존성 설치 없음)

```bash
npm run build
```

소스를 고친 뒤 위 명령으로 결과물을 다시 만들고, 소스와 결과물을 함께 커밋합니다.

```bash
npm run check
```

결과물이 소스와 맞는지, 사이트 검증 규칙을 통과하는지 확인합니다. GitHub Actions도 push마다 같은 검사를 합니다.

로컬에서 보려면 저장소 루트를 정적 서버로 띄웁니다(페이지가 `<base href="/">`를 쓰므로 파일을 바로 열면 안 됩니다).

```bash
npx serve .
```
