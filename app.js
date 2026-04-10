import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyDQd19bmnymib4m1W431SI2NCrQXqkWlKU",
  authDomain: "stock-management-efa39.firebaseapp.com",
  projectId: "stock-management-efa39",
  storageBucket: "stock-management-efa39.firebasestorage.app",
  messagingSenderId: "800243017147",
  appId: "1:800243017147:web:d28e84e39e6474baa0109e",
  measurementId: "G-8CP2JFXTHH"
};

const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authMessage = document.getElementById('auth-message');
const loadbar = document.getElementById('loadbar');
const loadbarText = document.getElementById('loadbar-text');
const resetHint = document.getElementById('reset-hint');
const cssEscape = window.CSS?.escape || (value => String(value).replace(/["\\]/g, '\\$&'));

const defaults = {
  shopName: 'StockFlow',
  description: 'Track stock, billing, customers, and notes in one workspace.',
  darkMode: false,
  multiAccountEnabled: false
};

const state = {
  user: null,
  settings: { ...defaults },
  products: [],
  reorders: [],
  invoices: [],
  creditCustomers: [],
  sellers: [],
  linkedAccounts: [],
  notes: [],
  gallaryItems: [],
  billingQuantities: {},
  productEditingId: null,
  reorderEditingId: null,
  noteEditingId: null,
  gallaryEditingId: null,
  stockSearchQuery: '',
  reorderSearchQuery: '',
  creditSearchQuery: '',
  notesSearchQuery: '',
  gallarySearchQuery: '',
  billingSearchQuery: '',
  invoiceSearchQuery: '',
  tempCreditId: 0
};

const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
let auth = null;
let db = null;
let loadingDepth = 0;
const resetCooldowns = new Map();
const resetCooldownMs = 60 * 1000;



function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(value) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

function toDate(value) {
  if (!value) return new Date(0);
  if (typeof value === 'string') return new Date(value);
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

function dateLabel(value) {
  return toDate(value).toLocaleString();
}

function setAuthMessage(message) {
  authMessage.textContent = message || '';
}

function setResetHint(message, visible = true) {
  if (!resetHint) return;
  resetHint.textContent = message || '';
  resetHint.classList.toggle('hidden', !visible);
}

function showAuthForm(formId) {
  document.querySelectorAll('#auth-view .form').forEach(form => form.classList.add('hidden'));
  document.querySelectorAll('#auth-view .tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(formId)?.classList.remove('hidden');

  if (formId === 'register-form') {
    document.getElementById('show-register')?.classList.add('active');
  } else if (formId === 'login-form') {
    document.getElementById('show-login')?.classList.add('active');
  }

  const forgotButton = document.getElementById('forgot-password-btn');
  if (forgotButton) {
    forgotButton.classList.toggle('hidden', formId !== 'login-form');
  }

  if (formId !== 'reset-form') {
    setResetHint('', false);
  }
}

function setLoadingState(isLoading, label = 'Loading...') {
  if (!loadbar) return;
  loadbar.classList.toggle('hidden', !isLoading);
  if (loadbarText && label) {
    loadbarText.textContent = label;
  }
}

function beginLoading(label) {
  loadingDepth += 1;
  setLoadingState(true, label);
}

function endLoading() {
  loadingDepth = Math.max(0, loadingDepth - 1);
  if (loadingDepth === 0) {
    setLoadingState(false);
  }
}

async function withLoading(task, label) {
  beginLoading(label);
  try {
    return await task();
  } finally {
    endLoading();
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function getResetCooldownRemaining(email) {
  const key = String(email || '').trim().toLowerCase();
  const nextAllowed = resetCooldowns.get(key) || 0;
  return Math.max(0, nextAllowed - Date.now());
}

function setResetCooldown(email) {
  const key = String(email || '').trim().toLowerCase();
  resetCooldowns.set(key, Date.now() + resetCooldownMs);
}

function showAuth() {
  authView.classList.remove('hidden');
  appView.classList.add('hidden');
}

function showApp() {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
}

function applyTheme() {
  document.body.classList.toggle('dark-mode', !!state.settings.darkMode);
}

function setActivePanel(viewId) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
  document.querySelectorAll('.panel').forEach(panel => panel.classList.add('hidden'));
  document.getElementById(viewId)?.classList.remove('hidden');
}

function requireFirebase() {
  if (!firebaseReady) {
    throw new Error('Paste your Firebase config into app.js first.');
  }
}

function requireUser() {
  if (!state.user) {
    throw new Error('Please sign in first.');
  }
}

function userCollection(name) {
  return collection(db, 'users', state.user.uid, name);
}

function userDoc(collectionName, id) {
  return doc(db, 'users', state.user.uid, collectionName, id);
}

function settingsDoc() {
  return doc(db, 'users', state.user.uid, 'meta', 'settings');
}

async function loadCollection(name, sortField = 'createdAt', direction = 'desc') {
  requireUser();
  const snap = await getDocs(query(userCollection(name), orderBy(sortField, direction)));
  return snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function loadSettings() {
  requireUser();
  const ref = settingsDoc();
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const payload = {
      ...defaults,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(ref, payload);
    return payload;
  }
  return { ...defaults, ...snap.data() };
}

async function seedUserDefaults() {
  const sellersSnap = await getDocs(userCollection('sellers'));
  if (sellersSnap.empty) {
    await addDoc(userCollection('sellers'), {
      name: 'Main',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

function getLowStockProducts(products) {
  return products.filter(product => Number(product.quantity || 0) <= Number(product.minimumQuantity || 0));
}

function renderWidgetList(el, rows) {
  el.innerHTML = '';
  if (!rows.length) {
    el.innerHTML = '<div class="widget-empty">No data available yet.</div>';
    return;
  }

  rows.forEach(row => {
    const item = document.createElement('div');
    item.className = 'widget-item';
    item.innerHTML = `<div><strong>${esc(row.title)}</strong><div class="meta">${esc(row.meta || '')}</div></div><div><strong>${esc(row.value)}</strong></div>`;
    el.appendChild(item);
  });
}

function renderDashboard() {
  const shopName = (state.settings.shopName || '').trim();
  const description = (state.settings.description || '').trim();

  document.getElementById('dashboard-shop-title').textContent = shopName || 'Business Dashboard';
  document.getElementById('dashboard-shop-subtitle').textContent = description || defaults.description;

  const totalProducts = state.products.length;
  const totalCustomers = state.creditCustomers.filter(customer => customer.id).length;
  const totalInvoices = state.invoices.length;
  const totalRevenue = state.invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySales = state.invoices
    .filter(invoice => toDate(invoice.createdAt) >= today)
    .reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);

  const averageInvoice = totalInvoices ? totalRevenue / totalInvoices : 0;
  const lowStock = getLowStockProducts(state.products);

  const cards = document.getElementById('summary-cards');
  cards.innerHTML = '';

  [
    { label: 'Stocks', value: totalProducts },
    { label: 'Credit Customers', value: totalCustomers },
    { label: 'Invoices', value: totalInvoices },
    { label: 'Total Sales', value: formatMoney(totalRevenue) },
    { label: "Today's Sales", value: formatMoney(todaySales) },
    { label: 'Average Invoice', value: formatMoney(averageInvoice) },
    { label: 'Low Stock Items', value: lowStock.length }
  ].forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="label">${esc(item.label)}</div><div class="value">${esc(item.value)}</div>`;
    cards.appendChild(card);
  });

  const recentInvoices = [...state.invoices]
    .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt))
    .slice(0, 5)
    .map(invoice => ({
      title: `#${invoice.id} - ${invoice.customerName || 'Walk-in'}`,
      meta: dateLabel(invoice.createdAt),
      value: formatMoney(invoice.totalAmount)
    }));

  const lowStockItems = [...lowStock]
    .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
    .slice(0, 5)
    .map(product => ({
      title: product.name,
      meta: `Min: ${product.minimumQuantity}`,
      value: `${product.quantity} left`
    }));

  const customerTotals = {};
  state.invoices.forEach(invoice => {
    const name = invoice.customerName || 'Walk-in';
    customerTotals[name] = (customerTotals[name] || 0) + Number(invoice.totalAmount || 0);
  });

  const topCustomers = Object.entries(customerTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({
      title: name,
      meta: 'Total billed',
      value: formatMoney(total)
    }));

  renderWidgetList(document.getElementById('dashboard-recent-invoices'), recentInvoices);
  renderWidgetList(document.getElementById('dashboard-low-stock'), lowStockItems);
  renderWidgetList(document.getElementById('dashboard-top-customers'), topCustomers);
}

function renderProducts() {
  const tbody = document.getElementById('product-table');
  const queryText = state.stockSearchQuery.trim().toLowerCase();
  const filtered = state.products.filter(product => {
    if (!queryText) return true;
    return (product.name || '').toLowerCase().includes(queryText) || (product.category || '').toLowerCase().includes(queryText);
  });

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9">No stock items found.</td></tr>';
    return;
  }

  filtered.forEach((product, index) => {
    const tr = document.createElement('tr');
    const imageCell = product.imageUrl
      ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.name)}" class="item-thumb" />`
      : '<div class="item-thumb-fallback">No Img</div>';

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${imageCell}</td>
      <td>${esc(product.name)}</td>
      <td>${esc(product.category)}</td>
      <td>${esc(product.quantity)}</td>
      <td>${esc(product.minimumQuantity)}</td>
      <td>${Number(product.cost || 0).toFixed(2)}</td>
      <td>${Number(product.price || 0).toFixed(2)}</td>
      <td>
        <div class="row-actions">
          <button data-id="${product.id}" class="edit-product btn-secondary">Edit</button>
          <button data-id="${product.id}" class="delete-product btn-danger">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.edit-product').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = state.products.find(item => item.id === btn.dataset.id);
      if (!product) return;
      state.productEditingId = product.id;
      document.getElementById('product-name').value = product.name || '';
      document.getElementById('product-category').value = product.category || '';
      document.getElementById('product-image').value = product.imageUrl || '';
      document.getElementById('product-qty').value = product.quantity ?? 0;
      document.getElementById('product-min-qty').value = product.minimumQuantity ?? 0;
      document.getElementById('product-cost').value = product.cost ?? 0;
      document.getElementById('product-price').value = product.price ?? 0;
      document.getElementById('product-submit-btn').textContent = 'Update Item';
      setActivePanel('stocks');
    });
  });

  document.querySelectorAll('.delete-product').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(userDoc('products', btn.dataset.id));
      await refreshProducts();
      await refreshInvoices();
      await refreshSummary();
    });
  });
}

