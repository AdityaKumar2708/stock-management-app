const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authMessage = document.getElementById('auth-message');
const tokenKey = 'stockflow_token';
const gallaryStorageKey = 'stockflow_gallary_items';



// 🔍 Filter Billing Items
document.getElementById("billing-search").addEventListener("keyup", function () {
    const search = this.value.toLowerCase();
    const rows = document.querySelectorAll("#billing-item-table tr");

    rows.forEach(row => {
        const item = row.cells[0]?.textContent.toLowerCase() || "";
        row.style.display = item.includes(search) ? "" : "none";
    });
});


// 🔍 Filter Invoice Table
document.getElementById("invoice-search").addEventListener("keyup", function () {
    const search = this.value.toLowerCase();
    const rows = document.querySelectorAll("#invoice-table tr");

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? "" : "none";
    });
});

const state = {
    token: localStorage.getItem(tokenKey) || '',
    products: [],
    reorders: [],
    invoices: [],
    creditCustomers: [],
    sellers: [],
    linkedAccounts: [],
    notes: [],
    gallaryItems: [],
    settings: {
        shopName: 'My Shop',
        description: 'Stock and billing system',
        darkMode: false,
        multiAccountEnabled: false,
    },
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
    tempCreditId: -1,
    summary: {
        totalProducts: 0,
        totalCustomers: 0,
        totalInvoices: 0,
        totalRevenue: 0,
    }
};

function setAuthMessage(msg) {
    authMessage.textContent = msg || '';
}

function api(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    return fetch(path, { ...options, headers }).then(async res => {
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Request failed: ${res.status}`);
        }
        const contentType = res.headers.get('content-type') || '';
        return contentType.includes('application/json') ? res.json() : null;
    });
}

function showAuth() {
    authView.classList.remove('hidden');
    appView.classList.add('hidden');
}

function showApp() {
    authView.classList.add('hidden');
    appView.classList.remove('hidden');
}

function activateTab(btnId, formId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#auth-view .form').forEach(f => f.classList.add('hidden'));
    document.getElementById(btnId).classList.add('active');
    document.getElementById(formId).classList.remove('hidden');
    setAuthMessage('');
}

document.getElementById('show-login').addEventListener('click', () => activateTab('show-login', 'login-form'));
document.getElementById('show-register').addEventListener('click', () => activateTab('show-register', 'register-form'));

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const body = {
            name: document.getElementById('register-name').value,
            email: document.getElementById('register-email').value,
            password: document.getElementById('register-password').value,
        };
        const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
        state.token = data.token;
        localStorage.setItem(tokenKey, state.token);
        await loadAll();
        showApp();
    } catch (err) {
        setAuthMessage(err.message);
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const body = {
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
        };
        const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
        state.token = data.token;
        localStorage.setItem(tokenKey, state.token);
        await loadAll();
        showApp();
    } catch (err) {
        setAuthMessage(err.message);
    }
});

function formatMoney(value) {
    return `INR ${Number(value || 0).toFixed(2)}`;
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', !!state.settings.darkMode);
}

function resetProductForm() {
    const form = document.getElementById('product-form');
    form.reset();
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
    const form = document.getElementById('gallary-form');
    form.reset();
    state.gallaryEditingId = null;
    document.getElementById('gallary-submit-btn').textContent = 'Save Image';
    document.getElementById('gallary-preview').classList.add('hidden');
}

function loadGallaryItems() {
    try {
        const parsed = JSON.parse(localStorage.getItem(gallaryStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveGallaryItems() {
    localStorage.setItem(gallaryStorageKey, JSON.stringify(state.gallaryItems));
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read selected image'));
        reader.readAsDataURL(file);
    });
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
        item.innerHTML = `<div><strong>${row.title}</strong><div class="meta">${row.meta || ''}</div></div><div><strong>${row.value}</strong></div>`;
        el.appendChild(item);
    });
}

function getLowStockProducts(products) {
    return products.filter(p => Number(p.quantity) <= Number(p.minimumQuantity || 0));
}

function renderDashboard() {
    const dashboardTitle = document.getElementById('dashboard-shop-title');
    const dashboardSubtitle = document.getElementById('dashboard-shop-subtitle');
    const shopName = (state.settings.shopName || '').trim();
    const shopDescription = (state.settings.description || '').trim();

    dashboardTitle.textContent = shopName || 'Business Dashboard';
    dashboardSubtitle.textContent = shopDescription || 'Track sales, stock health, and billing performance in one place.';

    const summary = state.summary;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySales = state.invoices
        .filter(inv => new Date(inv.createdAt) >= today)
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

    const avgInvoice = state.invoices.length
        ? Number(summary.totalRevenue || 0) / state.invoices.length
        : 0;

    const lowStockItemsAll = getLowStockProducts(state.products);

    const cards = document.getElementById('summary-cards');
    cards.innerHTML = '';
    [
        { label: 'Stocks', value: summary.totalProducts ?? 0 },
        { label: 'Credit Customers', value: summary.totalCustomers ?? 0 },
        { label: 'Invoices', value: summary.totalInvoices ?? 0 },
        { label: 'Total Sales', value: formatMoney(summary.totalRevenue) },
        { label: "Today's Sales", value: formatMoney(todaySales) },
        { label: 'Average Invoice', value: formatMoney(avgInvoice) },
        { label: 'Low Stock Items', value: lowStockItemsAll.length },
    ].forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `<div class="label">${item.label}</div><div class="value">${item.value}</div>`;
        cards.appendChild(div);
    });

    const recentInvoices = [...state.invoices]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(inv => ({
            title: `#${inv.id} - ${inv.customerName || 'Walk-in'}`,
            meta: new Date(inv.createdAt).toLocaleString(),
            value: formatMoney(inv.totalAmount),
        }));

    const lowStockItems = lowStockItemsAll
        .sort((a, b) => Number(a.quantity) - Number(b.quantity))
        .slice(0, 5)
        .map(p => ({
            title: p.name,
            meta: `Min: ${p.minimumQuantity}`,
            value: `${p.quantity} left`,
        }));

    const customerTotals = {};
    state.invoices.forEach(inv => {
        const name = inv.customerName || 'Walk-in';
        customerTotals[name] = (customerTotals[name] || 0) + Number(inv.totalAmount || 0);
    });

    const topCustomers = Object.entries(customerTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({
            title: name,
            meta: 'Total billed',
            value: formatMoney(total),
        }));

    renderWidgetList(document.getElementById('dashboard-recent-invoices'), recentInvoices);
    renderWidgetList(document.getElementById('dashboard-low-stock'), lowStockItems);
    renderWidgetList(document.getElementById('dashboard-top-customers'), topCustomers);
}

