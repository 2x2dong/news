# RSS News Archive Dashboard Plan

## 1. Summary

현재 Google Alerts RSS 3개를 잔디로 전달하고 있지만, 뉴스가 장기적으로 아카이빙되지 않고 다시 찾기 어렵다. 이 프로젝트는 RSS 뉴스를 자동 수집하고, 분류하고, Google Workspace 기반 업무 흐름과 연결하며, Vercel에서 운영 가능한 뉴스 대시보드 서비스를 만드는 것을 목표로 한다.

초기 서비스는 다음 문제를 해결한다.

- RSS 뉴스가 사라지지 않도록 데이터베이스에 저장한다.
- 플라스틱방앗간, 서울환경연합, 서울환경운동연합 관련 뉴스를 한 화면에서 확인한다.
- 뉴스별 상태, 태그, 중요도, 확인 여부를 관리한다.
- 추후 검색 키워드와 RSS 피드를 직접 추가, 수정, 비활성화할 수 있다.
- Google Workspace 계정으로 로그인하고, 필요한 경우 Google Sheets 또는 Drive로 내보낼 수 있다.

## 2. Initial RSS Feeds

| 이름 | RSS URL | 초기 분류 |
| --- | --- | --- |
| 플라스틱방앗간 | https://www.google.co.kr/alerts/feeds/07320246445657269169/14597099664661338411 | 조직/브랜드 모니터링 |
| 서울환경연합 | https://www.google.co.kr/alerts/feeds/07320246445657269169/4811661847787299065 | 조직/이슈 모니터링 |
| 서울환경운동연합 | https://www.google.co.kr/alerts/feeds/07320246445657269169/4811661847787299514 | 조직/이슈 모니터링 |

## 3. Product Goals

1. 뉴스 수집을 자동화해 수동 확인 비용을 줄인다.
2. 확인한 뉴스를 다시 검색, 필터링, 회고할 수 있는 내부 아카이브를 만든다.
3. 향후 검색 키워드와 RSS 피드를 운영자가 직접 관리할 수 있게 한다.
4. Google Workspace 기반 계정, 공유, 내보내기 흐름을 붙여 실제 업무 도구로 만든다.

## 4. Users And Jobs

### Primary User

환경, 자원순환, 플라스틱, 시민단체, 정책 관련 뉴스를 정기적으로 확인하고 기록해야 하는 운영자 또는 PM.

### Core Jobs

- 매일 새로 들어온 뉴스를 빠르게 훑어본다.
- 중요한 뉴스를 저장하고 분류한다.
- 이미 확인한 뉴스와 미확인 뉴스를 구분한다.
- 특정 단체명, 정책, 지역, 키워드로 다시 검색한다.
- 향후 RSS 검색 키워드를 추가하거나 기존 피드를 중단한다.

## 5. MVP Scope

### Must Have

- Google Workspace OAuth 로그인
- RSS 피드 등록: 초기 3개 피드 사전 등록
- RSS 자동 수집: Vercel Cron으로 주기적 실행
- 중복 뉴스 방지: URL, GUID, 제목+발행일 기준 dedupe
- 뉴스 목록 대시보드
- 뉴스 상세 보기
- 상태 관리: `new`, `reviewed`, `saved`, `archived`
- 기본 분류: 피드명, 출처, 발행일, 키워드, 태그
- 검색과 필터: 키워드, 피드, 상태, 날짜 범위
- RSS 피드 관리: 추가, 수정, 비활성화
- 관리자만 피드 관리 가능

### Should Have

- 뉴스 중요도: `low`, `medium`, `high`
- 메모 작성
- 태그 직접 추가
- Google Sheets 내보내기
- 주간 요약 보기
- 수집 실패 로그

### Later

- AI 기반 자동 분류
- 뉴스 본문 추출 및 요약
- 유사 뉴스 묶기
- Slack/Jandi/Email 알림
- Google Drive 리포트 자동 생성
- 사용자별 저장 목록
- 키워드별 성과 대시보드

## 6. Proposed Architecture

### Frontend And Backend

- Framework: Next.js on Vercel
- Hosting: Vercel
- API: Next.js Route Handlers
- Scheduler: Vercel Cron
- Auth: Auth.js 또는 Clerk + Google OAuth
- DB: Neon Postgres 또는 Supabase Postgres
- ORM: Prisma 또는 Drizzle

### Recommended First Choice

초기에는 `Next.js + Auth.js + Neon Postgres + Prisma + Vercel Cron` 조합을 추천한다.

