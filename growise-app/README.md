# Growise

A local-first garden planner for home growers. Growise runs in a modern browser, stores plants and journal notes in that browser's local storage, and can be installed as a small offline-capable PWA.

## Run

Requires Node.js 20 or newer. No package install or third-party runtime dependency is needed.

```sh
npm run dev
```

Open `http://localhost:4173`. To use another port, set `PORT` before starting the server. `npm start` runs the same static server; a production deployment can serve these files from any HTTPS static host.

## What it does

- Organizes a plant collection with location, light, and watering interval details.
- Shows due and upcoming watering reminders based on the last date marked watered.
- Keeps a dated garden journal linked to individual plants or the whole garden.
- Exports and restores a versioned JSON backup. Restoring replaces the current garden after confirmation.
- Caches the app shell and garden photo for offline use after the first visit.

## Privacy and data

Plant and journal data stays in the browser profile on this device. Growise has no account, analytics, backend, weather feed, or cross-device sync. Clearing browser site data removes the garden, so keep an exported backup somewhere safe. The built-in server is for local development and static preview; production hosting should use HTTPS for service-worker installation.

The dashboard photo is bundled locally from Unsplash (photo ID `1501004318641-b39e6451bec6`). Fonts use local system fallbacks; no third-party font or image request is needed at runtime.

## Checks

```sh
npm test
npm run check
```
