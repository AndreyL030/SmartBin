/* =========================================================
   SmartBin — раздел «Доступ» в админке
   Смена пароля панели. Пароль хранится только хешем:
   встроенный — константой в admin-auth.js, свой — в браузере.
   ========================================================= */
(function () {
    'use strict';

    const panel = document.querySelector('[data-panel="access"]');
    if (!panel || !window.SBAdminAuth) return;

    const form = panel.querySelector('[data-access-form]');
    const currentInput = panel.querySelector('[data-access-current]');
    const newInput = panel.querySelector('[data-access-new]');
    const repeatInput = panel.querySelector('[data-access-repeat]');
    const stateEl = panel.querySelector('[data-access-state]');
    const errorEl = panel.querySelector('[data-access-error]');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const resetBtn = panel.querySelector('[data-access-reset]');

    function toast(title, options) {
        if (window.SB && SB.toast) SB.toast(title, options);
    }

    function refresh() {
        if (!stateEl) return;
        const custom = SBAdminAuth.isCustom();
        stateEl.textContent = custom ? 'свой пароль' : 'встроенный пароль';
        stateEl.className = 'pill ' + (custom ? 'pill--done' : 'pill--new');
    }

    function fail(text) {
        if (!errorEl) return;
        errorEl.textContent = text;
        errorEl.hidden = false;
    }

    function clearError() {
        if (!errorEl) return;
        errorEl.textContent = '';
        errorEl.hidden = true;
    }

    function busy(state) {
        if (submitBtn) {
            submitBtn.disabled = state;
            submitBtn.textContent = state ? 'Проверяю…' : 'Сохранить пароль';
        }
        if (resetBtn) resetBtn.disabled = state;
    }

    function check() {
        clearError();

        if (!currentInput || !SBAdminAuth.verify(currentInput.value)) {
            fail('Текущий пароль не подходит.');
            return null;
        }

        const password = newInput ? newInput.value : '';
        if (password.length < SBAdminAuth.minLength) {
            fail('Новый пароль короче ' + SBAdminAuth.minLength + ' символов.');
            return null;
        }
        if (repeatInput && password !== repeatInput.value) {
            fail('Пароли не совпадают.');
            return null;
        }
        return password;
    }

    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            busy(true);

            // PBKDF2 считает ~0,5 с — даём браузеру перерисовать кнопку.
            window.setTimeout(function () {
                const password = check();
                busy(false);
                if (!password) return;

                SBAdminAuth.setPassword(password);
                form.reset();
                refresh();
                toast('Пароль обновлён', {
                    type: 'success',
                    text: 'Новый пароль действует в этом браузере. Запишите его — восстановить нельзя.'
                });
            }, 30);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            busy(true);
            window.setTimeout(function () {
                if (!currentInput || !SBAdminAuth.verify(currentInput.value)) {
                    busy(false);
                    fail('Чтобы вернуть встроенный пароль, введите текущий.');
                    return;
                }

                if (!window.confirm('Вернуть встроенный пароль? Свой пароль будет удалён из этого браузера.')) {
                    busy(false);
                    return;
                }

                SBAdminAuth.resetPassword();
                busy(false);
                if (form) form.reset();
                clearError();
                refresh();
                toast('Вернулись к встроенному паролю', { type: 'info', text: 'Он записан в локальном файле проекта.' });
            }, 30);
        });
    }

    [currentInput, newInput, repeatInput].forEach(function (input) {
        if (!input) return;
        input.addEventListener('input', clearError);
    });

    refresh();
})();
