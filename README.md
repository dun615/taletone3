# TALETONE MUSIC 사이트

https://taletone.net — GitHub Pages로 배포되는 정적 사이트입니다.

## 주소 구조

| 언어 | 주소 |
| --- | --- |
| 한국어 | `/`, `/story-types/`, `/members/`, `/works/`, `/news/`, `/contact/` |
| English | `/en/…` (같은 6개 경로) |
| 日本語 | `/ja/…` (같은 6개 경로) |

작업물·소식은 항목마다 개별 페이지가 있습니다: `/works/<slug>/`, `/news/<slug>/` (영어·일본어는 앞에 `/en`, `/ja`).

예전 `?lang=en` 링크는 접속 시 `/en/…` 주소로 바뀝니다. 언어 접두사가 없는 주소로 들어오면 마지막으로 고른 언어를 이어서 보여 줍니다.

## 어디를 고치면 되나

| 바꾸고 싶은 것 | 편집할 파일 |
| --- | --- |
| 화면 구조·섹션 마크업·인라인 스타일 | `src/app/template.html` |
| 화면 동작: 상태·생명주기·메인 루프 | `src/app/component.js` |
| 화면 동작: 콘텐츠·인트로·배경·브릿지·경로/언어 | `src/app/parts/content.js`, `intro.js`, `scene.js`, `bridges.js`, `routing.js` |
| 사이트 공통 접근성(다이얼로그 포커스, 건너뛰기 링크, 모바일 챕터 메뉴) | `assets/js/site-ux.js` |
| 문구·멤버·뉴스·파트너 등 콘텐츠 | `assets/data/site-content.json` |
| 페이지별 SEO 제목·설명(언어별) | `assets/data/seo-content.json` |
| Works 목록 | `assets/data/works-data.json` |
| Works 화면 스타일·동작 | `assets/css/works.css`, `assets/js/works.js` |
| 모든 페이지 공통 `<head>`·뼈대 | `src/page.html` |
| 검색엔진용 `<noscript>` 본문 구성 | `scripts/build.mjs`의 `noscriptBody` |
| Works·News 개별 페이지 구성 | `scripts/build.mjs`의 `workPage`·`newsPage` |
| Works·News 개별 페이지 스타일 | `assets/css/detail.css` |

다음 파일은 **빌드가 만들어내는 결과물**입니다. 저장소에 커밋하지 않고(`.gitignore`), GitHub Actions가 push마다 빌드해서 배포합니다.

- 18개 페이지: `index.html`, `story-types/` 등 6개와 `en/`, `ja/` 아래 같은 6개씩
- `works/<slug>/`, `news/<slug>/` 개별 페이지(언어별)
- `assets/app/app.js`: 화면 구조와 동작 코드를 모든 페이지가 함께 쓰는 파일 하나로 묶은 것
- `assets/data/site-content.js`, `assets/data/seo-content.js`
- `sitemap.xml`

페이지의 메타 태그·hreflang·JSON-LD·`<noscript>` 본문은 위 데이터에서 언어별로 만들어집니다. 그래서 뉴스나 Works를 추가하고 빌드하면 검색엔진용 본문과 사이트맵도 같이 갱신됩니다. 데이터 파일의 캐시 버전(`?v=`)도 내용 해시로 자동으로 붙습니다.

작업물이나 소식을 추가할 때는 `slug`(주소에 쓰일 영문 소문자·숫자·하이픈, 예: `bubble-sweet`)를 꼭 넣어 주세요. 한 번 정한 slug는 바꾸지 않는 것이 좋습니다(주소가 바뀝니다).

한국어 폰트는 나눔고딕(400/700)입니다. 빌드가 사이트에 쓰인 한글만 모아 Google Fonts에 `text=`로 요청하므로, 글을 추가하고 빌드만 하면 폰트도 자동으로 맞춰집니다.

## 문의 메일 양식

`assets/data/site-content.json` → `contact`의 `mailSubject`·`mailTemplate`(언어별 `translations`)이 "프로젝트 문의하기" 메일에 미리 채워지고, `guideTitle`·`guideItems`가 문의 섹션의 안내 카드에 나옵니다.

## 방문 분석 (Cloudflare Web Analytics)

Cloudflare 대시보드 → Web Analytics에서 사이트(taletone.net)를 추가하고 받은 토큰을 `assets/data/seo-content.json` → `analytics.cloudflareToken`에 넣은 뒤 `npm run build` 하면 모든 페이지에 켜집니다. 비워 두면 꺼져 있습니다.

## 이미지·CSS 도구 (선택)

```bash
npm install
```

- `node scripts/optimize-assets.mjs webp --max=1024 <이미지...>`: JPEG/PNG 옆에 WebP를 만듭니다. 데이터 파일의 경로를 `.webp`로 바꾸고 원본은 지우면 됩니다.
- `node scripts/prune-css.mjs assets/css/works.css`: 뒤의 규칙에 덮여 적용되지 않는 선언을 찾습니다(`--write`로 정리).
- `CHROME_PATH=<브라우저> node scripts/measure-loudness.mjs [works-data.json...]`: 모든 음원의 Integrated LUFS(BS.1770)를 재서 -14 LUFS로 맞추는 게인값을 works-data의 `loudness`에 기록합니다. 음원 파일은 그대로 두고 Works 재생 때 이 값이 적용됩니다. 곡별로 귀로 맞춘 보정값은 `loudness.files[경로].trim`(dB)에 넣으면 다시 측정해도 유지되고 게인에 더해집니다. 음원을 추가·교체하면 다시 실행하세요(기본 대상: `preview-src/data/works-data.json`, npm install 불필요).

`support.js`는 템플릿 런타임입니다. 원래 Claude Design(dc-runtime)에서 생성됐지만 그 소스가 저장소에 없어서 여기서 직접 관리합니다. 사이트 전용 코드는 넣지 말고 `src/app/`에 두세요.

## 작업 순서

필요한 것: Node.js 24 이상 (의존성 설치 없음)

```bash
npm run build
```

소스를 고친 뒤 위 명령으로 로컬에서 결과물을 만들어 확인합니다. 커밋은 소스만 하면 되고, `main`에 push하면 `.github/workflows/deploy.yml`이 빌드·검사 후 GitHub Pages에 배포합니다. 배포된 커밋은 https://taletone.net/version.txt 에서 볼 수 있습니다.

```bash
npm run check
```

빌드한 뒤 사이트 검증 규칙을 통과하는지 확인합니다. GitHub Actions도 push마다 같은 검사와 브라우저 동작 검사를 합니다.

로컬에서 보려면 저장소 루트를 정적 서버로 띄웁니다(페이지가 `<base href="/">`를 쓰므로 파일을 바로 열면 안 됩니다).

```bash
npx serve .
```
