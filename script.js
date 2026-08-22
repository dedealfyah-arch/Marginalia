/* =========================================================
   MARGINALIA — script.js
   Semua interaksi untuk Home v0.0.1, Books v0.0.1, dan
   Book Detail v0.0.1. Setiap bagian diberi komentar agar
   mudah dipelajari.
   ========================================================= */


/* ===========================================================
   0. HELPER YANG DIPAKAI DI BEBERAPA TEMPAT
   =========================================================== */

// Menghitung persentase progres membaca dan membulatkannya ke
// 1 angka desimal. Dipakai oleh Home, Books, dan Book Detail
// supaya rumusnya hanya ditulis satu kali.
function calculatePercent(current, total) {
  if (!total || total <= 0) return 0;
  const percent = (current / total) * 100;
  return Math.round(percent * 10) / 10;
}

function getMostRecentlyActiveReadingBook() {
  const eligibleBooks = books.filter((book) => book.status === 'Reading'
    && book.currentPage != null
    && book.totalPages != null);

  let selectedBook = eligibleBooks[0] || null;
  let selectedTimestamp = selectedBook && !Number.isNaN(Date.parse(selectedBook.lastReadAt || ''))
    ? Date.parse(selectedBook.lastReadAt)
    : null;

  eligibleBooks.slice(1).forEach((book) => {
    const timestamp = !Number.isNaN(Date.parse(book.lastReadAt || ''))
      ? Date.parse(book.lastReadAt)
      : null;

    // Valid lastReadAt wins; legacy books retain deterministic array-order fallback.
    if (timestamp !== null && (selectedTimestamp === null || timestamp > selectedTimestamp)) {
      selectedBook = book;
      selectedTimestamp = timestamp;
    }
  });

  return selectedBook;
}


/* ===========================================================
   1. VIEW SWITCHING (Home <-> Books <-> Book Detail)
   Aplikasi ini "single page": semua view sudah ada di dalam
   index.html, kita hanya menyembunyikan/menampilkannya lewat
   atribut HTML `hidden`. Tidak ada reload atau file HTML lain.
   =========================================================== */

// Ambil semua link navigasi yang punya atribut data-view
// (baik di sidebar desktop maupun bottom nav mobile)
const navLinks = document.querySelectorAll('[data-view]');
const settingsModalOverlay = document.getElementById('settings-modal-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsTriggers = document.querySelectorAll('.settings-trigger');

function openSettings() {
  settingsModalOverlay.hidden = false;
  const firstInput = document.getElementById('auth-email-input');
  if (!firstInput.hidden) firstInput.focus();
  else settingsCloseBtn.focus();
}

function closeSettings() {
  settingsModalOverlay.hidden = true;
}

settingsTriggers.forEach((trigger) => trigger.addEventListener('click', openSettings));
settingsCloseBtn.addEventListener('click', closeSettings);
settingsModalOverlay.addEventListener('click', (event) => {
  if (event.target === settingsModalOverlay) closeSettings();
});

// showView menampilkan satu view berdasarkan id-nya, dan secara
// terpisah menentukan link navigasi mana yang harus terlihat
// "aktif" (activeNavKey). Dipisah karena Book Detail bukan item
// sidebar sendiri — saat Book Detail terbuka, link "Books" yang
// tetap terlihat aktif.
function showView(viewId, activeNavKey) {
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== viewId;
  });

  navLinks.forEach((link) => {
    const isActive = link.dataset.view === activeNavKey;

    link.classList.toggle('sidebar__link--active', isActive);
    link.classList.toggle('bottom-nav__link--active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function switchView(viewName) {
  showView(`view-${viewName}`, viewName);
}

// Pasang event click ke semua link yang punya data-view
navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault(); // jangan reload halaman / lompat ke "#"
    switchView(link.dataset.view);
  });
});


/* ===========================================================
   2. GLOBAL SEARCH (Home)
   Pencarian membaca semua knowledge yang tersimpan di memory
   JavaScript dan mengarahkan hasil item kembali ke Book Detail.
   =========================================================== */
const searchInput = document.getElementById('search-input');
const globalSearchEmpty = document.getElementById('global-search-empty');
const globalSearchNoResults = document.getElementById('global-search-no-results');
const globalSearchList = document.getElementById('global-search-list');
let detailReturnToSearch = false;

function returnToGlobalSearch() {
  detailReturnToSearch = false;
  showView('view-home', 'home');
  renderGlobalSearch();
}

function openGlobalSearchItem(result) {
  const bookId = Number(result.dataset.bookId);
  const itemId = Number(result.dataset.itemId);
  const book = books.find((item) => item.id === bookId);
  if (!book || Number.isNaN(itemId)) return;

  currentBookId = bookId;
  detailReturnToSearch = true;

  if (result.dataset.tab === 'vocabulary') {
    openVocabDetail(itemId);
  } else if (result.dataset.tab === 'quotes') {
    openQuoteDetail(itemId);
  } else if (result.dataset.tab === 'notes') {
    openNoteDetail(itemId);
  }
}

function includesQuery(value, query) {
  return String(value || '').toLowerCase().includes(query);
}

