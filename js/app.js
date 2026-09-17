import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, serverTimestamp, getDocs
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const ITEMS_COLLECTION = 'items';

// Every worker signs in with the same shared PIN (as the password on this
// one fixed account) - see the pin-gate section below and SETUP.md. The
// email itself is never used to send mail, it just names the account.
const SHARED_AUTH_EMAIL = 'team@kelsey-archive.app';

let db = null;
let auth = null;
let allItems = []; // in-memory cache, kept in sync via onSnapshot
let selectedItemId = null;

const connStatus = document.getElementById('connStatus');
const appShell = document.getElementById('appShell');
const pinGate = document.getElementById('pinGate');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('pinInput');
const pinStatus = document.getElementById('pinStatus');

function isFirebaseConfigured() {
  return typeof FIREBASE_CONFIG !== 'undefined' &&
    FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';
}

function setConnStatus(state, title) {
  connStatus.className = 'conn-status ' + (state === 'online' ? 'conn-online' : 'conn-offline');
  connStatus.title = title;
}

function initFirebase() {
  if (!isFirebaseConfigured()) {
    setConnStatus('offline', 'Firebase is not configured yet - see SETUP.md. Running with no data.');
    pinGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    return;
  }
  const app = initializeApp(FIREBASE_CONFIG);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  auth = getAuth(app);

  onAuthStateChanged(auth, user => {
    if (user) {
      pinGate.classList.add('hidden');
      appShell.classList.remove('hidden');
      setConnStatus('online', 'Connected');
      subscribeToItems();
    } else {
      appShell.classList.add('hidden');
      pinGate.classList.remove('hidden');
      pinInput.focus();
    }
  });
}

pinForm.addEventListener('submit', async e => {
  e.preventDefault();
  const pin = pinInput.value.trim();
  if (!pin) return;
  pinStatus.textContent = 'Checking...';
  pinStatus.className = 'status-msg';
  try {
    await signInWithEmailAndPassword(auth, SHARED_AUTH_EMAIL, pin);
    pinInput.value = '';
  } catch (err) {
    console.error(err);
    pinStatus.textContent = 'Incorrect PIN.';
    pinStatus.className = 'status-msg err';
  }
});

function subscribeToItems() {
  const ref = collection(db, ITEMS_COLLECTION);
  onSnapshot(ref, snap => {
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    runSearch();
    populateShelfSuggestions();
  }, err => {
    console.error('onSnapshot error', err);
    setConnStatus('offline', err.message);
  });
}

// ---------- Location helpers ----------

function pad2(v) {
  const s = String(v).trim();
  return s.length >= 2 ? s : '0'.repeat(2 - s.length) + s;
}

function buildLocation(zone, aisle, bay, shelf) {
  return `${zone.toUpperCase()}-${pad2(aisle)}-${pad2(bay)}-${shelf.toUpperCase().trim()}`;
}

function parseLocation(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^([A-Za-z]+)-(\d{1,2})-(\d{1,2})-([A-Za-z0-9]{1,3})$/);
  if (!m) return null;
  return { zone: m[1].toUpperCase(), aisle: pad2(m[2]), bay: pad2(m[3]), shelf: m[4].toUpperCase() };
}

// ---------- Tabs ----------

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
}

// ---------- Zone/Aisle/Bay cascading selects ----------

function fillSelect(select, options, placeholder) {
  select.innerHTML = '';
  if (placeholder) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    o.disabled = true;
    o.selected = true;
    select.appendChild(o);
  }
  options.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function wireCascade(zoneSel, aisleSel, baySel) {
  fillSelect(zoneSel, listZoneIds());
  const updateAisles = () => {
    fillSelect(aisleSel, listAisleIds(zoneSel.value));
    updateBays();
  };
  const updateBays = () => {
    fillSelect(baySel, listBayIds(zoneSel.value, aisleSel.value));
  };
  zoneSel.addEventListener('change', updateAisles);
  aisleSel.addEventListener('change', updateBays);
  updateAisles();
}

// ---------- Search ----------