function renderProducts() {
    const tbody = document.getElementById('product-table');
    const q = state.stockSearchQuery.trim().toLowerCase();
    const filtered = state.products.filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

    tbody.innerHTML = '';

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="9">No stock items found.</td></tr>';
        return;
    }

    filtered.forEach((p, i) => {
        const tr = document.createElement('tr');
        const imageCell = p.imageUrl
            ? `<img src="${p.imageUrl}" alt="${p.name}" class="item-thumb" />`
            : '<div class="item-thumb-fallback">No Img</div>';

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${imageCell}</td>
            <td>${p.name}</td>
            <td>${p.category}</td>
            <td>${p.quantity}</td>
            <td>${p.minimumQuantity}</td>
            <td>${Number(p.cost).toFixed(2)}</td>
            <td>${Number(p.price).toFixed(2)}</td>
            <td>
                <div class="row-actions">
                    <button data-id="${p.id}" class="edit-product btn-secondary">Edit</button>
                    <button data-id="${p.id}" class="delete-product btn-danger">Delete</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.edit-product').forEach(btn => {
        btn.addEventListener('click', () => {
            const product = state.products.find(p => p.id === Number(btn.dataset.id));
            if (!product) return;
            state.productEditingId = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-category').value = product.category;
            document.getElementById('product-image').value = product.imageUrl || '';
            document.getElementById('product-qty').value = product.quantity;
            document.getElementById('product-min-qty').value = product.minimumQuantity;
            document.getElementById('product-cost').value = product.cost;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-submit-btn').textContent = 'Update Item';
        });
    });

    document.querySelectorAll('.delete-product').forEach(btn => {
        btn.addEventListener('click', async () => {
            await api(`/api/products/${btn.dataset.id}`, { method: 'DELETE' });
            if (state.productEditingId === Number(btn.dataset.id)) {
                resetProductForm();
            }
            await refreshProducts();
            await refreshSummary();
        });
    });
}

