# DESIGN SPECIFICATION — NEU Student Marketplace (v1.1 listing enhancements)

## 0. Source of truth

- Visual reference: `docs/images/marketplace-mockup.png`, the approved 12-screen **English** collage.
- This document is an implementation specification, **not a pixel measurement of the image**. The image defines the visual direction; this document defines functionality and behavior.
- Every screen must support desktop and mobile. Do not invent checkout, shopping carts, or payment features.
- Use the name **NEU Student Marketplace** and an appropriate text/icon logo. **Do not use the university's official logo without permission.**
- **Every UI string must be in English** (headings, labels, placeholders, buttons, form messages, errors and empty states).

## 1. Shared design system

- Style: bright, clean, close to the mockup: white or very pale blue background, vivid blue accents, mildly rounded cards and generous whitespace.
- Suggested CSS tokens (editable through centralized CSS variables): `--primary: #1769ff; --primary-dark: #0b4dd5; --bg: #f5f9ff; --surface: #ffffff; --text: #1a2840; --muted: #64748b; --border: #e2e8f0; --radius: 12px`.
- Typography: one consistent sans-serif family (e.g. Inter or system-ui).
- Desktop layout: around `max-width: 1200px`; use fluid layout and content-driven breakpoints (rough guides: 768px/1024px). Cover small mobile (320px), regular mobile (375px/430px), tablet (768px) and desktop (1366px/1920px). Do not add a breakpoint per device.
- Shared components: header/navigation, product cards (image, title, VND price, condition and optional favorite icon), primary/outline buttons, form inputs/selects/textarea, status badges, loading/empty/error states, footer.
- Item status: `available` (**On Sale**), `reserved` (**Reserved**), `sold` (**Sold**). Prices cannot be negative; show ownership-specific controls only to owners.
- Accessibility: visible `label` for each input, meaningful image `alt`, visible keyboard focus, semantic `header/nav/main/section/footer`, text-based validation errors rather than color alone. Mark required fields with a red `*` **and** the text `* Required fields`; use `(Optional)` on optional image uploads. Preserve accessible HTML `required`/ARIA semantics.
- No-photo listings must use a consistent placeholder with meaningful alternative text; do not show broken image elements. The `price` shown on cards is the **total listed price**; do not silently label it as a per-unit price.

## 2. The 12 mockup panels (not necessarily 12 separate routes)

| # | Screen | Suggested route | Required content and behavior | Owner |
|---|---|---|---|---|
| 1 | Home | `/index.html` | Header; hero and search; category shortcuts; recently listed items; Create Listing action; cards link to item details | FE1 |
| 2 | Browse / Marketplace | `/pages/listings.html` | Category, price, condition and sort sidebar; product grid; working filters | FE1 |
| 3 | Item Detail | `/pages/item-detail.html?id=...` | Gallery or no-image placeholder; title, total listing price, available quantity, condition, description, seller and meeting location; quantity selector (1..available) with proportional selected-price display; Chat with Seller | FE1 |
| 4 | Create Listing | `/pages/create-listing.html` | Required product title, category, total price (VND), quantity (default 1), condition, description and meeting location; 0–5 optional images; required-field indicators, validation and submission | FE2 |
| 5 | Login | `/pages/login.html` | Email/password (not username), concise credential hints based on real backend rules, visible errors, link to Register; return to intended page | FE2 |
| 6 | Register | `/pages/register.html` | Display name, email, password and confirm password; clearly describe actual backend validation limits and provide a login link | FE2 |
| 7 | Chat | `/pages/chat.html?conversationId=...` | Conversation list, recipient and linked product, message thread, send input | FE2 |
| 8 | Profile | `/pages/profile.html` | Sample avatar, name, appropriately public profile fields; mock stats only when grounded in data | FE1 |
| 9 | My Listings | `/pages/my-listings.html` | Own listings, status tabs, edit/delete/change status actions | FE2 |
| 10 | Edit Listing | `/pages/edit-listing.html?id=...` | Pre-filled form including quantity and total price; retain/remove existing images and add new images after creation, including items that initially have no images | FE2 |
| 11 | Search Results | `/pages/search.html?q=...` | Current query, filters, results and no-results state, cards linking to details | FE1 |
| 12 | Responsive mobile | Same routes | Compact header, collapsible filters, practical one/two-column cards, forms and chats without horizontal overflow | FE2 audits; both FE developers implement responsiveness for their own screens |

