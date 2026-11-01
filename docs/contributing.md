# CONTRIBUTING — Git and Pull Request Workflow

## Branches

- `main` is the stable protected branch; never push directly.
- Example branches: `fe1/home-browse-detail`, `fe2/auth-selling-chat`, `be1/auth-products`, `be2/search-chat-status`. Prefer short, issue-scoped branches, e.g. `fe1/issue-12-home`.
- Do not let two teammates edit the same shared file simultaneously without coordinating.

## Getting started

```bash
git clone <REPOSITORY_URL>
cd <REPO_FOLDER>
git checkout main
git pull origin main
git checkout -b fe1/issue-12-home
# Implement and test
git add .
git commit -m "feat(frontend): build home page"
git push -u origin fe1/issue-12-home
```

Open a **Pull Request → main** and request review before merging. Update your local main before starting another task:

```bash
git checkout main
git pull origin main
```

If there is a merge conflict, deliberately sync from main and resolve it. **Never blindly use `git reset --hard` or force-push**: this can destroy another person's work.

## GitHub Project board

Columns: `Backlog` → `Ready` → `In Progress` → `Review` → `Done`.

Create four issue groups by role, one issue per checklist item from `tasks.md` (`FE1-01`, `FE1-02`, etc.). Each issue must contain the objective, affected files, acceptance criteria, relevant mockup panel and assignee. Keep one clear primary owner even when another person helps.

## Minimum PR template

```markdown
## Task / Issue
Closes #<issue-number>
## Screens / APIs implemented
...
## Files changed
...
## Verification
- [ ] Happy path
- [ ] Empty / Error / Unauthorized where relevant
- [ ] Responsive layout (frontend)
## Evidence
Desktop/mobile screenshots (frontend), or test and Swagger output (backend).
## Contract changes
None / Link to approved contract-change PR
```

## Review rules

- FE work is reviewed by the other FE developer; BE work by the other BE developer; integration PRs need reviewers from both sides.
- Do not merge UI with dead buttons, missing tests or API deviations.
- Do not commit `.env`, `.venv`, `__pycache__`, SQLite DB, private uploads or `node_modules`.
- Record decisions in issues/PR comments instead of relying solely on ephemeral messages.
