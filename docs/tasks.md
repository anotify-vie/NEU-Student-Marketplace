# FOUR-PERSON WORK ASSIGNMENTS — NEU Student Marketplace

## Shared objective

Reproduce **all 12 panels of the approved English mockup**, including the full **guest browse → search → detail → login → chat → seller marks sold** flow and **seller creates → manages/edits → sells** flow. Frontend uses **HTML/CSS/vanilla JavaScript** following instructor Weeks 2–5. Backend uses the proposed FastAPI + SQLite stack informed by Week 6. No checkout/payment. Demonstrate a real transaction workflow with two user accounts. **All interface copy must be in English.**

## Phase-based plan (not fixed to particular weeks)

- **P0 — Approve contract (all four):** Read README, design, flows and API. FE teammates agree on shared components/CSS tokens; BE teammates approve models and endpoints. No unilateral contract edits.
- **P1 — Frontend first (FE1 + FE2):** Build every page from the English mockup with mock data and the shared `api.js` adapter. Every PR must include desktop/mobile screenshots. Backend need not be running yet.
- **P2 — Backend second (BE1 + BE2):** Implement API, DB, seed, Swagger and security exactly matching the approved contract. FE1/FE2 help connect `api.js` to real endpoints and fix integration issues.
- **P3 — Integration and demo (all four):** Merge incrementally, test end to end, capture evidence and finalize setup instructions.

## Member 1 — FE1: Home, Browse, Search, Detail, Profile and shared navigation

**Primary files:** `frontend/index.html`, `frontend/pages/listings.html`, `search.html`, `item-detail.html`, `profile.html`, `frontend/css/base.css`, `components.css`, `frontend/js/mock-data.js`, `frontend/js/listings.js`, `search.js`, `item-detail.js`, `frontend/assets/`.

**Task checklist:**

- [ ] **FE1-01:** Create semantic HTML skeleton, `lang="en"`, viewport, shared header/nav/footer and CSS variables from `design.md`.
- [ ] **FE1-02:** Reusable product cards, formatted VND prices, condition/status badges. Prepare at least eight mock listings: textbooks, Karate uniforms, calculator, backpack, etc.
- [ ] **FE1-03:** Home panel #1: hero, search, category tiles, recently listed products, Create Listing CTA.
- [ ] **FE1-04:** Browse panel #2: category/condition/price sidebar, sorting, dynamically update product grid from mock data, synchronize URL query.
- [ ] **FE1-05:** Search panel #11: read `q`, filter/render search results, empty state and item-detail links.
- [ ] **FE1-06:** Item Detail panel #3: gallery/thumbnails, description, location, seller; Chat button redirects guests to Login, opens conversation for authenticated buyers, no self-chat.
- [ ] **FE1-07:** Profile panel #8: properly public profile info, do not expose other users' private email without authorization; consistent mock user data.
- [ ] **FE1-08:** Document API calls for owned screens, connect mock → shared `api.js`, test loading/empty/error UI states.

**Done when:** panels #1, #2, #3, #8 and #11 match mockup layouts; navigation works, search/filters/card interaction are functional (not static), mobile has no overflow. PR includes five desktop screenshots and at least two mobile screenshots.

## Member 2 — FE2: Authentication, Create/Edit, Chat, My Listings and responsive audit

**Primary files:** `frontend/pages/login.html`, `register.html`, `create-listing.html`, `edit-listing.html`, `chat.html`, `my-listings.html`, `frontend/css/forms.css`, `responsive.css`, `frontend/js/api.js`, `auth.js`, `create-listing.js`, `edit-listing.js`, `chat.js`, `my-listings.js`.

**Task checklist:**

- [ ] **FE2-01:** Login panel #5: accessible labels, email/password validation, errors, safe internal `returnTo` redirect.
- [ ] **FE2-02:** Register panel #6: name/email/password/confirmation; check that passwords match.
- [ ] **FE2-03:** Create Listing panel #4: text fields, category, price, condition, description, location, preview 1–5 images, validation and mock submit.
- [ ] **FE2-04:** Edit Listing panel #10: load item by ID, allow owner to edit data/images, show success/error feedback.
- [ ] **FE2-05:** My Listings panel #9: status tabs, edit, delete confirmation, mark reserved/available/sold.
- [ ] **FE2-06:** Chat panel #7: conversation sidebar, message thread, message composer, no-conversations/no-messages/loading/error states.
- [ ] **FE2-07:** Build shared `js/api.js` with clearly named functions and MOCK/REAL modes; use `fetch`, `async/await`, `try/catch`, and `credentials: 'include'` in REAL mode.
- [ ] **FE2-08:** Audit `responsive.css` for all 12 panels; coordinate with FE1 on nav, filters, form and chat mobile issues. Do not edit FE1-owned shared files without discussion.

