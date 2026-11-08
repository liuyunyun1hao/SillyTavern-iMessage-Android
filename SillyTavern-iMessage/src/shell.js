// The window chrome around ST: sidebar toolbar, conversation header, the app menu, ST's drawers
// as sheets, and the empty state when no chat is open.

import { openContactCard } from './card.js';
import { openContacts, openMyCard } from './contacts.js';
import { openBackgrounds } from './backgrounds.js';
import { openWorldInfo } from './worldinfo.js';
import { openExtensions } from './addons.js';
import { openConnections, openFormatting, openResponseSettings, openSettings } from './settings.js';
import { buildMonogram, monogramize } from './monograms.js';
import { events, onStart, whenOn } from './power.js';
import { button, glyph, setPicture, t } from './dom.js';

const HEADER_ID = 'imsg-head';
const MENU_ID = 'imsg-menu';
/** The header picture's size in CSS pixels (shell.css, and mobile.css on a phone) */
const HEAD_AVATAR = 40;
const HEAD_AVATAR_PHONE = 50;

/** The app's menus, named the way a Mac app would list them, in its own order */
const PANELS = [
    { id: 'ai-config-button', content: 'left-nav-panel', label: 'Response Settings 响应设置' },
    { id: 'sys-settings-button', content: 'rm_api_block', label: 'Connections 连接' },
    { id: 'advanced-formatting-button', content: 'AdvancedFormatting', label: 'Formatting 格式化' },
    { id: 'WI-SP-button', content: 'WorldInfo', label: 'World Info 世界书' },
    { id: 'user-settings-button', content: 'user-settings-block', label: 'Settings 设置' },
    { id: 'backgrounds-button', content: 'Backgrounds', label: 'Backgrounds 背景' },
    { id: 'extensions-settings-button', content: 'rm_extensions_block', label: 'Extensions 扩展' },
    { id: 'persona-management-button', content: 'PersonaManagement', label: 'Personas 角色' },
    { id: 'rightNavHolder', content: 'right-nav-panel', label: 'Contacts 联系人' },
];

/** Menus the theme draws itself */
const NATIVE = {
    rightNavHolder: () => openContacts(),
    'persona-management-button': () => openMyCard(),
    'backgrounds-button': () => openBackgrounds(),
    'WI-SP-button': () => openWorldInfo(),
    'extensions-settings-button': () => openExtensions(),
    'user-settings-button': () => openSettings(),
    'sys-settings-button': () => openConnections(),
    'advanced-formatting-button': () => openFormatting(),
    'ai-config-button': () => openResponseSettings(),
};

let shellOptions = { setAppearance: (_appearance) => {}, isDark: () => false };

/** An icon button drawn with one of the theme's SF-style symbols (--imsg-sym-<name>). */
export function symbolButton(className, label, symbol) {
    const node = button(`imsg-sym-button ${className}`.trim());
    node.title = t(label);
    node.setAttribute('aria-label', t(label));
    node.append(glyph(symbol));
    return node;
}

