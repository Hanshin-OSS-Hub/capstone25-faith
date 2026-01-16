CREATE TABLE members (
    member_id BIGSERIAL PRIMARY KEY,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    pw_id VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    gender VARCHAR(10),
    birth DATE,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