function renderReorders() {
    const tbody = document.getElementById('reorder-table');
    const q = state.reorderSearchQuery.trim().toLowerCase();
    const filtered = state.reorders.filter(item => !q || item.itemName.toLowerCase().includes(q));

    tbody.innerHTML = '';
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="5">No reorder items found.</td></tr>';
        return;
    }

    filtered.forEach(item => {
        const imageCell = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${item.itemName}" class="item-thumb" />`
            : '<div class="item-thumb-fallback">No Img</div>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.itemName}</td>
            <td>${imageCell}</td>
            <td>${Number(item.cost || 0).toFixed(2)}</td>
            <td>${item.quantity}</td>
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
            const item = state.reorders.find(r => r.id === Number(btn.dataset.id));
            if (!item) return;
            state.reorderEditingId = item.id;
            document.getElementById('reorder-item-name').value = item.itemName;
            document.getElementById('reorder-item-image').value = item.imageUrl || '';
            document.getElementById('reorder-item-cost').value = item.cost;
            document.getElementById('reorder-item-qty').value = item.quantity;
            document.getElementById('reorder-submit-btn').textContent = 'Update Reorder Item';
            document.getElementById('reorder-form').classList.remove('hidden');
        });
    });

    document.querySelectorAll('.reorder-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            await api(`/api/reorders/${btn.dataset.id}`, { method: 'DELETE' });
            if (state.reorderEditingId === Number(btn.dataset.id)) {
                resetReorderForm();
            }
            await refreshReorders();
        });
    });
}

function renderBillingSellers() {
    const sellerSelect = document.getElementById('bill-seller');
    const activeSellers = state.sellers.filter(s => s.enabled);

    sellerSelect.innerHTML = '<option value="">Select Seller</option>';
    activeSellers.forEach(seller => {
        const option = document.createElement('option');
        option.value = seller.name;
        option.textContent = seller.name;
        sellerSelect.appendChild(option);
    });
}

function updateBillTotalPreview() {
    let total = 0;
    state.products.forEach(product => {
        const qty = Number(state.billingQuantities[product.id] || 0);
        if (qty > 0) {
            total += qty * Number(product.price || 0);
        }
    });
    document.getElementById('bill-total-preview').textContent = `Total: ${formatMoney(total)}`;
}

function renderBillingItems() {
    const tbody = document.getElementById('billing-item-table');
    tbody.innerHTML = '';

    if (!state.products.length) {
        tbody.innerHTML = '<tr><td colspan="5">No items in stock. Add stocks first.</td></tr>';
        updateBillTotalPreview();
        return;
    }

    state.products.forEach(product => {
        const qty = Number(state.billingQuantities[product.id] || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${product.name}</td>
            <td>${product.quantity}</td>
            <td>${Number(product.price).toFixed(2)}</td>
            <td><input class="bill-qty-input" type="number" min="0" max="${product.quantity}" data-product-id="${product.id}" value="${qty}" /></td>
            <td>${formatMoney(qty * Number(product.price || 0))}</td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.bill-qty-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const productId = Number(e.target.dataset.productId);
            const raw = Number(e.target.value || 0);
            const product = state.products.find(p => p.id === productId);
            const clamped = Math.max(0, Math.min(raw, Number(product?.quantity || 0)));
            state.billingQuantities[productId] = clamped;
            e.target.value = clamped;
            renderBillingItems();
        });
    });

    updateBillTotalPreview();
}

