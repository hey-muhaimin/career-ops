import { createGardenStore } from './garden-store.mjs';

const store = createGardenStore();
const root = document.querySelector('#view-root');
const navButtons = [...document.querySelectorAll('.primary-nav [data-view]')];
const viewItems = [
  { id: 'overview', label: 'Overview', icon: '⌂' },
  { id: 'plants', label: 'My plants', icon: '♧' },
  { id: 'journal', label: 'Garden journal', icon: '▤' },
];
const today = dateKey();
let activeView = 'overview';
let searchTerm = '';
let toastTimer;

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return 'Not yet';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Not yet' : new Intl.DateTimeFormat(undefined, options).format(date);
}

function daysUntilWater(plant) {
  if (!plant.lastWatered) return 0;
  const nextWater = new Date(`${plant.lastWatered}T12:00:00`);
  nextWater.setDate(nextWater.getDate() + Number(plant.waterEveryDays || 7));
  const now = new Date(`${today}T12:00:00`);
  return Math.ceil((nextWater - now) / 86_400_000);
}

function careLabel(plant) {
  const days = daysUntilWater(plant);
  if (days < 0) return `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
  if (days === 0) return 'Water today';
  return `Water in ${days} ${days === 1 ? 'day' : 'days'}`;
}

function plantGlyph(plant) {
  const text = `${plant.species} ${plant.name}`.toLowerCase();
  if (/flower|rose|tulip|daisy|orchid/.test(text)) return '✿';
  if (/tomato|pepper|chili|strawberry/.test(text)) return '●';
  if (/cactus|succulent/.test(text)) return '♧';
  if (/mint|basil|herb|rosemary|thyme/.test(text)) return '❋';
  return '❧';
}

function plantCard(plant) {
  const due = daysUntilWater(plant) <= 0;
  return `<article class="plant-card">
    <div class="plant-card-art"><span class="care-pill ${due ? 'is-due' : ''}">${escapeHtml(careLabel(plant))}</span><span class="plant-symbol" aria-hidden="true">${plantGlyph(plant)}</span></div>
    <div class="plant-card-body">
      <div class="plant-card-top"><h3>${escapeHtml(plant.name)}</h3></div>
      <p class="plant-species">${escapeHtml(plant.species || 'A new favorite')}</p>
      <div class="plant-meta"><span aria-label="Location">⌖ ${escapeHtml(plant.location || 'Location not set')}</span><span aria-label="Watering schedule">◷ Every ${escapeHtml(plant.waterEveryDays || 7)} days</span></div>
      <div class="plant-actions"><button class="small-button" type="button" data-water="${escapeHtml(plant.id)}">Watered today</button><button class="small-button" type="button" data-note="${escapeHtml(plant.id)}">Add note</button><button class="small-button danger" type="button" data-remove="${escapeHtml(plant.id)}" aria-label="Remove ${escapeHtml(plant.name)}">Remove</button></div>
    </div>
  </article>`;
}

function emptyState(title, copy, action, label) {
  return `<div class="empty-state"><div><span class="empty-state-icon" aria-hidden="true">${action === 'plant-dialog' ? '♧' : '✎'}</span><h3>${title}</h3><p>${copy}</p><button class="button button-primary" type="button" data-open-dialog="${action}">${label} <span aria-hidden="true">→</span></button></div></div>`;
}

function pageHeading(kicker, title, copy, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="heading-copy">${copy}</p></div>${action}</div>`;
}

function careQueue(plants) {
  const due = plants.toSorted((a, b) => daysUntilWater(a) - daysUntilWater(b)).slice(0, 5);
  if (!due.length) return '<div class="care-empty">Your care list will take shape as you add plants. Start with one you love.</div>';
  return `<div class="care-list">${due.map((plant) => `<div class="care-row"><span class="care-dot ${daysUntilWater(plant) > 0 ? 'soon' : ''}"></span><div class="care-row-info"><strong>${escapeHtml(plant.name)}</strong><span>${escapeHtml(careLabel(plant))}</span></div><button class="care-water" type="button" data-water="${escapeHtml(plant.id)}" aria-label="Mark ${escapeHtml(plant.name)} as watered today">↓</button></div>`).join('')}</div>`;
}

function journalCard(entry, plants, canDelete = false) {
  const plant = plants.find((item) => item.id === entry.plantId);
  const date = new Date(`${entry.date}T12:00:00`);
  return `<article class="journal-card"><div class="journal-date"><strong>${Number.isNaN(date.getTime()) ? '—' : date.getDate()}</strong><span>${Number.isNaN(date.getTime()) ? 'Note' : new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)}</span></div><div class="journal-content"><p>${escapeHtml(entry.text)}</p><span>${escapeHtml(plant?.name || 'Garden note')} · ${formatDate(entry.date, { year: 'numeric', month: 'short', day: 'numeric' })}</span></div>${canDelete ? `<button class="small-button danger" type="button" data-delete-note="${escapeHtml(entry.id)}" aria-label="Delete journal note">Remove</button>` : ''}</article>`;
}