이유:

- Vercel 배포와 궁합이 좋다.
- Postgres는 뉴스 검색, 필터, 태그, 피드 관리에 충분히 안정적이다.
- Neon은 서버리스 환경에서 연결 관리가 쉽다.
- Prisma는 초기 모델링과 마이그레이션 속도가 빠르다.
- Google Workspace 로그인은 Auth.js의 Google Provider로 시작할 수 있다.

### Google Workspace Integration

초기에는 Google 계정 로그인을 중심으로 사용한다.

- 허용 도메인 제한: 특정 Google Workspace 도메인만 접근 허용
- 사용자 프로필: 이름, 이메일, 이미지 저장
- 선택 기능: Google Sheets로 뉴스 목록 내보내기
- 선택 기능: Google Drive에 주간 리포트 저장

## 7. Data Model Draft

### users

- `id`
- `email`
- `name`
- `image`
- `role`: `admin`, `member`
- `created_at`
- `updated_at`

### feeds

- `id`
- `name`
- `url`
- `source_type`: `google_alerts`, `rss`, `atom`
- `default_category`
- `is_active`
- `last_fetched_at`
- `last_success_at`
- `last_error`
- `created_by`
- `created_at`
- `updated_at`

### articles

- `id`
- `feed_id`
- `title`
- `url`
- `canonical_url`
- `guid`
- `summary`
- `source_name`
- `published_at`
- `fetched_at`
- `status`: `new`, `reviewed`, `saved`, `archived`
- `importance`: `low`, `medium`, `high`
- `dedupe_key`
- `created_at`
- `updated_at`

### tags

- `id`
- `name`
- `color`
- `created_at`

### article_tags

- `article_id`
- `tag_id`

### article_notes

- `id`
- `article_id`
- `user_id`
- `body`
- `created_at`
- `updated_at`

### fetch_runs

- `id`
- `feed_id`
- `status`: `success`, `partial`, `failed`
- `started_at`
- `finished_at`
- `items_found`
- `items_created`
- `items_skipped`
- `error_message`

## 8. News Classification

### MVP Classification

MVP에서는 규칙 기반 분류로 시작한다.

- 피드 기반 분류: 어떤 RSS에서 들어왔는지
- 키워드 기반 태그: 제목과 요약에서 특정 단어 감지
- 사용자 수동 태그: 운영자가 직접 태그 추가
- 상태 기반 분류: 새 뉴스, 확인 완료, 저장, 아카이브

### Example Tags

- `플라스틱`
- `재활용`
- `자원순환`
- `서울`
- `정책`
- `캠페인`
- `시민단체`
- `언론보도`
- `협업기회`
- `위험신호`

### Later AI Classification

AI 분류는 데이터가 쌓인 뒤 붙인다.

- 관련도 점수
- 중요도 추천
- 단체/기관/지역 추출
- 뉴스 요약
- 중복 또는 유사 기사 묶기

## 9. Main Screens

### Dashboard

- 오늘 새로 들어온 뉴스 수
- 미확인 뉴스 수
- 저장된 뉴스 수
- 피드별 수집 현황
- 최근 수집 실패 여부
- 최근 7일 기사 추이

### News Inbox

- 기사 목록
- 검색창
- 피드 필터
- 상태 필터
- 태그 필터
- 날짜 필터
- 중요도 필터
- 일괄 상태 변경

### Article Detail

- 제목
- 원문 링크
- 발행일
- 출처
- 요약
- 태그
- 중요도
- 상태
- 메모

### Feed Management

- RSS 피드 목록
- 새 RSS 추가
- 이름 수정
- URL 수정
- 활성/비활성 전환
- 마지막 수집 시각
- 마지막 오류 메시지
- 수동 수집 실행

### Weekly Review

- 이번 주 저장한 뉴스
- 태그별 뉴스 묶음
- 중요도 높은 뉴스
- Google Sheets 또는 Markdown 내보내기

## 10. RSS Collection Flow

1. Vercel Cron이 정해진 시간마다 `/api/cron/fetch-rss`를 호출한다.
2. 서버는 활성화된 피드 목록을 조회한다.
3. 각 RSS URL을 읽고 항목을 파싱한다.
4. 각 기사마다 `dedupe_key`를 생성한다.
5. 이미 저장된 기사면 건너뛴다.
6. 새 기사면 `articles`에 저장한다.
7. 제목과 요약을 기준으로 기본 태그를 붙인다.
8. `fetch_runs`에 결과를 기록한다.
9. 대시보드에서 새 뉴스가 보인다.