function renderCreditCustomers() {
    const list = document.getElementById('credit-list');
    const q = state.creditSearchQuery.trim().toLowerCase();

    const filtered = state.creditCustomers.filter(c => {
        const name = (c.name || '').toLowerCase();
        const mobile = (c.mobile || '').toLowerCase();
        const address = (c.address || '').toLowerCase();
        return !q || name.includes(q) || mobile.includes(q) || address.includes(q);
    });

    list.innerHTML = '';

    if (!filtered.length) {
        list.innerHTML = '<div class="widget-empty">No credit customers found.</div>';
        return;
    }

    filtered.forEach(customer => {
        const isDraft = customer.id == null;
        const key = isDraft ? customer.tempId : customer.id;
        const title = customer.name || 'New Customer';
        const icon = customer.imageUrl
            ? `<div class="credit-icon-wrap"><img class="credit-icon" src="${customer.imageUrl}" alt="${title}" /><span class="credit-badge">OK</span></div>`
            : '<div class="credit-fallback">OK</div>';

        const card = document.createElement('article');
        card.className = 'credit-card';
        card.dataset.key = String(key);
        card.innerHTML = `
            <div class="credit-head">
                ${icon}
                <div class="credit-name">${title}</div>
            </div>
            <div class="credit-row">
                <input data-field="imageUrl" placeholder="Customer Image URL (Optional)" value="${customer.imageUrl || ''}" />
                <input data-field="name" placeholder="Customer Name" value="${customer.name || ''}" />
                <input data-field="mobile" placeholder="Customer Mobile (Optional)" value="${customer.mobile || ''}" />
                <input data-field="address" placeholder="Address" value="${customer.address || ''}" />
                <input data-field="amount" type="number" min="0" step="0.01" placeholder="Amount" value="${Number(customer.amount || 0)}" />
            </div>
            <div class="row-actions">
                <button type="button" class="credit-save" data-key="${key}">Save</button>
                <button type="button" class="credit-delete btn-danger" data-key="${key}">${isDraft ? 'Remove' : 'Delete'}</button>
            </div>
        `;
        list.appendChild(card);
    });

    document.querySelectorAll('.credit-save').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await saveCreditCustomer(Number(btn.dataset.key));
            } catch (err) {
                alert(err.message || 'Unable to save customer credit');
            }
        });
    });

    document.querySelectorAll('.credit-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await deleteCreditCustomer(Number(btn.dataset.key));
            } catch (err) {
                alert(err.message || 'Unable to remove customer');
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
            <div>${seller.name}</div>
            <div class="row-actions">
                <label class="switch-row"><span>Enabled</span><input type="checkbox" class="seller-toggle" data-id="${seller.id}" ${seller.enabled ? 'checked' : ''} /></label>
                <button type="button" class="btn-danger seller-delete" data-id="${seller.id}">Delete</button>
            </div>`;
        list.appendChild(row);
    });

    document.querySelectorAll('.seller-toggle').forEach(input => {
        input.addEventListener('change', async (e) => {
            const id = Number(e.target.dataset.id);
            const seller = state.sellers.find(s => s.id === id);
            if (!seller) return;
            await api(`/api/sellers/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...seller, enabled: e.target.checked })
            });
            await refreshSellers();
        });
    });

    document.querySelectorAll('.seller-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            await api(`/api/sellers/${btn.dataset.id}`, { method: 'DELETE' });
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
            <div>${account.email}</div>
            <div class="row-actions">
                <label class="switch-row"><span>Enabled</span><input type="checkbox" class="account-toggle" data-id="${account.id}" ${account.enabled ? 'checked' : ''} /></label>
                <button type="button" class="btn-danger account-delete" data-id="${account.id}">Delete</button>
            </div>`;
        list.appendChild(row);
    });

    document.querySelectorAll('.account-toggle').forEach(input => {
        input.addEventListener('change', async (e) => {
            const id = Number(e.target.dataset.id);
            const account = state.linkedAccounts.find(a => a.id === id);
            if (!account) return;
            await api(`/api/linked-accounts/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...account, enabled: e.target.checked })
            });
            await refreshLinkedAccounts();
        });
    });

    document.querySelectorAll('.account-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            await api(`/api/linked-accounts/${btn.dataset.id}`, { method: 'DELETE' });
            await refreshLinkedAccounts();
        });
    });
}