function createPreview(value, maxLength = 120) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function createGlobalSearchResult(result) {
  const card = document.createElement('article');
  card.className = 'global-search-result';
  card.dataset.bookId = result.bookId;
  card.dataset.tab = result.tab || '';
  card.dataset.itemId = result.itemId || '';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open ${result.type.toLowerCase()} in ${result.bookTitle}`);

  const type = document.createElement('span');
  type.className = `global-search-result__type global-search-result__type--${result.type.toLowerCase()}`;
  type.textContent = result.type;

  const title = document.createElement('h3');
  title.className = 'global-search-result__title';
  title.textContent = result.title;

  const description = document.createElement('p');
  description.className = 'global-search-result__description';
  description.textContent = result.description;

  const source = document.createElement('p');
  source.className = 'global-search-result__source';
  source.textContent = `${result.bookTitle}${result.page != null ? ` · Page ${result.page}` : ''}`;

  card.append(type, title, description, source);
  return card;
}

function getGlobalSearchResults(query) {
  const results = [];

  books.forEach((book) => {
    if (includesQuery(book.title, query) || includesQuery(book.author, query)) {
      results.push({
        type: 'BOOK',
        title: book.title,
        description: book.author,
        bookTitle: book.title,
        bookId: book.id,
      });
    }

    book.vocabulary.forEach((item) => {
      if (includesQuery(item.word, query) || includesQuery(item.meaning, query) || includesQuery(item.context, query)) {
        results.push({
          type: 'VOCABULARY',
          title: item.word,
          description: item.meaning || item.context || 'Vocabulary entry',
          bookTitle: book.title,
          bookId: book.id,
          tab: 'vocabulary',
          itemId: item.id,
        });
      }
    });

    book.quotes.forEach((item) => {
      if (includesQuery(item.text, query) || includesQuery(item.context, query)) {
        results.push({
          type: 'QUOTE',
          title: `"${item.text}"`,
          description: item.context || 'Quote from your reading',
          bookTitle: book.title,
          bookId: book.id,
          page: item.page,
          tab: 'quotes',
          itemId: item.id,
        });
      }
    });

    book.notes.forEach((item) => {
      if (includesQuery(item.title, query) || includesQuery(item.content, query)) {
        results.push({
          type: 'NOTE',
          title: item.title || 'Note',
          description: createPreview(item.content),
          bookTitle: book.title,
          bookId: book.id,
          page: item.page,
          tab: 'notes',
          itemId: item.id,
        });
      }
    });
  });

  return results;
}

function renderGlobalSearch() {
  const query = searchInput.value.trim().toLowerCase();
  globalSearchList.innerHTML = '';

  globalSearchEmpty.hidden = query !== '';
  globalSearchNoResults.hidden = true;

  if (query === '') return;

  const results = getGlobalSearchResults(query);
  if (results.length === 0) {
    globalSearchNoResults.hidden = false;
    return;
  }

  results.forEach((result) => {
    globalSearchList.appendChild(createGlobalSearchResult(result));
  });
}

searchInput.addEventListener('input', renderGlobalSearch);

globalSearchList.addEventListener('click', (event) => {
  const result = event.target.closest('.global-search-result');
  if (!result) return;
  if (result.dataset.itemId) {
    openGlobalSearchItem(result);
    return;
  }
  openBookDetail(Number(result.dataset.bookId));
});

globalSearchList.addEventListener('keydown', (event) => {
  const result = event.target.closest('.global-search-result');
  if (!result) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (result.dataset.itemId) {
      openGlobalSearchItem(result);
      return;
    }
    openBookDetail(Number(result.dataset.bookId));
  }
});


/* ===========================================================
   3. PROGRESS CALCULATION (Continue Reading — Home)
   =========================================================== */
function updateHomeReadingProgress() {
  const readingCard = document.getElementById('home-reading-card');
  if (!readingCard) return;

  const currentPage = Number(readingCard.dataset.currentPage);
  const totalPages = Number(readingCard.dataset.totalPages);
  const percent = calculatePercent(currentPage, totalPages);

  const progressBar = document.getElementById('reading-progress-bar');
  const progressLabel = document.getElementById('reading-progress-label');
  const progressPercent = document.getElementById('reading-progress-percent');
  const progress = document.querySelector('#view-home .progress');
  if (!progressBar || !progressLabel || !progressPercent || !progress) return;

  progressBar.style.width = `${percent}%`;
  progressLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  progressPercent.textContent = `${percent}%`;

  progress.setAttribute('aria-valuenow', Math.round(percent));
}

updateHomeReadingProgress();


/* ===========================================================
   4. ADD KNOWLEDGE MODAL (Home) — buka & tutup
   =========================================================== */
const addKnowledgeBtn = document.getElementById('add-knowledge-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const knowledgeOptions = document.getElementById('knowledge-options');
const knowledgeEmptyState = document.getElementById('knowledge-empty-state');
const knowledgeAddBookBtn = document.getElementById('knowledge-add-book-btn');

function openModal() {
  const hasBooks = books.length > 0;
  knowledgeOptions.hidden = !hasBooks;
  knowledgeEmptyState.hidden = hasBooks;
  knowledgeAddBookBtn.hidden = hasBooks;
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
}

if (addKnowledgeBtn) addKnowledgeBtn.addEventListener('click', openModal);
if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
knowledgeAddBookBtn.addEventListener('click', () => {
  closeModal();
  openBookModal();
});

modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

const modalOptions = document.querySelectorAll('.modal-option');

modalOptions.forEach((optionButton) => {
  optionButton.addEventListener('click', () => {
    const type = optionButton.dataset.type;
    closeModal();

    if (type === 'Book') openBookModal();
    if (type === 'Vocabulary') openAggregateVocabModal();
    if (type === 'Quote') openAggregateQuoteModal();
    if (type === 'Note') openAggregateNoteModal();
  });
});


/* ===========================================================
   5. APPLICATION STATE & BOOKS DATA
   =========================================================== */
const STORAGE_KEY = 'marginalia_data';
const EMPTY_STATE = { version: 1, books: [] };

function isValidState(state) {
  return state && state.version === 1 && Array.isArray(state.books)
    && state.books.every((book) => book && typeof book === 'object'
      && Array.isArray(book.vocabulary)
      && Array.isArray(book.quotes)
      && Array.isArray(book.notes));
}

function migrateState(state) {
  if (state.version === 1) return state;
  return null;
}

function loadState() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData === null) return { ...EMPTY_STATE, books: [] };

    const parsedState = JSON.parse(savedData);
    if (!isValidState(parsedState)) return { ...EMPTY_STATE, books: [] };

    return migrateState(parsedState) || { ...EMPTY_STATE, books: [] };
  } catch (error) {
    return { ...EMPTY_STATE, books: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    return true;
  } catch (error) {
    return false;
  }
}

const persistenceError = document.getElementById('persistence-error');
const syncIndicator = document.getElementById('sync-indicator');

function setSyncStatus(status) {
  if (!syncIndicator) return;
  const labels = { synced: '☁ Synced', syncing: '⟳ Syncing...', offline: '⚠ Offline', failed: '⚠ Sync failed' };
  syncIndicator.textContent = labels[status] || labels.offline;
  syncIndicator.dataset.status = status;
}

function touchStateRecords() {
  const updatedAt = new Date().toISOString();
  books.forEach((book) => {
    book.updatedAt = updatedAt;
    ['vocabulary', 'quotes', 'notes'].forEach((collectionName) => {
      book[collectionName].forEach((item) => { item.updatedAt = updatedAt; });
    });
  });
}

function showPersistenceError() {
  persistenceError.textContent = 'Changes could not be saved. Your previous data was restored.';
  persistenceError.hidden = false;
}

function persistMutation(mutate, onSuccess, onFailure) {
  let snapshot;

  try {
    snapshot = structuredClone(appState);
  } catch (error) {
    showPersistenceError();
    onFailure();
    return false;
  }

  mutate();
  touchStateRecords();

  if (saveState()) {
    onSuccess();
    scheduleCloudSync();
    return true;
  }

  appState.books = snapshot.books;
  books = appState.books;
  showPersistenceError();
  onFailure();
  return false;
}

const appState = loadState();
let books = appState.books;

/* ===========================================================
   5A. SUPABASE CLOUD SYNC (LOCAL-FIRST)
   =========================================================== */
const SUPABASE_URL = 'https://bwaprxxpykwyikeqedbz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Xgt42F6Y2DyZO-sJP-fleQ_XhCbK0je';
const CLOUD_MIGRATION_KEY = 'marginalia_cloud_migration_v1';
const CLOUD_DELETE_QUEUE_KEY = 'marginalia_cloud_delete_queue_v1';
const cloudSyncEnabled = SUPABASE_URL !== 'YOUR_SUPABASE_URL'
  && SUPABASE_PUBLISHABLE_KEY !== 'YOUR_SUPABASE_PUBLISHABLE_KEY'
  && window.supabase?.createClient;
const supabaseClient = cloudSyncEnabled
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
let cloudSyncPromise = Promise.resolve();

async function getSupabaseUser() {
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session?.user || null;
  } catch (error) {
    console.warn('Supabase session unavailable.', error);
    return null;
  }
}

function toLocalId(value) {
  return String(value);
}

function mapBookToCloud(book, userId) {
  return {
    user_id: userId,
    local_id: toLocalId(book.id),
    title: book.title,
    author: book.author,
    cover: book.cover,
    status: book.status,
    current_page: book.currentPage,
    total_pages: book.totalPages,
    date_added: book.dateAdded,
    created_at: book.createdAt,
    last_read_at: book.lastReadAt || null,
    updated_at: book.updatedAt || book.createdAt || new Date().toISOString(),
  };
}

function mapVocabularyToCloud(item, bookId, userId) {
  return {
    user_id: userId,
    local_id: toLocalId(item.id),
    book_id: bookId,
    created_at: item.createdAt,
    word: item.word,
    part_of_speech: item.partOfSpeech,
    meaning: item.meaning,
    page: item.page,
    context: item.context,
    pronunciation: item.pronunciation,
    synonyms: item.synonyms,
    antonyms: item.antonyms,
    chapter: item.chapter,
    occurrence_date: item.occurrenceDate,
    personal_note: item.personalNote,
    updated_at: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

function mapQuoteToCloud(item, bookId, userId) {
  return {
    user_id: userId,
    local_id: toLocalId(item.id),
    book_id: bookId,
    created_at: item.createdAt,
    text: item.text,
    page: item.page,
    context: item.context,
    chapter: item.chapter,
    reflection: item.reflection,
    updated_at: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

function mapNoteToCloud(item, bookId, userId) {
  return {
    user_id: userId,
    local_id: toLocalId(item.id),
    book_id: bookId,
    created_at: item.createdAt,
    title: item.title,
    content: item.content,
    page: item.page,
    chapter: item.chapter,
    updated_at: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

async function upsertCloudRows(table, rows) {
  if (rows.length === 0) return [];

  let { data, error } = await supabaseClient
    .from(table)
    .upsert(rows, { onConflict: 'user_id,local_id' })
    .select('id, local_id');
  if (error && /updated_at|column/i.test(error.message || '')) {
    const legacyRows = rows.map((row) => {
      const { updated_at: ignored, ...withoutTimestamp } = row;
      return withoutTimestamp;
    });
    ({ data, error } = await supabaseClient.from(table)
      .upsert(legacyRows, { onConflict: 'user_id,local_id' })
      .select('id, local_id'));
  }
  if (error) throw error;
  return data || [];
}

async function syncLocalStateToCloud() {
  const user = await getSupabaseUser();
  if (!user) return false;
  await flushCloudDeleteQueue();
  if (books.length === 0) return true;

  const cloudBooks = await upsertCloudRows(
    'books',
    books.map((book) => mapBookToCloud(book, user.id)),
  );
  const cloudBookIds = new Map(cloudBooks.map((book) => [toLocalId(book.local_id), book.id]));
  const vocabulary = [];
  const quotes = [];
  const notes = [];

  books.forEach((book) => {
    const cloudBookId = cloudBookIds.get(toLocalId(book.id));
    if (!cloudBookId) return;
    book.vocabulary.forEach((item) => vocabulary.push(mapVocabularyToCloud(item, cloudBookId, user.id)));
    book.quotes.forEach((item) => quotes.push(mapQuoteToCloud(item, cloudBookId, user.id)));
    book.notes.forEach((item) => notes.push(mapNoteToCloud(item, cloudBookId, user.id)));
  });

  await upsertCloudRows('vocabulary', vocabulary);
  await upsertCloudRows('quotes', quotes);
  await upsertCloudRows('notes', notes);
  return true;
}

async function deleteCloudBookData(book) {
  const user = await getSupabaseUser();
  if (!user) return false;
  const { data: cloudBook, error: bookLookupError } = await supabaseClient
    .from('books').select('id').eq('user_id', user.id).eq('local_id', toLocalId(book.id)).maybeSingle();
  if (bookLookupError) throw bookLookupError;
  if (!cloudBook) return true;
  for (const table of ['vocabulary', 'quotes', 'notes']) {
    const { error } = await supabaseClient.from(table).delete().eq('user_id', user.id).eq('book_id', cloudBook.id);
    if (error) throw error;
  }
  const { error } = await supabaseClient.from('books').delete().eq('user_id', user.id).eq('local_id', toLocalId(book.id));
  if (error) throw error;
  return true;
}

async function flushCloudDeleteQueue() {
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(CLOUD_DELETE_QUEUE_KEY) || '[]'); } catch (error) { return; }
  if (queue.length === 0) return;

  const remaining = [];
  for (const queuedBook of queue) {
    try { await deleteCloudBookData(queuedBook); } catch (error) { remaining.push(queuedBook); }
  }
  localStorage.setItem(CLOUD_DELETE_QUEUE_KEY, JSON.stringify(remaining));
  if (remaining.length === 0) setSyncStatus('synced');
}

function scheduleCloudDelete(book) {
  if (!supabaseClient) return;
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(CLOUD_DELETE_QUEUE_KEY) || '[]'); } catch (error) { queue = []; }
  if (!queue.some((item) => toLocalId(item.id) === toLocalId(book.id))) queue.push(book);
  localStorage.setItem(CLOUD_DELETE_QUEUE_KEY, JSON.stringify(queue));
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  setSyncStatus('syncing');
  cloudSyncPromise = cloudSyncPromise.catch(() => {}).then(async () => {
    const remaining = [];
    for (const queuedBook of queue) {
      try { await deleteCloudBookData(queuedBook); } catch (error) { remaining.push(queuedBook); throw error; }
    }
    localStorage.setItem(CLOUD_DELETE_QUEUE_KEY, JSON.stringify(remaining));
    setSyncStatus('synced');
  }).catch((error) => {
    console.warn('Supabase delete failed; local data was kept.', error);
    setSyncStatus('failed');
  });
}

async function migrateLocalStateToCloud() {
  if (localStorage.getItem(CLOUD_MIGRATION_KEY) === 'completed') return false;

  const synced = await syncLocalStateToCloud();
  if (synced) localStorage.setItem(CLOUD_MIGRATION_KEY, 'completed');
  return synced;
}

function scheduleCloudSync() {
  if (!supabaseClient) return;
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  setSyncStatus('syncing');
  cloudSyncPromise = cloudSyncPromise
    .catch(() => {})
    .then(() => syncLocalStateToCloud())
    .then((synced) => { if (synced) setSyncStatus('synced'); return synced; })
    .catch((error) => {
      console.warn('Supabase sync failed; local data was kept.', error);
      setSyncStatus('failed');
      return false;
    });
}

async function loadCloudState() {
  return migrateLocalStateToCloud();
}

async function syncCloudStateToLocal() {
  const user = await getSupabaseUser();
  if (!user) return false;

  const [booksResult, vocabularyResult, quotesResult, notesResult] = await Promise.all([
    supabaseClient.from('books').select('*').eq('user_id', user.id),
    supabaseClient.from('vocabulary').select('*').eq('user_id', user.id),
    supabaseClient.from('quotes').select('*').eq('user_id', user.id),
    supabaseClient.from('notes').select('*').eq('user_id', user.id),
  ]);
  const result = [booksResult, vocabularyResult, quotesResult, notesResult].find((item) => item.error);
  if (result) throw result.error;

  const localBookIds = new Set(books.map((book) => toLocalId(book.id)));
  const cloudBookIdMap = new Map();
  booksResult.data.forEach((book) => {
    cloudBookIdMap.set(String(book.id), Number(book.local_id));
    const localBook = books.find((item) => toLocalId(item.id) === toLocalId(book.local_id));
    const cloudUpdatedAt = book.updated_at || book.created_at;
    if (!localBookIds.has(toLocalId(book.local_id))) {
      books.push({
        id: Number(book.local_id),
        title: book.title,
        author: book.author,
        cover: book.cover,
        status: book.status,
        currentPage: book.current_page,
        totalPages: book.total_pages,
        dateAdded: book.date_added,
        createdAt: book.created_at,
        vocabulary: [],
        quotes: [],
        notes: [],
        lastReadAt: book.last_read_at,
        updatedAt: cloudUpdatedAt,
      });
    } else if (localBook && cloudUpdatedAt && new Date(cloudUpdatedAt) > new Date(localBook.updatedAt || localBook.createdAt || 0)) {
      Object.assign(localBook, { title: book.title, author: book.author, cover: book.cover, status: book.status,
        currentPage: book.current_page, totalPages: book.total_pages, dateAdded: book.date_added,
        lastReadAt: book.last_read_at, updatedAt: cloudUpdatedAt });
    }
  });

  const findLocalBook = (cloudBookId) => books.find((book) => book.id === cloudBookIdMap.get(String(cloudBookId)));
  const appendMissing = (rows, collectionName, mapItem) => {
    rows.forEach((item) => {
      const book = findLocalBook(item.book_id);
      if (!book) return;
      const localItem = book[collectionName].find((candidate) => toLocalId(candidate.id) === toLocalId(item.local_id));
      const cloudUpdatedAt = item.updated_at || item.created_at;
      if (!localItem) book[collectionName].push(mapItem(item));
      else if (cloudUpdatedAt && new Date(cloudUpdatedAt) > new Date(localItem.updatedAt || localItem.createdAt || 0)) Object.assign(localItem, mapItem(item), { updatedAt: cloudUpdatedAt });
    });
  };

  appendMissing(vocabularyResult.data, 'vocabulary', (item) => ({
    id: Number(item.local_id), createdAt: item.created_at, word: item.word,
    partOfSpeech: item.part_of_speech, meaning: item.meaning, page: item.page,
    context: item.context, pronunciation: item.pronunciation, synonyms: item.synonyms,
    antonyms: item.antonyms, chapter: item.chapter, occurrenceDate: item.occurrence_date,
    personalNote: item.personal_note, updatedAt: item.updated_at || item.created_at,
  }));
  appendMissing(quotesResult.data, 'quotes', (item) => ({
    id: Number(item.local_id), bookId: findLocalBook(item.book_id)?.id, createdAt: item.created_at,
    text: item.text, page: item.page, context: item.context, chapter: item.chapter, reflection: item.reflection, updatedAt: item.updated_at || item.created_at,
  }));
  appendMissing(notesResult.data, 'notes', (item) => ({
    id: Number(item.local_id), bookId: findLocalBook(item.book_id)?.id, createdAt: item.created_at,
    title: item.title, content: item.content, page: item.page, chapter: item.chapter, updatedAt: item.updated_at || item.created_at,
  }));

  appState.books = books;
  saveState();
  renderBooks();
  refreshAggregateViews();
  return true;
}

let initializeCloudSync = () => Promise.resolve(false);
if (supabaseClient) {
  initializeCloudSync = () => syncCloudStateToLocal()
    .then(() => loadCloudState())
    .then((synced) => { if (synced) setSyncStatus('synced'); return synced; })
    .catch((error) => console.warn('Supabase startup sync failed; local data was kept.', error));

  supabaseClient.auth.onAuthStateChange(() => {
    refreshAuthUi();
    initializeCloudSync();
  });
  initializeCloudSync();
}

const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email-input');
const authPasswordInput = document.getElementById('auth-password-input');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authLogoutBtn = document.getElementById('auth-logout-btn');
const authStatus = document.getElementById('auth-status');

function showAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.hidden = false;
  authStatus.style.color = isError ? 'var(--error)' : '';
}

async function refreshAuthUi() {
  const user = await getSupabaseUser();
  const loggedIn = Boolean(user);
  authEmailInput.hidden = loggedIn;
  authPasswordInput.hidden = loggedIn;
  authSubmitBtn.hidden = loggedIn;
  authLogoutBtn.hidden = !loggedIn;
  if (loggedIn) showAuthStatus(user.email || 'Signed in');
  else {
    authStatus.hidden = true;
    setSyncStatus('offline');
  }
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) { showAuthStatus('Cloud login is unavailable.', true); return; }
  const { error } = await supabaseClient.auth.signInWithPassword({ email: authEmailInput.value.trim(), password: authPasswordInput.value });
  if (error) { showAuthStatus('Login failed. Check your email and password.', true); return; }
  authPasswordInput.value = '';
  await refreshAuthUi();
  await initializeCloudSync();
});

authLogoutBtn.addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  await refreshAuthUi();
  setSyncStatus(navigator.onLine ? 'offline' : 'offline');
});

window.addEventListener('online', () => { setSyncStatus('syncing'); initializeCloudSync().then(() => scheduleCloudSync()); });
window.addEventListener('offline', () => setSyncStatus('offline'));
refreshAuthUi();
setSyncStatus(navigator.onLine && supabaseClient ? 'syncing' : 'offline');

function getNextId(items) {
  return items.reduce((highestId, item) => Math.max(highestId, Number(item.id) || 0), 0) + 1;
}

function getAllItems(collectionName) {
  return books.flatMap((book) => book[collectionName]);
}

const allVocabularySearchInput = document.getElementById('all-vocabulary-search-input');
const allVocabularyGrid = document.getElementById('all-vocabulary-grid');
const allVocabularyEmpty = document.getElementById('all-vocabulary-empty');
const allQuotesSearchInput = document.getElementById('all-quotes-search-input');
const allQuotesGrid = document.getElementById('all-quotes-grid');
const allQuotesEmpty = document.getElementById('all-quotes-empty');
const aggregateAddVocabularyBtn = document.getElementById('aggregate-add-vocabulary-btn');
const aggregateAddQuoteBtn = document.getElementById('aggregate-add-quote-btn');

function getAllVocabulary() {
  return books.flatMap((book) => book.vocabulary.map((item) => ({ ...item, bookId: book.id, bookTitle: book.title })));
}

function getAllQuotes() {
  return books.flatMap((book) => book.quotes.map((item) => ({ ...item, bookId: book.id, bookTitle: book.title })));
}

function getRecentlyAddedItems() {
  const items = [];

  books.forEach((book, bookIndex) => {
    const bookCreatedAt = book.createdAt || `${book.dateAdded || '1970-01-01'}T00:00:00.000Z`;

    book.vocabulary.forEach((item, itemIndex) => {
      items.push({
        ...item,
        type: 'vocabulary',
        bookId: book.id,
        bookTitle: book.title,
        createdAt: item.createdAt || bookCreatedAt,
        fallbackOrder: bookIndex * 3000 + itemIndex,
      });
    });

    book.quotes.forEach((item, itemIndex) => {
      items.push({
        ...item,
        type: 'quote',
        bookId: book.id,
        bookTitle: book.title,
        createdAt: item.createdAt || bookCreatedAt,
        fallbackOrder: bookIndex * 3000 + 1000 + itemIndex,
      });
    });

    book.notes.forEach((item, itemIndex) => {
      items.push({
        ...item,
        type: 'note',
        bookId: book.id,
        bookTitle: book.title,
        createdAt: item.createdAt || bookCreatedAt,
        fallbackOrder: bookIndex * 3000 + 2000 + itemIndex,
      });
    });
  });

  return items
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.fallbackOrder - left.fallbackOrder)
    .slice(0, 5);
}

function formatSavedDate(createdAt) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? 'Saved date unavailable'
    : `Saved ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function createCompactCard(title, meta, description, page, type, item) {
  const card = document.createElement('article');
  card.className = `compact-card compact-card--${type}`;
  card.dataset.bookId = item.bookId;
  card.dataset.itemId = item.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const heading = document.createElement('h3');
  heading.className = 'compact-card__title';
  heading.textContent = title;
  card.appendChild(heading);

  const metaElement = document.createElement('p');
  metaElement.className = 'compact-card__meta';
  metaElement.textContent = meta;
  card.appendChild(metaElement);

  if (description) {
    const descriptionElement = document.createElement('p');
    descriptionElement.className = 'compact-card__description';
    descriptionElement.textContent = description;
    card.appendChild(descriptionElement);
  }

  const pageElement = document.createElement('p');
  pageElement.className = 'compact-card__page';
  pageElement.textContent = page == null ? 'Page -' : `Page ${page}`;
  card.appendChild(pageElement);

  return card;
}

function renderAllVocabulary() {
  const query = allVocabularySearchInput.value.trim().toLowerCase();
  const items = getAllVocabulary().filter((item) => [item.word, item.partOfSpeech, item.meaning, item.bookTitle]
    .some((value) => includesQuery(value, query)));

  allVocabularyGrid.innerHTML = '';
  allVocabularyEmpty.hidden = items.length !== 0;
  items.forEach((item) => {
    allVocabularyGrid.appendChild(createCompactCard(
      item.word,
      `${item.partOfSpeech || 'Part of speech not set'} · ${item.bookTitle}`,
      createPreview(item.meaning || item.context, 72),
      item.page,
      'vocabulary',
      item,
    ));
  });
}

function renderAllQuotes() {
  const query = allQuotesSearchInput.value.trim().toLowerCase();
  const items = getAllQuotes().filter((item) => [item.text, item.context, item.bookTitle]
    .some((value) => includesQuery(value, query)));

  allQuotesGrid.innerHTML = '';
  allQuotesEmpty.hidden = items.length !== 0;
  items.forEach((item) => {
    allQuotesGrid.appendChild(createCompactCard(
      `"${createPreview(item.text, 110)}"`,
      item.bookTitle,
      createPreview(item.context, 72),
      item.page,
      'quote',
      item,
    ));
  });
}

function refreshAggregateViews() {
  renderHomeState();
  renderAllVocabulary();
  renderAllQuotes();
}

function renderHomeState() {
  const readingBook = getMostRecentlyActiveReadingBook();
  const readingCard = document.getElementById('home-reading-card');
  readingCard.innerHTML = '';

  if (!readingBook) {
    readingCard.textContent = 'No book is currently in progress.';
  } else {
    readingCard.dataset.currentPage = readingBook.currentPage;
    readingCard.dataset.totalPages = readingBook.totalPages;
    readingCard.dataset.bookId = readingBook.id;
    readingCard.innerHTML = `<div class="reading-card__cover" aria-hidden="true">${readingBook.cover}</div>
      <div class="reading-card__body">
        <h3 class="reading-card__title"></h3>
        <p class="reading-card__author"></p>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-label="Reading progress">
          <div class="progress__bar" id="reading-progress-bar"></div>
        </div>
        <div class="reading-card__meta"><span id="reading-progress-label"></span><span id="reading-progress-percent"></span></div>
        <button type="button" class="btn btn--ghost" id="home-continue-reading-btn">Continue Reading</button>
      </div>`;
    readingCard.querySelector('.reading-card__title').textContent = readingBook.title;
    readingCard.querySelector('.reading-card__author').textContent = readingBook.author;
    readingCard.querySelector('#home-continue-reading-btn').addEventListener('click', () => openBookDetail(readingBook.id));
  }
  updateHomeReadingProgress();

  const recentGrid = document.getElementById('recently-added-grid');
  const recentlyAddedEmpty = document.getElementById('recently-added-empty');
  const recentlyAddedItems = getRecentlyAddedItems();
  recentGrid.innerHTML = '';
  recentlyAddedEmpty.hidden = recentlyAddedItems.length !== 0;

  recentlyAddedItems.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'recent-item-card';
    card.dataset.type = item.type;
    card.dataset.bookId = item.bookId;
    card.dataset.itemId = item.id || '';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const typeLabel = document.createElement('span');
    typeLabel.className = 'recent-item-card__type';
    typeLabel.textContent = item.type === 'vocabulary'
      ? '🔤 Vocabulary'
      : item.type === 'quote'
        ? '💬 Quote'
        : '📝 Note';

    const title = document.createElement('h3');
    title.className = 'recent-item-card__title';
    title.textContent = item.type === 'vocabulary'
      ? item.word
      : item.type === 'quote'
        ? `"${createPreview(item.text, 76)}"`
        : item.title || createPreview(item.content, 100) || 'Note';

    const source = document.createElement('p');
    source.className = 'recent-item-card__source';
    source.textContent = item.bookTitle;

    const savedDate = document.createElement('p');
    savedDate.className = 'recent-item-card__date';
    savedDate.textContent = formatSavedDate(item.createdAt);

    card.append(typeLabel, title, source, savedDate);

    if (item.page != null) {
      const page = document.createElement('p');
      page.className = 'recent-item-card__page';
      page.textContent = `Page ${item.page}`;
      card.appendChild(page);
    }

    function openRecentItem() {
      currentBookId = Number(item.bookId);
      if (item.type === 'vocabulary') openVocabDetail(item.id);
      if (item.type === 'quote') openQuoteDetail(item.id);
      if (item.type === 'note') openNoteDetail(item.id);
    }

    card.addEventListener('click', openRecentItem);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRecentItem();
      }
    });
    recentGrid.appendChild(card);
  });

  document.getElementById('stat-books').textContent = books.length;
  document.getElementById('stat-reading').textContent = books.filter((book) => book.status === 'Reading').length;
  document.getElementById('stat-vocabulary').textContent = getAllVocabulary().length;
  document.getElementById('stat-quotes').textContent = getAllQuotes().length;
  document.getElementById('stat-notes').textContent = books.reduce((total, book) => total + book.notes.length, 0);
}

