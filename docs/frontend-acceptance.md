# Frontend acceptance — 2026-11-01

## Result and scope

**PASS for the frontend/mock phase (P1).** No blocking defect was identified in the tested flows. This is technical acceptance; teammate review and backend integration remain separate requirements.

Reviewed local source: `a75c49108384fe03325ba5b2869e48596c444fd3` on `fix/issue-1-pagination`, including pagination fix `b617d1b`. Checks ran against a clean export of this commit in temporary storage. Application code and existing screenshots in the working tree were not changed during acceptance.

References: `README.md`, `docs/design.md`, `docs/user-flow.md`, `docs/api-contract.md`, `docs/tasks.md`, and the acceptance criteria for issues #1–#4.

## Functional acceptance

| Area | Result | Evidence |
| --- | --- | --- |
| Home, Browse, Search | PASS | Mock cards, VND prices, category shortcuts, combined filters, sorting, URL state, empty results and working destinations |
| Pagination | PASS | Browse/Search load 50 → 63; filtered results load 50 → 51; counts and Load More update; sorting resets pagination |
| Pagination recovery | PASS | After a page-2 API failure, both Load More → Retry and Retry → Load More produce exactly 63 unique cards; changing sort during an outstanding request ignores the stale response |
| Product Detail | PASS | ID-dependent data, gallery switching, seller navigation, Available/Reserved/Sold states, guest login redirect, correct conversation and no self-chat |
| Profile | PASS | Public fields, data-based mock statistics, owner-only editing, validation, persistence and missing-profile state |
| Authentication | PASS | Register/Login/Logout, field errors, password toggles, duplicate-account and incorrect-password feedback, safe internal returnTo |
| Create/Edit Listing | PASS | Required fields, whole VND prices, 1–5 images, JPEG/PNG/WebP and size checks, previews/removal, ownership, Save/Cancel and persistent data/images |
| My Listings | PASS | Own listings, status filters/counts, valid transitions, final Sold status, Edit, Delete confirmation/cancel and persistent deletion |
| Chat | PASS | Two-account delivery, conversation selection, incoming/outgoing styles, chronological messages, Enter send, empty-message rejection, automatic scrolling and persistent history |
| Polling and API errors | PASS | after_id polling, cookies and contract payloads against simulated HTTP APIs; retries; hidden-tab/navigation cleanup; delayed responses cannot overwrite another selected thread |
| Responsive/accessibility basics | PASS | All 11 implemented screens at 320/390/768/801/1024/1440 px; mobile navigation and chat Back/selection; long-text wrapping; no horizontal overflow in tested states |
| Shared requirements | PASS | Semantic HTML, CSS, vanilla JavaScript, shared components/data adapter, English application copy, VND and no added framework |

The 12 reference panels are represented by 11 functional screens plus their responsive layouts. Layout structure was checked against the approved visual direction; this is not a pixel-exact certification.

## Checks completed

All six repository verification scripts passed:

- `frontend/scripts/verify-fe1.mjs`
- `frontend/scripts/verify-fe1-02.mjs`
- `frontend/scripts/verify-fe1-retry.mjs`
- `frontend/scripts/verify-fe2-01.mjs`
- `frontend/scripts/verify-fe2-02.mjs`
- `frontend/scripts/verify-catalog-pagination.mjs`

A supplementary local simulated-API check reproduced both orders of the previous Retry/Load More race and a sort change during loading. All passed without duplicate cards. This supplementary harness ran in temporary storage and is not a repository script.

No JavaScript exceptions or console errors were observed in the regression flows. `git diff --check` passed. Existing desktop/mobile evidence is under `docs/screenshots/fe1-01/`, `fe1-02/`, `fe2-01/` and `fe2-02/`; the latter includes tablet views and the mobile audit. README now describes the implemented mock frontend and progressive pagination.

## Remaining project work

- BE1/BE2 implementation and integration with an actual backend, including server-side ownership and conversation membership enforcement.
- Agreement on real profile update/statistics APIs; these are currently mock-only and are not defined in API v1.
- Joint FE1/FE2 review of shared navigation and responsive changes, recorded according to the contribution workflow.
- Hosted CI and GitHub Project completion records are not certified by this local acceptance.


