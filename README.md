# NEU Student Marketplace

## Member

- **Trần Tuấn Anh** - 11247264
- Vũ Quốc Huy - 11247301
- Nguyễn Tuấn Anh - 11247264
- Mai Huy Đăng - 11247269

## Function

> A second-hand marketplace for NEU students to buy and sell used textbooks, Karate uniforms, sportswear, study supplies, and student essentials.

**MVP scope:** Guests can browse and search listings. Registered users can sign in, create listings with images, message sellers, and mark their listings as sold. **Out of scope:** online payment, delivery, AI recommendations, and Lost & Found.

## Approved UI reference

![The 12-screen English NEU Student Marketplace mockup](docs/images/marketplace-mockup.png)

**This image is the mandatory visual reference.** Some bottom-row screens in this collage are cropped or too small to read. Do not infer extra features from unclear details. Follow [the design specification](docs/design.md) and [user flows](docs/user-flow.md) for functionality.

## Required reading before implementation

1. [Design specification and all screens](docs/design.md)
2. [Sitemap and user flows](docs/user-flow.md)
3. [Frontend/backend API contract](docs/api-contract.md)
4. [Four-person assignments, acceptance criteria and checklists](docs/tasks.md)
5. [Git, branching and pull request rules](docs/contributing.md)

**If using AI:** provide the mockup image, README, design specification, user flows, API contract and your assigned task section. Do not provide only the picture and let an AI invent the workflows.

## Technology stack

- **Frontend:** semantic HTML5, CSS3, vanilla JavaScript. Do not use React, Vue, Bootstrap or Tailwind without team approval. Follow the instructor's Weeks 2–5 material: HTML/forms/accessibility; CSS box model, Flexbox, Grid, media queries; JS DOM/events/validation; Fetch API, async/await, JSON, try/catch and CORS.
- **Backend:** Python, FastAPI, SQLite, following the introductory Week 6 approach (virtual environments, Uvicorn, `/docs`, frontend/backend separation). Application logic is designed by the team.
- **Images:** locally stored in `backend/uploads/` for the demo; the database stores image paths. Never commit users' uploads.
- **MVP chat:** REST endpoints with polling every few seconds while chat is open; no WebSocket required.
- **Payment and handoff:** students coordinate and transact outside the platform, preferably meeting in a public place.

## Repository layout

```text
neu-student-marketplace/
├── README.md
├── docs/
│   ├── images/marketplace-mockup.png
│   ├── design.md
│   ├── user-flow.md
│   ├── api-contract.md
│   ├── tasks.md
│   └── contributing.md
├── frontend/
│   ├── index.html                 # Homepage (FE1)
│   ├── pages/                    # Other HTML pages
│   ├── css/                      # Base, components, page styles
│   ├── js/                       # API adapter, mock data and page scripts
│   └── assets/                   # Licensed or original sample images
└── backend/
    ├── main.py
    ├── routers/
    ├── models/
    ├── schemas/
    ├── database.py
    ├── requirements.txt
    └── uploads/                  # Git-ignored
```

## Run instructions (once application code exists)

**Frontend:** open `frontend/index.html` using the VS Code Live Server extension. Use localhost/Live Server rather than `file://`, because the frontend uses Fetch.

**Backend (macOS/Linux):**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Swagger API: `http://127.0.0.1:8000/docs`. On Windows activate with `.venv\Scripts\activate`. **These commands apply only after BE1 creates the backend source and dependencies.**

## Shared conventions

- Show prices in **VND**, e.g. `45,000 VND`; send integer `45000` in the API. **The English mockup displays some prices in USD; use VND in the actual application and never silently change the API currency.**
- API timestamps use ISO 8601; the UI presents readable English-formatted dates and times.
- API record IDs are integers. Every data-driven screen must handle loading, empty and error states.
- Guests can browse, search and view details; posting and chatting require authentication.
- Only listing owners can edit, delete and change listing status.
- Never commit `.env`, credentials, personal data or database files.
- **All user-facing interface text, error messages, placeholder examples and documentation must be in English.**

## Team collaboration

Use a GitHub Project board: **Backlog → Ready → In Progress → Review → Done**. Use feature branches and reviewed pull requests; no direct pushes to `main`. See [contributing rules](docs/contributing.md) and [assignments](docs/tasks.md).

## Current implementation status

The frontend is implemented in semantic HTML, CSS and vanilla JavaScript, including Home, Browse, Search, Item Detail, Profile, authentication, listing management and chat demo screens. It currently uses **mock mode** (`API_MODE = 'mock'` in `frontend/js/api.js`); this is not a claim that live backend integration is complete.

Browse and Search retrieve listings in batches of up to 50 and provide **Load More** when further matching listings exist. The result count shows the full number of matches while the displayed count shows how many cards have loaded. Changing filters or sorting starts again at the first batch.

**Run frontend:** serve the repository with VS Code Live Server and open `frontend/index.html`. Do not use the `file://` protocol. API-mode integration, end-to-end checks, and peer review of responsive changes must be completed and recorded separately before claiming overall project sign-off.

**Original starter:** this repository began with the English mockup, documentation and empty starter folders; that starter-only status is no longer current.
