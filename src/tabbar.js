// 底部标签栏：聊天 / 联系人 / 我的。
// 开就是聊天（会话列表），联系人页就是角色卡，我的页放用户设置、扩展、API、背景这些入口。
// 三页都只建一次，来回切只是显示/隐藏，点起来才跟手。

import * as personas from '../../../../personas.js';
import { button, element, glyph, setPicture, t } from './dom.js';
import { openContacts, openMyCard } from './contacts.js';
import { monogramize } from './monograms.js';
import { openCustomize } from './customize.js';
import { clickOption, openAppearanceMenu, openPanelById } from './shell.js';
import { onStart, onStop } from './power.js';

const BAR_ID = 'imsg-tabbar';
const ME_ID = 'imsg-me';
const CN_ID = 'imsg-contacts';
const HIDDEN = 'imsg-hidden';
const RETURN_KEY = 'imsg-return-tab';

const TABS = [
    { key: 'chat', label: 'Chat 聊天', symbol: 'bubble' },
    { key: 'contacts', label: 'Contacts 联系人', symbol: 'person' },
    { key: 'me', label: 'Me 我的', symbol: 'gear' },
];

function setActive(key) {
    document.body.dataset.imsgTab = key;
    for (const tab of document.querySelectorAll(`#${BAR_ID} .imsg-tab`)) {
        tab.classList.toggle('imsg-tab-on', tab.dataset.tab === key);
    }
}

/** Switches page and highlights its tab. Everything that changes pages goes through here. */
function activateTab(key) {
    if (key === 'chat') {
        hideMe();
        hideContacts();
        document.body.classList.remove('imsg-m-chat');
    } else if (key === 'contacts') {
        hideMe();
        showContacts();
    } else {
        hideContacts();
        showMe();
    }
    setActive(key);
}

/** After a reload the page always boots on Chat; come back to where the user was. */
function rememberTab() {
    sessionStorage.setItem(RETURN_KEY, 'me');
}

function restoreTab() {
    const key = sessionStorage.getItem(RETURN_KEY);
    if (!key) {
        return;
    }
    sessionStorage.removeItem(RETURN_KEY);
    activateTab(key);
}

/* ── 联系人页：复用插件的通讯录，点一行直接进对话 ── */

function showContacts() {
    const root = document.getElementById(CN_ID);
    if (root) {
        root.classList.remove(HIDDEN);
        return;
    }
    openContacts({ direct: true });
}

function hideContacts() {
    document.getElementById(CN_ID)?.classList.add(HIDDEN);
}

/* ── 我的 ── */

// 面板开在「我的」上面，关掉之后还留在「我的」，不会被弹回聊天
function openPanel(id) {
    openPanelById(id);
}

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

function group(rows) {
    const box = element('section', 'imsg-me-group');
    box.append(...rows);
    return box;
}

function profile() {
    const ctx = SillyTavern.getContext();
    const box = element('div', 'imsg-me-profile');
    const avatar = element('span', 'imsg-me-avatar');
    const who = element('div', 'imsg-me-who');
    who.append(element('b', '', ctx.name1 || t('Me 我')));
    who.append(element('span', '', t('Persona 当前人设')));
    box.append(avatar, who);

    /** 当前人设的头像和名字，换人设时跟着换 */
    const update = () => {
        const live = SillyTavern.getContext();
        const userAvatar = personas.user_avatar || live.user_avatar;
        avatar.replaceChildren();
        if (userAvatar) {
            const img = element('img');
            img.alt = '';
            setPicture(img, 'persona', userAvatar, 96);
            avatar.append(img);
            monogramize(img, live.name1 || 'Me');
        } else {
            avatar.textContent = (live.name1 || 'Me').trim().charAt(0);
        }
        who.firstElementChild.textContent = live.name1 || t('Me 我');
    };
    update();
    box.dataset.refresh = 'me';
    return box;
}

/** 手机端外观入口（浅色 / 深色 / 跟随系统），桌面端仍用标题栏菜单 */
function appearanceRow() {
    let node;
    node = row({
        icon: 'sparkle', color: '#0a84ff', label: 'Appearance 外观',
        run: () => openAppearanceMenu(node),
    });
    return node;
}