function renderNotes() {
    const list = document.getElementById('notes-list');
    const q = state.notesSearchQuery.trim().toLowerCase();
    const filtered = state.notes.filter(note =>
        !q ||
        (note.title || '').toLowerCase().includes(q) ||
        (note.content || '').toLowerCase().includes(q)
    );

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
                    <div class="credit-name">${note.title}</div>
                    <div class="meta">${new Date(note.updatedAt).toLocaleString()}</div>
                </div>
            </div>
            <div>${note.content}</div>
            <div class="row-actions">
                <button type="button" class="note-edit btn-secondary" data-id="${note.id}">Edit</button>
                <button type="button" class="note-delete btn-danger" data-id="${note.id}">Delete</button>
            </div>
        `;
        list.appendChild(card);
    });

    document.querySelectorAll('.note-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const note = state.notes.find(n => n.id === Number(btn.dataset.id));
            if (!note) return;
            state.noteEditingId = note.id;
            document.getElementById('note-title').value = note.title;
            document.getElementById('note-content').value = note.content;
            document.getElementById('note-submit-btn').textContent = 'Update Note';
        });
    });

    document.querySelectorAll('.note-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            await api(`/api/notes/${btn.dataset.id}`, { method: 'DELETE' });
            if (state.noteEditingId === Number(btn.dataset.id)) {
                document.getElementById('note-form').reset();
                state.noteEditingId = null;
                document.getElementById('note-submit-btn').textContent = 'Add Note';
            }
            await refreshNotes();
        });
    });
}

function renderGallary() {
    const list = document.getElementById('gallary-list');
    const q = state.gallarySearchQuery.trim().toLowerCase();
    const filtered = state.gallaryItems.filter(item =>
        !q || (item.title || '').toLowerCase().includes(q)
    );

    list.innerHTML = '';
    if (!filtered.length) {
        list.innerHTML = '<div class="widget-empty">No images in gallary yet.</div>';
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('article');
        card.className = 'credit-card gallery-card';
        card.innerHTML = `
            <img src="${item.imageData}" alt="${item.title}" class="gallery-thumb" />
            <div class="credit-name">${item.title}</div>
            <div class="meta">${new Date(item.updatedAt).toLocaleString()}</div>
            <div class="row-actions">
                <button type="button" class="gallary-edit btn-secondary" data-id="${item.id}">Edit</button>
                <button type="button" class="gallary-delete btn-danger" data-id="${item.id}">Delete</button>
            </div>
        `;
        list.appendChild(card);
    });

    document.querySelectorAll('.gallary-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = state.gallaryItems.find(g => g.id === Number(btn.dataset.id));
            if (!item) return;
            state.gallaryEditingId = item.id;
            document.getElementById('gallary-title').value = item.title;
            const preview = document.getElementById('gallary-preview');
            preview.src = item.imageData;
            preview.classList.remove('hidden');
            document.getElementById('gallary-form').classList.remove('hidden');
            document.getElementById('gallary-submit-btn').textContent = 'Update Image';
        });
    });

    document.querySelectorAll('.gallary-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            state.gallaryItems = state.gallaryItems.filter(g => g.id !== Number(btn.dataset.id));
            saveGallaryItems();
            if (state.gallaryEditingId === Number(btn.dataset.id)) {
                resetGallaryForm();
            }
            renderGallary();
        });
    });
}

function addCreditDraft() {
    state.creditCustomers.unshift({
        id: null,
        tempId: state.tempCreditId--,
        imageUrl: '',
        name: '',
        mobile: '',
        address: '',
        amount: 0
    });
    renderCreditCustomers();
}

async function saveCreditCustomer(key) {
    const card = document.querySelector(`.credit-card[data-key="${key}"]`);
    if (!card) return;

    const getValue = (field) => (card.querySelector(`[data-field="${field}"]`)?.value || '').trim();
    const payload = {
        imageUrl: getValue('imageUrl') || null,
        name: getValue('name'),
        mobile: getValue('mobile') || null,
        address: getValue('address'),
        amount: Number(getValue('amount') || 0)
    };

    if (!payload.name) return alert('Customer name is required');
    if (!payload.address) return alert('Address is required');
    if (payload.amount < 0) return alert('Amount cannot be negative');

    const existing = state.creditCustomers.find(c => (c.id ?? c.tempId) === key);
    if (!existing) return;

    if (existing.id == null) {
        await api('/api/credit-customers', { method: 'POST', body: JSON.stringify(payload) });
    } else {
        await api(`/api/credit-customers/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    }

    await refreshCreditCustomers();
    await refreshSummary();
}

async function deleteCreditCustomer(key) {
    const existing = state.creditCustomers.find(c => (c.id ?? c.tempId) === key);
    if (!existing) return;

    if (existing.id == null) {
        state.creditCustomers = state.creditCustomers.filter(c => (c.id ?? c.tempId) !== key);
        renderCreditCustomers();
        return;
    }

    await api(`/api/credit-customers/${existing.id}`, { method: 'DELETE' });
    await refreshCreditCustomers();
    await refreshSummary();
}

