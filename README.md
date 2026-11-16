# Snip

Snip is a tiny URL shortener with one backend and two clients: an Angular web
app and a Node.js CLI. The backend stores links in memory, so restarting it
clears them.

## Repository layout

Each component has its own orphan branch and is mounted here as a submodule:

| Branch | Path | Contents |
| --- | --- | --- |
| `backend` | `backend/` | Bun API server |
| `frontend` | `frontend/` | Angular 19 web app |
| `cli` | `cli/` | CommonJS Node.js CLI |
| `bundle` | `bundle/` | Generated release: server, web app, and CLI |
| `main` | repository root | Submodule pointers, build script, and CI |

Clone with submodules initialized:

```sh
git clone --recurse-submodules https://github.com/lx0416/AI-SDLC-Workshop-D1.git
```

For an existing plain clone, run `git submodule update --init --recursive`.

## API contract

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/links` | `{ "url": "https://…" }` → `201 { code, url, shortUrl, hits, createdAt }`; invalid JSON or URL → `400 { error }` |
| `GET` | `/api/links` | `200` with an array of link records |
| `GET` | `/:code` | `302` redirect and incremented hit count; `404` for an unknown code |

The backend is the source of truth for this contract; update both clients when it
changes. Storage is intentionally in-memory.

## Run locally

From a recursive clone, use separate terminals:

```sh
cd backend && bun start
cd frontend && npm install && npx ng serve
cd cli && node cli.js ls
```

The backend defaults to `http://localhost:3000`; Angular serves on port `4200`.
Set `SNIP_API` to change the CLI's backend URL.

## Update workflow

Commit and push a component change from its submodule branch, then update and
commit that pointer in this repository:

```sh
cd backend
git add -A && git commit -m "Update backend" && git push
cd ..
git submodule update --remote backend
git add backend && git commit -m "Bump backend submodule" && git push
```

Repeat for `frontend` or `cli`. Generate releases with
`node scripts/build-bundle.mjs`; add `--push` to publish the bundle and the
updated `main` pointer.
