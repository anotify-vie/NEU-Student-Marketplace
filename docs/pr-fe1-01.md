## Closes

Refs #1.

Keep #1 open after this PR. Its final acceptance still requires working destinations for Login, My Listings, Create Listing, and Item Detail, followed by cross-page navigation and reviewer verification. Those destination pages are outside the three pages implemented here.

## What changed

Built the Home, Browse, and Search Results pages from the approved English mockup. Home includes shared navigation, hero search, five category shortcuts, recently listed products, and View All. Browse and Search Results use the same responsive product cards and category, VND price, condition, and sorting controls. Search Results displays the query and a clear empty state.

Added twelve mock Item records following `docs/api-contract.md`, shared DOM rendering, URL-synchronized filters, demo favorites stored in browser local storage, and an `api.js` adapter that uses mock data now and has a Fetch API path for later backend integration. Added local product illustrations and a campus hero image. No backend or external image service is needed for this demo.

## How to test it

From the repository root, with Python, Node 24, and Chrome installed:

1. Run `python -m http.server 5500 --bind 127.0.0.1 --directory frontend`.
2. In a second terminal, run `node frontend/scripts/verify-fe1.mjs`.
3. Open `http://127.0.0.1:5500/index.html`, `http://127.0.0.1:5500/pages/browse.html`, and `http://127.0.0.1:5500/pages/search.html?q=textbook` for manual review.

The browser script checks Home and Browse search, category shortcuts, combined and invalid filters, sort order and URL state, empty results, favorites, the mobile menu, product images, viewport overflow, and JavaScript console errors. It saves fresh screenshots to `docs/screenshots/fe1-01/`.

## Screenshot / output

Browser verification output from the local branch:

`PASS: 320/390/768/1440 px layouts, search navigation, category links, combined and invalid filters, sort order, empty state, favorite and mobile menu; no JavaScript console errors.`

Desktop and 390 px mobile screenshots are included:

- Home: `docs/screenshots/fe1-01/home-desktop.png`, `docs/screenshots/fe1-01/home-mobile.png`
- Browse: `docs/screenshots/fe1-01/browse-desktop.png`, `docs/screenshots/fe1-01/browse-mobile.png`
- Search Results: `docs/screenshots/fe1-01/search-desktop.png`, `docs/screenshots/fe1-01/search-mobile.png`

The three implemented pages loaded correctly with mock data. Links to Login, My Listings, Create Listing, and Item Detail currently lead to missing routes; they need their separately assigned pages before the issue's full navigation criterion can pass. Backend search integration is pending API availability and is not required to run this PR.

---

## Definition of Done

- [ ] Every acceptance criterion on #1 passes, including linked destination pages.
- [ ] The code has been verified from a clean clone.
- [x] Browser verification covers search, filtering, sorting, empty states, responsive layouts, and console errors.
- [ ] Hosted CI is green; no hosted CI result was available for this local change.
- [x] No secrets, API keys, `.env` files, database files, or user uploads are in the diff.
- [x] No commented-out dead code is left behind.
- [x] Desktop and mobile screenshots and the verification script are included.
- [ ] A teammate has reviewed the shared API adapter and cross-page navigation.

## Author declaration

- [ ] I wrote this code, or I have named every other contributor below.
- [ ] Where I used an AI assistant, I have said so and I can explain every line if asked.

AI assistance used: OpenAI Codex assisted with the frontend implementation, local assets, browser verification, screenshots, and this PR description. The PR author should review the final diff and confirm the declarations above.

## Reviewer

Request substantive review from the FE2 developer, provided they did not coauthor this PR. The reviewer should verify the shared mock-data/API interface, repeat the browser checks, inspect desktop and mobile screenshots, and recheck the pending links after their destination pages are integrated. Keep #1 open until those checks pass.
