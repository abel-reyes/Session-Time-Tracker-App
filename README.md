# Session Time Tracker

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000.svg?logo=express)](https://expressjs.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8.svg?logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

A modern, high-precision session timestamp tracker and productivity analytics platform. Built for professionals, freelancers, and teams who need frictionless punch clock recording, multi-project allocation, quarterly rollups, timesheet auditing, and cross-device synchronization.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Technical Architecture](#technical-architecture)
- [Tech Stack](#tech-stack)
- [Project Directory Structure](#project-directory-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running in Development](#running-in-development)
  - [Building for Production](#building-for-production)
  - [Running the Production Server](#running-the-production-server)
- [Environment Configuration](#environment-configuration)
- [Offline & PWA Support](#offline--pwa-support)
- [Feedback & Change Requests](#feedback--change-requests)
- [License](#license)

---

## Project Overview

**Session Time Tracker** eliminates timesheet guesswork by combining real-time clock tracking with deep retrospective analytics. Whether tracking project hours, reviewing weekly averages across months and quarters, or entering past session logs, the app delivers a fluid, responsive, and reliable experience across desktop and mobile devices.

---

## Key Features

### High-Precision Punch Clock
- **Live Elapsed Timer**: Real-time ticker with smooth updates and millisecond precision.
- **Indefinite Daily Sessions**: Track an unlimited number of punch-in / punch-out sessions throughout the day, dynamically expanding beyond traditional fixed daily punch limits.
- **Overnight & Multi-Day Tracking**: Tracks sessions past midnight or across multiple days with a continuous live timer, automatically partitioning hours across calendar dates for accurate daily analytics.
- **Retroactive Session Entry**: Add historical time logs with precise start and stop timestamps, custom calendar dates, and customizable session notes.
- **Audio Feedback**: Subtle, synthesized Web Audio cues for punch-in, punch-out, and break transitions.

### Multi-Project Organization & Categorization
- **Color-Coded Projects**: Categorize time entries across client and internal projects with custom color tags.
- **Billable Rates & Freelancer Invoicing**: Assign optional hourly billable rates per project to compute billable sums and client totals in real time.
- **Project Filtering & Objectives**: Filter timesheet logs and metrics by specific projects to evaluate focused effort and monitor accomplished objectives.
- **Punch Session Management**: Inspect, edit, reassign, or remove recorded session pairs directly from project detail logs and timesheet auditors.
- **Quick Project Badges**: Rapid switching and assigning active sessions directly from the clock interface.

### Analytics & Visual Reporting
- **Metric Cards**: Instant calculations for Today, This Week, This Month, and Year-to-Date hours.
- **Weekly & Quarterly Rollups**: View average weekly hours broken down by month and fiscal quarter.
- **Interactive Visual Charts**: Powered by Recharts—visualize distribution across projects, daily trends, and hourly density.
- **Celebration Triggers**: Integrated confetti celebration animations upon hitting milestone targets.

### Timesheet Detail & Auditing
- **Granular Entry Inspector**: Edit start/end times, adjust assigned projects, and update work notes inline.
- **Quarter-Weeks Modal**: Inspect individual work weeks within each fiscal quarter.
- **Export Capabilities**: Export session histories cleanly to formatted **CSV** reports for spreadsheets and reporting.

### Persistent Mini-Timer Drawer
- **Floating Clock Bubble**: A persistent, expandable bottom drawer widget that keeps your active timer, project switcher, and punch controls accessible across views and analytics screens.

### Blank Slate Gifting & Onboarding
- **Workspace Gifting**: Export or provision pre-configured project templates and clean states for onboarding teammates.

### Offline-First & Cross-Device Sync
- **PWA Ready**: Installable to desktop, tablet, and mobile home screens with offline caching via Service Workers.
- **Hybrid Storage Engine**: Instant optimistic updates stored in browser storage (`localStorage`), backed by server-side synchronization endpoints.
- **Tombstone Sync**: Deletions of single-day and multi-day sessions are atomically tracked via tombstones to ensure deleted data is permanently purged across all connected devices and never resurrected during sync.

---

## Technical Architecture

Session Time Tracker utilizes a unified full-stack architecture pairing a fast React 19 client with a lightweight Express server.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (SPA)                          │
│                                                             │
│   React 19 + TypeScript + Tailwind CSS v4 + Motion/React    │
│   ┌───────────────────┐  ┌──────────────────────────────┐   │
│   │ UI Components     │  │ Local Storage Engine         │   │
│   │ - PunchClockCard  │  │ - Instant Optimistic State   │   │
│   │ - VisualCharts    │  │ - Offline Cache (PWA / SW)   │   │
│   │ - TimesheetDetail │  │ - Audio Synthesis Context    │   │
│   └─────────┬─────────┘  └──────────────┬───────────────┘   │
└─────────────┼───────────────────────────┼───────────────────┘
              │                           │
         HTTP / REST                 Sync Payloads
              │                           │
┌─────────────▼───────────────────────────▼───────────────────┐
│                      Express Server                         │
│                                                             │
│   Node.js runtime + esbuild CommonJS bundle (`dist/`)       │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ REST API Endpoints                                  │   │
│   │  • /api/auth/*       - Session management           │   │
│   │  • /api/sync         - Cross-device data sync       │   │
│   │  • /api/suggestions  - Ticketing & mailer dispatch  │   │
│   │  • /api/stats        - Aggregate metrics            │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                  │
│   ┌──────────────────────▼──────────────────────────────┐   │
│   │ File-Based Durable Persistence (`data/*.json`)      │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

- **Development**: `tsx server.ts` boots the server while mounting Vite's development middleware (`appType: "spa"`) to serve hot-reloaded TypeScript modules on a single port.
- **Production**: `npm run build` compiles static assets via Vite into `dist/`, then bundles `server.ts` with `esbuild` into a self-contained CommonJS artifact (`dist/server.cjs`). The server directly serves the static bundle and handles all API traffic.

---

## Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (~5.8)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with `@tailwindcss/vite`
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/) (`motion/react`)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Delight Effects**: [Canvas Confetti](https://github.com/catdad/canvas-confetti)

### Backend & Tooling
- **Server**: [Express 4](https://expressjs.com/)
- **Bundler & Dev Server**: [Vite 6](https://vitejs.dev/) + [esbuild](https://esbuild.github.io/)
- **Development Execution**: [tsx](https://github.com/privatenumber/tsx)
- **Email & Notifications**: Direct transactional webhook dispatch & Gmail client integration
- **Linting & Type Safety**: TypeScript compiler (`tsc --noEmit`)

---

## Project Directory Structure

```
├── data/                               # Local JSON database storage
│   ├── db.json                         # Primary application database
│   ├── stats.json                      # Aggregated metrics cache
│   └── suggestions.json                # Change requests & user feedback
├── public/                             # Static public assets
│   ├── icon.svg                        # Application vector icon
│   ├── manifest.json                   # PWA Web Application Manifest
│   └── sw.js                           # Service Worker for offline capability
├── src/                                # Frontend source code
│   ├── components/                     # Reusable UI component modules
│   │   ├── AuthModal.tsx               # User sign-in & session setup
│   │   ├── ConfirmModal.tsx            # Accessible confirmation dialogs
│   │   ├── EmptyState.tsx              # Zero-state empty views
│   │   ├── FloatingClockBubble.tsx     # Persistent quick-clock drawer widget
│   │   ├── GiftModal.tsx               # Workspace gift recipient modal
│   │   ├── GiftSetupModal.tsx          # Workspace gift template creator
│   │   ├── Header.tsx                  # Application top navigation & actions
│   │   ├── MetricsOverview.tsx         # Analytical KPI summary cards
│   │   ├── PastDateEntryModal.tsx      # Manual historical timestamp entry
│   │   ├── ProjectBadge.tsx            # Styled project tag pills
│   │   ├── ProjectsModal.tsx           # Project categorization & color configuration
│   │   ├── PunchClockCard.tsx          # Interactive punch clock card
│   │   ├── QuarterWeeksModal.tsx       # Fiscal quarter breakdown modal
│   │   ├── RecentTable.tsx             # Recent sessions log table
│   │   ├── SettingsModal.tsx           # General settings & Creator inbox
│   │   ├── TimesheetDetailModal.tsx    # Timesheet audit & inline editor
│   │   ├── VisualCharts.tsx            # Interactive Recharts visualizations
│   │   └── WidgetGuideModal.tsx        # Desktop & widget setup instructions
│   ├── utils/                          # Core domain logic and utilities
│   │   ├── audio.ts                    # Web Audio API chime synthesis
│   │   ├── gmail.ts                    # Gmail draft & compose link helpers
│   │   ├── storage.ts                  # Storage engine & server synchronization
│   │   └── timeCalculations.ts         # Timestamp math, rounding, and rollups
│   ├── App.tsx                         # Root application shell
│   ├── index.css                       # Global CSS & Tailwind import
│   ├── main.tsx                        # Client DOM entry point
│   ├── types.ts                        # TypeScript interfaces and type definitions
│   └── version.ts                      # Semantic versioning config
├── .env.example                        # Template for environment variables
├── index.html                          # HTML entry point with meta tags
├── metadata.json                       # Platform capabilities & app manifest
├── package.json                        # Project dependencies and npm scripts
├── server.ts                           # Express server & API routes
├── tsconfig.json                       # TypeScript compiler configuration
└── vite.config.ts                      # Vite bundler configuration
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended)
- **npm**: `v10.x` or later

### Installation

1. Clone the repository to your local environment:
```bash
git clone https://github.com/your-username/session-time-tracker.git
cd session-time-tracker
```

2. Install project dependencies:
```bash
npm install
```

### Running in Development

Start the development server (runs Express with integrated Vite middleware):
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

### Building for Production

Compile both the client-side single page app and the server-side TypeScript entry point:
```bash
npm run build
```

This generates:
- `dist/` - Optimized static frontend assets (HTML, CSS, JS, manifest, service worker).
- `dist/server.cjs` - Standalone CommonJS bundle of the server.

### Running the Production Server

To start the production server:
```bash
npm start
```
The application will listen on `http://0.0.0.0:3000`.

### Type-Checking & Linting

Run TypeScript type-checking to verify there are no compilation errors:
```bash
npm run lint
```

---

## Environment Configuration

The application is configured to run out-of-the-box with zero required external variables. If running in a hosted cloud environment (such as Google Cloud Run), you can customize the configuration:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Available environment variables:
   ```env
   # Application URL (used for self-referential links and OAuth callbacks)
   APP_URL=http://localhost:3000

   # Port configuration (Defaults to 3000)
   PORT=3000
   ```

---

## Offline & PWA Support

Session Time Tracker is configured as a **Progressive Web App**:
- **Offline Reliability**: The custom Service Worker (`public/sw.js`) caches application assets so users can punch in and view logs even without an internet connection.
- **Installable**: Meets modern Web App Manifest specifications (`public/manifest.json`), enabling an "Install App" prompt on supported browsers.
- **Data Protection**: Changes made offline are committed to local persistent storage and seamlessly queued for server sync once connectivity returns.

---

## Feedback & Change Requests

The application features a built-in **Creator Feedback & Suggestion Queue** located directly inside the **Settings** modal:
- Users can submit bug reports, UX enhancements, and feature requests.
- Submissions generate a trackable ticket ID (e.g. `#CR-2026-001`) and route directly to the project maintainer.
- Submissions include a convenient **"Open in Gmail"** 1-click option to pre-populate drafts with ticket details.

---

## License

This project is open source and available under the [MIT License](LICENSE).
