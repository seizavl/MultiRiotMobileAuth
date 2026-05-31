# Multi Riot Mobile Auth

Electron + TypeScript port of the Python desktop client.

## Setup

```powershell
npm install
npm run dev
```

Account secrets are saved to `accounts.json` in this project folder. The file is encrypted with Electron `safeStorage`, which uses the operating system's protected storage when available.

## Scripts

- `npm run dev` builds TypeScript and starts Electron.
- `npm run build` compiles TypeScript into `dist/`.
- `npm run typecheck` runs TypeScript without writing output.
