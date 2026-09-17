# Kelsey Archive

A mobile-friendly web app (installable as a PWA) for finding item locations
in the Kelsey physical archive. Search by keyword, description or product
code and see the result highlighted on the archive floor plan.

See [SETUP.md](SETUP.md) for the one-time Firebase + GitHub Pages setup
this needs before it works.

## Features

- **Find** - search across location, description and product code; the
  matching bay is highlighted on the zone's floor plan.
- **Add** - add a new item, prompted for zone/aisle/bay/shelf.
- **Edit / delete** - from any search result.
- **Upload** - import a `.csv` or `.xlsx` file (columns: `Location`,
  `Asset description`, `Product code`), either adding to or replacing all
  existing data.
- Works offline as an installed app shell; data syncs live between everyone
  using it via Firestore.

## Local development

No build step. Just open `index.html` via a local static server (not
`file://`, since it uses ES modules and a service worker):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project structure

- `index.html`, `css/app.css`, `js/app.js` - the app.
- `js/zones.js` - floor plan geometry per zone (see SETUP.md to add zones).
- `js/floorplan.js` - renders a zone's SVG plan and highlights a bay.
- `js/firebase-config.js` - your Firebase project config (see SETUP.md).
- `tools/generate-icons.py` - regenerates `icons/` from `assets/k2.png`.
