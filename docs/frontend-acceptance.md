# Frontend acceptance — API v1.1

## Result and scope

**PASS for local v1.1 functional and responsive acceptance.** Checked on 2026-11-11 (Asia/Ho_Chi_Minh) against merged baseline `b1b75da` (FE #24 and BE fixes `080cb15`), including the accompanying UI guidance, touch-target and responsive-audit changes.

This report covers issues #21 and #22 and the requirements in `design.md`, `user-flow.md`, `api-contract.md` and `tasks.md`. The 12 reference panels are represented by 11 functional screens and their responsive layouts. `item-detail.html` remains a compatibility redirect to Product Detail.

Real API integration uses FastAPI, SQLite and isolated browser accounts. Responsive checks use isolated mock storage with populated listings/conversations; mock results alone are not evidence of backend integration. Test databases, uploads and browser profiles are temporary and do not modify local demo data.

## Functional acceptance

| Area | Result | Evidence |
| --- | --- | --- |
| Authentication | PASS | Register/Login/Logout, normalized email login, backend-aligned name/password guidance, incorrect-password and duplicate-account feedback, safe internal `returnTo`, HTTP-only cookies |
| Create/Edit | PASS | Required markers and legend; integer quantity >= 1; total VND price; 0–5 optional images; later-upload guidance; image-free create, later upload, preserving/replacing/removing images and ownership |
| Product Detail | PASS | Gallery selection, loaded no-image placeholder, available quantity, immediate estimated-price updates, seller/profile links and contact flow |
| Proportional pricing | PASS | BigInt round-half-up arithmetic; `100000 / 3` gives `33333`, `66667`, `100000`; exact half-VND rounds up; full-quantity and large-value cases |
| Sold listings | PASS | Sold label, hidden quantity selector, unavailable new Chat; existing conversations remain readable |
| Home/Browse/Search | PASS | Cards, categories, keyword/combined filters, total-price filtering/sorting, URL synchronization, loading/empty/error states and destinations |
| Pagination/recovery | PASS | 50 → 63 and 50 → 51, unique cards, sort reset, repeated Load More/Retry clicks, page-two failures and stale-response isolation |
| Profile/My Listings | PASS | Real public statistics, optional cohort, save/retry/persistence, own listings, status transitions and delete confirmation |
| Chat | PASS | Two-account messages, chronological/persisted history, empty-message rejection, polling with `after_id`, membership checks and Mark Sold |
| Polling lifecycle/errors | PASS | Hidden-tab/navigation cleanup, delayed-thread isolation, expired sessions, offline/retry, cookies and CORS allowlist |
| Database/seed | PASS | 149 backend tests, including migration/backfill/defaults, retained prices/quantities/chat data and failed-migration rollback; repeated seed keeps 2 users, 10 items, 1 conversation and 3 messages |
| Shared requirements | PASS | English UI, semantic HTML, CSS and vanilla JavaScript, VND, existing endpoints, no checkout/payment or automatic inventory deduction |

The quantity estimate explicitly explains that selecting units does not place an order, reserve items or make a payment. Create/Edit explain that photos can be added later.

## Responsive and interaction audit

`verify-responsive.mjs` checks **320, 375, 430, 768, 1366 and 1920 CSS px**, using an 844px viewport height below 800px width and 1100px otherwise. All **115 page/state combinations passed**. In addition to the 11 screens, the audit includes image-free Detail/Edit, Sold, open navigation/filters and the populated mobile conversation list.

- No horizontal page overflow, controls outside the viewport, overlapping control groups/field labels or clipped button text in the checked states.
- Gallery thumbnails and filter radio labels are reachable; selecting a filter updates the URL/results. Native keyboard Enter opens mobile filters; Escape closes navigation and returns focus to its toggle.
- Populated Chat includes a long unbroken message. Its composer stays within the chat panel; mobile Back and conversation selection work.
- Common phone/tablet controls have at least 44px touch targets: menu/account, favorites, image removal, filter labels, password visibility, form actions, Chat Back and Send.
- Representative full-page screenshots at **320, 768 and 1366px** were visually reviewed for layout, wrapping, gallery/forms, filter panels, navigation, populated Chat and management controls. This is a layout/interaction audit, not pixel-exact certification or a full assistive-technology audit.

Machine-readable results: [responsive-results.json](screenshots/v1.1/responsive-results.json).

| Screen | Phone (320px) | Tablet (768px) | Desktop (1366px) |
| --- | --- | --- | --- |
| Home | [Screenshot](screenshots/v1.1/home-320.png) | [Screenshot](screenshots/v1.1/home-768.png) | [Screenshot](screenshots/v1.1/home-1366.png) |
| Browse, filters open | [Screenshot](screenshots/v1.1/browse-filters-open-320.png) | [Screenshot](screenshots/v1.1/browse-filters-open-768.png) | [Screenshot](screenshots/v1.1/browse-filters-open-1366.png) |
| Search, filters open | [Screenshot](screenshots/v1.1/search-filters-open-320.png) | [Screenshot](screenshots/v1.1/search-filters-open-768.png) | [Screenshot](screenshots/v1.1/search-filters-open-1366.png) |
| Detail/gallery | [Screenshot](screenshots/v1.1/detail-320.png) | [Screenshot](screenshots/v1.1/detail-768.png) | [Screenshot](screenshots/v1.1/detail-1366.png) |
| Login | [Screenshot](screenshots/v1.1/login-320.png) | [Screenshot](screenshots/v1.1/login-768.png) | [Screenshot](screenshots/v1.1/login-1366.png) |
| Register | [Screenshot](screenshots/v1.1/register-320.png) | [Screenshot](screenshots/v1.1/register-768.png) | [Screenshot](screenshots/v1.1/register-1366.png) |
| Create | [Screenshot](screenshots/v1.1/create-320.png) | [Screenshot](screenshots/v1.1/create-768.png) | [Screenshot](screenshots/v1.1/create-1366.png) |
| Edit, five images | [Screenshot](screenshots/v1.1/edit-320.png) | [Screenshot](screenshots/v1.1/edit-768.png) | [Screenshot](screenshots/v1.1/edit-1366.png) |
| Profile | [Screenshot](screenshots/v1.1/profile-320.png) | [Screenshot](screenshots/v1.1/profile-768.png) | [Screenshot](screenshots/v1.1/profile-1366.png) |
| My Listings | [Screenshot](screenshots/v1.1/my-listings-320.png) | [Screenshot](screenshots/v1.1/my-listings-768.png) | [Screenshot](screenshots/v1.1/my-listings-1366.png) |
| Populated Chat | [Screenshot](screenshots/v1.1/chat-320.png) | [Screenshot](screenshots/v1.1/chat-768.png) | [Screenshot](screenshots/v1.1/chat-1366.png) |

Additional evidence: [image-free Detail](screenshots/v1.1/no-image-320.png), [image-free Edit](screenshots/v1.1/edit-no-image-320.png), [Sold](screenshots/v1.1/sold-320.png), [open mobile navigation](screenshots/v1.1/navigation-open-320.png), [mobile conversation list](screenshots/v1.1/chat-conversations-320.png).

## Verification and reproduction

All nine frontend scripts passed on the merged code with these follow-up changes:

- `node frontend/scripts/verify-pricing.mjs`
- `node frontend/scripts/verify-fullstack.mjs` — actual FastAPI/SQLite integration, including v1.1 image/quantity flows.
- `node frontend/scripts/verify-responsive.mjs` — six-width layout/interaction audit and current screenshots.
- `node frontend/scripts/verify-catalog-pagination.mjs`
- `node frontend/scripts/verify-fe1-retry.mjs`
- `node frontend/scripts/verify-fe1.mjs`
- `node frontend/scripts/verify-fe1-02.mjs`
- `node frontend/scripts/verify-fe2-01.mjs`
- `node frontend/scripts/verify-fe2-02.mjs`

The original FE1 layout scripts need a static frontend server (`FRONTEND_URL`, default `http://127.0.0.1:5500`). Other browser scripts launch their own temporary servers. See [README verification](../README.md#verification) for Python/Chrome configuration. Set `SCREENSHOTS_DIR` to an absolute temporary directory when verifying without replacing tracked evidence.

Backend verification: `cd backend && .venv/bin/python -m pytest -q` (149 passed). JavaScript syntax checks and `git diff --check` also passed. Browser regressions reported no uncaught JavaScript errors in the tested flows.

## Scope limits and history

These are local browser/API results. Physical-device keyboards, screen readers, hosted deployment/CI and GitHub Project completion records are not certified by this report. Review/merge of the accompanying follow-up changes is separate from technical acceptance.

The earlier P1/mock acceptance at `a75c491` remains historical context; its pending-backend statements and 1–5-image requirement are superseded by the verified v1.1 outcomes above. Earlier screenshots under `fe1-01`, `fe1-02`, `fe2-01` and `fe2-02` are retained; use `screenshots/v1.1` for current quantity/optional-image evidence.