allVocabularySearchInput.addEventListener('input', renderAllVocabulary);
allQuotesSearchInput.addEventListener('input', renderAllQuotes);

function openAggregateItem(event, type) {
  const card = event.target.closest('.compact-card');
  if (!card) return;
  currentBookId = Number(card.dataset.bookId);
  detailReturnToSearch = false;
  if (type === 'vocabulary') openVocabDetail(Number(card.dataset.itemId));
  if (type === 'quote') openQuoteDetail(Number(card.dataset.itemId));
}

allVocabularyGrid.addEventListener('click', (event) => openAggregateItem(event, 'vocabulary'));
allQuotesGrid.addEventListener('click', (event) => openAggregateItem(event, 'quote'));
allVocabularyGrid.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') openAggregateItem(event, 'vocabulary');
});
allQuotesGrid.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') openAggregateItem(event, 'quote');
});

refreshAggregateViews();


/* ===========================================================
   6. RENDER BOOKS (Books view — search + filter digabung)
   =========================================================== */
const bookGrid = document.getElementById('book-grid');
const noBooksMessage = document.getElementById('no-books-message');
const bookSearchInput = document.getElementById('book-search-input');
const statusFilterSelect = document.getElementById('status-filter');

// Ubah nama status menjadi class CSS badge yang sesuai
function getBadgeClass(status) {
  if (status === 'Reading') return 'book-card__badge--reading';
  if (status === 'Completed') return 'book-card__badge--completed';
  return 'book-card__badge--want';
}

