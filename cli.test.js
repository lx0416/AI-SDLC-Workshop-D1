"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { formatLinks, getBrowserCommand, validateUrl } = require("./cli");

const cliPath = path.join(__dirname, "cli.js");
let server;
let api;
let links = [];

before(async () => {
  server = http.createServer(async (req, res) => {
    if (req.url === "/api/links" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(links));
      return;
    }
    if (req.url === "/api/links" && req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const { url } = JSON.parse(raw);
      const link = { code: "a1B2c3", url, shortUrl: `http://short.test/a1B2c3`, hits: 0 };
      links.push(link);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(link));
      return;
    }
    if (req.url === "/a1B2c3") {
      res.writeHead(302, { Location: links[0]?.url || "https://example.com" });
      res.end();
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  api = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function run(args, base = api, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, SNIP_API: base, ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("validates absolute HTTP(S) URLs", () => {
  assert.equal(validateUrl("https://example.com/path"), "https://example.com/path");
  assert.throws(() => validateUrl("javascript:alert(1)"), /http or https/);
  assert.throws(() => validateUrl("not a URL"), /http or https/);
});

test("prints help and empty-list output", async () => {
  links = [];
  assert.match((await run(["help"])).stdout, /Usage:/);
  assert.equal((await run(["ls"])).stdout.trim(), "No links yet.");
});

test("adds and lists links using the shared API shape", async () => {
  links = [];
  const added = await run(["add", "https://example.com/page"]);
  assert.equal(added.status, 0, added.stderr);
  assert.equal(added.stdout.trim(), "http://short.test/a1B2c3");

  const listed = await run(["ls"]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /CODE\s+HITS\s+URL/);
  assert.match(listed.stdout, /a1B2c3\s+0\s+https:\/\/example\.com\/page/);
});

test("rejects malformed arguments and reports unavailable API with exit 1", async () => {
  const badUrl = await run(["add", "ftp://example.com"]);
  assert.equal(badUrl.status, 1);
  assert.match(badUrl.stderr, /http or https/);

  const badArgs = await run(["open", "not-a-code"]);
  assert.equal(badArgs.status, 1);
  assert.match(badArgs.stderr, /Usage: snip open/);

  const unavailable = await run(["ls"], "http://127.0.0.1:1");
  assert.equal(unavailable.status, 1);
  assert.match(unavailable.stderr, /Could not reach/);
});

test("opens manual redirects and reports unknown codes", async (t) => {
  links = [{ code: "a1B2c3", url: "https://example.com", shortUrl: "", hits: 0 }];
  if (process.platform === "win32") {
    t.skip("Browser launcher execution is covered by platform mapping tests on Windows");
    return;
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "snip-cli-test-"));
  const openerName = process.platform === "darwin" ? "open" : "xdg-open";
  const opener = path.join(tempDir, openerName);
  const outputPath = path.join(tempDir, "opened-url");
  try {
    await fs.writeFile(
      opener,
      '#!/bin/sh\nprintf "%s" "$1" > "$SNIP_TEST_BROWSER_OUTPUT"\n',
      "utf8",
    );
    await fs.chmod(opener, 0o755);
    const opened = await run(["open", "a1B2c3"], api, {
      PATH: `${tempDir}:${process.env.PATH}`,
      SNIP_TEST_BROWSER_OUTPUT: outputPath,
    });
    assert.equal(opened.status, 0, opened.stderr);
    assert.match(opened.stdout, /Opened a1B2c3/);
    let launchedUrl;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        launchedUrl = await fs.readFile(outputPath, "utf8");
        break;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    assert.equal(launchedUrl, "https://example.com/");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  const unknown = await run(["open", "z9Y8x7"]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown short code/);
});

test("selects the native browser launcher on Windows, macOS, and Linux", () => {
  assert.deepEqual(getBrowserCommand("https://example.com", "win32"), {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", 'start "" "https://example.com"'],
  });
  assert.deepEqual(getBrowserCommand("https://example.com", "darwin"), {
    command: "open",
    args: ["https://example.com"],
  });
  assert.deepEqual(getBrowserCommand("https://example.com", "linux"), {
    command: "xdg-open",
    args: ["https://example.com"],
  });
});
