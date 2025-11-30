# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This project is a Node.js application that bridges Discord and a Raspberry Pi to control and monitor a connected PC. It has three main responsibilities:

- **Discord bot**: Listens to commands and button interactions in a Discord server to start/reboot/shutdown a PC and query status/monitoring data.
- **Monitoring & logging**: Periodically reads Raspberry Pi system metrics (temperature, memory, CPU, uptime), stores them in SQLite, and maintains a rolling JSON history.
- **Web dashboard & API**: Serves an HTTP dashboard and JSON APIs for temperature/history/stats and PC control, plus real-time updates via Socket.IO.

## Key Commands & Workflows

All commands assume the repository root (`package.json`) as the working directory.

### Install dependencies

```bash
npm install
```

### Run the Discord bot + web dashboard

```bash
node index.js
```

This:
- Logs in a Discord bot using `config.json`.
- Starts the Express + Socket.IO web server on port `3001` (see `WebServer.start()` in `webserver.js`).
- Begins periodic monitoring/alert intervals.

Before running, ensure `config.json` exists and is populated (see **Configuration & Secrets** below).

### Test commands (Vitest)

`package.json` defines only test-related scripts:

- Run the full test suite once:

  ```bash
  npm test
  ```

- Watch mode (reruns tests on file change):

  ```bash
  npm run test:watch
  ```

- Vitest UI:

  ```bash
  npm run test:ui
  ```

### Running a single test file or test case

Vitest is wired as `"test": "vitest run"`. Common patterns that work here:

- Single test file by path:

  ```bash
  npm test -- test/pc-control-api.test.js
  ```

- Single test case by name (substring match):

  ```bash
  npm test -- -t "PC Control API Endpoints"
  ```

Use these forms when modifying specific subsystems so you can rerun only the relevant tests.

## Configuration & Secrets (`config.json`)

The bot and web server are configured via `config.json` in the repo root. Fields used across the codebase include:

- `prefix`: Command prefix for Discord messages (e.g. `!`).
- `token`: Discord bot token.
- `globalsec`: Lifetime (seconds) for bot messages before auto-delete.
- `status`: Current PC status (`"off"`, `"on"`, `"posting"`, `"shutting"`, `"rebooting"`), updated by `index.js` and used for presence.
- `channel`: Discord channel ID used for commands and server-control buttons.
- `serverip`: IP address of the controlled PC, used by `ping` checks and the web API.
- `required_role`: Object `{ use: boolean, name: string }` controlling role-based access to most commands.
- `serverControlMessageId`: Added/maintained by `ensureServerControlMessage` in `index.js` to track the message containing the control buttons.

When editing or discussing this file in Warp:
- **Do not include the actual Discord token value** in responses; use placeholders (e.g. `"YOUR_DISCORD_TOKEN"`).
- Treat real values in `config.json` as secrets even if they are currently committed.

## High-Level Architecture

### 1. Entry Point & Discord Bot (`index.js`)

`index.js` is the main orchestrator and wires together Discord, monitoring, the database, and the web server:

- **Imports & initialization**:
  - Uses `discord.js` to create a `Client` with `GUILDS` and `GUILD_MESSAGES` intents.
  - Loads `config.json` and copies key fields into module-level variables via `loadconfig()`.
  - Instantiates:
    - `PiMonitor` from `monitor.js` for system metrics.
    - `TemperatureDB` from `database.js` for SQLite logging.
    - `WebServer` from `webserver.js` for HTTP + Socket.IO.

- **`client.on('ready')`**:
  - Logs startup, calls `webServer.start()` to boot the HTTP server.
  - Calls `updatePresence()` to set Discord presence based on current status and Pi temperature.
  - Fetches the configured `channelid` and calls `ensureServerControlMessage(channel)` to ensure a pinned "SERVERCONTROL & MONITORING" message with interactive buttons exists.