function overview(state) {
  const dueCount = state.plants.filter((plant) => daysUntilWater(plant) <= 0).length;
  const featured = state.plants.slice(0, 4);
  const journal = state.journal.slice(0, 2);
  const dateStamp = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${today}T12:00:00`)).toUpperCase();
  return `${pageHeading(dateStamp, 'A little more green.', 'A calmer way to care for what you grow.', '<button class="button button-quiet heading-action" type="button" data-open-dialog="journal-dialog">＋ Write a note</button>')}
    <section class="overview-hero" aria-label="A little care goes a long way"><div class="hero-copy"><div class="eyebrow">YOUR GARDEN, AT A GLANCE</div><h2>Good things grow<br>with a little care.</h2><p>Keep the small rituals close. The rest can wait for a sunny day.</p></div><span class="hero-flower" aria-hidden="true">✿</span></section>
    <section class="summary-grid" aria-label="Garden summary">
      <div class="summary-card"><span class="summary-icon green" aria-hidden="true">♧</span><div class="summary-info"><strong>${state.plants.length}</strong><span>${state.plants.length === 1 ? 'plant in your garden' : 'plants in your garden'}</span></div></div>
      <div class="summary-card"><span class="summary-icon yellow" aria-hidden="true">↓</span><div class="summary-info"><strong>${dueCount}</strong><span>${dueCount === 1 ? 'plant to water today' : 'plants to water today'}</span></div></div>
      <div class="summary-card"><span class="summary-icon coral" aria-hidden="true">✎</span><div class="summary-info"><strong>${state.journal.length}</strong><span>${state.journal.length === 1 ? 'garden note saved' : 'garden notes saved'}</span></div></div>
    </section>
    <div class="content-columns">
      <section><div class="section-heading"><h2>Your plants</h2><button class="text-action" type="button" data-view="plants">${state.plants.length ? 'See all plants →' : 'View collection →'}</button></div>${featured.length ? `<div class="plant-grid">${featured.map(plantCard).join('')}</div>` : emptyState('Start with one plant', 'Add a plant and we’ll help you remember the little things it needs.', 'plant-dialog', 'Add your first plant')}
        <div class="journal-preview"><div class="section-heading"><h2>From the journal</h2><button class="text-action" type="button" data-view="journal">Open journal →</button></div>${journal.length ? `<div class="journal-list">${journal.map((entry) => journalCard(entry, state.plants)).join('')}</div>` : '<p class="care-empty">Your notes, seasonal observations, and small wins will find a home here.</p>'}</div>
      </section>
      <aside class="care-panel" aria-label="Care schedule"><div class="care-panel-head"><h3>Care, for today</h3><span class="care-total">${dueCount}</span></div>${careQueue(state.plants)}</aside>
    </div><footer class="page-footer">Made for your patch of green <span>✿</span> Kept on this device</footer>`;
}

function plantsView(state) {
  const filtered = state.plants.filter((plant) => `${plant.name} ${plant.species} ${plant.location}`.toLowerCase().includes(searchTerm));
  const toolbar = `<div class="journal-toolbar"><input class="search-field" id="plant-search" type="search" value="${escapeHtml(searchTerm)}" placeholder="Find a plant…" aria-label="Find a plant"></div>`;
  const cards = filtered.length ? `<div class="plant-grid">${filtered.map(plantCard).join('')}</div>`
    : state.plants.length ? '<div class="empty-state"><div><h3>No plants found</h3><p>Try another name, type, or spot in the garden.</p></div></div>'
      : emptyState('Your garden starts here', 'Add the plants you already love, or the ones you are about to bring home.', 'plant-dialog', 'Add a plant');
  return `${pageHeading('A HOME FOR EVERY LEAF', 'My plants', `${state.plants.length} ${state.plants.length === 1 ? 'plant' : 'plants'} growing at your pace.`, '<button class="button button-primary heading-action" type="button" data-open-dialog="plant-dialog">＋ Add a plant</button>')}${toolbar}${cards}<footer class="page-footer">Every garden begins somewhere <span>✿</span></footer>`;
}

function journalView(state) {
  const entries = [...state.journal].sort((a, b) => b.date.localeCompare(a.date));
  return `${pageHeading('NOTICED, NOTED, REMEMBERED', 'Garden journal', 'The little things are usually the good things.', '<button class="button button-primary heading-action" type="button" data-open-dialog="journal-dialog">＋ Write a note</button>')}
    ${entries.length ? `<div class="journal-list">${entries.map((entry) => journalCard(entry, state.plants, true)).join('')}</div>` : emptyState('A place for your observations', 'Save the first sprout, the unexpected bloom, or what you want to try next season.', 'journal-dialog', 'Write your first note')}
    <footer class="page-footer">A garden grows. So do the stories <span>✿</span></footer>`;
}

function render() {
  const state = store.getState();
  document.querySelector('#plant-nav-count').textContent = state.plants.length;
  document.querySelector('#today-label').textContent = formatDate(today, { weekday: 'short', month: 'short', day: 'numeric' });
  document.querySelector('#journal-date').value = today;
  const viewMarkup = activeView === 'plants' ? plantsView(state) : activeView === 'journal' ? journalView(state) : overview(state);
  root.innerHTML = `${viewMarkup}<nav class="mobile-nav" aria-label="Garden views">${viewItems.map((item) => `<button class="nav-link ${item.id === activeView ? 'is-active' : ''}" type="button" data-view="${item.id}" ${item.id === activeView ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${item.icon}</span>${item.label}</button>`).join('')}</nav>`;
  navButtons.forEach((button) => {
    const active = button.dataset.view === activeView;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const plantSelect = document.querySelector('#journal-plant');
  plantSelect.innerHTML = `<option value="">The whole garden</option>${state.plants.map((plant) => `<option value="${escapeHtml(plant.id)}">${escapeHtml(plant.name)}</option>`).join('')}`;
  if (activeView === 'plants') document.querySelector('#plant-search')?.focus({ preventScroll: true });
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function downloadBackup() {
  const blob = new Blob([store.exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `growise-garden-${today}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Garden backup downloaded. Keep it somewhere safe.');
}

