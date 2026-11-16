import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "bundle");
const frontend = join(root, "frontend");
const buildOutput = join(frontend, "dist", "snip-frontend", "browser");
const shouldPush = process.argv.includes("--push");

function run(command, args, cwd = root, allowFailure = false) {
  const executable =
    process.platform === "win32" && ["npm", "npx"].includes(command)
      ? `${command}.cmd`
      : command;
  const result = spawnSync(executable, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result.status;
}

function git(args, cwd = root, allowFailure = false) {
  return run("git", args, cwd, allowFailure);
}

function stagedChanges(cwd) {
  const status = git(["diff", "--cached", "--quiet"], cwd, true);
  if (status === 1) return true;
  if (status === 0) return false;
  throw new Error(`git diff --cached --quiet failed with exit code ${status}`);
}

if (!existsSync(join(root, ".gitmodules")) || !existsSync(bundle) || !existsSync(frontend)) {
  throw new Error("Run this script from a main checkout with initialized submodules.");
}

git(["submodule", "update", "--init", "--remote", "backend", "frontend", "cli"]);
run("npm", ["install"], frontend);
run("npx", ["ng", "build"], frontend);

if (!existsSync(join(buildOutput, "index.html"))) {
  throw new Error(`Angular build output is missing: ${join(buildOutput, "index.html")}`);
}

for (const name of readdirSync(bundle)) {
  if (name !== ".git") rmSync(join(bundle, name), { recursive: true, force: true });
}

mkdirSync(join(bundle, "public"), { recursive: true });
cpSync(join(root, "backend", "server.js"), join(bundle, "server.js"));
cpSync(join(root, "cli", "cli.js"), join(bundle, "cli.js"));
cpSync(buildOutput, join(bundle, "public"), { recursive: true });
writeFileSync(
  join(bundle, "README.md"),
  "# Generated Snip bundle\n\nThis branch contains generated release output. Do not edit it by hand; rebuild it from `main` with `node scripts/build-bundle.mjs`.\n",
);
writeFileSync(join(bundle, ".env"), "PUBLIC_DIR=./public\n");
writeFileSync(
  join(bundle, "package.json"),
  `${JSON.stringify({ name: "snip-bundle", version: "1.0.0", private: true, scripts: { start: "bun server.js" } }, null, 2)}\n`,
);
writeFileSync(
  join(bundle, "Dockerfile"),
  "FROM oven/bun:1-alpine\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD [\"bun\", \"server.js\"]\n",
);
writeFileSync(join(bundle, ".dockerignore"), "node_modules\n.git\n");
writeFileSync(
  join(bundle, "railway.json"),
  `${JSON.stringify({ build: { builder: "DOCKERFILE" } }, null, 2)}\n`,
);

git(["add", "-A"], bundle);
if (stagedChanges(bundle)) {
  git(["commit", "-m", "Build generated Snip bundle"], bundle);
} else {
  console.log("bundle unchanged");
}

git(["add", "backend", "frontend", "cli", "bundle"]);
if (stagedChanges(root)) {
  git(["commit", "-m", "Update generated bundle and source submodules"]);
} else {
  console.log("main submodule pointers unchanged");
}

if (shouldPush) {
  git(["push", "origin", "HEAD:bundle"], bundle);
  git(["push", "origin", "main"]);
}
