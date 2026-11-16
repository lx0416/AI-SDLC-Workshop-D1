#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");

const DEFAULT_API = "http://localhost:3000";
const TIMEOUT_MS = 10_000;

const USAGE = `Usage:
  snip add <url>    Create a short link
  snip ls           List all links
  snip open <code>  Open a short link in your browser
  snip help         Show this help

Set SNIP_API to use a different backend (default: ${DEFAULT_API}).`;

function apiBase() {
  const value = process.env.SNIP_API || DEFAULT_API;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("SNIP_API must be an absolute http or https URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SNIP_API must be an absolute http or https URL");
  }
  return value.replace(/\/+$/, "");
}

function validateUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("URL must be an absolute http or https URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must be an absolute http or https URL");
  }
  return parsed.href;
}

async function request(path, options = {}) {
  const base = apiBase();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error(`Request to ${base} timed out after ${TIMEOUT_MS / 1000} seconds`);
    }
    throw new Error(`Could not reach the Snip API at ${base}: ${error.message}`);
  }

  if (options.redirect === "manual") return response;
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Snip API returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(body?.error || `Snip API request failed (HTTP ${response.status})`);
  }
  return body;
}

function getBrowserCommand(target, platform = process.platform) {
  if (platform === "win32") {
    const safeTarget = target.replace(/"/g, "%22");
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `start "" "${safeTarget}"`],
    };
  }
  if (platform === "darwin") return { command: "open", args: [target] };
  return { command: "xdg-open", args: [target] };
}

function launchBrowser(target) {
  const { command, args } = getBrowserCommand(target);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", (error) => reject(new Error(`Could not launch browser: ${error.message}`)));
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function formatLinks(links) {
  if (links.length === 0) return "No links yet.";
  const codeWidth = Math.max(4, ...links.map((link) => String(link.code).length));
  const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits).length));
  const header = `${"CODE".padEnd(codeWidth)}  ${"HITS".padStart(hitsWidth)}  URL`;
  const rows = links.map(
    (link) =>
      `${String(link.code).padEnd(codeWidth)}  ${String(link.hits).padStart(hitsWidth)}  ${link.url}`,
  );
  return [header, ...rows].join("\n");
}

async function main(args) {
  const [command, ...rest] = args;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  if (command === "add") {
    if (rest.length !== 1) throw new Error("Usage: snip add <url>");
    const url = validateUrl(rest[0]);
    const link = await request("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    console.log(link.shortUrl);
    return;
  }

  if (command === "ls") {
    if (rest.length !== 0) throw new Error("Usage: snip ls");
    const links = await request("/api/links");
    if (!Array.isArray(links)) throw new Error("Snip API returned an invalid links list");
    console.log(formatLinks(links));
    return;
  }

  if (command === "open") {
    if (rest.length !== 1 || !/^[0-9A-Za-z]{6}$/.test(rest[0])) {
      throw new Error("Usage: snip open <6-character-code>");
    }
    const response = await request(`/${rest[0]}`, { redirect: "manual" });
    if (response.status === 404) throw new Error(`Unknown short code: ${rest[0]}`);
    if (response.status !== 302) {
      throw new Error(`Snip API could not open this link (HTTP ${response.status})`);
    }
    const location = response.headers.get("location");
    if (!location) throw new Error("Snip API redirect did not include a destination");
    let target;
    try {
      target = new URL(location);
    } catch {
      throw new Error("Snip API returned an invalid redirect destination");
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("Snip API returned a non-http(s) redirect destination");
    }
    await launchBrowser(target.href);
    console.log(`Opened ${rest[0]} in your browser.`);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${USAGE}`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { formatLinks, getBrowserCommand, validateUrl };
