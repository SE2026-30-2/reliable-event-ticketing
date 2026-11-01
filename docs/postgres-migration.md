# Move existing databases to the shared PostgreSQL container

The Compose configuration starts one PostgreSQL 16 container with the
`identity_service` and `ticketing_platform` databases. Their owners are
`identity_app` and `ticketing_app`, with the existing `IDENTITY_DB_PASSWORD`
and `TICKETING_DB_PASSWORD` values. `POSTGRES_ADMIN_PASSWORD` is the optional
administrator password; if it is unset at first initialization, it defaults
to `IDENTITY_DB_PASSWORD`. Initialization happens only when the new
`postgres-data` volume is empty. Changing passwords in `.env` later does not
change the passwords stored in PostgreSQL; use `ALTER ROLE` as well.

For a new installation, run `docker compose up -d --build` as usual. The new
volume starts empty and Flyway creates each service's schema.

For an existing installation, migrate **before starting the applications**.
The previous `postgres-identity-data` and `postgres-ticketing-platform-data`
volumes remain intact, but are not read automatically by the new container.
The commands below use the previous Compose container names and `docker cp`,
which preserves the binary backups on both PowerShell and Unix shells. Keep
all application writers stopped until both restores finish. The dump files
contain application data; store and remove them according to your needs.

1. Stop the applications and the new PostgreSQL container, then start the old
   PostgreSQL containers. Wait until both accept connections:

   ```sh
   docker compose stop frontend identity-service ticketing-platform postgres
   docker start postgres-identity-service postgres-ticketing-platform
   docker exec postgres-identity-service pg_isready -U postgres
   docker exec postgres-ticketing-platform pg_isready -U postgres
   ```

2. Create independent backups and copy them to the current directory:

   ```sh
   docker exec postgres-identity-service pg_dump -U postgres -d identity_service -Fc --no-owner --no-acl -f /tmp/identity.dump
   docker exec postgres-ticketing-platform pg_dump -U postgres -d ticketing_platform -Fc --no-owner --no-acl -f /tmp/ticketing.dump
   docker cp postgres-identity-service:/tmp/identity.dump ./identity.dump
   docker cp postgres-ticketing-platform:/tmp/ticketing.dump ./ticketing.dump
   docker stop postgres-identity-service postgres-ticketing-platform
   ```

3. Start the new PostgreSQL container and wait for it to become healthy:

   ```sh
   docker compose up -d postgres
   docker inspect --format '{{.State.Health.Status}}' postgres
   ```

   Restore only into newly initialized, empty databases. If either query below
   returns anything other than `0`, stop and preserve the existing destination
   data; do not run the restore over it.

   ```sh
   docker exec postgres psql -U postgres -d identity_service -tAc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')"
   docker exec postgres psql -U postgres -d ticketing_platform -tAc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')"
   ```

4. Copy and restore both backups. `--single-transaction` rolls back each
   database's restore if it encounters an error. The old volumes and backups
   remain available if a restore fails.

   ```sh
   docker cp ./identity.dump postgres:/tmp/identity.dump
   docker cp ./ticketing.dump postgres:/tmp/ticketing.dump
   docker exec postgres pg_restore -U identity_app -d identity_service --no-owner --no-acl --exit-on-error --single-transaction /tmp/identity.dump
   docker exec postgres pg_restore -U ticketing_app -d ticketing_platform --no-owner --no-acl --exit-on-error --single-transaction /tmp/ticketing.dump
   ```

5. Verify the restored records and Flyway history, then start the application:

   ```sh
   docker exec postgres psql -U identity_app -d identity_service -c "SELECT version, success FROM flyway_schema_history ORDER BY installed_rank"
   docker exec postgres psql -U ticketing_app -d ticketing_platform -c "SELECT version, success FROM flyway_schema_history ORDER BY installed_rank"
   docker compose up -d --build
   ```

Keep the previous key volumes: existing JWT and ticket-signing keys are needed
for tokens and tickets issued before migration. The old database volumes can be
kept as a rollback copy until the restored data has been verified.