function renderInvoices() {
    const tbody = document.getElementById('invoice-table');
    tbody.innerHTML = '';
    state.invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${inv.id}</td>
            <td>${inv.sellerName || '-'}</td>
            <td>${inv.customerName || 'Walk-in'}</td>
            <td>${Number(inv.totalAmount).toFixed(2)}</td>
            <td>${new Date(inv.createdAt).toLocaleString()}</td>
            <td>
                <div class="row-actions">
                    <button class="view-invoice btn-secondary" data-id="${inv.id}">View Bill</button>
                    <button class="wa-invoice" data-id="${inv.id}">WhatsApp</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.view-invoice').forEach(btn => {
    btn.addEventListener('click', async () => {
        try {
            // Open the window FIRST (before await)
            const printWin = window.open('', '_blank');
            const invoice = await api(`/api/invoices/${btn.dataset.id}`);

            if (!printWin) return alert('Please allow popups for this site.');

            const lines = (invoice.items || []).map((item, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${item.itemName}</td>
                    <td>${item.quantity}</td>
                    <td>${Number(item.unitPrice).toFixed(2)}</td>
                    <td>${Number(item.lineTotal).toFixed(2)}</td>
                </tr>`).join('');

            const html = `<!doctype html>
            <html>
            <head><title>Invoice #${invoice.id}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
                .head { display:flex; justify-content:space-between; }
            </style></head>
            <body>
                <div class="head">
                    <h2>Invoice #${invoice.id}</h2>
                    <div>${new Date(invoice.createdAt).toLocaleString()}</div>
                </div>
                <div><strong>Shop:</strong> ${state.settings.shopName || 'My Shop'}</div>
                <div><strong>Seller:</strong> ${invoice.sellerName || '-'}</div>
                <div><strong>Customer:</strong> ${invoice.customerName || 'Walk-in'}</div>
                <div><strong>Contact:</strong> ${invoice.customerContact || '-'}</div>
                <table>
                    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                    <tbody>${lines}</tbody>
                </table>
                <h3 style="text-align:right; margin-top:12px;">Grand Total: ${formatMoney(invoice.totalAmount)}</h3>
            </body></html>`;

            printWin.document.write(html);
            printWin.document.close();
            printWin.focus();
            printWin.print();
        } catch (err) {
            alert(err.message || 'Could not load invoice');
        }
    });
});

document.querySelectorAll('.wa-invoice').forEach(btn => {
    btn.addEventListener('click', async () => {
        try {
            // Open window FIRST before await
            const waWin = window.open('', '_blank');
            const invoice = await api(`/api/invoices/${btn.dataset.id}`);

            const lineText = (invoice.items || [])
                .map(item => `- ${item.itemName} x${item.quantity} = ${Number(item.lineTotal).toFixed(2)}`)
                .join('\n');

            const message = [
                `${state.settings.shopName || 'My Shop'} - Invoice #${invoice.id}`,
                `Seller: ${invoice.sellerName || '-'}`,
                `Customer: ${invoice.customerName || 'Walk-in'}`,
                `Contact: ${invoice.customerContact || '-'}`,
                '',
                lineText,
                '',
                `Total: ${formatMoney(invoice.totalAmount)}`
            ].join('\n');

            const digits = (invoice.customerContact || '').replace(/\D/g, '');
            const waUrl = digits
                ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
                : `https://wa.me/?text=${encodeURIComponent(message)}`;

            // Redirect the already-opened window to WhatsApp URL
            waWin.location.href = waUrl;
        } catch (err) {
            alert(err.message || 'Could not load invoice');
        }
    });
});
}

function collectBillingItems() {
    return Object.entries(state.billingQuantities)
        .map(([productId, quantity]) => ({ productId: Number(productId), quantity: Number(quantity) }))
        .filter(item => item.quantity > 0);
}