function renderReorders() {
  const tbody = document.getElementById('reorder-table');
  const queryText = state.reorderSearchQuery.trim().toLowerCase();
  const filtered = state.reorders.filter(item => {
    if (!queryText) return true;
    return (item.itemName || '').toLowerCase().includes(queryText);
  });

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5">No reorder items found.</td></tr>';
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    const imageCell = item.imageUrl
      ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.itemName)}" class="item-thumb" />`
      : '<div class="item-thumb-fallback">No Img</div>';

    tr.innerHTML = `
      <td>${esc(item.itemName)}</td>
      <td>${imageCell}</td>
      <td>${Number(item.cost || 0).toFixed(2)}</td>
      <td>${esc(item.quantity)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="reorder-edit btn-secondary" data-id="${item.id}">Edit</button>
          <button type="button" class="reorder-delete btn-danger" data-id="${item.id}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.reorder-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = state.reorders.find(row => row.id === btn.dataset.id);
      if (!item) return;
      state.reorderEditingId = item.id;
      document.getElementById('reorder-item-name').value = item.itemName || '';
      document.getElementById('reorder-item-image').value = item.imageUrl || '';
      document.getElementById('reorder-item-cost').value = item.cost ?? 0;
      document.getElementById('reorder-item-qty').value = item.quantity ?? 0;
      document.getElementById('reorder-submit-btn').textContent = 'Update Reorder Item';
      document.getElementById('reorder-form').classList.remove('hidden');
    });
  });

  document.querySelectorAll('.reorder-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(userDoc('reorders', btn.dataset.id));
      await refreshReorders();
    });
  });
}

function renderBillingSellers() {
  const select = document.getElementById('bill-seller');
  const enabledSellers = state.sellers.filter(seller => seller.enabled);
  select.innerHTML = '<option value="">Select Seller</option>';
  enabledSellers.forEach(seller => {
    const option = document.createElement('option');
    option.value = seller.name;
    option.textContent = seller.name;
    select.appendChild(option);
  });
}

function renderBillingItems() {
  const tbody = document.getElementById('billing-item-table');
  const queryText = state.billingSearchQuery.trim().toLowerCase();
  const filtered = state.products.filter(product => {
    if (!queryText) return true;
    return (product.name || '').toLowerCase().includes(queryText);
  });

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5">No items in stock. Add stocks first.</td></tr>';
    updateBillTotalPreview();
    return;
  }

  filtered.forEach(product => {
    const qty = Number(state.billingQuantities[product.id] || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(product.name)}</td>
      <td>${esc(product.quantity)}</td>
      <td>${Number(product.price || 0).toFixed(2)}</td>
      <td><input class="bill-qty-input" type="number" min="0" max="${Number(product.quantity || 0)}" data-product-id="${product.id}" value="${qty}" /></td>
      <td>${formatMoney(qty * Number(product.price || 0))}</td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.bill-qty-input').forEach(input => {
    input.addEventListener('input', e => {
      const productId = e.target.dataset.productId;
      const product = state.products.find(item => item.id === productId);
      const raw = Number(e.target.value || 0);
      const clamped = Math.max(0, Math.min(raw, Number(product?.quantity || 0)));
      state.billingQuantities[productId] = clamped;
      e.target.value = clamped;
      updateBillTotalPreview();
      renderBillingItems();
    });
  });

  updateBillTotalPreview();
}

function updateBillTotalPreview() {
  const total = Object.entries(state.billingQuantities).reduce((sum, [productId, qty]) => {
    const product = state.products.find(item => item.id === productId);
    return sum + Number(qty || 0) * Number(product?.price || 0);
  }, 0);
  document.getElementById('bill-total-preview').textContent = `Total: ${formatMoney(total)}`;
}

function renderCreditCustomers() {
  const list = document.getElementById('credit-list');
  const queryText = state.creditSearchQuery.trim().toLowerCase();
  const filtered = state.creditCustomers.filter(customer => {
    const name = (customer.name || '').toLowerCase();
    const mobile = (customer.mobile || '').toLowerCase();
    const address = (customer.address || '').toLowerCase();
    return !queryText || name.includes(queryText) || mobile.includes(queryText) || address.includes(queryText);
  });

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="widget-empty">No credit customers found.</div>';
    return;
  }

  filtered.forEach(customer => {
    const isDraft = customer.id == null;
    const key = isDraft ? String(customer.tempId) : customer.id;
    const title = customer.name || 'New Customer';
    const icon = customer.imageUrl
      ? `<div class="credit-icon-wrap"><img class="credit-icon" src="${esc(customer.imageUrl)}" alt="${esc(title)}" /><span class="credit-badge">OK</span></div>`
      : '<div class="credit-fallback">OK</div>';

    const card = document.createElement('article');
    card.className = 'credit-card';
    card.dataset.key = key;
    card.innerHTML = `
      <div class="credit-head">
        ${icon}
        <div class="credit-name">${esc(title)}</div>
      </div>
      <div class="credit-row">
        <input data-field="imageUrl" placeholder="Customer Image URL (Optional)" value="${esc(customer.imageUrl || '')}" />
        <input data-field="name" placeholder="Customer Name" value="${esc(customer.name || '')}" />
        <input data-field="mobile" placeholder="Customer Mobile (Optional)" value="${esc(customer.mobile || '')}" />
        <input data-field="address" placeholder="Address" value="${esc(customer.address || '')}" />
        <input data-field="amount" type="number" min="0" step="0.01" placeholder="Amount" value="${Number(customer.amount || 0)}" />
      </div>
      <div class="row-actions">
        <button type="button" class="credit-save" data-key="${key}">Save</button>
        <button type="button" class="credit-delete btn-danger" data-key="${key}">${isDraft ? 'Remove' : 'Delete'}</button>
      </div>`;
    list.appendChild(card);
  });

  document.querySelectorAll('.credit-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await saveCreditCustomer(btn.dataset.key);
      } catch (error) {
        alert(error.message || 'Unable to save customer credit');
      }
    });
  });

  document.querySelectorAll('.credit-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await deleteCreditCustomer(btn.dataset.key);
      } catch (error) {
        alert(error.message || 'Unable to remove customer');
      }
    });
  });
}

function renderSettings() {
  document.getElementById('shop-name').value = state.settings.shopName || '';
  document.getElementById('shop-description').value = state.settings.description || '';
  document.getElementById('dark-mode-toggle').checked = !!state.settings.darkMode;
  document.getElementById('multi-account-toggle').checked = !!state.settings.multiAccountEnabled;
  applyTheme();
  renderDashboard();
}

function renderSellers() {
  const list = document.getElementById('seller-list');
  list.innerHTML = '';

  if (!state.sellers.length) {
    list.innerHTML = '<div class="widget-empty">No sellers added.</div>';
    renderBillingSellers();
    return;
  }

  state.sellers.forEach(seller => {
    const row = document.createElement('div');
    row.className = 'mini-row';
    row.innerHTML = `
      <div>${esc(seller.name)}</div>
      <div class="row-actions">
        <label class="switch-row"><span>Enabled</span><input type="checkbox" class="seller-toggle" data-id="${seller.id}" ${seller.enabled ? 'checked' : ''} /></label>
        <button type="button" class="btn-danger seller-delete" data-id="${seller.id}">Delete</button>
      </div>`;
    list.appendChild(row);
  });

  document.querySelectorAll('.seller-toggle').forEach(input => {
    input.addEventListener('change', async e => {
      const id = e.target.dataset.id;
      const seller = state.sellers.find(item => item.id === id);
      if (!seller) return;
      await updateDoc(userDoc('sellers', id), {
        ...seller,
        enabled: e.target.checked,
        updatedAt: new Date().toISOString()
      });
      await refreshSellers();
    });
  });

  document.querySelectorAll('.seller-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(userDoc('sellers', btn.dataset.id));
      await refreshSellers();
    });
  });

  renderBillingSellers();
}

function renderLinkedAccounts() {
  const list = document.getElementById('linked-account-list');
  list.innerHTML = '';

  if (!state.linkedAccounts.length) {
    list.innerHTML = '<div class="widget-empty">No linked accounts added.</div>';
    return;
  }

  state.linkedAccounts.forEach(account => {
    const row = document.createElement('div');
    row.className = 'mini-row';
    row.innerHTML = `
      <div>${esc(account.email)}</div>
      <div class="row-actions">
        <label class="switch-row"><span>Enabled</span><input type="checkbox" class="account-toggle" data-id="${account.id}" ${account.enabled ? 'checked' : ''} /></label>
        <button type="button" class="btn-danger account-delete" data-id="${account.id}">Delete</button>
      </div>`;
    list.appendChild(row);
  });

  document.querySelectorAll('.account-toggle').forEach(input => {
    input.addEventListener('change', async e => {
      const id = e.target.dataset.id;
      const account = state.linkedAccounts.find(item => item.id === id);
      if (!account) return;
      await updateDoc(userDoc('linkedAccounts', id), {
        ...account,
        enabled: e.target.checked,
        updatedAt: new Date().toISOString()
      });
      await refreshLinkedAccounts();
    });
  });

  document.querySelectorAll('.account-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(userDoc('linkedAccounts', btn.dataset.id));
      await refreshLinkedAccounts();
    });
  });
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  const queryText = state.notesSearchQuery.trim().toLowerCase();
  const filtered = state.notes.filter(note => {
    if (!queryText) return true;
    return (note.title || '').toLowerCase().includes(queryText) || (note.content || '').toLowerCase().includes(queryText);
  });

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="widget-empty">No notes added yet.</div>';
    return;
  }

  filtered.forEach(note => {
    const card = document.createElement('article');
    card.className = 'credit-card';
    card.innerHTML = `
      <div class="credit-head">
        <div class="credit-fallback">N</div>
        <div>
          <div class="credit-name">${esc(note.title)}</div>
          <div class="meta">${esc(dateLabel(note.updatedAt || note.createdAt))}</div>
        </div>
      </div>
      <div>${esc(note.content)}</div>
      <div class="row-actions">
        <button type="button" class="note-edit btn-secondary" data-id="${note.id}">Edit</button>
        <button type="button" class="note-delete btn-danger" data-id="${note.id}">Delete</button>
      </div>`;
    list.appendChild(card);
  });

  document.querySelectorAll('.note-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const note = state.notes.find(item => item.id === btn.dataset.id);
      if (!note) return;
      state.noteEditingId = note.id;
      document.getElementById('note-title').value = note.title || '';
      document.getElementById('note-content').value = note.content || '';
      document.getElementById('note-submit-btn').textContent = 'Update Note';
      setActivePanel('notes');
    });
  });

  document.querySelectorAll('.note-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(userDoc('notes', btn.dataset.id));
      if (state.noteEditingId === btn.dataset.id) {
        state.noteEditingId = null;
        document.getElementById('note-form').reset();
        document.getElementById('note-submit-btn').textContent = 'Add Note';
      }
      await refreshNotes();
    });
  });
}

function renderGallary() {
  const list = document.getElementById('gallary-list');
  const queryText = state.gallarySearchQuery.trim().toLowerCase();
  const filtered = state.gallaryItems.filter(item => {
    if (!queryText) return true;
    return (item.title || '').toLowerCase().includes(queryText);
  });

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="widget-empty">No images in gallary yet.</div>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'credit-card gallery-card';
    card.innerHTML = `
      <img src="${esc(item.imageData)}" alt="${esc(item.title)}" class="gallery-thumb" />
      <div class="credit-name">${esc(item.title)}</div>
      <div class="meta">${esc(dateLabel(item.updatedAt || item.createdAt))}</div>
      <div class="row-actions">
        <button type="button" class="gallary-edit btn-secondary" data-id="${item.id}">Edit</button>
        <button type="button" class="gallary-delete btn-danger" data-id="${item.id}">Delete</button>
      </div>`;
    list.appendChild(card);
  });

  document.querySelectorAll('.gallary-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = state.gallaryItems.find(entry => entry.id === btn.dataset.id);
      if (!item) return;
      state.gallaryEditingId = item.id;
      document.getElementById('gallary-title').value = item.title || '';
      document.getElementById('gallary-preview').src = item.imageData;
      document.getElementById('gallary-preview').classList.remove('hidden');
      document.getElementById('gallary-form').classList.remove('hidden');
      setActivePanel('gallary');
    });
  });

  document.querySelectorAll('.gallary-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(userDoc('gallery', btn.dataset.id));
      await refreshGallary();
    });
  });
}

function renderInvoices() {
  const tbody = document.getElementById('invoice-table');
  const queryText = state.invoiceSearchQuery.trim().toLowerCase();
  const filtered = state.invoices.filter(invoice => {
    if (!queryText) return true;
    const haystack = [
      invoice.id,
      invoice.sellerName,
      invoice.customerName,
      invoice.customerContact,
      invoice.totalAmount
    ].join(' ').toLowerCase();
    return haystack.includes(queryText);
  });

  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6">No invoices found.</td></tr>';
    return;
  }

  filtered.forEach(invoice => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(invoice.id)}</td>
      <td>${esc(invoice.sellerName || '-')}</td>
      <td>${esc(invoice.customerName || 'Walk-in')}</td>
      <td>${formatMoney(invoice.totalAmount)}</td>
      <td>${esc(dateLabel(invoice.createdAt))}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="print-invoice btn-secondary" data-id="${invoice.id}">PDF</button>
          <button type="button" class="wa-invoice btn-secondary" data-id="${invoice.id}">WhatsApp</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.print-invoice').forEach(btn => {
    btn.addEventListener('click', () => {
      const invoice = state.invoices.find(item => item.id === btn.dataset.id);
      if (invoice) openPrintableBill(invoice);
    });
  });

  document.querySelectorAll('.wa-invoice').forEach(btn => {
    btn.addEventListener('click', () => {
      const invoice = state.invoices.find(item => item.id === btn.dataset.id);
      if (invoice) sendInvoiceOnWhatsApp(invoice);
    });
  });
}

function openPrintableBill(invoice) {
  const lines = (invoice.items || [])
    .map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(item.itemName)}</td>
        <td>${esc(item.quantity)}</td>
        <td>${Number(item.unitPrice || 0).toFixed(2)}</td>
        <td>${Number(item.lineTotal || 0).toFixed(2)}</td>
      </tr>`)
    .join('');

  const html = `<!doctype html>
  <html>
  <head>
    <title>Invoice #${esc(invoice.id)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f5f5f5; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; }
    </style>
  </head>
  <body>
    <div class="head">
      <h2>Invoice #${esc(invoice.id)}</h2>
      <div>${esc(dateLabel(invoice.createdAt))}</div>
    </div>
    <div><strong>Shop:</strong> ${esc(state.settings.shopName || defaults.shopName)}</div>
    <div><strong>Seller:</strong> ${esc(invoice.sellerName || '-')}</div>
    <div><strong>Customer:</strong> ${esc(invoice.customerName || 'Walk-in')}</div>
    <div><strong>Contact:</strong> ${esc(invoice.customerContact || '-')}</div>
    <table>
      <thead>
        <tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>
    <h3 style="text-align:right; margin-top:12px;">Grand Total: ${esc(formatMoney(invoice.totalAmount))}</h3>
  </body>
  </html>`;

  const printWin = window.open('', '_blank');
  if (!printWin) return alert('Please allow popups for this site.');
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  printWin.print();
}

