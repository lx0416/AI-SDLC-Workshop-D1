# Snip CLI

A zero-dependency CommonJS CLI for the Snip URL shortener. Requires Node.js 20+
for its built-in `fetch`.

```sh
node cli.js add https://example.com
node cli.js ls
node cli.js open abc123
node cli.js help
```

Set `SNIP_API` to the backend origin when it is not running at
`http://localhost:3000`. The `snip`, `snip.cmd`, and `snip.ps1` wrappers forward
arguments to `cli.js` on POSIX, Windows Command Prompt, and PowerShell.

Run the dependency-free CLI tests with `npm test`.