function buildMe() {
    const root = element('div', 'imsg-me');
    root.id = ME_ID;

    const bar = element('header', 'imsg-me-bar');
    bar.append(element('h1', '', t('Me 我的')));
    bar.append(button('imsg-me-edit', t('Edit 编辑'), () => openMyCard({ sheet: true, onClose: showMe })));

    const scroll = element('div', 'imsg-me-scroll');
    scroll.append(profile());

    scroll.append(group([
        appearanceRow(),
        row({ icon: 'paintbrush', color: '#0a84ff', label: 'Backgrounds 背景', run: () => openPanel('backgrounds-button') }),
        row({ icon: 'code', color: '#ff3b30', label: 'Extensions 扩展', run: () => openPanel('extensions-settings-button') }),
        // 用户设置开在弹窗里，「我的」一直留在底层，关掉还回这里
        row({ icon: 'person', color: '#af52de', label: 'User 用户', run: () => openMyCard({ sheet: true, onClose: showMe }) }),
    ]));

    scroll.append(group([
        row({ icon: 'plug', color: '#34c759', label: 'API 连接', run: () => openPanel('sys-settings-button') }),
        row({ icon: 'book', color: '#8e8e93', label: 'World Info 世界书', run: () => openPanel('WI-SP-button') }),
        row({ icon: 'gear', color: '#8e8e93', label: 'Settings 设置', run: () => openPanel('user-settings-button') }),
    ]));

    scroll.append(group([
        row({ icon: 'sliders', color: '#5856d6', label: 'Beautify 美化', run: () => openCustomize() }),
        row({ icon: 'sliders', color: '#5856d6', label: 'Response Settings 响应设置', run: () => openPanel('ai-config-button') }),
        row({ icon: 'textformat', color: '#ff9500', label: 'Formatting 格式化', run: () => openPanel('advanced-formatting-button') }),
    ]));

    scroll.append(group([
        row({
            icon: 'bubble', color: '#0a84ff', label: 'Chat History 聊天记录',
            run: () => {
                // 没选角色时 SillyTavern 只会弹「Assistant not found」，这里先说清楚要做什么
                if (SillyTavern.getContext().characterId == null) {
                    toastr.info(t('Pick a character first, then its chats are listed here.'), t('No character chosen'));
                    return;
                }
                hideMe();
                clickOption('option_select_chat');
            },
        }),
    ]));

    const version = element('p', 'imsg-me-ver', 'iMessage Theme');
    scroll.append(version);
    // 版本号跟着 manifest.json 走，升级后不会在界面上留下旧号
    fetch(new URL('../manifest.json', import.meta.url))
        .then((response) => (response.ok ? response.json() : null))
        .then((manifest) => {
            if (manifest?.version) {
                version.textContent = `iMessage Theme · v${manifest.version}`;
            }
        })
        .catch(() => {});
    root.append(bar, scroll);
    document.body.append(root);
    return root;
}

function showMe() {
    const root = document.getElementById(ME_ID) ?? buildMe();
    root.classList.remove(HIDDEN);
    // 每次进「我的」都对一遍当前人设
    const profileBox = root.querySelector('.imsg-me-profile');
    if (profileBox) {
        const avatar = profileBox.querySelector('.imsg-me-avatar');
        const name = profileBox.querySelector('.imsg-me-who b');
        const live = SillyTavern.getContext();
        const userAvatar = personas.user_avatar || live.user_avatar;
        avatar.replaceChildren();
        if (userAvatar) {
            const img = element('img');
            img.alt = '';
            setPicture(img, 'persona', userAvatar, 96);
            avatar.append(img);
            monogramize(img, live.name1 || 'Me');
        } else {
            avatar.textContent = (live.name1 || 'Me').trim().charAt(0);
        }
        if (name) name.textContent = live.name1 || t('Me 我');
    }
}

function hideMe() {
    document.getElementById(ME_ID)?.classList.add(HIDDEN);
}

/* ── 底栏 ── */

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
        node.addEventListener('click', () => activateTab(tab.key));
        bar.append(node);
    }
    document.body.append(bar);
    document.body.classList.add('imsg-tabs');
    setActive('chat');
}

function watch() {
    // 通讯录被关掉（Done / 点空白 / 选了人开始聊天 / Esc）时，底栏回到「聊天」
    const back = () => setTimeout(() => {
        if (document.body.dataset.imsgTab === 'contacts' && !document.getElementById(CN_ID)) {
            setActive('chat');
        }
    }, 0);

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.closest?.('.imsg-cn-done') || target.closest?.('.imsg-cn-row')) {
            back();
        } else if (target.classList?.contains('imsg-cn')) {
            setActive('chat');
        }
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (document.getElementById(ME_ID) && !document.getElementById(ME_ID).classList.contains(HIDDEN)) {
            hideMe();
            setActive(document.getElementById(CN_ID) && !document.getElementById(CN_ID).classList.contains(HIDDEN) ? 'contacts' : 'chat');
            return;
        }
        back();
    });
}

export function initTabbar() {
    // 只登记一次：开主题时建，关主题时拆，重新开启还能回来
    watch();
    onStart(() => {
        if (!document.getElementById(BAR_ID)) {
            build();
        }
        restoreTab();
    });
    onStop(removeTabbar);
}

export function removeTabbar() {
    document.getElementById(BAR_ID)?.remove();
    document.getElementById(ME_ID)?.remove();
    document.body.classList.remove('imsg-tabs');
}
