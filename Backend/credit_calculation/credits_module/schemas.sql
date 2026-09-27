CREATE TABLE project_credits (
    id INTEGER PRIMARY KEY,
    project_id TEXT,
    total_shadow_credits REAL,
    verified_credits REAL,
    certificate_id TEXT,
    issuance_date DATE,
    expiry_date DATE
);

CREATE TABLE funding_details (
    id INTEGER PRIMARY KEY,
    project_id TEXT,
    price_per_ton REAL,
    ecosystem_multiplier REAL,
    total_funding REAL
);