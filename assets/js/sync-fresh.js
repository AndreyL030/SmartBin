/* =========================================================
   SmartBin — свежее чтение общего файла
   raw.githubusercontent кэширует содержимое до пяти минут,
   поэтому читаем через GitHub API (без токена, только чтение),
   а raw остаётся запасным путём при ошибке или лимите запросов.
   ========================================================= */
(function () {
    'use strict';

    if (!window.SBSync) return;

    const CACHE_KEY = 'smartbin_shared_cache_v1';
    const CACHE_TTL = 20000;
    const nativePull = SBSync.pull.bind(SBSync);

    function readCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            return parsed && parsed.data ? parsed : null;
        } catch (err) {
            return null;
        }
    }

    function writeCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (err) { /* приватный режим */ }
    }

    function decode(base64) {
        const binary = atob(String(base64).replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    }

    function request(url, timeout) {
        const controller = new AbortController();
        const timer = window.setTimeout(function () { controller.abort(); }, timeout);

        return fetch(url, {
            cache: 'no-store',
            signal: controller.signal,
            headers: { 'Accept': 'application/vnd.github+json' }
        }).then(function (response) {
            window.clearTimeout(timer);
            return response;
        }, function (err) {
            window.clearTimeout(timer);
            throw err;
        });
    }

    function pull(options) {
        const opts = options || {};
        const cfg = SBSync.readConfig();

        if (!cfg.owner || !cfg.repo) return nativePull(opts);

        const url = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo +
            '/contents/' + cfg.path + '?ref=' + encodeURIComponent(cfg.branch) + '&t=' + Date.now();

        return request(url, opts.timeout || 6000).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(function (json) {
            if (!json || !json.content) throw new Error('no content');
            const data = JSON.parse(decode(json.content));
            writeCache(data);
            return data;
        }).catch(function () {
            // Лимит запросов или сеть — падаем на raw (может быть старее).
            return nativePull(opts);
        });
    }

    SBSync.pull = pull;

    SBSync.loadShared = function () {
        const cached = readCache();
        if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL) {
            return Promise.resolve(cached.data);
        }
        return pull({ timeout: 1500 }).then(function (data) {
            if (data) return data;
            return cached ? cached.data : null;
        });
    };
})();