const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('resultsList');
const resultsSummary = document.getElementById('resultsSummary');
const bayFilterBanner = document.getElementById('bayFilterBanner');
const bayFilterText = document.getElementById('bayFilterText');

let bayFilter = null; // { zone, aisle, bay } - set by tapping a bay on the plan

searchInput.addEventListener('input', () => {
  bayFilter = null; // typing a fresh search always leaves bay-browsing mode
  bayFilterBanner.classList.add('hidden');
  runSearch();
});

document.getElementById('clearBayFilterBtn').addEventListener('click', () => {
  bayFilter = null;
  bayFilterBanner.classList.add('hidden');
  runSearch();
  renderPlan();
});

function runSearch() {
  const q = searchInput.value.trim().toLowerCase();
  let matches = allItems.filter(it => !pendingDelete || it.id !== pendingDelete.id);

  if (bayFilter) {
    matches = matches.filter(it =>
      it.zone === bayFilter.zone && it.aisle === bayFilter.aisle && it.bay === bayFilter.bay
    );
  }
  if (q) {
    // Match if every word in the query appears somewhere in the item, in
    // any order - so "motor cycle jan 1920" finds "The Motor Cycle Jan
    // June 1920 Vol XXIV" even though "jan" and "1920" aren't adjacent.
    const tokens = q.split(/\s+/).filter(Boolean);
    matches = matches.filter(it => {
      const haystack = `${it.location || ''} ${it.description || ''} ${it.productCode || ''}`.toLowerCase();
      return tokens.every(t => haystack.includes(t));
    });
  }
  matches = matches.slice().sort((a, b) => (a.location || '').localeCompare(b.location || ''));

  resultsList.innerHTML = '';
  if (bayFilter) {
    bayFilterText.textContent = `Showing ${matches.length} item${matches.length === 1 ? '' : 's'} in ${bayFilter.zone}-${bayFilter.aisle}-${bayFilter.bay}`;
    bayFilterBanner.classList.remove('hidden');
    resultsSummary.textContent = matches.length ? '' : 'Nothing stored here yet.';
  } else if (!q) {
    resultsSummary.textContent = matches.length ? `${matches.length} items in the archive` : '';
  } else {
    resultsSummary.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
  }

  const MAX_RENDER = 100;
  matches.slice(0, MAX_RENDER).forEach(item => {
    const li = document.createElement('li');
    li.className = 'result-card' + (item.id === selectedItemId ? ' selected' : '');
    li.innerHTML = `
      <span class="location-pill">${escapeHtml(item.location || '?')}</span>
      <span class="result-text">
        <div class="result-desc">${escapeHtml(item.description || '(no description)')}</div>
        ${item.productCode ? `<div class="muted small">${escapeHtml(item.productCode)}</div>` : ''}
      </span>`;
    li.addEventListener('click', () => selectItem(item.id));
    resultsList.appendChild(li);
  });
  if (matches.length > MAX_RENDER) {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = `+ ${matches.length - MAX_RENDER} more - refine your search`;
    resultsList.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Item detail + plan highlight ----------

const itemDetail = document.getElementById('itemDetail');
const itemDetailLocation = document.getElementById('itemDetailLocation');
const itemDetailDesc = document.getElementById('itemDetailDesc');
const itemDetailCode = document.getElementById('itemDetailCode');
const planZoneSelect = document.getElementById('planZoneSelect');
const planContainer = document.getElementById('planContainer');

fillSelect(planZoneSelect, listZoneIds());
planZoneSelect.addEventListener('change', () => {
  selectedItemId = null;
  itemDetail.classList.add('hidden');
  bayFilter = null;
  bayFilterBanner.classList.add('hidden');
  runSearch();
  renderPlan();
});

planContainer.addEventListener('click', e => {
  const bayEl = e.target.closest('.bay');
  if (!bayEl) return;
  selectedItemId = null;
  itemDetail.classList.add('hidden');
  bayFilter = { zone: planZoneSelect.value, aisle: bayEl.dataset.aisle, bay: bayEl.dataset.bay };
  searchInput.value = '';
  runSearch();
  renderPlan();
});

function selectItem(id) {
  selectedItemId = id;
  const item = allItems.find(it => it.id === id);
  if (!item) return;
  itemDetailLocation.textContent = item.location;
  itemDetailDesc.textContent = item.description || '(no description)';
  itemDetailCode.textContent = item.productCode ? `Product code: ${item.productCode}` : '';
  itemDetail.classList.remove('hidden');

  if (item.zone) planZoneSelect.value = item.zone;
  runSearch();
  renderPlan();
}

function renderPlan() {
  const zoneId = planZoneSelect.value || listZoneIds()[0];
  const item = selectedItemId ? allItems.find(it => it.id === selectedItemId) : null;
  let highlight = null;
  if (item && item.zone === zoneId) {
    highlight = { aisle: item.aisle, bay: item.bay, locationLabel: item.location };
  } else if (bayFilter && bayFilter.zone === zoneId) {
    highlight = { aisle: bayFilter.aisle, bay: bayFilter.bay, locationLabel: `${bayFilter.zone}-${bayFilter.aisle}-${bayFilter.bay}` };
  }
  renderZonePlan(planContainer, zoneId, highlight);
}
renderPlan();

// ---------- Delete with undo ----------
// Deleting hides the item locally and only actually removes it from
// Firestore a few seconds later, unless the user hits Undo in that window.

const UNDO_WINDOW_MS = 6000;
let pendingDelete = null; // { id, timeoutId }

const undoToast = document.getElementById('undoToast');
const undoToastText = document.getElementById('undoToastText');

function commitPendingDelete() {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timeoutId);
  const { id } = pendingDelete;
  pendingDelete = null;
  deleteDoc(doc(db, ITEMS_COLLECTION, id)).catch(err => console.error('Delete failed', err));
}

function scheduleDelete(item) {
  commitPendingDelete(); // only one pending delete at a time - commit any earlier one now
  const timeoutId = setTimeout(() => {
    pendingDelete = null;
    undoToast.classList.add('hidden');
    deleteDoc(doc(db, ITEMS_COLLECTION, item.id)).catch(err => console.error('Delete failed', err));
  }, UNDO_WINDOW_MS);
  pendingDelete = { id: item.id, timeoutId };
  undoToastText.textContent = `Deleted "${item.description || item.location}"`;
  undoToast.classList.remove('hidden');
}

document.getElementById('undoBtn').addEventListener('click', () => {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timeoutId);
  pendingDelete = null;
  undoToast.classList.add('hidden');
  runSearch();
});

