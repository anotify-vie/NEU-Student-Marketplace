## Task / Issue

Closes #3 — FE2-01: Login, Register, Create Listing and Edit Listing.

Adds four responsive pages based on mockup panels 4, 5, 6 and 10, using the merged FE1 shared navigation, styles and API adapter. No new dependencies or contract changes.

## Implementation

- One shared `js/forms.js` handles field validation, password toggles, safe internal `returnTo`, image previews/removal and submission states. One `css/forms.css` styles all four pages.
- Login/Register use email/password forms, field errors, duplicate-account feedback and a registration → login → intended-page flow. Mock passwords are stored as salted PBKDF2 hashes; the existing session key remains unchanged.
- Create/Edit share validation and accept 1–5 decodable JPEG/PNG/WebP images, at most 5 MB each. Prices are nonnegative whole VND amounts. Edit preloads existing data; Cancel returns to the item. Guests go to Login; other users attempting Edit return to the public item.
- Mock listing changes and images persist in IndexedDB and are shared with Home, Browse, Detail and Profile statistics. Submission success provides a View Listing link. Failed submissions keep the form and allow retry.
- `api.js` adds `login`, `register`, `uploadImage`, `createItem` and `updateItem`. REAL mode uses the existing auth, upload and item endpoints with cookies; uploads use FormData field `file`. Item writes contain only contract fields, without client-supplied ownership.

## Run and demo

From the repository root:

```bash
python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
```

Open `http://127.0.0.1:5500/pages/login.html`.

| Demo account | Email | Password |
| --- | --- | --- |
| Seller (owns item 101) | seller@example.com | MarketplaceDemo1! |
| Buyer | buyer@example.com | MarketplaceDemo1! |

These are fictional browser-local fixtures. You can also register a new demo account. For existing-item editing, sign in as Seller and open `/pages/edit-listing.html?id=101`. To edit a newly created item, use its ID from the View Listing URL. Clear this origin's site data to reset mock accounts, listings, images and sessions.

Remember Me is omitted because the approved authentication contract does not support it. REAL profile editing/statistics remain the existing FE1 integration boundary. My Listings and Chat are separate tasks.

## Verification

Requires Python 3, Node 24 and Chrome. The new verifier launches its own localhost server and does not require the manual server above:

```bash
node frontend/scripts/verify-fe2-01.mjs
```

It detects Chrome on macOS/Windows; set `CHROME_PATH` when installed elsewhere. Existing regression scripts require that variable on macOS:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node frontend/scripts/verify-fe1.mjs
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node frontend/scripts/verify-fe1-02.mjs
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node frontend/scripts/verify-fe1-retry.mjs
```

- [x] All four pages fit 320/390/768/1440 px without horizontal overflow.
- [x] Required fields, email, passwords, password visibility, duplicate registration and incorrect login.
- [x] Intended destination survives Register/Login; external and authentication-loop redirects are rejected.
- [x] Guest and non-owner guards; missing listing; API rejects mock non-owner updates.
- [x] Empty/oversized/invalid images, five-image limit, previews and removal.
- [x] Integer VND validation; create/edit persist after reload, including images; created listings appear in FE1 Browse.
- [x] REAL mode against a local simulated HTTP API: cookies, endpoint/payload compatibility, multipart upload, errors and retries for all four forms; successful uploads are reused on submit retry.
- [x] FE1 Home/Browse/Search, Detail/Profile and API Retry regression scripts pass.
- [x] No JavaScript exceptions or console errors on tested flows.
- [ ] Actual backend integration, pending BE1 API availability.
- [ ] Teammate visual/code review and hosted CI, if configured.

Desktop and full-page mobile evidence for all four pages: `docs/screenshots/fe2-01/`.

AI assistance: OpenAI Codex assisted with implementation, verification and this description. The author should review and understand the final diff before merge.
