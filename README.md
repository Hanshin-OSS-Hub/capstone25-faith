# capstone25-faith
## FAITH — AI 기반 허위 정보 수집·검증 및 팩트체크 플랫폼

> **FAITH**는 생성형 AI·딥페이크·가짜뉴스 등 **허위 정보**를 자동/준실시간으로 분석하고, 사용자 참여형 구조로 신뢰할 수 있는 검증 결과를 제공하는 **팩트체크 플랫폼**입니다.

---

## 1. 문제 배경 및 목적

디지털 미디어 발전으로 정보 확산 속도가 급격히 증가하면서, 기술을 악용한 허위 정보 확산이 심각한 사회 문제로 대두되고 있습니다.  
특히 **딥페이크(Deepfake)** 기술은 실제와 구분하기 어려운 조작 이미지/영상을 쉽게 생성해 개인의 명예 훼손 및 사회적 혼란을 야기합니다.

기존 팩트체크는 주로 언론사/전문 기관 중심으로 이루어져 확산 속도를 따라가기 어렵고, 일반 사용자의 참여가 제한되며 사후 검증 위주라는 한계가 있습니다. 또한 국내에서는 정치 분야 중심의 해외 기관 의존형 서비스가 많아 **한국 특화형 종합 검증 서비스**가 부족합니다.

본 프로젝트는 **AI 기반 허위 정보 수집·검증 및 팩트체크 플랫폼**을 구축하여
- AI 기반 자동 검증
- 사용자 참여형 구조(확장 가능)  
를 통해 신뢰할 수 있는 정보 환경을 조성하는 것을 목표로 합니다.

---

## 2. 관련 연구 및 시장 동향 요약

### 시장/사회적 이슈
- 딥페이크 범죄(디지털 성범죄 등), AI 생성 허위 정보 확산으로 실제 피해 증가
- 저작권/초상권 분쟁 등 법적 분쟁 증가

### 기술/정책 동향
- 딥페이크 탐지(이미지/영상/오디오), 워터마킹·출처 증명(C2PA), 플랫폼 정책(합성 콘텐츠 표기 강화) 등 발전
- 완전 자동 탐지보다는 **다중 탐지 + 사람 검수**가 현실적 접근으로 자리잡는 추세

### 시장 공백(차별화 포인트)
- 한국어 특화 서비스 부재
- 법/정책 연동형 라벨링 필요
- 접근성 개선(예: 카카오톡 채널/간편 제보)
- 다중 검증 체계(외부 API + 내부 모델 + 근거 제시) 구축

---

## 3. 제안 방법

### 3.1 Risk Scoring 기반 위험도 평가 엔진
텍스트·이미지·영상 분석 에이전트에서 나온 위험 신호를 통합하여 **최종 Risk Score**를 산출합니다.

**Risk Score(정규화 후 0~100%)**
- 로그인 사용자: 성별/나이/직업 등 프로필 기반 보정 계수 U(i) 적용(개인화)
- 비로그인 사용자: U(i)=1 고정(비개인화)

**수식**
Risk score = ∑ W(i) · P(i) · U(i)
- P(i): 각 분석 모듈이 출력한 위험 점수(%)
- W(i): 위험 요소 가중치
- U(i): 사용자 특성 기반 보정 계수

### 3.2 Risk 카테고리 분류 & 의사결정
콘텐츠 목적/유형을 기반으로 (예: Fun / Sexual / Deepfake·Deepface / Phishing) 위험도를 분류하고,
Low~Critical 단계에 따른 대응 정책을 설계합니다.

---

## 4. 주요 기능

| 단계 | 모듈/에이전트 | 주요 기능 |
|---|---|---|
| 입력 수집 | Input Processing Agent | URL/텍스트/이미지/영상 수집 및 전처리(OCR/파서/크롤러) |
| 오케스트레이션 | Orchestrator Agent | 에이전트 실행 조정·데이터 분배·결과 통합 |
| 위·변조 탐지 | Forgery Detection Agent | 이미지/딥페이크 탐지(CNN, Xception 등) |
| 사실 검증 | Verification Agent | 주장 추출 + 외부 근거 비교(검색/팩트체크 API) |
| 텍스트 판별 | Text Classification Agent | 언어 패턴 기반 위험도 분석 |
| 리스크 산출 | Risk Scoring Agent | 가중합 기반 최종 점수/레벨 산출 |
| 결과 생성 | Reporting Agent | 근거 기반 설명 포함 보고서 생성 |

