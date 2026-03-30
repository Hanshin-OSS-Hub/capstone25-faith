** 아이디 중복확인

API:
GET /api/auth/check-id?login_id=xxx

요청:
메소드: GET
쿼리 파라미터: login_id (string)

응답:
200 OK

제안 JSON:
A. 사용 가능할 경우
// 사용 가능
{
  "available": true
}
and
B. 중복일 경우
// 중복
{
  "available": false,
  "message": "이미 사용 중인 아이디입니다."
}

-----------------------------------
** 회원가입 처리 

API:
POST /api/auth/signup
Content-Type: application/json

응답:
201 Created

제안 JSON:
A. 성공
{
  "success": true,
  "user_id": 42
}
and
B. 실패
{
  "success": false,
  "message": "이미 존재하는 아이디입니다."
}

JSON은 노션에 써둔 계약을 따름. 전부 string/birth는 데이터타입 date
-----------------------------------
/api/auth/signup (POST, JSON)

birth 타입은 date (브라우저에서 "YYYY-MM-DD"로 표기됨)

gender 타입은 "M" or "F" 로 함

phone 타입은 숫자만