# DESIGN SPECIFICATION — NEU Student Marketplace (v1)

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
- Desktop layout: around `max-width: 1200px`; suggested responsive breakpoints around 768px and 1024px, not mandatory pixel-perfect values.
- Shared components: header/navigation, product cards (image, title, VND price, condition and optional favorite icon), primary/outline buttons, form inputs/selects/textarea, status badges, loading/empty/error states, footer.
- Item status: `available` (**On Sale**), `reserved` (**Reserved**), `sold` (**Sold**). Prices cannot be negative; show ownership-specific controls only to owners.
- Accessibility: visible `label` for each input, meaningful image `alt`, visible keyboard focus, semantic `header/nav/main/section/footer`, text-based validation errors rather than color alone.

## 2. The 12 mockup panels (not necessarily 12 separate routes)

| # | Screen | Suggested route | Required content and behavior | Owner |
|---|---|---|---|---|
| 1 | Home | `/index.html` | Header; hero and search; category shortcuts; recently listed items; Create Listing action; cards link to item details | FE1 |
| 2 | Browse / Marketplace | `/pages/listings.html` | Category, price, condition and sort sidebar; product grid; working filters | FE1 |
| 3 | Item Detail | `/pages/item-detail.html?id=...` | Main image and thumbnails; title, price, condition, description, seller and meeting location; Chat with Seller | FE1 |
| 4 | Create Listing | `/pages/create-listing.html` | Product title, category, price, condition, description, meeting location, 1–5 images; validation and submission | FE2 |
| 5 | Login | `/pages/login.html` | Email/password, visible errors, link to Register; return to intended page | FE2 |
| 6 | Register | `/pages/register.html` | Full name, email, password, confirm password; validation and login link | FE2 |
| 7 | Chat | `/pages/chat.html?conversationId=...` | Conversation list, recipient and linked product, message thread, send input | FE2 |
| 8 | Profile | `/pages/profile.html` | Sample avatar, name, appropriately public profile fields; mock stats only when grounded in data | FE1 |
| 9 | My Listings | `/pages/my-listings.html` | Own listings, status tabs, edit/delete/change status actions | FE2 |
| 10 | Edit Listing | `/pages/edit-listing.html?id=...` | Pre-filled form, validation, update and image management | FE2 |
| 11 | Search Results | `/pages/search.html?q=...` | Current query, filters, results and no-results state, cards linking to details | FE1 |
| 12 | Responsive mobile | Same routes | Compact header, collapsible filters, practical one/two-column cards, forms and chats without horizontal overflow | FE2 audits; both FE developers implement responsiveness for their own screens |

**Favorites, notifications, OAuth and real reviews are not mandatory.** If the mockup shows heart/bell icons, they either require a functional behavior or a clearly stated nonfunctional demo state; do not pretend that data was saved.

## 3. Shared mock data before backend integration

Create `frontend/js/mock-data.js`, with items using the **same shape as the API** (`id`, `seller_id`, `title`, `category`, `price`, `condition`, `description`, `location`, `status`, `image_urls`, `created_at`). Example:

```js
const mockItems = [
  {
    id: 101, seller_id: 2, title: 'Microeconomics Textbook',
    category: 'textbooks', price: 45000, condition: 'good',
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
- **Validation:** nonempty product name, nonnegative numeric price, valid email, valid file type and size; no empty chat messages.
- **Authorization:** only the owner sees edit/delete/status controls.

## 5. Visual acceptance checklist

1. Desktop header/hero/category/product grid matches panel 1; sidebar filters/product grid matches panels 2 and 11.
2. Detail uses left-hand imagery and right-hand information and CTA, as in panel 3.
3. Create/Edit display clear field groups, image upload and blue CTA, as in panels 4 and 10.
4. Login/Register use a split illustration/form layout, as in panels 5 and 6.
5. Chat uses conversation list on the left and chat thread on the right, as in panel 7.
6. Profile/My Listings resemble panels 8 and 9 (cover/stats or management table).
7. Mobile pages do not overflow horizontally; fonts, tap targets and filters remain usable, as in panel 12.