/** Clicks one of the app's drawer toggles, the way its own top bar does. */
export function toggleDrawer(drawerId) {
    document.querySelector(`#${drawerId} > .drawer-toggle`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** Opens a drawer unless it's already open. */
export function openDrawer(drawerId) {
    if (!document.querySelector(`#${drawerId} > .drawer-content`)?.classList.contains('openDrawer')) {
        toggleDrawer(drawerId);
    }
}

/** Closes every open drawer. */
export function closeDrawers() {
    for (const content of document.querySelectorAll('#top-settings-holder .drawer-content.openDrawer')) {
        if (content.classList.contains('pinnedOpen')) {
            /** @type {HTMLInputElement} */ (content.querySelector('input[id$="_panel_pin"]'))?.click();
        }
        const drawer = content.closest('.drawer');
        if (drawer?.id) {
            toggleDrawer(drawer.id);
        }
    }
}

/** Clicks an entry of the app's chat options menu (the ☰ by the message box). */
export function clickOption(id) {
    const options = [...document.querySelectorAll(`#options #${id}`)];
    (options.find(x => !x.classList.contains('displayNone')) ?? options[0])?.click();
}

/** Whether an element of one of the app's menus is showing (its menu itself may be closed). */
function isShown(element, root) {
    for (let node = element; node && node !== root; node = node.parentElement) {
        if (node.hidden || node.classList.contains('displayNone') || getComputedStyle(node).display === 'none') {
            return false;
        }
    }
    return true;
}

/** Menu items for a list of the app's menu entries, with separators where it has rules. */
function itemsFrom(root, entries) {
    const items = [];
    for (const entry of entries) {
        if (entry.tagName === 'HR') {
            if (items.length && items.at(-1).label) {
                items.push({});
            }
            continue;
        }
        if (!isShown(entry, root)) {
            continue;
        }
        const label = entry.textContent.replace(/\s+/g, ' ').trim();
        if (label) {
            items.push({ label, raw: true, run: () => entry.click() });
        }
    }
    while (items.length && !items.at(-1).label) {
        items.pop();
    }
    return items;
}

/** The chat options (the app's ☰ menu by the message box), as a plain menu. */
function chatOptionItems() {
    const root = document.getElementById('options');
    return root ? itemsFrom(root, root.querySelectorAll('.options-content > a, .options-content > hr')) : [];
}

/** What extensions add to the message box's menu, as a plain menu. */
function appItems() {
    const root = document.getElementById('extensionsMenu');
    return root ? itemsFrom(root, root.querySelectorAll('.list-group-item')) : [];
}

/** Hides or shows the conversation list. */
export function toggleSidebar(hide = !document.body.classList.contains('imsg-side-hidden')) {
    document.body.classList.toggle('imsg-side-hidden', hide && !document.body.classList.contains('imsg-no-chat'));
}

/** New Message: pick someone from Contacts. */
export function newMessage() {
    openContacts({ pick: true });
}

function closeMenu() {
    const menu = document.getElementById(MENU_ID);
    if (menu) {
        menu.hidden = true;
    }
    menuAnchor?.classList.remove('imsg-pressed');
    // menuAnchor = null; // 保留最后的锚点，用于重新打开菜单
}

let menuAnchor = null;
let menuListening = false;

/** 从面板返回到菜单时，重新弹出下拉菜单 */
export function reopenMenu() {
    if (menuAnchor && document.body.contains(menuAnchor)) {
        toggleMenu(menuAnchor, appMenuItems());
    }
}

function getMenu() {
    let menu = document.getElementById(MENU_ID);
    if (menu) {
        return menu;
    }
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    document.body.append(menu);
    if (menuListening) {
        return menu;
    }
    menuListening = true;
    document.addEventListener('pointerdown', (event) => {
        const menu = document.getElementById(MENU_ID);
        if (!menu) {
            return;
        }
        const target = /** @type {Node} */ (event.target);
        if (!menu.hidden && !menu.contains(target) && !menuAnchor?.contains(target)) {
            closeMenu();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById(MENU_ID)?.hidden === false) {
            closeMenu();
        }
    });
    window.addEventListener('resize', closeMenu);
    return menu;
}

export function toggleMenu(anchor, items, point) {
    const menu = getMenu();
    if (!menu.hidden && menuAnchor === anchor && !point) {
        closeMenu();
        return;
    }
    closeMenu();
    menu.replaceChildren(...items.map(({ label, run, checked, danger, raw }) => {
        if (!label) {
            const line = document.createElement('div');
            line.className = 'imsg-menu-sep';
            line.setAttribute('role', 'separator');
            return line;
        }
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'imsg-menu-item';
        item.classList.toggle('imsg-menu-checked', !!checked);
        item.classList.toggle('imsg-menu-danger', !!danger);
        item.setAttribute('role', checked === undefined ? 'menuitem' : 'menuitemcheckbox');
        if (checked !== undefined) {
            item.setAttribute('aria-checked', String(!!checked));
        }
        item.textContent = raw ? label : t(label);
        item.addEventListener('click', () => {
            closeMenu();
            run?.();
        });
        return item;
    }));
    menu.hidden = false;
    menuAnchor = anchor;
    anchor.classList.add('imsg-pressed');
    const box = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = point ? point.x : box.left;
    let top = point ? point.y : box.bottom + 4;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    if (top + height > window.innerHeight - 8) {
        top = Math.max(8, (point ? point.y : box.top - 4) - height);
    }
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    /** @type {HTMLElement} */ (menu.querySelector('.imsg-menu-item'))?.focus({ preventScroll: true });
}

function appMenuItems() {
    const dark = shellOptions.isDark();
    return [
    { label: 'New Message 新信息', run: newMessage },
    {},
    ...PANELS.filter(({ id }) => document.getElementById(id)).map(({ id, label }) => ({ label, run: NATIVE[id] ?? (() => openDrawer(id)) })),
    {},
    { label: 'Light Mode 浅色模式', checked: !dark, run: () => shellOptions.setAppearance('light') },
    { label: 'Dark Mode 深色模式', checked: dark, run: () => shellOptions.setAppearance('dark') },
    { label: 'Match System 跟随系统', run: () => shellOptions.setAppearance('system') },
    { label: 'Customize… 自定义…', run: () => shellOptions.customize?.() },
];
}

export function buildSidebarToolbar() {
    const bar = document.createElement('div');
    bar.className = 'imsg-side-bar';

    const lights = document.createElement('div');
    lights.className = 'imsg-lights';
    const light = (className, label, run) => {
        const node = button(`imsg-light ${className}`, undefined, run);
        node.title = t(label);
        node.setAttribute('aria-label', t(label));
        return node;
    };
    lights.append(
        light('imsg-light-close', 'Close conversation 关闭对话', () => {
            clickOption('option_close_chat');
            document.body.classList.remove('imsg-m-chat');
        }),
        light('imsg-light-min', 'Hide sidebar 隐藏侧边栏', () => toggleSidebar(true)),
        light('imsg-light-full', 'Enter full screen 全屏', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen?.();
            } else {
                document.documentElement.requestFullscreen?.().catch(() => {});
            }
        }),
    );

    const edit = button('imsg-text-button imsg-edit', 'Edit 编辑', () => toggleMenu(edit, appMenuItems()));
    const menu = symbolButton('imsg-app-menu', 'More 更多', 'ellipsis-circle');
    menu.addEventListener('click', () => toggleMenu(menu, appMenuItems()));
    const compose = symbolButton('imsg-compose', 'New Message 新信息', 'compose');
    compose.addEventListener('click', newMessage);

    const spacer = document.createElement('div');
    spacer.className = 'imsg-spacer';
    bar.append(lights, edit, spacer, menu, compose);
    return bar;
}

