// 底部标签栏：聊天 / 联系人 / 我的。
// 打开就是聊天（会话列表），联系人页就是角色卡，我的页放用户设置、扩展、API、背景这些入口。

import { button, element, glyph, t } from './dom.js';
import { openContacts, openMyCard } from './contacts.js';
import { openCustomize } from './customize.js';
import { clickOption } from './shell.js';

const BAR_ID = 'imsg-tabbar';
const ME_ID = 'imsg-me';

const TABS = [
    { key: 'chat', label: 'Chat 聊天', symbol: 'bubble' },
    { key: 'contacts', label: 'Contacts 联系人', symbol: 'person' },
    { key: 'me', label: 'Me 我的', symbol: 'gear' },
];

/** 关掉通讯录浮层（它自己的 Done 会收尾状态） */
function closeContacts() {
    document.querySelector('#imsg-cn .imsg-cn-done')?.click();
}

function closeMe() {
    document.getElementById(ME_ID)?.remove();
}

function setActive(key) {
    document.body.dataset.imsgTab = key;
    for (const tab of document.querySelectorAll(`#${BAR_ID} .imsg-tab`)) {
        tab.classList.toggle('imsg-tab-on', tab.dataset.tab === key);
    }
}

/** 点酒馆顶栏按钮，先关掉「我的」，免得面板被盖住 */
function openPanel(id) {
    closeMe();
    document.getElementById(id)?.click();
}

/** 「我的」页的一行 */
function row({ icon, color, label, value, run }) {
    const node = button('imsg-me-row');
    const tile = element('span', 'imsg-me-ico');
    tile.style.setProperty('--tile', color);
    tile.append(glyph(icon));
    node.append(tile, element('span', 'imsg-me-label', t(label)));
    if (value) node.append(element('span', 'imsg-me-value', value));
    const chevron = element('i', 'imsg-sym imsg-me-chevron');
    chevron.style.setProperty('--imsg-glyph', 'var(--imsg-sym-chevron-right)');
    node.append(chevron);
    node.addEventListener('click', run);
    return node;
}

function group(title, rows) {
    const box = element('section', 'imsg-me-group');
    if (title) box.append(element('h2', 'imsg-me-title', t(title)));
    box.append(...rows);
    return box;
}

function profile() {
    const ctx = SillyTavern.getContext();
    const box = element('div', 'imsg-me-profile');
    const avatar = element('span', 'imsg-me-avatar');
    const userAvatar = ctx.user_avatar || ctx.personas?.user_avatar;
    if (userAvatar) {
        const img = element('img');
        img.src = `/User Avatars/${encodeURIComponent(userAvatar)}`;
        img.alt = '';
        avatar.append(img);
    } else {
        avatar.textContent = (ctx.name1 || 'Me').trim().charAt(0);
    }
    const who = element('div', 'imsg-me-who');
    who.append(element('b', '', ctx.name1 || t('Me 我')));
    who.append(element('span', '', t('Persona 当前人设')));
    box.append(avatar, who);
    return box;
}

function openMe() {
    closeMe();
    const root = element('div', 'imsg-me');
    root.id = ME_ID;

    const bar = element('header', 'imsg-me-bar');
    bar.append(element('h1', '', t('Me 我的')));
    const edit = button('imsg-me-edit', t('Edit 编辑'), () => {
        closeMe();
        openMyCard();
    });
    bar.append(edit);

    const scroll = element('div', 'imsg-me-scroll');
    scroll.append(profile());

    scroll.append(group('', [
        row({
            icon: 'paintbrush', color: '#0a84ff', label: 'Appearance 外观与背景',
            run: () => openPanel('backgrounds-button'),
        }),
        row({
            icon: 'sliders', color: '#5856d6', label: 'Theme 主题自定义',
            run: () => { closeMe(); openCustomize(); },
        }),
        row({
            icon: 'person', color: '#af52de', label: 'Persona 人设',
            run: () => openPanel('persona-management-button'),
        }),
    ]));

    scroll.append(group('', [
        row({
            icon: 'code', color: '#ff3b30', label: 'Extensions 扩展',
            run: () => openPanel('extensions-settings-button'),
        }),
        row({
            icon: 'bolt', color: '#34c759', label: 'API 与模型',
            run: () => openPanel('sys-settings-button'),
        }),
        row({
            icon: 'book', color: '#8e8e93', label: 'World Info 世界书',
            run: () => openPanel('WI-SP-button'),
        }),
    ]));

    scroll.append(group('', [
        row({
            icon: 'bubble', color: '#0a84ff', label: 'Chat History 聊天记录',
            run: () => { closeMe(); clickOption('option_select_chat'); },
        }),
        row({
            icon: 'gear', color: '#8e8e93', label: 'Settings 用户设置',
            run: () => openPanel('user-settings-button'),
        }),
    ]));

    scroll.append(element('p', 'imsg-me-ver', 'iMessage Theme · v1.0.1'));
    root.append(bar, scroll);
    document.body.append(root);
}

function build() {
    document.getElementById(BAR_ID)?.remove();
    const bar = element('nav', 'imsg-tabbar');
    bar.id = BAR_ID;
    bar.setAttribute('role', 'tablist');
    for (const tab of TABS) {
        const node = button('imsg-tab');
        node.dataset.tab = tab.key;
        node.setAttribute('role', 'tab');
        node.append(glyph(tab.symbol), element('span', '', t(tab.label)));
        node.addEventListener('click', () => {
            if (tab.key === 'chat') {
                closeMe();
                closeContacts();
                document.body.classList.remove('imsg-m-chat');
                setActive('chat');
            } else if (tab.key === 'contacts') {
                closeMe();
                if (!document.getElementById('imsg-cn')) openContacts();
                setActive('contacts');
            } else {
                closeContacts();
                openMe();
                setActive('me');
            }
        });
        bar.append(node);
    }
    document.body.append(bar);
    document.body.classList.add('imsg-tabs');
    setActive('chat');
}

function watch() {
    // 通讯录被关掉（Done / 点空白 / Esc）时，底栏回到「聊天」
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.closest?.('.imsg-cn-done') || target.classList?.contains('imsg-cn')) {
            setActive('chat');
        }
    }, true);
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (document.getElementById(ME_ID)) {
            closeMe();
            return;
        }
        setTimeout(() => {
            if (document.body.dataset.imsgTab === 'contacts' && !document.getElementById('imsg-cn')) {
                setActive('chat');
            }
        }, 0);
    });
}

export function initTabbar() {
    build();
    watch();
}

export function removeTabbar() {
    document.getElementById(BAR_ID)?.remove();
    closeMe();
    document.body.classList.remove('imsg-tabs');
}
