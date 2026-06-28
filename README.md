# 뉴스 대시보드

![Status](https://img.shields.io/badge/status-MVP_ready-0f766e)
![Hosting](https://img.shields.io/badge/hosting-Vercel-111827)
![Database](https://img.shields.io/badge/database-Google_Sheets-34A853)
![Cost](https://img.shields.io/badge/fixed_cost-minimized-0f766e)
![Access](https://img.shields.io/badge/access-admin%20%2F%20viewer-47515e)

서울환경연합의 언론 보도와 사회적 확산 근거를 아카이빙하는 대시보드입니다.
Vercel에 화면을 올리고, Google Sheets를 DB처럼 쓰는 저비용 운영 방식을 기본으로 합니다.

## 배포 URL

- [https://news-phi-cyan.vercel.app](https://news-phi-cyan.vercel.app)

## Google Sheets DB

- [뉴스 대시보드 DB](https://docs.google.com/spreadsheets/d/1t3FZq0Wjzu6_Bb9Kg4ZIXwbCXV73G-S_DQIyRTQZNuU/edit)
- Apps Script 웹앱을 통해 대시보드에서 `items`, `keywords`, `programs`, `matches`, `fetch_runs` 탭을 읽고 씁니다.
- 쓰기 작업은 사무처 내부 공유 관리자 비밀번호가 필요하며, 비밀번호는 저장소에 커밋하지 않습니다.

## 현재 구현

- 시티트리클럽 검증 기사 7건 기본 데이터
- 2026년 1월 1일 이후 기사 기준
- 서울환경연합 홈페이지, 서울시공익활동지원센터 등 비언론사 출처는 보도 횟수에서 제외
- 같은 언론사 안의 같은 기사만 중복 의심 처리
- 관리자 비밀번호 로그인 / 보기 전용 공유 링크
- 사업계획서 Google Docs 링크, PDF, DOCX 업로드
- 사업계획서 사업명 발췌와 사업별 기사 분류
- 캠페인명 검색어 자동 생성
- 검색어 추가, 활성화, 비활성화
- 기사 후보 수동 수집
- 기사/게시물 수동 추가
- 사업 분류, 기사 품질, 집계 포함, 대표 기사, 검토 상태 관리
- 일반 JSON 내보내기
- Google Sheets 탭 구조에 맞춘 JSON 내보내기
- Google Sheets 저장/불러오기
- Google Apps Script 연결 코드
- Vercel 정적 배포 설정

## 실행

브라우저에서 `index.html`을 열면 바로 볼 수 있습니다.

검증 스크립트:

```bash
npm run validate
```

시티트리클럽 기사 후보 재수집:

```bash
npm run collect:citytreeclub
```

## 운영 명세

| 항목 | 내용 |
| --- | --- |
| 화면 | Vercel 정적 사이트 |
| 저장소 | Google Sheets |
| 쓰기 연결 | Google Apps Script 웹앱 |
| 정기 수집 | 오전 1회, 저녁 1회 |
| 권한 | 관리자 비밀번호, 보기 전용 링크 |
| 기본 조직명 | 서울환경연합, 서울환경운동연합 |
| 자동 검색어 | 사업계획서의 고유 캠페인명 |
| 기본 사업 분류 | 생태도시, 기후행동, 자원순환, 시민참여, 모금, 기타 |
| 보도 횟수 기준 | 언론사 기사만 포함 |
| 중복 기준 | 같은 언론사 안의 같은 기사만 중복 의심 |
| 기사 품질 | 상, 중, 하, 미분류 |

자세한 명세는 [뉴스 대시보드 명세](./docs/technical-spec.md)에 정리했습니다.

## Google Sheets 구조

Google Sheets는 아래 탭을 사용합니다.

| 탭 | 용도 |
| --- | --- |
| `users` | 사용자 권한 |
| `plans` | 연도별 사업계획서 스냅샷 |
| `programs` | 사업 단위 |
| `keywords` | 검색어와 캠페인명 |
| `items` | 기사와 외부 게시물 |
| `matches` | 기사와 사업의 연결 |
| `fetch_runs` | 수집 실행 기록 |

스키마 원본은 [data/sheets-schema.json](./data/sheets-schema.json)에 있습니다.

## 배포 메모

1. Google Sheets를 만들고 `data/sheets-schema.json`의 탭을 생성합니다.
2. `apps-script/Code.gs`를 Google Apps Script에 붙여넣고 웹앱으로 배포합니다.
3. `config.js`의 `googleSheetUrl`, `appsScriptEndpoint`를 채웁니다.
4. Vercel에서 이 저장소를 연결해 정적 사이트로 배포합니다.

## 문서

- [뉴스 대시보드 명세](./docs/technical-spec.md)
- [Vercel + Google Sheets Product Plan](./docs/vercel-google-sheets-product-plan.md)
- [RSS News Archive Dashboard Plan](./docs/news-dashboard-plan.md)
- [Codex Impact Canvas Plan](./PLAN.md)
- [Article Discovery Notes](./docs/article-discovery.md)