// Ambil daftar buku yang sesuai dengan search query + filter status.
// Search & filter bisa dipakai bersamaan karena keduanya diterapkan
// berurutan pada array yang sama.
function getFilteredBooks() {
  const query = bookSearchInput.value.trim().toLowerCase();
  const statusFilter = statusFilterSelect.value;

  return books.filter((book) => {
    const matchesQuery =
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'All' || book.status === statusFilter;

    return matchesQuery && matchesStatus;
  });
}

// Bangun satu elemen kartu buku (dibuat lewat DOM API, bukan
// innerHTML, supaya judul/penulis dari input user selalu aman
// ditampilkan sebagai teks biasa, bukan HTML).
function createBookCard(book) {
  const card = document.createElement('article');
  card.className = 'book-card';
  card.dataset.id = book.id; // dipakai saat card diklik untuk buka detail
  card.tabIndex = 0; // agar bisa difokus dengan keyboard
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open details for ${book.title}`);

  const cover = document.createElement('div');
  cover.className = 'book-card__cover';
  cover.setAttribute('aria-hidden', 'true');
  cover.textContent = book.cover;

  const body = document.createElement('div');
  body.className = 'book-card__body';

  const badge = document.createElement('span');
  badge.className = `book-card__badge ${getBadgeClass(book.status)}`;
  badge.textContent = book.status;

  const title = document.createElement('h3');
  title.className = 'book-card__title';
  title.textContent = book.title;

  const author = document.createElement('p');
  author.className = 'book-card__author';
  author.textContent = book.author;

  body.append(badge, title, author);

  const actions = document.createElement('div');
  actions.className = 'detail-card__actions';
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'card-action-btn';
  editButton.dataset.action = 'edit';
  editButton.textContent = 'Edit';
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'card-action-btn card-action-btn--danger';
  deleteButton.dataset.action = 'delete';
  deleteButton.textContent = 'Delete';
  actions.append(editButton, deleteButton);
  body.appendChild(actions);

  // Progress bar hanya ditampilkan untuk buku berstatus "Reading"
  // dan yang punya currentPage & totalPages.
  if (book.status === 'Reading' && book.currentPage != null && book.totalPages != null) {
    const percent = calculatePercent(book.currentPage, book.totalPages);

    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'book-card__progress';

    const track = document.createElement('div');
    track.className = 'progress';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(Math.round(percent)));

    const bar = document.createElement('div');
    bar.className = 'progress__bar';
    bar.style.width = `${percent}%`;
    track.appendChild(bar);

    const meta = document.createElement('div');
    meta.className = 'book-card__progress-meta';

    const pageLabel = document.createElement('span');
    pageLabel.textContent = `Page ${book.currentPage} of ${book.totalPages}`;

    const percentLabel = document.createElement('span');
    percentLabel.textContent = `${percent}%`;

    meta.append(pageLabel, percentLabel);
    progressWrapper.append(track, meta);
    body.appendChild(progressWrapper);
  }

  card.appendChild(cover);
  card.appendChild(body);

  return card;
}

// Render ulang seluruh grid buku berdasarkan hasil filter saat ini
function renderBooks() {
  const filteredBooks = getFilteredBooks();

  // Kosongkan grid sebelum mengisi ulang
  bookGrid.innerHTML = '';

  if (filteredBooks.length === 0) {
    noBooksMessage.hidden = false;
    return;
  }

  noBooksMessage.hidden = true;

  filteredBooks.forEach((book) => {
    bookGrid.appendChild(createBookCard(book));
  });
}

// Render ulang setiap kali user mengetik di search atau ganti filter
bookSearchInput.addEventListener('input', renderBooks);
statusFilterSelect.addEventListener('change', renderBooks);

// Klik (atau tekan Enter/Space) pada kartu buku -> buka Book Detail.
// Dipasang sekali di bookGrid (event delegation) supaya tetap
// berfungsi untuk kartu-kartu baru yang ditambahkan lewat form.
bookGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.book-card');
  if (!card) return;
  const action = event.target.closest('[data-action]');
  if (action) {
    const bookId = Number(card.dataset.id);
    if (action.dataset.action === 'edit') openEditBookModal(bookId);
    if (action.dataset.action === 'delete') deleteBook(bookId);
    return;
  }
  openBookDetail(Number(card.dataset.id));
});

bookGrid.addEventListener('keydown', (event) => {
  const card = event.target.closest('.book-card');
  if (!card) return;
  if (event.target.closest('[data-action]')) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openBookDetail(Number(card.dataset.id));
  }
});

// Render pertama kali saat halaman dimuat
renderBooks();


/* ===========================================================
   7. ADD BOOK MODAL — buka & tutup + simpan buku baru
   =========================================================== */
const addBookBtn = document.getElementById('add-book-btn');
const bookModalOverlay = document.getElementById('book-modal-overlay');
const bookModalCancelBtn = document.getElementById('book-modal-cancel-btn');
const addBookForm = document.getElementById('add-book-form');
const bookFormError = document.getElementById('book-form-error');
const bookModalTitle = document.getElementById('book-modal-title');
const bookModalSubmitBtn = document.getElementById('book-modal-submit-btn');

const titleInput = document.getElementById('book-title-input');
const authorInput = document.getElementById('book-author-input');
const coverInput = document.getElementById('book-cover-input');
const statusInput = document.getElementById('book-status-input');
const currentPageInput = document.getElementById('book-current-page-input');
const totalPagesInput = document.getElementById('book-total-pages-input');
let editingBookId = null;

function openBookModal() {
  editingBookId = null;
  bookModalTitle.textContent = 'Add Book';
  bookModalSubmitBtn.textContent = 'Add Book';
  bookModalOverlay.hidden = false;
  titleInput.focus();
}

function openEditBookModal(bookId) {
  const book = books.find((item) => item.id === bookId);
  if (!book) return;
  editingBookId = bookId;
  titleInput.value = book.title;
  authorInput.value = book.author;
  coverInput.value = book.cover || '📘';
  statusInput.value = book.status;
  currentPageInput.value = book.currentPage == null ? '' : book.currentPage;
  totalPagesInput.value = book.totalPages == null ? '' : book.totalPages;
  bookFormError.hidden = true;
  bookModalTitle.textContent = 'Edit Book';
  bookModalSubmitBtn.textContent = 'Save Changes';
  bookModalOverlay.hidden = false;
  titleInput.focus();
}

function closeBookModal() {
  bookModalOverlay.hidden = true;
  addBookForm.reset();
  bookFormError.hidden = true;
  editingBookId = null;
}

addBookBtn.addEventListener('click', openBookModal);
bookModalCancelBtn.addEventListener('click', closeBookModal);

bookModalOverlay.addEventListener('click', (event) => {
  if (event.target === bookModalOverlay) {
    closeBookModal();
  }
});

function showBookFormError(message) {
  bookFormError.textContent = message;
  bookFormError.hidden = false;
}

addBookForm.addEventListener('submit', (event) => {
  event.preventDefault(); // jangan reload halaman

  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  let status = statusInput.value;

  // Title & Author wajib diisi
  if (title === '' || author === '') {
    showBookFormError('Title and Author are required.');
    return;
  }

  let currentPage = null;
  let totalPages = null;

  if (status === 'Reading') {
    // Untuk status "Reading", Current Page & Total Pages wajib diisi
    if (currentPageInput.value === '' || totalPagesInput.value === '') {
      showBookFormError('Current Page and Total Pages are required when status is Reading.');
      return;
    }

    currentPage = Number(currentPageInput.value);
    totalPages = Number(totalPagesInput.value);

    if (currentPage < 0) {
      showBookFormError('Current Page cannot be negative.');
      return;
    }

    if (totalPages <= 0) {
      showBookFormError('Total Pages must be greater than 0.');
      return;
    }

    if (currentPage > totalPages) {
      showBookFormError('Current Page cannot be greater than Total Pages.');
      return;
    }

    if (currentPage === totalPages) status = 'Completed';
  } else {
    // Untuk status lain, field halaman bersifat opsional
    if (currentPageInput.value !== '') currentPage = Number(currentPageInput.value);
    if (totalPagesInput.value !== '') totalPages = Number(totalPagesInput.value);
    if (currentPage != null && currentPage < 0) {
      showBookFormError('Current Page cannot be negative.');
      return;
    }
    if (totalPages != null && totalPages <= 0) {
      showBookFormError('Total Pages must be greater than 0.');
      return;
    }
    if (currentPage != null && totalPages != null && currentPage > totalPages) {
      showBookFormError('Current Page cannot be greater than Total Pages.');
      return;
    }
  }

  // Semua validasi lolos -> tambahkan buku baru ke daftar
  const bookValues = {
    title,
    author,
    cover: coverInput.value.trim() || '📘',
    status,
    currentPage,
    totalPages,
  };
  const newBook = {
    id: getNextId(books),
    ...bookValues,
    dateAdded: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    vocabulary: [],
    quotes: [],
    notes: [],
  };

  persistMutation(
    () => {
      if (editingBookId === null) books.unshift(newBook);
      else Object.assign(books.find((book) => book.id === editingBookId), bookValues);
    },
    () => {
      renderBooks();
      refreshAggregateViews();
      closeBookModal();
    },
    () => {
      renderBooks();
      refreshAggregateViews();
    },
  );
});

function deleteBook(bookId) {
  const book = books.find((item) => item.id === bookId);
  if (!book || !confirm(`Delete "${book.title}" and all its saved knowledge? This action cannot be undone.`)) return false;
  const deletedBook = structuredClone(book);
  const didPersist = persistMutation(
    () => { books = books.filter((item) => item.id !== bookId); appState.books = books; },
    () => {
      if (currentBookId === bookId) { currentBookId = null; switchView('books'); }
      renderBooks();
      refreshAggregateViews();
      scheduleCloudDelete(deletedBook);
    },
    () => { renderBooks(); refreshAggregateViews(); },
  );
  return didPersist;
}


/* ===========================================================
   8. BOOK DETAIL — membuka & merender detail satu buku
   =========================================================== */

// Menyimpan id buku yang sedang dibuka di Book Detail
let currentBookId = null;

// Ambil object buku yang sedang dibuka. Dipakai oleh fitur
// Vocabulary (search, add, edit, delete, detail) supaya tidak
// perlu menulis ulang `books.find(...)` di setiap fungsi.
function getCurrentBook() {
  return books.find((b) => b.id === currentBookId);
}

function focusBookDetailItem(detailTab, itemId) {
  if (!itemId) return;

  const itemCard = document.querySelector(`#tab-${detailTab} [data-item-id="${itemId}"]`);
  if (!itemCard) return;

  const addedTabIndex = !itemCard.hasAttribute('tabindex');
  if (addedTabIndex) itemCard.tabIndex = -1;

  itemCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  itemCard.focus({ preventScroll: true });
  itemCard.classList.add('detail-card--highlighted');

  window.setTimeout(() => {
    itemCard.classList.remove('detail-card--highlighted');
    if (addedTabIndex) itemCard.removeAttribute('tabindex');
  }, 1600);
}

