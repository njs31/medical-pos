# Pharmacy POS

Offline cross-platform Pharmacy POS and Inventory Management desktop application built with Electron, React, Tailwind CSS, and SQLite.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Install and Run

```bash
cd pharmacy-pos
npm install
npm run dev
```

## Build Desktop Packages

```bash
npm run dist:win
npm run dist:mac
```

General production build:

```bash
npm run dist
```

## Features

- Fully offline SQLite storage using `better-sqlite3`
- Auto database creation and seed data on first launch
- Dashboard with sales, bill, stock, and expiry alerts
- POS billing flow with autocomplete medicine search
- Inventory CRUD, stock adjustment, CSV import/export
- Bill history with preview, reprint, and delete
- Reports for sales, stock, expiry, and GST
- Settings for shop details, invoice defaults, and print preferences
- Print-ready GST invoice layout with A4 and 80mm paper support

## Project Structure

```text
pharmacy-pos/
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── database/
│       ├── bills.js
│       ├── db.js
│       ├── medicines.js
│       └── settings.js
├── src/
│   ├── components/
│   ├── pages/
│   ├── print/
│   └── utils/
├── electron-builder.config.js
├── electron.vite.config.js
├── package.json
└── README.md
```

## Notes

- The SQLite database is stored in Electron's `userData` directory.
- The app seeds 15 sample medicines on first launch.
- Printing uses Electron `webContents.print()` and CSS print styling.
# medical-pos
