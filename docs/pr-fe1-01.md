## Task / Issue

Closes #1

## Screens implemented

- Home (`frontend/index.html`): hero search, five category links, recently listed items and a View All link.
- Browse (`frontend/pages/browse.html`): product grid, category, price and condition filters, search and sorting.
- Search Results (`frontend/pages/search.html`): keyword display, shared filters and sorting, and an empty state.

## Shared code

- `frontend/js/mock-data.js` follows the Item shape in `docs/api-contract.md`.
- `frontend/js/api.js` provides `getItems()` in mock mode and a Fetch API path for future backend integration.
- `frontend/js/components.js` renders the shared navigation, footer and product cards. Demo favorites are stored in browser local storage.
- `frontend/js/catalog.js` shares the Browse and Search filtering logic and synchronizes filters with the URL.

## Verification

- [x] Home, Browse and Search render from mock data.
- [x] Category, condition and price filters combine correctly.
- [x] Sorting updates the URL.
- [x] Search finds matching items and displays an empty state for an unknown keyword.
- [x] Home search opens Search Results; the empty-state action restores all listings.
- [x] Desktop and 390 px mobile viewports have no horizontal overflow.
- [x] No JavaScript exceptions in browser verification.

Run `python -m http.server 5500 --directory frontend`, then `node frontend/scripts/verify-fe1.mjs` with Chrome installed. Screenshots are in `docs/screenshots/fe1-01/`.

## Evidence

| Page | Desktop | Mobile |
| --- | --- | --- |
| Home | `docs/screenshots/fe1-01/home-desktop.png` | `docs/screenshots/fe1-01/home-mobile.png` |
| Browse | `docs/screenshots/fe1-01/browse-desktop.png` | `docs/screenshots/fe1-01/browse-mobile.png` |
| Search | `docs/screenshots/fe1-01/search-desktop.png` | `docs/screenshots/fe1-01/search-mobile.png` |

## Contract changes

None. The API adapter uses the query names and response shape from `docs/api-contract.md`. FE2 can extend the adapter with auth and write methods.
