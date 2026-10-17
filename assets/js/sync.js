/* =========================================================
   SmartBin — синхронизация между устройствами
   Данные лежат в файле репозитория (data/store.json).
   Чтение — публичное, через raw.githubusercontent.
   Запись — через GitHub API, нужен fine-grained токен.
   ========================================================= */
(function () {
    'use strict';

    const CONFIG_KEY = 'smartbin_sync_v1';
    const CACHE_KEY = 'smartbin_shared_cache_v1';
    const DEFAULT_PATH = 'data/store.json';
    const CACHE_TTL = 20000;

    /* ---------- Конфиг ---------- */
    function guessRepo() {
        const host = window.location.hostname || '';
        if (!/\.github\.io$/i.test(host)) return null;
        const owner = host.split('.')[0];
        const segments = window.location.pathname.split('/').filter(Boolean);
        const repo = segments.length ? segments[0] : owner + '.github.io';
        return { owner: owner, repo: repo };
    }

    function readConfig() {
        let cfg = {};
        try {
            cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {};
        } catch (err) {
            cfg = {};
        }

        const guess = guessRepo() || {};
        return {
            owner: cfg.owner || guess.owner || '',
            repo: cfg.repo || guess.repo || '',
            branch: cfg.branch || 'main',
            path: cfg.path || DEFAULT_PATH,
            token: cfg.token || '',
            enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : false
        };
    }

    function saveConfig(patch) {
        const next = Object.assign(readConfig(), patch || {});
        try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch (err) { /* приватный режим */ }
        return next;
    }

    function isWritable(cfg) {
        const config = cfg || readConfig();
        return Boolean(config.enabled && config.token && config.owner && config.repo);
    }

    /* ---------- Адреса ---------- */
    function sourceUrl() {
        const cfg = readConfig();
        if (cfg.owner && cfg.repo) {
            return 'https://raw.githubusercontent.com/' + cfg.owner + '/' + cfg.repo + '/' +
                encodeURIComponent(cfg.branch) + '/' + cfg.path;
        }
        return cfg.path;
    }

    function apiUrl() {
        const cfg = readConfig();
        return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + cfg.path;
    }

    /* ---------- Сеть ---------- */
    function fetchWithTimeout(url, options, timeout) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const opts = Object.assign({ cache: 'no-store' }, options || {});
        if (controller) opts.signal = controller.signal;

        const timer = window.setTimeout(function () {
            if (controller) controller.abort();
        }, timeout || 6000);

        return fetch(url, opts).then(function (response) {
            window.clearTimeout(timer);
            return response;
        }, function (err) {
            window.clearTimeout(timer);
            throw err;
        });
    }

    function readCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch (err) {
            return null;
        }
    }

    function writeCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (err) { /* ignore */ }
    }

    /* ---------- Чтение ---------- */
    function pull(options) {
        const opts = options || {};
        const url = sourceUrl() + (sourceUrl().indexOf('http') === 0 ? '' : '') + '?t=' + Date.now();

        return fetchWithTimeout(url, {}, opts.timeout || 6000)
            .then(function (response) {
                if (!response.ok) return null;
                return response.json();
            })
            .then(function (data) {
                if (!data || typeof data !== 'object') return null;
                writeCache(data);
                return data;
            })
            .catch(function () {
                return null;
            });
    }

    // Для витрины: свежий кэш — сразу, иначе сеть, иначе старый кэш.
    function loadShared() {
        const cached = readCache();
        if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL) {
            return Promise.resolve(cached.data);
        }
        return pull({ timeout: 1500 }).then(function (data) {
            if (data) return data;
            return cached ? cached.data : null;
        });
    }

    /* ---------- Запись ---------- */
    function toBase64(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function apiHeaders(cfg) {
        return {
            'Authorization': 'Bearer ' + cfg.token,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
        };
    }

    function getSha(cfg) {
        return fetchWithTimeout(apiUrl() + '?ref=' + encodeURIComponent(cfg.branch), { headers: apiHeaders(cfg) }, 8000)
            .then(function (response) {
                if (!response.ok) return null;
                return response.json();
            })
            .then(function (json) {
                return json && json.sha ? json.sha : null;
            })
            .catch(function () {
                return null;
            });
    }

    function putFile(cfg, content, sha) {
        const body = {
            message: 'chore: данные админки SmartBin',
            content: toBase64(content),
            branch: cfg.branch
        };
        if (sha) body.sha = sha;

        return fetchWithTimeout(apiUrl(), {
            method: 'PUT',
            headers: apiHeaders(cfg),
            body: JSON.stringify(body)
        }, 12000).then(function (response) {
            return { status: response.status, ok: response.ok };
        });
    }

    function push(payload) {
        const cfg = readConfig();
        if (!isWritable(cfg)) {
            return Promise.resolve({ ok: false, reason: 'not-configured' });
        }

        const content = JSON.stringify(payload, null, 2) + '\n';

        return getSha(cfg).then(function (sha) {
            return putFile(cfg, content, sha);
        }).then(function (result) {
            if (result.ok) return { ok: true, status: result.status };
            if (result.status === 409) {
                // Файл изменился между чтением и записью — повторяем с новым sha.
                return getSha(cfg).then(function (freshSha) {
                    return putFile(cfg, content, freshSha);
                }).then(function (retry) {
                    return { ok: retry.ok, status: retry.status, retried: true };
                });
            }
            return { ok: false, status: result.status };
        }).catch(function (err) {
            return { ok: false, reason: 'network', error: String(err && err.message || err) };
        });
    }

    /* ---------- Статус ---------- */
    function status() {
        const cfg = readConfig();
        if (!cfg.owner || !cfg.repo) return { state: 'no-repo', config: cfg };
        if (!cfg.enabled || !cfg.token) return { state: 'read-only', config: cfg };
        return { state: 'sync', config: cfg };
    }

    window.SBSync = {
        readConfig: readConfig,
        saveConfig: saveConfig,
        isWritable: isWritable,
        pull: pull,
        loadShared: loadShared,
        push: push,
        status: status,
        sourceUrl: sourceUrl
    };
})();