**Done when:** panels #4, #5, #6, #7, #9, #10 and responsive panel #12 match; forms validate; every CTA has defined behavior; mock chat/status work; PR includes six desktop screenshots and a mobile audit.

## Member 3 — BE1: Authentication, Database, Product CRUD and Uploads

**Primary files:** `backend/main.py`, `database.py`, `models/user.py`, `models/item.py`, `schemas/user.py`, `schemas/item.py`, `routers/auth.py`, `routers/items_crud.py`, `routers/uploads.py`, `requirements.txt`, `.env.example`, demo seed users/items.

**Task checklist:**

- [ ] **BE1-01:** Initialize FastAPI, SQLite, user/item models and relationships; virtual environment, requirements, `/docs`, restricted CORS allowlist.
- [ ] **BE1-02:** Register/login/logout/me with password hashing and HTTP-only session cookie; correct 401/409 errors; never store plaintext passwords.
- [ ] **BE1-03:** Safe public user profile, `GET /api/users/{id}`.
- [ ] **BE1-04:** Item detail/create/update/delete/my-items, ownership checks, server validation for enums/prices/lengths/images.
- [ ] **BE1-05:** JPEG/PNG/WebP upload, max 5 MB each, safe random filenames and URLs; max 5 images per item; never expose filesystem paths.
- [ ] **BE1-06:** Seed at least two demo users and eight items (no real passwords committed). Test CRUD/auth and 401/403/404/422, with useful Swagger examples.
- [ ] **BE1-07:** Document initialization, running/resetting DB and demo credentials; help BE2 share schema and dependencies.

**Done when:** browser cookie authentication works, items and images persist across refreshes, other users cannot edit the owner's listings, backend installs from requirements and basic tests pass.

## Member 4 — BE2: Search/Filter, Messaging, Status and Integration Testing

**Primary files:** `backend/routers/search.py`, `routers/conversations.py`, `routers/status.py`, `models/conversation.py`, `models/message.py`, `schemas/chat.py`, relevant `backend/tests/` and demo scripts.

**Task checklist:**

- [ ] **BE2-01:** `GET /api/items`: query, category, price range, condition, status, sorting and pagination; response `{items,total,page,page_size}`.
- [ ] **BE2-02:** `PATCH /api/items/{id}/status`: validate allowed transitions and owner; no new conversation on sold items.
- [ ] **BE2-03:** Conversation/Message DB models, enforce buyer/seller-only access, no self-chat and no duplicate conversation for the same buyer/item.
- [ ] **BE2-04:** Conversation list, get-or-create, message list and send; timestamps and message text validation.
- [ ] **BE2-05:** Simple `after_id` polling to fetch only new messages; verify with multiple accounts and unauthorized/forbidden tests.
- [ ] **BE2-06:** Automated API tests for search/filter/sort/pagination/chat/status plus 404/403/401, malformed requests and empty results.
- [ ] **BE2-07:** Lead end-to-end tests alongside both FE teammates: search → detail → chat → mark sold; log/fix integration issues; contribute demo script.

**Done when:** two real accounts can chat and messages persist after reload, server filters/sorts are correct, unauthorized users cannot read chat, listing and detail display consistent status, endpoints are tested and visible in Swagger.

## Ownership and collaboration

- FE1 owns `base.css`, `components.css`, header and mock data. FE2 owns `api.js` and responsive audit. Both agree on interfaces before implementation; changes to shared files require cross-review.
- BE1 owns User/Item models, DB setup and auth. BE2 owns Conversation/Message, search and status. Before coding, agree on SQLModel/SQLAlchemy schemas, imports, DB session dependency and router pattern.
- FE starts first, but BE reviews contracts at P0; do not invent inconsistent payload names.
- Each member reviews at least one teammate's PR. Every merge to `main` requires a reviewer and screenshots (UI) or test logs (API).

## Definition of Done (each task)

1. Meets `docs/design.md`, `docs/user-flow.md`, `docs/api-contract.md`.
2. Does not break existing pages/endpoints; no console errors or backend traceback during the happy path.
3. Includes appropriate manual verification and invalid-input/unauthorized tests when applicable.
4. Includes UI screenshots or Swagger/test evidence; updates documentation for approved changes.
5. Has a reviewed and merged PR; GitHub Project task moved to Done.

## System acceptance checklist

- [ ] Guests can search and view textbooks/uniforms without logging in.
- [ ] Filter/sort works in mock and real API; search has an empty state.
- [ ] Register/login/logout and `returnTo` work.
- [ ] Seller creates a listing with an image; image still loads after refresh.
- [ ] Seller edits/deletes, marks reserved/available/sold.
- [ ] Buyer chats with seller; seller replies; history survives refresh.
- [ ] Other users cannot edit listings or read private chats.
- [ ] Mobile layout is intact; all 12 reference panels are represented.
- [ ] All four people have traceable commits/PRs; clean-clone setup documentation works.
- [ ] All UI copy, validation messages and demo examples are in English. Product prices remain VND.

