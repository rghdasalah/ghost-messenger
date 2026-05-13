# Discussion Guide — Hybrid Ephemeral Messenger
## SWAPD352 Web Development — Assignment #2

---

## 1. Project Concept

**Q: What problem does this application solve?**
The app solves the "Identity vs. Volatility" paradox: users need to be strongly identified (so you know who you're talking to) while messages need to vanish (so nothing is permanently stored). Traditional chat apps do one or the other — this app does both. Firebase verifies identity permanently; Redis holds messages only for the configured TTL (30 seconds by default), then automatically destroys them.

**Q: Why is this called an "ephemeral" messenger?**
"Ephemeral" means short-lived. Every message stored in Redis carries a TTL (Time-To-Live). When that timer expires Redis deletes the key itself — no cron job, no manual deletion, no application code needed. The database forgets on its own.

**Q: What is the overall architecture?**
Three layers:
1. **Frontend** — Next.js (React) served on port 3000. Handles UI, Firebase client-side auth, AES encryption, and Socket.io connection.
2. **Backend** — Express + Socket.io on port 5000. Verifies tokens, stores/retrieves data, manages real-time events.
3. **Data stores** — MongoDB stores user identity permanently; Redis stores messages temporarily with TTL.

```
Browser (Next.js)
    │  Google OAuth popup
    ▼
Firebase Auth  ──► ID Token issued to browser
    │
    │  POST /auth/login  { idToken }
    ▼
Express Backend  ──► firebase-admin verifies token
    │                ──► MongoDB upsert user
    │                ──► Twilio sends OTP SMS
    │
    │  Socket.io connection (token in handshake)
    ▼
Socket.io  ──► Redis (RPUSH + EXPIRE per message)
              ──► keyspace expiry → ghost_wipe event
```

---

## 2. Authentication — Firebase + Google OAuth

**Q: How does Google Sign-In work in your app?**
The browser calls `signInWithPopup(auth, new GoogleAuthProvider())`. Firebase opens a Google OAuth popup; the user selects their account; Google returns an authorization code to Firebase; Firebase exchanges it for an ID token and refresh token and gives the ID token to the browser. This is the standard OAuth 2.0 Authorization Code flow handled entirely by the Firebase client SDK.

**Q: What is a Firebase ID Token?**
A JWT (JSON Web Token) signed by Google's private key. It contains the user's `uid`, email, display name, and an expiry (1 hour). Because it is signed, the backend can verify it without calling Google on every request — it just checks the signature against Google's public keys.

**Q: How does the backend verify the token?**
`firebase-admin` SDK's `admin.auth().verifyIdToken(token)` validates the JWT signature, checks it hasn't expired, and confirms it belongs to the correct Firebase project. If any check fails it throws and the middleware returns 401.

**Q: Why use `firebase-admin` on the backend instead of the client SDK?**
The client SDK is for browsers — it cannot verify tokens. `firebase-admin` uses a service account (a private key JSON file) which gives it privileged access to verify tokens and manage users without exposing secrets to the browser.

**Q: What is `onAuthStateChanged` and why is it used?**
It's a Firebase listener that fires whenever the auth state changes (login, logout, token refresh). The `AuthContext` uses it instead of a one-time check so the app automatically re-authenticates when the ID token expires and refreshes, keeping the user's session alive without them having to log in again.

**Q: What is "silent registration"?**
On every login the backend does a MongoDB upsert: if the user already exists, update `lastLoginAt`; if they don't exist, create the document. The user never goes through a "create account" step — their first Google login registers them automatically. Code: `User.findOneAndUpdate({ uid }, {...}, { upsert: true, new: true })`.

---

## 3. Twilio MFA — Bonus 2

**Q: What is MFA and why add it?**
Multi-Factor Authentication requires a second proof of identity beyond the password. Even if someone steals a Google account's credentials, they still can't access Ghost Protocol without the SMS code sent to the registered phone number. This makes the "identity anchor" stronger.

**Q: How does the Twilio Verify flow work step by step?**
1. User logs in with Google → backend receives their ID token at `POST /auth/login`.
2. Backend calls `twilioClient.verify.v2.services(VERIFY_SID).verifications.create({ to: PHONE, channel: 'sms' })` — Twilio sends a 6-digit OTP to the phone.
3. Backend stores the Verification SID in Redis under `mfa:{uid}` (300s TTL) and sets `mfa_state:{uid}` = `PENDING_MFA`.
4. Backend returns `{ mfaRequired: true }` — frontend shows the MFA modal.
5. User enters the code → `POST /auth/mfa/verify` → backend calls `verifications.verificationChecks.create({ to: PHONE, code })`.
6. If Twilio returns `status: 'approved'` → backend sets `mfa_state:{uid}` = `SECURE` (86400s TTL, survives 24h).
7. Frontend sets `mfaVerified = true` → Socket.io connects → user reaches `/chat`.

**Q: What is the Verify Service SID (VAXXXX)?**
It's the identifier for a Twilio Verify Service, which is a pre-built OTP delivery service. You create one in the Twilio Console. It handles rate-limiting, code generation, expiry (10 minutes by default), and delivery across SMS/Voice/WhatsApp.

**Q: What do `PENDING_MFA` and `SECURE` mean in Redis?**
`PENDING_MFA` — the user is authenticated with Google but has not yet verified the SMS code. The socket is not allowed to connect. `SECURE` — MFA passed; the user has full access. The state is stored in Redis (not a database table) because it's session-like: it expires automatically, doesn't need to be queried across restarts, and Redis is already in the stack.

**Q: What happens if Twilio fails (wrong credentials, network error)?**
The `sendOTP` call is wrapped in a try/catch in `/auth/login`. If it throws, the error is logged but `mfaRequired` is returned as `false` — the user still gets into the app. This is graceful degradation: MFA failure doesn't lock out the user, it just silently skips the second factor.

---

## 4. Redis — Ephemeral Storage

**Q: Why Redis instead of MongoDB for messages?**
MongoDB is a persistent document store — data survives restarts and has no built-in self-deletion. Redis has native TTL: set an expiry on any key and Redis removes it exactly when the timer runs out, with no application polling. Redis is also in-memory so reads/writes are microseconds, making it ideal for high-frequency real-time messages.

**Q: How exactly is a message stored?**
`RPUSH chat:{roomId} <JSON>` appends the serialized message object to a Redis List. Then `EXPIRE chat:{roomId} {TTL}` sets the expiry on the whole list. Every new message in the same room resets the TTL (via another EXPIRE call), so the room stays alive as long as messages are being sent.

**Q: What is stored in the Redis List element?**
```json
{
  "sender": "uid",
  "displayName": "Name",
  "encryptedText": "U2FsdGVkX1...",
  "timestamp": 1715000000000
}
```
`encryptedText` is AES ciphertext — plaintext is never written to Redis.

**Q: How does Redis notify the backend when a key expires?**
Redis has a Pub/Sub feature called keyspace notifications. When configured with `notify-keyspace-events KEx`, Redis publishes a message to `__keyevent@0__:expired` whenever any key expires. The backend subscribes to this channel via a second ioredis client (`redisSubscriber`). When it receives `chat:{roomId}`, it emits `ghost_wipe` to the Socket.io room.

**Q: Why two Redis clients (redisClient and redisSubscriber)?**
Redis protocol does not allow a connection in subscribe mode to send regular commands. Once you call `SUBSCRIBE`, the connection can only receive messages. So a dedicated subscriber client is needed. `redisClient` does all normal commands (GET, SET, RPUSH, EXPIRE, etc.) and `redisSubscriber` only subscribes to keyspace events.

**Q: What Redis key convention is used?**
| Key | Type | TTL | Purpose |
|---|---|---|---|
| `chat:{roomId}` | List | `MESSAGE_TTL_SECONDS` | Ephemeral messages |
| `presence:{uid}` | String | None (deleted manually) | Socket ID for online detection |
| `mfa:{uid}` | String | 300s | Twilio Verification SID |
| `mfa_state:{uid}` | String | 300s / 86400s | `PENDING_MFA` or `SECURE` |

---

## 5. Atomic Read-Once — Bonus 1

**Q: What is "Atomic Read-Once" and why is it a bonus feature?**
The `GET /messages/:roomId` endpoint reads all messages from a room and deletes them in a single atomic operation. "Atomic" means both operations happen as one — no other client can read or write between the LRANGE and the DEL. This ensures a message can only ever be read once, then it's gone immediately (not waiting for TTL).

**Q: How is atomicity achieved in Redis?**
Using a Redis transaction: `MULTI` marks the start, then `LRANGE key 0 -1` and `DEL key` are queued, then `EXEC` runs both as a single uninterruptible unit. In ioredis: `redisClient.multi().lrange(key, 0, -1).del(key).exec()`. The result is an array `[[null, messages], [null, 1]]`.

**Q: What is a race condition and how does MULTI/EXEC prevent it?**
Without atomicity: Client A reads messages (LRANGE) → Client B reads messages (LRANGE) → Client A deletes → Client B deletes. Both clients got the messages. With MULTI/EXEC: the entire read-and-delete is one operation; if another client tries to read in between, Redis queues it and runs it only after the transaction completes.

**Q: Why is this useful for privacy?**
Once a recipient fetches messages via `GET /messages/:roomId`, the Redis key is gone immediately — even before the TTL would have expired. There is no window where the data exists on the server after it has been delivered.

---

## 6. AES Encryption — Bonus 1

**Q: What is encrypted and where does it happen?**
Encryption happens entirely on the frontend, before the message leaves the browser. The user types plaintext → `encrypt(text)` is called → the AES ciphertext is sent over Socket.io → the backend stores the ciphertext in Redis. Decryption happens on the receiving browser: `decrypt(encryptedText)` is called when rendering messages.

**Q: What library is used and how?**
`crypto-js` — a pure JavaScript implementation of AES. 
- Encrypt: `CryptoJS.AES.encrypt(text, KEY).toString()` → produces a Base64 string like `U2FsdGVk...`
- Decrypt: `CryptoJS.AES.decrypt(cipher, KEY).toString(CryptoJS.enc.Utf8)` → produces original text

**Q: Where is the encryption key stored?**
In `NEXT_PUBLIC_ENCRYPTION_KEY` in the frontend `.env.local`. This is a shared symmetric key — both sender and receiver use the same key. In production this would be exchanged via a key agreement protocol (e.g., Diffie-Hellman), but for this assignment a pre-shared key is used.

**Q: What does the backend see when it receives a message?**
Only ciphertext. The backend never has access to the plaintext. It stores `encryptedText` in Redis, emits it over Socket.io, and returns it from `GET /messages/:roomId` — always as the opaque ciphertext string. Even a database administrator inspecting Redis directly would see only `U2FsdGVk...` values.

**Q: What is the difference between AES-CBC and AES-CTR? Which mode does crypto-js use by default?**
`crypto-js` uses AES-CBC (Cipher Block Chaining) by default. CBC encrypts each block XOR'd with the previous ciphertext block, requiring an IV (initialization vector) for security. `crypto-js` auto-generates a random IV and prepends it to the output — that's why the output always starts with `Salted__` when viewed as UTF-8.

---

## 7. Burn-on-Disconnect — Bonus 1

**Q: What is Burn-on-Disconnect?**
When a user closes their browser tab or loses connectivity, the Socket.io server fires the `disconnect` event. The handler immediately calls `redisService.deletePresence(uid)` which runs `DEL presence:{uid}` in Redis. The user is instantly marked offline and all other connected users receive a `presence_update` event.

**Q: Why is this important for privacy?**
A stale presence key would falsely show a user as "online" after they have left. More importantly, it cleans up server state immediately — no ghost sessions accumulating in Redis over time.

**Q: How is the uid known at disconnect time?**
When the socket connects, the backend stores `socketToUid.set(socket.id, uid)` in an in-memory Map. At disconnect, `socketToUid.get(socket.id)` looks up which user this socket belonged to. The Map is module-level, shared across all socket events for the lifetime of the server process.

---

## 8. Socket.io — Real-Time Layer

**Q: How are Socket.io connections authenticated?**
The frontend passes the Firebase ID token in the handshake: `io(URL, { auth: { token: idToken } })`. On the server, `socket.handshake.auth.token` is extracted and passed to `admin.auth().verifyIdToken(token)`. If verification fails, `socket.disconnect(true)` is called immediately — the socket never enters the event loop.

**Q: What is a Socket.io room and how is it used?**
A room is a named channel. `socket.join(roomId)` adds the socket to that room. `io.to(roomId).emit(event, data)` sends only to sockets in that room. This creates private 1-on-1 channels: only the two participants have joined the room, so messages go only to them.

**Q: How is the room ID determined?**
`[uidA, uidB].sort().join('_')` — both UIDs are sorted alphabetically before joining with `_`. This makes the room ID deterministic regardless of who initiates: user A→B and user B→A produce the same room ID, so they always end up in the same room.

**Q: What is the difference between `socket.emit`, `io.to(room).emit`, and `socket.broadcast.emit`?**
- `socket.emit(event, data)` — sends only to that one socket (the current connection).
- `io.to(room).emit(event, data)` — sends to all sockets in the named room (including sender).
- `socket.broadcast.emit(event, data)` — sends to all sockets except the sender.

In this app: pulse events use `socket.emit` (only the user themselves should see their own pulses). Presence updates use `socket.broadcast.emit` (everyone except the user who just connected). Messages use `io.to(roomId).emit` (both participants in the room see the message).

**Q: Why is Socket.io used instead of plain WebSockets?**
Socket.io adds rooms, namespaces, automatic reconnection, fallback to HTTP long-polling (if WebSocket is blocked), and a clean event-based API on top of raw WebSockets. Plain WebSockets would require implementing all of that manually.

---

## 9. System Pulse Monitor

**Q: What is the System Pulse Monitor?**
A real-time event log shown in the right pane of the chat UI. Every significant system action emits a `pulse_event` via Socket.io with a tag, message, and timestamp. The frontend renders them in chronological order with color-coded tags.

**Q: What are the event tags and their colors?**
| Tag | Color | Fired when |
|---|---|---|
| `[AUTH]` | Cyan | Firebase token verified at login |
| `[SOCKET]` | Yellow | User connects, joins room, or disconnects |
| `[REDIS]` | Magenta | Message pushed to Redis (key created or updated) |
| `[GHOST]` | Red | TTL expired → key deleted → ghost wipe |
| `[TWILIO]` | Green | OTP sent or verified |

**Q: How does the backend emit a pulse to a specific user?**
`pulseService.emitPulse(socketId, tag, message)` calls `io.to(socketId).emit('pulse_event', {...})`. Since each socket has a unique ID, sending to `socketId` delivers the message to exactly that one connected client.

---

## 10. MongoDB — Identity Store

**Q: Why MongoDB and not a SQL database?**
The user document structure is flexible (different Firebase providers may return different fields), MongoDB handles this naturally without schema migrations. The User model is a simple flat document — no joins needed. MongoDB also integrates cleanly with Mongoose for schema validation.

**Q: What is stored in MongoDB?**
Only user identity — `{ uid, displayName, photoURL, email, createdAt, lastLoginAt }`. Messages are explicitly NOT stored in MongoDB because they must be ephemeral. Separating concerns: MongoDB = permanent identity, Redis = temporary messages.

**Q: What is an upsert?**
`findOneAndUpdate({ uid }, { $set: {...}, $setOnInsert: { createdAt: new Date() } }, { upsert: true, new: true })` — if a document with that `uid` exists, update it; if not, create it. This is how silent registration works in a single database round-trip.

---

## 11. Security Considerations

**Q: How is the REST API protected?**
Every endpoint (except `POST /auth/login` which does its own token verification) requires a `Authorization: Bearer <idToken>` header. The `verifyToken` middleware calls `admin.auth().verifyIdToken()` on every request. If the token is missing, invalid, or expired, the middleware returns 401 immediately.

**Q: Is the encryption key safe in the frontend environment variable?**
`NEXT_PUBLIC_` variables are bundled into the JavaScript sent to the browser — they are not secret. For a production system, the key should be exchanged via a key agreement protocol. For this assignment the shared key is acceptable because the focus is on demonstrating the encryption concept, not on key distribution.

**Q: What prevents a user from sending messages as another user?**
The `sender` field in the stored message object is set server-side from `decoded.uid` (the verified token). The client sends only `encryptedText`, `roomId`, and `recipientUid`. The server ignores any claimed sender identity from the client and always uses the authenticated UID from the token.

**Q: What is CORS and why is it configured?**
Cross-Origin Resource Sharing is a browser security policy that blocks JavaScript from calling an API on a different origin (domain/port) than the page. Since the frontend (port 3000) calls the backend (port 5000), CORS must explicitly allow `http://localhost:3000`. Without it the browser blocks the request before it reaches the server.

---

## 12. Next.js Specifics

**Q: What is `'use client'` and why is it at the top of most files?**
Next.js 14 defaults to React Server Components, which run only on the server and cannot use browser APIs, hooks, or event listeners. `'use client'` marks a component as a Client Component — it runs in the browser and can use `useState`, `useEffect`, `useRouter`, etc. Every interactive component in this app needs `'use client'`.

**Q: Why is `useEffect` used for the redirect instead of checking during render?**
React's Rules of Hooks require that all hooks are called in the same order every render, unconditionally. If a redirect were placed before `useSocket()` or `useMessages()`, those hooks would not be called during that render, violating the rules and causing a crash. The `useEffect` fires after render, so all hooks are always called first, and the redirect happens asynchronously.

**Q: What is `useMemo` used for in the chat page?**
`useMemo(() => [...].sort().join('_'), [user?.uid, activeUser?.uid])` computes the room ID. Without `useMemo`, the array sort and string join would run on every re-render (which happens on every state change). Since the room ID only changes when `user.uid` or `activeUser.uid` changes, `useMemo` caches the result and only recomputes when those two values change.

---

## 13. Key Design Decisions

**Q: Why is the TTL reset on every message instead of being fixed from the first message?**
Resetting the TTL on every `pushMessage` keeps the room alive as long as the conversation is active. A fixed TTL from first message would expire the room mid-conversation if the TTL is short. The reset-on-write pattern means: "the room vanishes 30 seconds after the last message."

**Q: Why store messages in a Redis List instead of individual keys?**
A List lets all messages in a room be retrieved in order with one `LRANGE key 0 -1` command and deleted atomically with one `DEL`. With individual keys you would need multiple round-trips to read all messages and delete them, and you could not do it atomically.

**Q: What happens when both users disconnect before the TTL expires?**
The messages remain in Redis until the TTL expires naturally. On reconnection, `GET /messages/:roomId` does the atomic read-once — delivering all buffered messages then deleting them immediately, regardless of how much TTL remained.

**Q: Why is `MESSAGE_TTL_SECONDS` an environment variable?**
For testing, a short TTL (10–30 seconds) makes it easy to observe the ghost wipe. For production use, a longer TTL (e.g., 3600 seconds) would be appropriate. Externalizing it to `.env` means no code changes are needed to adjust the behavior.