function openProfile() {
    openContactCard();
}

function createHeader() {
    const sheld = document.getElementById('sheld');
    if (!sheld || document.getElementById(HEADER_ID)) {
        return;
    }
    const head = document.createElement('div');
    head.id = HEADER_ID;

    const back = symbolButton('imsg-back', 'Messages 信息', 'chevron-left');
    back.addEventListener('click', () => {
        closeDrawers();
        document.body.classList.remove('imsg-m-chat');
    });

    const who = document.createElement('button');
    who.type = 'button';
    who.className = 'imsg-head-who';
    who.title = t('Details 详情');
    const to = document.createElement('span');
    to.className = 'imsg-head-to';
    to.textContent = `${t('To 收件人')}:`;
    const avatar = document.createElement('span');
    avatar.className = 'imsg-avatar';
    const name = document.createElement('span');
    name.className = 'imsg-head-name';
    who.append(avatar, to, name);
    who.addEventListener('click', openProfile);

    const actions = document.createElement('div');
    actions.className = 'imsg-head-actions';
    const video = symbolButton('imsg-head-video', 'New conversation 新对话', 'video');
    video.addEventListener('click', () => clickOption('option_start_new_chat'));
    const info = symbolButton('imsg-head-info', 'Details 详情', 'info');
    info.addEventListener('click', () => openInfoMenu(info));
    actions.append(video, info);

    const showSide = symbolButton('imsg-show-side', 'Show sidebar 显示侧边栏', 'sidebar');
    showSide.addEventListener('click', () => toggleSidebar(false));

    head.append(back, showSide, who, actions);
    sheld.prepend(head);
}