function sendInvoiceOnWhatsApp(invoice) {
  const lineText = (invoice.items || [])
    .map(item => `- ${item.itemName} x${item.quantity} = ${Number(item.lineTotal || 0).toFixed(2)}`)
    .join('\n');

  const message = [
    `${state.settings.shopName || defaults.shopName} - Invoice #${invoice.id}`,
    `Seller: ${invoice.sellerName || '-'}`,
    `Customer: ${invoice.customerName || 'Walk-in'}`,
    `Contact: ${invoice.customerContact || '-'}`,
    '',
    lineText,
    '',
    `Total: ${formatMoney(invoice.totalAmount)}`
  ].join('\n');

  const digits = String(invoice.customerContact || '').replace(/\D/g, '');
  const waUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  window.open(waUrl, '_blank');
}

function collectBillingItems() {
  return Object.entries(state.billingQuantities)
    .map(([productId, quantity]) => ({
      productId,
      quantity: Number(quantity || 0)
    }))
    .filter(item => item.quantity > 0);
}

async function createBill(action) {
  requireUser();
  const sellerName = document.getElementById('bill-seller').value.trim();
  const customerName = document.getElementById('bill-customer-name').value.trim();
  const customerContact = document.getElementById('bill-customer-contact').value.trim();
  const items = collectBillingItems();

  if (!sellerName) {
    alert('Please select a seller from the Settings tab.');
    return;
  }

  if (!items.length) {
    alert('Please add quantity for at least one item.');
    return;
  }

  const createdAt = new Date().toISOString();
  let invoiceId = '';
  let invoicePayload = null;

  await runTransaction(db, async tx => {
    const touchedProducts = [];
    const invoiceItems = [];
    let totalAmount = 0;

    for (const line of items) {
      const productRef = userDoc('products', line.productId);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) {
        throw new Error(`Product not found: ${line.productId}`);
      }

      const product = productSnap.data();
      if (Number(product.quantity || 0) < line.quantity) {
        throw new Error(`Insufficient stock for item: ${product.name}`);
      }

      const lineTotal = Number(product.price || 0) * line.quantity;
      invoiceItems.push({
        productId: line.productId,
        itemName: product.name,
        quantity: line.quantity,
        unitPrice: Number(product.price || 0),
        lineTotal
      });

      touchedProducts.push({
        ref: productRef,
        quantity: Number(product.quantity || 0) - line.quantity
      });
      totalAmount += lineTotal;
    }

    const invoiceRef = doc(userCollection('invoices'));
    invoiceId = invoiceRef.id;
    invoicePayload = {
      sellerName,
      customerName: customerName || null,
      customerContact: customerContact || null,
      totalAmount,
      items: invoiceItems,
      createdAt,
      updatedAt: createdAt
    };

    tx.set(invoiceRef, invoicePayload);
    touchedProducts.forEach(product => {
      tx.update(product.ref, {
        quantity: product.quantity,
        updatedAt: createdAt
      });
    });
  });

  state.billingQuantities = {};
  document.getElementById('bill-customer-name').value = '';
  document.getElementById('bill-customer-contact').value = '';

  await refreshProducts();
  await refreshInvoices();
  await refreshSummary();

  const invoice = { id: invoiceId, ...invoicePayload };
  if (action === 'pdf') openPrintableBill(invoice);
  if (action === 'whatsapp') sendInvoiceOnWhatsApp(invoice);
}

