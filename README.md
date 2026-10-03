# Real-Time Collaborative Project Board

A Trello-style Kanban board where teams manage lists and cards together and see every change live. It includes authentication, role-based board membership, card drag-and-drop, comments, an activity feed, and live presence.

**Live demo:** [add link after deploying]

## Features

- Signup and login with JWT authentication
- Create, rename and delete boards, and invite existing users by email
- Three roles per board: admin, member and viewer
- Cards with drag-and-drop reordering and moving between lists; lists can be reordered with controls
- Card details: description, labels, assignees, due date and comments
- Activity feed for board, list and card actions, including comments and invitations
- Real-time sync across board viewers using Socket.io
- Presence bar showing who is currently on the board
- Optimistic card drag-and-drop with rollback if the server rejects a move

## Roles

| Action | Admin | Member | Viewer |
| --- | --- | --- | --- |
| View board, cards and activity | Yes | Yes | Yes |
| Create, edit and delete lists and cards | Yes | Yes | No |
| Comment on cards | Yes | Yes | No |
| Invite, change or remove members | Yes | No | No |
| Rename or delete the board | Yes | No | No |

## Stack

- Server: Node.js, Express 5, Mongoose, Socket.io
- Client: React, Vite, Tailwind CSS v4, react-router-dom, @dnd-kit
- Database: MongoDB

## Getting started

### 1. Configure the server

```bash
cd server
cp .env.example .env
```

| Variable | Example value | Purpose |
| --- | --- | --- |
| `PORT` | `5002` | API and Socket.io server port |
| `CLIENT_URL` | `http://localhost:5174` | Allowed client origin |
| `JWT_SECRET` | `replace_with_a_strong_secret` | Secret used to sign JWTs; replace with a strong secret |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/project_board` | MongoDB connection URI |
| `USE_MEMORY_DB` | `false` | Use the in-memory MongoDB only when set to `true` |

Set `USE_MEMORY_DB=true` to try the app without installing MongoDB; data is lost on every restart in that mode.

### 2. Start the server

```bash
npm install
npm start
```

### 3. Start the client

In a second terminal:

```bash
cd client
npm install
npm run dev -- --port 5174
```

Open http://localhost:5174 and sign up. To see live sync, open a second browser window (or a private window) and sign in as another user.

## Deployment

### MongoDB Atlas

Create a MongoDB Atlas cluster and database user, allow the Render service to connect to the cluster, and copy the Atlas connection string into `MONGODB_URI`. Set the database name to `project_board` in the URI if it is not included.

### Render backend

Create a Web Service with these settings:

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` |

Configure these environment variables in Render:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | Your Vercel site origin; multiple origins may be comma-separated |
| `JWT_SECRET` | A generated, unique, non-placeholder secret |
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `USE_MEMORY_DB` | `false` |

Render provides `PORT` automatically. The server listens on that value and exposes `GET /health` for health checks.

### Vercel frontend

Import the project as a Vercel project with these settings:

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |

Set `VITE_API_URL` to the deployed Render backend origin, without the `/api` suffix, for example `https://your-service.onrender.com`. The client uses this value for both REST requests and Socket.io. `client/vercel.json` rewrites application paths such as `/boards/123` to `index.html`.

### Run the tests

```bash
cd server
npm test
```

The tests cover the position and rebalance helpers and the board permission middleware.

## Architecture

- The server exposes REST APIs under /api for auth, boards, lists, cards and members.
- A board stores its owner and a member list with roles.
- Board, list, card and membership updates that publish live events are saved through REST before the server emits a Socket.io event; board deletion does not currently publish an event.
- Socket.io rooms are keyed by the string form of the board id. A socket must present a valid JWT in the handshake and be a board member before it can join the room.
- Activity documents record supported board, list, card and comment actions and appear in the sidebar; the board view shows the latest 20.
- The client keeps the JWT in localStorage, reloads the current user on startup, and guards routes by auth state.

## Design decisions

### Fractional positions

Lists and cards store a floating-point position instead of an integer index. Moving an item changes its position rather than renumbering every item after it. When the gap between neighbouring values becomes too small, the list is rebalanced.

### Server-authoritative events

Clients never broadcast changes to each other. A change is saved through the REST API, and when that operation publishes a live event, the server emits it only after a successful write. This keeps the database as the single source of truth and prevents clients from drifting apart. The client updates its UI optimistically on card drag-and-drop and rolls back if the server rejects the move.

### Permissions enforced on the server

Board REST routes check membership and the required role in middleware; creating a board makes its creator an admin. Socket authentication checks the JWT, and board membership is checked before joining a room. The UI hides actions a user can't perform, but the server doesn't rely on that.

## Known limitations and next steps

- The JWT is stored in localStorage, which is simple but exposed to XSS. HttpOnly cookies with refresh tokens would be stronger.
- Socket rooms live in the memory of one server instance. Running several instances would need the Socket.io Redis adapter.
- No rate limiting on auth routes yet.
- Concurrent edits to the same card use last-write-wins.
