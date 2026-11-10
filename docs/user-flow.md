# SITEMAP AND USER FLOWS (v1.1 proposed enhancement)

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
3. Select a card → Item Detail; view images (or placeholder), total asking price, available quantity, description, seller and meeting location. Select 1..available units to preview proportional VND pricing; this does not reserve or order anything.
4. Click **Chat with Seller**. If logged out, go to Login/Register and return to Detail/Chat. If authenticated, create or open the conversation associated with the product and its seller.
5. Buyer and seller exchange messages and arrange a meeting in a public location. **No website payment button.**
6. After handoff, the **seller** marks the listing `sold`; buyer sees the **Sold** status.

## Flow B — Seller posts and manages a listing

1. Log in → Sell an Item → Create Listing.
2. Complete required title, category, **total** VND price, quantity (default 1), condition, description and meeting location. Images are **optional (0–5)** and may be added later. The UI marks required fields clearly.
3. JavaScript validates before submission; backend validates again. After success, navigate to Item Detail or My Listings and show confirmation.
4. When contacted, seller reads and replies in Messages.
5. Seller opens My Listings → Edit Listing, Mark Reserved or Mark Sold. Edit supports changing quantity/total price and adding new pictures to a listing created without images (upload first, then update the complete image URL list). If the buyer cancels, change Reserved back to Available.
6. Seller may delete a listing after a confirmation dialog; backend verifies ownership.

## Flow C — Login and registration

- Guests can browse, search and open item details without signing in.
- An authenticated-only action redirects to Login. After success, return to a safe internal `returnTo` path.
- Register creates an account; Login uses **email**, not username, and password. Show constraints that match backend validation (display name, email format and password rule); do not invent extra password requirements. Do not assume OAuth, university email verification or password reset unless implemented.
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
- Seller creates a listing **without images** and with `quantity > 1` → it appears in Home/Browse using a placeholder → seller edits the listing and uploads an image later → buyer selects a subset quantity on Item Detail and sees correct proportional pricing → seller changes status → deletes it.
- Existing listings preserve total price and read as `quantity=1` after the DB migration.
- Test failures: guest attempting protected actions; invalid/missing required fields; zero, negative or fractional quantity; bad image type/size; API offline; zero search results; other users trying to edit listings.
- Verify responsive behavior (320/375/430/768/1366/1920 CSS px) for Create/Edit, Detail, Browse/Search, Login/Register and Chat; no clipped content or unusable controls.