**Favorites, notifications, OAuth and real reviews are not mandatory.** If the mockup shows heart/bell icons, they either require a functional behavior or a clearly stated nonfunctional demo state; do not pretend that data was saved.

## 3. Shared mock data before backend integration

Create `frontend/js/mock-data.js`, with items using the **same shape as the API** (`id`, `seller_id`, `title`, `category`, `price`, `quantity`, `condition`, `description`, `location`, `status`, `image_urls`, `created_at`). Example:

```js
const mockItems = [
  {
    id: 101, seller_id: 2, title: 'Microeconomics Textbook',
    category: 'textbooks', price: 45000, quantity: 1, condition: 'good',
    description: 'Used but in good condition.', location: 'NEU - Zone A',
    status: 'available', image_urls: ['/assets/sample-economics.jpg'],
    created_at: '2026-10-31T09:00:00+07:00'
  }
];
```

**Critical rule:** Screens call shared functions from `frontend/js/api.js` (e.g. `getItems`, `getItem`, `createItem`, `login`, `sendMessage`) in mock mode first. Later switch only the data source, not DOM rendering logic.

## 4. Required UI states

- **Loading:** skeleton or text such as “Loading…” during requests.
- **Empty:** “No matching items found” with Clear Filters action; “No conversations yet” for Chat.
- **Error:** visible message with Retry action; never leave the page blank.
- **Unauthenticated:** Create Listing/Chat leads to Login and returns to the intended route after successful login.
- **Validation:** nonempty required product fields; integer total price >= 0 and integer quantity >= 1; valid email and backend-aligned account hints; optional images must have a valid type and size if uploaded (0–5 images); no empty chat messages.
- **Authorization:** only the owner sees edit/delete/status controls.

## 5. Visual acceptance checklist

1. Desktop header/hero/category/product grid matches panel 1; sidebar filters/product grid matches panels 2 and 11.
2. Detail uses left-hand imagery and right-hand information and CTA, as in panel 3.
3. Create/Edit display clear required-field markers, quantity, **total** price, optional image upload and blue CTA, as in panels 4 and 10; owners can attach photos later.
4. Login/Register use a split illustration/form layout, as in panels 5 and 6.
5. Chat uses conversation list on the left and chat thread on the right, as in panel 7.
6. Profile/My Listings resemble panels 8 and 9 (cover/stats or management table).
7. Desktop/tablet/mobile pages do not overflow horizontally; fonts, tap targets, nav, forms, galleries, quantity controls, filters and chat remain usable, as in panel 12.

## 6. v1.1 responsive and quantity interaction acceptance

- **Login/Register:** Include concise field-specific hints only for server-enforced email, display-name and password rules; do not imply username login. Keep validation errors understandable in English.
- **Create/Edit:** Label `Quantity *` (integer >= 1, default 1) and `Total Price (VND) *` (total for all units). Mark `Product Images (Optional)`, allow zero images, and explain users can upload later. Required indicators are visual *and* programmatic. During edit, preserve existing images unless removed explicitly and allow adding pictures to a photo-less listing.
- **Detail:** Present available quantity. Disable quantity choices outside `1..quantity`; update price as quantity changes according to `docs/api-contract.md`. Explain that this is an estimated price for contacting the seller, **not a checkout/cart/reservation**. Sold items must not imply purchasability.
- **Responsive audit:** Check widths 320, 375, 430, 768, 1366 and 1920 CSS pixels; verify no horizontal overflow, cropped CTA, overlapping labels, inaccessible filters, broken gallery or unusable chat. Use mobile-friendly button hit areas, keyboard navigation and visible focus. FE1 handles its pages, FE2 handles its pages and cross-audits shared layout.
- **Verification:** Compare mock mode and real API for empty-image products, quantity selector, editing, profile navigation and existing Browse/Search/Chat behavior. Capture representative mobile and desktop screenshots.
