# JoyJourney

JoyJourney is a cute group travel planner for planning trips, daily itineraries, shared expenses, packing lists and trip memories with friends.

## Current Build

The current build is a working browser prototype. Trip, user and finance interactions are persisted with localStorage so the team can test the complete flow before connecting the shared database and backend APIs.

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

```bash
cd server
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Structure

```text
JoyJourney/
├── public/
│   ├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
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
│   └── package.json
├── database/
│   └── schema.sql
├── uploads/
├── .env.example
├── .gitignore
└── README.md
```

## Team Integration

The next shared-team step is replacing localStorage with API and database data so all members can see the same information from different devices.
