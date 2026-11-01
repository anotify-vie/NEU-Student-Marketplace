# SITEMAP AND USER FLOWS (v1)

## Sitemap

```text
Home
├── Browse ── Search Results ── Item Detail ── Chat (Login if guest)
├── Category shortcut ── Browse (category preselected)
├── Sell an Item ── Login (if guest) ── Create Listing
├── Login ↔ Register
├── Messages ── Chat (authenticated only)
└── Account ├── Profile
            └── My Listings ├── Edit Listing
                            ├── Mark Reserved / Mark Available / Mark Sold
                            └── Delete (with confirmation)
```

## Flow A — Guest browsing → chat → in-person purchase

1. Open Home and search for “microeconomics textbook”, or select a category.
2. Browse/Search Results displays products; filter by category, price and condition; adjust sorting.
3. Select a card → Item Detail; view images, price, description, seller and meeting location.
4. Click **Chat with Seller**. If logged out, go to Login/Register and return to Detail/Chat. If authenticated, create or open the conversation associated with the product and its seller.
5. Buyer and seller exchange messages and arrange a meeting in a public location. **No website payment button.**
6. After handoff, the **seller** marks the listing `sold`; buyer sees the **Sold** status.

## Flow B — Seller posts and manages a listing

1. Log in → Sell an Item → Create Listing.
2. Complete title, category, VND price, condition, description, meeting location and 1–5 images (backend defines and enforces the image constraints, which must appear in the UI).
3. JavaScript validates before submission; backend validates again. After success, navigate to Item Detail or My Listings and show confirmation.
4. When contacted, seller reads and replies in Messages.
5. Seller opens My Listings → Edit Listing, Mark Reserved or Mark Sold. If the buyer cancels, change Reserved back to Available.
6. Seller may delete a listing after a confirmation dialog; backend verifies ownership.

## Flow C — Login and registration

- Guests can browse, search and open item details without signing in.
- An authenticated-only action redirects to Login. After success, return to a safe internal `returnTo` path.
- Register creates an account; Login uses email and password. Do not assume OAuth, university email verification or password reset unless implemented.
- Logout clears the session, updates the header and navigates appropriately.

## Flow D — Chat and product status

- Chat requires authentication; users cannot chat with themselves about their own listings.
- Each conversation belongs to one buyer, one seller and one item. Only those two users can view or send its messages.
- Sort conversations by most recent message; poll new messages only while a chat is open.
- Valid transitions: `available` → `reserved` → `sold`; `reserved` → `available`; owner can mark `sold` directly from `available`.
- Sold items cannot start new conversations, although existing conversations remain readable.

## Required end-to-end demo

- Seed at least 2 demo accounts (seller and buyer) and 5–8 products (textbooks, uniforms and study supplies).
- Buyer searches → views detail → logs in → chats → seller replies → seller marks sold → buyer refreshes and sees Sold.
- Seller uploads a listing with an image → it appears in Home/Browse → edits it → changes status → deletes it.
- Test failures: guest attempting protected actions; invalid form; API offline; zero search results; other users trying to edit listings.
