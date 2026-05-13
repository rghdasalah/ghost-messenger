# Ghost Messenger — Hybrid Ephemeral Messenger

**Course:** SWAPD352 Web Development — Spring 2026  
**Assignment:** #2 — Hybrid Ephemeral Messenger

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                       Browser                           │
│   ┌──────────────────────────────────────────────────┐  │
│   │        Next.js Frontend (port 3000)              │  │
│   │  ┌──────────┐ ┌──────────────┐ ┌─────────────┐  │  │
│   │  │UserList  │ │  GhostChat   │ │PulseMonitor │  │  │
│   │  └──────────┘ └──────────────┘ └─────────────┘  │  │
│   └────────────────────┬─────────────────────────────┘  │
└────────────────────────│────────────────────────────────┘
              REST + Socket.io (port 5000)
┌────────────────────────▼────────────────────────────────┐
│              Express Backend (port 5000)                 │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │firebase-admin│  │  Socket.io │  │   Twilio MFA    │  │
│  └──────┬───────┘  └─────┬──────┘  └────────┬────────┘  │
└─────────│────────────────│───────────────────│───────────┘
          │                │                   │
  ┌───────▼──────┐ ┌───────▼──────┐   ┌────────▼───────┐
  │   Firebase   │ │    Redis     │   │    Twilio      │
  │   Auth API   │ │ (ephemeral   │   │  Verify API    │
  │  (identity)  │ │  messages)   │   │    (MFA)       │
  └──────────────┘ └──────────────┘   └────────────────┘
                         │
                  ┌──────▼───────┐
                  │   MongoDB    │
                  │ (user store) │
                  └──────────────┘
```

---

## Prerequisites

- **Node.js** v18+
- **Redis** (running locally on port 6379)
- **MongoDB** (running locally on port 27017)
- A **Firebase project** with Google Auth enabled
- A **Twilio account** with a Verify Service (for MFA)

---

## 1. Firebase Setup

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. In the left sidebar go to **Authentication → Sign-in method** and enable **Google**.
3. Go to **Project Settings → Service accounts** and click **Generate new private key**. Download the JSON file.
4. Open the downloaded JSON file and minify it into a single line (or use a tool like `jq -c . serviceAccount.json`).
5. Paste that single-line JSON as the value of `FIREBASE_SERVICE_ACCOUNT` in `backend/.env`.
6. Back in **Project Settings → General → Your apps**, click **Add app → Web**.
7. Copy the `apiKey`, `authDomain`, `projectId`, and `appId` into `frontend/.env.local`.

---

## 2. Twilio MFA Setup

1. Create a free account at [https://www.twilio.com](https://www.twilio.com).
2. In the Twilio Console, go to **Verify → Services** and create a new Verify Service. Copy the **Service SID** (`VA...`).
3. Go to **Account → API Keys & Tokens** and copy your **Account SID** (`AC...`) and **Auth Token**.
4. In the Twilio Console go to **Phone Numbers → Verified Caller IDs** and add your target Egyptian phone number (e.g. `+20XXXXXXXXXX`). Twilio will call or text to verify it.
5. Fill in the Twilio values in `backend/.env`.

---

## 3. Environment Variables

### Backend — copy and fill `backend/.env.example` → `backend/.env`

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ghost_messenger
REDIS_URL=redis://localhost:6379
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}   ← single-line JSON
MESSAGE_TTL_SECONDS=120
FRONTEND_URL=http://localhost:3000
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxx
MFA_PHONE_NUMBER=+20XXXXXXXXXX
```

### Frontend — copy and fill `frontend/.env.local.example` → `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxx:web:xxx
NEXT_PUBLIC_ENCRYPTION_KEY=some-random-secret-string-min-16-chars
```

---

## 4. Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## 5. Running the App

Open **four terminals**:

```bash
# Terminal 1 — Redis
redis-server

# Terminal 2 — MongoDB
mongod --dbpath ./data/db

# Terminal 3 — Backend
cd backend
npm run dev

# Terminal 4 — Frontend
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. How to Test TTL Expiry

1. In `backend/.env`, set `MESSAGE_TTL_SECONDS=10` (10-second TTL for fast testing).
2. Restart the backend (`npm run dev`).
3. Open two browser windows with two different Google accounts.
4. Send a message between them.
5. In Redis CLI run: `TTL chat:<roomId>` — you'll see the countdown.
6. Wait 10 seconds.
7. Watch the **System Pulse Monitor** — it will show `[GHOST]: TTL reached 0. Redis memory purged. Key: chat:<roomId>.`
8. The **Ghost Chat** pane will automatically clear.
9. Verify in Redis CLI: `EXISTS chat:<roomId>` → returns `0`.

---

## 7. Bonus Features

### Bonus 1

| Feature | Description |
|---|---|
| Atomic Read-Once | `GET /messages/:roomId` uses Redis `MULTI/EXEC` to fetch all messages and delete the key simultaneously in one atomic transaction |
| Burn-on-Disconnect | When a user closes their browser tab, their presence key is immediately deleted from Redis and all other users see them go offline |
| Encrypted Payloads | All message text is AES-encrypted on the frontend using `crypto-js` before being sent to the server. Redis only stores ciphertext — never plaintext |

### Bonus 2

| Feature | Description |
|---|---|
| Twilio MFA | After Google login, a 6-digit OTP is sent via SMS to the pre-registered phone number. The user must enter this code before accessing the chat. The OTP is stored in Redis with a 5-minute TTL. |

---

## 8. API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Token in body | Verify Firebase ID Token, silent register, trigger MFA |
| POST | `/auth/mfa/request` | Bearer header | Resend OTP |
| POST | `/auth/mfa/verify` | Bearer header | Verify OTP, promote to SECURE session |
| GET | `/users` | Bearer header | List all users with presence status |
| GET | `/messages/:roomId` | Bearer header | Atomic read-once fetch + delete |

---

## 9. Socket.io Events

| Direction | Event | Payload |
|---|---|---|
| Client → Server | `join_room` | `{ roomId }` |
| Client → Server | `send_message` | `{ roomId, encryptedText, recipientUid }` |
| Server → Client | `receive_message` | `{ roomId, sender, displayName, encryptedText, timestamp }` |
| Server → Client | `pulse_event` | `{ tag, message, timestamp }` |
| Server → Client | `ghost_wipe` | `{ roomId }` |
| Server → Client | `presence_update` | `{ uid, status }` |
| Server → Client | `users_list` | `[{ uid, displayName, photoURL, status }]` |