document.getElementById('deleteItemBtn').addEventListener('click', () => {
  if (!selectedItemId || !db) return;
  const item = allItems.find(it => it.id === selectedItemId);
  if (!item) return;
  selectedItemId = null;
  itemDetail.classList.add('hidden');
  scheduleDelete(item);
  renderPlan();
  runSearch();
});

// ---------- Add item ----------

const addForm = document.getElementById('addForm');
const addZone = document.getElementById('addZone');
const addAisle = document.getElementById('addAisle');
const addBay = document.getElementById('addBay');
const addShelf = document.getElementById('addShelf');
const addLocationPreview = document.getElementById('addLocationPreview');
const addStatus = document.getElementById('addStatus');

wireCascade(addZone, addAisle, addBay);

function updateAddPreview() {
  if (addZone.value && addAisle.value && addBay.value && addShelf.value.trim()) {
    addLocationPreview.textContent = 'Location: ' + buildLocation(addZone.value, addAisle.value, addBay.value, addShelf.value);
  } else {
    addLocationPreview.textContent = '';
  }
}
[addZone, addAisle, addBay].forEach(el => el.addEventListener('change', updateAddPreview));
addShelf.addEventListener('input', updateAddPreview);

addForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!db) { addStatus.textContent = 'Not connected to the database.'; addStatus.className = 'status-msg err'; return; }
  const shelf = addShelf.value.trim();
  if (!shelf) return;
  const location = buildLocation(addZone.value, addAisle.value, addBay.value, shelf);
  addStatus.textContent = 'Saving...';
  addStatus.className = 'status-msg';
  try {
    await addDoc(collection(db, ITEMS_COLLECTION), {
      location,
      zone: addZone.value.toUpperCase(),
      aisle: pad2(addAisle.value),
      bay: pad2(addBay.value),
      shelf: shelf.toUpperCase(),
      description: document.getElementById('addDescription').value.trim(),
      productCode: document.getElementById('addProductCode').value.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    addStatus.textContent = `Added to ${location}`;
    addStatus.className = 'status-msg ok';
    document.getElementById('addDescription').value = '';
    document.getElementById('addProductCode').value = '';
    addShelf.value = '';
    updateAddPreview();
    document.getElementById('addDescription').focus();
  } catch (err) {
    console.error(err);
    addStatus.textContent = 'Error: ' + err.message;
    addStatus.className = 'status-msg err';
  }
});

