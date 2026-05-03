# 1. 프로젝트 개요

FAITH는 다양한 AI 모델을 결합한 멀티 에이전트 기반 허위정보 검증 시스템이다.

단일 모델이 아닌 Gemini. Groq, HuggingFace 를 동시에 활용하여 정확도 + 속도 + 안정성을 모두 확보한다.

---

# 2. 주요 기능

## 1) 텍스트 검증

- 허위정보 여부 판단
- 위험 점수 산출
- 카테고리 분류 (정치, 금융사기, 딥페이크 등)

## 2) 이미지 검증

- 딥페이크 여부 탐지
- 합성 이미지 판별
- 이미지 기반 위험 분석

## 3) 멀티 AI 앙상블 (MAS)

- 여러 AI를 병렬 실행
- 결과를 가중치 기반으로 통합

```bash
# 가중치
Gemini=0.55
Groq=0.25
HF=0.20
```

## 4) 사용자 시스템

- 회원가입 / 로그인 (JWT)
- 사용자 정보 기반 리스크 보정

## 5) 아카이브

- 검증 결과 저장
- 카테고리 분류
- 검색 / 페이지네이션
- 찜 기능

---

# 3. 시스템 아키텍처

```bash
[ React (Vite) ]
        ↓
   /api proxy
        ↓
[ FastAPI Backend ]
        ↓
[ PostgreSQL ]
        ↓
[ AI Engines ]
  - Gemini
  - Groq
  - HuggingFace
```

---

# 4. 기술 스택

## Frontend

- React 19
- Vite
- React Router
- Tailwind CSS

## Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT (python-jose)
- bcrypt

## AI

- Google Gemini
- Groq
- HuggingFace

---

# 5. 프로젝트 구조

