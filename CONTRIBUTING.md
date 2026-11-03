# Contributing

This guide applies to humans and AI-assisted contributions. Keep changes scoped,
reviewable, and consistent with the existing architecture.

## Ownership

- Repository and integration ownership: `@dinhhoang0712` for CI, shared contracts,
  Compose, and repository-wide guidance.
- Frontend: `@duy-301205` and `@Quincy15th`. Coordinate API changes with backend
  owners before changing request or response contracts.
- Mobile: `@Quincy15th`; also follow `mobile/AGENTS.md`.
- Backend: `@dinhhoang0712`, `@cuong4205`, and `@duchaiz1001` for assigned
  services/modules under `backend/`. Coordinate before editing another person's
  module.
- Ownership is enforced through `.github/CODEOWNERS`. Keep these users as
  repository collaborators with write access, or GitHub cannot request their
  reviews.

## Branches and commits

- Do not commit directly to `main`.
- Create a branch from the latest `main`: `feat/<short-name>`,
  `fix/<short-name>`, `docs/<short-name>`, or `chore/<short-name>`.
- Keep each branch focused on one task. Coordinate before editing shared
  contracts or files another contributor is actively changing.
- Use Conventional Commit subjects, for example:
  `feat(payment): add payment status endpoint`
  `fix(identity): reject expired refresh tokens`
  `docs: clarify local Docker setup`
- Do not include unrelated formatting, generated output, local configuration,
  credentials, or another contributor's changes in a commit.

## AI-assisted work

- Give the coding tool a specific task, scope, and acceptance criteria.
- Require it to inspect existing code and tests before editing.
- Review every changed file and the final diff yourself; generated code is not
  exempt from review.
- Do not allow an AI tool to silently widen scope, change public contracts,
  add dependencies, rewrite migrations, or alter Docker/data configuration.
- Require a summary of files changed, checks run, and checks not run.

## Pull requests

- Open a pull request against `main`; do not push directly to `main`.
- Keep the PR focused and small enough to review. Split unrelated work.
- Fill in `.github/PULL_REQUEST_TEMPLATE.md`, link the issue/task, and describe
  any API, database, security, Docker, or environment-variable impact.
- Add or update tests for behavior changes and documentation for workflow or
  contract changes.
- Request review from the owner of the affected service/module. Shared contract
  or infrastructure changes also require project-lead review.
- Resolve review feedback and ensure required CI checks pass before merging.

## Required local checks

Run checks for every area changed, using the commands listed in the root
`AGENTS.md` and `mobile/AGENTS.md`. The CI workflow is the final source of truth
for checks required by GitHub.

Never report a check as passing unless it completed successfully. Mention any
checks skipped due to missing tools, services, or environment configuration.

## GitHub repository settings

The repository administrator should protect `main` by requiring pull requests,
at least one approving review, and all CI status checks before merge. Disable
force pushes and deletion of `main`. Configure actual owners in
`.github/CODEOWNERS`; role names alone cannot trigger GitHub review requests.
