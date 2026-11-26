import { localizePage, text } from './i18n.js?v=20261127-hub-57';
import { GAMES, DEFAULT_GAME } from './games.js?v=20261127-hub-57';

let effects;
let pageLanguage = 'en';
let patchLanguage = 'en';
let preferredLanguage = 'en';
let downloadUrl = null;
let game = DEFAULT_GAME;
try {
  const savedPage = localStorage.getItem('zoids-page-language') ?? localStorage.getItem('zoids-language');
  if (savedPage === 'es') pageLanguage = 'es';
  const savedPatch = localStorage.getItem('zoids-patch-language');
  patchLanguage = savedPatch === 'es' || savedPatch === 'en' ? savedPatch : pageLanguage;
  preferredLanguage = patchLanguage;
  const savedGame = localStorage.getItem('zoids-game');
  if (GAMES[savedGame]) game = savedGame;
} catch {}
const linkedGame = () => GAMES[location.hash.slice(1)] ? location.hash.slice(1) : null;
game = linkedGame() ?? game;

const themeButton = document.querySelector('#theme-toggle');
const pageLanguageButton = document.querySelector('#page-language-toggle');
const pageLanguageLabel = document.querySelector('#page-language-label');
const input = document.querySelector('#rom-input');
const gameButtons = document.querySelectorAll('.game-option');
const languageButtons = document.querySelectorAll('.language-option');
const languagePicker = document.querySelector('.language-picker');
const workflow = document.querySelector('.workflow');
const skipLink = document.querySelector('.skip-link');
const sourceLink = document.querySelector('#source-link');
const zone = document.querySelector('#drop-zone');
const status = document.querySelector('#status');
const statusDots = document.querySelectorAll('.status-dot');
const patchButton = document.querySelector('#patch-button');
const extractorButton = document.querySelector('#extractor-button');
const buttonLabel = document.querySelector('#button-label');
const gameCopy = [...document.querySelectorAll('[data-i18n]')].map(node => ({
  node,
  keys: Object.fromEntries(Object.keys(GAMES).map(id => [id, node.dataset[`${id}I18n`] ?? node.dataset.i18n])),
})).filter(entry => Object.values(entry.keys).some(key => key !== entry.node.dataset.i18n));
const gamePanels = document.querySelectorAll('[data-game-panel]');
const romTransfers = new Map();
const WORKER_TIMEOUT_MS = 30_000;
let rom = null;
let worker = null;
let workerTimer;
let busy = false;
let buttonMessage = 'patch.button';
let statusMessage = 'patch.start';
let statusState = 'muted';
const supported = Boolean(window.Worker && window.crypto?.subtle);

function currentGame() {
  return GAMES[game];
}
function disc() {
  return currentGame().extension === '.iso';
}
function hasPatches() {
  return Object.keys(currentGame().patches).length > 0;
}
function patchUrl() {
  return currentGame().patches[patchLanguage];
}
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  document.documentElement.style.backgroundColor = background;
  document.body.style.backgroundColor = background;
  themeButton.setAttribute('aria-label', text(dark ? 'theme.lightAria' : 'theme.darkAria', pageLanguage));
  document.querySelector('#theme-label').textContent = text(dark ? 'theme.lightLabel' : 'theme.darkLabel', pageLanguage);
  document.querySelector('meta[name="theme-color"]').content = background;
}
updateThemeButton();
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('zoids-theme', next); } catch {}
  updateThemeButton();
});

for (const tabList of document.querySelectorAll('.edition-tabs')) {
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  const feature = tabList.closest('.feature');
  if (!tabs.length || !feature) continue;
  const screen = feature.querySelector('.game-shot');
  let transition = 0;
  async function selectTab(selected) {
    const request = ++transition;
    const previous = screen.querySelector('.game-panel:not([hidden])');
    const next = document.getElementById(selected.getAttribute('aria-controls'));
    if (previous === next) {
      for (const tab of tabs) {
        const active = tab.getAttribute('aria-controls') === next.id;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      }
      if (previous.querySelector('.crt-beam')) effects?.powerCrt(previous, true);
      return;
    }
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    const closing = effects?.powerCrt(previous, false);
    if (closing) await closing.finished.catch(() => {});
    if (request !== transition) return;
    for (const tab of tabs) {
      document.getElementById(tab.getAttribute('aria-controls')).hidden = tab !== selected;
    }
    effects?.powerCrt(next, true);
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      const index = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[next]);
      tabs[next].focus();
    });
  }
}