function openBookDetail(bookId, detailTab = 'vocabulary', itemId = null) {
  const book = books.find((b) => b.id === bookId);
  if (!book) return;

  currentBookId = bookId;
  renderBookDetail(book);
  switchDetailTab(detailTab);
  showView('view-book-detail', 'books'); // link "Books" tetap aktif
  focusBookDetailItem(detailTab, itemId);
}

function renderBookDetail(book) {
  document.getElementById('detail-cover').textContent = book.cover;
  document.getElementById('detail-title').textContent = book.title;
  document.getElementById('detail-author').textContent = book.author;

  const badge = document.getElementById('detail-badge');
  badge.textContent = book.status;
  badge.className = `book-card__badge ${getBadgeClass(book.status)}`;

  updateDetailProgress(book);

  // Buku yang dibuka bisa berbeda dari sebelumnya, jadi search
  // vocabulary dikosongkan supaya tidak membawa query lama.
  vocabSearchInput.value = '';
  renderVocabularyList(book);

  // Sama seperti vocabulary, search quotes juga dikosongkan.
  quoteSearchInput.value = '';
  renderQuotesList(book);

  renderNotesList(book);
}

// Menghitung ulang & menampilkan progress bar + teks halaman
// di header Book Detail. Dipanggil saat detail dibuka DAN
// setiap kali progress disimpan lewat modal Update Progress.
function updateDetailProgress(book) {
  const current = book.currentPage != null ? book.currentPage : 0;
  const total = book.totalPages != null ? book.totalPages : 0;
  const percent = calculatePercent(current, total);

  const badge = document.getElementById('detail-badge');
  badge.textContent = book.status;
  badge.className = `book-card__badge ${getBadgeClass(book.status)}`;
  document.getElementById('detail-progress-bar').style.width = `${percent}%`;
  document.getElementById('detail-progress-label').textContent = `Page ${current} of ${total}`;
  document.getElementById('detail-progress-percent').textContent = `${percent}%`;
  document.querySelector('#view-book-detail .progress').setAttribute('aria-valuenow', Math.round(percent));
}

document.getElementById('edit-book-detail-btn').addEventListener('click', () => openEditBookModal(currentBookId));
document.getElementById('delete-book-detail-btn').addEventListener('click', () => deleteBook(currentBookId));

// Tombol "← Back to Books"
document.getElementById('back-to-books-btn').addEventListener('click', () => {
  switchView('books');
});


/* ===========================================================
   9. BOOK DETAIL — tab Vocabulary / Quotes / Notes
   =========================================================== */
const detailTabButtons = document.querySelectorAll('.detail-tab');
const detailTabPanels = document.querySelectorAll('.detail-tab-panel');

function switchDetailTab(tabName) {
  detailTabButtons.forEach((btn) => {
    btn.classList.toggle('detail-tab--active', btn.dataset.tab === tabName);
  });

  detailTabPanels.forEach((panel) => {
    panel.hidden = panel.id !== `tab-${tabName}`;
  });
}

detailTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchDetailTab(btn.dataset.tab));
});


/* ===========================================================
   10. BOOK DETAIL — render list Vocabulary / Quotes / Notes
   =========================================================== */

// Search vocabulary: mencari berdasarkan word, meaning, dan context.
// Dipisah dari renderVocabularyList supaya bisa dipakai ulang.
const vocabSearchInput = document.getElementById('vocab-search-input');

function getFilteredVocabulary(book) {
  const query = vocabSearchInput.value.trim().toLowerCase();
  if (query === '') return book.vocabulary;

  return book.vocabulary.filter((item) => {
    const matchesWord = item.word.toLowerCase().includes(query);
    const matchesMeaning = item.meaning && item.meaning.toLowerCase().includes(query);
    const matchesContext = item.context && item.context.toLowerCase().includes(query);
    return matchesWord || matchesMeaning || matchesContext;
  });
}

