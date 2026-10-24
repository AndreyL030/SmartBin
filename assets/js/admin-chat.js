/* =========================================================
   SmartBin — раздел «Обращения» в админке
   Читает сообщения из канала (data/chat.json → inbox),
   позволяет отвечать прямо в панели.
   ========================================================= */
(function () {
    'use strict';

    const panel = document.querySelector('[data-panel="chat"]');
    if (!panel) return;

    const listEl = document.querySelector('[data-chat-list]');
    const stateEl = document.querySelector('[data-chat-state]');
    const emptyEl = document.querySelector('[data-chat-empty]');
    const refreshBtn = document.querySelector('[data-chat-refresh]');
    const badge = document.querySelector('[data-chat-badge]');

    let messages = [];
    let loading = false;

    function active() {
        if (!window.SBArchive) return messages;
        return messages.filter(function (message) {
            return !SBArchive.isAppealArchived(message.id);
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
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
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function setupHint() {
        return '<b>Канал не настроен</b>' +
            'Сообщения с сайта пока некуда отправлять. Включение — 5 минут:<br><br>' +
            '1. Откройте <a href="https://script.google.com" target="_blank" rel="noopener">script.google.com</a> → «Новый проект».<br>' +
            '2. Вставьте код из <b>docs/apps-script-chat.gs</b> этого репозитория.<br>' +
            '3. «Развернуть» → «Новое развёртывание» → тип «Веб-приложение», доступ «Все».<br>' +
            '4. Скопируйте адрес, заканчивающийся на <b>/exec</b>.<br>' +
            '5. В файле <b>data/chat.json</b> укажите: <code>{"inbox": "вставьте адрес"}</code>.<br><br>' +
            'После этого перезагрузите панель.';
    }

    function render() {
        if (!listEl) return;

        const list = active();

        if (!list.length) {
            listEl.innerHTML = '';
            if (emptyEl) {
                emptyEl.hidden = false;
                emptyEl.innerHTML = messages.length
                    ? '<b>Все обращения разобраны</b>Отвеченные сообщения лежат в разделе «Архив».'
                    : '<b>Обращений пока нет</b>Напишите что-нибудь в чат на странице поддержки с другого устройства — сообщение появится здесь.';
            }
            return;
        }

        if (emptyEl) emptyEl.hidden = true;

        listEl.innerHTML = list.slice().reverse().map(function (message) {
            const head = '<div class="chat-item__head">' +
                '<b>' + (escapeHtml(message.name) || 'Гость') + '</b>' +
                '<span>' + escapeHtml(formatDate(message.ts)) +
                    (message.contact ? ' · ' + escapeHtml(message.contact) : '') +
                    (message.device ? ' · ' + escapeHtml(message.device) : '') +
                '</span>' +
            '</div>';

            const body = '<p class="chat-item__text">' + escapeHtml(message.text) + '</p>';

            const replyBlock = message.reply
                ? '<div class="chat-reply"><b>Ответ:</b> ' + escapeHtml(message.reply) +
                    (message.replyTs ? '<div class="chat-item__head" style="margin-top:4px">' + escapeHtml(formatDate(message.replyTs)) + '</div>' : '') +
                  '</div>'
                : '<form class="chat-reply-form" data-reply-form="' + escapeHtml(message.id) + '">' +
                    '<input class="input" type="text" placeholder="Ответить посетителю…" autocomplete="off" data-reply-input>' +
                    '<button class="btn btn--sm" type="submit">Отправить</button>' +
                  '</form>';

            const actions = message.id
                ? '<div class="archive-actions">' +
                    '<button class="btn btn--sm btn--ghost" type="button" data-archive-appeal="' + escapeHtml(message.id) + '">В архив</button>' +
                  '</div>'
                : '';

            return '<article class="chat-item">' + head + body + replyBlock + actions + '</article>';
        }).join('');
    }

    function updateBadge() {
        if (!badge) return;
        const unread = active().filter(function (message) { return !message.reply; }).length;
        badge.textContent = String(unread);
        badge.hidden = unread === 0;
    }

    document.addEventListener('sb:archive-changed', function () {
        render();
        updateBadge();
    });

    // Списком сообщений пользуется раздел «Архив».
    window.SBAdminChat = {
        raw: function () { return messages; }
    };

    function showHint() {
        if (!emptyEl || !listEl) return;
        listEl.innerHTML = '';
        emptyEl.hidden = false;
        emptyEl.innerHTML = setupHint();
    }

    function load(manual) {
        if (loading) return;
        if (!window.SBChat) {
            setState('модуль чата не загружен', 'pill--danger');
            return;
        }

        loading = true;
        if (manual) setState('обновляю…', 'pill--new');

        SBChat.loadConfig().then(function (cfg) {
            if (!cfg.inbox) {
                setState('канал не настроен', 'pill--progress');
                showHint();
                loading = false;
                return;
            }

            setState('загрузка…', 'pill--new');

            SBChat.list().then(function (result) {
                loading = false;

                if (!result || !result.ok) {
                    setState('нет ответа от канала', 'pill--danger');
                    if (manual) {
                        toast('Канал не отвечает', {
                            type: 'error',
                            text: 'Проверьте, что веб-приложение развёрнуто с доступом «Все».'
                        });
                    }
                    return;
                }

                messages = Array.isArray(result.messages) ? result.messages : [];
                setState('сообщений: ' + messages.length, 'pill--done');
                render();
                updateBadge();
            });
        });
    }

    if (listEl) {
        listEl.addEventListener('click', function (event) {
            const button = event.target.closest('[data-archive-appeal]');
            if (!button || !window.SBArchive) return;

            const id = button.getAttribute('data-archive-appeal');
            const message = messages.find(function (item) { return String(item.id) === String(id); });
            if (!message) return;

            if (!SBArchive.archiveAppeal(message)) {
                toast('Уже в архиве', { type: 'info', text: 'Это обращение уже перенесено.' });
                return;
            }

            render();
            updateBadge();
            toast('Обращение в архиве', {
                type: 'success',
                text: 'Сообщение убрано из ленты. Вернуть — в разделе «Архив».'
            });
        });

        listEl.addEventListener('submit', function (event) {
            const form = event.target.closest('[data-reply-form]');
            if (!form) return;

            event.preventDefault();
            const id = form.getAttribute('data-reply-form');
            const input = form.querySelector('[data-reply-input]');
            const text = input ? input.value.trim() : '';
            if (!text) return;

            if (input) input.disabled = true;

            SBChat.reply(id, text).then(function (result) {
                if (input) input.disabled = false;

                if (result && result.ok) {
                    toast('Ответ отправлен', {
                        type: 'success',
                        text: 'Посетитель увидит его в чате в течение 8 секунд.'
                    });
                    load(false);
                    return;
                }

                toast('Не удалось отправить ответ', { type: 'error', text: 'Канал вернул ошибку.' });
            }).catch(function () {
                if (input) input.disabled = false;
                toast('Не удалось отправить ответ', { type: 'error', text: 'Проверьте соединение.' });
            });
        });
    }

    document.querySelectorAll('[data-view="chat"]').forEach(function (button) {
        button.addEventListener('click', function () { showChatPanel(); });
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () { load(true); });
    }

    // admin.js знает только свои разделы, поэтому панель показываем сами.
    function showChatPanel() {
        document.querySelectorAll('[data-panel]').forEach(function (section) {
            section.hidden = section.getAttribute('data-panel') !== 'chat';
        });
        document.querySelectorAll('[data-view]').forEach(function (button) {
            button.setAttribute('aria-current', String(button.getAttribute('data-view') === 'chat'));
        });

        const title = document.querySelector('[data-title]');
        const subtitle = document.querySelector('[data-subtitle]');
        if (title) title.textContent = 'Обращения';
        if (subtitle) subtitle.textContent = 'Сообщения из чата на сайте';

        load(false);
    }

    window.setInterval(function () {
        if (!panel.hidden) load(false);
    }, 15000);

    let requested = '';
    try {
        requested = new URLSearchParams(window.location.search).get('view') || '';
    } catch (err) {
        requested = '';
    }

    if (requested === 'chat') {
        showChatPanel();
    } else {
        load(false);
    }
})();
