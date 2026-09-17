# Kelsey Archive

A mobile-friendly web app (installable as a PWA) for finding item locations
in the Kelsey physical archive. Search by keyword, description or product
code and see the result highlighted on the archive floor plan.

See [SETUP.md](SETUP.md) for the one-time Firebase + GitHub Pages setup
this needs before it works.

## Features

- **PIN-gated** - one shared PIN for the whole team, checked against real
  Firebase auth (not just a UI prompt) - see SETUP.md.
- **Find** - search across location, description and product code (word
  match, any order); the matching bay is highlighted on the zone's floor
  plan.
- **Reverse lookup** - tap any bay on the floor plan to list everything
  stored there, across all its shelves.
- **Add** - add a new item, prompted for zone/aisle/bay/shelf.
- **Edit / delete** - from any search result. Deletes have a 6-second Undo
  before they're actually committed.
- **Upload** - import a `.csv` or `.xlsx` file (columns: `Location`,
  `Asset description`, `Product code`), either adding to or replacing all
  existing data. Re-uploading a file you've already loaded (same location +
  description + product code) is flagged before it creates duplicates.
- **Backup** - export everything currently in the archive back out to CSV
  from the Upload tab.
- Works offline, including search: the app shell is cached by a service
  worker and Firestore's own data cache is enabled, so a recently-synced
  copy of the archive is still searchable with no signal. Data syncs live
  between everyone using it once back online.

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
