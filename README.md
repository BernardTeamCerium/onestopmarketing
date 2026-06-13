# Meridian — Digital Marketing for Financial Advisors

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
index.html              # All page content (single page, anchored sections)
assets/css/styles.css   # Design system + all components
assets/js/main.js       # Nav, scroll-reveal, counters, tilt, form handling
```

### Sections
1. Hero — the 97% hook + dual CTA + floating stat card
2. Trust strip — compliance / audience credibility
3. Why Online Matters — animated stat tiles
4. Problem vs. Meridian difference — side-by-side
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

- **Brand name:** "Meridian" is used throughout as a placeholder agency name —
  search/replace it (and the Beacon platform name) with the real brand.
- **Colors:** all defined as CSS variables at the top of `styles.css`
  (`--gold`, `--blue`, `--navy-*`, etc.).
- **Stats:** counter values live in `data-target` attributes in `index.html`.
- **Contact form:** currently validates and confirms on the front end only.
  Wire the `submit` handler in `assets/js/main.js` to a real endpoint
  (e.g. a form service, CRM webhook, or the Beacon backend) to capture leads.

## Notes

Statistics shown are illustrative of widely reported industry research on how
prospects evaluate financial advisors online. Replace with sourced/audited
figures before publishing, and confirm marketing claims align with applicable
SEC & FINRA advertising guidelines.
