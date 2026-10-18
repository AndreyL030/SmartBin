/* =========================================================
   SmartBin — общая логика сайта
   Каталог товаров, корзина в localStorage, тосты, шапка,
   анимации появления, инициализация отдельных страниц.
   ========================================================= */
(function () {
    'use strict';

    /* ---------- Данные каталога ---------- */
    const PRODUCTS = [
        {
            id: 'eco',
            name: 'SmartBin Eco',
            category: 'bin',
            icon: '🌱',
            price: 24990,
            badge: { text: 'Для старта', tone: 'starter' },
            short: 'Компактная модель для офиса до 30 человек.',
            description: 'Урна для небольших офисов и коворкингов. Сама определяет материал предмета и отправляет его в нужный отсек — сотрудникам остаётся только бросить мусор в одно окно.',
            features: [
                'Объём 40 литров, четыре секции сортировки',
                'Автоматическое определение типа отходов',
                'Мобильное приложение со статистикой',
                'Тихая работа сервопривода'
            ],
            specs: [
                ['Объём', '40 л'],
                ['Секции', 'Пластик, стекло, бумага, органика'],
                ['Точность распознавания', '98%'],
                ['Габариты', '45 × 40 × 78 см'],
                ['Вес', '18 кг'],
                ['Подключение', 'Wi-Fi 2.4 ГГц'],
                ['Гарантия', '2 года']
            ],
            popular: true,
            inStock: true
        },
        {
            id: 'pro',
            name: 'SmartBin Pro',
            category: 'bin',
            icon: '⚡',
            price: 49990,
            badge: { text: 'Хит продаж', tone: 'hit' },
            short: 'Для корпоративных пространств и больших этажей.',
            description: 'Версия для офисов от 50 человек. Расширенная база распознавания, встроенный пресс для пластика и датчики заполненности — урну нужно реже обслуживать.',
            features: [
                'Объём 80 литров, увеличенные отсеки',
                'Расширенная база распознавания материалов',
                'Встроенный пресс для пластика',
                'Датчик заполненности и напоминания о вывозе'
            ],
            specs: [
                ['Объём', '80 л'],
                ['Секции', 'Пластик, стекло, бумага, органика'],
                ['Точность распознавания', '99%'],
                ['Габариты', '52 × 46 × 96 см'],
                ['Вес', '27 кг'],
                ['Подключение', 'Wi-Fi 2.4/5 ГГц, Bluetooth'],
                ['Гарантия', '3 года']
            ],
            popular: true,
            inStock: true
        },
        {
            id: 'servo',
            name: 'Сервопривод лотка',
            category: 'part',
            icon: '⚙️',
            price: 2490,
            badge: null,
            short: 'Бесшумный мотор для распределения отсеков.',
            description: 'Оригинальный сервопривод с металлическими шестернями. Меняется без пайки — достаточно отвёртки, инструкция идёт в комплекте.',
            features: ['Совместим с Eco и Pro', 'Ресурс 500 000 циклов', 'Уровень шума ниже 35 дБ'],
            specs: [
                ['Совместимость', 'SmartBin Eco, SmartBin Pro'],
                ['Ресурс', '500 000 циклов'],
                ['Уровень шума', '< 35 дБ'],
                ['Комплект', 'Привод, крепёж, инструкция'],
                ['Гарантия', '1 год']
            ],
            popular: false,
            inStock: true
        },
        {
            id: 'bags',
            name: 'Комплект мешков (50 шт)',
            category: 'part',
            icon: '🛍️',
            price: 890,
            badge: null,
            short: 'Биоразлагаемые мешки для отсека органики.',
            description: 'Плотные мешки из кукурузного крахмала: разлагаются вместе с органикой и не рвутся при выгрузке. Подходят к обоим отсекам органики.',
            features: ['50 штук в упаковке', 'Биоразлагаемый материал', 'Усиленное дно и швы'],
            specs: [
                ['Количество', '50 шт'],
                ['Материал', 'Кукурузный крахмал, PBAT'],
                ['Размер', '45 × 60 см'],
                ['Совместимость', 'Отсек органики Eco и Pro']
            ],
            popular: true,
            inStock: true
        },
        {
            id: 'wifi',
            name: 'Wi-Fi / Bluetooth модуль',
            category: 'part',
            icon: '📡',
            price: 1990,
            badge: { text: 'Новинка', tone: 'new' },
            short: 'Для обновления прошивки и связи с умным домом.',
            description: 'Сменный модуль связи для первых ревизий SmartBin. Добавляет поддержку 5 ГГц, Bluetooth-настройку и интеграцию с умным домом.',
            features: ['Wi-Fi 2.4 и 5 ГГц', 'Bluetooth для быстрой настройки', 'Обновление прошивки по воздуху'],
            specs: [
                ['Интерфейсы', 'Wi-Fi 802.11 a/b/g/n/ac, Bluetooth 5.0'],
                ['Совместимость', 'SmartBin Eco и Pro любых ревизий'],
                ['Питание', 'От шины урны, 5 В'],
                ['Гарантия', '1 год']
            ],
            popular: false,
            inStock: true
        },
        {
            id: 'sensor',
            name: 'Датчик заполненности',
            category: 'part',
            icon: '📶',
            price: 1490,
            badge: null,
            short: 'Ультразвуковой сенсор с уведомлениями в приложении.',
            description: 'Следит за уровнем отходов в отсеке и присылает уведомление, когда пора вынести мусор. Ставится в штатное гнездо крышки.',
            features: ['Точность ± 2 см', 'Уведомления в приложении', 'Батарейка на 18 месяцев'],
            specs: [
                ['Тип', 'Ультразвуковой'],
                ['Точность', '± 2 см'],
                ['Питание', 'CR2032, до 18 месяцев'],
                ['Совместимость', 'SmartBin Eco, SmartBin Pro']
            ],
            popular: false,
            inStock: true
        }
    ];

    /* ---------- Правки каталога из админ-панели ---------- */
    function applyProductPatch(map) {
        if (!map || typeof map !== 'object') return;
        PRODUCTS.forEach(function (product) {
            const patch = map[product.id];
            if (!patch) return;
            if (typeof patch.price === 'number' && patch.price > 0) product.price = Math.round(patch.price);
            if (typeof patch.inStock === 'boolean') product.inStock = patch.inStock;
        });
    }

    (function applyLocalOverrides() {
        try {
            applyProductPatch(JSON.parse(localStorage.getItem('smartbin_product_overrides_v1') || '{}'));
        } catch (err) {
            /* повреждённые данные игнорируем — витрина работает на исходных ценах */
        }
    })();

    const CART_KEY = 'smartbin_cart_v1';
    const ORDERS_KEY = 'smartbin_orders_v1';
    const FREE_DELIVERY_FROM = 50000;
    const DELIVERY_PRICE = 590;

    /* ---------- Утилиты ---------- */
    const priceFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

    function formatPrice(value) {
        return priceFmt.format(Math.round(value)) + ' ₽';
    }

    function getProduct(id) {
        return PRODUCTS.find(function (p) { return p.id === id; }) || null;
    }

    function plural(n, one, few, many) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
        return many;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    /* ---------- Корзина ---------- */
    function readCart() {
        try {
            const raw = localStorage.getItem(CART_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter(function (item) {
                    return item && getProduct(item.id) && Number(item.qty) > 0;
                })
                .map(function (item) {
                    return { id: item.id, qty: Math.min(99, Math.round(Number(item.qty))) };
                });
        } catch (err) {
            return [];
        }
    }

    function writeCart(nextItems) {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(nextItems));
        } catch (err) {
            /* приватный режим — корзина останется в памяти страницы */
        }
        document.dispatchEvent(new CustomEvent('cart:change', { detail: { count: cart.count() } }));
    }

    const cart = {
        items: function () {
            return readCart().map(function (item) {
                const product = getProduct(item.id);
                return { product: product, qty: item.qty, sum: product.price * item.qty };
            });
        },
        count: function () {
            return readCart().reduce(function (acc, item) { return acc + item.qty; }, 0);
        },
        subtotal: function () {
            return cart.items().reduce(function (acc, item) { return acc + item.sum; }, 0);
        },
        add: function (id, qty) {
            const product = getProduct(id);
            if (!product) return null;
            const amount = Math.max(1, Math.round(Number(qty) || 1));
            const current = readCart();
            const existing = current.find(function (item) { return item.id === id; });
            if (existing) {
                existing.qty = Math.min(99, existing.qty + amount);
            } else {
                current.push({ id: id, qty: Math.min(99, amount) });
            }
            writeCart(current);
            return product;
        },
        setQty: function (id, qty) {
            const amount = Math.max(0, Math.round(Number(qty) || 0));
            let current = readCart();
            if (amount === 0) {
                current = current.filter(function (item) { return item.id !== id; });
            } else {
                const existing = current.find(function (item) { return item.id === id; });
                if (existing) existing.qty = Math.min(99, amount);
            }
            writeCart(current);
        },
        remove: function (id) {
            writeCart(readCart().filter(function (item) { return item.id !== id; }));
        },
        clear: function () {
            writeCart([]);
        },
        delivery: function () {
            const subtotal = cart.subtotal();
            if (!subtotal) return 0;
            return subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
        },
        total: function () {
            return cart.subtotal() + cart.delivery();
        }
    };

    /* ---------- Тосты ---------- */
    const TOAST_ICONS = {
        success: '✓',
        error: '!',
        warning: '!',
        info: 'i',
        cart: '🛒'
    };

    const MAX_TOASTS = 4;

    function toastStack() {
        let stack = document.querySelector('.toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            stack.setAttribute('role', 'status');
            stack.setAttribute('aria-live', 'polite');
            stack.setAttribute('aria-atomic', 'false');
            document.body.appendChild(stack);
        }
        return stack;
    }

    function dismissToast(node) {
        if (!node || node.classList.contains('is-leaving')) return;
        node.classList.add('is-leaving');
        window.setTimeout(function () {
            if (node.parentNode) node.parentNode.removeChild(node);
        }, 300);
    }

    function toast(title, options) {
        const opts = options || {};
        const type = TOAST_ICONS[opts.type] ? opts.type : 'info';
        const duration = typeof opts.duration === 'number' ? opts.duration : 4600;

        const stack = toastStack();
        while (stack.children.length >= MAX_TOASTS) {
            stack.removeChild(stack.firstElementChild);
        }

        const node = document.createElement('div');
        node.className = 'toast';
        node.dataset.type = type;
        node.style.setProperty('--toast-duration', duration + 'ms');

        const icon = document.createElement('div');
        icon.className = 'toast__icon';
        icon.textContent = TOAST_ICONS[type];
        icon.setAttribute('aria-hidden', 'true');

        const content = document.createElement('div');
        content.className = 'toast__content';

        const titleEl = document.createElement('div');
        titleEl.className = 'toast__title';
        titleEl.textContent = title;
        content.appendChild(titleEl);

        if (opts.text) {
            const textEl = document.createElement('div');
            textEl.className = 'toast__text';
            textEl.textContent = opts.text;
            content.appendChild(textEl);
        }

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'toast__close';
        close.innerHTML = '&times;';
        close.setAttribute('aria-label', 'Закрыть уведомление');
        close.addEventListener('click', function () { clearTimeout(timer); dismissToast(node); });

        const progress = document.createElement('div');
        progress.className = 'toast__progress';

        node.appendChild(icon);
        node.appendChild(content);
        node.appendChild(close);
        node.appendChild(progress);
        stack.appendChild(node);

        let remaining = duration;
        let startedAt = Date.now();
        let timer = window.setTimeout(function () { dismissToast(node); }, remaining);

        function pause() {
            if (!node.isConnected) return;
            clearTimeout(timer);
            remaining -= Date.now() - startedAt;
            if (remaining < 600) remaining = 600;
        }

        function resume() {
            if (!node.isConnected) return;
            startedAt = Date.now();
            timer = window.setTimeout(function () { dismissToast(node); }, remaining);
        }

        node.addEventListener('mouseenter', pause);
        node.addEventListener('mouseleave', resume);
        node.addEventListener('focusin', pause);
        node.addEventListener('focusout', resume);

        return node;
    }

    /* ---------- Шапка и общие элементы ---------- */
    function renderCartBadges() {
        const count = cart.count();
        document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
            const previous = Number(badge.dataset.value || 0);
            badge.textContent = String(count);
            badge.hidden = count === 0;
            if (count !== previous) {
                badge.dataset.value = String(count);
                if (count > 0) {
                    badge.classList.remove('is-bumping');
                    void badge.offsetWidth;
                    badge.classList.add('is-bumping');
                }
            }
        });
    }

    function initHeader() {
        const header = document.querySelector('.site-header');
        const navToggle = document.querySelector('.nav-toggle');
        const nav = document.querySelector('.nav-links');

        if (header) {
            const onScroll = function () {
                header.classList.toggle('is-scrolled', window.scrollY > 8);
            };
            onScroll();
            window.addEventListener('scroll', onScroll, { passive: true });
        }

        if (navToggle && nav) {
            navToggle.addEventListener('click', function () {
                const isOpen = nav.classList.toggle('is-open');
                navToggle.setAttribute('aria-expanded', String(isOpen));
            });

            nav.addEventListener('click', function (event) {
                if (event.target.closest('a')) {
                    nav.classList.remove('is-open');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            });

            document.addEventListener('click', function (event) {
                if (!nav.classList.contains('is-open')) return;
                if (nav.contains(event.target) || navToggle.contains(event.target)) return;
                nav.classList.remove('is-open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        }

        const yearEl = document.querySelector('[data-year]');
        if (yearEl) yearEl.textContent = String(new Date().getFullYear());

        renderCartBadges();
        document.addEventListener('cart:change', renderCartBadges);
    }

    function initReveal() {
        const nodes = document.querySelectorAll('.reveal');
        if (!nodes.length) return;

        if (!('IntersectionObserver' in window) ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            nodes.forEach(function (node) { node.classList.add('is-visible'); });
            return;
        }

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        nodes.forEach(function (node) { observer.observe(node); });
    }

    /* ---------- Разметка карточек ---------- */
    function badgeHtml(product) {
        if (!product.badge) return '';
        return '<span class="card-badge card-badge--' + product.badge.tone + '">' +
            escapeHtml(product.badge.text) + '</span>';
    }

    function productCardHtml(product) {
        const outOfStock = !product.inStock;

        return '' +
            '<article class="product-card' + (outOfStock ? ' is-out' : '') + '">' +
                badgeHtml(product) +
                '<div class="product-icon" aria-hidden="true">' + product.icon + '</div>' +
                '<h3><a href="product.html?id=' + encodeURIComponent(product.id) + '">' + escapeHtml(product.name) + '</a></h3>' +
                '<p class="card-desc">' + escapeHtml(product.short) + '</p>' +
                '<div class="card-meta">' +
                    '<div class="price">' + formatPrice(product.price) + '</div>' +
                    '<span class="stock' + (outOfStock ? ' stock--out' : '') + '">' +
                        (outOfStock ? 'Нет в наличии' : 'В наличии') +
                    '</span>' +
                '</div>' +
                '<div class="card-actions">' +
                    '<a class="btn btn--sm btn--outline" href="product.html?id=' + encodeURIComponent(product.id) + '">Подробнее</a>' +
                    '<button class="btn btn--sm" type="button" data-add="' + product.id + '"' +
                        (outOfStock ? ' disabled aria-disabled="true" title="Товара нет в наличии"' : '') +
                    '>В корзину</button>' +
                '</div>' +
            '</article>';
    }

    function bindAddToCart(root) {
        (root || document).addEventListener('click', function (event) {
            const trigger = event.target.closest('[data-add]');
            if (!trigger) return;
            const id = trigger.getAttribute('data-add');
            const found = getProduct(id);

            if (found && !found.inStock) {
                toast('Нет в наличии', {
                    type: 'warning',
                    text: found.name + ' — сейчас недоступен, мы сообщим о поступлении.'
                });
                return;
            }

            const product = cart.add(id, 1);
            if (!product) return;

            const qty = cart.items().find(function (item) { return item.product.id === id; });
            toast(product.name + ' — в корзине', {
                type: 'cart',
                text: (qty ? 'Количество: ' + qty.qty + ' · ' : '') + 'Сумма заказа: ' + formatPrice(cart.subtotal()),
                duration: 4200
            });
        });
    }

    /* ---------- Главная страница ---------- */
    function initHome() {
        const featured = document.querySelector('[data-featured]');
        if (featured) {
            const ids = ['eco', 'pro', 'wifi'];
            const featuredProducts = ids.map(getProduct).filter(Boolean);

            // Сначала то, что можно купить сейчас.
            featuredProducts.sort(function (a, b) {
                if (a.inStock === b.inStock) return 0;
                return a.inStock ? -1 : 1;
            });

            featured.innerHTML = featuredProducts.map(productCardHtml).join('');
        }

        const overlay = document.getElementById('surveyOverlay');
        if (!overlay) return;

        const form = overlay.querySelector('form');
        let lastFocused = null;

        function openSurvey() {
            if (overlay.classList.contains('is-open')) return;
            lastFocused = document.activeElement;
            overlay.classList.add('is-open');
            document.body.classList.add('is-locked');
            const first = overlay.querySelector('input, button');
            if (first) first.focus();
        }

        function closeSurvey() {
            overlay.classList.remove('is-open');
            document.body.classList.remove('is-locked');
            if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
        }

        overlay.querySelectorAll('[data-close-survey]').forEach(function (btn) {
            btn.addEventListener('click', closeSurvey);
        });

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeSurvey();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && overlay.classList.contains('is-open')) closeSurvey();
        });

        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                const checked = form.querySelector('input[name="surveyTarget"]:checked');
                const labels = { office: 'офис или коворкинг', cafe: 'кафе или ресторан', factory: 'производство', home: 'частный дом' };
                const choice = checked ? checked.value : 'office';
                closeSurvey();
                toast('Спасибо за ответ!', {
                    type: 'success',
                    text: 'Подберём конфигурацию для «' + labels[choice] + '» и пришлём спецпредложение.'
                });
            });
        }

        try {
            if (!sessionStorage.getItem('smartbin_survey_shown')) {
                window.setTimeout(function () {
                    if (!document.body.classList.contains('is-locked')) {
                        openSurvey();
                        sessionStorage.setItem('smartbin_survey_shown', 'true');
                    }
                }, 15000);
            }
        } catch (err) {
            /* sessionStorage недоступен — опрос просто не откроется автоматически */
        }

        const manual = document.querySelector('[data-open-survey]');
        if (manual) manual.addEventListener('click', openSurvey);
    }

    /* ---------- Каталог ---------- */
    function initCatalog() {
        const grid = document.querySelector('[data-catalog]');
        if (!grid) return;

        const chips = Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
        const searchInput = document.querySelector('[data-search]');
        const sortSelect = document.querySelector('[data-sort]');
        const note = document.querySelector('[data-results-note]');

        const state = { filter: 'all', query: '', sort: 'popular' };

        const params = new URLSearchParams(window.location.search);
        const urlFilter = params.get('filter');
        if (urlFilter === 'bin' || urlFilter === 'part') {
            state.filter = urlFilter;
            chips.forEach(function (chip) {
                chip.classList.toggle('is-active', chip.getAttribute('data-filter') === urlFilter);
            });
        }

        function apply() {
            let list = PRODUCTS.slice();

            if (state.filter !== 'all') {
                list = list.filter(function (p) { return p.category === state.filter; });
            }

            if (state.query) {
                const q = state.query.toLowerCase();
                list = list.filter(function (p) {
                    return (p.name + ' ' + p.short).toLowerCase().indexOf(q) !== -1;
                });
            }

            if (state.sort === 'price-asc') {
                list.sort(function (a, b) { return a.price - b.price; });
            } else if (state.sort === 'price-desc') {
                list.sort(function (a, b) { return b.price - a.price; });
            } else {
                list.sort(function (a, b) {
                    const weight = function (p) { return (p.category === 'bin' ? 0 : 10) + (p.popular ? 0 : 1); };
                    return weight(a) - weight(b);
                });
            }

            // Товары не в наличии — в конце списка, независимо от сортировки.
            list.sort(function (a, b) {
                if (a.inStock === b.inStock) return 0;
                return a.inStock ? -1 : 1;
            });

            grid.innerHTML = list.length
                ? list.map(productCardHtml).join('')
                : '<div class="empty-state" style="grid-column:1/-1">' +
                    '<div class="empty-state__icon" aria-hidden="true">🔍</div>' +
                    '<h2>Ничего не нашлось</h2>' +
                    '<p>Попробуйте другой запрос или сбросьте фильтры.</p>' +
                    '<button class="btn btn--ghost" type="button" data-reset-filters>Сбросить фильтры</button>' +
                  '</div>';

            if (note) {
                note.textContent = list.length
                    ? 'Найдено ' + list.length + ' ' + plural(list.length, 'товар', 'товара', 'товаров')
                    : 'По вашему запросу ничего не найдено';
            }
        }

        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                chips.forEach(function (c) { c.classList.remove('is-active'); });
                chip.classList.add('is-active');
                state.filter = chip.getAttribute('data-filter');
                apply();
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', function () {
                state.query = searchInput.value.trim();
                apply();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', function () {
                state.sort = sortSelect.value;
                apply();
            });
        }

        grid.addEventListener('click', function (event) {
            if (!event.target.closest('[data-reset-filters]')) return;
            state.filter = 'all';
            state.query = '';
            if (searchInput) searchInput.value = '';
            chips.forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-filter') === 'all'); });
            apply();
        });

        apply();
    }

    /* ---------- Страница товара ---------- */
    function initProduct() {
        const root = document.querySelector('[data-product]');
        if (!root) return;

        const params = new URLSearchParams(window.location.search);
        const product = getProduct(params.get('id'));
        const crumb = document.querySelector('[data-product-crumb]');

        if (!product) {
            root.innerHTML = '<div class="empty-state">' +
                '<div class="empty-state__icon" aria-hidden="true">🤔</div>' +
                '<h2>Такого товара нет</h2>' +
                '<p>Возможно, ссылка устарела. Посмотрите, что есть в каталоге.</p>' +
                '<a class="btn" href="catalog.html">Перейти в каталог</a>' +
                '</div>';
            if (crumb) crumb.textContent = 'Товар не найден';
            root.style.display = 'block';
            return;
        }

        document.title = product.name + ' — SmartBin';
        if (crumb) crumb.textContent = product.name;

        const specs = product.specs.map(function (row) {
            return '<tr><th scope="row">' + escapeHtml(row[0]) + '</th><td>' + escapeHtml(row[1]) + '</td></tr>';
        }).join('');

        const features = product.features.map(function (item) {
            return '<li><span class="check" aria-hidden="true">✓</span>' + escapeHtml(item) + '</li>';
        }).join('');

        root.innerHTML = '' +
            '<div class="product-visual" aria-hidden="true">' + product.icon + '</div>' +
            '<div class="product-info">' +
                badgeHtml(product) +
                '<h1>' + escapeHtml(product.name) + '</h1>' +
                '<p class="lead">' + escapeHtml(product.description) + '</p>' +
                '<div class="product-price-row">' +
                    '<div class="price">' + formatPrice(product.price) + '</div>' +
                    '<span class="stock' + (product.inStock ? '' : ' stock--out') + '">' +
                        (product.inStock ? 'В наличии на складе' : 'Нет в наличии') +
                    '</span>' +
                '</div>' +
                '<ul class="features">' + features + '</ul>' +
                '<div class="product-price-row" style="gap:14px;flex-wrap:wrap">' +
                    '<div class="qty-control">' +
                        '<button type="button" data-qty-minus aria-label="Уменьшить количество">−</button>' +
                        '<input type="number" value="1" min="1" max="99" step="1" inputmode="numeric" aria-label="Количество" data-qty-input>' +
                        '<button type="button" data-qty-plus aria-label="Увеличить количество">+</button>' +
                    '</div>' +
                    '<button class="btn btn--grad" type="button" data-product-add' +
                        (product.inStock ? '' : ' disabled aria-disabled="true"') + '>' +
                        (product.inStock ? 'Добавить в корзину' : 'Нет в наличии') +
                    '</button>' +
                    '<a class="btn btn--outline" href="cart.html">Перейти в корзину</a>' +
                '</div>' +
                '<div class="note-box"><span aria-hidden="true">🚚</span><div>Бесплатная доставка от ' +
                    formatPrice(FREE_DELIVERY_FROM) + '. Гарантия и возврат — 14 дней с момента получения.</div></div>' +
                '<table class="specs"><caption class="visually-hidden">Характеристики ' + escapeHtml(product.name) + '</caption><tbody>' +
                    specs + '</tbody></table>' +
            '</div>';

        if (product.badge) {
            const badge = root.querySelector('.card-badge');
            if (badge) badge.style.position = 'static', badge.style.display = 'inline-block', badge.style.marginBottom = '12px';
        }

        const input = root.querySelector('[data-qty-input]');
        const addBtn = root.querySelector('[data-product-add]');

        function clampQty(value) {
            const number = Math.round(Number(value) || 1);
            return Math.min(99, Math.max(1, number));
        }

        root.querySelector('[data-qty-minus]').addEventListener('click', function () {
            input.value = String(clampQty(Number(input.value) - 1));
        });

        root.querySelector('[data-qty-plus]').addEventListener('click', function () {
            input.value = String(clampQty(Number(input.value) + 1));
        });

        input.addEventListener('change', function () {
            input.value = String(clampQty(input.value));
        });

        addBtn.addEventListener('click', function () {
            if (!product.inStock) {
                toast('Нет в наличии', { type: 'warning', text: product.name + ' — сейчас недоступен.' });
                return;
            }

            const amount = clampQty(input.value);
            cart.add(product.id, amount);
            toast(product.name + ' — в корзине', {
                type: 'cart',
                text: amount + ' шт · Сумма заказа: ' + formatPrice(cart.subtotal())
            });
        });

        const related = document.querySelector('[data-related]');
        if (related) {
            const similar = PRODUCTS.filter(function (p) {
                return p.id !== product.id && p.category === product.category;
            }).slice(0, 3);

            const section = related.closest('section');
            if (!similar.length && section) {
                section.hidden = true;
            } else {
                related.innerHTML = similar.map(productCardHtml).join('');
            }
        }
    }

    /* ---------- Корзина: страница ---------- */
    function readOrders() {
        try {
            const parsed = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }

    function saveOrder(order) {
        try {
            const orders = readOrders();
            orders.unshift(order);
            localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 10)));
        } catch (err) {
            /* история заказов просто не сохранится */
        }
    }

    function initCartPage() {
        const listEl = document.querySelector('[data-cart-items]');
        if (!listEl) return;

        const layout = document.querySelector('[data-cart-layout]');
        const emptyEl = document.querySelector('[data-cart-empty]');
        const successEl = document.querySelector('[data-cart-success]');
        const form = document.querySelector('[data-checkout-form]');
        const summaryEl = document.querySelector('[data-cart-summary]');
        const ordersEl = document.querySelector('[data-orders]');

        function renderSummary() {
            if (!summaryEl) return;
            const subtotal = cart.subtotal();
            const delivery = cart.delivery();
            summaryEl.innerHTML = '' +
                '<div class="summary-row"><span>Товары (' + cart.count() + ')</span><strong>' + formatPrice(subtotal) + '</strong></div>' +
                '<div class="summary-row"><span>Доставка</span><strong>' + (delivery ? formatPrice(delivery) : 'Бесплатно') + '</strong></div>' +
                (delivery ? '<div class="summary-row"><span>До бесплатной доставки</span><strong>' +
                    formatPrice(Math.max(0, FREE_DELIVERY_FROM - subtotal)) + '</strong></div>' : '') +
                '<div class="summary-total"><span>Итого</span><strong>' + formatPrice(subtotal + delivery) + '</strong></div>';
        }

        function renderItems() {
            const items = cart.items();

            if (!items.length) {
                if (layout) layout.hidden = true;
                if (emptyEl) emptyEl.hidden = false;
                return;
            }

            if (layout) layout.hidden = false;
            if (emptyEl) emptyEl.hidden = true;

            listEl.innerHTML = items.map(function (item) {
                return '' +
                    '<div class="cart-item" data-id="' + item.product.id + '">' +
                        '<div class="cart-item__icon" aria-hidden="true">' + item.product.icon + '</div>' +
                        '<div>' +
                            '<div class="cart-item__title"><a href="product.html?id=' + encodeURIComponent(item.product.id) + '">' +
                                escapeHtml(item.product.name) + '</a></div>' +
                            '<div class="cart-item__meta">' + formatPrice(item.product.price) + ' / шт</div>' +
                            '<div class="qty-control" style="margin-top:8px">' +
                                '<button type="button" data-step="-1" aria-label="Уменьшить количество">−</button>' +
                                '<input type="number" value="' + item.qty + '" min="1" max="99" step="1" inputmode="numeric" aria-label="Количество" data-qty>' +
                                '<button type="button" data-step="1" aria-label="Увеличить количество">+</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="cart-item__side">' +
                            '<div class="cart-item__sum">' + formatPrice(item.sum) + '</div>' +
                            '<button class="link-danger" type="button" data-remove>Удалить</button>' +
                        '</div>' +
                    '</div>';
            }).join('');

            renderSummary();
        }

        listEl.addEventListener('click', function (event) {
            const row = event.target.closest('.cart-item');
            if (!row) return;
            const id = row.getAttribute('data-id');

            if (event.target.closest('[data-remove]')) {
                const product = getProduct(id);
                cart.remove(id);
                renderItems();
                toast('Товар удалён', {
                    type: 'info',
                    text: product ? product.name + ' больше не в корзине.' : 'Корзина обновлена.',
                    duration: 3200
                });
                return;
            }

            const step = event.target.closest('[data-step]');
            if (step) {
                const input = row.querySelector('[data-qty]');
                const next = Math.max(1, Math.min(99, Number(input.value) + Number(step.getAttribute('data-step'))));
                input.value = String(next);
                cart.setQty(id, next);
                renderItems();
            }
        });

        listEl.addEventListener('change', function (event) {
            const input = event.target.closest('[data-qty]');
            if (!input) return;
            const row = input.closest('.cart-item');
            const next = Math.max(1, Math.min(99, Math.round(Number(input.value) || 1)));
            input.value = String(next);
            cart.setQty(row.getAttribute('data-id'), next);
            renderItems();
        });

        const clearBtn = document.querySelector('[data-clear-cart]');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (!cart.count()) return;
                cart.clear();
                renderItems();
                toast('Корзина очищена', { type: 'info', duration: 3200 });
            });
        }

        function fieldError(field, message) {
            const wrap = field.closest('.field');
            if (!wrap) return;
            wrap.classList.add('has-error');
            const errorEl = wrap.querySelector('.field-error');
            if (errorEl) errorEl.textContent = message;
        }

        function clearErrors(formEl) {
            formEl.querySelectorAll('.field.has-error').forEach(function (field) {
                field.classList.remove('has-error');
            });
        }

        function digits(value) {
            return String(value).replace(/\D/g, '');
        }

        if (form) {
            form.addEventListener('input', function (event) {
                const wrap = event.target.closest('.field');
                if (wrap) wrap.classList.remove('has-error');
            });

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                clearErrors(form);

                const nameInput = form.elements.customerName;
                const phoneInput = form.elements.customerPhone;
                const emailInput = form.elements.customerEmail;
                const cityInput = form.elements.customerCity;
                const addressInput = form.elements.customerAddress;
                const agreement = form.elements.agreement;
                const deliveryKind = form.querySelector('input[name="delivery"]:checked');
                const isPickup = deliveryKind && deliveryKind.value === 'pickup';

                let firstInvalid = null;

                if (nameInput.value.trim().length < 2) {
                    fieldError(nameInput, 'Укажите имя — минимум 2 символа');
                    firstInvalid = firstInvalid || nameInput;
                }

                if (digits(phoneInput.value).length < 10) {
                    fieldError(phoneInput, 'Телефон в формате +7 900 000-00-00');
                    firstInvalid = firstInvalid || phoneInput;
                }

                if (emailInput.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailInput.value.trim())) {
                    fieldError(emailInput, 'Проверьте адрес электронной почты');
                    firstInvalid = firstInvalid || emailInput;
                }

                if (!isPickup && cityInput.value.trim().length < 2) {
                    fieldError(cityInput, 'Укажите город доставки');
                    firstInvalid = firstInvalid || cityInput;
                }

                if (!isPickup && addressInput.value.trim().length < 5) {
                    fieldError(addressInput, 'Улица, дом, квартира — минимум 5 символов');
                    firstInvalid = firstInvalid || addressInput;
                }

                if (!agreement.checked) {
                    toast('Нужно согласие', {
                        type: 'warning',
                        text: 'Подтвердите согласие на обработку персональных данных.'
                    });
                    firstInvalid = firstInvalid || agreement;
                }

                if (firstInvalid) {
                    if (firstInvalid.focus) firstInvalid.focus();
                    toast('Проверьте форму', {
                        type: 'error',
                        text: 'Некоторые поля заполнены неверно — они подсвечены.'
                    });
                    return;
                }

                const items = cart.items();
                const order = {
                    number: 'SB-' + String(Date.now()).slice(-6),
                    createdAt: new Date().toISOString(),
                    items: items.map(function (item) {
                        return { name: item.product.name, qty: item.qty, price: item.product.price };
                    }),
                    subtotal: cart.subtotal(),
                    delivery: isPickup ? 0 : cart.delivery(),
                    total: isPickup ? cart.subtotal() : cart.total(),
                    customer: {
                        name: nameInput.value.trim(),
                        phone: phoneInput.value.trim(),
                        email: emailInput.value.trim(),
                        city: isPickup ? '' : cityInput.value.trim(),
                        address: isPickup ? '' : addressInput.value.trim()
                    },
                    deliveryKind: isPickup ? 'pickup' : 'courier'
                };

                saveOrder(order);
                cart.clear();

                if (layout) layout.hidden = true;
                if (emptyEl) emptyEl.hidden = true;
                if (successEl) {
                    successEl.hidden = false;
                    successEl.innerHTML = '' +
                        '<div class="order-success">' +
                            '<div class="order-success__mark" aria-hidden="true">✓</div>' +
                            '<h2>Заказ оформлен</h2>' +
                            '<p>Спасибо, ' + escapeHtml(order.customer.name) + '! Мы свяжемся с вами по телефону ' +
                                escapeHtml(order.customer.phone) + ' в течение рабочего дня.</p>' +
                            '<div class="order-number">' + order.number + '</div>' +
                            '<div style="max-width:420px;margin:0 auto">' +
                                '<div class="order-line"><span>Товаров</span><b>' + items.reduce(function (a, i) { return a + i.qty; }, 0) + ' шт</b></div>' +
                                '<div class="order-line"><span>Доставка</span><b>' +
                                    (order.deliveryKind === 'pickup' ? 'Самовывоз, бесплатно' : (order.delivery ? formatPrice(order.delivery) : 'Бесплатно')) + '</b></div>' +
                                '<div class="order-line"><span>Сумма</span><b>' + formatPrice(order.total) + '</b></div>' +
                            '</div>' +
                            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px">' +
                                '<a class="btn" href="catalog.html">Вернуться в каталог</a>' +
                                '<a class="btn btn--outline" href="support.html">Задать вопрос</a>' +
                            '</div>' +
                        '</div>';
                    successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                toast('Заказ ' + order.number + ' оформлен', {
                    type: 'success',
                    text: 'Сумма ' + formatPrice(order.total) + '. Детали отправлены менеджеру.',
                    duration: 6000
                });

                renderOrders();
            });
        }

        function renderOrders() {
            if (!ordersEl) return;
            const orders = readOrders();
            if (!orders.length) {
                ordersEl.hidden = true;
                return;
            }
            ordersEl.hidden = false;
            const list = ordersEl.querySelector('[data-orders-list]');
            if (!list) return;
            list.innerHTML = orders.slice(0, 3).map(function (order) {
                const date = new Date(order.createdAt);
                const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
                const count = order.items.reduce(function (a, i) { return a + i.qty; }, 0);
                return '<div class="order-line"><span>' + order.number + ' · ' + dateStr + ' · ' +
                    count + ' ' + plural(count, 'товар', 'товара', 'товаров') + '</span><b>' + formatPrice(order.total) + '</b></div>';
            }).join('');
        }

        document.addEventListener('cart:change', function () {
            if (successEl && !successEl.hidden) return;
            renderItems();
        });

        renderItems();
        renderOrders();
    }

    /* ---------- Поддержка ---------- */
    function initSupport() {
        const chatBody = document.querySelector('[data-chat-body]');
        if (!chatBody) return;

        const form = document.querySelector('[data-chat-form]');
        const input = document.querySelector('[data-chat-input]');
        const contactInput = document.querySelector('[data-chat-contact]');
        let liveMode = false;
        const seenReplies = {};
        const answers = [
            {
                keys: ['достав', 'курьер', 'привез', 'срок'],
                text: 'Доставляем по России: Москва и Санкт-Петербург — 1–2 дня, остальные города — 3–5 дней. От 50 000 ₽ доставка бесплатная, иначе 590 ₽.'
            },
            {
                keys: ['гарант', 'ремонт', 'сломал', 'сервис'],
                text: 'На урны действует гарантия 2 года (Pro — 3 года), на комплектующие — 1 год. Если что-то случится, заберём на диагностику и починим бесплатно.'
            },
            {
                keys: ['цен', 'стоим', 'скидк', 'дешев'],
                text: 'SmartBin Eco — 24 990 ₽, Pro — 49 990 ₽. При заказе от трёх урн даём скидку 7%, для образовательных учреждений — 10%.'
            },
            {
                keys: ['подбер', 'какая', 'выбрат', 'посовет', 'нужн'],
                text: 'Для офиса до 30 человек хватит Eco. Если сотрудников больше или нужен пресс для пластика — берите Pro. Расскажите про помещение, и я подскажу точнее.'
            },
            {
                keys: ['оплат', 'счет', 'карт', 'безнал'],
                text: 'Принимаем карты, СБП и оплату по счёту для юридических лиц. Счёт выставляем в течение часа после подтверждения заказа.'
            }
        ];

        function scrollDown() {
            chatBody.scrollTop = chatBody.scrollHeight;
        }

        function addMessage(text, sender) {
            const node = document.createElement('div');
            node.className = 'message ' + sender;
            node.textContent = text;
            chatBody.appendChild(node);
            scrollDown();
            return node;
        }

        function reply(text) {
            const typing = document.createElement('div');
            typing.className = 'message bot typing';
            typing.setAttribute('aria-label', 'Оператор печатает');
            typing.innerHTML = '<span></span><span></span><span></span>';
            chatBody.appendChild(typing);
            scrollDown();

            window.setTimeout(function () {
                if (typing.parentNode) typing.parentNode.removeChild(typing);
                addMessage(text, 'bot');
            }, 1100);
        }

        function handleSubmit(event) {
            if (event) event.preventDefault();
            const value = input.value.trim();
            if (!value) return;

            addMessage(value, 'user');
            input.value = '';
            input.focus();

            if (liveMode && window.SBChat) {
                const dots = document.createElement('div');
                dots.className = 'message bot typing';
                dots.innerHTML = '<span></span><span></span><span></span>';
                chatBody.appendChild(dots);
                scrollDown();

                SBChat.send({
                    text: value,
                    contact: contactInput ? contactInput.value.trim() : ''
                }).then(function (result) {
                    if (dots.parentNode) dots.parentNode.removeChild(dots);
                    if (result && result.ok === false) throw new Error('rejected');
                    addMessage('Передал оператору. Ответ появится здесь же — страницу можно не закрывать.', 'bot');
                }).catch(function () {
                    if (dots.parentNode) dots.parentNode.removeChild(dots);
                    addMessage('Не удалось отправить сообщение. Проверьте связь и попробуйте ещё раз.', 'bot');
                });
                return;
            }

            const lower = value.toLowerCase();
            const matched = answers.find(function (item) {
                return item.keys.some(function (key) { return lower.indexOf(key) !== -1; });
            });

            reply(matched
                ? matched.text
                : 'Спасибо за сообщение! Передал вопрос специалисту — ответим здесь или по телефону 8 800 350-12-45 в течение 5 минут.');
        }

        function pollReplies() {
            if (!liveMode || !window.SBChat) return;

            SBChat.list().then(function (data) {
                if (!data || !data.ok || !Array.isArray(data.messages)) return;
                const mine = SBChat.deviceId();

                data.messages.forEach(function (message) {
                    if (message.device !== mine) return;
                    if (!message.reply) return;

                    const key = message.id + '|' + message.replyTs;
                    if (seenReplies[key]) return;
                    seenReplies[key] = true;
                    addMessage(message.reply, 'bot');
                });
            }).catch(function () { /* тихо: попробуем на следующем тике */ });
        }

        if (window.SBChat) {
            SBChat.isConfigured().then(function (configured) {
                liveMode = configured;
                if (!configured) return;

                const greeting = chatBody.querySelector('.message.bot');
                if (greeting) {
                    greeting.textContent = 'Здравствуйте! Напишите вопрос — он уйдёт оператору, а ответ появится здесь же.';
                }
                window.setInterval(pollReplies, 8000);
                pollReplies();
            });
        }

        if (form) form.addEventListener('submit', handleSubmit);

        document.querySelectorAll('[data-faq-question]').forEach(function (button) {
            button.addEventListener('click', function () {
                const question = button.getAttribute('data-faq-question');
                if (input) {
                    input.value = question;
                    input.focus();
                }
            });
        });

        scrollDown();
    }

    /* ---------- Запуск ---------- */
    function startApp() {
        initHeader();
        initReveal();
        bindAddToCart(document);
        initHome();
        initCatalog();
        initProduct();
        initCartPage();
        initSupport();
    }

    function boot() {
        if (!window.SBSync) {
            startApp();
            return;
        }

        const cfg = SBSync.readConfig();
        if (!cfg.owner || !cfg.repo) {
            // Общий файл не настроен — рисуем сразу, без ожидания сети.
            startApp();
            return;
        }

        // Общие данные из репозитория важнее локальных правок: сначала читаем,
        // потом рисуем страницу, чтобы не было «мигания» цен.
        window.SBSync.loadShared().then(function (shared) {
            if (shared && shared.products) applyProductPatch(shared.products);
        }).catch(function () {
            /* нет сети — работаем на локальных данных */
        }).then(startApp);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* ---------- Публичный интерфейс ---------- */
    window.SB = {
        products: PRODUCTS,
        getProduct: getProduct,
        formatPrice: formatPrice,
        cart: cart,
        toast: toast
    };
})();