---

## 5. 비기능 요구사항

### 환경
- Web 기반(브라우저)
- 백엔드: AWS EC2(Ubuntu 20.04 LTS), FastAPI, PostgreSQL, MongoDB, SQLAlchemy
- 프론트: Next.js, TypeScript

### 사용성
- Risk score + 탐지 이유 + 근거를 텍스트로 설명(비전문가도 이해 가능)
- 반응형 UI

### 성능
- 업로드 콘텐츠 분류/전달 평균 2분 이내(목표)
- 동시 요청 안정 처리(비동기 통신 활용)
- 로그/메타데이터 조회 성능 확보(인덱싱 등)

### 보안
- HTTPS 전송, 기본 비공개 저장
- 관리자 기능 권한 제어

---

## 6. 기대 효과

- **기술적**: 한국어 특화 팩트체크/탐지 모델 확보 및 확장 기반
- **사회적**: 허위 정보 확산 차단 → 신뢰도 제고
- **경제적**: 검증 데이터 연계, API 제공 등 확장 가능성
- **교육적**: 미디어 리터러시 강화(사용자 판단 역량 향상)

---

## 7. 기술 스택
![FAITH 기술 스택](assets/FAITH_기술스택.png)

### Backend
- FastAPI, SQLAlchemy
- PostgreSQL
- MongoDB(로그/비정형 데이터)
- (예정) LangChain Agent 기반 오케스트레이션

### Frontend
- Next.js, TypeScript
- React-Query
- ECharts / Recharts

### Infra / DevOps
- AWS EC2, (예정) S3 / RDS
- GitHub PR 기반 협업

---

## 8. GUI 프로토타입
![FAITH GUI Prototype](assets/FAITH_GUI.jpg)

---

## 9. 위험 요소 및 대응

| 위험 구분 | 위험 요소 | 대응 전략 | 수준 |
|---|---|---|---|
| 기술 | 외부 AI API 장애/지연 | 재시도/타임아웃/대체 메시지 | High |
| 데이터 | 데이터 부족/편향 | 공개 데이터 확장, 다양한 소스 통합, 근거 제시 | High |
| 보안 | 저작권 포함 업로드 | 고지 문구, 기본 비공개, 신고/삭제 | High |
| 운영 | 업데이트 중 중단 | 테스트 환경, 점검 공지 | Moderate |
| 사용자 | 악의적 오남용 | 업로드 제한, 비정상 패턴 탐지 | Moderate |

---

## 10. 팀 명단 및 역할

| 이름 | 학과/학번 | 역할 |
|---|---|---|
| 왕희원(팀장) | 소프트웨어학과 23학번 | 백엔드 |
| 진수빈(팀원) | 소프트웨어학과 23학번 | AI엔지니어링 |
| 심서윤(팀원) | 소프트웨어학과 23학번 | 프론트엔드 & AI엔지니어링 |
| 김나영(팀원) | 소프트웨어학과 23학번 | 백엔드 |

---

## 11. 개발

# FAITH — AI 팩트체크 플랫폼

**FAITH(Fact · AI · Truth · Humanity)** 는 텍스트·이미지를 입력해 **딥페이크·허위·조작 정보** 등을 AI로 검증하고, **리스크 점수·근거**를 보여 주는 웹 서비스입니다.  
한신대학교 캡스톤디자인 프로젝트로 개발된 **React(Vite) 프론트엔드**와 **FastAPI 백엔드**로 구성됩니다.

---

## 목차

