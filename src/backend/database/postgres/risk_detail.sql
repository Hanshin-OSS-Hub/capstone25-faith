CREATE TABLE risk_detail (
    risk_detail_id BIGSERIAL PRIMARY KEY,
    verification_id BIGINT NOT NULL,
    risk_category VARCHAR(50) NOT NULL,
    weight NUMERIC(4,2) NOT NULL,
    individual_risk_score NUMERIC(4,2) NOT NULL,
    final_risk_score NUMERIC(4,2),
    risk_level VARCHAR(20),
    CONSTRAINT fk_risk_verification
        FOREIGN KEY (verification_id)
        REFERENCES verification_history(verification_id)
        ON DELETE CASCADE
);