```
project-root/
├── backend/
│   ├── .env_example                        # 환경변수 예시 파일 (GEMINI_API_KEY, DB 접속 정보 등)
│   ├── .python-version                     # Python 버전 고정 파일 (pyenv 사용 시)
│   ├── requirements.txt                    # Python 패키지 의존성 목록
│   ├── data/
│   │   └── archive_preview_images/        # 아카이브 저장 시 미리보기 이미지 디스크 저장 경로
│   └── app/
│       ├── main.py                         # FastAPI 앱 진입점. CORS 설정, .env 로드, 전체 라우터 등록
│       │
│       ├── api/                            # (구버전) 개별 AI 에이전트 라우터 모음
│       │   ├── ai_router.py               # 구버전 MAS 통합 엔드포인트 (/api/ai/verify)
│       │   ├── ai_gemini.py               # Gemini API 호출 함수 (텍스트/이미지 분석)
│       │   ├── ai_gemini_engine.py        # Gemini 엔진 라우터 래퍼
│       │   ├── ai_groq.py                 # Groq API 호출 라우터 (텍스트 분류)
│       │   ├── ai_hugging.py              # HuggingFace 모델 호출 라우터
│       │   ├── mas_test.py                # MAS(Multi-Agent System) 수동 테스트 스크립트
│       │   ├── predict_media.py           # (구버전) 미디어 예측 엔드포인트
│       │   ├── risk_detail.py             # (구버전) RiskDetail CRUD 라우터
│       │   ├── verification_history.py    # (구버전) VerificationHistory CRUD 라우터
│       │   └── verify.py                  # (구버전) AI 분석 + DB 저장 통합 엔드포인트
│       │
│       ├── api_v1/                         # (현재 사용) v1 API 라우터 모음
│       │   ├── ai_router.py               # v1 MAS 통합 라우터. Gemini·Groq·HF 비동기 병렬 호출, MIME 타입 안전 처리
│       │   ├── verify.py                  # AI 분석 + DB 저장 통합 엔드포인트. 위험도 산출 후 VerificationHistory/RiskDetail 저장
│       │   ├── predict_media.py           # POST /api/predict/media. 파일 업로드 받아 verify_and_save 호출
│       │   ├── risk_detail.py             # RiskDetail CRUD REST API (GET·POST·PATCH·DELETE /risk-details)
│       │   └── verification_history.py    # VerificationHistory CRUD REST API (GET·POST·PATCH·DELETE /verifications)
│       │
│       ├── risk_engine/                    # AI 앙상블 위험도 분석 엔진
│       │   ├── engine.py                  # 앙상블 코어. Gemini 0.55 / Groq 0.25 / HF 0.20 가중치로 최종 점수 산출. CRITICAL·HIGH·MEDIUM·LOW 레벨 분류
│       │   ├── faith_text_risk.py         # Gemini 기반 텍스트 위험도 분석. 모델 우선순위 폴백·재시도 로직 포함
│       │   ├── faith_image_risk.py        # Gemini 기반 이미지 위험도 분석 (faith_text_risk 유틸 재사용)
│       │   └── schemas.py                 # 위험도 데이터클래스 정의 (UserContext, AgentResult, CategoryReason, FinalResult). 카테고리: 혐오/폭력·딥페이크·금융사기·허위정보·성적콘텐츠·정상
│       │
│       ├── routers/                        # 인증·사용자·아카이브 라우터
│       │   ├── auth.py                    # JWT 인증. 회원가입·로그인·토큰 검증. bcrypt 해싱, HS256, 24시간 만료
│       │   ├── archive.py                 # 아카이브 CRUD. 검증 스냅샷 저장, 미리보기 이미지 디스크 저장, 즐겨찾기 관리
│       │   ├── members.py                 # 회원 CRUD REST API (/members). login_id 중복 체크 포함
│       │   └── user.py                    # 로그인 사용자 본인 정보 조회·수정·비밀번호 변경·검증 이력 조회 (/api/user)
│       │
│       ├── db/
│       │   ├── sql.py                     # SQLAlchemy PostgreSQL 연결 설정. DATABASE_URL 환경변수, get_db() DI
│       │   ├── nosql.py                   # pymongo MongoDB 연결 설정. MONGO_URL / MONGO_DB_NAME 환경변수
│       │   ├── init_postgres.py           # PostgreSQL 초기 테이블 생성 스크립트
│       │   ├── init_mongo.py              # MongoDB 초기 컬렉션·설정 스크립트
│       │   ├── mongo/
│       │   │   ├── guest_verification_log.schema.json  # 비로그인 사용자 검증 로그 MongoDB 스키마 정의
│       │   │   └── indexes.js                          # MongoDB 컬렉션 인덱스 생성 스크립트
│       │   └── postgres/
│       │       ├── capstone_db.sql        # DB 생성 DDL
│       │       ├── members.sql            # members 테이블 DDL
│       │       ├── risk_detail.sql        # risk_detail 테이블 DDL
│       │       ├── user_profile.sql       # user_profile 테이블 DDL
│       │       └── verification_history.sql  # verification_history 테이블 DDL
│       │
│       ├── models/                         # SQLAlchemy ORM 모델
│       │   ├── members.py                 # 회원(Member) 테이블 ORM
│       │   ├── user_profile.py            # 사용자 프로필(UserProfile) 테이블 ORM
│       │   ├── verification_history.py    # 검증 이력(VerificationHistory) 테이블 ORM
│       │   ├── risk_detail.py             # 위험 상세(RiskDetail) 테이블 ORM
│       │   ├── archive_item.py            # 아카이브 항목(ArchiveItem) 테이블 ORM
│       │   └── archive_favorite.py        # 아카이브 즐겨찾기(ArchiveFavorite) 테이블 ORM
│       │
│       ├── schemas/                        # Pydantic 요청·응답 스키마
│       │   ├── members.py                 # 회원 Create·Out 스키마
│       │   ├── risk_detail.py             # RiskDetail Create·Update·Out 스키마
│       │   └── verification_history.py    # VerificationHistory Create·Update·Out 스키마
│       │
│       └── crud/                           # DB CRUD 함수 모음
│           ├── risk_detail.py             # RiskDetail 생성·조회·수정·삭제 함수
│           └── verification_history.py    # VerificationHistory 생성·조회·수정·삭제 함수
│
└── frontend/
    ├── index.html                          # 앱 HTML 진입점. <div id="root"> 마운트 포인트
    ├── package.json                        # npm 의존성 및 스크립트 정의
    ├── vite.config.js                      # Vite 번들러 설정 (포트, 프록시, 경로 alias 등)
    ├── postcss.config.js                   # Tailwind CSS 빌드를 위한 PostCSS 설정
    ├── eslint.config.js                    # ESLint 코드 품질 검사 규칙 설정
    ├── public/                             # 정적 자산 (빌드 시 그대로 복사)
    └── src/
        ├── main.jsx                        # React 앱 진입점. ReactDOM.createRoot, BrowserRouter 래핑
        ├── App.jsx                         # 루트 컴포넌트. 전체 라우트 정의 및 전역 ErrorModal 상태 관리
        ├── index.css                       # 전역 CSS (Tailwind base/components/utilities import)
        ├── App.css                         # App 컴포넌트 스코프 CSS
        │
        ├── lib/                            # 순수 로직 유틸 모음 (UI 비의존)
        │   ├── client.js                   # fetch 기반 HTTP 클라이언트. JWT 자동 첨부, 에러 통일 처리
        │   ├── api.js                      # REST API 메서드 래퍼 (get·post·put·patch·del·upload). JSON 파싱 안전 처리
        │   ├── auth.js                     # 인증 함수 (login·logout·signup·checkLoginId·isLoggedIn). 토큰 자동 저장
        │   ├── token.js                    # JWT 토큰 localStorage 저장·조회·삭제 유틸 (키: faith_access_token)
        │   ├── analyze.js                  # 텍스트·미디어 검증 API 요청 함수 (analyzeText·analyzeMedia)
        │   └── validators.js              # 입력값 검증 순수 함수 (canAnalyze·getAnalyzeError·isValidFile 등)
        │
        ├── components/                     # 재사용 UI 컴포넌트
        │   ├── Header.jsx                 # 상단 네비게이션 바. 로그인 상태에 따라 메뉴 전환
        │   ├── Footer.jsx                 # 하단 푸터
        │   ├── RiskChart.jsx              # 위험도 점수(0~1) 시각화 SVG 원형 게이지. LOW·MEDIUM·HIGH·CRITICAL 색상 구분
        │   ├── CategoryArchive.jsx        # 카테고리별 아카이브 탐색 UI (전체·연예·사회·정치·경제·기타)
        │   ├── ErrorModal.jsx             # 전역 에러 알림 모달 (title·message·onClose props)
        │   ├── LoginInput.jsx             # 로그인 전용 입력 필드 컴포넌트
        │   ├── TextInput.jsx              # 범용 텍스트 입력 컴포넌트
        │   ├── UploadFile.jsx             # 파일 드래그앤드롭·클릭 업로드 컴포넌트
        │   └── ScrollToTop.jsx            # 라우트 이동 시 스크롤 자동 최상단 이동
        │
        └── views/                          # 페이지 단위 컴포넌트 (라우트별 1:1 대응)
            ├── HomeView.jsx               # 메인 홈. 텍스트 입력·파일 업로드 → 분석 시작 → ResultView 이동
            ├── ResultView.jsx             # 분석 결과 페이지. RiskChart + 위험도 레벨·카테고리·근거 표시, 아카이브 저장
            ├── ArchiveView.jsx            # 아카이브 목록·상세. 카테고리 필터·페이지네이션·검색·즐겨찾기·삭제
            ├── LoginView.jsx              # 로그인 페이지. 아이디/비밀번호 입력 → JWT 발급 후 홈 이동
            ├── SignUpView.jsx             # 회원가입 페이지. 아이디 중복 확인·필드 유효성 검사 포함
            ├── MyPageView.jsx             # 마이페이지. 프로필 조회·수정, 비밀번호 변경, 검증 이력 조회
            └── AboutView.jsx              # 서비스 소개 페이지 (FAITH 프로젝트 설명)
```