- **Message-based commands (`messageCreate`)**:
  - Ignores bot messages and those without the configured `prefix`.
  - Parses the command word + args, deletes the invoking message, and enforces that commands run only in the configured control channel.
  - Implements commands such as:
    - `setchannel` (admin-only): updates `config.channel` and recreates the server-control message.
    - `help`: lists available commands, including extra entries for admins.
    - `status`, `post`, `reboot`, `shutdown`, `force-shutdown`, `ping`:
      - Call shell scripts in `shellscripts/` (`post.sh`, `reboot.sh`, `shutdown.sh`, `force-shutdown.sh`) via `child_process.exec`.
      - Maintain `config.status` and persist it via `save()`.
      - Use helper flows `afterposton`, `aftershutoff`, `afterreboot`/`afterrebooton` to poll `ping` until the PC is confirmed online/offline again, updating Discord presence and notifying the web server (`webServer.notifyPCStatusChange(...)`).
    - Monitoring-related commands:
      - `temp`: on its own, queries `monitor.getCPUTemp()` and formats status; with `temp history`, uses `monitor.getTemperatureHistory()` and `monitor.formatTemperatureHistory()`.
      - `monitor`: combines current temp, `monitor.getSystemStats()`, and `config.status` into a status message.
      - `dashboard`: sends the web dashboard URL from `webServer.getURL()`.
    - `reload`: reloads `config.json` from disk and re-applies via `loadconfig()`.

- **Button interactions (`interactionCreate`)**:
  - Listens for button presses wired in `ensureServerControlMessage` (custom IDs `start`, `stop`, `reboot`, `status`, `temp`, `monitor`, `temp_history`, `dashboard`).
  - Enforces the same channel and role checks.
  - For `start`/`stop`/`reboot` buttons:
    - Executes the same shellscripts as the text commands.
    - Updates `config.status`, saves config, calls `updatePresence()`, and triggers the corresponding `after*` helpers.
  - For `temp`/`monitor`/`temp_history`/`dashboard`, it mirrors the message commands but replies ephemerally.

- **Background intervals & alerts**:
  - **PC status correction**: every 2 hours, pings `serverip` and auto-corrects `config.status` to `"on"`/`"off"` if it does not match reality, logging to `activity.log` and notifying the web server.
  - **Temperature monitoring**: every 5 minutes:
    - Reads CPU temp via `monitor.getCPUTemp()` and system stats via `monitor.getSystemStats()`.
    - Calls `monitor.saveTemperatureHistory(temp)` and logs into SQLite via `database.logTemperature(...)`.
    - Checks thresholds (warm/hot/critical) from `monitor.getTempStatus()` and, if exceeded, logs to `activity.log` and sends a Discord alert to the control channel.
    - Calls `updatePresence()` with the latest temperature.

- **Support utilities**:
  - `sendMessage(channel, text, sec)`: sends a message and schedules it for deletion after `sec` seconds.
  - `updatePresence()`: sets the bot's status and activity string based on `config.status` and current Pi temperature.
  - `ensureServerControlMessage(channel)`: ensures there is exactly one canonical message with server-control and monitoring buttons, updating `config.serverControlMessageId` as needed.
  - `logActivity(text)`: appends timestamped entries to `activity.log`.

When changing any PC-control behavior, you typically must coordinate changes across:
- `index.js` (Discord commands + status machine),
- `shellscripts/*` (actual GPIO/PC control), and
- `webserver.js` + tests (HTTP control endpoints and status reporting).

### 2. Monitoring Layer (`monitor.js`)

`PiMonitor` encapsulates Raspberry Pi system inspection and temperature history:

- **Temperature reading**:
  - `getCPUTemp()`: reads `/sys/class/thermal/thermal_zone0/temp` and returns temperature in °C (one decimal). Returns `null` on error.

- **System stats**:
  - `getSystemStats()`: runs `free -m && uptime && top -bn1` and passes output to `parseSystemData(...)`.
  - `parseSystemData(output)`:
    - Parses `free -m` lines to compute total/used memory and usage percentage.
    - Extracts human-readable uptime from the `uptime` line via `parseUptime(...)`.
    - Attempts to parse CPU usage from the `%Cpu` line; falls back to load average normalized by CPU core count if needed.

- **Temperature classification**:
  - `getTempStatus(temp)`: maps a numeric temp to `{ emoji, status, color }` buckets: below 60°C (Normal), 60–70°C (Warm), 70–80°C (Hot), 80°C+ (Critical).

- **History storage**:
  - History file: `monitoring_history.json` in the repo root.
  - `saveTemperatureHistory(temp)`: appends temp + timestamp, maintaining only the most recent `maxHistoryEntries` (24 hours at 5-minute intervals).
  - `getTemperatureHistory(hours)`: returns the subset of history entries newer than `hours` ago.
  - `formatTemperatureHistory(history)`: produces a Discord-ready text summary, grouping entries by hour with average temps and a final current temperature line.

