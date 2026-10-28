-- Optional 10-digit mobile number on each user, so people can log in with
-- their mobile number or their email. Existing users keep logging in by email
-- until an admin adds their number.
ALTER TABLE app_users
    ADD COLUMN phone VARCHAR(10),
    ADD CONSTRAINT chk_app_users_phone CHECK (phone ~ '^[6-9][0-9]{9}$');

CREATE UNIQUE INDEX ux_app_users_phone ON app_users (phone) WHERE phone IS NOT NULL;
