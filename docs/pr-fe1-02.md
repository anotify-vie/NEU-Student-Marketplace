## Closes

Refs #2.

Keep #2 open until the FE2 Login and Chat destinations are integrated, the profile update API is agreed with BE1, and a teammate verifies the complete cross-page flow. This PR implements the Product Detail and Profile interfaces in mock mode.

This branch is stacked on `fe1/issue-1-home-browse-search`: the fetched `origin/main` still contains only the starter project. Review or retarget the branch after FE1-01 is merged so this PR shows only FE1-02 changes.

## What changed

Added `pages/product-detail.html` with an image gallery, clickable thumbnails, VND price, category, condition, posting date, description, meeting location, seller profile link, listing status, demo favorites, and a Chat with Seller action. Sold items cannot start a new conversation. Missing item IDs show a clear error state. The older `pages/item-detail.html?id=...` URL redirects to the new route without losing the ID, and product cards now link to the new route.

Added `pages/profile.html` with a campus cover, avatar, public student information, listing statistics, and an owner-only Edit Profile form. The mock form validates inputs, saves changes in browser local storage, and restores them after reload. Public seller profiles do not show the edit control or private email fields. Shared styles and the existing navigation are reused.

Extended the shared API adapter with `getItem`, `getUser`, `getUserStats`, `getCurrentUser`, `updateProfile`, `openConversation`, and `getConversations`. Product detail and public user reads have Fetch API paths matching `docs/api-contract.md`. The header now reads `getCurrentUser()` in both mock and real modes, so a successful `/api/auth/me` shows Profile and a 401 shows Log In. Home, Product Detail, and Profile show a Retry action after loading fails.

Mock conversations are created once per `(buyer_id, item_id)` and persisted in local storage under `neu-marketplace-demo-conversations-v1`. Each record contains `id`, `item_id`, `buyer_id`, `seller_id`, and `updated_at`; `getConversations()` returns records for the signed-in buyer or seller. FE2 Chat should read this shared adapter and resolve `chat.html?conversationId=...` against those records. The real-mode conversation methods retain the endpoints in `docs/api-contract.md`. The current contract does not define a profile update or statistics endpoint, so real-mode profile editing remains pending BE1 agreement. Added three non-available mock items to demonstrate Reserved and Sold status without changing the available Browse catalogue.

## How to test it

From the repository root, with Python, Node 24, and Chrome installed:

1. Run `python -m http.server 5500 --bind 127.0.0.1 --directory frontend`.
2. In another terminal, run `node frontend/scripts/verify-fe1-02.mjs` and `node frontend/scripts/verify-fe1-retry.mjs`.
3. Open `http://127.0.0.1:5500/pages/product-detail.html?id=101` and `http://127.0.0.1:5500/pages/profile.html` for visual review.
4. Check `product-detail.html?id=113` for Sold, `product-detail.html?id=115` for Reserved, `product-detail.html?id=999` for the missing-item state, and `profile.html?id=2` for the seller's public profile.
5. To manually preview owner editing in mock mode, set `sessionStorage.setItem('neu-marketplace-demo-user-id','1')` in the browser console and reload `profile.html`. Without that demo session, the public profile remains readable but Edit Profile is hidden.

The browser scripts also check a product-card link, all three thumbnails, seller-profile navigation, guest and demo-authenticated Chat routing, distinct conversations for two buyers of one item, conversation persistence after reload, owner-only editing, invalid-form feedback, profile persistence, missing profiles, loaded images, and overflow at 320, 390, 768, and 1440 px. The real-mode script simulates `/api/auth/me` returning 200 and 401 and each page's API returning 503 before a successful Retry. Run `node frontend/scripts/verify-fe1.mjs` to repeat the FE1-01 regression checks.

## Screenshot / output

Local browser verification passed:

`PASS: detail and profile at 320/390/768/1440 px; thumbnails, statuses, seller navigation, guest/auth chat routing, owner edit and validation, persistence, missing states; no JavaScript console errors on implemented pages.`

`PASS: real-mode /auth/me 200 shows Profile; 401 shows Log In; Home, Detail and Profile recover through Retry after 503.`

- Product Detail desktop: `docs/screenshots/fe1-02/product-detail-desktop.png`
- Product Detail mobile: `docs/screenshots/fe1-02/product-detail-mobile.png`
- Profile desktop: `docs/screenshots/fe1-02/profile-desktop.png`
- Profile mobile: `docs/screenshots/fe1-02/profile-mobile.png`

Chat and Login are FE2 dependencies and are not present in the fetched repository. The buttons route to their intended URLs, but those destination pages cannot be exercised end to end yet. The profile update and statistics APIs are also not defined in API v1; the demo uses local mock data and local storage.

---

## Definition of Done

- [ ] Every acceptance criterion on #2 passes end to end, including FE2 destinations.
- [ ] The code has been verified from a clean clone.
- [x] Product ID, gallery, status, seller link, profile editing, validation, and missing states are covered by browser verification.
- [x] Desktop and mobile screenshots are included.
- [x] The FE1-01 browser regression script passes.
- [x] Mock conversations separate buyers of the same item and persist across reloads.
- [x] Real-mode header state and Home, Detail, and Profile Retry are covered by browser verification.
- [ ] Hosted CI is green; no hosted CI result was available for this local branch.
- [x] No secrets, API keys, `.env` files, database files, or user uploads are in the diff.
- [x] No commented-out dead code is left behind.
- [ ] FE2 and BE1 have reviewed the navigation and profile API boundary.

## Author declaration

- [ ] I wrote this code, or I have named every other contributor below.
- [ ] Where I used an AI assistant, I have said so and I can explain every line if asked.

AI assistance used: OpenAI Codex assisted with implementation, fictional visual assets, browser verification, screenshots, and this PR description. The PR author should review the final diff and confirm the declarations above.

## Reviewer

Request substantive review from the FE2 developer, provided they did not coauthor this PR. Ask BE1 to confirm the profile data and update API design before real-mode integration. The reviewer should repeat the browser checks and verify the Chat/Login handoff after FE2 pages are available. Keep #2 open until those checks pass.