function openInfoMenu(anchor) {
    const options = chatOptionItems();
    const apps = appItems();
    const submenu = (items) => () => setTimeout(() => toggleMenu(anchor, items), 0);
    toggleMenu(anchor, [
        { label: 'Details 详情', run: openProfile },
        { label: 'Conversation History 对话历史', run: () => clickOption('option_select_chat') },
        { label: 'New Conversation 新对话', run: () => clickOption('option_start_new_chat') },
        {},
        ...(options.length ? [{ label: 'Chat Options… 聊天选项…', run: submenu(options) }] : []),
        ...(apps.length ? [{ label: 'Apps… 应用…', run: submenu(apps) }] : []),
        {},
        {
            label: 'Close Conversation 关闭对话', run: () => {
                clickOption('option_close_chat');
                document.body.classList.remove('imsg-m-chat');
            },
        },
    ]);
}

export function buildGroupAvatar(group, size = 40, phoneSize = size) {
    const context = SillyTavern.getContext();
    const cluster = document.createElement('span');
    cluster.className = 'imsg-cluster';
    const members = (group?.members ?? []).slice(0, 3)
        .map(avatarId => context.characters.find(x => x.avatar === avatarId))
        .filter(Boolean);
    cluster.dataset.count = String(Math.max(1, members.length));
    if (!members.length) {
        cluster.append(buildMonogram(group?.name ?? ''));
        return cluster;
    }
    for (const character of members) {
        const face = document.createElement('span');
        face.className = 'imsg-face';
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        const share = members.length > 1 ? 0.66 : 1;
        setPicture(img, 'avatar', character.avatar, Math.ceil(size * share), Math.ceil(phoneSize * share));
        face.append(img);
        cluster.append(face);
        monogramize(img, character.name);
    }
    return cluster;
}

export function refreshHeader() {
    const head = document.getElementById(HEADER_ID);
    if (!head) {
        return;
    }
    const context = SillyTavern.getContext();
    const avatar = head.querySelector('.imsg-avatar');
    const name = head.querySelector('.imsg-head-name');
    avatar.replaceChildren();
    delete avatar.dataset.imsgMonoFor;
    avatar.classList.remove('imsg-mono');

    const group = context.groupId ? context.groups.find(x => String(x.id) === String(context.groupId)) : null;
    const character = !group && context.characterId !== undefined ? context.characters[context.characterId] : null;
    document.body.classList.toggle('imsg-no-chat', !(group || character));
    if (!(group || character)) {
        toggleSidebar(false);
    }
    document.body.classList.toggle('imsg-group', !!group);

    if (group) {
        avatar.append(buildGroupAvatar(group, HEAD_AVATAR, HEAD_AVATAR_PHONE));
        name.textContent = group.name;
    } else if (character) {
        const img = document.createElement('img');
        img.alt = '';
        setPicture(img, 'avatar', character.avatar, HEAD_AVATAR, HEAD_AVATAR_PHONE);
        avatar.append(img);
        name.textContent = character.name;
        monogramize(img, character.name);
    } else {
        name.textContent = '';
    }
}

