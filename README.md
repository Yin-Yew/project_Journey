# JoyJourney

JoyJourney is a cute group travel planner for planning trips, daily itineraries, shared expenses, packing lists and trip memories with friends.

## Current Build

Trips, trip members and invite codes are stored in **MySQL** through the Express API in `server/`, so everyone in a trip sees the same data from different devices. Login sessions, planner activities, packing lists and expenses are still kept in the browser (localStorage) for now.

## Completed UI and User Features

- Responsive pastel UI
- Cute motion and theme settings
- Register
- Login
- Logout
- Password hashing in the browser prototype
- Current-user session
- Profile editing
- DiceBear avatar shuffle
- Travel style
- PromptPay and bank details
- Header profile synced across pages

## Completed Trip Features (MySQL)

- Create Trip saves to the database (cover photo optional, stored in `uploads/covers/`)
- Edit Trip (owner and members) and Delete Trip (owner only)
- Random 6-character invite code for every trip, with Copy and "New code" (owner)
- Join Trip with an invite code (My Trips → Join with Code)
- Add members by email or username, remove members, members can leave
- Owner / Member roles, with ownership transfer (crown button)
- Trip Detail loads the real trip, members, budget and status
- New trips appear automatically in Planner, Expenses and Checklist
- Active / Finished status: owner and members can mark a trip finished or make it active again; trips are finished automatically after their end date
- Finished trips leave Planner and Checklist but stay in Expenses so balances can still be settled
- Expense participants are the trip's real members

### Who can do what

| Action | Owner | Member |
| --- | --- | --- |
| View trip, copy invite code | ✅ | ✅ |
| Edit trip details (name, place, dates, budget, cover) | ✅ | ✅ |
| Delete trip | ✅ | – |
| Mark finished / active | ✅ | ✅ |
| New invite code | ✅ | – |
| Add / remove members | ✅ | – |
| Transfer ownership | ✅ | – |
| Leave trip | – (transfer first) | ✅ |

## Completed Finance Features

- Expenses separated by trip
- Add expense
- Edit expense
- Delete expense
- Paid-by member selection
- Participant selection
- Equal split
- Percentage split
- Custom amount split
- Expense totals
- You Paid
- You Owe
- You Receive
- Optimized settle-up calculation
- Payment details from member profile
- Copy payment information
- Payment slip preview
- Pending payment state
- Recipient confirmation
- Paid payment history
- Trip Overview expense total sync

## Demo Accounts

All demo accounts use the password `password123`.

- `yin@example.com`
- `ploy@example.com`
- `book@example.com`
- `gun@example.com`

## Run

1. Start MySQL (XAMPP, MAMP, MySQL Workbench, Docker… any MySQL 8 or MariaDB 10.4+).
2. Copy `.env.example` to `.env` and fill in your MySQL user and password.
3. Start the server:

```bash
cd server
npm install
npm run dev
```

On first start the server creates the `joyjourney` database and all tables by itself, upgrades tables made from the older `schema.sql`, and adds the demo users and 3 demo trips (only when the database is empty). Importing `database/schema.sql` manually is optional.

Open:

```text
http://localhost:3000
```

To test joining a trip, log in as Yin in one browser, create a trip, copy the invite code, then log in as Ploy in another browser (or a private window) and use **Join with Code**.

## Trip API

All trip routes need the logged-in user's id in the `X-User-Id` header (sent automatically by `public/js/api.js`).

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/users/sync` | Create/update the logged-in user in MySQL |
| GET | `/api/trips?status=active\|finished\|all` | My trips with members and my role |
| POST | `/api/trips` | Create trip (I become owner) |
| GET | `/api/trips/:id` | Trip detail (members only) |
| PUT | `/api/trips/:id` | Edit trip (owner or member) |
| DELETE | `/api/trips/:id` | Delete trip (owner) |
| PATCH | `/api/trips/:id/status` | `{ "status": "active" \| "finished" }` (owner or member) |
| POST | `/api/trips/:id/invite-code` | New invite code (owner) |
| POST | `/api/trips/join` | `{ "code": "K7PQ2M" }` join as member |
| POST | `/api/trips/:id/members` | `{ "identifier": "email or username" }` (owner) |
| DELETE | `/api/trips/:id/members/:userId` | Remove member (owner) or leave (self) |
| PATCH | `/api/trips/:id/members/:userId` | `{ "role": "owner" }` transfer ownership (owner) |

> Note: identity via `X-User-Id` is a prototype shortcut, because login still lives in the browser. Before going public, move login to the server and use a JWT (`JWT_SECRET` is already in `.env.example`).

## Structure

```text
JoyJourney/
├── public/
│   ├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── script.js
│   │   ├── auth.js
│   │   └── finance.js
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── trips.html
│   ├── trip-detail.html
│   ├── planner.html
│   ├── places.html
│   ├── expenses.html
│   ├── checklist.html
│   ├── memories.html
│   ├── profile.html
│   └── settings.html
├── server/
│   ├── app.js
│   ├── database.js
│   ├── helpers.js
│   ├── routes/
│   │   ├── trips.js
│   │   └── users.js
│   └── package.json
├── database/
│   └── schema.sql
├── uploads/
├── .env.example
├── .gitignore
└── README.md
```

## Team Integration

Next steps: move login, planner activities, packing lists and expenses from localStorage to the API (the `expenses`, `expense_splits` and `payments` tables are already in the schema).