1. [기능 개요](#기능-개요)
2. [기술 스택](#기술-스택)
3. [폴더 구조](#폴더-구조)
4. [시스템 구성도](#시스템-구성도)
5. [사전 요구 사항](#사전-요구-사항)
6. [빠른 시작 (로컬 개발)](#빠른-시작-로컬-개발)
7. [환경 변수](#환경-변수)
8. [데이터베이스](#데이터베이스)
9. [API 개요](#api-개요)
10. [프론트엔드 라우팅](#프론트엔드-라우팅)
11. [인증(JWT) 흐름](#인증jwt-흐름)
12. [아카이브 기능](#아카이브-기능)
13. [AI 검증(MAS) 엔드포인트](#ai-검증mas-엔드포인트)
14. [빌드·배포](#빌드배포)
15. [문제 해결 (Troubleshooting)](#문제-해결-troubleshooting)
16. [라이선스·기여](#라이선스기여)

---

## 기능 개요

| 영역 | 설명 |
|------|------|
| **검증** | 홈에서 텍스트(최소 길이 검증) 또는 파일 업로드 후 분석. 결과는 `/result`에서 리포트 형태로 표시. |
| **멀티 에이전트(MAS)** | Groq, Hugging Face, Gemini 등 여러 경로를 조합해 점수·카테고리·근거를 산출 (`/api/ai/mas/*`). |
| **회원** | 회원가입·로그인, JWT 발급. 마이페이지에서 프로필 수정 가능. |
| **아카이브** | 검증 결과를 **로그인 사용자만** 공개 아카이브에 저장. 카테고리·검색·페이지네이션, MY·찜(로그인 필요). |
| **서비스 소개** | `/about` 에 기능·가치·How it works 등 소개. |

---

## 기술 스택

### 프론트엔드 (`faith-front/`)

- **React 19**, **React Router 7**
- **Vite 8** (개발 서버·빌드)
- **Tailwind CSS 4** (`@tailwindcss/postcss`)
- **lucide-react** (아이콘)

### 백엔드 (`backend/`)

- **FastAPI**, **Uvicorn**
- **SQLAlchemy 2** + **PostgreSQL** (`psycopg2-binary`)
- **JWT** (`python-jose`) + **bcrypt** (비밀번호)
- **선택**: **MongoDB** (`pymongo`, `app/db/nosql.py`) — 확장/보조용으로 존재하며, SQL 중심 기능은 Postgres로 동작
- **AI 연동**: `google-genai`, `groq`, `huggingface_hub`, `transformers`/`torch` 등 (`requirements.txt` 참고)

---

## 폴더 구조

```
develop/
├── README.md                 # 본 문서
├── faith-front/              # React SPA
│   ├── src/
│   │   ├── App.jsx           # 라우트·레이아웃(Header/Footer)
│   │   ├── components/       # 공통 UI (Header, CategoryArchive 등)
│   │   ├── views/            # 페이지 (Home, Result, Archive, About, Login …)
│   │   └── lib/              # api, auth, analyze, token 등
│   ├── vite.config.js        # 개발 시 /api → 백엔드 프록시
│   └── package.json
└── backend/
    ├── app/
    │   ├── main.py           # FastAPI 앱, CORS, 라우터 등록, startup에서 DB 테이블 생성
    │   ├── routers/          # auth, user, archive
    │   ├── api/              # AI 라우터 (groq, hugging, gemini, mas)
    │   ├── models/           # SQLAlchemy 모델
    │   ├── db/               # sql.py(Postgres), nosql.py(Mongo 선택)
    │   └── risk_engine/      # 앙상블·스키마 등
    ├── requirements.txt
    └── .env                  # 로컬 비밀값 (직접 생성, Git에 올리지 말 것)
```

---

## 시스템 구성도

```mermaid
flowchart LR
  Browser[브라우저]
  Vite[Vite dev :5173]
  FastAPI[FastAPI :8000]
  PG[(PostgreSQL)]
  Browser --> Vite
  Vite -->|"/api 프록시"| FastAPI
  FastAPI --> PG
```

- 개발 시 브라우저는 `http://localhost:5173` 만 바라보고, `/api/*` 요청은 Vite가 `http://127.0.0.1:8000` 으로 넘깁니다.

---

## 사전 요구 사항

- **Node.js** 20+ 권장 (Vite 8 사용)
- **Python** 3.10+ (`requirements.txt` 주석 참고)
- **PostgreSQL** (기본 URL은 아래 [환경 변수](#환경-변수) 참고)
- (선택) **MongoDB** — 코드에 클라이언트가 있으나, 필수 여부는 사용 중인 기능에 따라 다름

---

## 빠른 시작 (로컬 개발)

### 1) PostgreSQL 준비

- DB 이름 예: `capstone_db`
- 사용자·비밀번호·호스트·포트를 `DATABASE_URL` 에 맞게 설정

### 2) 백엔드

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

`backend/.env` 파일을 만들고 [환경 변수](#환경-변수)를 채웁니다.

서버 실행:

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- 헬스 체크: 브라우저 또는 `curl` 로 `http://127.0.0.1:8000/` → `{"ok": true}` 형태 응답

### 3) 프론트엔드

```powershell
cd faith-front
npm install
npm run dev
```

- 브라우저: `http://localhost:5173` (또는 터미널에 표시된 주소)

### 4) 동작 확인 순서

1. 백엔드가 **8000** 에서 실행 중인지 확인  
2. 프론트 **5173** 접속 후 홈에서 텍스트 검증 또는 이미지 업로드 검증  
3. 회원가입 → 로그인 → 아카이브 저장·MY·찜 등 테스트  

---

## 환경 변수

백엔드는 `app/main.py` 에서 **`backend/.env`** 를 로드합니다 (`load_dotenv`).

| 변수 | 설명 | 기본/예시 |
|------|------|-----------|
| `DATABASE_URL` | SQLAlchemy Postgres 연결 문자열 | `postgresql+psycopg2://postgres:5432@localhost:5432/capstone_db` (`app/db/sql.py` 기본값) |
| `JWT_SECRET_KEY` | JWT 서명 키 | 코드 기본값 있음 — **운영에서는 반드시 강한 랜덤 값으로 변경** |
| `MONGO_URL` | Mongo 연결 (선택) | `mongodb://localhost:27017` |
| `MONGO_DB_NAME` | Mongo DB 이름 (선택) | `capstone_db` |

AI 관련 키(Gemini, Groq, Hugging Face 등)는 각 `app/api/*` 모듈에서 `os.getenv` 로 읽는 경우가 많습니다. 해당 파일을 열어 필요한 키 이름을 확인하세요.

---

## 데이터베이스

- **시작 시**: `app/main.py` 의 `startup` 에서 `Base.metadata.create_all(bind=engine)` 로 **테이블 자동 생성** (마이그레이션 없이도 최소 스키마는 생성됨).
- **주요 SQL 테이블(예시)**  
  - `members` — 회원  
  - `archive_items` — 아카이브 항목 (검증 결과 스냅샷 JSON)  
  - `archive_favorites` — 회원별 찜  
  - 기타 프로필·이력 모델은 `app/models/` 참고  

---

## API 개요

공통 prefix 는 대부분 `/api/...` 입니다.

| 구분 | 메서드 | 경로 | 인증 | 설명 |
|------|--------|------|------|------|
| 헬스 | GET | `/` | 불필요 | 서버 동작 확인 |
| 로그인 | POST | `/api/auth/login` | 불필요 | `access_token` 발급 |
| 회원가입 | POST | `/api/auth/signup` | 불필요 | |
| ID 중복 | GET | `/api/auth/check-id` | 불필요 | |
| 내 정보 | GET/PATCH | `/api/user/...` | Bearer JWT | 마이페이지 |
| MAS 텍스트 | POST | `/api/ai/mas/text` | 선택적(바디에 `is_logged_in` 등) | 텍스트 검증 |
| MAS 미디어 | POST | `/api/ai/mas/media` | — | `multipart/form-data` (`image`, 선택 `text`) |
| 아카이브 저장 | POST | `/api/archive/save` | **필수 (JWT)** | 회원만 저장 가능 |
| 아카이브 목록 | GET | `/api/archive` | `category`, `page`, `q`, `sort` 등 | MY·찜은 로그인 필요 |
| 아카이브 상세 | GET | `/api/archive/items/{id}` | 선택 | |
| 아카이브 삭제 | DELETE | `/api/archive/{id}` | 필수 | 본인 소유만 |
| 찜 | POST/DELETE | `/api/archive/items/{id}/favorite` | 필수 | |
| 미리보기 이미지 | POST/GET | `/api/archive/preview-image` … | 업로드는 저장 흐름에서 사용 | |

자세한 스키마는 FastAPI 자동 문서에서 확인할 수 있습니다.

- **Swagger UI**: `http://127.0.0.1:8000/docs`  
- **ReDoc**: `http://127.0.0.1:8000/redoc`

---

## 프론트엔드 라우팅

| 경로 | 화면 |
|------|------|
| `/` | 홈 (검증 입력 + 카테고리별 아카이브 진입) |
| `/about` | 서비스 소개 |
| `/archive` | `/archive/all/1` 로 리다이렉트 |
| `/archive/:category/:page` | 아카이브 목록 (전체·연예·사회·정치·경제·기타·MY·찜) |
| `/login`, `/signup` | 로그인·회원가입 |
| `/mypage` | 마이페이지 (로그인 권장) |
| `/result` | 검증 직후 결과 (state로 결과 전달) |
| `/result/archive/:archiveId` | 저장된 아카이브 항목 상세 |

---

## 인증(JWT) 흐름

1. `POST /api/auth/login` 으로 `access_token` 수신  
2. 프론트는 `faith-front/src/lib/token.js` 를 통해 **localStorage** 등에 토큰 보관  
3. `faith-front/src/lib/api.js` 의 `fetch` 가 `Authorization: Bearer <token>` 헤더를 붙임  
4. 보호 API는 백엔드에서 `get_current_user` 등으로 검증  

로그아웃은 클라이언트에서 토큰 삭제(`auth.js` 의 `logout`)로 처리됩니다.

---

## 아카이브 기능

- **저장**: 검증 결과 화면에서 「아카이브 저장」 — **로그인한 회원만** 서버에서 허용됩니다. 비회원이 누르면 UI에서 안내 메시지를 표시합니다.  
- **취소**: 같은 버튼을 다시 누르면 방금 저장한 항목을 삭제하는 방식으로 동작할 수 있습니다(프론트 `ResultView.jsx` 구현 기준).  
- **MY / 찜**: 로그인 필요. 비로그인 시 안내 박스와 로그인 링크 표시.  
- **공개 목록**: 카테고리·검색·정렬·페이지네이션으로 탐색.  

미리보기 이미지는 서버 디스크 `backend/data/archive_preview_images/` 등에 저장되고, 스냅샷에는 URL만 들어가는 구조입니다 (`archive` 라우터 참고).

---

## AI 검증(MAS) 엔드포인트

- **텍스트**: `POST /api/ai/mas/text`  
  - Body 예: `{ "text": "검증할 문장..." }`  
- **미디어**: `POST /api/ai/mas/media`  
  - `FormData`: 필드 `image`(파일), 선택 `text`(설명)  

프론트 래퍼: `faith-front/src/lib/analyze.js` 의 `analyzeText`, `analyzeMedia`.

> Groq / Gemini / Hugging Face 등은 **API 키·네트워크**가 준비되어 있어야 하며, 키가 없거나 할당량 초과 시 5xx 또는 에러 메시지가 내려올 수 있습니다.

---

## 빌드·배포

### 프론트 프로덕션 빌드

```powershell
cd faith-front
npm run build
```

산출물은 `faith-front/dist/`. 정적 호스팅(Nginx, S3+CloudFront 등)에 올릴 수 있습니다.

**주의**: 프로덕션에서 Vite 프록시가 없으므로, 브라우저가 직접 백엔드에 붙게 하려면:

- 같은 도메인에서 리버스 프록시로 `/api` → FastAPI  
- 또는 `faith-front/src/lib/api.js` 의 요청 base URL 을 환경별로 분리하는 방식  

이 필요할 수 있습니다 (현재 저장소 기본값은 상대 경로 `/api` 가정).

### 백엔드 프로덕션 실행 예

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- `JWT_SECRET_KEY`, `DATABASE_URL` 등은 배포 환경 변수로 주입하는 것을 권장합니다.

---

## 문제 해결 (Troubleshooting)

| 증상 | 점검 |
|------|------|
| 프론트에서 API가 HTML을 반환한다고 함 | Vite 프록시 대상(8000)이 꺼졌거나, URL이 잘못됨. 백엔드 기동 후 재시도. |
| CORS 오류 | `app/main.py` 의 `origins` 에 프론트 origin(5173 등) 추가. |
| DB 연결 실패 | Postgres 기동·`DATABASE_URL`·방화벽·DB 존재 여부 확인. |
| 로그인은 되는데 아카이브 저장 401 | 토큰이 `api.js` 에서 헤더로 나가는지, 만료 여부 확인. |
| AI 검증만 실패 | 외부 API 키·쿼터·네트워크 확인. `backend` 로그와 `/docs` 로 직접 호출 테스트. |

---

## 라이선스·기여

- 교육용 캡스톤 프로젝트로 작성된 코드입니다.  
- 라이선스·팀 규칙이 정해져 있다면 이 저장소 정책에 맞게 `LICENSE` 파일을 추가하세요.

---

## 문의

- 저장소 관리자 또는 캡스톤 팀 담당자에게 연락하세요.