if (window.ResizeObserver) {
  new ResizeObserver(() => {
    extractorButton.style.setProperty('--patch-button-height', `${patchButton.getBoundingClientRect().height}px`);
  }).observe(patchButton);
}

function syncPageLanguageButton() {
  const target = pageLanguage === 'en' ? 'es' : 'en';
  const helpKey = target === 'es' ? 'page.switchToSpanish' : 'page.switchToEnglish';
  const visible = `${text('language.pageLabel', pageLanguage)} ${text(target === 'es' ? 'language.shortSpanish' : 'language.shortEnglish', pageLanguage)}`;
  pageLanguageLabel.textContent = text(target === 'es' ? 'language.shortSpanish' : 'language.shortEnglish', pageLanguage);
  pageLanguageLabel.lang = target;
  pageLanguageButton.setAttribute('data-i18n-aria-label', helpKey);
  pageLanguageButton.setAttribute('data-i18n-title', helpKey);
  pageLanguageButton.setAttribute('aria-label', `${visible}: ${text(helpKey, pageLanguage)}`);
  pageLanguageButton.setAttribute('title', text(helpKey, pageLanguage));
}
function syncPatchLanguageButtons() {
  for (const button of languageButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.language === patchLanguage));
  }
}
function syncGameButtons() {
  for (const button of gameButtons) {
    const checked = button.dataset.game === game;
    button.setAttribute('aria-checked', String(checked));
    button.tabIndex = checked ? 0 : -1;
  }
}
function syncGameCopy() {
  for (const entry of gameCopy) entry.node.dataset.i18n = entry.keys[game];
}
function syncGameUI() {
  const patched = hasPatches();
  const extracting = patched && currentGame().extractor;
  languagePicker.hidden = Object.keys(currentGame().patches).length < 2;
  workflow.hidden = !patched;
  zone.hidden = !patched;
  patchButton.hidden = !patched;
  extractorButton.hidden = !extracting;
  skipLink.href = patched ? '#patcher-title' : '#about-title';
  sourceLink.hidden = !currentGame().source;
  if (currentGame().source) sourceLink.href = currentGame().source;
  skipLink.dataset.i18n = !patched ? 'skip.game' : disc() ? 'skip.disc' : 'skip.rom';
  for (const panel of gamePanels) panel.hidden = panel.dataset.gamePanel !== game;
  document.body.dataset.game = game;
  input.accept = currentGame().extension;
  input.setAttribute('data-i18n-aria-label', `patch.romAria.${game}`);
  for (const button of languageButtons) button.hidden = !currentGame().patches[button.dataset.language];
  if (patched) patchLanguage = currentGame().patches[preferredLanguage] ? preferredLanguage : Object.keys(currentGame().patches)[0];
  syncPatchLanguageButtons();
}
function bindChoiceGroup(options) {
  const isOn = option => option.getAttribute('aria-checked') === 'true' || option.getAttribute('aria-pressed') === 'true';
  for (const button of options) {
    button.addEventListener('keydown', event => {
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 :
        event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
      const edge = event.key === 'Home' ? 0 : event.key === 'End' ? -1 : null;
      if (!step && edge === null) return;
      const list = [...options].filter(option => !option.disabled);
      if (!list.length) return;
      event.preventDefault();
      if (edge !== null) {
        const target = edge === 0 ? list[0] : list.at(-1);
        target.click();
        target.focus();
        return;
      }
      const index = list.findIndex(isOn);
      const next = list[(index + step + list.length) % list.length];
      next.click();
      next.focus();
    });
  }
}
bindChoiceGroup(gameButtons);
bindChoiceGroup(languageButtons);

