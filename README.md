# PC Starter (Raspberry Pi PC Power Controller)

Small Node.js service that runs on a Raspberry Pi and lets you **start and shut down a PC over the network** using simple HTTP endpoints and a web dashboard.

No Discord, no temperature monitoring, no database – just PC power control.

---

## Features

- **Start PC** via a shell script (`shellscripts/post.sh`).
- **Shutdown PC** via a shell script (`shellscripts/shutdown.sh`).
- **PC status check** using `ping` against the configured IP.
- **Web dashboard** at `/dashboard` with:
  - Start / Shutdown buttons
  - Status indicator (online/offline)
  - Quick IP copy shortcuts
- **Direct start page** at `/start-pc` for a one-click "start PC" view.
- **JSON API** for integration with other tools (Home Assistant, shortcuts, etc.).

---

## Requirements

- Node.js and npm installed on the Raspberry Pi.
- A POSIX shell environment on the Pi (for running the `post.sh` and `shutdown.sh` scripts).
- The `ping` command available (used to detect whether the PC is online).

---

## Installation

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/King007t/dc-rpi-remote-pc-start.git
cd dc-rpi-remote-pc-start
npm install
```

2. Adjust the shell scripts in `shellscripts/` to fit your hardware setup
   (e.g. GPIO pins, wake-on-LAN, relays, etc.).

---

## Configuration

Configuration is done via `config.json` in the project root.

Minimal example:

```json
{
  "status": "off",
  "serverip": "192.168.0.13"
}
```

- `status`  
  Initial PC status. This will be auto-corrected over time using `ping`.
- `serverip`  
  IP address of the PC that should be controlled.

> Note: There are no secrets or tokens anymore. If you expose this outside your LAN,
> make sure you put it behind proper authentication / HTTPS yourself.

---

## Running the service

Start the service in the foreground:

```bash
npm start
```

By default this will:

- Start an HTTP server on port `3001`.
- Serve the web dashboard at:
  - `http://localhost:3001/dashboard` on the Pi itself.
  - `http://<pi-ip>:3001/dashboard` from other devices on the network.
- Periodically (every 2 hours) ping the configured `serverip` and auto-correct `status`
  in `config.json`.

To make it always-on, see the systemd example below.

---

## HTTP API

All endpoints are served by `webserver.js`.

### `GET /api/pc/status`

Check whether the configured PC is online.

**Response (JSON):**

```json
{
  "pcStatus": "ONLINE" | "OFFLINE",
  "pcIP": "192.168.0.13",
  "timestamp": "2024-01-01T12:34:56.789Z",
  "botStatus": "ONLINE"
}
```

### `POST /api/pc/start`

Start the PC via `shellscripts/post.sh`.

- Executes the script with a 30-second timeout.
- Returns a JSON payload indicating whether the command was dispatched.

**Response on success (200):**

```json
{
  "success": true,
  "message": "PC start command executed successfully",
  "timestamp": "2024-01-01T12:34:56.789Z",
  "status": "starting"
}
```

### `GET /api/pc/start`

Same as `POST /api/pc/start`, but triggerable via a simple GET
(e.g. browser bookmark, webhook that cannot send POST).

### `POST /api/pc/shutdown`

Shutdown the PC via `shellscripts/shutdown.sh`.

**Response on success (200):**

```json
{
  "success": true,
  "message": "PC shutdown command executed successfully",
  "timestamp": "2024-01-01T12:34:56.789Z",
  "status": "shutting_down"
}
```

### `POST /api/server/restart`

Ask the Node process to exit so an external supervisor (e.g. systemd)
can restart it.

This returns a success JSON and then calls `process.exit(0)` after a short delay.

---

## Web UI

### Dashboard (`/dashboard`)

- Buttons:
  - **PC Status** → calls `/api/pc/status` and shows a popup with details.
  - **Start PC** → calls `/api/pc/start`.
  - **Shutdown PC** → calls `/api/pc/shutdown`.
  - **Restart Server** → calls `/api/server/restart`.
- Status indicator circle (green/red) shows if the PC is online.
- Quick IP tiles for copying common IPs to the clipboard.
- Uses Socket.IO to receive live `pcStatusUpdate` events and update the UI
  without page reload.

### Direct start page (`/start-pc`)

- Simple page that:
  - Immediately calls `/api/pc/start` on load.
  - Shows a spinner, a progress bar, and checks `/api/pc/status` periodically.
  - Shows success or timeout after a while.

You can bookmark this URL or trigger it from other tools for a one-click "start PC".

---

## Running as a systemd service (optional)

Example service file to run on boot (on a typical Raspberry Pi OS):

```ini
[Unit]
Description=pc-starter (Raspberry Pi PC power controller)
After=network.target

[Service]
Type=simple
Restart=on-failure
RestartSec=5
User=pi
Group=pi
WorkingDirectory=/home/pi/dc-rpi-remote-pc-start
ExecStart=/usr/bin/node /home/pi/dc-rpi-remote-pc-start/server.js

[Install]
WantedBy=multi-user.target
```

Steps:

```bash
sudo nano /lib/systemd/system/pc-starter.service
# paste the content above, then save

sudo systemctl daemon-reload
sudo systemctl enable pc-starter.service
sudo systemctl start pc-starter.service
```

---

## Security notes

- This service does **not** implement authentication or TLS on its own.
- Intended usage is inside a trusted LAN.
- If you want to expose it over the internet, put it behind a reverse proxy
  (NGINX, Caddy, Traefik, etc.) with HTTPS and authentication.

---

## Development & tests

- Code entrypoint: `server.js`.
- HTTP server & Socket.IO: `webserver.js`.
- PC control scripts: `shellscripts/` (you own these; adjust to your hardware).
- Dashboard HTML/CSS/JS: `public/dashboard.html` and `public/pc-start.html`.
- API & frontend tests (Vitest): `test/` directory.

To run tests (after adding `vitest` as a dev dependency if needed):

```bash
npm test
```