function openPrintableBill(invoice) {
    const lines = (invoice.items || []).map((item, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${item.itemName}</td>
            <td>${item.quantity}</td>
            <td>${Number(item.unitPrice).toFixed(2)}</td>
            <td>${Number(item.lineTotal).toFixed(2)}</td>
        </tr>`).join('');

    const html = `<!doctype html>
    <html>
    <head><title>Invoice #${invoice.id}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .head { display:flex; justify-content:space-between; }
    </style></head>
    <body>
        <div class="head">
            <h2>Invoice #${invoice.id}</h2>
            <div>${new Date(invoice.createdAt).toLocaleString()}</div>
        </div>
        <div><strong>Shop:</strong> ${state.settings.shopName || 'My Shop'}</div>
        <div><strong>Seller:</strong> ${invoice.sellerName || '-'}</div>
        <div><strong>Customer:</strong> ${invoice.customerName || 'Walk-in'}</div>
        <div><strong>Contact:</strong> ${invoice.customerContact || '-'}</div>
        <table>
            <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${lines}</tbody>
        </table>
        <h3 style="text-align:right; margin-top:12px;">Grand Total: ${formatMoney(invoice.totalAmount)}</h3>
    </body></html>`;

    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    printWin.print();
}

function sendInvoiceOnWhatsApp(invoice) {
    const lineText = (invoice.items || [])
        .map(item => `- ${item.itemName} x${item.quantity} = ${Number(item.lineTotal).toFixed(2)}`)
        .join('\n');

    const message = [
        `${state.settings.shopName || 'My Shop'} - Invoice #${invoice.id}`,
        `Seller: ${invoice.sellerName || '-'}`,
        `Customer: ${invoice.customerName || 'Walk-in'}`,
        `Contact: ${invoice.customerContact || '-'}`,
        '',
        lineText,
        '',
        `Total: ${formatMoney(invoice.totalAmount)}`
    ].join('\n');

    const digits = (invoice.customerContact || '').replace(/\D/g, '');
    const waUrl = digits
        ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
}

async function createBill(action) {
    const sellerName = document.getElementById('bill-seller').value;
    const customerName = document.getElementById('bill-customer-name').value;
    const customerContact = document.getElementById('bill-customer-contact').value;
    const items = collectBillingItems();

    if (!sellerName) return alert('Please select a seller from Settings-enabled sellers.');
    if (!items.length) return alert('Please add quantity for at least one item.');

    const invoice = await api('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({ sellerName, customerName, customerContact, items })
    });

    state.billingQuantities = {};
    document.getElementById('bill-customer-name').value = '';
    document.getElementById('bill-customer-contact').value = '';

    await refreshProducts();
    await refreshInvoices();
    await refreshSummary();

    if (action === 'pdf') openPrintableBill(invoice);
    if (action === 'whatsapp') sendInvoiceOnWhatsApp(invoice);
}

async function refreshSummary() {
    state.summary = await api('/api/invoices/summary');
    renderDashboard();
}

async function refreshProducts() {
    state.products = await api('/api/products');
    renderProducts();
    renderBillingItems();
    renderDashboard();
    await refreshReorders();
}

async function refreshReorders() {
    state.reorders = await api('/api/reorders');
    renderReorders();
}

async function refreshCreditCustomers() {
    const persisted = await api('/api/credit-customers');
    const drafts = state.creditCustomers.filter(c => c.id == null);
    state.creditCustomers = [...drafts, ...persisted];
    renderCreditCustomers();
    renderDashboard();
}

async function refreshInvoices() {
    state.invoices = await api('/api/invoices');
    renderInvoices();
    renderDashboard();
}

async function refreshSettings() {
    state.settings = await api('/api/settings');
    renderSettings();
}

async function refreshSellers() {
    state.sellers = await api('/api/sellers');
    renderSellers();
}

async function refreshLinkedAccounts() {
    state.linkedAccounts = await api('/api/linked-accounts');
    renderLinkedAccounts();
}

async function refreshNotes() {
    state.notes = await api('/api/notes');
    renderNotes();
}

function refreshGallary() {
    state.gallaryItems = loadGallaryItems();
    renderGallary();
}

async function loadAll() {
    await Promise.all([
        refreshSummary(),
        refreshProducts(),
        refreshCreditCustomers(),
        refreshInvoices(),
        refreshSettings(),
        refreshSellers(),
        refreshLinkedAccounts(),
        refreshNotes()
    ]);
    refreshGallary();
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        imageUrl: document.getElementById('product-image').value || 'https://placehold.co/72x72/png',
        quantity: Number(document.getElementById('product-qty').value),
        minimumQuantity: Number(document.getElementById('product-min-qty').value),
        cost: Number(document.getElementById('product-cost').value),
        price: Number(document.getElementById('product-price').value),
    };

    if (state.productEditingId) {
        await api(`/api/products/${state.productEditingId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
        await api('/api/products', { method: 'POST', body: JSON.stringify(body) });
    }

    resetProductForm();
    await refreshProducts();
    await refreshSummary();
});

document.getElementById('reorder-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        itemName: document.getElementById('reorder-item-name').value,
        imageUrl: document.getElementById('reorder-item-image').value || null,
        cost: Number(document.getElementById('reorder-item-cost').value),
        quantity: Number(document.getElementById('reorder-item-qty').value)
    };

    if (state.reorderEditingId) {
        await api(`/api/reorders/${state.reorderEditingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
        await api('/api/reorders', { method: 'POST', body: JSON.stringify(payload) });
    }

    resetReorderForm();
    await refreshReorders();
});

document.getElementById('stock-search').addEventListener('input', (e) => {
    state.stockSearchQuery = e.target.value;
    renderProducts();
});