function populateShelfSuggestions() {
  // no-op placeholder for future datalist-based shelf suggestions
}

// ---------- Edit item ----------

const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editZone = document.getElementById('editZone');
const editAisle = document.getElementById('editAisle');
const editBay = document.getElementById('editBay');
const editShelf = document.getElementById('editShelf');
const editStatus = document.getElementById('editStatus');

wireCascade(editZone, editAisle, editBay);

document.getElementById('editItemBtn').addEventListener('click', () => {
  const item = allItems.find(it => it.id === selectedItemId);
  if (!item) return;
  document.getElementById('editDescription').value = item.description || '';
  document.getElementById('editProductCode').value = item.productCode || '';
  editZone.value = item.zone;
  editZone.dispatchEvent(new Event('change'));
  editAisle.value = item.aisle;
  editAisle.dispatchEvent(new Event('change'));
  editBay.value = item.bay;
  editShelf.value = item.shelf || '';
  editStatus.textContent = '';
  editModal.classList.remove('hidden');
});

document.getElementById('cancelEditBtn').addEventListener('click', () => editModal.classList.add('hidden'));
editModal.addEventListener('click', e => { if (e.target === editModal) editModal.classList.add('hidden'); });

editForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!db || !selectedItemId) return;
  const shelf = editShelf.value.trim();
  const location = buildLocation(editZone.value, editAisle.value, editBay.value, shelf);
  editStatus.textContent = 'Saving...';
  editStatus.className = 'status-msg';
  try {
    await updateDoc(doc(db, ITEMS_COLLECTION, selectedItemId), {
      location,
      zone: editZone.value.toUpperCase(),
      aisle: pad2(editAisle.value),
      bay: pad2(editBay.value),
      shelf: shelf.toUpperCase(),
      description: document.getElementById('editDescription').value.trim(),
      productCode: document.getElementById('editProductCode').value.trim(),
      updatedAt: serverTimestamp()
    });
    editModal.classList.add('hidden');
  } catch (err) {
    console.error(err);
    editStatus.textContent = 'Error: ' + err.message;
    editStatus.className = 'status-msg err';
  }
});

// ---------- Upload CSV/XLSX ----------

const uploadForm = document.getElementById('uploadForm');
const uploadStatus = document.getElementById('uploadStatus');
const uploadSkipped = document.getElementById('uploadSkipped');

function dupeKey(item) {
  return [item.location, (item.description || '').toLowerCase().trim(), (item.productCode || '').toLowerCase().trim()].join('|');
}

function findHeaderKey(row, candidates) {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const hit = keys.find(k => k.trim().toLowerCase() === cand);
    if (hit) return hit;
  }
  return null;
}

async function parseUploadFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const parsed = [];
  const skipped = [];
  rows.forEach((row, idx) => {
    const locKey = findHeaderKey(row, ['location']);
    const descKey = findHeaderKey(row, ['asset description', 'description', 'item', 'item name']);
    const codeKey = findHeaderKey(row, ['product code', 'productcode', 'code']);
    const rawLoc = locKey ? row[locKey] : '';
    const loc = parseLocation(rawLoc);
    if (!loc) {
      skipped.push(`Row ${idx + 2}: unrecognized location "${rawLoc}"`);
      return;
    }
    parsed.push({
      location: buildLocation(loc.zone, loc.aisle, loc.bay, loc.shelf),
      zone: loc.zone, aisle: loc.aisle, bay: loc.bay, shelf: loc.shelf,
      description: descKey ? String(row[descKey]).trim() : '',
      productCode: codeKey ? String(row[codeKey]).trim() : ''
    });
  });
  return { parsed, skipped };
}

