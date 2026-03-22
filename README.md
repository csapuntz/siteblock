# SiteBlock

A Chrome extension that blocks websites to discourage procrastination.

## Running the Tests

Tests use [Vitest](https://vitest.dev/) and run from the command line via Node.js.

### Prerequisites

Node.js and npm must be on your `PATH`. On this machine they are installed via
Linuxbrew, so add this to your shell's rc file if the commands below aren't
found:

```bash
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
```

Install dependencies once (creates `node_modules/`):

```bash
npm install
```

### Run

```bash
npm test
```

All tests in `js/siteblock.test.js` will run and results are printed to the
terminal.

### Test file

`js/siteblock.test.js` — covers the core `siteblock.js` library:

| Test | What it checks |
|---|---|
| blacklist blocking | URLs matching blacklist rules are blocked |
| whitelist (allow-all-except) | Whitelisted URLs bypass a catch-all block |
| usage tracker | Time-based allowance is correctly accumulated and reset |
| long interval | Sessions exceeding the 2-minute window aren't counted |
| timer and full blocking flow | End-to-end tab tracking, allowance expiry, and reset |

