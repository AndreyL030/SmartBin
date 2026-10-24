/* =========================================================
   SmartBin — архив обращений и заказов
   Записи лежат в localStorage и уезжают в data/store.json
   вместе с остальными данными панели.
   ========================================================= */
(function () {
    'use strict';

    const KEY = 'smartbin_archive_v1';
    const LIMIT = 500;

    function empty() {
        return { orders: [], appeals: [], updatedAt: '' };
    }

    function normalize(value) {
        const data = value && typeof value === 'object' ? value : {};
        return {
            orders: Array.isArray(data.orders) ? data.orders.filter(Boolean) : [],
            appeals: Array.isArray(data.appeals) ? data.appeals.filter(Boolean) : [],
            updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : ''
        };
    }

    function read() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return empty();
            return normalize(JSON.parse(raw));
        } catch (err) {
            return empty();
        }
    }

    function write(data) {
        const next = normalize(data);
        next.updatedAt = new Date().toISOString();
        if (next.orders.length > LIMIT) next.orders = next.orders.slice(0, LIMIT);
        if (next.appeals.length > LIMIT) next.appeals = next.appeals.slice(0, LIMIT);

        try {
            localStorage.setItem(KEY, JSON.stringify(next));
        } catch (err) {
            /* хранилище недоступно — панель продолжит работать без архива */
        }

        try {
            document.dispatchEvent(new CustomEvent('sb:archive-changed', { detail: next }));
        } catch (err) {
            /* старые браузеры без CustomEvent */
        }

        return next;
    }

    function replace(value) {
        return write(normalize(value));
    }

    function id(kind) {
        return kind + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    function sorted(list) {
        return list.slice().sort(function (a, b) {
            return String(b.archivedAt || '').localeCompare(String(a.archivedAt || ''));
        });
    }

    /* ---------- Заказы ---------- */
    function findOrder(ref, source) {
        if (!ref) return null;
        return read().orders.find(function (record) {
            if (String(record.ref) !== String(ref)) return false;
            return !source || record.source === source;
        }) || null;
    }

    function isOrderArchived(ref, source) {
        return Boolean(findOrder(ref, source));
    }

    function archiveOrder(entry) {
        const source = entry.source || 'local';
        const ref = entry.ref != null ? String(entry.ref) : '';
        if (!ref) return null;
        if (isOrderArchived(ref, source)) return null;

        const data = read();
        const record = {
            uid: id('ord'),
            source: source,
            ref: ref,
            number: entry.number || ref,
            customer: entry.customer || '',
            phone: entry.phone || '',
            items: Array.isArray(entry.items) ? entry.items : [],
            total: Number(entry.total) || 0,
            status: entry.status || 'new',
            createdAt: entry.createdAt || '',
            note: entry.note || '',
            payload: entry.payload || null,            
            archivedAt: new Date().toISOString()
        };

        data.orders.unshift(record);
        write(data);
        return record;
    }

    function takeOrder(uid) {
        const data = read();
        const index = data.orders.findIndex(function (record) { return record.uid === uid; });
        if (index === -1) return null;
        const record = data.orders.splice(index, 1)[0];
        write(data);
        return record;
    }

    /* ---------- Обращения ---------- */
    function findAppeal(ref) {
        if (!ref) return null;
        return read().appeals.find(function (record) {
            return String(record.ref) === String(ref);
        }) || null;
    }

    function isAppealArchived(ref) {
        return Boolean(findAppeal(ref));
    }

    function archiveAppeal(message) {
        const ref = message && message.id != null ? String(message.id) : '';
        if (!ref) return null;
        if (isAppealArchived(ref)) return null;

        const data = read();
        const record = {
            uid: id('msg'),
            ref: ref,
            name: message.name || '',
            contact: message.contact || '',
            device: message.device || '',
            text: message.text || '',
            reply: message.reply || '',
            replyTs: message.replyTs || '',
            createdAt: message.ts || '',
            archivedAt: new Date().toISOString()
        };

        data.appeals.unshift(record);
        write(data);
        return record;
    }

    function takeAppeal(uid) {
        const data = read();
        const index = data.appeals.findIndex(function (record) { return record.uid === uid; });
        if (index === -1) return null;
        const record = data.appeals.splice(index, 1)[0];
        write(data);
        return record;
    }

    /* ---------- Поиск ---------- */
    function normalizeQuery(text) {
        return String(text || '').trim().toLowerCase();
    }

    function matchOrder(record, query) {
        if (!query) return true;
        const haystack = [
            record.number, record.ref, record.customer, record.phone, record.note,
            (record.items || []).map(function (item) { return item.name; }).join(' ')
        ].join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
    }

    function matchAppeal(record, query) {
        if (!query) return true;
        const haystack = [record.ref, record.name, record.contact, record.text, record.reply]
            .join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
    }

    function orders(query) {
        const needle = normalizeQuery(query);
        return sorted(read().orders).filter(function (record) { return matchOrder(record, needle); });
    }

    function appeals(query) {
        const needle = normalizeQuery(query);
        return sorted(read().appeals).filter(function (record) { return matchAppeal(record, needle); });
    }

    /* ---------- Выгрузка ---------- */
    function cell(value) {
        const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function formatDate(iso) {
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function ordersCsv(list) {
        const head = ['Номер', 'Клиент', 'Телефон', 'Товары', 'Сумма, ₽', 'Статус', 'Создан', 'В архиве с', 'Источник'];
        const rows = list.map(function (record) {
            const items = (record.items || []).map(function (item) {
                return item.name + ' x' + item.qty;
            }).join(', ');

            return [
                record.number,
                record.customer,
                record.phone,
                items,
                record.total,
                record.status,
                formatDate(record.createdAt),
                formatDate(record.archivedAt),
                record.source === 'remote' ? 'сайт' : 'панель'
            ].map(cell).join(';');
        });

        return '\ufeff' + head.map(cell).join(';') + '\r\n' + rows.join('\r\n') + '\r\n';
    }

    function appealsCsv(list) {
        const head = ['Кто', 'Контакт', 'Сообщение', 'Ответ', 'Пришло', 'В архиве с'];
        const rows = list.map(function (record) {
            return [
                record.name || 'Гость',
                record.contact,
                record.text,
                record.reply,
                formatDate(record.createdAt),
                formatDate(record.archivedAt)
            ].map(cell).join(';');
        });

        return '\ufeff' + head.map(cell).join(';') + '\r\n' + rows.join('\r\n') + '\r\n';
    }

    function download(filename, text, type) {
        const blob = new Blob([text], { type: (type || 'text/plain') + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }

    function fileName(prefix, ext) {
        const now = new Date();
        const pad = function (value) { return String(value).padStart(2, '0'); };
        return prefix + '-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '.' + ext;
    }

    window.SBArchive = {
        read: read,
        replace: replace,
        orders: orders,
        appeals: appeals,
        sortedOrders: function () { return sorted(read().orders); },
        sortedAppeals: function () { return sorted(read().appeals); },
        findOrder: findOrder,
        isOrderArchived: isOrderArchived,
        archiveOrder: archiveOrder,
        takeOrder: takeOrder,
        findAppeal: findAppeal,
        isAppealArchived: isAppealArchived,
        archiveAppeal: archiveAppeal,
        takeAppeal: takeAppeal,
        ordersCsv: ordersCsv,
        appealsCsv: appealsCsv,
        download: download,
        fileName: fileName,
        formatDate: formatDate
    };
})();
