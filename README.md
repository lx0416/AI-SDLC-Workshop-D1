# Snip backend

A zero-dependency [Bun](https://bun.sh) server for a tiny URL shortener. Links are stored in memory, so restarting the server clears them.

## Run

```sh
bun start            # listens on PORT (default 3000)
```

## Configuration

| Variable      | Default                                                        | Purpose                                                          |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `PORT`        | `3000`                                                         | Port to listen on                                                |
| `BASE_URL`    | `https://$RAILWAY_PUBLIC_DOMAIN` if set, else `http://localhost:PORT` | Origin used to build `shortUrl`                           |
| `PUBLIC_DIR`  | unset                                                          | When set, also serve static files from this folder (`/` → `index.html`; an existing file wins over a short code) |

## API

| Method | Path         | Body                     | Response                                                                        |
| ------ | ------------ | ------------------------ | ------------------------------------------------------------------------------- |
| `POST` | `/api/links` | `{ "url": "https://…" }` | `201` `{ code, url, shortUrl, hits, createdAt }` · `400` `{ error }` on invalid JSON or URL |
| `GET`  | `/api/links` | —                        | `200` array of all links (same shape)                                           |
| `GET`  | `/:code`     | —                        | `302` to the original URL (+1 hit) · `404` `{ error }` if unknown               |

Codes are 6 random base62 characters. Only `http:` and `https:` URLs are accepted. CORS is open to all origins.

## Example

```sh
curl -X POST localhost:3000/api/links -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
curl -i localhost:3000/<code>      # 302, hits +1
```