function renderVocabularyList(book) {
  const grid = document.getElementById('vocabulary-grid');
  const empty = document.getElementById('vocabulary-empty');

  grid.innerHTML = '';

  const filteredVocabulary = getFilteredVocabulary(book);

  if (filteredVocabulary.length === 0) {
    // Pesan berbeda tergantung penyebabnya: belum ada data sama
    // sekali, atau hasil pencarian yang tidak ketemu.
    empty.textContent = book.vocabulary.length === 0
      ? 'No vocabulary yet.'
      : 'No vocabulary found.';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  filteredVocabulary.forEach((item) => {
    const card = document.createElement('article');
    // detail-card--clickable: menandai kartu ini bisa diklik untuk
    // membuka Vocabulary Detail (beda dari kartu Quotes/Notes).
    card.className = 'detail-card detail-card--clickable';
    card.dataset.id = item.id;
    card.dataset.itemId = item.id;
    card.tabIndex = 0; // agar bisa difokus dengan keyboard
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${item.word}`);

    const word = document.createElement('h3');
    word.className = 'detail-card__title';
    word.textContent = item.word;
    card.appendChild(word);

    if (item.partOfSpeech) {
      const pos = document.createElement('p');
      pos.className = 'detail-card__meta';
      pos.textContent = `Part of speech: ${item.partOfSpeech}`;
      card.appendChild(pos);
    }

    if (item.meaning) {
      const meaning = document.createElement('p');
      meaning.className = 'detail-card__meta';
      meaning.textContent = `Meaning: ${item.meaning}`;
      card.appendChild(meaning);
    }

    if (item.context) {
      const context = document.createElement('p');
      context.className = 'detail-card__meta';
      context.textContent = `Context: ${item.context}`;
      card.appendChild(context);
    }

    const page = document.createElement('p');
    page.className = 'detail-card__page';
    page.textContent = `Page ${item.page}`;
    card.appendChild(page);

    grid.appendChild(card);
  });
}

// Render ulang setiap kali user mengetik di search vocabulary
vocabSearchInput.addEventListener('input', () => {
  const book = getCurrentBook();
  if (book) renderVocabularyList(book);
});

// Klik (atau tekan Enter/Space) pada kartu vocabulary -> buka
// Vocabulary Detail. Dipasang sekali lewat event delegation supaya
// tetap berfungsi untuk kartu-kartu baru yang ditambahkan/diedit.
const vocabularyGrid = document.getElementById('vocabulary-grid');

vocabularyGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.detail-card--clickable');
  if (!card) return;
  openVocabDetail(Number(card.dataset.id));
});

vocabularyGrid.addEventListener('keydown', (event) => {
  const card = event.target.closest('.detail-card--clickable');
  if (!card) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openVocabDetail(Number(card.dataset.id));
  }
});

// Search quotes: mencari berdasarkan text dan context.
const quoteSearchInput = document.getElementById('quote-search-input');

function getFilteredQuotes(book) {
  const query = quoteSearchInput.value.trim().toLowerCase();
  if (query === '') return book.quotes;

  return book.quotes.filter((item) => {
    const matchesText = item.text.toLowerCase().includes(query);
    const matchesContext = item.context && item.context.toLowerCase().includes(query);
    return matchesText || matchesContext;
  });
}

function renderQuotesList(book) {
  const grid = document.getElementById('quotes-grid');
  const empty = document.getElementById('quotes-empty');
  const countLabel = document.getElementById('quotes-count');

  grid.innerHTML = '';

  // Jumlah quotes selalu mengikuti total data buku ini (bukan hasil
  // filter), supaya user tahu berapa banyak quote yang sebenarnya
  // tersimpan.
  const total = book.quotes.length;
  countLabel.textContent = `${total} ${total === 1 ? 'quote' : 'quotes'}`;

  const filteredQuotes = getFilteredQuotes(book);

  if (filteredQuotes.length === 0) {
    empty.textContent = total === 0 ? 'No quotes yet.' : 'No quotes found.';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  filteredQuotes.forEach((item) => {
    const card = document.createElement('article');
    // detail-card--clickable: klik kartu (di luar tombol Edit/Delete)
    // membuka Quote Detail.
    card.className = 'detail-card detail-card--clickable';
    card.dataset.id = item.id;
    card.dataset.itemId = item.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'View quote details');

    const quoteText = document.createElement('p');
    quoteText.className = 'detail-card__quote';
    quoteText.textContent = `"${item.text}"`;
    card.appendChild(quoteText);

    const page = document.createElement('p');
    page.className = 'detail-card__page';
    page.textContent = `Page ${item.page}`;
    card.appendChild(page);

    // Menu aksi Edit/Delete langsung di kartu
    const actions = document.createElement('div');
    actions.className = 'detail-card__actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'card-action-btn';
    editBtn.dataset.action = 'edit';
    editBtn.textContent = 'Edit';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'card-action-btn card-action-btn--danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = 'Delete';

    actions.append(editBtn, deleteBtn);
    card.appendChild(actions);

    grid.appendChild(card);
  });
}

// Render ulang setiap kali user mengetik di search quotes
quoteSearchInput.addEventListener('input', () => {
  const book = getCurrentBook();
  if (book) renderQuotesList(book);
});

// Klik pada kartu quote: kalau yang diklik tombol Edit/Delete,
// jalankan aksi itu (lalu berhenti). Kalau yang diklik bagian
// lain dari kartu, buka Quote Detail.
const quotesGrid = document.getElementById('quotes-grid');

quotesGrid.addEventListener('click', (event) => {
  const actionBtn = event.target.closest('[data-action]');

  if (actionBtn) {
    const card = actionBtn.closest('.detail-card');
    const quoteId = Number(card.dataset.id);

    if (actionBtn.dataset.action === 'edit') {
      startEditQuote(quoteId);
    } else if (actionBtn.dataset.action === 'delete') {
      deleteQuote(quoteId);
    }
    return; // jangan lanjut membuka Quote Detail
  }

  const card = event.target.closest('.detail-card--clickable');
  if (!card) return;
  openQuoteDetail(Number(card.dataset.id));
});

quotesGrid.addEventListener('keydown', (event) => {
  // Tombol Edit/Delete sudah menangani Enter/Space-nya sendiri
  if (event.target.closest('[data-action]')) return;

  const card = event.target.closest('.detail-card--clickable');
  if (!card) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openQuoteDetail(Number(card.dataset.id));
  }
});

function renderNotesList(book) {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');
  const countLabel = document.getElementById('notes-count');
  const noteSearchInput = document.getElementById('note-search-input');

  grid.innerHTML = '';

  const total = book.notes.length;
  countLabel.textContent = `${total} ${total === 1 ? 'note' : 'notes'}`;

  const query = noteSearchInput.value.trim().toLowerCase();
  const filteredNotes = query === ''
    ? book.notes
    : book.notes.filter((item) => {
      const matchesTitle = item.title.toLowerCase().includes(query);
      const matchesContent = item.content.toLowerCase().includes(query);
      return matchesTitle || matchesContent;
    });

  if (filteredNotes.length === 0) {
    empty.textContent = total === 0 ? 'No notes yet.' : 'No notes found.';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  filteredNotes.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'detail-card';
    card.dataset.id = item.id;
    card.dataset.itemId = item.id;

    const title = document.createElement('h3');
    title.className = 'detail-card__title';
    title.textContent = item.title ? item.title : 'Note';
    card.appendChild(title);

    const noteText = document.createElement('p');
    noteText.className = 'detail-card__meta';
    noteText.textContent = item.content;
    card.appendChild(noteText);

    if (item.page != null) {
      const page = document.createElement('p');
      page.className = 'detail-card__page';
      page.textContent = `Page ${item.page}`;
      card.appendChild(page);
    }

    const actions = document.createElement('div');
    actions.className = 'detail-card__actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'card-action-btn';
    editBtn.dataset.action = 'edit';
    editBtn.textContent = 'Edit';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'card-action-btn card-action-btn--danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = 'Delete';

    actions.append(editBtn, deleteBtn);
    card.appendChild(actions);

    grid.appendChild(card);
  });
}

const noteSearchInput = document.getElementById('note-search-input');

noteSearchInput.addEventListener('input', () => {
  const book = getCurrentBook();
  if (book) renderNotesList(book);
});

const notesGrid = document.getElementById('notes-grid');

notesGrid.addEventListener('click', (event) => {
  const actionBtn = event.target.closest('[data-action]');
  if (!actionBtn) return;

  const card = actionBtn.closest('.detail-card');
  const noteId = Number(card.dataset.id);

  if (actionBtn.dataset.action === 'edit') {
    startEditNote(noteId);
  } else if (actionBtn.dataset.action === 'delete') {
    deleteNote(noteId);
  }
});


/* ===========================================================
   11. UPDATE READING PROGRESS MODAL (Book Detail)
   =========================================================== */
const continueReadingDetailBtn = document.getElementById('continue-reading-detail-btn');
const progressModalOverlay = document.getElementById('progress-modal-overlay');
const progressModalCancelBtn = document.getElementById('progress-modal-cancel-btn');
const updateProgressForm = document.getElementById('update-progress-form');
const progressFormError = document.getElementById('progress-form-error');
const progressCurrentPageInput = document.getElementById('progress-current-page-input');
const progressTotalPagesInput = document.getElementById('progress-total-pages-input');

function openProgressModal() {
  const book = books.find((b) => b.id === currentBookId);
  if (!book) return;

  // Isi form dengan nilai yang sedang tersimpan supaya user tinggal mengubah
  progressCurrentPageInput.value = book.currentPage != null ? book.currentPage : '';
  progressTotalPagesInput.value = book.totalPages != null ? book.totalPages : '';
  progressFormError.hidden = true;

  progressModalOverlay.hidden = false;
  progressCurrentPageInput.focus();
}

function closeProgressModal() {
  progressModalOverlay.hidden = true;
  updateProgressForm.reset();
  progressFormError.hidden = true;
}

function showProgressFormError(message) {
  progressFormError.textContent = message;
  progressFormError.hidden = false;
}

continueReadingDetailBtn.addEventListener('click', openProgressModal);
progressModalCancelBtn.addEventListener('click', closeProgressModal);

progressModalOverlay.addEventListener('click', (event) => {
  if (event.target === progressModalOverlay) {
    closeProgressModal();
  }
});

updateProgressForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const book = books.find((b) => b.id === currentBookId);
  if (!book) return;

  const currentValue = progressCurrentPageInput.value;
  const totalValue = progressTotalPagesInput.value;

  // Current Page harus berupa angka
  if (currentValue === '' || Number.isNaN(Number(currentValue))) {
    showProgressFormError('Current Page must be a number.');
    return;
  }
  const current = Number(currentValue);

  // Current Page tidak boleh negatif
  if (current < 0) {
    showProgressFormError('Current Page cannot be negative.');
    return;
  }

  // Total Pages harus berupa angka dan lebih besar dari 0
  if (totalValue === '' || Number.isNaN(Number(totalValue))) {
    showProgressFormError('Total Pages must be a number.');
    return;
  }
  const total = Number(totalValue);

  if (total <= 0) {
    showProgressFormError('Total Pages must be greater than 0.');
    return;
  }

  // Current Page tidak boleh lebih besar dari Total Pages
  if (current > total) {
    showProgressFormError('Current Page cannot be greater than Total Pages.');
    return;
  }

  // Semua validasi lolos -> simpan & perbarui tampilan
  persistMutation(
    () => {
      book.currentPage = current;
      book.totalPages = total;
      book.lastReadAt = new Date().toISOString();
      if (current === total) book.status = 'Completed';
    },
    () => {
      updateDetailProgress(book);
      renderBooks(); // supaya kartu buku di halaman Books ikut ter-update
      refreshAggregateViews();
      closeProgressModal();
    },
    () => {
      const restoredBook = getCurrentBook();
      if (restoredBook) updateDetailProgress(restoredBook);
      renderBooks();
      refreshAggregateViews();
    },
  );
});


/* ===========================================================
   12. ADD / EDIT VOCABULARY MODAL (Book Detail)
   Modal ini dipakai untuk dua mode: tambah vocabulary baru, dan
   mengedit vocabulary yang sudah ada. Mode ditentukan oleh
   variabel `editingVocabId`: null berarti mode Add, berisi id
   berarti mode Edit.
   =========================================================== */
const addVocabularyBtn = document.getElementById('add-vocabulary-btn');
const vocabModalOverlay = document.getElementById('vocab-modal-overlay');
const vocabModalTitle = document.getElementById('vocab-modal-title');
const vocabModalSubmitBtn = document.getElementById('vocab-modal-submit-btn');
const vocabModalCancelBtn = document.getElementById('vocab-modal-cancel-btn');
const addVocabularyForm = document.getElementById('add-vocabulary-form');
const vocabFormError = document.getElementById('vocab-form-error');
const vocabWordInput = document.getElementById('vocab-word-input');
const vocabPosInput = document.getElementById('vocab-pos-input');
const vocabMeaningInput = document.getElementById('vocab-meaning-input');
const vocabPageInput = document.getElementById('vocab-page-input');
const vocabContextInput = document.getElementById('vocab-context-input');
const vocabPronunciationInput = document.getElementById('vocab-pronunciation-input');
const vocabSynonymsInput = document.getElementById('vocab-synonyms-input');
const vocabAntonymsInput = document.getElementById('vocab-antonyms-input');
const vocabChapterInput = document.getElementById('vocab-chapter-input');
const vocabOccurrenceDateInput = document.getElementById('vocab-occurrence-date-input');
const vocabPersonalNoteInput = document.getElementById('vocab-personal-note-input');
const vocabBookField = document.getElementById('vocab-book-field');
const vocabBookInput = document.getElementById('vocab-book-input');

// null = mode "Add Vocabulary". Diisi id item saat mode "Edit Vocabulary".
let editingVocabId = null;
let aggregateVocabAddMode = false;

function populateBookSelect(select) {
  select.innerHTML = '';
  books.forEach((book) => {
    const option = document.createElement('option');
    option.value = book.id;
    option.textContent = book.title;
    select.appendChild(option);
  });
}

function openAddVocabModal() {
  editingVocabId = null;
  aggregateVocabAddMode = false;
  addVocabularyForm.reset();
  vocabFormError.hidden = true;
  vocabBookField.hidden = true;
  vocabModalTitle.textContent = 'Add Vocabulary';
  vocabModalSubmitBtn.textContent = 'Save Vocabulary';

  vocabModalOverlay.hidden = false;
  vocabWordInput.focus();
}

function openKnowledgeVocabModal() {
  openAddVocabModal();
  aggregateVocabAddMode = true;
  populateBookSelect(vocabBookInput);
  vocabBookField.hidden = false;
  vocabWordInput.focus();
}

function openAggregateVocabModal() {
  openKnowledgeVocabModal();
}

function openEditVocabModal(item) {
  editingVocabId = item.id;
  aggregateVocabAddMode = false;
  vocabFormError.hidden = true;
  vocabBookField.hidden = true;
  vocabModalTitle.textContent = 'Edit Vocabulary';
  vocabModalSubmitBtn.textContent = 'Update Vocabulary';

  // Isi form dengan data vocabulary yang sedang diedit
  vocabWordInput.value = item.word;
  vocabPosInput.value = item.partOfSpeech || '';
  vocabMeaningInput.value = item.meaning || '';
  vocabPageInput.value = item.page;
  vocabContextInput.value = item.context || '';
  vocabPronunciationInput.value = item.pronunciation || '';
  vocabSynonymsInput.value = item.synonyms || '';
  vocabAntonymsInput.value = item.antonyms || '';
  vocabChapterInput.value = item.chapter || '';
  vocabOccurrenceDateInput.value = item.occurrenceDate || '';
  vocabPersonalNoteInput.value = item.personalNote || '';

  vocabModalOverlay.hidden = false;
  vocabWordInput.focus();
}

function closeVocabModal() {
  vocabModalOverlay.hidden = true;
  addVocabularyForm.reset();
  vocabFormError.hidden = true;
  editingVocabId = null;
  aggregateVocabAddMode = false;
  vocabBookField.hidden = true;
}

function showVocabFormError(message) {
  vocabFormError.textContent = message;
  vocabFormError.hidden = false;
}

addVocabularyBtn.addEventListener('click', openAddVocabModal);
aggregateAddVocabularyBtn.addEventListener('click', openAggregateVocabModal);
vocabModalCancelBtn.addEventListener('click', closeVocabModal);

vocabModalOverlay.addEventListener('click', (event) => {
  if (event.target === vocabModalOverlay) {
    closeVocabModal();
  }
});

addVocabularyForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const book = getCurrentBook();
  const targetBook = aggregateVocabAddMode
    ? books.find((item) => item.id === Number(vocabBookInput.value))
    : book;
  if (!targetBook) return;

  const word = vocabWordInput.value.trim();
  const partOfSpeech = vocabPosInput.value; // opsional, boleh ""
  const meaning = vocabMeaningInput.value.trim();
  const pageValue = vocabPageInput.value;
  const context = vocabContextInput.value.trim(); // opsional
  const pronunciation = vocabPronunciationInput.value.trim();
  const synonyms = vocabSynonymsInput.value.trim();
  const antonyms = vocabAntonymsInput.value.trim();
  const chapter = vocabChapterInput.value.trim();
  const occurrenceDate = vocabOccurrenceDateInput.value;
  const personalNote = vocabPersonalNoteInput.value.trim();

  // Word wajib diisi
  if (word === '') {
    showVocabFormError('Word is required.');
    return;
  }

  if (meaning === '') {
    showVocabFormError('Meaning is required.');
    return;
  }

  let page = null;
  if (pageValue !== '') {
    if (Number.isNaN(Number(pageValue))) {
      showVocabFormError('Page must be a number.');
      return;
    }
    page = Number(pageValue);
    if (page < 0) {
      showVocabFormError('Page cannot be negative.');
      return;
    }
  }

  persistMutation(
    () => {
      if (editingVocabId === null) {
        // Mode Add -> buat entry vocabulary baru
        targetBook.vocabulary.push({
          id: getNextId(getAllItems('vocabulary')),
          createdAt: new Date().toISOString(),
          word,
          partOfSpeech,
          meaning,
          page,
          context,
          pronunciation,
          synonyms,
          antonyms,
          chapter,
          occurrenceDate,
          personalNote,
        });
      } else {
        // Mode Edit -> perbarui entry vocabulary yang sudah ada
        const existingItem = targetBook.vocabulary.find((v) => v.id === editingVocabId);
        if (existingItem) {
          existingItem.word = word;
          existingItem.partOfSpeech = partOfSpeech;
          existingItem.meaning = meaning;
          existingItem.page = page;
          existingItem.context = context;
          existingItem.pronunciation = pronunciation;
          existingItem.synonyms = synonyms;
          existingItem.antonyms = antonyms;
          existingItem.chapter = chapter;
          existingItem.occurrenceDate = occurrenceDate;
          existingItem.personalNote = personalNote;
        }
      }
    },
    () => {
      if (book) renderVocabularyList(book);
      refreshAggregateViews();
      closeVocabModal();
    },
    () => {
      const restoredBook = getCurrentBook();
      if (restoredBook) renderVocabularyList(restoredBook);
      refreshAggregateViews();
    },
  );
});


/* ===========================================================
   12b. VOCABULARY DETAIL MODAL (Book Detail)
   Menampilkan satu vocabulary secara lengkap (read-only), dengan
   tombol untuk masuk ke mode Edit atau menghapusnya (dengan
   konfirmasi terlebih dahulu).
   =========================================================== */
const vocabDetailModalOverlay = document.getElementById('vocab-detail-modal-overlay');
const vocabDetailTitle = document.getElementById('vocab-detail-title');
const vocabDetailPos = document.getElementById('vocab-detail-pos');
const vocabDetailMeaning = document.getElementById('vocab-detail-meaning');
const vocabDetailBook = document.getElementById('vocab-detail-book');
const vocabDetailPage = document.getElementById('vocab-detail-page');
const vocabDetailContext = document.getElementById('vocab-detail-context');
const vocabDetailCloseBtn = document.getElementById('vocab-detail-close-btn');
const vocabDetailEditBtn = document.getElementById('vocab-detail-edit-btn');
const vocabDetailDeleteBtn = document.getElementById('vocab-detail-delete-btn');

// Menyimpan id vocabulary yang sedang ditampilkan di modal detail
let viewingVocabId = null;

function openVocabDetail(vocabId) {
  const book = getCurrentBook();
  if (!book) return;

  const item = book.vocabulary.find((v) => v.id === vocabId);
  if (!item) return;

  viewingVocabId = vocabId;

  vocabDetailTitle.textContent = item.word;
  vocabDetailPos.textContent = item.partOfSpeech || '-';
  vocabDetailMeaning.textContent = item.meaning || '-';
  vocabDetailBook.textContent = book.title;
  vocabDetailPage.textContent = item.page;
  vocabDetailContext.textContent = item.context || '-';

  vocabDetailModalOverlay.hidden = false;
  vocabDetailCloseBtn.focus();
}

function closeVocabDetailModal() {
  vocabDetailModalOverlay.hidden = true;
  viewingVocabId = null;
  if (detailReturnToSearch) returnToGlobalSearch();
}

vocabDetailCloseBtn.addEventListener('click', closeVocabDetailModal);

vocabDetailModalOverlay.addEventListener('click', (event) => {
  if (event.target === vocabDetailModalOverlay) {
    closeVocabDetailModal();
  }
});

// Tombol Edit di modal detail -> tutup modal detail, buka modal
// Edit Vocabulary dengan data yang sama.
vocabDetailEditBtn.addEventListener('click', () => {
  const book = getCurrentBook();
  if (!book) return;

  const item = book.vocabulary.find((v) => v.id === viewingVocabId);
  if (!item) return;

  closeVocabDetailModal();
  openEditVocabModal(item);
});

// Tombol Delete di modal detail -> minta konfirmasi dulu sebelum
// benar-benar menghapus data dari array.
vocabDetailDeleteBtn.addEventListener('click', () => {
  const book = getCurrentBook();
  if (!book) return;

  const item = book.vocabulary.find((v) => v.id === viewingVocabId);
  if (!item) return;

  const confirmed = confirm(`Delete "${item.word}"? This action cannot be undone.`);
  if (!confirmed) return;

  persistMutation(
    () => {
      book.vocabulary = book.vocabulary.filter((v) => v.id !== viewingVocabId);
    },
    () => {
      renderVocabularyList(book);
      refreshAggregateViews();
      closeVocabDetailModal();
    },
    () => {
      const restoredBook = getCurrentBook();
      if (restoredBook) renderVocabularyList(restoredBook);
      refreshAggregateViews();
    },
  );
});


/* ===========================================================
   13. ADD / EDIT QUOTE MODAL (Book Detail)
   Sama seperti modal Vocabulary: satu modal dipakai untuk dua
   mode. `editingQuoteId` null berarti mode Add, berisi id berarti
   mode Edit.
   =========================================================== */
const addQuoteBtn = document.getElementById('add-quote-btn');
const quoteModalOverlay = document.getElementById('quote-modal-overlay');
const quoteModalTitle = document.getElementById('quote-modal-title');
const quoteModalSubmitBtn = document.getElementById('quote-modal-submit-btn');
const quoteModalCancelBtn = document.getElementById('quote-modal-cancel-btn');
const addQuoteForm = document.getElementById('add-quote-form');
const quoteFormError = document.getElementById('quote-form-error');
const quoteTextInput = document.getElementById('quote-text-input');
const quotePageInput = document.getElementById('quote-page-input');
const quoteContextInput = document.getElementById('quote-context-input');
const quoteChapterInput = document.getElementById('quote-chapter-input');
const quoteReflectionInput = document.getElementById('quote-reflection-input');
const quoteBookField = document.getElementById('quote-book-field');
const quoteBookInput = document.getElementById('quote-book-input');

// null = mode "Add Quote". Diisi id item saat mode "Edit Quote".
let editingQuoteId = null;
let aggregateQuoteAddMode = false;

function openAddQuoteModal() {
  editingQuoteId = null;
  aggregateQuoteAddMode = false;
  addQuoteForm.reset();
  quoteFormError.hidden = true;
  quoteBookField.hidden = true;
  quoteModalTitle.textContent = 'Add Quote';
  quoteModalSubmitBtn.textContent = 'Save Quote';

  quoteModalOverlay.hidden = false;
  quoteTextInput.focus();
}

function openAggregateQuoteModal() {
  openAddQuoteModal();
  aggregateQuoteAddMode = true;
  populateBookSelect(quoteBookInput);
  quoteBookField.hidden = false;
  quoteTextInput.focus();
}

function openEditQuoteModal(item) {
  editingQuoteId = item.id;
  aggregateQuoteAddMode = false;
  quoteFormError.hidden = true;
  quoteBookField.hidden = true;
  quoteModalTitle.textContent = 'Edit Quote';
  quoteModalSubmitBtn.textContent = 'Update Quote';

  quoteTextInput.value = item.text;
  quotePageInput.value = item.page;
  quoteContextInput.value = item.context || '';
  quoteChapterInput.value = item.chapter || '';
  quoteReflectionInput.value = item.reflection || '';

  quoteModalOverlay.hidden = false;
  quoteTextInput.focus();
}

// Dipanggil dari tombol "Edit" pada kartu quote: cari itemnya
// dulu berdasarkan id, baru buka modal Edit.
function startEditQuote(quoteId) {
  const book = getCurrentBook();
  if (!book) return;

  const item = book.quotes.find((q) => q.id === quoteId);
  if (!item) return;

  openEditQuoteModal(item);
}

function closeQuoteModal() {
  quoteModalOverlay.hidden = true;
  addQuoteForm.reset();
  quoteFormError.hidden = true;
  editingQuoteId = null;
  aggregateQuoteAddMode = false;
  quoteBookField.hidden = true;
}

function showQuoteFormError(message) {
  quoteFormError.textContent = message;
  quoteFormError.hidden = false;
}

addQuoteBtn.addEventListener('click', openAddQuoteModal);
aggregateAddQuoteBtn.addEventListener('click', openAggregateQuoteModal);
quoteModalCancelBtn.addEventListener('click', closeQuoteModal);

quoteModalOverlay.addEventListener('click', (event) => {
  if (event.target === quoteModalOverlay) {
    closeQuoteModal();
  }
});

addQuoteForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const book = getCurrentBook();
  const targetBook = aggregateQuoteAddMode
    ? books.find((item) => item.id === Number(quoteBookInput.value))
    : book;
  if (!targetBook) return;

  const text = quoteTextInput.value.trim();
  const pageValue = quotePageInput.value;
  const context = quoteContextInput.value.trim(); // opsional
  const chapter = quoteChapterInput.value.trim();
  const reflection = quoteReflectionInput.value.trim();

  // Quote wajib diisi
  if (text === '') {
    showQuoteFormError('Quote is required.');
    return;
  }

  let page = null;
  if (pageValue !== '') {
    if (Number.isNaN(Number(pageValue))) {
      showQuoteFormError('Page must be a number.');
      return;
    }
    page = Number(pageValue);
    if (page < 0) {
      showQuoteFormError('Page cannot be negative.');
      return;
    }
  }

  persistMutation(
    () => {
      if (editingQuoteId === null) {
        // Mode Add -> buat quote baru, terkait ke buku ini lewat bookId
        targetBook.quotes.push({
          id: getNextId(getAllItems('quotes')),
          bookId: targetBook.id,
          createdAt: new Date().toISOString(),
          text,
          page,
          context,
          chapter,
          reflection,
        });
      } else {
        // Mode Edit -> perbarui quote yang sudah ada
        const existingItem = targetBook.quotes.find((q) => q.id === editingQuoteId);
        if (existingItem) {
          existingItem.text = text;
          existingItem.page = page;
          existingItem.context = context;
          existingItem.chapter = chapter;
          existingItem.reflection = reflection;
        }
      }
    },
    () => {
      if (book) renderQuotesList(book);
      refreshAggregateViews();
      closeQuoteModal();
    },
    () => {
      const restoredBook = getCurrentBook();
      if (restoredBook) renderQuotesList(restoredBook);
      refreshAggregateViews();
    },
  );
});

// Delete quote (dipanggil dari tombol "Delete" pada kartu) —
// selalu minta konfirmasi dulu sebelum benar-benar menghapus.
function deleteQuote(quoteId) {
  const book = getCurrentBook();
  if (!book) return false;

  const item = book.quotes.find((q) => q.id === quoteId);
  if (!item) return false;

  const confirmed = confirm('Delete this quote? This action cannot be undone.');
  if (!confirmed) return false;

  const didPersist = persistMutation(
    () => {
      book.quotes = book.quotes.filter((q) => q.id !== quoteId);
    },
    () => {
      renderQuotesList(book);
      refreshAggregateViews();
    },
    () => {
      const restoredBook = getCurrentBook();
      if (restoredBook) renderQuotesList(restoredBook);
      refreshAggregateViews();
    },
  );
  return didPersist;
}


/* ===========================================================
   13b. QUOTE DETAIL MODAL (Book Detail)
   Menampilkan satu quote secara lengkap (read-only): Book, Quote,
   Page, dan Context, dengan tombol Back untuk kembali ke daftar.
   =========================================================== */
const quoteDetailModalOverlay = document.getElementById('quote-detail-modal-overlay');
const quoteDetailBook = document.getElementById('quote-detail-book');
const quoteDetailText = document.getElementById('quote-detail-text');
const quoteDetailPage = document.getElementById('quote-detail-page');
const quoteDetailContext = document.getElementById('quote-detail-context');
const quoteDetailBackBtn = document.getElementById('quote-detail-back-btn');
const quoteDetailEditBtn = document.getElementById('quote-detail-edit-btn');
const quoteDetailDeleteBtn = document.getElementById('quote-detail-delete-btn');

let viewingQuoteId = null;

function openQuoteDetail(quoteId) {
  const book = getCurrentBook();
  if (!book) return;

  const item = book.quotes.find((q) => q.id === quoteId);
  if (!item) return;

  viewingQuoteId = quoteId;
  quoteDetailBook.textContent = book.title;
  quoteDetailText.textContent = `"${item.text}"`;
  quoteDetailPage.textContent = item.page;
  quoteDetailContext.textContent = item.context || '-';

  quoteDetailModalOverlay.hidden = false;
  quoteDetailBackBtn.focus();
}

function closeQuoteDetailModal() {
  quoteDetailModalOverlay.hidden = true;
  viewingQuoteId = null;
  if (detailReturnToSearch) returnToGlobalSearch();
}

quoteDetailBackBtn.addEventListener('click', closeQuoteDetailModal);

quoteDetailEditBtn.addEventListener('click', () => {
  const book = getCurrentBook();
  if (!book) return;

  const item = book.quotes.find((quote) => quote.id === viewingQuoteId);
  if (!item) return;

  closeQuoteDetailModal();
  openEditQuoteModal(item);
});

quoteDetailDeleteBtn.addEventListener('click', () => {
  const quoteId = viewingQuoteId;
  if (quoteId == null) return;

  if (deleteQuote(quoteId)) closeQuoteDetailModal();
});

quoteDetailModalOverlay.addEventListener('click', (event) => {
  if (event.target === quoteDetailModalOverlay) {
    closeQuoteDetailModal();
  }
});


/* ===========================================================
   13c. NOTE DETAIL MODAL (Global Search)
   =========================================================== */
const noteDetailModalOverlay = document.getElementById('note-detail-modal-overlay');
const noteDetailTitle = document.getElementById('note-detail-title');
const noteDetailBook = document.getElementById('note-detail-book');
const noteDetailContent = document.getElementById('note-detail-content');
const noteDetailPage = document.getElementById('note-detail-page');
const noteDetailBackBtn = document.getElementById('note-detail-back-btn');
const noteDetailEditBtn = document.getElementById('note-detail-edit-btn');
const noteDetailDeleteBtn = document.getElementById('note-detail-delete-btn');

let viewingNoteId = null;

function openNoteDetail(noteId) {
  const book = getCurrentBook();
  if (!book) return;

  const note = book.notes.find((item) => item.id === noteId);
  if (!note) return;

  viewingNoteId = noteId;
  noteDetailTitle.textContent = note.title || 'Note';
  noteDetailBook.textContent = book.title;
  noteDetailContent.textContent = note.content;
  noteDetailPage.textContent = note.page == null ? '-' : note.page;

  noteDetailModalOverlay.hidden = false;
  noteDetailBackBtn.focus();
}

function closeNoteDetailModal() {
  noteDetailModalOverlay.hidden = true;
  viewingNoteId = null;
  if (detailReturnToSearch) returnToGlobalSearch();
}

noteDetailBackBtn.addEventListener('click', closeNoteDetailModal);

noteDetailEditBtn.addEventListener('click', () => {
  const book = getCurrentBook();
  if (!book) return;

  const note = book.notes.find((item) => item.id === viewingNoteId);
  if (!note) return;

  closeNoteDetailModal();
  openEditNoteModal(note);
});

noteDetailDeleteBtn.addEventListener('click', () => {
  const noteId = viewingNoteId;
  if (noteId == null) return;

  if (deleteNote(noteId)) closeNoteDetailModal();
});

noteDetailModalOverlay.addEventListener('click', (event) => {
  if (event.target === noteDetailModalOverlay) {
    closeNoteDetailModal();
  }
});


/* ===========================================================
   14. ADD NOTE MODAL (Book Detail)
   =========================================================== */
const addNoteBtn = document.getElementById('add-note-btn');
const noteModalOverlay = document.getElementById('note-modal-overlay');
const noteModalCancelBtn = document.getElementById('note-modal-cancel-btn');
const addNoteForm = document.getElementById('add-note-form');
const noteFormError = document.getElementById('note-form-error');
const noteTitleInput = document.getElementById('note-title-input');
const noteTextInput = document.getElementById('note-text-input');
const notePageInput = document.getElementById('note-page-input');
const noteChapterInput = document.getElementById('note-chapter-input');
const noteBookField = document.getElementById('note-book-field');
const noteBookInput = document.getElementById('note-book-input');

let editingNoteId = null;
let aggregateNoteAddMode = false;

function openNoteModal() {
  editingNoteId = null;
  aggregateNoteAddMode = false;
  addNoteForm.reset();
  noteFormError.hidden = true;
  noteBookField.hidden = true;
  document.getElementById('note-modal-title').textContent = 'Add Note';
  noteModalOverlay.hidden = false;
  noteTextInput.focus();
}

function openAggregateNoteModal() {
  openNoteModal();
  aggregateNoteAddMode = true;
  populateBookSelect(noteBookInput);
  noteBookField.hidden = false;
  noteTextInput.focus();
}

function openEditNoteModal(note) {
  editingNoteId = note.id;
  aggregateNoteAddMode = false;
  noteFormError.hidden = true;
  noteBookField.hidden = true;
  document.getElementById('note-modal-title').textContent = 'Edit Note';
  noteTitleInput.value = note.title;
  noteTextInput.value = note.content;
  notePageInput.value = note.page == null ? '' : note.page;
  noteChapterInput.value = note.chapter || '';
  noteModalOverlay.hidden = false;
  noteTextInput.focus();
}

function closeNoteModal() {
  noteModalOverlay.hidden = true;
  addNoteForm.reset();
  noteFormError.hidden = true;
  editingNoteId = null;
  aggregateNoteAddMode = false;
  noteBookField.hidden = true;
}

function showNoteFormError(message) {
  noteFormError.textContent = message;
  noteFormError.hidden = false;
}

addNoteBtn.addEventListener('click', openNoteModal);
noteModalCancelBtn.addEventListener('click', closeNoteModal);

noteModalOverlay.addEventListener('click', (event) => {
  if (event.target === noteModalOverlay) {
    closeNoteModal();
  }
});

addNoteForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const book = books.find((b) => b.id === currentBookId);
  const targetBook = aggregateNoteAddMode
    ? books.find((item) => item.id === Number(noteBookInput.value))
    : book;
  if (!targetBook) return;

  const title = noteTitleInput.value.trim(); // optional
  const noteText = noteTextInput.value.trim();
  const pageValue = notePageInput.value; // optional
  const chapter = noteChapterInput.value.trim();

  // Note wajib diisi
  if (noteText === '') {
    showNoteFormError('Note is required.');
    return;
  }

  // Page opsional, tapi jika diisi harus berupa angka
  let page = null;
  if (pageValue !== '') {
    if (Number.isNaN(Number(pageValue))) {
      showNoteFormError('Page must be a number.');
      return;
    }
    page = Number(pageValue);

    if (page < 0) {
      showNoteFormError('Page cannot be negative.');
      return;
    }
  }

  persistMutation(
    () => {
      if (editingNoteId === null) {
        targetBook.notes.push({
          id: getNextId(getAllItems('notes')),
          bookId: targetBook.id,
          createdAt: new Date().toISOString(),
          title,
          content: noteText,
          page,
          chapter,
        });
      } else {
        const existingNote = book.notes.find((item) => item.id === editingNoteId);
        if (existingNote) {
          existingNote.title = title;
          existingNote.content = noteText;
          existingNote.page = page;
          existingNote.chapter = chapter;
        }
      }
    },
    () => {
      if (book) renderNotesList(book);
      refreshAggregateViews();
      closeNoteModal();
    },
    () => {
      const restoredBook = getCurrentBook();
      if (restoredBook) renderNotesList(restoredBook);
      refreshAggregateViews();
    },
  );
});

function startEditNote(noteId) {
  const book = getCurrentBook();
  if (!book) return;

  const note = book.notes.find((item) => item.id === noteId);
  if (!note) return;

  openEditNoteModal(note);
}

function deleteNote(noteId) {
  const book = getCurrentBook();
  if (!book) return false;

  const note = book.notes.find((item) => item.id === noteId);
  if (!note) return false;

  const confirmed = confirm('Delete this note?');
  if (!confirmed) return false;

  const didPersist = persistMutation(
    () => {
      book.notes = book.notes.filter((item) => item.id !== noteId);
    },
    () => {
      renderNotesList(book);
      refreshAggregateViews();
    },
    () => {
      const restoredBook = getCurrentBook();
      if (restoredBook) renderNotesList(restoredBook);
      refreshAggregateViews();
    },
  );
  return didPersist;
}


/* ===========================================================
   15. TUTUP MODAL DENGAN TOMBOL ESCAPE
   Satu listener untuk semua modal di aplikasi ini, supaya
   menekan Escape selalu menutup modal mana pun yang sedang
   terbuka.
   =========================================================== */
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  if (!modalOverlay.hidden) closeModal();
  if (!bookModalOverlay.hidden) closeBookModal();
  if (!progressModalOverlay.hidden) closeProgressModal();
  if (!vocabModalOverlay.hidden) closeVocabModal();
  if (!vocabDetailModalOverlay.hidden) closeVocabDetailModal();
  if (!quoteModalOverlay.hidden) closeQuoteModal();
  if (!quoteDetailModalOverlay.hidden) closeQuoteDetailModal();
  if (!noteDetailModalOverlay.hidden) closeNoteDetailModal();
  if (!noteModalOverlay.hidden) closeNoteModal();
  if (!settingsModalOverlay.hidden) closeSettings();
});