function createEmptyState() {
    const sheld = document.getElementById('sheld');
    if (!sheld || document.getElementById('imsg-empty')) {
        return;
    }
    const empty = document.createElement('div');
    empty.id = 'imsg-empty';
    const text = document.createElement('p');
    text.textContent = t('No Conversation Selected 未选择对话');
    empty.append(text);
    sheld.append(empty);
}

function createPanelHeads() {
    for (const { id, label } of PANELS) {
        const content = document.querySelector(`#${id} > .drawer-content`);
        if (!content || content.querySelector(':scope > .imsg-panel-head')) {
            continue;
        }
        const head = document.createElement('div');
        head.className = 'imsg-panel-head';
        const title = document.createElement('span');
        title.className = 'imsg-panel-title';
        title.textContent = t(label);
        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'imsg-text-button imsg-done';
        done.textContent = t('Done 完成');
        done.addEventListener('click', () => {
            if (content.classList.contains('openDrawer')) {
                toggleDrawer(id);
            }
        });
        head.append(title, done);
        content.prepend(head);
    }
}

export function refreshPanelTitles(enabled) {
    document.body.classList.toggle('imsg-panels', enabled);
}

function trackDrawers() {
    const drawers = [...document.querySelectorAll('#top-settings-holder > .drawer')];
    const update = () => {
        let any = false;
        for (const drawer of drawers) {
            const open = !!drawer.querySelector(':scope > .drawer-content.openDrawer');
            drawer.classList.toggle('imsg-open', open);
            any ||= open;
        }
        document.body.classList.toggle('imsg-menu-open', any);
    };
    const observer = new MutationObserver(whenOn(update));
    for (const drawer of drawers) {
        const content = drawer.querySelector(':scope > .drawer-content');
        if (content) {
            observer.observe(content, { attributes: true, attributeFilter: ['class'] });
        }
    }
    return update;
}

function markAlerts(root = document) {
    for (const dialog of root.querySelectorAll?.('dialog.popup:not([data-imsg-checked])') ?? []) {
        dialog.dataset.imsgChecked = '';
        const big = dialog.matches('.wide_dialogue_popup, .wider_dialogue_popup, .large_dialogue_popup, .transparent_dialogue_popup')
            || !!dialog.querySelector('#loader, .popup-content :is(textarea, table, img, select, ul, ol, .flex-container, .list-group, .inline-drawer)')
            || (dialog.querySelector('.popup-content')?.textContent.length ?? 0) > 400;
        dialog.classList.toggle('imsg-alert', !big);
    }
}

function clusterGroupRows() {
    const { groups } = SillyTavern.getContext();
    document.querySelectorAll('#rm_print_characters_block .group_select[data-grid] .avatar.avatar_collage').forEach((avatar) => {
        const group = groups.find(x => String(x.id) === avatar.closest('.group_select').dataset.grid);
        const key = (group?.members ?? []).slice(0, 3).join('\n');
        if (!group || avatar.dataset.imsgCluster === key) {
            return;
        }
        avatar.querySelector(':scope > .imsg-cluster')?.remove();
        avatar.append(buildGroupAvatar(group, 50));
        avatar.dataset.imsgCluster = key;
    });
}

export function initShell(options) {
    const { eventTypes } = SillyTavern.getContext();
    const eventSource = events();
    eventSource.on(eventTypes.CHARACTER_PAGE_LOADED, () => setTimeout(whenOn(clusterGroupRows), 0));
    eventSource.on(eventTypes.GROUP_UPDATED, () => setTimeout(whenOn(clusterGroupRows), 0));
    new MutationObserver(whenOn(() => markAlerts())).observe(document.body, { childList: true });
    shellOptions = options;
    const updateDrawers = trackDrawers();
    onStart(() => {
        clusterGroupRows();
        markAlerts();
        createHeader();
        createEmptyState();
        createPanelHeads();
        updateDrawers();
        refreshHeader();
    });
}