function openDialog(id, plantId = '') {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  if (id === 'journal-dialog' && plantId) document.querySelector('#journal-plant').value = plantId;
  dialog.showModal();
  dialog.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
}

document.addEventListener('click', (event) => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    activeView = viewButton.dataset.view;
    searchTerm = '';
    render();
    root.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const openButton = event.target.closest('[data-open-dialog]');
  if (openButton) {
    openDialog(openButton.dataset.openDialog);
    return;
  }
  if (event.target.closest('[data-close-dialog]')) {
    event.target.closest('dialog').close();
    return;
  }
  const waterButton = event.target.closest('[data-water]');
  if (waterButton) {
    store.waterPlant(waterButton.dataset.water, today);
    render();
    showToast('Watering noted. One little thing, done.');
    return;
  }
  const noteButton = event.target.closest('[data-note]');
  if (noteButton) {
    openDialog('journal-dialog', noteButton.dataset.note);
    return;
  }
  const removeButton = event.target.closest('[data-remove]');
  if (removeButton) {
    const plant = store.getState().plants.find((item) => item.id === removeButton.dataset.remove);
    if (plant && window.confirm(`Remove ${plant.name} and its garden notes? This cannot be undone.`)) {
      store.removePlant(plant.id);
      render();
      showToast(`${plant.name} was removed from your garden.`);
    }
    return;
  }
  const deleteNoteButton = event.target.closest('[data-delete-note]');
  if (deleteNoteButton && window.confirm('Remove this garden note? This cannot be undone.')) {
    store.removeJournalEntry(deleteNoteButton.dataset.deleteNote);
    render();
    showToast('Garden note removed.');
  }
});

document.querySelector('#plant-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    store.addPlant(Object.fromEntries(form.entries()));
    event.currentTarget.reset();
    document.querySelector('#plant-water').value = '7';
    document.querySelector('#plant-dialog').close();
    activeView = 'plants';
    searchTerm = '';
    render();
    showToast('A new plant has a home in your garden.');
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector('#journal-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    store.addJournalEntry(Object.fromEntries(form.entries()));
    event.currentTarget.reset();
    document.querySelector('#journal-date').value = today;
    document.querySelector('#journal-dialog').close();
    activeView = 'journal';
    render();
    showToast('Your note is tucked into the journal.');
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector('#export-button').addEventListener('click', downloadBackup);
document.querySelector('#import-button').addEventListener('click', () => document.querySelector('#import-file').click());
document.querySelector('#import-file').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await file.text();
    if (!window.confirm('Restoring this backup will replace the garden on this device. Continue?')) return;
    store.importData(text);
    render();
    showToast('Your garden backup has been restored.');
  } catch (error) {
    showToast(`Could not restore this backup: ${error.message}`);
  } finally {
    event.target.value = '';
  }
});

root.addEventListener('input', (event) => {
  if (event.target.id === 'plant-search') {
    const cursor = event.target.selectionStart;
    searchTerm = event.target.value.trim().toLowerCase();
    render();
    const search = document.querySelector('#plant-search');
    search?.focus({ preventScroll: true });
    search?.setSelectionRange(cursor, cursor);
  }
});

document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

render();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('/service-worker.mjs', { type: 'module' }).catch(() => {});
}