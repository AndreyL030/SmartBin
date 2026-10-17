/* =========================================================
   SmartBin — админ-панель
   Демо-режим: данные живут в localStorage браузера.
   ========================================================= */
(function () {
    'use strict';

    // Демо-гейт, а не аутентификация: в коде нет пароля в открытом виде,
    // но любой, кто откроет исходники, всё равно сможет войти. Не защищайте
    // этой панелью реальные данные.
    const PASS_HASH = 0x56a4850f;
    const SESSION_KEY = 'smartbin_admin_session';
    const OVERRIDES_KEY = 'smartbin_product_overrides_v1';
    const STATUS_KEY = 'smartbin_order_status_v1';
    const BINS_KEY = 'smartbin_bins_v1';
    const ORDERS_KEY = 'smartbin_orders_v1';

    const ALERT_LEVEL = 80;
    const FREE_DELIVERY_FROM = 50000;
    const DELIVERY_PRICE = 590;

    const LEVELS = [
        { key: 'plastic', label: 'Пластик' },
        { key: 'glass', label: 'Стекло' },
        { key: 'paper', label: 'Бумага' },
        { key: 'organic', label: 'Органика' }
    ];

    const STATUSES = [
        { key: 'new', label: 'Новый', cls: 'pill--new' },
        { key: 'progress', label: 'В работе', cls: 'pill--progress' },
        { key: 'done', label: 'Выполнен', cls: 'pill--done' }
    ];

    const DEFAULT_BINS = [
        { id: 'bin-1', model: 'SmartBin Eco', place: 'Офис, 3 этаж', levels: { plastic: 72, glass: 34, paper: 88, organic: 21 } },
        { id: 'bin-2', model: 'SmartBin Pro', place: 'Переговорная «Волга»', levels: { plastic: 45, glass: 62, paper: 30, organic: 55 } },
        { id: 'bin-3', model: 'SmartBin Eco', place: 'Кухня, 2 этаж', levels: { plastic: 91, glass: 18, paper: 24, organic: 78 } }
    ];

    const VIEWS = {
        overview: { title: 'Обзор', subtitle: 'Заказы, выручка и состояние урн' },
        orders: { title: 'Заказы', subtitle: 'Клиенты, суммы и статусы' },
        products: { title: 'Товары', subtitle: 'Цены и наличие на витрине' },
        bins: { title: 'Урны', subtitle: 'Заполнение отсеков по датчикам' },
        sync: { title: 'Синхронизация', subtitle: 'Общие данные для всех устройств' }
    };

    const loginEl = document.querySelector('[data-login]');
    const shellEl = document.querySelector('[data-shell]');
    const loginForm = document.querySelector('[data-login-form]');
    const passInput = document.getElementById('adminPass');
    const titleEl = document.querySelector('[data-title]');
    const subtitleEl = document.querySelector('[data-subtitle]');
    const navButtons = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
    const panels = Array.prototype.slice.call(document.querySelectorAll('[data-panel]'));

    let currentView = 'overview';
    let tickTimer = null;

    /* ---------- Утилиты ---------- */
    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed === null ? fallback : parsed;
        } catch (err) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            if (window.SB && SB.toast) {
                SB.toast('Не удалось сохранить', { type: 'error', text: 'Хранилище браузера недоступно.' });
            }
        }
        schedulePush();
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function money(value) {
        if (window.SB && SB.formatPrice) return SB.formatPrice(value);
        return new Intl.NumberFormat('ru-RU').format(Math.round(value)) + ' ₽';
    }

    function products() {
        return (window.SB && SB.products) ? SB.products : [];
    }

    function toast(title, options) {
        if (window.SB && SB.toast) SB.toast(title, options);
    }

    /* ---------- Данные ---------- */
    function getOrders() {
        const list = readJSON(ORDERS_KEY, []);
        return Array.isArray(list) ? list : [];
    }

    function getStatuses() {
        const map = readJSON(STATUS_KEY, {});
        return map && typeof map === 'object' ? map : {};
    }

    function getOverrides() {
        const map = readJSON(OVERRIDES_KEY, {});
        return map && typeof map === 'object' ? map : {};
    }

    function getBins() {
        const stored = readJSON(BINS_KEY, null);
        if (Array.isArray(stored) && stored.length) return stored;
        return DEFAULT_BINS.map(function (bin) {
            return { id: bin.id, model: bin.model, place: bin.place, levels: Object.assign({}, bin.levels) };
        });
    }

    function alertCount(bins) {
        return bins.reduce(function (acc, bin) {
            return acc + LEVELS.filter(function (level) { return Number(bin.levels[level.key]) >= ALERT_LEVEL; }).length;
        }, 0);
    }

    /* ---------- Вход ---------- */
    function hashPass(text) {
        let hash = 0x811c9dc5;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash >>> 0;
    }

    function showPanel() {
        loginEl.hidden = true;
        shellEl.hidden = false;
        document.body.classList.remove('is-locked');
        renderAll();
        startTicker();

        let initial = 'overview';
        try {
            const requested = new URLSearchParams(window.location.search).get('view');
            if (requested && VIEWS[requested]) initial = requested;
        } catch (err) {
            initial = 'overview';
        }
        switchView(initial);
    }

    function showLogin() {
        loginEl.hidden = false;
        shellEl.hidden = true;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const field = passInput.closest('.field');
            const value = passInput.value.trim();

            if (hashPass(value.toLowerCase()) !== PASS_HASH) {
                if (field) field.classList.add('has-error');
                toast('Неверный пароль', {
                    type: 'error',
                    text: 'Демо-доступ: пароль smartbin'
                });
                passInput.focus();
                return;
            }

            if (field) field.classList.remove('has-error');
            try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) { /* приватный режим */ }
            passInput.value = '';
            showPanel();
            toast('Добро пожаловать', { type: 'success', text: 'Панель открыта. Данные — только из этого браузера.' });
        });

        passInput.addEventListener('input', function () {
            const field = passInput.closest('.field');
            if (field) field.classList.remove('has-error');
        });
    }

    const logoutBtn = document.querySelector('[data-logout]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            try { sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* ignore */ }
            window.location.reload();
        });
    }

    /* ---------- Навигация ---------- */
    function switchView(name) {
        if (!VIEWS[name]) return;
        currentView = name;

        navButtons.forEach(function (btn) {
            btn.setAttribute('aria-current', String(btn.getAttribute('data-view') === name));
        });

        panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-panel') !== name;
        });

        titleEl.textContent = VIEWS[name].title;
        subtitleEl.textContent = VIEWS[name].subtitle;

        if (name === 'overview') renderOverview();
        if (name === 'orders') renderOrders();
        if (name === 'products') renderProducts();
        if (name === 'bins') renderBins();
        if (name === 'sync') renderSyncForm();
    }

    navButtons.forEach(function (btn) {
        btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); });
    });

    document.querySelectorAll('[data-goto]').forEach(function (btn) {
        btn.addEventListener('click', function () { switchView(btn.getAttribute('data-goto')); });
    });

    /* ---------- Обзор ---------- */
    function renderStats() {
        const orders = getOrders();
        const bins = getBins();
        const revenue = orders.reduce(function (acc, order) { return acc + Number(order.total || 0); }, 0);
        const alerts = alertCount(bins);

        const ordersEl = document.querySelector('[data-stat="orders"]');
        const revenueEl = document.querySelector('[data-stat="revenue"]');
        const avgEl = document.querySelector('[data-stat="avg"]');
        const alertsEl = document.querySelector('[data-stat="alerts"]');
        const alertCard = document.querySelector('[data-alert-card]');

        if (ordersEl) ordersEl.textContent = String(orders.length);
        if (revenueEl) revenueEl.textContent = money(revenue);
        if (avgEl) avgEl.textContent = money(orders.length ? revenue / orders.length : 0);
        if (alertsEl) alertsEl.textContent = String(alerts);
        if (alertCard) alertCard.classList.toggle('is-alert', alerts > 0);
    }

    function statusOf(number) {
        const statuses = getStatuses();
        return statuses[number] || 'new';
    }

    function statusPill(key) {
        const status = STATUSES.find(function (s) { return s.key === key; }) || STATUSES[0];
        return '<span class="pill ' + status.cls + '">' + status.label + '</span>';
    }

    function renderRecentOrders() {
        const body = document.querySelector('[data-recent-orders]');
        const empty = document.querySelector('[data-recent-empty]');
        if (!body) return;

        const orders = getOrders().slice(0, 5);
        body.innerHTML = orders.map(function (order) {
            const name = order.customer && order.customer.name ? order.customer.name : 'Без имени';
            return '<tr>' +
                '<td><b>' + escapeHtml(order.number) + '</b></td>' +
                '<td>' + escapeHtml(name) + '</td>' +
                '<td><b>' + money(order.total) + '</b></td>' +
                '<td>' + statusPill(statusOf(order.number)) + '</td>' +
            '</tr>';
        }).join('');

        const table = body.closest('.table-scroll');
        if (empty) empty.hidden = orders.length > 0;
        if (table) table.hidden = orders.length === 0;
    }

    function renderAlertBins() {
        const body = document.querySelector('[data-alert-bins]');
        const empty = document.querySelector('[data-alert-empty]');
        if (!body) return;

        const rows = [];
        getBins().forEach(function (bin) {
            LEVELS.forEach(function (level) {
                const value = Number(bin.levels[level.key]) || 0;
                if (value < ALERT_LEVEL) return;
                rows.push(
                    '<tr>' +
                        '<td><b>' + escapeHtml(bin.model) + '</b><small>' + escapeHtml(bin.place) + '</small></td>' +
                        '<td>' + level.label + '</td>' +
                        '<td><span class="pill pill--danger">' + value + '%</span></td>' +
                    '</tr>'
                );
            });
        });

        body.innerHTML = rows.join('');
        const table = body.closest('.table-scroll');
        if (empty) empty.hidden = rows.length > 0;
        if (table) table.hidden = rows.length === 0;
    }

    function renderOverview() {
        renderStats();
        renderRecentOrders();
        renderAlertBins();
    }

    /* ---------- Заказы ---------- */
    function renderOrders() {
        const body = document.querySelector('[data-orders-body]');
        const empty = document.querySelector('[data-orders-empty]');
        if (!body) return;

        const orders = getOrders();
        const statuses = getStatuses();

        body.innerHTML = orders.map(function (order) {
            const customer = order.customer || {};
            const count = (order.items || []).reduce(function (acc, item) { return acc + Number(item.qty || 0); }, 0);
            const date = order.createdAt ? new Date(order.createdAt) : null;
            const dateText = date && !isNaN(date.getTime())
                ? date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) + ', ' +
                  date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                : '—';

            const options = STATUSES.map(function (status) {
                const selected = (statuses[order.number] || 'new') === status.key ? ' selected' : '';
                return '<option value="' + status.key + '"' + selected + '>' + status.label + '</option>';
            }).join('');

            return '<tr>' +
                '<td><b>' + escapeHtml(order.number) + '</b></td>' +
                '<td>' + escapeHtml(dateText) + '</td>' +
                '<td><b>' + escapeHtml(customer.name || 'Без имени') + '</b><small>' + escapeHtml(customer.phone || '') + '</small></td>' +
                '<td>' + count + ' шт</td>' +
                '<td><b>' + money(order.total) + '</b></td>' +
                '<td><select class="status-select" data-status="' + escapeHtml(order.number) + '">' + options + '</select></td>' +
            '</tr>';
        }).join('');

        const table = body.closest('.table-scroll');
        if (empty) empty.hidden = orders.length > 0;
        if (table) table.hidden = orders.length === 0;
    }

    const ordersBody = document.querySelector('[data-orders-body]');
    if (ordersBody) {
        ordersBody.addEventListener('change', function (event) {
            const select = event.target.closest('[data-status]');
            if (!select) return;
            const statuses = getStatuses();
            statuses[select.getAttribute('data-status')] = select.value;
            writeJSON(STATUS_KEY, statuses);
            const label = (STATUSES.find(function (s) { return s.key === select.value; }) || STATUSES[0]).label;
            toast('Статус обновлён', { type: 'success', text: 'Заказ переведён в «' + label + '».', duration: 3000 });
        });
    }

    const seedBtn = document.querySelector('[data-seed-orders]');
    if (seedBtn) {
        seedBtn.addEventListener('click', function () {
            const list = products();
            if (!list.length) {
                toast('Каталог не загрузился', { type: 'error', text: 'Не удалось получить список товаров.' });
                return;
            }

            const samples = [
                { name: 'Анна Смирнова', phone: '+7 900 112-45-67', city: 'Москва', daysAgo: 1, items: [{ id: 'eco', qty: 1 }, { id: 'bags', qty: 2 }] },
                { name: 'ООО «Чистый офис»', phone: '+7 495 120-33-11', city: 'Москва', daysAgo: 4, items: [{ id: 'pro', qty: 2 }, { id: 'wifi', qty: 2 }] },
                { name: 'Игорь Лебедев', phone: '+7 921 555-09-14', city: 'Санкт-Петербург', daysAgo: 9, items: [{ id: 'servo', qty: 1 }, { id: 'sensor', qty: 1 }] }
            ];

            const orders = getOrders();
            let added = 0;

            samples.forEach(function (sample) {
                const items = sample.items.map(function (line) {
                    const product = list.find(function (p) { return p.id === line.id; });
                    if (!product) return null;
                    return { name: product.name, qty: line.qty, price: product.price };
                }).filter(Boolean);

                if (!items.length) return;

                const subtotal = items.reduce(function (acc, item) { return acc + item.price * item.qty; }, 0);
                const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;

                orders.unshift({
                    number: 'SB-' + String(Math.floor(100000 + Math.random() * 900000)),
                    createdAt: new Date(Date.now() - sample.daysAgo * 86400000).toISOString(),
                    items: items,
                    subtotal: subtotal,
                    delivery: delivery,
                    total: subtotal + delivery,
                    customer: { name: sample.name, phone: sample.phone, email: '', city: sample.city, address: sample.city === 'Москва' ? 'ул. Пресненская, 12' : 'Невский пр., 44' },
                    deliveryKind: 'courier'
                });
                added++;
            });

            writeJSON(ORDERS_KEY, orders.slice(0, 20));
            renderOrders();
            renderOverview();
            toast('Добавлено заказов: ' + added, { type: 'success', text: 'Демо-данные сохранены в этом браузере.' });
        });
    }

    const clearOrdersBtn = document.querySelector('[data-clear-orders]');
    if (clearOrdersBtn) {
        clearOrdersBtn.addEventListener('click', function () {
            writeJSON(ORDERS_KEY, []);
            writeJSON(STATUS_KEY, {});
            renderOrders();
            renderOverview();
            toast('Заказы удалены', { type: 'info', text: 'История заказов очищена в этом браузере.', duration: 3200 });
        });
    }

    /* ---------- Товары ---------- */
    function renderProducts() {
        const body = document.querySelector('[data-products-body]');
        if (!body) return;

        const list = products();
        if (!list.length) {
            body.innerHTML = '<tr><td colspan="5">Каталог не загрузился — обновите страницу.</td></tr>';
            return;
        }

        const overrides = getOverrides();

        body.innerHTML = list.map(function (product) {
            const patch = overrides[product.id] || {};
            const price = typeof patch.price === 'number' ? patch.price : product.price;
            const stock = typeof patch.inStock === 'boolean' ? patch.inStock : product.inStock;

            return '<tr>' +
                '<td><b>' + escapeHtml(product.name) + '</b><small>' + escapeHtml(product.id) + '</small></td>' +
                '<td>' + (product.category === 'bin' ? 'Умные урны' : 'Запчасти') + '</td>' +
                '<td><input class="price-input" type="number" min="0" step="10" value="' + price + '" data-price="' + product.id + '" aria-label="Цена ' + escapeHtml(product.name) + '"></td>' +
                '<td><label class="switch"><input type="checkbox" data-stock="' + product.id + '"' + (stock ? ' checked' : '') + '> в наличии</label></td>' +
                '<td><a href="product.html?id=' + encodeURIComponent(product.id) + '" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600">открыть</a></td>' +
            '</tr>';
        }).join('');
    }

    const productsBody = document.querySelector('[data-products-body]');
    if (productsBody) {
        productsBody.addEventListener('change', function (event) {
            const priceInput = event.target.closest('[data-price]');
            const stockInput = event.target.closest('[data-stock]');
            const overrides = getOverrides();

            if (priceInput) {
                const id = priceInput.getAttribute('data-price');
                const product = products().find(function (p) { return p.id === id; });
                const value = Math.max(0, Math.round(Number(priceInput.value) || 0));

                if (!product) return;

                overrides[id] = Object.assign({}, overrides[id], { price: value });
                writeJSON(OVERRIDES_KEY, overrides);

                if (value !== product.price) {
                    toast('Цена обновлена', {
                        type: 'success',
                        text: product.name + ': ' + money(product.price) + ' → ' + money(value)
                    });
                }
                return;
            }

            if (stockInput) {
                const id = stockInput.getAttribute('data-stock');
                const product = products().find(function (p) { return p.id === id; });
                if (!product) return;

                overrides[id] = Object.assign({}, overrides[id], { inStock: stockInput.checked });
                writeJSON(OVERRIDES_KEY, overrides);

                toast(stockInput.checked ? 'Товар в наличии' : 'Товар скрыт из наличия', {
                    type: stockInput.checked ? 'success' : 'warning',
                    text: product.name,
                    duration: 3200
                });
            }
        });
    }

    const resetProductsBtn = document.querySelector('[data-reset-products]');
    if (resetProductsBtn) {
        resetProductsBtn.addEventListener('click', function () {
            try { localStorage.removeItem(OVERRIDES_KEY); } catch (err) { /* ignore */ }
            renderProducts();
            toast('Правки сброшены', { type: 'info', text: 'Витрина снова показывает исходные цены.', duration: 3200 });
        });
    }

    /* ---------- Урны ---------- */
    function levelClass(value) {
        if (value >= ALERT_LEVEL) return ' is-danger';
        if (value >= 60) return ' is-warn';
        return '';
    }

    function renderBins() {
        const grid = document.querySelector('[data-bins]');
        if (!grid) return;

        const bins = getBins();

        grid.innerHTML = bins.map(function (bin) {
            const max = Math.max.apply(null, LEVELS.map(function (level) { return Number(bin.levels[level.key]) || 0; }));
            const badge = max >= ALERT_LEVEL
                ? '<span class="pill pill--danger">пора вынести</span>'
                : '<span class="pill pill--done">в норме</span>';

            const levels = LEVELS.map(function (level) {
                const value = Math.max(0, Math.min(100, Math.round(Number(bin.levels[level.key]) || 0)));
                return '<div class="level">' +
                    '<div class="level__head"><span>' + level.label + '</span><b>' + value + '%</b></div>' +
                    '<div class="level__bar"><div class="level__fill' + levelClass(value) + '" style="width:' + value + '%"></div></div>' +
                '</div>';
            }).join('');

            return '<article class="bin-card">' +
                '<div class="bin-card__head">' +
                    '<div><h3>' + escapeHtml(bin.model) + '</h3><small>' + escapeHtml(bin.place) + '</small></div>' +
                    badge +
                '</div>' + levels +
            '</article>';
        }).join('');
    }

    function tickBins(manual) {
        const bins = getBins();
        const bin = bins[Math.floor(Math.random() * bins.length)];
        const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
        const step = manual ? 5 + Math.floor(Math.random() * 8) : 1 + Math.floor(Math.random() * 4);
        const before = Number(bin.levels[level.key]) || 0;
        const after = Math.min(100, before + step);

        bin.levels[level.key] = after;
        writeJSON(BINS_KEY, bins);

        if (currentView === 'bins') renderBins();
        renderStats();
        if (currentView === 'overview') renderAlertBins();

        if (manual) {
            toast(bin.model + ': ' + level.label.toLowerCase() + ' +' + (after - before) + '%', {
                type: 'info',
                text: 'Заполнение отсека теперь ' + after + '%.',
                duration: 3200
            });
        }

        if (after >= ALERT_LEVEL && before < ALERT_LEVEL) {
            toast('Пора вынести: ' + level.label.toLowerCase(), {
                type: 'warning',
                text: bin.model + ' · ' + bin.place + ' — ' + after + '%'
            });
        }
    }

    const tickBtn = document.querySelector('[data-tick-bins]');
    if (tickBtn) tickBtn.addEventListener('click', function () { tickBins(true); });

    const resetBinsBtn = document.querySelector('[data-reset-bins]');
    if (resetBinsBtn) {
        resetBinsBtn.addEventListener('click', function () {
            try { localStorage.removeItem(BINS_KEY); } catch (err) { /* ignore */ }
            renderBins();
            renderStats();
            renderAlertBins();
            toast('Телеметрия сброшена', { type: 'info', text: 'Вернулись исходные показания датчиков.', duration: 3200 });
        });
    }

    function startTicker() {
        if (tickTimer) return;
        tickTimer = window.setInterval(function () {
            if (document.hidden) return;
            tickBins(false);
        }, 8000);
    }

    /* ---------- Синхронизация с GitHub ---------- */
    const SYNC_LABELS = {
        off: 'не настроено',
        read: 'только чтение',
        ok: 'синхронизировано',
        sending: 'обмен с GitHub…',
        error: 'ошибка синхронизации',
        offline: 'файл недоступен'
    };

    let pushTimer = null;
    let pushInFlight = false;

    function setSyncState(state, text) {
        const pill = document.querySelector('[data-sync-state]');
        if (!pill) return;
        pill.textContent = text || SYNC_LABELS[state] || state;
        pill.className = 'pill ' + (state === 'ok' ? 'pill--done' : (state === 'error' || state === 'offline') ? 'pill--danger' : 'pill--new');
    }

    function renderSyncForm() {
        if (!window.SBSync) {
            setSyncState('error', 'модуль не загружен');
            return;
        }

        const cfg = SBSync.readConfig();
        const put = function (selector, value) {
            const el = document.querySelector(selector);
            if (el) el.value = value;
        };

        put('[data-sync-owner]', cfg.owner);
        put('[data-sync-repo]', cfg.repo);
        put('[data-sync-branch]', cfg.branch);
        put('[data-sync-path]', cfg.path);
        put('[data-sync-token]', cfg.token);

        const enabled = document.querySelector('[data-sync-enabled]');
        if (enabled) enabled.checked = Boolean(cfg.enabled);

        const state = SBSync.status().state;
        setSyncState(state === 'sync' ? 'ok' : state === 'read-only' ? 'read' : 'off');
    }

    function buildPayload() {
        return {
            updatedAt: new Date().toISOString(),
            products: getOverrides(),
            orders: getOrders(),
            orderStatuses: getStatuses(),
            bins: getBins()
        };
    }

    function schedulePush() {
        if (!window.SBSync || !SBSync.isWritable()) return;
        window.clearTimeout(pushTimer);
        pushTimer = window.setTimeout(function () { pushNow(false); }, 900);
    }

    function pushNow(manual) {
        if (!window.SBSync || pushInFlight) return;

        if (SBSync.status().state !== 'sync') {
            if (manual) {
                toast('Запись выключена', { type: 'warning', text: 'Укажите токен и включите переключатель.' });
            }
            return;
        }

        pushInFlight = true;
        setSyncState('sending');

        SBSync.push(buildPayload()).then(function (result) {
            pushInFlight = false;

            if (result.ok) {
                setSyncState('ok');
                toast('Отправлено на GitHub', {
                    type: 'success',
                    text: 'Другие устройства увидят изменения в течение минуты.'
                });
                return;
            }

            setSyncState('error');
            toast('Не удалось отправить', {
                type: 'error',
                text: result.reason === 'not-configured'
                    ? 'Не задан токен доступа.'
                    : 'Проверьте права токена: Contents — Read and write.'
            });
        });
    }

    function hydrateFromShared(manual) {
        if (!window.SBSync) return;

        setSyncState('sending', 'загрузка…');

        SBSync.pull({ timeout: 8000 }).then(function (shared) {
            if (!shared) {
                setSyncState('offline');
                if (manual) {
                    toast('Не удалось загрузить', { type: 'error', text: 'Проверьте владельца, репозиторий и имя файла.' });
                }
                return;
            }

            const hasData = (shared.products && Object.keys(shared.products).length) ||
                (Array.isArray(shared.orders) && shared.orders.length) ||
                (Array.isArray(shared.bins) && shared.bins.length);

            if (!hasData && !SBSync.isWritable()) {
                setSyncState('off');
                if (manual) {
                    toast('Файл пока пустой', { type: 'info', text: 'Данных в репозитории нет — работаем локально.' });
                }
                return;
            }

            try {
                if (shared.products) localStorage.setItem(OVERRIDES_KEY, JSON.stringify(shared.products));
                if (Array.isArray(shared.orders)) localStorage.setItem(ORDERS_KEY, JSON.stringify(shared.orders));
                if (shared.orderStatuses) localStorage.setItem(STATUS_KEY, JSON.stringify(shared.orderStatuses));
                if (Array.isArray(shared.bins) && shared.bins.length) localStorage.setItem(BINS_KEY, JSON.stringify(shared.bins));
            } catch (err) {
                /* хранилище недоступно — показываем то, что уже есть */
            }

            renderAll();
            setSyncState('ok');

            if (manual) {
                toast('Данные загружены', { type: 'success', text: 'Панель показывает состояние из репозитория.' });
            }
        });
    }

    const syncSaveBtn = document.querySelector('[data-sync-save]');
    if (syncSaveBtn) {
        syncSaveBtn.addEventListener('click', function () {
            if (!window.SBSync) return;

            const value = function (selector) {
                const el = document.querySelector(selector);
                return el ? el.value.trim() : '';
            };

            SBSync.saveConfig({
                owner: value('[data-sync-owner]'),
                repo: value('[data-sync-repo]'),
                branch: value('[data-sync-branch]') || 'main',
                path: value('[data-sync-path]') || 'data/store.json',
                token: value('[data-sync-token]'),
                enabled: Boolean(document.querySelector('[data-sync-enabled]') && document.querySelector('[data-sync-enabled]').checked)
            });

            renderSyncForm();

            const state = SBSync.status().state;
            toast(state === 'sync' ? 'Синхронизация включена' : 'Настройки сохранены', {
                type: state === 'sync' ? 'success' : 'info',
                text: state === 'sync'
                    ? 'Изменения будут уходить в репозиторий.'
                    : 'Для записи нужен токен и включённый переключатель.'
            });
        });
    }

    const syncPullBtn = document.querySelector('[data-sync-pull]');
    if (syncPullBtn) syncPullBtn.addEventListener('click', function () { hydrateFromShared(true); });

    const syncPushBtn = document.querySelector('[data-sync-push]');
    if (syncPushBtn) syncPushBtn.addEventListener('click', function () { pushNow(true); });

    /* ---------- Запуск ---------- */
    function renderAll() {
        renderOverview();
        renderOrders();
        renderProducts();
        renderBins();
    }

    let session = false;
    try { session = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (err) { session = false; }

    if (session) {
        showPanel();
        hydrateFromShared(false);
    } else {
        showLogin();
        if (passInput) passInput.focus();
    }
})();