## Standard AI handoff prompt

> You are team member [FE1/FE2/BE1/BE2] working on NEU Student Marketplace. Read `README.md`, `docs/design.md`, `docs/user-flow.md`, `docs/api-contract.md`, `docs/tasks.md` and view `docs/images/marketplace-mockup.png`. Implement **only** the checklist assigned to your role and respect file ownership, technical requirements and API v1. Frontend must use semantic HTML, CSS and vanilla JavaScript without adding a framework; backend must use Python, FastAPI and SQLite. All user-facing strings and documentation must be in English. Before coding, list files to create/edit, dependencies, endpoints and functions required. After coding, test happy paths and error/empty states, check contract compatibility and provide run instructions and evidence. Do not invent checkout/payment features or replace the approved visual direction.


---

## v1.1 change request — Issues #21 and #22

Implementation checklists verified locally on 2026-11-11 after merging BE #23, BE fixes `080cb15` and FE #24. See [frontend-acceptance.md](frontend-acceptance.md) for real-API results, the six-width audit, screenshots and verification limits. Earlier phase checklists are unchanged.


**Decision gate (before implementation):** FE and BE agree on `docs/api-contract.md` v1.1, including `quantity`, total-price semantics, optional images, image replacement semantics, rounding, legacy-data migration and actual auth validation rules. Obtain team approval and merge the docs PR to `main` first. Do not change previously completed issue checklists retroactively.

### Issue BE — `[BE] Support listing quantities, optional images and proportional pricing`

**Scope / tasks**

- [x] Verify existing backend account validation and document actual email/display name/password constraints; keep email-only login.
- [x] Add `quantity` (integer >= 1, default 1) to Item models, create/edit/read schemas and all embedded item responses. Preserve `price` as total listed VND price.
- [x] Implement a safe SQLite migration/backfill for existing rows (`quantity=1`, retain current prices); do not delete or reset data.
- [x] Allow `image_urls=[]` or omission on create and optional later image uploads; preserve owner permissions, max five images and upload security.
- [x] Keep PATCH partial-update semantics, including complete-list replacement for supplied `image_urls`; omitted fields remain unchanged.
- [x] Ensure pricing interpretation/round-half-up rule is documented and consistent; do not introduce a checkout or dedicated pricing endpoint.
- [x] Update tests for no-image create, owner adding photos later, invalid quantities, unchanged legacy prices, partial updates, permissions and regression of auth/chat/search.

**BE acceptance:** Create no-image listing succeeds; item responses expose positive quantity; existing data migrates safely; owner adds/removes images without unintended loss; all backend tests pass.

### Issue FE — `[FE] Improve listing forms, quantity pricing and responsive layouts`

**Scope / tasks**

- [x] Display backend-aligned email/display-name/password hints on login/register; no unsupported username login.
- [x] Mark Create/Edit required fields with red `*` plus a textual `* Required fields` legend; mark product images `(Optional)`.
- [x] Allow 0–5 images on create and image upload after creation; preserve existing image URLs when appending.
- [x] Add integer Quantity (default 1) and **Total Price (VND)** inputs on Create/Edit with validation and clear explanatory text.
- [x] Show a no-image placeholder; on Item Detail add available quantity, selector `1..quantity` and round-half-up proportional estimated-price display; do not create cart/payment/inventory logic.
- [x] Keep existing price-based Browse/Search filtering/sorting based on total listing price and label appropriately.
- [x] Update API adapter and mock data to match the agreed v1.1 item shape; integrate real API once BE is merged.
- [x] Audit desktop, tablet and mobile layouts (320, 375, 430, 768, 1366 and 1920 CSS px): nav, grids, forms, gallery, buttons, chat and filters; no overflow or overlapping elements.
- [x] Add focused regression checks and desktop/mobile evidence; confirm real API flows including optional photos and quantity price calculations.

**FE acceptance:** Valid no-image create/edit works; required/optional fields clear; calculated prices agree with contract; no broken responsive screens; existing auth, Browse/Search, Detail and Chat continue working.

### Parallel execution and merge order

1. **Docs contract approval → merge docs PR first.** Confirm password validation in actual backend before publishing exact UI hints.
2. From updated `main`, BE works in `feat/be-listing-quantity-images` while FE works in `feat/fe-listing-responsive-quantity` (mock-first; no guessing API fields).
3. BE PR receives review, tests and merges to `main`.
4. FE updates from `main`, completes REAL-mode integration and full-stack/mobile verification, then opens/merges FE PR.
5. Update `docs/frontend-acceptance.md` and `README.md` with *verified* outcomes after integration.

**Out of scope:** checkout, cart, payments, transactions, automatic stock decrement and new auth methods. Keep the existing tech stack and MVP visuals.
