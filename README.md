# OneStop — Digital Marketing for Financial Advisors

A premium, conversion-focused marketing website for an agency that serves
financial advisors exclusively. The site is anchored on a single, powerful
truth: **97% of prospects research a financial advisor online before they
ever make contact** — so the advisor's digital presence is what wins or
loses the client.

The site also showcases the agency's proprietary management platform,
**Beacon**, which lets advisors control their entire digital presence
(website, reviews, leads, content, SEO, analytics) from one transparent
dashboard. This is the "can't-be-mimicked" differentiator.

## Why it stands out

- **Cinematic dark hero** with an animated aurora/gradient-mesh background that
  transitions into clean, trustworthy light sections.
- **Editorial typography** — Fraunces (display serif) + Inter (body) for a
  high-end, bespoke feel rather than a templated look.
- **Live motion** — animated stat counters, scroll-reveal, a condensing sticky
  nav, floating glass cards, and a pointer-tilt 3D dashboard mockup.
- **A product, not just a service** — the Beacon dashboard mockup makes the
  proprietary platform tangible and premium.
- **Compliance-aware positioning** — messaging acknowledges SEC/FINRA realities,
  which generic agencies miss.

## Structure

```
index.html              # Marketing site (single page, anchored sections)
app.html                # Beacon Tasks — the task-management module
assets/css/styles.css   # Marketing design system + components
assets/css/app.css      # Beacon Tasks styles (same design language)
assets/js/main.js       # Nav, scroll-reveal, counters, tilt, form handling
assets/js/app.js        # Beacon Tasks app logic
```

## Beacon Tasks (`app.html`)

A self-contained, no-backend task manager built into the Beacon platform.
Open it from the nav (**Tasks**) or the **Open Beacon Tasks** button in the
Platform section. It works entirely in the browser — tasks persist in
`localStorage` on the device.

**What it does**
- **One-off vs. recurring tasks** — separate single to-dos from **daily** and
  **weekly** routines. Recurring tasks automatically reset each period (a daily
  task re-opens the next day; a weekly task re-opens at the start of the week).
- **Reminders** — three serverless paths, all selectable per task:
  - *In-app + desktop notifications* — enable with the **Reminders** bell;
    due/overdue badges update live and the browser notifies you when a task is
    due (uses the Notifications API).
  - *Google Calendar* — the 📅 action opens a pre-filled
    `calendar.google.com` event (with recurrence + a built-in reminder).
  - *Email* — the ✉ action opens a pre-filled message (to the assignee if an
    email was entered).
- **Stay organized** — sidebar views (Today, Upcoming, All, by type, Shared,
  Completed) with live counts, search, and Smart/Due/Priority sorting.
- **Share with your team** — assign a task to a teammate (name or email) and
  use **Share tasks** to generate a link; the teammate opens it and imports the
  selected tasks into their own Beacon Tasks (`#import=` payload). No accounts
  or server required.

**Notes / limits.** Because there's no backend, data lives per-browser and
team sharing is link-based (a snapshot import), not live multi-user sync. To
add real accounts and shared, synced state later, replace the `localStorage`
layer in `assets/js/app.js` with API calls to a backend or the Beacon platform.

### Sections
1. Hero — the 97% hook + dual CTA + floating stat card
2. Trust strip — compliance / audience credibility
3. Why Online Matters — animated stat tiles
4. Problem vs. OneStop difference — side-by-side
5. The Platform (Beacon) — interactive dashboard mockup + feature grid
6. Services — six core offerings
7. How It Works — 4-step process
8. Why advisors can't get this anywhere else — the moat + testimonial
9. Results — headline performance metrics
10. Pricing — three tiers (Beacon included in all)
11. Contact — strategy-call form
12. Footer

## Run it

It's a static site with no build step. Open `index.html` directly, or serve it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Customizing

- **Brand:** The agency is **OneStop** and the platform is **Beacon**. Update
  the email/phone placeholders in the footer (`info@onestopmarketing.com`,
  `(555) 123-4567`) with real contact details.
- **Colors:** all defined as CSS variables at the top of `styles.css`
  (`--gold`, `--blue`, `--navy-*`, etc.).
- **Stats:** counter values live in `data-target` attributes in `index.html`.
- **Contact form:** validates, then opens the visitor's email client with a
  pre-filled message to the agency (`mailto:`). Change the destination via the
  `CONTACT_EMAIL` constant at the top of `assets/js/main.js`. To capture leads
  server-side instead (form service, CRM webhook, or the Beacon backend),
  replace the `mailto:` block in the `submit` handler.

## Notes

Statistics shown are illustrative of widely reported industry research on how
prospects evaluate financial advisors online. Replace with sourced/audited
figures before publishing, and confirm marketing claims align with applicable
SEC & FINRA advertising guidelines.
