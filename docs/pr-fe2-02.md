## Task / Issue

Closes #4 — FE2-02: Chat, My Listings and responsive interfaces.

Completes the frontend messaging and seller-management flows on top of merged issues #1–#3. Uses HTML, CSS and vanilla JavaScript with no new dependencies or API contract changes.

## Screens / APIs implemented

- Chat follows panel 7: conversation list with avatars, names, product context, previews and timestamps; a selected thread with incoming/outgoing messages; Send/Enter, Shift+Enter for a new line, validation, automatic scrolling and loading/empty/error states. Narrow screens switch between the list and thread using a Conversations button.
- Messages persist across reloads and appear for both participants. REST polling uses `after_id` every four seconds while visible, stops on navigation/hidden tabs and resumes when visible. Switching conversations ignores older pending responses. Failed sends retain the draft for retry.
- My Listings follows panel 9: All/Available/Reserved/Sold filters and counts, product image/title, VND price, posting date, Edit, confirmation before Delete, and valid status transitions. Sold is final per `docs/user-flow.md`. Empty/error states and retry are included.
- Mock changes share the existing item store, so sold/deleted listings disappear from Browse and item details/profile statistics remain consistent. Deletion persists with tombstones for original mock fixtures. Existing conversations remain readable if an item is removed.
- The existing IndexedDB is upgraded without losing issue #3 listings/images. Messages use a new store; public conversation/message payloads retain the contract fields. New API functions: `getMyItems`, `updateItemStatus`, `deleteItem`, `getMessages`, `sendMessage`, `logout`, and an explicit mock-only `loadDemoConversations` action.
- Shared navigation adds Messages and Log Out. Mobile navigation supports Escape, outside-click closing and breakpoint resets. One `responsive.css` is loaded by every rendered page, shares status badges and fixes long-text wrapping. The old detail-only badge rules are removed.

REAL mode uses `/me/items`, `/items/{id}/status`, `/items/{id}`, `/conversations`, `/conversations/{id}/messages` and `/auth/logout`, with cookies and the existing JSON fields. Ownership and conversation membership still require server enforcement by BE1/BE2.

## Run and demo

```bash
python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
```

Open `http://127.0.0.1:5500/pages/login.html`.

- Seller: `seller@example.com`; Buyer: `buyer@example.com`; both use the fictional password `MarketplaceDemo1!`.
- For a mock two-account demo, use **two tabs in the same browser profile and localhost origin**. Log in as Buyer in one and Seller in the other. Mock sessions are per-tab; data is shared within that origin.
- Buyer opens product 101 and clicks Chat with Seller. Seller opens Messages and replies. Alternatively, Load Demo Conversations adds sample threads for the demo accounts; repeat clicks do not duplicate threads or overwrite existing message history.
- Seller opens My Listings, edits an item, changes status and confirms/cancels deletion. The Create Listing link opens the existing issue #3 form.
- New registered accounts start with empty listings/conversations. Clearing this origin's site data resets the demo.

## Verification

Node 24 and Chrome are required. The new test starts its own local HTTP server and detects Chrome on macOS/Windows; set `CHROME_PATH` if needed.

```bash
node frontend/scripts/verify-fe2-02.mjs
```

- [x] Guest Detail → Login → Detail → Chat through the actual UI; seller sees the buyer's conversation.
- [x] Conversation switching, Enter send, empty-message rejection, incoming/outgoing styles, two-account delivery, chronological ordering, automatic scrolling and persistence.
- [x] Guest and nonparticipant protection, missing/unauthorized conversation URL, non-owner status/delete rejection.
- [x] Listing filters/counts, Edit destination, Available → Reserved → Available → Sold, final Sold status, Delete confirmation/cancel, deletion after reload and removed-item chat history.
- [x] Version-1 database migration preserves existing listings.
- [x] Every implemented screen fits **320, 390, 768, 801, 1024 and 1440 px**; mobile chat Back/selection/navigation work. Long names, product titles and profile text do not overflow.
- [x] Local simulated REAL API: exact status/message payloads, cookies, `after_id`, load/send/status/delete errors and retries, delayed-response isolation, hidden-tab/navigation polling cleanup and logout.
- [x] Existing `verify-fe1.mjs`, `verify-fe1-02.mjs`, `verify-fe1-retry.mjs` and `verify-fe2-01.mjs` regression checks pass.
- [x] No JavaScript exceptions or console errors on tested flows; syntax and diff checks pass.
- [ ] FE1 and FE2 jointly review shared navigation, status styles and responsive changes before merging.
- [ ] Actual BE1/BE2 integration and hosted CI, when available.

## Evidence

`docs/screenshots/fe2-02/` contains Chat and My Listings at desktop/tablet/mobile sizes, plus mobile audit screenshots for Home, Browse, Search, Detail, Profile, Login, Register, Create and Edit Listing.

## Contract changes

None. Actual backend integration remains pending BE1/BE2; the REAL-mode checks above use a local simulated API.

AI assistance: OpenAI Codex assisted with implementation, verification, screenshots and this PR description. The author and reviewers should understand the final diff before merge.