function setStatus(message, state = 'muted') {
  statusMessage = message;
  statusState = state;
  const version = hasPatches() && state !== 'error' ? currentGame().version : null;
  const prefix = version ? `${text('patch.versionLabel', pageLanguage)}${version} · ` : '';
  let key = message === 'patch.start' ? `patch.start.${game}` : message;
  if (key && disc() && text(`${key}.iso`, pageLanguage) !== `${key}.iso`) key = `${key}.iso`;
  status.textContent = key ? `${prefix}${text(key, pageLanguage)}` : '';
  status.dataset.error = String(state === 'error');
  const invalid = state === 'error' && /^error\.(file|rom)/.test(message ?? '');
  if (invalid) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
  zone.classList.toggle('invalid', invalid);
  for (const dot of statusDots) dot.className = `status-dot ${state}`;
}
function setButton(message) {
  buttonMessage = message;
  buttonLabel.textContent = text(message, pageLanguage);
}
function selectPageLanguage(selected, force = false) {
  if (!force && selected === pageLanguage) return;
  pageLanguage = selected;
  try { localStorage.setItem('zoids-page-language', pageLanguage); } catch {}
  syncGameCopy();
  localizePage(pageLanguage);
  syncPageLanguageButton();
  updateThemeButton();
  setButton(buttonMessage);
  setStatus(statusMessage, statusState);
}
function selectPatchLanguage(selected) {
  if (selected === patchLanguage) return;
  patchLanguage = selected;
  preferredLanguage = selected;
  try { localStorage.setItem('zoids-patch-language', patchLanguage); } catch {}
  syncPatchLanguageButtons();
  if (rom) {
    statusMessage = 'patch.verified';
    statusState = 'ready';
  }
  setButton('patch.button');
  setStatus(statusMessage, statusState);
  setBusy(busy);
}
function selectGame(selected, force = false) {
  if (!GAMES[selected] || (!force && (busy || selected === game))) return;
  stopWorker();
  game = selected;
  rom = null;
  zone.classList.remove('selected');
  input.value = '';
  try { localStorage.setItem('zoids-game', game); } catch {}
  if (linkedGame() !== game) history.replaceState(null, '', `#${game}`);
  syncGameButtons();
  syncGameUI();
  syncGameCopy();
  localizePage(pageLanguage);
  syncPageLanguageButton();
  updateThemeButton();
  setButton('patch.button');
  if (!supported && hasPatches()) setStatus('error.insecureContext', 'error');
  else setStatus(hasPatches() ? 'patch.start' : 'patch.noPatchStart');
  setBusy(false);
}
function setBusy(value) {
  busy = value;
  input.disabled = value || !supported;
  for (const button of gameButtons) button.disabled = value;
  for (const button of languageButtons) button.disabled = value;
  zone.classList.toggle('busy', value);
  for (const dot of statusDots) dot.dataset.busy = String(value);
  patchButton.disabled = value || !rom || !supported || !patchUrl();
  extractorButton.disabled = value || !rom || !supported || !currentGame().extractor;
  patchButton.setAttribute('aria-busy', String(value && Boolean(rom)));
}
function stopWorker() {
  clearTimeout(workerTimer);
  worker?.terminate();
  worker = null;
}
function failWorker(message) {
  stopWorker();
  setBusy(false);
  setButton('patch.button');
  setStatus(message, 'error');
}
function startWorker(action, file) {
  stopWorker();
  const selectedGame = game;
  const selectedLanguage = patchLanguage;
  const task = new Worker(new URL('./worker.js?v=20261127-hub-57', import.meta.url), { type: 'module' });
  worker = task;
  workerTimer = setTimeout(() => {
    failWorker('error.timeout');
  }, WORKER_TIMEOUT_MS);
  task.onerror = () => {
    if (worker !== task) return;
    failWorker('error.worker');
  };
  task.onmessage = ({ data }) => {
    if (worker !== task) return;
    stopWorker();
    setButton('patch.button');
    if (data.error) {
      if (action === 'validate') {
        rom = null;
        zone.classList.remove('selected');
      }
      setBusy(false);
      setStatus(data.error, 'error');
      return;
    }
    if (data.validated) {
      rom = file;
      zone.classList.add('selected');
      setBusy(false);
      setStatus('patch.verified', 'ready');
    } else if (data.target || data.blob) {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const url = URL.createObjectURL(data.blob ?? new Blob([data.target], { type: 'application/octet-stream' }));
      downloadUrl = url;
      const link = document.createElement('a');
      link.href = url;
      const filenameKey = GAMES[selectedGame].filenames[selectedLanguage];
      link.download = filenameKey ? text(filenameKey, pageLanguage) : `patched${GAMES[selectedGame].extension}`;
      document.body.append(link);
      link.click();
      link.remove();
      setBusy(false);
      setStatus('patch.complete', 'ready');
      setButton('patch.downloadAgain');
    }
  };
  task.postMessage({ action, game: selectedGame, language: selectedLanguage, rom: file });
}
function selectRom(files) {
  if (busy || !supported || !hasPatches() || !files.length) return;
  rom = null;
  zone.classList.remove('selected');
  patchButton.disabled = true;
  extractorButton.disabled = true;
  setButton('patch.button');
  if (files.length !== 1) {
    setStatus('error.fileCount', 'error');
    return;
  }
  const file = files[0];
  if (!file.name.toLowerCase().endsWith(currentGame().extension)) {
    setStatus(`error.fileType${currentGame().extension}`, 'error');
    return;
  }
  if (file.size !== currentGame().romSize) {
    setStatus(`error.romSize.${game}`, 'error');
    return;
  }
  setBusy(true);
  setStatus('patch.checking');
  try { startWorker('validate', file); } catch {
    failWorker('error.worker');
  }
}
input.addEventListener('change', () => {
  selectRom(input.files);
  input.value = '';
});
pageLanguageButton.addEventListener('click', () => {
  selectPageLanguage(pageLanguage === 'en' ? 'es' : 'en');
});
for (const button of gameButtons) button.addEventListener('click', () => {
  if (!busy) selectGame(button.dataset.game);
});
for (const button of languageButtons) button.addEventListener('click', () => {
  if (!busy) selectPatchLanguage(button.dataset.language);
});
for (const event of ['dragenter', 'dragover']) {
  zone.addEventListener(event, e => {
    e.preventDefault();
    if (!busy && supported) zone.classList.add('drag-over');
  });
}
zone.addEventListener('dragleave', e => {
  if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
});
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  selectRom(e.dataTransfer.files);
});
window.addEventListener('hashchange', () => {
  const linked = linkedGame();
  if (linked && !busy) selectGame(linked);
});
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
patchButton.addEventListener('click', () => {
  if (!rom || busy || !patchUrl()) return;
  setBusy(true);
  setButton('patch.applyingButton');
  setStatus('patch.applyingStatus');
  try { startWorker('patch', rom); } catch {
    failWorker('error.worker');
  }
});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'zoids-extractor-ready') return;
  const transfer = romTransfers.get(event.source);
  if (!transfer) return;
  clearTimeout(transfer.timer);
  romTransfers.delete(event.source);
  event.source.postMessage({ type: 'zoids-extractor-rom', file: transfer.file }, location.origin);
});
extractorButton.addEventListener('click', () => {
  if (!rom || busy || !supported || !currentGame().extractor) return;
  const url = new URL('./rom-tool.html', import.meta.url);
  url.searchParams.set('v', Date.now().toString(36));
  url.searchParams.set('from', 'patcher');
  const page = window.open(url.href, '_blank');
  if (!page) {
    setStatus('error.extractorPopup', 'error');
    return;
  }
  const timer = setTimeout(() => romTransfers.delete(page), 60000);
  romTransfers.set(page, { file: rom, timer });
});
window.addEventListener('pagehide', () => {
  for (const transfer of romTransfers.values()) clearTimeout(transfer.timer);
  romTransfers.clear();
});
selectPageLanguage(pageLanguage, true);
selectGame(game, true);
if (!supported) {
  input.disabled = true;
  zone.classList.add('disabled');
  if (hasPatches()) setStatus('error.insecureContext', 'error');
}
import('./effects.js?v=20261127-hub-57').then(({ createEffects }) => {
  effects = createEffects();
}).catch(() => {
  clearTimeout(window.introFallback);
  document.documentElement.classList.remove('intro-pending', 'intro-running');
});