async function saveProduct() {
  requireUser();
  const payload = {
    name: document.getElementById('product-name').value.trim(),
    category: document.getElementById('product-category').value.trim(),
    imageUrl: document.getElementById('product-image').value.trim() || 'https://placehold.co/72x72/png',
    quantity: Number(document.getElementById('product-qty').value || 0),
    minimumQuantity: Number(document.getElementById('product-min-qty').value || 0),
    cost: Number(document.getElementById('product-cost').value || 0),
    price: Number(document.getElementById('product-price').value || 0)
  };

  if (!payload.name || !payload.category) {
    throw new Error('Please fill in item name and category.');
  }

  if (state.productEditingId) {
    await updateDoc(userDoc('products', state.productEditingId), {
      ...payload,
      updatedAt: new Date().toISOString()
    });
  } else {
    await addDoc(userCollection('products'), {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  resetProductForm();
  await refreshProducts();
  await refreshSummary();
}

async function saveReorder() {
  requireUser();
  const payload = {
    itemName: document.getElementById('reorder-item-name').value.trim(),
    imageUrl: document.getElementById('reorder-item-image').value.trim() || null,
    cost: Number(document.getElementById('reorder-item-cost').value || 0),
    quantity: Number(document.getElementById('reorder-item-qty').value || 0)
  };

  if (!payload.itemName) {
    throw new Error('Please enter a reorder item name.');
  }

  if (state.reorderEditingId) {
    await updateDoc(userDoc('reorders', state.reorderEditingId), {
      ...payload,
      updatedAt: new Date().toISOString()
    });
  } else {
    await addDoc(userCollection('reorders'), {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  resetReorderForm();
  await refreshReorders();
}

function getCreditCustomerFromCard(key) {
  const card = document.querySelector(`.credit-card[data-key="${cssEscape(String(key))}"]`);
  if (!card) return null;
  const read = field => card.querySelector(`[data-field="${field}"]`)?.value?.trim() || '';
  return {
    imageUrl: read('imageUrl'),
    name: read('name'),
    mobile: read('mobile'),
    address: read('address'),
    amount: Number(read('amount') || 0)
  };
}

async function saveCreditCustomer(key) {
  requireUser();
  const payload = getCreditCustomerFromCard(key);
  if (!payload || !payload.name) {
    throw new Error('Please enter the customer name.');
  }

  const existing = state.creditCustomers.find(customer => String(customer.id || customer.tempId) === String(key));
  if (!existing) {
    throw new Error('Customer not found.');
  }

  const now = new Date().toISOString();
  if (existing.id) {
    await updateDoc(userDoc('creditCustomers', existing.id), {
      ...payload,
      updatedAt: now
    });
  } else {
    await addDoc(userCollection('creditCustomers'), {
      ...payload,
      createdAt: now,
      updatedAt: now
    });
    state.creditCustomers = state.creditCustomers.filter(customer => String(customer.tempId) !== String(key));
  }

  await refreshCreditCustomers();
  await refreshSummary();
}

async function deleteCreditCustomer(key) {
  requireUser();
  const existing = state.creditCustomers.find(customer => String(customer.id || customer.tempId) === String(key));
  if (!existing) return;

  if (existing.id) {
    await deleteDoc(userDoc('creditCustomers', existing.id));
  }

  state.creditCustomers = state.creditCustomers.filter(customer => String(customer.id || customer.tempId) !== String(key));
  await refreshCreditCustomers();
  await refreshSummary();
}

function addCreditDraft() {
  state.tempCreditId += 1;
  state.creditCustomers = [
    {
      tempId: state.tempCreditId,
      id: null,
      imageUrl: '',
      name: '',
      mobile: '',
      address: '',
      amount: 0
    },
    ...state.creditCustomers
  ];
  renderCreditCustomers();
}

async function saveShopSettings() {
  requireUser();
  const payload = {
    ...state.settings,
    shopName: document.getElementById('shop-name').value.trim() || defaults.shopName,
    description: document.getElementById('shop-description').value.trim(),
    updatedAt: new Date().toISOString()
  };
  await setDoc(settingsDoc(), payload, { merge: true });
  state.settings = { ...defaults, ...payload };
  renderSettings();
}

async function updateDarkMode(enabled) {
  requireUser();
  state.settings.darkMode = enabled;
  applyTheme();
  await setDoc(settingsDoc(), {
    ...state.settings,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  renderSettings();
}

async function updateMultiAccount(enabled) {
  requireUser();
  state.settings.multiAccountEnabled = enabled;
  await setDoc(settingsDoc(), {
    ...state.settings,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  renderSettings();
}

async function addSeller(name) {
  requireUser();
  if (!name) return;
  await addDoc(userCollection('sellers'), {
    name,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  document.getElementById('seller-form').reset();
  await refreshSellers();
}

async function addLinkedAccount(email) {
  requireUser();
  if (!email) return;
  await addDoc(userCollection('linkedAccounts'), {
    email,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  document.getElementById('linked-account-form').reset();
  await refreshLinkedAccounts();
}

async function saveNote() {
  requireUser();
  const payload = {
    title: document.getElementById('note-title').value.trim(),
    content: document.getElementById('note-content').value.trim()
  };
  if (!payload.title || !payload.content) {
    throw new Error('Please add both note title and content.');
  }

  const now = new Date().toISOString();
  if (state.noteEditingId) {
    await updateDoc(userDoc('notes', state.noteEditingId), {
      ...payload,
      updatedAt: now
    });
  } else {
    await addDoc(userCollection('notes'), {
      ...payload,
      createdAt: now,
      updatedAt: now
    });
  }

  state.noteEditingId = null;
  document.getElementById('note-form').reset();
  document.getElementById('note-submit-btn').textContent = 'Add Note';
  await refreshNotes();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected image'));
    reader.readAsDataURL(file);
  });
}

async function saveGallaryItem() {
  requireUser();
  const title = document.getElementById('gallary-title').value.trim();
  const file = document.getElementById('gallary-image').files?.[0];
  if (!title) {
    throw new Error('Please enter an image title.');
  }

  const existing = state.gallaryItems.find(item => item.id === state.gallaryEditingId);
  let imageData = existing?.imageData || '';

  if (file) {
    imageData = await fileToDataUrl(file);
  }

  if (!imageData) {
    throw new Error('Please select an image.');
  }

  const now = new Date().toISOString();
  if (state.gallaryEditingId && existing) {
    await updateDoc(userDoc('gallery', existing.id), {
      title,
      imageData,
      updatedAt: now
    });
  } else {
    await addDoc(userCollection('gallery'), {
      title,
      imageData,
      createdAt: now,
      updatedAt: now
    });
  }

  resetGallaryForm();
  await refreshGallary();
}

function resetProductForm() {
  document.getElementById('product-form').reset();
  state.productEditingId = null;
  document.getElementById('product-submit-btn').textContent = 'Add Item';
}

function resetReorderForm() {
  const form = document.getElementById('reorder-form');
  form.reset();
  state.reorderEditingId = null;
  document.getElementById('reorder-submit-btn').textContent = 'Save Reorder Item';
  form.classList.add('hidden');
}

function resetGallaryForm() {
  document.getElementById('gallary-form').reset();
  state.gallaryEditingId = null;
  document.getElementById('gallary-submit-btn').textContent = 'Save Image';
  document.getElementById('gallary-preview').classList.add('hidden');
}

async function refreshSummary() {
  renderDashboard();
}

async function refreshProducts() {
  state.products = await loadCollection('products', 'createdAt', 'desc');
  renderProducts();
  renderBillingItems();
  renderDashboard();
}

async function refreshReorders() {
  state.reorders = await loadCollection('reorders', 'createdAt', 'desc');
  renderReorders();
}

async function refreshCreditCustomers() {
  state.creditCustomers = [
    ...state.creditCustomers.filter(customer => customer.id == null),
    ...await loadCollection('creditCustomers', 'updatedAt', 'desc')
  ];
  renderCreditCustomers();
  renderDashboard();
}

async function refreshInvoices() {
  state.invoices = await loadCollection('invoices', 'createdAt', 'desc');
  renderInvoices();
  renderDashboard();
}

async function refreshSettings() {
  state.settings = await loadSettings();
  renderSettings();
}

async function refreshSellers() {
  state.sellers = await loadCollection('sellers', 'createdAt', 'desc');
  renderSellers();
}

async function refreshLinkedAccounts() {
  state.linkedAccounts = await loadCollection('linkedAccounts', 'createdAt', 'desc');
  renderLinkedAccounts();
}

async function refreshNotes() {
  state.notes = await loadCollection('notes', 'updatedAt', 'desc');
  renderNotes();
}

async function refreshGallary() {
  state.gallaryItems = await loadCollection('gallery', 'updatedAt', 'desc');
  renderGallary();
}

async function loadAll() {
  requireUser();
  await seedUserDefaults();
  await refreshSettings();
  await Promise.all([
    refreshProducts(),
    refreshReorders(),
    refreshCreditCustomers(),
    refreshInvoices(),
    refreshSellers(),
    refreshLinkedAccounts(),
    refreshNotes(),
    refreshGallary()
  ]);
  renderBillingSellers();
  renderBillingItems();
  renderInvoices();
  renderDashboard();
}

function wireAuthHandlers() {
  document.getElementById('show-login').addEventListener('click', () => {
    showAuthForm('login-form');
    setAuthMessage('');
  });

  document.getElementById('show-register').addEventListener('click', () => {
    showAuthForm('register-form');
    setAuthMessage('');
  });

  document.getElementById('forgot-password-btn').addEventListener('click', () => {
    showAuthForm('reset-form');
    document.getElementById('reset-email').value = document.getElementById('login-email').value.trim();
    setResetHint('Check your inbox, spam, and promotions folders after requesting a reset link.');
    setAuthMessage('');
  });

  document.getElementById('back-to-login-btn').addEventListener('click', () => {
    showAuthForm('login-form');
    setAuthMessage('');
  });

  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      requireFirebase();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const result = await withLoading(
        () => createUserWithEmailAndPassword(auth, email, password),
        'Creating account...'
      );
      state.user = result.user;
      await withLoading(() => loadAll(), 'Loading workspace...');
      showApp();
    } catch (error) {
      setAuthMessage(error.message || 'Unable to register.');
    }
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      requireFirebase();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const result = await withLoading(
        () => signInWithEmailAndPassword(auth, email, password),
        'Signing in...'
      );
      state.user = result.user;
      await withLoading(() => loadAll(), 'Loading workspace...');
      showApp();
    } catch (error) {
      setAuthMessage(error.message || 'Unable to sign in.');
    }
  });

  document.getElementById('reset-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      requireFirebase();
      const email = document.getElementById('reset-email').value.trim();
      if (!email || !isValidEmail(email)) {
        setAuthMessage('Please enter a valid email address.');
        return;
      }
      const remaining = getResetCooldownRemaining(email);
      if (remaining > 0) {
        setAuthMessage(`Please wait ${Math.ceil(remaining / 1000)}s before requesting another reset link.`);
        return;
      }
      await withLoading(
        () => sendPasswordResetEmail(auth, email),
        'Sending reset email...'
      );
      setResetCooldown(email);
      setAuthMessage('Password reset request sent. Check inbox, spam, and promotions.');
      setResetHint('If it does not arrive, confirm the email exists in this Firebase project.');
      document.getElementById('reset-email').value = '';
      showAuthForm('reset-form');
    } catch (error) {
      const code = String(error?.code || '');
      if (code.includes('auth/too-many-requests')) {
        setAuthMessage('Too many reset attempts. Please wait a little before trying again.');
        setResetHint('This is usually a temporary Firebase anti-abuse limit.');
      } else if (code.includes('auth/invalid-email')) {
        setAuthMessage('Please enter a valid email address.');
      } else {
        setAuthMessage(error.message || 'Unable to send reset email.');
        setResetHint('If the email is correct, check spam and promotions too.');
      }
    }
  });
}

function wireAppHandlers() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await withLoading(async () => {
        if (auth) await signOut(auth);
        state.user = null;
      }, 'Signing out...');
    } finally {
      showAuth();
    }
  });

  document.getElementById('stock-search').addEventListener('input', e => {
    state.stockSearchQuery = e.target.value;
    renderProducts();
  });

  document.getElementById('reorder-search').addEventListener('input', e => {
    state.reorderSearchQuery = e.target.value;
    renderReorders();
  });

  document.getElementById('credit-search').addEventListener('input', e => {
    state.creditSearchQuery = e.target.value;
    renderCreditCustomers();
  });

  document.getElementById('notes-search').addEventListener('input', e => {
    state.notesSearchQuery = e.target.value;
    renderNotes();
  });

  document.getElementById('gallary-search').addEventListener('input', e => {
    state.gallarySearchQuery = e.target.value;
    renderGallary();
  });

  document.getElementById('billing-search').addEventListener('keyup', e => {
    state.billingSearchQuery = e.target.value;
    renderBillingItems();
  });

  document.getElementById('invoice-search').addEventListener('keyup', e => {
    state.invoiceSearchQuery = e.target.value;
    renderInvoices();
  });

  document.getElementById('add-credit-btn').addEventListener('click', addCreditDraft);
  document.getElementById('add-reorder-btn').addEventListener('click', () => {
    resetReorderForm();
    document.getElementById('reorder-form').classList.remove('hidden');
  });
  document.getElementById('add-gallary-btn').addEventListener('click', () => {
    resetGallaryForm();
    document.getElementById('gallary-form').classList.remove('hidden');
  });

  document.getElementById('gallary-image').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) {
      document.getElementById('gallary-preview').classList.add('hidden');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const preview = document.getElementById('gallary-preview');
      preview.src = dataUrl;
      preview.classList.remove('hidden');
    } catch (error) {
      alert(error.message || 'Unable to preview image');
    }
  });

  document.getElementById('generate-pdf-btn').addEventListener('click', async () => {
    try {
      await withLoading(() => createBill('pdf'), 'Generating bill...');
    } catch (error) {
      alert(error.message || 'Failed to generate bill PDF');
    }
  });

  document.getElementById('send-whatsapp-btn').addEventListener('click', async () => {
    try {
      await withLoading(() => createBill('whatsapp'), 'Preparing WhatsApp bill...');
    } catch (error) {
      alert(error.message || 'Failed to send bill');
    }
  });

  document.getElementById('product-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await withLoading(() => saveProduct(), 'Saving product...');
    } catch (error) {
      alert(error.message || 'Unable to save product');
    }
  });

  document.getElementById('reorder-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await withLoading(() => saveReorder(), 'Saving reorder item...');
    } catch (error) {
      alert(error.message || 'Unable to save reorder item');
    }
  });

  document.getElementById('shop-settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await withLoading(() => saveShopSettings(), 'Saving settings...');
    } catch (error) {
      alert(error.message || 'Unable to save shop settings');
    }
  });

  document.getElementById('dark-mode-toggle').addEventListener('change', async e => {
    try {
      await withLoading(() => updateDarkMode(e.target.checked), 'Updating appearance...');
    } catch (error) {
      alert(error.message || 'Unable to update theme');
    }
  });

  document.getElementById('multi-account-toggle').addEventListener('change', async e => {
    try {
      await withLoading(() => updateMultiAccount(e.target.checked), 'Updating account settings...');
    } catch (error) {
      alert(error.message || 'Unable to update multi-account setting');
    }
  });

  document.getElementById('seller-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const name = document.getElementById('seller-name').value.trim();
      await withLoading(() => addSeller(name), 'Adding seller...');
    } catch (error) {
      alert(error.message || 'Unable to add seller');
    }
  });

  document.getElementById('linked-account-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const email = document.getElementById('linked-account-email').value.trim();
      await withLoading(() => addLinkedAccount(email), 'Adding linked account...');
    } catch (error) {
      alert(error.message || 'Unable to add linked account');
    }
  });

  document.getElementById('note-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await withLoading(() => saveNote(), 'Saving note...');
    } catch (error) {
      alert(error.message || 'Unable to save note');
    }
  });

  document.getElementById('gallary-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await withLoading(() => saveGallaryItem(), 'Saving image...');
    } catch (error) {
      alert(error.message || 'Unable to save image');
    }
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => setActivePanel(btn.dataset.view));
  });
}

function bootstrapFirebase() {
  if (!firebaseReady) return false;
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  return true;
}

wireAuthHandlers();
wireAppHandlers();

if (!bootstrapFirebase()) {
  showAuth();
  setAuthMessage('Paste your Firebase project config into app.js first.');
} else {
  onAuthStateChanged(auth, async user => {
    try {
      if (!user) {
        state.user = null;
        showAuth();
        return;
      }
      state.user = user;
      await withLoading(() => loadAll(), 'Loading workspace...');
      showApp();
    } catch (error) {
      console.error(error);
      state.user = null;
      showAuth();
      setAuthMessage(error.message || 'Unable to load your workspace.');
    }
  });
}

showAuthForm('login-form');