## 11. Initial OKR Options

### Option A: Reliable Archive

Objective: 1분기 안에 RSS 뉴스가 사라지지 않고 다시 찾을 수 있는 신뢰 가능한 아카이브를 만든다.

Key Results:

- RSS 수집 성공률을 95% 이상으로 유지한다.
- 초기 3개 피드에서 들어온 뉴스의 중복 저장률을 2% 이하로 낮춘다.
- 미확인 뉴스 중 90% 이상을 7일 안에 `reviewed` 또는 `saved` 상태로 처리한다.

Rationale: 지금의 가장 큰 문제는 아카이빙 부재이므로, 먼저 수집 안정성과 재확인 가능성을 확보한다.

### Option B: Faster Review

Objective: 운영자가 매일 들어오는 뉴스를 빠르게 판단하고 중요한 항목을 놓치지 않게 한다.

Key Results:

- 새 뉴스 확인에 걸리는 평균 시간을 1일 15분 이하로 줄인다.
- 저장 또는 중요 표시된 뉴스의 80% 이상에 태그를 1개 이상 부여한다.
- 검색 또는 필터를 통해 과거 뉴스를 다시 찾는 성공률을 사용자 테스트 기준 90% 이상으로 만든다.

Rationale: 단순 저장소를 넘어 실제 업무 속도를 줄이는 대시보드가 되어야 한다.

### Option C: Scalable Monitoring

Objective: RSS 키워드와 모니터링 대상을 운영자가 직접 확장할 수 있는 기반을 만든다.

Key Results:

- 관리자 화면에서 RSS 피드 추가, 수정, 비활성화를 코드 변경 없이 100% 처리한다.
- 신규 피드 추가 후 첫 수집까지 걸리는 시간을 5분 이하로 만든다.
- 피드별 수집 상태와 오류 원인을 대시보드에서 100% 확인할 수 있게 한다.

Rationale: 초기 3개 피드로 시작하지만, 장기적으로는 키워드와 조직 모니터링 범위가 계속 늘어날 가능성이 높다.

## 12. Implementation Phases

### Phase 0: Product And Tech Setup

- 요구사항 확정
- Google Workspace 접근 도메인 확인
- Vercel 프로젝트 생성
- Neon 또는 Supabase DB 생성
- Next.js 프로젝트 생성
- 기본 환경변수 정리

### Phase 1: Archive MVP

- Google OAuth 로그인
- DB 스키마 작성
- 초기 RSS 피드 seed
- RSS 파서 구현
- Cron 수집 API 구현
- 기사 중복 방지
- 뉴스 목록과 상세 화면 구현

### Phase 2: Review Workflow

- 상태 변경
- 중요도 설정
- 태그 관리
- 메모 작성
- 검색과 필터
- 피드 관리 화면

### Phase 3: Workspace Output

- Google Sheets 내보내기
- 주간 리뷰 화면
- 저장 뉴스 리포트
- 기본 접근 권한 정리

### Phase 4: Intelligence

- 규칙 기반 자동 태깅 개선
- AI 요약
- AI 중요도 추천
- 유사 기사 묶기
- 알림 채널 연동

## 13. Open Decisions

- Google Workspace 도메인 제한이 필요한가?
- DB는 Neon과 Supabase 중 무엇을 쓸 것인가?
- 뉴스 본문 전체를 저장할 것인가, RSS 요약과 원문 링크만 저장할 것인가?
- 알림은 계속 잔디를 쓸 것인가, 이메일 또는 Slack도 고려할 것인가?
- AI 분류는 MVP에 포함할 것인가, 데이터가 쌓인 뒤 붙일 것인가?

## 14. Risks

- Google Alerts RSS 항목의 URL 또는 GUID 형식이 바뀌면 중복 방지 로직을 조정해야 한다.
- RSS 요약만으로는 분류 정확도가 낮을 수 있다.
- 원문 본문 수집은 저작권과 사이트별 접근 정책을 고려해야 한다.
- Google API 범위를 넓히면 OAuth 검토와 보안 관리 부담이 커질 수 있다.
- Vercel Cron 실행 주기와 무료/유료 플랜 제한을 확인해야 한다.

## 15. Recommended Next Step

MVP는 `Reliable Archive` OKR을 기준으로 시작한다. 먼저 로그인, RSS 수집, 중복 방지, 뉴스 목록, 상태 관리까지 구현하고, 그 다음 피드 관리와 Google Sheets 내보내기를 붙인다.
