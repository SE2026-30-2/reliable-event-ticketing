-- DEV/CI ONLY. This file is NOT in the default Flyway location (db/migration): a production
-- database must never get a well-known admin password. It is applied only when
-- spring.flyway.locations also includes classpath:db/dev-seed (see .env.example). For a real
-- deployment create the first admin with the procedure in docs/setup.md ("Tạo ADMIN đầu tiên").
--
-- Bootstrap ADMIN account so the system is never stuck unable to call any ROLE_ADMIN-gated
-- endpoint on product-service/inventory-service/review-promotion-service (there is no other way
-- to create the very first admin - registration always assigns role USER, see
-- UserApplicationService#register).
--
-- Credentials (local/dev/CI only - override via docker-compose env vars for anything beyond that):
--   email:    admin@commerceforge.local
--   password: Admin@12345
--
-- The hash below is a real BCrypt digest of that password (strength 10, the default cost factor
-- of Spring Security's BCryptPasswordEncoder), generated once with the exact same encoder class
-- this application uses (org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder) and
-- verified with encoder.matches("Admin@12345", hash) == true before being committed here.
INSERT INTO users (id, email, password_hash, full_name, status, failed_login_attempts, email_verified, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001',
        'admin@commerceforge.local',
        '$2a$10$7O/oDHxCI3oGdFKjG7rFLu6FoNomPK0l/bNKnxMEBtg3NjMTJL54u',
        'CommerceForge Admin',
        'ACTIVE',
        0,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP);

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'ADMIN'),
       ('00000000-0000-0000-0000-000000000001', 'USER');
