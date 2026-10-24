/* =========================================================
   SmartBin — раздел «Архив» в админке
   Сюда уходят выполненные заказы и обработанные обращения.
   Записи можно вернуть в работу, удалить и выгрузить в CSV.
   ========================================================= */
(function () {
    'use strict';

    const panel = document.querySelector('[data-panel="archive"]');
    if (!panel || !window.SBArchive) return;

    const ordersBody = panel.querySelector('[data-archive-orders]');
    const ordersWrap = panel.querySelector('[data-archive-orders-wrap]');
    const ordersEmpty = panel.querySelector('[data-archive-orders-empty]');
    const appealsList = panel.querySelector('[data-archive-appeals]');
    const appealsEmpty = panel.querySelector('[data-archive-appeals-empty]');
    const searchInput = panel.querySelector('[data-archive-search]');
    const countOrders = panel.querySelector('[data-archive-count-orders]');
    const countAppeals = panel.querySelector('[data-archive-count-appeals]');
    const badge = document.querySelector('[data-archive-badge]');
    const tabs = Array.prototype.slice.call(panel.querySelectorAll('[data-archive-tab]'));
    const bulkBtn = panel.querySelector('[data-archive-bulk]');
    const csvBtn = panel.querySelector('[data-archive-csv]');
    const jsonBtn = panel.querySelector('[data-archive-json]');
    const clearBtn = panel.querySelector('[data-archive-clear]');

    const ORDERS_KEY = 'smartbin_orders_v1';
    const STATUS_LABELS = { new: 'Новый', progress: 'В работе', done: 'Выполнен' };
    const STATUS_CLASS = { new: 'pill--new', progress: 'pill--progress', done: 'pill--done' };

    let tab = 'orders';
    let query = '';
    let timer = null;

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function money(value) {
        if (window.SB && SB.formatPrice) return SB.formatPrice(value);
        return new Intl.NumberFormat('ru-RU').format(Math.round(Number(value) || 0)) + ' ₽';
    }

    function toast(title, options) {
        if (window.SB && SB.toast) SB.toast(title, options);
    }

    function dateText(iso) {
        return window.SBArchive ? SBArchive.formatDate(iso) : '';
    }

    function readOrdersStore() {
        try {
            const raw = localStorage.getItem(ORDERS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (err) {
            return [];
        }
    }

    function writeOrdersStore(list) {
        try {
            localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
        } catch (err) {
            /* хранилище недоступно */
        }
        document.dispatchEvent(new CustomEvent('sb:orders-restored'));
    }

    /* ---------- Счётчики ---------- */
    function renderCounts() {
        const data = SBArchive.read();
        const orders = data.orders.length;
        const appeals = data.appeals.length;

        if (countOrders) countOrders.textContent = String(orders);
        if (countAppeals) countAppeals.textContent = String(appeals);

        if (badge) {
            const total = orders + appeals;
            badge.textContent = String(total);
            badge.hidden = total === 0;
        }
    }

    /* ---------- Заказы ---------- */
    function renderOrders() {
        const list = SBArchive.orders(query);

        if (ordersEmpty) {
            ordersEmpty.hidden = list.length > 0;
            ordersEmpty.innerHTML = query
                ? '<b>Ничего не найдено</b>Попробуйте другой запрос — архив ищет по номеру, клиенту, телефону и товарам.'
                : '<b>Архив заказов пуст</b>Отметьте выполненный заказ кнопкой «В архив» в разделе «Заказы» — он переедет сюда.';
        }

        if (ordersWrap) ordersWrap.hidden = list.length === 0;
        if (!ordersBody) return;

        ordersBody.innerHTML = list.map(function (record) {
            const status = record.status || 'new';
            const source = record.source === 'remote' ? 'сайт' : 'панель';
            const items = (record.items || []).map(function (item) {
                return esc(item.name) + ' × ' + esc(item.qty);
            }).join(', ');

            return '<tr>' +
                '<td><b>' + esc(record.number) + '</b><small>' + esc(dateText(record.createdAt)) + '</small></td>' +
                '<td><b>' + esc(record.customer || 'Без имени') + '</b><small>' + esc(record.phone || '—') + '</small></td>' +
                '<td><b>' + money(record.total) + '</b><small>' + (items || 'без товаров') + '</small></td>' +
                '<td><span class="pill ' + (STATUS_CLASS[status] || 'pill--new') + '">' +
                    (STATUS_LABELS[status] || 'Новый') + '</span><small>' + esc(source) + '</small></td>' +
                '<td>' + esc(dateText(record.archivedAt)) + '</td>' +
                '<td class="archive-actions">' +
                    '<button class="btn btn--sm btn--outline" type="button" data-archive-restore="' + esc(record.uid) + '">Вернуть</button>' +
                    '<button class="btn btn--sm btn--ghost" type="button" data-archive-drop="' + esc(record.uid) + '">Удалить</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    }

    /* ---------- Обращения ---------- */
    function renderAppeals() {
        const list = SBArchive.appeals(query);

        if (!appealsList) return;

        if (appealsEmpty) {
            appealsEmpty.hidden = list.length > 0;
            appealsEmpty.innerHTML = query
                ? '<b>Ничего не найдено</b>Поиск идёт по имени, контакту, тексту обращения и ответу.'
                : '<b>Архив обращений пуст</b>Отвеченные сообщения убираются сюда кнопкой «В архив» в разделе «Обращения».';
        }

        appealsList.hidden = list.length === 0;

        appealsList.innerHTML = list.map(function (record) {
            const head = '<div class="chat-item__head">' +
                '<b>' + (esc(record.name) || 'Гость') + '</b>' +
                '<span>' + esc(dateText(record.createdAt)) +
                    (record.contact ? ' · ' + esc(record.contact) : '') +
                    ' · в архиве ' + esc(dateText(record.archivedAt)) +
                '</span>' +
            '</div>';

            const body = '<p class="chat-item__text">' + esc(record.text) + '</p>';

            const reply = record.reply
                ? '<div class="chat-reply"><b>Ответ:</b> ' + esc(record.reply) +
                    (record.replyTs ? '<div class="chat-item__head" style="margin-top:4px">' + esc(dateText(record.replyTs)) + '</div>' : '') +
                  '</div>'
                : '<p class="admin-hint" style="margin:0 0 10px">Без ответа — обращение закрыто вручную.</p>';

            const actions = '<div class="archive-actions">' +
                '<button class="btn btn--sm btn--outline" type="button" data-archive-restore="' + esc(record.uid) + '">Вернуть в обращения</button>' +
                '<button class="btn btn--sm btn--ghost" type="button" data-archive-drop="' + esc(record.uid) + '">Удалить</button>' +
            '</div>';

            return '<article class="chat-item">' + head + body + reply + actions + '</article>';
        }).join('');
    }

    function render() {
        tabs.forEach(function (button) {
            const isActive = button.getAttribute('data-archive-tab') === tab;
            button.setAttribute('aria-selected', String(isActive));
            button.classList.toggle('is-active', isActive);
        });

        if (ordersWrap) ordersWrap.hidden = tab !== 'orders';
        if (ordersEmpty) ordersEmpty.hidden = tab !== 'orders' || SBArchive.orders(query).length > 0;
        if (appealsList) appealsList.hidden = tab !== 'appeals' || SBArchive.appeals(query).length === 0;
        if (appealsEmpty) appealsEmpty.hidden = tab !== 'appeals' || SBArchive.appeals(query).length > 0;

        if (bulkBtn) {
            bulkBtn.textContent = tab === 'orders'
                ? 'Выполненные заказы → в архив'
                : 'Отвеченные обращения → в архив';
        }

        renderCounts();
        if (tab === 'orders') renderOrders();
        else renderAppeals();
    }

    /* ---------- Действия ---------- */
    function restoreLocalOrder(record) {
        if (!record || record.source !== 'local') return;

        const list = readOrdersStore();
        const exists = list.some(function (order) {
            return String(order.number) === String(record.number);
        });
        if (exists) return;

        const order = record.payload || {
            number: record.number,
            createdAt: record.createdAt,
            items: record.items,
            total: record.total,
            customer: { name: record.customer, phone: record.phone }
        };

        list.unshift(order);
        writeOrdersStore(list);
    }

    function handleRestore(uid) {
        // uid ищем в обоих списках: заказы и обращения.
        const record = SBArchive.read().orders.find(function (item) { return item.uid === uid; }) || null;

        if (record) {
            const removed = SBArchive.takeOrder(uid);
            if (!removed) return;
            restoreLocalOrder(removed);
            toast('Заказ возвращён', {
                type: 'success',
                text: removed.source === 'remote'
                    ? 'Заказ снова виден в «Заказах с сайта».'
                    : 'Заказ снова в списке «Заказы».'
            });
            render();
            return;
        }

        const appeal = SBArchive.takeAppeal(uid);
        if (appeal) {
            toast('Обращение возвращено', {
                type: 'success',
                text: 'Сообщение снова появится в разделе «Обращения».'
            });
            render();
        }
    }

    function handleDrop(uid) {
        if (!window.confirm('Удалить запись из архива безвозвратно?')) return;

        const removedOrder = SBArchive.takeOrder(uid);
        if (removedOrder) {
            toast('Удалено из архива', { type: 'info', text: 'Заказ ' + removedOrder.number + ' удалён безвозвратно.', duration: 3200 });
            render();
            return;
        }

        const removedAppeal = SBArchive.takeAppeal(uid);
        if (removedAppeal) {
            toast('Удалено из архива', { type: 'info', text: 'Обращение удалено безвозвратно.', duration: 3200 });
            render();
        }
    }

    function bulkArchive() {
        let count = 0;

        if (tab === 'orders') {
            const statuses = window.SBAdminData ? SBAdminData.getStatuses() : {};

            (window.SBAdminData ? SBAdminData.getOrders() : []).forEach(function (order) {
                if ((statuses[order.number] || 'new') !== 'done') return;
                const customer = order.customer || {};
                const record = SBArchive.archiveOrder({
                    source: 'local',
                    ref: order.number,
                    number: order.number,
                    customer: customer.name || '',
                    phone: customer.phone || '',
                    items: order.items,
                    total: order.total,
                    status: 'done',
                    createdAt: order.createdAt,
                    payload: order
                });
                if (record) count += 1;
            });

            (window.SBAdminOrders ? SBAdminOrders.raw() : []).forEach(function (order) {
                if (order.legacy || (order.status || 'new') !== 'done') return;
                const record = SBArchive.archiveOrder({
                    source: 'remote',
                    ref: order.id,
                    number: order.number,
                    customer: order.name || '',
                    phone: order.phone || '',
                    items: order.items,
                    total: order.total,
                    status: 'done',
                    createdAt: order.ts,
                    payload: order
                });
                if (record) count += 1;
            });
        } else {
            (window.SBAdminChat ? SBAdminChat.raw() : []).forEach(function (message) {
                if (!message.reply) return;
                if (SBArchive.archiveAppeal(message)) count += 1;
            });
        }

        if (!count) {
            toast('Нечего архивировать', {
                type: 'warning',
                text: tab === 'orders'
                    ? 'Среди заказов нет выполненных — переведите статус в «Выполнен».'
                    : 'Среди обращений нет отвеченных.'
            });
            return;
        }

        toast('В архив отправлено: ' + count, {
            type: 'success',
            text: tab === 'orders' ? 'Выполненные заказы убраны из работы.' : 'Отвеченные обращения убраны из ленты.'
        });
        render();
    }

    function exportCsv() {
        if (tab === 'orders') {
            const list = SBArchive.orders(query);
            if (!list.length) {
                toast('Архив пуст', { type: 'warning', text: 'Нечего выгружать.' });
                return;
            }
            SBArchive.download(SBArchive.fileName('smartbin-zakazy', 'csv'), SBArchive.ordersCsv(list), 'text/csv');
            toast('CSV готов', { type: 'success', text: 'Заказов в файле: ' + list.length });
            return;
        }

        const list = SBArchive.appeals(query);
        if (!list.length) {
            toast('Архив пуст', { type: 'warning', text: 'Нечего выгружать.' });
            return;
        }
        SBArchive.download(SBArchive.fileName('smartbin-obrascheniya', 'csv'), SBArchive.appealsCsv(list), 'text/csv');
        toast('CSV готов', { type: 'success', text: 'Обращений в файле: ' + list.length });
    }

    function exportJson() {
        const data = SBArchive.read();
        if (!data.orders.length && !data.appeals.length) {
            toast('Архив пуст', { type: 'warning', text: 'Нечего выгружать.' });
            return;
        }
        SBArchive.download(SBArchive.fileName('smartbin-arhiv', 'json'), JSON.stringify(data, null, 2) + '\n', 'application/json');
        toast('JSON готов', { type: 'success', text: 'Файл содержит заказы и обращения.' });
    }

    /* ---------- События ---------- */
    panel.addEventListener('click', function (event) {
        const restore = event.target.closest('[data-archive-restore]');
        if (restore) {
            handleRestore(restore.getAttribute('data-archive-restore'));
            return;
        }

        const drop = event.target.closest('[data-archive-drop]');
        if (drop) handleDrop(drop.getAttribute('data-archive-drop'));
    });

    tabs.forEach(function (button) {
        button.addEventListener('click', function () {
            tab = button.getAttribute('data-archive-tab');
            render();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            window.clearTimeout(timer);
            timer = window.setTimeout(function () {
                query = searchInput.value;
                render();
            }, 140);
        });
    }

    if (bulkBtn) bulkBtn.addEventListener('click', bulkArchive);
    if (csvBtn) csvBtn.addEventListener('click', exportCsv);
    if (jsonBtn) jsonBtn.addEventListener('click', exportJson);

    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            const data = SBArchive.read();
            const total = data.orders.length + data.appeals.length;
            if (!total) {
                toast('Архив пуст', { type: 'info', text: 'Удалять нечего.' });
                return;
            }
            if (!window.confirm('Очистить архив целиком? Записей: ' + total + '. Действие необратимо.')) return;

            SBArchive.replace({ orders: [], appeals: [] });
            toast('Архив очищен', { type: 'info', text: 'Удалено записей: ' + total, duration: 3200 });
            render();
        });
    }

    document.addEventListener('sb:archive-changed', render);
    document.addEventListener('sb:orders-restored', renderCounts);

    document.addEventListener('sb:view', function (event) {
        if (event.detail && event.detail.view === 'archive') render();
        else renderCounts();
    });

    // admin.js переключает раздел раньше, чем загрузился этот файл,
    // поэтому прямую ссылку ?view=archive дорисовываем сами.
    let requested = '';
    try {
        requested = new URLSearchParams(window.location.search).get('view') || '';
    } catch (err) {
        requested = '';
    }

    if (requested === 'archive') render();
    else renderCounts();
})();
