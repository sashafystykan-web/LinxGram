// ==UserScript==
// @name         LinxGram
// @namespace    Violentmonkey Scripts
// @version      2.0.0
// @description  Кастомизация ника + автоматический бейдж LinxGram
// @match        https://unixgram.com/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const MENU_NAME = 'LinxGram';

    // =========================================================
    // API
    // =========================================================

    // ВСТАВЬ СЮДА URL ТВОЕГО RENDER СЕРВЕРА
    const API_URL = 'https://linxgram.onrender.com';

    // =========================================================
    // LOCAL SETTINGS
    // =========================================================

    const STORAGE_KEYS = {
        username: 'linxgram_nick_username',
        mode: 'linxgram_nick_mode',
        color: 'linxgram_nick_color'
    };

    const NICK_COLORS = [
        '#ff5e5e',
        '#ff9d42',
        '#ffd93d',
        '#6bd66b',
        '#2ecc71',
        '#4fc3f7',
        '#7c8cff',
        '#c77dff'
    ];

    // Кэш бейджей
    let badgeUsers = new Map();

    // =========================================================
    // SETTINGS
    // =========================================================

    function getNickSettings() {
        return {
            username: localStorage.getItem(STORAGE_KEYS.username) || '',
            mode: localStorage.getItem(STORAGE_KEYS.mode) || 'none',
            color: localStorage.getItem(STORAGE_KEYS.color) || NICK_COLORS[4]
        };
    }

    function setNickSetting(key, value) {
        localStorage.setItem(STORAGE_KEYS[key], value);
    }

    function cssEscape(str) {
        return window.CSS && CSS.escape
            ? CSS.escape(str)
            : str.replace(/([^\w-])/g, '\\$1');
    }

    // =========================================================
    // NICK STYLE
    // =========================================================

    function styleTarget(target, mode, color) {
        if (!target) return;

        target.classList.remove('linxgram-nick-rainbow');

        target.style.removeProperty('color');
        target.style.removeProperty('text-shadow');

        target.removeAttribute('data-linxgram-nick');

        if (mode === 'solid') {
            target.style.setProperty('color', color, 'important');

            target.setAttribute(
                'data-linxgram-nick',
                'true'
            );
        }

        if (mode === 'rainbow') {
            target.classList.add('linxgram-nick-rainbow');

            target.setAttribute(
                'data-linxgram-nick',
                'true'
            );
        }
    }

    function applyNickStyle() {
        const {
            username,
            mode,
            color
        } = getNickSettings();

        if (!username) return;

        const selector =
            `a[href="/u/${cssEscape(username)}"]`;

        document.querySelectorAll(selector).forEach(link => {
            const target =
                link.querySelector('span.text-white') || link;

            styleTarget(target, mode, color);
        });

        const onOwnProfile =
            window.location.pathname === `/u/${username}`;

        if (onOwnProfile) {
            document
                .querySelectorAll(
                    'h2.font-extrabold, span.font-black'
                )
                .forEach(el => {

                    if (
                        el.closest(
                            '[data-linxgram-panel]'
                        )
                    ) return;

                    if (!el.textContent.trim()) return;

                    styleTarget(
                        el,
                        mode,
                        color
                    );
                });
        }
    }

    // =========================================================
    // USERNAME
    // =========================================================

    function getCurrentUsername() {
        // Сначала пытаемся взять username из URL профиля
        const match =
            window.location.pathname.match(/^\/u\/([^/]+)/);

        if (match) {
            return decodeURIComponent(match[1]);
        }

        // Если мы не на профиле — берём сохранённый username
        return getNickSettings().username || '';
    }

    // =========================================================
    // API REGISTER
    // =========================================================

    async function registerUser() {
        if (
            !API_URL ||
            API_URL.includes('YOUR-APP')
        ) {
            console.warn(
                '[LinxGram] API_URL не настроен'
            );

            return;
        }

        const username =
            getCurrentUsername();

        if (!username) return;

        try {
            const response =
                await fetch(
                    `${API_URL}/api/register`,
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body: JSON.stringify({
                            username
                        })
                    }
                );

            if (!response.ok) {
                console.warn(
                    '[LinxGram] Register error:',
                    response.status
                );

                return;
            }

            console.log(
                '[LinxGram] Пользователь зарегистрирован:',
                username
            );

        } catch (error) {
            console.warn(
                '[LinxGram] API недоступен:',
                error
            );
        }
    }

    // =========================================================
    // LOAD BADGES
    // =========================================================

    async function loadBadges() {
        if (
            !API_URL ||
            API_URL.includes('YOUR-APP')
        ) {
            return;
        }

        try {
            const response =
                await fetch(
                    `${API_URL}/api/badges`,
                    {
                        cache: 'no-store'
                    }
                );

            if (!response.ok) return;

            const data =
                await response.json();

            badgeUsers.clear();

            const users =
                Array.isArray(data)
                    ? data
                    : data.users || [];

            users.forEach(user => {
                if (!user.username) return;

                badgeUsers.set(
                    user.username.toLowerCase(),
                    user.badge
                );
            });

            applyBadges();

        } catch (error) {
            console.warn(
                '[LinxGram] Ошибка загрузки бейджей:',
                error
            );
        }
    }

    // =========================================================
    // BADGES
    // =========================================================

    function getUsernameFromLink(link) {
        const href =
            link.getAttribute('href');

        if (!href) return null;

        const match =
            href.match(/^\/u\/([^/]+)/);

        if (!match) return null;

        return decodeURIComponent(
            match[1]
        );
    }

    function createBadge(badge) {
        if (!badge) return null;

        const wrapper =
            document.createElement('span');

        wrapper.className =
            'linxgram-badge';

        wrapper.setAttribute(
            'data-linxgram-badge',
            'true'
        );

        wrapper.title =
            badge.name || 'LinxGram';

        // Место под картинку бейджа
        if (badge.imageUrl) {
            const img =
                document.createElement('img');

            img.src = badge.imageUrl;

            img.alt =
                badge.name || 'LinxGram';

            img.className =
                'linxgram-badge-image';

            img.draggable = false;

            wrapper.appendChild(img);
        } else {
            // Временный вариант, если картинка ещё не указана
            wrapper.textContent = '✓';
        }

        return wrapper;
    }

    function applyBadges() {
        if (!badgeUsers.size) return;

        document
            .querySelectorAll(
                'a[href^="/u/"]'
            )
            .forEach(link => {

                if (
                    link.querySelector(
                        '[data-linxgram-badge]'
                    )
                ) return;

                const username =
                    getUsernameFromLink(link);

                if (!username) return;

                const badge =
                    badgeUsers.get(
                        username.toLowerCase()
                    );

                if (!badge) return;

                const badgeElement =
                    createBadge(badge);

                if (!badgeElement) return;

                // Ищем текст ника
                const textElement =
                    link.querySelector(
                        'span.text-white'
                    ) || link;

                textElement.style.display =
                    'inline-flex';

                textElement.style.alignItems =
                    'center';

                textElement.style.gap =
                    '5px';

                textElement.appendChild(
                    badgeElement
                );
            });
    }

    // =========================================================
    // MENU
    // =========================================================

    function createMenuItem() {
        const profile =
            [...document.querySelectorAll(
                'a, button, div'
            )].find(
                el =>
                    el.textContent.trim() ===
                    'Профиль'
            );

        if (!profile) return;

        if (
            document.querySelector(
                '[data-linxgram-menu]'
            )
        ) return;

        const item =
            profile.cloneNode(true);

        item.setAttribute(
            'data-linxgram-menu',
            'true'
        );

        const text =
            [...item.childNodes].find(
                node =>
                    node.nodeType ===
                        Node.TEXT_NODE &&
                    node.textContent.trim()
            );

        if (text) {
            text.textContent =
                ` ${MENU_NAME}`;
        } else {
            const spans =
                item.querySelectorAll('span');

            if (spans.length) {
                spans[
                    spans.length - 1
                ].textContent =
                    MENU_NAME;
            } else {
                item.appendChild(
                    document.createTextNode(
                        MENU_NAME
                    )
                );
            }
        }

        const svg =
            item.querySelector('svg');

        if (svg) {
            svg.innerHTML = `
                <path
                    d="M12 2L14.4 8.1L21 9L16.2 13.4L17.5 20L12 16.8L6.5 20L7.8 13.4L3 9L9.6 8.1L12 2Z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                />
            `;
        }

        item.addEventListener(
            'click',
            e => {
                e.preventDefault();
                e.stopPropagation();

                openLinxGram();
            }
        );

        profile.parentElement.insertBefore(
            item,
            profile.nextSibling
        );
    }

    // =========================================================
    // NICK SETTINGS UI
    // =========================================================

    function buildNickSection() {
        const {
            username,
            mode,
            color
        } = getNickSettings();

        const swatches =
            NICK_COLORS.map(c => `
                <button
                    type="button"
                    class="linxgram-swatch ${
                        mode === 'solid' &&
                        color.toLowerCase() ===
                        c.toLowerCase()
                            ? 'linxgram-swatch-active'
                            : ''
                    }"
                    data-color="${c}"
                    style="background:${c}">
                </button>
            `).join('');

        return `
            <div
                class="linxgram-section"
                style="margin-top:12px;"
            >
                <div class="linxgram-section-title">
                    Ник
                </div>

                <div
                    class="linxgram-setting"
                    style="
                        flex-direction:column;
                        align-items:stretch;
                        gap:8px;
                        min-height:auto;
                        padding:12px 15px;
                    "
                >
                    <label
                        style="
                            font-size:12px;
                            color:#8e8e98;
                        "
                    >
                        Ваш username (без @)
                    </label>

                    <input
                        type="text"
                        id="linxgram-nick-username"
                        value="${escapeHtml(username)}"
                        placeholder="например ohao"
                        class="linxgram-input"
                    />
                </div>

                <div
                    class="linxgram-setting"
                    style="
                        flex-direction:column;
                        align-items:stretch;
                        gap:10px;
                        min-height:auto;
                        padding:12px 15px;
                    "
                >
                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                        "
                    >
                        <span>Радужный</span>

                        <label
                            class="linxgram-switch"
                        >
                            <input
                                type="checkbox"
                                id="linxgram-nick-rainbow"
                                ${
                                    mode === 'rainbow'
                                        ? 'checked'
                                        : ''
                                }
                            >

                            <span></span>
                        </label>
                    </div>

                    <div
                        id="linxgram-nick-swatches"
                        style="
                            display:flex;
                            gap:8px;
                            flex-wrap:wrap;
                            ${
                                mode === 'rainbow'
                                    ? 'opacity:.35;pointer-events:none;'
                                    : ''
                            }
                        "
                    >
                        ${swatches}

                        <input
                            type="color"
                            id="linxgram-nick-custom"
                            value="${
                                mode === 'solid'
                                    ? color
                                    : NICK_COLORS[4]
                            }"
                            class="linxgram-color-input"
                        />
                    </div>
                </div>
            </div>
        `;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function wireNickSection(panel) {
        const usernameInput =
            panel.querySelector(
                '#linxgram-nick-username'
            );

        const rainbowToggle =
            panel.querySelector(
                '#linxgram-nick-rainbow'
            );

        const swatchesWrap =
            panel.querySelector(
                '#linxgram-nick-swatches'
            );

        const customColor =
            panel.querySelector(
                '#linxgram-nick-custom'
            );

        usernameInput.addEventListener(
            'input',
            () => {

                const username =
                    usernameInput.value.trim();

                setNickSetting(
                    'username',
                    username
                );

                applyNickStyle();
            }
        );

        rainbowToggle.addEventListener(
            'change',
            () => {

                if (
                    rainbowToggle.checked
                ) {
                    setNickSetting(
                        'mode',
                        'rainbow'
                    );

                    swatchesWrap.style.opacity =
                        '.35';

                    swatchesWrap.style.pointerEvents =
                        'none';

                } else {
                    setNickSetting(
                        'mode',
                        'none'
                    );

                    swatchesWrap.style.opacity =
                        '1';

                    swatchesWrap.style.pointerEvents =
                        'auto';
                }

                applyNickStyle();
            }
        );

        panel
            .querySelectorAll(
                '.linxgram-swatch'
            )
            .forEach(btn => {

                btn.addEventListener(
                    'click',
                    () => {

                        const c =
                            btn.dataset.color;

                        setNickSetting(
                            'mode',
                            'solid'
                        );

                        setNickSetting(
                            'color',
                            c
                        );

                        rainbowToggle.checked =
                            false;

                        swatchesWrap.style.opacity =
                            '1';

                        swatchesWrap.style.pointerEvents =
                            'auto';

                        panel
                            .querySelectorAll(
                                '.linxgram-swatch'
                            )
                            .forEach(
                                b =>
                                    b.classList.remove(
                                        'linxgram-swatch-active'
                                    )
                            );

                        btn.classList.add(
                            'linxgram-swatch-active'
                        );

                        customColor.value =
                            c;

                        applyNickStyle();
                    }
                );
            });

        customColor.addEventListener(
            'input',
            () => {

                setNickSetting(
                    'mode',
                    'solid'
                );

                setNickSetting(
                    'color',
                    customColor.value
                );

                rainbowToggle.checked =
                    false;

                swatchesWrap.style.opacity =
                    '1';

                swatchesWrap.style.pointerEvents =
                    'auto';

                panel
                    .querySelectorAll(
                        '.linxgram-swatch'
                    )
                    .forEach(
                        b =>
                            b.classList.remove(
                                'linxgram-swatch-active'
                            )
                    );

                applyNickStyle();
            }
        );
    }

    // =========================================================
    // PANEL
    // =========================================================

    function openLinxGram() {
        let panel =
            document.querySelector(
                '[data-linxgram-panel]'
            );

        let overlay =
            document.querySelector(
                '[data-linxgram-overlay]'
            );

        if (panel && overlay) {
            panel.classList.toggle(
                'linxgram-visible'
            );

            overlay.classList.toggle(
                'linxgram-visible'
            );

            return;
        }

        overlay =
            document.createElement('div');

        overlay.setAttribute(
            'data-linxgram-overlay',
            'true'
        );

        document.body.appendChild(
            overlay
        );

        panel =
            document.createElement('div');

        panel.setAttribute(
            'data-linxgram-panel',
            'true'
        );

        panel.innerHTML = `
            <div class="linxgram-header">
                <div class="linxgram-title">
                    LinxGram
                </div>

                <button
                    class="linxgram-close"
                >
                    ×
                </button>
            </div>

            <div class="linxgram-content">
                ${buildNickSection()}
            </div>
        `;

        document.body.appendChild(
            panel
        );

        overlay.onclick = () => {
            panel.classList.remove(
                'linxgram-visible'
            );

            overlay.classList.remove(
                'linxgram-visible'
            );
        };

        panel
            .querySelector(
                '.linxgram-close'
            )
            .onclick = () => {

                panel.classList.remove(
                    'linxgram-visible'
                );

                overlay.classList.remove(
                    'linxgram-visible'
                );
            };

        wireNickSection(panel);

        requestAnimationFrame(() => {
            panel.classList.add(
                'linxgram-visible'
            );

            overlay.classList.add(
                'linxgram-visible'
            );
        });
    }

    // =========================================================
    // STYLES
    // =========================================================

    function addStyles() {
        if (
            document.querySelector(
                '[data-linxgram-styles]'
            )
        ) return;

        const style =
            document.createElement('style');

        style.setAttribute(
            'data-linxgram-styles',
            'true'
        );

        style.textContent = `
            [data-linxgram-menu] {
                cursor:pointer !important;
                color:#2ecc71 !important;
            }

            [data-linxgram-menu]:hover {
                opacity:.9;
            }

            [data-linxgram-menu] svg {
                stroke:#2ecc71 !important;
                color:#2ecc71 !important;
            }

            [data-linxgram-overlay] {
                position:fixed;
                inset:0;
                background:rgba(0,0,0,.4);
                backdrop-filter:blur(8px);
                -webkit-backdrop-filter:blur(8px);
                z-index:999998;
                opacity:0;
                pointer-events:none;
                transition:opacity .18s ease;
            }

            [data-linxgram-overlay].linxgram-visible {
                opacity:1;
                pointer-events:auto;
            }

            [data-linxgram-panel] {
                position:fixed;
                top:50%;
                left:50%;
                transform:
                    translate(-50%,-50%)
                    scale(.96);

                width:640px;
                max-width:90vw;
                height:80vh;
                max-height:720px;

                background:#111114;
                color:#fff;

                border:1px solid #29292e;
                border-radius:20px;

                box-shadow:
                    0 30px 90px
                    rgba(0,0,0,.6);

                z-index:999999;

                overflow:hidden;

                display:flex;
                flex-direction:column;

                opacity:0;
                pointer-events:none;

                transition:
                    opacity .18s ease,
                    transform .18s ease;
            }

            [data-linxgram-panel].linxgram-visible {
                opacity:1;
                transform:
                    translate(-50%,-50%)
                    scale(1);

                pointer-events:auto;
            }

            .linxgram-header {
                height:58px;
                display:flex;
                align-items:center;
                justify-content:space-between;

                padding:0 18px;

                border-bottom:
                    1px solid #252529;

                flex-shrink:0;
            }

            .linxgram-title {
                font-size:18px;
                font-weight:700;
            }

            .linxgram-close {
                width:32px;
                height:32px;

                border:0;
                border-radius:8px;

                background:transparent;
                color:#999;

                font-size:25px;
                line-height:1;

                cursor:pointer;
            }

            .linxgram-close:hover {
                background:#202024;
                color:#fff;
            }

            .linxgram-content {
                padding:16px;
                overflow-y:auto;
                flex:1;
            }

            .linxgram-section {
                background:#18181c;
                border:1px solid #242428;
                border-radius:12px;
                overflow:hidden;
            }

            .linxgram-section-title {
                padding:13px 15px;
                color:#8e8e98;
                font-size:12px;
                font-weight:600;
                text-transform:uppercase;
            }

            .linxgram-setting {
                min-height:52px;

                display:flex;
                align-items:center;
                justify-content:space-between;

                padding:0 15px;

                border-top:
                    1px solid #242428;

                font-size:14px;
            }

            .linxgram-input {
                background:#0f0f12;
                border:1px solid #2a2a2f;
                border-radius:8px;

                padding:8px 10px;

                color:#fff;
                font-size:14px;

                outline:none;
            }

            .linxgram-input:focus {
                border-color:#2ecc71;
            }

            .linxgram-swatch {
                width:28px;
                height:28px;

                border-radius:50%;
                border:2px solid transparent;

                cursor:pointer;
                padding:0;

                transition:
                    transform .1s ease,
                    border-color .1s ease;
            }

            .linxgram-swatch:hover {
                transform:scale(1.08);
            }

            .linxgram-swatch-active {
                border-color:#fff;
            }

            .linxgram-color-input {
                width:28px;
                height:28px;

                border-radius:50%;
                border:2px dashed #555;

                padding:0;
                background:transparent;

                cursor:pointer;
            }

            .linxgram-switch {
                position:relative;

                width:42px;
                height:24px;

                display:block;
            }

            .linxgram-switch input {
                display:none;
            }

            .linxgram-switch span {
                position:absolute;
                inset:0;

                background:#303035;
                border-radius:20px;

                cursor:pointer;
                transition:.15s;
            }

            .linxgram-switch span::after {
                content:"";

                position:absolute;

                width:18px;
                height:18px;

                top:3px;
                left:3px;

                background:#fff;
                border-radius:50%;

                transition:.15s;
            }

            .linxgram-switch
            input:checked + span {
                background:#2ecc71;
            }

            .linxgram-switch
            input:checked + span::after {
                transform:translateX(18px);
            }

            .linxgram-nick-rainbow {
                background:
                    linear-gradient(
                        90deg,
                        #ff5e5e,
                        #ff9d42,
                        #ffd93d,
                        #6bd66b,
                        #4fc3f7,
                        #7c8cff,
                        #c77dff,
                        #ff5e5e
                    );

                background-size:300% 100%;

                -webkit-background-clip:text;
                background-clip:text;

                color:transparent !important;

                animation:
                    linxgram-rainbow-move
                    4s linear infinite;
            }

            @keyframes linxgram-rainbow-move {
                0% {
                    background-position:0% 50%;
                }

                100% {
                    background-position:300% 50%;
                }
            }

            /* =========================================
               LINXGRAM BADGE
               ========================================= */

            .linxgram-badge {
                display:inline-flex;

                width:18px;
                height:18px;

                align-items:center;
                justify-content:center;

                flex-shrink:0;

                vertical-align:middle;
            }

            .linxgram-badge-image {
                width:18px;
                height:18px;

                object-fit:contain;

                display:block;

                pointer-events:none;
                user-select:none;
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // =========================================================
    // INIT
    // =========================================================

    async function init() {
        addStyles();

        createMenuItem();

        applyNickStyle();

        // Регистрируем текущего пользователя
        await registerUser();

        // Получаем пользователей с бейджами
        await loadBadges();

        // Ещё раз применяем после загрузки
        applyNickStyle();
        applyBadges();
    }

    init();

    // UnixGram динамически обновляет DOM
    const observer =
        new MutationObserver(() => {

            createMenuItem();

            applyNickStyle();

            applyBadges();
        });

    observer.observe(
        document.body,
        {
            childList:true,
            subtree:true
        }
    );

})();
