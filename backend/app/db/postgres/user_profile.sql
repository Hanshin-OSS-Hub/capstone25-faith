CREATE TABLE user_profile (
    profile_id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL UNIQUE,
    age_group VARCHAR(20),
    occupation VARCHAR(50),
    is_risk BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_user_profile_member
        FOREIGN KEY (member_id)
        REFERENCES members(member_id)
        ON DELETE CASCADE
);
