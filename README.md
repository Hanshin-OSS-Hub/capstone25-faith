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
develop/
├── faith-front/       # 프론트엔드
└── backend/
    ├── app/
    │   ├── api/       # AI 엔진
    │   ├── routers/   # API 라우터
    │   ├── models/    # DB 모델
    │   ├── schemas/   # 응답 구조
    │   └── db/        # DB 연결
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