# Repository Guidance

## Project boundaries

- This repository contains `backend/identity-service`, `backend/ticketing-platform`,
  `frontend`, and `mobile`. Keep changes within the requested area.
- The ticketing platform is a modular monolith. Keep business logic inside its
  existing module (`catalog`, `payment`, `checkin`, or `notification`) and use
  established shared abstractions only when the behavior is genuinely shared.
- Treat API routes, request/response DTOs, database schemas, Flyway migrations,
  authentication, event names, and Docker Compose configuration as shared
  contracts. Do not change them incidentally.
- Do not copy code from another repository or introduce a new framework,
  dependency, service, module, or architectural pattern without approval.

## Before changing code

- Read the relevant module and its tests before editing. Follow the conventions
  already present in that module.
- Check related API and architecture documentation under `docs/`.
- State the intended scope and files to change when using an AI coding tool.
- Ask before expanding scope into another service or changing a shared contract.

## Implementation rules

- Make the smallest cohesive change that satisfies the task.
- Preserve existing user changes. Never overwrite `.env`, local IDE settings,
  generated files, or unrelated work.
- Never commit secrets. Use `.env.example` for documented variable names and
  safe placeholders; keep real credentials in the ignored `.env`.
- Database changes must use a new Flyway migration. Do not edit a migration that
  may already have been applied. Consider existing Docker volumes and follow
  `docs/postgres-migration.md` before changing database topology.
- Keep frontend and mobile API changes aligned with the backend contract and
  update relevant documentation and tests.
- Do not mark tests as passing unless they were run. Report skipped checks and
  environmental blockers explicitly.

## Validation

Run checks for each affected area:

- Backend service: from its directory, run `./mvnw -B -ntp verify` (Windows:
  `.\mvnw.cmd -B -ntp verify`).
- Frontend: from `frontend`, run `npm ci`, `npm run lint`, `npm run test:unit`,
  and `npm run build`.
- Mobile: follow `mobile/AGENTS.md`; run its lint and type-check commands.
- Docker or shared configuration: run `docker compose --env-file .env.example
  config --quiet` when Docker Compose is available.

Do not run commands that delete volumes or reset local databases unless the
request explicitly requires it and the affected data has been identified.