The monitoring logic is used by both Discord commands and the HTTP API; when you change temperature thresholds or the structure of `formatTemperatureHistory`, update the commands in `index.js` and any tests that assert on those strings.

### 3. Persistence Layer (`database.js`)

`TemperatureDB` manages an on-disk SQLite database (`temperature.db` in the repo root):

- **Initialization**:
  - Opens the DB file on construction and calls `createTables()`.
  - `createTables()` defines a `temperature_logs` table with timestamp, temperature, status, CPU load, memory usage/total, and uptime.

- **Logging measurements**:
  - `logTemperature(temp, status, systemStats)`: inserts a new row; called from the 5-minute interval in `index.js`.

- **Read APIs used by the dashboard**:
  - `getTemperatureData(hours)`: returns detailed rows for the last N hours (used by `/api/temperature/:hours?`).
  - `getTemperatureStats(hours)`: returns aggregate stats (count, min, max, avg, first/last readings) used by `/api/stats/:hours?`.
  - `exportToCSV(hours)`: produces CSV for the last N hours, used by `/api/export/:hours?`.

These methods are tightly coupled to the HTTP routes in `webserver.js`. If you alter columns or query shapes here, ensure the corresponding routes and tests are updated.

### 4. Web Dashboard & HTTP API (`webserver.js` + `public/`)

`WebServer` owns the Express application, HTTP server, Socket.IO, and the main dashboard routes:

- **Construction**:
  - Accepts a `database` (TemperatureDB-like) and `monitor` (PiMonitor-like) instance.
  - Creates `this.app`, `this.server`, `this.io`, sets `this.port = 3001`, then calls `setupRoutes()` and `setupSocketIO()`.

- **Static assets**:
  - Serves `public/` as static files (dashboard HTML, favicon, etc.).
  - Both `/` and `/dashboard` send `public/dashboard.html`.
  - `public/pc-start.html` is a dedicated page for direct PC start via browser.

- **Monitoring API routes**:
  - `GET /api/temperature/:hours?` → `database.getTemperatureData(hours)`.
  - `GET /api/stats/:hours?` → `database.getTemperatureStats(hours)`.
  - `GET /api/current` → `monitor.getCPUTemp()`, `monitor.getTempStatus(...)`, and `monitor.getSystemStats()`.
  - `GET /api/export/:hours?` → `database.exportToCSV(hours)` + CSV download headers.

- **PC status & control API**:
  - `GET /api/pc/status`:
    - Reads `serverip` from `config.json` and pings it.
    - Returns `{ pcStatus: 'ONLINE'|'OFFLINE', pcIP, timestamp, botStatus: 'ONLINE' }`.
  - `GET /start-pc`:
    - Serves `public/pc-start.html` (HTML UI only).
  - `GET /api/pc/start` and `POST /api/pc/start`:
    - Execute `shellscripts/post.sh` via `child_process.exec` with a 30s timeout.
    - On success, log to console and respond with `{ success: true, message, status: 'starting', timestamp }`.
    - On timeout or error, respond with consistent error payloads (`success: false`, `message`, `error`, `status` fields) and appropriate HTTP status (e.g. 408 for timeout, 500 on error).
    - After a successful call, schedule `this.broadcastPCStatus()` shortly later to push an updated PC status via Socket.IO.
  - `POST /api/pc/shutdown`:
    - Mirrors the start endpoints but runs `shellscripts/shutdown.sh` and returns `status: 'shutting_down'` on success.

- **Server lifecycle and real-time updates**:
  - `start()`:
    - Binds the HTTP server on `0.0.0.0:3001`.
    - Logs both localhost and discovered LAN IP dashboard URLs.
    - Sets intervals:
      - Every 30s: `broadcastUpdate()` to emit a `temperatureUpdate` event and then `broadcastPCStatus()`.
      - Every 2 minutes: `broadcastPCStatus()` for more frequent PC status updates.
      - Once after 5 seconds: initial `broadcastPCStatus()`.
  - `setupSocketIO()`:
    - Logs basic connect/disconnect events from dashboard clients.
  - `broadcastUpdate()`:
    - Aggregates a current temperature + status snapshot and emits `temperatureUpdate`.
  - `broadcastPCStatus()`:
    - Pings `serverip` and emits `pcStatusUpdate` with the ONLINE/OFFLINE status.
  - `getCurrentPCStatus()`:
    - Returns a Promise resolving to the same structure as `/api/pc/status`; useful for internal callers.
  - `notifyPCStatusChange(status)`:
    - Emits `pcStatusUpdate` with a status pushed from `index.js` when the PC changes state due to a Discord command.
  - `getURL()`:
    - Derives a best-effort LAN URL (using the first non-internal IPv4 address) for use in Discord messages.

