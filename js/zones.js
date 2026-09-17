// Floor-plan geometry for each zone, extracted precisely from the vector
// coordinates in the original "Stock location Archive.pdf" plan.
//
// To add a new zone later: get the new zone's plan as a PDF, extract the
// bay rectangles the same way (or measure them), and add another entry
// here following the same shape. Nothing else in the app needs to change -
// the search/highlight/add-item UI all read zone lists from this file.

const ZONES = {
  C: {
    id: 'C',
    name: 'Zone C',
    viewBox: '0 0 595.28 510.24',
    labelBox: { x: 13.1, y: 14.2, w: 71.7, h: 29.7 },
    decorative: [
      { x: 573.2, y: 103.8, w: 7.9, h: 75.7 }
    ],
    aisles: [
      {
        id: '01',
        label: { x: 558.7, y: 82.7 },
        bays: [
          { bay: '04', x: 14.4, y: 66.4, w: 128.9, h: 31.5 },
          { bay: '03', x: 143.8, y: 66.4, w: 128.8, h: 31.5 },
          { bay: '02', x: 273.1, y: 66.4, w: 128.9, h: 31.5 },
          { bay: '01', x: 450.9, y: 66.4, w: 83.7, h: 31.5 }
        ]
      },
      {
        id: '02',
        label: { x: 427.2, y: 157.9 },
        bays: [
          { bay: '03', x: 14.4, y: 141.8, w: 128.9, h: 31.6 },
          { bay: '02', x: 143.8, y: 141.8, w: 128.8, h: 31.6 },
          { bay: '01', x: 273.1, y: 141.8, w: 128.9, h: 31.6 }
        ]
      },
      {
        id: '03',
        label: { x: 427.2, y: 189.9 },
        bays: [
          { bay: '03', x: 14.4, y: 173.9, w: 128.9, h: 31.5 },
          { bay: '02', x: 143.8, y: 173.9, w: 128.8, h: 31.5 },
          { bay: '01', x: 273.1, y: 173.9, w: 128.9, h: 31.5 }
        ]
      },
      {
        id: '04',
        label: { x: 427.2, y: 265.4 },
        bays: [
          { bay: '03', x: 14.4, y: 249.3, w: 128.9, h: 31.6 },
          { bay: '02', x: 143.8, y: 249.3, w: 128.8, h: 31.6 },
          { bay: '01', x: 273.1, y: 249.3, w: 128.9, h: 31.6 }
        ]
      },
      {
        id: '05',
        label: { x: 427.2, y: 299.0 },
        bays: [
          { bay: '03', x: 14.4, y: 281.4, w: 128.9, h: 31.5 },
          { bay: '02', x: 143.8, y: 281.4, w: 128.8, h: 31.5 },
          { bay: '01', x: 273.1, y: 281.4, w: 128.9, h: 31.5 }
        ]
      },
      {
        id: '06',
        label: { x: 427.2, y: 372.85 },
        bays: [
          { bay: '03', x: 14.4, y: 356.8, w: 128.9, h: 31.5 },
          { bay: '02', x: 143.8, y: 356.8, w: 128.8, h: 31.5 },
          { bay: '01', x: 273.1, y: 356.8, w: 128.9, h: 31.5 }
        ]
      },
      {
        id: '07',
        label: { x: 427.2, y: 406.5 },
        bays: [
          { bay: '03', x: 14.4, y: 388.8, w: 128.9, h: 31.6 },
          { bay: '02', x: 143.8, y: 388.8, w: 128.8, h: 31.6 },
          { bay: '01', x: 273.1, y: 388.8, w: 128.9, h: 31.6 }
        ]
      },
      {
        id: '08',
        label: { x: 427.2, y: 480.3 },
        bays: [
          { bay: '03', x: 14.4, y: 464.3, w: 128.9, h: 31.5 },
          { bay: '02', x: 143.8, y: 464.3, w: 128.8, h: 31.5 },
          { bay: '01', x: 273.1, y: 464.3, w: 128.9, h: 31.5 }
        ]
      },
      {
        id: '09',
        label: { x: 558.4, y: 293.7 },
        bays: [
          { bay: '01', x: 543.4, y: 191.1, w: 29.9, h: 88.1, vertical: true }
        ]
      }
    ]
  }
};

// Look up a bay's rectangle for a given zone/aisle/bay code (used to
// highlight a search result on the plan).
function findBayRect(zoneId, aisleId, bayId) {
  const zone = ZONES[zoneId];
  if (!zone) return null;
  const aisle = zone.aisles.find(a => a.id === aisleId);
  if (!aisle) return null;
  return aisle.bays.find(b => b.bay === bayId) || null;
}

function listZoneIds() {
  return Object.keys(ZONES);
}

function listAisleIds(zoneId) {
  const zone = ZONES[zoneId];
  return zone ? zone.aisles.map(a => a.id) : [];
}

function listBayIds(zoneId, aisleId) {
  const zone = ZONES[zoneId];
  if (!zone) return [];
  const aisle = zone.aisles.find(a => a.id === aisleId);
  return aisle ? aisle.bays.map(b => b.bay) : [];
}
