\set ON_ERROR_STOP on
\getenv identity_password IDENTITY_DB_PASSWORD
\getenv ticketing_password TICKETING_DB_PASSWORD

CREATE ROLE identity_app LOGIN PASSWORD :'identity_password';
CREATE ROLE ticketing_app LOGIN PASSWORD :'ticketing_password';

CREATE DATABASE identity_service OWNER identity_app;
CREATE DATABASE ticketing_platform OWNER ticketing_app;

REVOKE CONNECT ON DATABASE identity_service FROM PUBLIC;
REVOKE CONNECT ON DATABASE ticketing_platform FROM PUBLIC;
GRANT CONNECT ON DATABASE identity_service TO identity_app;
GRANT CONNECT ON DATABASE ticketing_platform TO ticketing_app;
