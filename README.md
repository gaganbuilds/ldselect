# ML Internship — Track 2 Domain Selection Tool

A full-stack web application designed for 100+ internship candidates to select an ML domain (e.g., Computer Vision, NLP) and for administrators to manage those domains, capacities, and registrations.

## Product Overview

### Candidate Flow
1. Candidates access the portal and see the currently open ML domains.
2. They enter their Full Name and Candidate ID.
3. They select an available domain (closed or full domains cannot be selected).
4. The system validates the submission centrally, preventing duplicate Candidate IDs and enforcing real-time capacity limits.

### Admin Flow
1. Administrators log in securely via `/admin`.
2. The Dashboard displays real-time statistics (total candidates, domains, capacities).
3. Admins can:
   - Add/Edit domains (dynamically controlling the options candidates see).
   - Change domain capacities securely (cannot be set lower than current registrations).
   - Open/Close specific domains or the entire registration portal.
   - Search, sort, and filter the candidate submission list.
   - Export CSV reports of candidate selections.

## Architecture

```text
Frontend (Vite, React, TypeScript, Vanilla CSS)
  ↓
API / Backend (Express, Node.js)
  ↓
Central Persistence (Local JSON Database - database.json)
```

The application relies on a lightweight Node.js/Express backend to maintain a central source of truth in `server/database.json`. Because Node.js is single-threaded and the file operations are atomic, it naturally handles concurrent submissions and race conditions perfectly for cohort sizes of ~100+ candidates without requiring complex database locks.

## Environment Variables

The backend relies on the following environment variables (which should be placed in `server/.env`):

```text
PORT=3000
ADMIN_PASSWORD=your_secure_password_here
```
*(See `server/.env.example`)*

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your `.env` file in the `server` directory (copy from `.env.example`).
3. Run the development environment:
   ```bash
   npm run dev
   ```
   *This command uses `concurrently` to run both the Vite frontend (port 5173) and the Express backend (port 3000) simultaneously.*

4. Access the Candidate Portal: `http://localhost:5173/`
5. Access the Admin Portal: `http://localhost:5173/admin`

## Production Build

To build the frontend for production, run:

```bash
npm run build
```

This will compile the React application into static assets in the `dist/` directory. 

## Deployment

The simplest deployment architecture for this application is hosting it on a VPS (like DigitalOcean, AWS EC2, or Azure VM) running Node.js.

1. Clone the repository to the server.
2. Run `npm install` and `npm run build`.
3. Create the `server/.env` file with a strong `ADMIN_PASSWORD`.
4. Run the backend server directly, making it serve the frontend static files:
   - Modify `server.js` (if needed for production serving) or use a reverse proxy like Nginx.
   - Currently, Vite handles proxying in development. In production, you would typically serve the `dist/` folder statically via Express (e.g. `app.use(express.static('dist'))`) or use Nginx to route `/api` to the Node process and serve `dist` directly.
5. Use a process manager like `pm2` to keep the backend running continuously:
   ```bash
   pm2 start server/server.js --name "ldselect-backend"
   ```

*Note: Since the database is a local JSON file, serverless hosting (like Vercel/Netlify for the backend) is NOT recommended as the filesystem is ephemeral and you would lose candidate data upon each deployment or serverless spin-down.*
