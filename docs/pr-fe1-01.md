## Task / Issue

Refs #1 — FE1-01: Home, Browse and Search Results.

This PR implements the three discovery pages with mock data. It does not close #1 yet because several linked destination pages are still pending, as listed below.

## Summary

- Build the Home page with shared navigation, a hero search form, five category shortcuts, recently listed products and a View All link.
- Build the Browse page with a responsive product grid, search field, category, price and condition filters, and Newest / Price: Low to High / Price: High to Low sorting.
- Build the Search Results page with a visible query, the same filters and sorting, result counts and an empty-results state.
- Render product cards from twelve mock Item records. Cards show a local product image, title, VND price, condition and an interactive demo favorite button.
- Add a shared `getItems()` adapter in mock mode, with a Fetch API path for later backend integration. Filter and sort values follow `docs/api-contract.md` and are synchronized with the URL.
- Add original local SVG product illustrations and a generated campus hero image, so the pages do not depend on external image services.

## Files changed

| Area | Files |
| --- | --- |
| Pages | `frontend/index.html`, `frontend/pages/browse.html`, `frontend/pages/search.html` |
| Styles | `frontend/css/base.css`, `frontend/css/components.css` |
| Shared data and UI | `frontend/js/mock-data.js`, `frontend/js/api.js`, `frontend/js/components.js` |
| Page behavior | `frontend/js/home.js`, `frontend/js/catalog.js` |
| Assets | `frontend/assets/` |
| Verification | `frontend/scripts/verify-fe1.mjs`, `docs/screenshots/fe1-01/` |

## Verification

Run the frontend from the repository root:

```bash
python -m http.server 5500 --bind 127.0.0.1 --directory frontend
```

In a second terminal, with Chrome installed:

```bash
node frontend/scripts/verify-fe1.mjs
```

The browser verification passed for:

- Home search and category shortcuts opening the correct results.
- Browse search, combined category/condition/price filters, invalid price feedback and Clear Filters.
- Actual ascending and descending price order, plus sort value synchronization with the URL.
- Empty search results and the action that restores all listings.
- Demo favorite toggle and mobile menu.
- Product image loading, no horizontal overflow at 320, 390, 768 and 1440 px, and no JavaScript console errors.

## Screenshots

| Page | Desktop | Mobile (390 px) |
| --- | --- | --- |
| Home | [View desktop](https://github.com/anotify-vie/NEU-Student-Marketplace/blob/fe1/issue-1-home-browse-search/docs/screenshots/fe1-01/home-desktop.png) | [View mobile](https://github.com/anotify-vie/NEU-Student-Marketplace/blob/fe1/issue-1-home-browse-search/docs/screenshots/fe1-01/home-mobile.png) |
| Browse | [View desktop](https://github.com/anotify-vie/NEU-Student-Marketplace/blob/fe1/issue-1-home-browse-search/docs/screenshots/fe1-01/browse-desktop.png) | [View mobile](https://github.com/anotify-vie/NEU-Student-Marketplace/blob/fe1/issue-1-home-browse-search/docs/screenshots/fe1-01/browse-mobile.png) |
| Search Results | [View desktop](https://github.com/anotify-vie/NEU-Student-Marketplace/blob/fe1/issue-1-home-browse-search/docs/screenshots/fe1-01/search-desktop.png) | [View mobile](https://github.com/anotify-vie/NEU-Student-Marketplace/blob/fe1/issue-1-home-browse-search/docs/screenshots/fe1-01/search-mobile.png) |

## API contract and integration

Mock items use the Item fields from `docs/api-contract.md`. The adapter accepts `q`, `category`, `min_price`, `max_price`, `condition`, `status`, `sort`, `page` and `page_size`, and returns `{ items, total, page, page_size }`. Prices remain integer VND values in data and are formatted as VND in the UI. No API contract changes are proposed. FE2 should review the shared adapter before extending it with authentication and write operations.

## Remaining dependencies

- Login, My Listings and Create Listing are FE2 pages and are not present in the starter repository. Their header/CTA links currently point to routes that will return 404 until those pages are added.
- Product cards link to `pages/item-detail.html?id=...`, which is a separate FE1 screen and is not present yet.
- Backend search integration is pending API availability; this PR intentionally runs in mock mode.

The three implemented pages can be reviewed now. The issue's full cross-page navigation criterion should be rechecked after the destination pages are integrated.
