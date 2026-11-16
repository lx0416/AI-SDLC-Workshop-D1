// Snip backend: a single-file URL shortener. Storage is an in-memory Map by design.
import { randomInt } from "node:crypto";
import { join, resolve, sep } from "node:path";

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`) ||
  `http://localhost:${PORT}`
).replace(/\/$/, "");
const PUBLIC_DIR = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : null;

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 20;

const links = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += BASE62[randomInt(BASE62.length)];
  return code;
}

function newCode() {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    if (!links.has(code)) return code;
  }
  throw new Error("could not allocate a unique code");
}

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function toPublic(link) {
  return {
    code: link.code,
    url: link.url,
    shortUrl: `${BASE_URL}/${link.code}`,
    hits: link.hits,
    createdAt: link.createdAt,
  };
}

async function createLink(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }
  const url = body?.url;
  if (!isHttpUrl(url)) {
    return json({ error: "url must be an absolute http or https URL" }, 400);
  }
  const link = { code: newCode(), url, hits: 0, createdAt: new Date().toISOString() };
  links.set(link.code, link);
  return json(toPublic(link), 201);
}

// Returns a file from PUBLIC_DIR only when it resolves inside that folder.
async function staticFile(pathname) {
  if (!PUBLIC_DIR) return null;
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const target = resolve(join(PUBLIC_DIR, relative));
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + sep)) return null;
  const file = Bun.file(target);
  return (await file.exists()) ? file : null;
}

async function handle(req) {
  const url = new URL(req.url);
  const { pathname } = url;

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (pathname === "/api/links") {
    if (req.method === "POST") return createLink(req);
    if (req.method === "GET") return json([...links.values()].map(toPublic));
    return json({ error: "Method not allowed" }, 405);
  }

  if (req.method === "GET") {
    const file = await staticFile(pathname);
    if (file) return new Response(file, { headers: CORS_HEADERS });

    const code = pathname.slice(1);
    const link = links.get(code);
    if (link) {
      link.hits += 1;
      return new Response(null, { status: 302, headers: { ...CORS_HEADERS, Location: link.url } });
    }
  }

  return json({ error: "Not found" }, 404);
}

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: handle,
});

console.log(`Snip backend listening on http://localhost:${PORT} (BASE_URL=${BASE_URL})`);
