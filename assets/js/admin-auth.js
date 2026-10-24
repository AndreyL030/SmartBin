/* =========================================================
   SmartBin — доступ в админку
   Пароль нигде не хранится открытым текстом: в коде лежит
   только хеш PBKDF2-HMAC-SHA256 (60 000 итераций, случайная
   соль). Владелец может задать свой пароль — он сохраняется
   таким же хешем в localStorage этого браузера.
   ========================================================= */
(function () {
    'use strict';

    const LOCAL_KEY = 'smartbin_admin_auth_v1';
    const ITERATIONS = 60000;
    const KEY_BYTES = 32;

    /* Встроенный пароль панели. Хеш, а не пароль: восстановить
       его из исходников нельзя, а страница его не показывает. */
    const BUILTIN = Object.freeze({
        v: 1,
        iter: ITERATIONS,
        salt: 'FM2ccNXk7ds6bz6ZD6SHHA==',
        hash: 'uwH4fmpjza/FwIQRxCYU9M8hLvy60sZum3QELHT8clg='
    });

    /* ---------- SHA-256 ---------- */
    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    function rotr(x, n) {
        return (x >>> n) | (x << (32 - n));
    }

    function sha256(bytes) {
        const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        const length = bytes.length;
        const blocks = Math.ceil((length + 9) / 64);
        const total = blocks * 64;
        const msg = new Uint8Array(total);
        msg.set(bytes);
        msg[length] = 0x80;

        const bits = length * 8;
        const hi = Math.floor(bits / 0x100000000);
        const lo = bits >>> 0;
        msg[total - 8] = (hi >>> 24) & 0xff;
        msg[total - 7] = (hi >>> 16) & 0xff;
        msg[total - 6] = (hi >>> 8) & 0xff;
        msg[total - 5] = hi & 0xff;
        msg[total - 4] = (lo >>> 24) & 0xff;
        msg[total - 3] = (lo >>> 16) & 0xff;
        msg[total - 2] = (lo >>> 8) & 0xff;
        msg[total - 1] = lo & 0xff;

        const w = new Int32Array(64);

        for (let block = 0; block < blocks; block += 1) {
            const offset = block * 64;

            for (let i = 0; i < 16; i += 1) {
                const p = offset + i * 4;
                w[i] = (msg[p] << 24) | (msg[p + 1] << 16) | (msg[p + 2] << 8) | msg[p + 3];
            }

            for (let i = 16; i < 64; i += 1) {
                const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
            }

            let a = H[0];
            let b = H[1];
            let c = H[2];
            let d = H[3];
            let e = H[4];
            let f = H[5];
            let g = H[6];
            let h = H[7];

            for (let i = 0; i < 64; i += 1) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                const ch = (e & f) ^ (~e & g);
                const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
                const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = (S0 + maj) | 0;

                h = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }

            H[0] = (H[0] + a) | 0;
            H[1] = (H[1] + b) | 0;
            H[2] = (H[2] + c) | 0;
            H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0;
            H[5] = (H[5] + f) | 0;
            H[6] = (H[6] + g) | 0;
            H[7] = (H[7] + h) | 0;
        }

        const out = new Uint8Array(32);
        for (let i = 0; i < 8; i += 1) {
            out[i * 4] = (H[i] >>> 24) & 0xff;
            out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
            out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
            out[i * 4 + 3] = H[i] & 0xff;
        }
        return out;
    }

    /* ---------- HMAC / PBKDF2 ---------- */
    function hmacSha256(keyBytes, messageBytes) {
        const block = 64;
        let key = keyBytes;
        if (key.length > block) key = sha256(key);

        const inner = new Uint8Array(block + messageBytes.length);
        const outer = new Uint8Array(block + 32);

        for (let i = 0; i < block; i += 1) {
            const byte = i < key.length ? key[i] : 0;
            inner[i] = byte ^ 0x36;
            outer[i] = byte ^ 0x5c;
        }

        inner.set(messageBytes, block);
        outer.set(sha256(inner), block);
        return sha256(outer);
    }

    function pbkdf2(passwordBytes, saltBytes, iterations, keyLength) {
        const result = new Uint8Array(keyLength);
        const blockSize = 32;
        const blocks = Math.ceil(keyLength / blockSize);
        let derived = 0;

        for (let index = 1; index <= blocks; index += 1) {
            const salt = new Uint8Array(saltBytes.length + 4);
            salt.set(saltBytes);
            salt[saltBytes.length] = (index >>> 24) & 0xff;
            salt[saltBytes.length + 1] = (index >>> 16) & 0xff;
            salt[saltBytes.length + 2] = (index >>> 8) & 0xff;
            salt[saltBytes.length + 3] = index & 0xff;

            let u = hmacSha256(passwordBytes, salt);
            const acc = u.slice();

            for (let i = 1; i < iterations; i += 1) {
                u = hmacSha256(passwordBytes, u);
                for (let j = 0; j < blockSize; j += 1) acc[j] ^= u[j];
            }

            for (let j = 0; j < blockSize && derived < keyLength; j += 1) {
                result[derived] = acc[j];
                derived += 1;
            }
        }

        return result;
    }

    /* ---------- Кодирование ---------- */
    function utf8(text) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
        const bytes = [];
        for (let i = 0; i < text.length; i += 1) {
            let code = text.charCodeAt(i);
            if (code < 0x80) {
                bytes.push(code);
            } else if (code < 0x800) {
                bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
            } else {
                bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
            }
        }
        return new Uint8Array(bytes);
    }

    function toBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        if (typeof btoa === 'function') return btoa(binary);
        return Buffer.from(binary, 'binary').toString('base64');
    }

    function fromBase64(text) {
        let binary;
        if (typeof atob === 'function') {
            binary = atob(text);
        } else {
            binary = Buffer.from(text, 'base64').toString('binary');
        }
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function equal(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
        return diff === 0;
    }

    function randomSalt() {
        const bytes = new Uint8Array(16);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }

    /* ---------- Хранилище ---------- */
    function readRecord(storage, key) {
        try {
            const raw = storage.getItem(key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data.salt !== 'string' || typeof data.hash !== 'string') return null;
            return {
                v: 1,
                iter: Number(data.iter) > 0 ? Number(data.iter) : ITERATIONS,
                salt: data.salt,
                hash: data.hash
            };
        } catch (err) {
            return null;
        }
    }

    function localRecord() {
        try {
            return readRecord(window.localStorage, LOCAL_KEY);
        } catch (err) {
            return null;
        }
    }

    function activeRecord() {
        return localRecord() || BUILTIN;
    }

    function isCustom() {
        return Boolean(localRecord());
    }

    function derive(password, record) {
        return pbkdf2(utf8(password), fromBase64(record.salt), record.iter || ITERATIONS, KEY_BYTES);
    }

    function verify(password) {
        if (typeof password !== 'string' || !password) return false;
        const record = activeRecord();
        return equal(derive(password, record), fromBase64(record.hash));
    }

    function setPassword(password) {
        const salt = randomSalt();
        const record = {
            v: 1,
            iter: ITERATIONS,
            salt: toBase64(salt),
            hash: toBase64(pbkdf2(utf8(password), salt, ITERATIONS, KEY_BYTES))
        };
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(record));
        return true;
    }

    function resetPassword() {
        try {
            window.localStorage.removeItem(LOCAL_KEY);
        } catch (err) {
            return false;
        }
        return true;
    }

    window.SBAdminAuth = {
        verify: verify,
        setPassword: setPassword,
        resetPassword: resetPassword,
        isCustom: isCustom,
        minLength: 10
    };
})();
