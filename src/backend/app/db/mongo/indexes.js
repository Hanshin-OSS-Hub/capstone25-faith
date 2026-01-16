db.guest_verification_log.createIndex(
    { session_id: 1 },
    { unique: true }
);

db.guest_verification_log.createIndex(
    { verified_at: -1 }
);
