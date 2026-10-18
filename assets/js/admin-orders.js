/* =========================================================
   SmartBin — «Заказы с сайта» в админке
   Читает заказы из канала (Apps Script), меняет статусы.
   Если развёрнут старый скрипт без заказов, показывает их
   как сообщения чата — чтобы ничего не потерялось.
   ========================================================= */
(function () {
    'use strict';

    const panel = document.querySelector('[data-panel="ordersRemote"]');
    if (!panel) return;

    const body = document.querySelector('[data-orders-remote-body]');
    const table = document.querySelector('[data-orders-remote-table]');
    const empty = document.querySelector('[data-orders-remote-empty]');
    const stateEl = document.querySelector('[data-orders-remote-state]');
    const refreshBtn = document.querySelector('[data-orders-remote-refresh]');
    const badge = document.querySelector('[data-orders-remote-badge]');

    const STATUSES = [
        { key: 'new', label: 'Новый' },
        { key: 'progress', label: 'В работе' },
        { key: 'done', label: 'Выполнен' }
    ];

    let orders = [];
    let loading = false;

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function money(value) {
        return window.SB && SB.formatPrice ? SB.formatPrice(value) : String(value) + ' ₽';
    }

    function setState(text, cls) {
        if (!stateEl) return;
        stateEl.textContent = text;
        stateEl.className = 'pill ' + (cls || 'pill--new');
    }

    function toast(title, options) {
        if (window.SB && SB.toast) SB.toast(title, options);
    }

    function formatDate(iso) {
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function itemsSummary(items) {
        if (!Array.isArray(items) || !items.length) return '—';
        return items.map(function (item) {
            return esc(item.name) + ' × ' + esc(item.qty);
        }).join('; ');
    }

    function itemsCount(items) {
        if (!Array.isArray(items)) return 0;
        return items.reduce(function (acc, item) { return acc + Number(item.qty || 0); }, 0);
    }

    function renderHint(text) {
        if (table) table.hidden = true;
        if (!empty) return;
        empty.hidden = false;
        empty.innerHTML = text;
    }

    function render() {
        if (!body) return;

        if (!orders.length) {
            body.innerHTML = '';
            renderHint('<b>Заказов пока нет</b>Оформите заказ на сайте с любого устройства — он появится здесь.');
            return;
        }

        if (table) table.hidden = false;
        if (empty) empty.hidden = true;

        body.innerHTML = orders.slice().reverse().map(function (order) {
            const options = STATUSES.map(function (status) {
                return '<option value="' + status.key + '"' +
                    ((order.status || 'new') === status.key ? ' selected' : '') + '>' + status.label + '</option>';
            }).join('');

            const customer = '<b>' + (esc(order.name) || 'Без имени') + '</b>' +
                (order.phone ? '<small>' + esc(order.phone) + '</small>' : '') +
                (order.city ? '<small>' + esc(order.city) + (order.address ? ', ' + esc(order.address) : '') + '</small>' : '');

            return '<tr>' +
                '<td><b>' + esc(order.number) + '</b>' + (order.legacy ? '<small>из чата</small>' : '') + '</td>' +
                '<td>' + esc(formatDate(order.ts)) + '</td>' +
                '<td>' + customer + '</td>' +
                '<td>' + (order.legacy ? '—' : itemsCount(order.items) + ' шт') +
                    (order.legacy ? '<small>' + esc(order.text).slice(0, 120) + '</small>' : '<small>' + itemsSummary(order.items) + '</small>') +
                '</td>' +
                '<td><b>' + (order.total ? money(order.total) : '—') + '</b></td>' +
                '<td>' + (order.legacy
                    ? '<span class="pill pill--progress">из чата</span>'
                    : '<select class="status-select" data-order-id="' + esc(order.id) + '">' + options + '</select>') +
                '</td>' +
            '</tr>';
        }).join('');
    }

    function updateBadge() {
        if (!badge) return;
        const fresh = orders.filter(function (order) {
            return !order.legacy && (order.status || 'new') === 'new';
        }).length;
        badge.textContent = String(fresh);
        badge.hidden = fresh === 0;
    }

    // Старый скрипт не умеет отдавать заказы — показываем их из чата.
    function legacyFromChat() {
        return SBChat.list().then(function (result) {
            if (!result || !result.ok || !Array.isArray(result.messages)) return [];

            return result.messages
                .filter(function (message) {
                    return String(message.name || '').indexOf('Заказ ') === 0;
                })
                .map(function (message) {
                    return {
                        id: message.id,
                        legacy: true,
                        number: String(message.name || '').replace('Заказ ', '').trim(),
                        ts: message.ts,
                        name: '',
                        phone: message.contact || '',
                        items: [],
                        total: 0,
                        text: message.text || '',
                        status: 'new'
                    };
                });
        });
    }

    function load(manual) {
        if (loading || !window.SBChat) return;
        loading = true;
        if (manual) setState('обновляю…');

        SBChat.loadConfig().then(function (cfg) {
            if (!cfg.inbox) {
                setState('канал не настроен', 'pill--progress');
                renderHint('<b>Канал не настроен</b>Впишите адрес приёмника в data/chat.json — инструкция в README.');
                loading = false;
                return;
            }

            SBChat.listOrders().then(function (result) {
                if (result && result.ok && Array.isArray(result.orders)) {
                    orders = result.orders;
                    setState('заказов: ' + orders.length, 'pill--done');
                    render();
                    updateBadge();
                    loading = false;
                    return;
                }

                // Скрипт старой версии — подхватываем заказы из чата.
                legacyFromChat().then(function (legacy) {
                    orders = legacy;
                    setState(legacy.length ? 'заказов: ' + legacy.length + ' (из чата)' : 'скрипт без таблицы заказов',
                        legacy.length ? 'pill--progress' : 'pill--new');
                    render();
                    updateBadge();
                    loading = false;
                });
            });
        });
    }

    if (body) {
        body.addEventListener('change', function (event) {
            const select = event.target.closest('[data-order-id]');
            if (!select) return;

            const id = select.getAttribute('data-order-id');
            const status = select.value;
            select.disabled = true;

            SBChat.setOrderStatus(id, status).then(function (result) {
                select.disabled = false;

                if (result && result.ok) {
                    toast('Статус обновлён', { type: 'success', text: 'Заказ сохранён на сервере.', duration: 3000 });
                    load(false);
                    return;
                }

                toast('Не удалось сохранить статус', { type: 'error', text: 'Проверьте, что скрипт обновлён до версии с заказами.' });
                load(false);
            }).catch(function () {
                select.disabled = false;
                toast('Не удалось сохранить статус', { type: 'error' });
            });
        });
    }

    function showPanel() {
        document.querySelectorAll('[data-panel]').forEach(function (section) {
            section.hidden = section.getAttribute('data-panel') !== 'ordersRemote';
        });
        document.querySelectorAll('[data-view]').forEach(function (button) {
            button.setAttribute('aria-current', String(button.getAttribute('data-view') === 'ordersRemote'));
        });

        const title = document.querySelector('[data-title]');
        const subtitle = document.querySelector('[data-subtitle]');
        if (title) title.textContent = 'Заказы с сайта';
        if (subtitle) subtitle.textContent = 'Оформлены на любом устройстве';

        load(false);
    }

    document.querySelectorAll('[data-view="ordersRemote"]').forEach(function (button) {
        button.addEventListener('click', function () { showPanel(); });
    });

    if (refreshBtn) refreshBtn.addEventListener('click', function () { load(true); });

    window.setInterval(function () {
        if (!panel.hidden) load(false);
    }, 20000);

    let requested = '';
    try {
        requested = new URLSearchParams(window.location.search).get('view') || '';
    } catch (err) {
        requested = '';
    }

    if (requested === 'ordersRemote') {
        showPanel();
    } else {
        load(false);
    }
})();
