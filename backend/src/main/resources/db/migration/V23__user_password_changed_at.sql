-- Tokens issued before a password change are rejected.
ALTER TABLE app_users
    ADD COLUMN password_changed_at TIMESTAMPTZ;