Changes in any PC status representation (`ONLINE`/`OFFLINE`, field names, etc.) must remain consistent across:
- `/api/pc/status` and related JSON payloads.
- Socket.IO events `pcStatusUpdate`.
- Frontend code and tests that consume this data.

### 5. Shell Integration (`shellscripts/`)

The `shellscripts/` directory contains the actual OS-level scripts used to control the PC:

- Modern entry points: `post.sh`, `reboot.sh`, `shutdown.sh`, `force-shutdown.sh`.
- `legacy/` contains older versions kept for reference.

These scripts are referenced:
- From `index.js` for Discord commands and button interactions.
- From `webserver.js` for the HTTP control endpoints.

If you change script names, locations, or expected behavior, update both modules and their tests.

### 6. Frontend Behavior & Tests (`public/`, `test/pc-control-frontend.test.js`)

The dashboard’s frontend logic is primarily tested via `test/pc-control-frontend.test.js` using JSDOM:

- The test file defines a minimal HTML document with two buttons (`startPCBtn`, `shutdownPCBtn`) and inline `<script>` implementing:
  - `updateButtonState(button, state, text, disabled)`: UI state machine for buttons (`loading`, `error`, `online`, `offline`, `default`, etc.).
  - `startPC()` and `shutdownPC()`: call `/api/pc/start` and `/api/pc/shutdown`, manage optimistic UI updates, handle network/HTTP errors, and set up timeouts for long-running operations.
  - `updatePCButtonStates()` and `updatePCButtonStatesFromStatus(data)`: reconcile button states with `/api/pc/status` responses and real-time Socket.IO updates.

Tests assert that:
- Buttons prevent double-clicking when disabled.
- Loading/error/online/offline states are applied consistently.
- API responses and failures map to specific button text and classes.
- Timeouts for long-running start/shutdown flows are set.

When changing the web API response format, ensure the frontend tests continue to match the new contract.

### 7. Backend API Tests (`test/pc-control-api.test.js`, `test/setup.js`)

- `test/setup.js` sets up global Vitest mocks:
  - Mocks `child_process.exec` so tests can assert on commands and simulate async completion/timeout/errors.
  - Mocks `config.json` to a stable `serverip`.
  - Mocks `fs` and `path.join` to provide deterministic script paths.
  - Exposes utilities `global.mockExec`, `global.mockExecTimeout`, and `global.mockExecError` for use in tests.

- `test/pc-control-api.test.js` focuses on `WebServer` and its endpoints:
  - Uses `supertest` against an Express app from a `WebServer` instance built with mocked `database` and `monitor` objects.
  - Verifies:
    - Success, timeout, and error behavior of `/api/pc/start` and `/api/pc/shutdown`.
    - That `/api/pc/status` reflects ping success/failure.
    - That successful control commands trigger `webServer.broadcastPCStatus()` after a short delay.
    - That success/error responses include required fields (`success`, `message`, `timestamp`, `status`, and for errors, `error`).
    - Concurrent requests handling and basic Socket.IO integration.

When modifying API semantics or error structures, always update these tests to preserve expected contracts.

## README Highlights

The existing `README.md` documents:

- **Requirements**: Node.js and npm, plus WiringPi on newer Raspbian versions for GPIO control.
- **Basic installation**: clone the repo, run `npm install`, configure `config.json`, and start the bot with `node index.js`.
- **Discord configuration**: obtain a bot token (see README link) and fill `config.json` (prefix, `token`, message lifetime, status, channel, server IP, and optional required role).
- **Deployment on Raspberry Pi**: example `systemd` service unit to run the bot as a background service and start on boot.
- **User-facing Discord commands**: documentation of the same commands implemented in `index.js` (`post`, `reboot`, `shutdown`, `status`, `temp`, `temp history`, `monitor`, `force-shutdown`, `setchannel`, `reload`, `ping`).

When in doubt about how the system is expected to behave from an operator’s perspective, the README is the authoritative source for user-facing behavior, while the files summarized above define the current implementation details.
