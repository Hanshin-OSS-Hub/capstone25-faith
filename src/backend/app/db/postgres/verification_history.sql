CREATE TABLE verification_history (
    verification_id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NULL,
    input_content VARCHAR(20) NOT NULL,
    risk_detail_id BIGINT,
    final_risk_score NUMERIC(3,2),
    risk_level VARCHAR(20),
    verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_verification_member
        FOREIGN KEY (member_id)
        REFERENCES members(member_id)
        ON DELETE SET NULL
);