---

# 6. 실행 방법

## 1) 저장소 클론

```bash
git clone <repo-url>
cd develop
```

## 2) Backend 실행

```bash
cd backend

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

pip install-r requirements.txt

uvicorn app.main:app--reload
```

→ 서버: [http://127.0.0.1:8000](http://127.0.0.1:8000/)

## 3) Frontend 실행

```bash
cd frontend

npm install
npm run dev
```

→ 접속: [http://localhost:5173](http://localhost:5173/)

---

# 7. API Key 설정

## Gemini

https://aistudio.google.com/app/apikey

## Groq

https://console.groq.com/keys

## HuggingFace

https://huggingface.co/settings/tokens

## 환경변수 설정(.env)

**`.env_example` 파일을 `.env`로 바꿔서 사용하기**

```bash
GEMINI_API_KEY=xxx
GROQ_API_KEY=xxx
HUGGINGFACE_API_KEY=xxx
```

---

# 8. 인증 구조

1. 로그인 → JWT 발급
2. 요청 시 헤더 포함

```bash
Authorization: Bearer <token>
```

→ 서버에서 사용자 검증 처리

---

# 9. AI 처리 흐름

## 텍스트

1. Gemini 분석
2. Groq 분석
3. HF 분석
4. 결과 통합 (ensemble)

→ 병렬 처리 예시

## 이미지

- Gemini 기반 이미지 분석
- 텍스트 있으면 추가 분석

## 최종 결과 구조

```bash
{
  "risk_score":72,
  "risk_level":"HIGH",
  "risk_category":"허위정보"
}
```

---

# 10. 데이터베이스

FAITH 백엔드는 기본적으로 **PostgreSQL**을 사용합니다.

MongoDB는 일부 확장/보조 기능용으로만 존재하므로 **일반 실행 기준 필수는 PostgreSQL**입니다.

## 주요 테이블

- members → 사용자
- verification_history → 검증 기록
- risk_detail → 상세 리스크
- archive_items → 저장 데이터
- archive_favorites → 찜

## PostgreSQL 설치 (필수)

[참고] https://velog.io/@gwak2837/%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%B2%A0%EC%9D%B4%EC%8A%A4-%EC%8B%9C%EC%8A%A4%ED%85%9C-%EC%8B%A4%EC%8A%B52

**공식 다운로드**

- PostgreSQL 공식 다운로드 페이지: https://www.postgresql.org/download/?utm_source=chatgpt.com

### **운영체제별 설치 방법**

**Windows**

1. PostgreSQL 공식 다운로드 페이지 접속
2. Windows 설치 프로그램(일반적으로 EDB Installer) 다운로드
3. 설치 중 아래 항목 설정
    - 비밀번호
    - 포트: `5432`
    - 기본 사용자: `postgres`
4. 설치 완료 후 **pgAdmin** 또는 SQL Shell 실행

**Ubuntu / Linux**

패키지 매니저 사용 권장:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctlstart postgresql
sudo systemctl enable postgresql
```

공식 문서에서는 Linux에서 배포판 패키지 관리자를 사용하는 방식을 권장한다.

### **PostgreSQL DB 생성**

설치가 끝났으면 프로젝트에서 사용할 DB를 생성합니다.

**psql 접속**

```bash
psql-U postgres
```

**DB 생성**

```bash
CREATE DATABASE capstone_db;
```

**확인**

```bash
\l
```

`capstone_db`가 목록에 보이면 정상입니다.

### PostgreSQL 연결 정보 설정

백엔드 기본 연결 문자열은 아래 형태입니다.

현재 코드 기본값도 PostgreSQL용 SQLAlchemy URL로 잡혀 있습니다.

```bash
DATABASE_URL=postgresql+psycopg2://postgres:비밀번호@localhost:5432/capstone_db
```

예시:

```bash
DATABASE_URL=postgresql+psycopg2://postgres:1234@localhost:5432/capstone_db
```

주의: 기존 문서 예시 중 `postgresql+psycopg2://postgres:5432@localhost:5432/capstone_db`처럼 보이는 형식은 `postgres:비밀번호` 자리여야 하므로 실제 설정할 때는 **비밀번호를 정확히 넣어야** 합니다. 기본 연결 구조는 코드 기준 `postgresql+psycopg2://<user>:<password>@<host>:<port>/<db>`입니다.

### 테이블 생성

이 프로젝트는 FastAPI 실행 시 테이블을 자동 생성하는 구조를 사용합니다.

즉, DB만 준비되어 있으면 백엔드 시작 시 필요한 테이블이 생성됩니다.

백엔드 실행:

```bash
uvicorn app.main:app --reload --host127.0.0.1 --port 8000
```

생성 대상 예시:

- `members`
- `archive_items`
- `archive_favorites`
- `verification_history`
- 기타 모델 테이블

## MongoDB 설치 (선택)

MongoDB는 현재 코드상 선택 요소입니다.

기본 실행에 꼭 필요하지는 않지만, 관련 기능을 쓰거나 확장할 경우 설치할 수 있습니다. `MONGO_URL`, `MONGO_DB_NAME` 환경변수를 통해 연결합니다.

### **공식 다운로드**

- MongoDB Community Server 다운로드:
- MongoDB 설치 문서:

**Ubuntu 예시**

MongoDB 공식 문서 기준 Ubuntu에서는 패키지 설치 후 다음처럼 설치할 수 있다.

```bash
sudo apt-get install-y mongodb-org
sudo systemctlstart mongod
sudo systemctl enable mongod
```

**환경변수 예시**

```bash
MONGO_URL=mongodb://localhost:27017
MONGO_DB_NAME=capstone_db
```

코드 기본값도 동일하게 설정되어 있습니다.

### **DB 준비 체크리스트**

백엔드 실행 전 아래만 확인하면 됩니다.

- PostgreSQL 설치 완료
- `capstone_db` 생성 완료
- `.env`에 `DATABASE_URL` 설정 완료
- 백엔드 실행 시 DB 연결 성공
- 필요하면 MongoDB 추가 설치

---

# 11. 주요 API

| 기능 | 경로 |
| --- | --- |
| 회원가입 | `/api/auth/signup` |
| 로그인 | `/api/auth/login` |
| 텍스트 분석 | `/api/ai/mas/text` |
| 이미지 분석 | `/api/ai/mas/media` |
| 아카이브 저장 | `/api/archive/save` |

→ Swagger: http://127.0.0.1:8000/docs