document.getElementById('reorder-search').addEventListener('input', (e) => {
    state.reorderSearchQuery = e.target.value;
    renderReorders();
});

document.getElementById('add-reorder-btn').addEventListener('click', () => {
    resetReorderForm();
    document.getElementById('reorder-form').classList.remove('hidden');
});

document.getElementById('credit-search').addEventListener('input', (e) => {
    state.creditSearchQuery = e.target.value;
    renderCreditCustomers();
});

document.getElementById('add-credit-btn').addEventListener('click', () => {
    addCreditDraft();
});

document.getElementById('notes-search').addEventListener('input', (e) => {
    state.notesSearchQuery = e.target.value;
    renderNotes();
});

document.getElementById('gallary-search').addEventListener('input', (e) => {
    state.gallarySearchQuery = e.target.value;
    renderGallary();
});

document.getElementById('add-gallary-btn').addEventListener('click', () => {
    resetGallaryForm();
    document.getElementById('gallary-form').classList.remove('hidden');
});

document.getElementById('gallary-image').addEventListener('change', async (e) => {
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
    } catch (err) {
        alert(err.message || 'Unable to preview image');
    }
});

document.getElementById('gallary-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('gallary-title').value.trim();
    const file = document.getElementById('gallary-image').files?.[0];
    if (!title) return;

    const existing = state.gallaryItems.find(g => g.id === state.gallaryEditingId);
    let imageData = existing?.imageData || '';

    if (file) {
        try {
            imageData = await fileToDataUrl(file);
        } catch (err) {
            alert(err.message || 'Unable to read selected image');
            return;
        }
    }

    if (!imageData) {
        alert('Please select an image');
        return;
    }

    const now = new Date().toISOString();
    if (state.gallaryEditingId && existing) {
        existing.title = title;
        existing.imageData = imageData;
        existing.updatedAt = now;
    } else {
        state.gallaryItems.unshift({
            id: Date.now(),
            title,
            imageData,
            updatedAt: now
        });
    }

    saveGallaryItems();
    resetGallaryForm();
    document.getElementById('gallary-form').classList.add('hidden');
    renderGallary();
});

document.getElementById('generate-pdf-btn').addEventListener('click', async () => {
    try {
        await createBill('pdf');
    } catch (err) {
        alert(err.message || 'Failed to generate bill PDF');
    }
});

document.getElementById('send-whatsapp-btn').addEventListener('click', async () => {
    try {
        await createBill('whatsapp');
    } catch (err) {
        alert(err.message || 'Failed to send bill');
    }
});

document.getElementById('shop-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        ...state.settings,
        shopName: document.getElementById('shop-name').value.trim(),
        description: document.getElementById('shop-description').value.trim()
    };
    state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    await refreshSettings();
});

document.getElementById('dark-mode-toggle').addEventListener('change', async (e) => {
    state.settings.darkMode = e.target.checked;
    applyTheme();
    state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(state.settings) });
    renderSettings();
});

document.getElementById('multi-account-toggle').addEventListener('change', async (e) => {
    state.settings.multiAccountEnabled = e.target.checked;
    state.settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(state.settings) });
    renderSettings();
});

document.getElementById('seller-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('seller-name').value.trim();
    if (!name) return;

    await api('/api/sellers', {
        method: 'POST',
        body: JSON.stringify({ name, enabled: true })
    });

    document.getElementById('seller-form').reset();
    await refreshSellers();
});

document.getElementById('linked-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('linked-account-email').value.trim();
    if (!email) return;

    await api('/api/linked-accounts', {
        method: 'POST',
        body: JSON.stringify({ email, enabled: true })
    });

    document.getElementById('linked-account-form').reset();
    await refreshLinkedAccounts();
});

document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('note-title').value.trim(),
        content: document.getElementById('note-content').value.trim()
    };

    if (!payload.title || !payload.content) return;

    if (state.noteEditingId) {
        await api(`/api/notes/${state.noteEditingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
        await api('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
    }

    document.getElementById('note-form').reset();
    state.noteEditingId = null;
    document.getElementById('note-submit-btn').textContent = 'Add Note';
    await refreshNotes();
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.view).classList.remove('hidden');
    });
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem(tokenKey);
    state.token = '';
    showAuth();
});

(async function init() {
    if (!state.token) {
        showAuth();
        return;
    }
    try {
        await loadAll();
        showApp();
    } catch {
        localStorage.removeItem(tokenKey);
        state.token = '';
        showAuth();
    }
})();