async function deleteAllItems() {
  const ref = collection(db, ITEMS_COLLECTION);
  const snap = await getDocs(ref);
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

async function addItemsBatched(items) {
  const ref = collection(db, ITEMS_COLLECTION);
  for (let i = 0; i < items.length; i += 400) {
    const batch = writeBatch(db);
    items.slice(i, i + 400).forEach(item => {
      const newRef = doc(ref);
      batch.set(newRef, { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }
}

uploadForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!db) { uploadStatus.textContent = 'Not connected to the database.'; uploadStatus.className = 'status-msg err'; return; }
  const file = document.getElementById('uploadFile').files[0];
  if (!file) return;
  const mode = uploadForm.querySelector('input[name="uploadMode"]:checked').value;

  uploadStatus.textContent = 'Reading file...';
  uploadStatus.className = 'status-msg';
  uploadSkipped.innerHTML = '';

  try {
    const { parsed, skipped } = await parseUploadFile(file);
    if (parsed.length === 0) {
      uploadStatus.textContent = 'No valid rows found in that file.';
      uploadStatus.className = 'status-msg err';
      return;
    }

    if (mode === 'add') {
      const existingKeys = new Set(allItems.map(dupeKey));
      const dupeCount = parsed.filter(item => existingKeys.has(dupeKey(item))).length;
      if (dupeCount > 0) {
        const ok = confirm(
          `${dupeCount} of the ${parsed.length} rows in this file look identical to items already in the archive ` +
          `(same location, description and product code) - likely because this file was uploaded before. ` +
          `They'll be added as extra copies if you continue. Continue?`
        );
        if (!ok) { uploadStatus.textContent = 'Cancelled.'; return; }
      }
    }

    if (mode === 'replace') {
      const ok = confirm(`This will permanently delete all ${allItems.length} existing items and replace them with ${parsed.length} new ones. Continue?`);
      if (!ok) { uploadStatus.textContent = 'Cancelled.'; return; }
      uploadStatus.textContent = 'Deleting existing data...';
      await deleteAllItems();
    }

    uploadStatus.textContent = `Uploading ${parsed.length} items...`;
    await addItemsBatched(parsed);

    uploadStatus.textContent = `Done. Added ${parsed.length} item${parsed.length === 1 ? '' : 's'}${skipped.length ? `, skipped ${skipped.length}` : ''}.`;
    uploadStatus.className = 'status-msg ok';
    skipped.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      uploadSkipped.appendChild(li);
    });
    uploadForm.reset();
  } catch (err) {
    console.error(err);
    uploadStatus.textContent = 'Error: ' + err.message;
    uploadStatus.className = 'status-msg err';
  }
});

// ---------- Export to CSV ----------

const exportBtn = document.getElementById('exportBtn');
const exportStatus = document.getElementById('exportStatus');

function csvField(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

exportBtn.addEventListener('click', () => {
  if (!allItems.length) {
    exportStatus.textContent = 'Nothing to export yet.';
    exportStatus.className = 'status-msg err';
    return;
  }
  const header = ['Location', 'Asset description', 'Product code'];
  const lines = [header.join(',')];
  allItems
    .slice()
    .sort((a, b) => (a.location || '').localeCompare(b.location || ''))
    .forEach(item => {
      lines.push([csvField(item.location), csvField(item.description), csvField(item.productCode)].join(','));
    });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kelsey-archive-export-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  exportStatus.textContent = `Exported ${allItems.length} items.`;
  exportStatus.className = 'status-msg ok';
});

// ---------- Boot ----------

initFirebase();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW registration failed', err));
  });
}
