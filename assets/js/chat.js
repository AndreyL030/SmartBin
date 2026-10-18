/* =========================================================
   SmartBin — канал чата поддержки
   Адрес приёмника берётся из data/chat.json (публичный файл).
   Пока он пустой, сайт работает в демо-режиме с имитацией ответа.
   ========================================================= */
(function () {
    'use strict';

    const CONFIG_URL = 'data/chat.json';
    const DEVICE_KEY = 'smartbin_chat_device';

    let configPromise = null;

    function deviceId() {
        try {
            let id = localStorage.getItem(DEVICE_KEY);
            if (!id) {
                id = 'd' + Math.random().toString(36).slice(2, 8);
                localStorage.setItem(DEVICE_KEY, id);
            }
            return id;
        } catch (err) {
            return 'anon';
        }
    }

    function loadConfig() {
        if (!configPromise) {
            configPromise = fetch(CONFIG_URL + '?t=' + Date.now(), { cache: 'no-store' })
                .then(function (response) { return response.ok ? response.json() : null; })
                .catch(function () { return null; })
                .then(function (cfg) {
                    const inbox = cfg && typeof cfg.inbox === 'string' ? cfg.inbox.trim() : '';
                    return { inbox: inbox };
                });
        }
        return configPromise;
    }

    function isConfigured() {
        return loadConfig().then(function (cfg) { return Boolean(cfg.inbox); });
    }

    function post(payload) {
        return loadConfig().then(function (cfg) {
            if (!cfg.inbox) throw new Error('канал не настроен');

            return fetch(cfg.inbox, {
                method: 'POST',
                // text/plain — чтобы не было CORS-preflight, Apps Script иначе не отвечает
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            }).then(function (response) {
                return response.text();
            }).then(function (text) {
                try { return JSON.parse(text); } catch (err) { return { ok: true }; }
            });
        });
    }

    function send(message) {
        const payload = Object.assign({ device: deviceId(), ts: new Date().toISOString() }, message || {});
        return post({ action: 'send', message: payload });
    }

    function reply(id, text) {
        return post({ action: 'reply', id: id, text: text, ts: new Date().toISOString() });
    }

    function list() {
        return loadConfig().then(function (cfg) {
            if (!cfg.inbox) return null;
            return fetch(cfg.inbox + '?action=list&t=' + Date.now(), { cache: 'no-store' })
                .then(function (response) { return response.ok ? response.json() : null; })
                .catch(function () { return null; });
        });
    }

    function orderSummary(order) {
        const customer = order.customer || {};
        const items = Array.isArray(order.items) ? order.items : [];
        const lines = items.map(function (item) {
            return '• ' + item.name + ' × ' + item.qty + ' — ' + (item.price * item.qty) + ' ₽';
        });

        return [
            'Заказ ' + order.number + ' на ' + order.total + ' ₽',
            lines.join('\n'),
            customer.name + ', ' + customer.phone,
            (customer.city || '') + (customer.address ? ', ' + customer.address : '')
        ].join('\n');
    }

    function sendOrder(order) {
        return post({ action: 'order', order: order }).then(function (result) {
            if (result && result.ok !== false) return result;

            // Старая версия скрипта не знает про заказы — отправляем сообщением.
            return post({
                action: 'send',
                message: {
                    device: deviceId(),
                    ts: new Date().toISOString(),
                    name: 'Заказ ' + order.number,
                    contact: (order.customer && order.customer.phone) || '',
                    text: orderSummary(order)
                }
            });
        });
    }

    function listOrders() {
        return loadConfig().then(function (cfg) {
            if (!cfg.inbox) return null;
            return fetch(cfg.inbox + '?action=orders&t=' + Date.now(), { cache: 'no-store' })
                .then(function (response) { return response.ok ? response.json() : null; })
                .catch(function () { return null; });
        });
    }

    function setOrderStatus(id, status) {
        return post({ action: 'orderStatus', id: id, status: status, ts: new Date().toISOString() });
    }

    window.SBChat = {
        loadConfig: loadConfig,
        isConfigured: isConfigured,
        send: send,
        reply: reply,
        list: list,
        sendOrder: sendOrder,
        listOrders: listOrders,
        setOrderStatus: setOrderStatus,
        deviceId: deviceId
    };
})();
