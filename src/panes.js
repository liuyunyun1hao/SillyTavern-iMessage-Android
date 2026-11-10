import { toggleMenu, reopenMenu } from './shell.js';
import { host, releaseAll } from './host.js';
import { onStop } from './power.js';
import { button, element, glyph, isPhone, overlayOpen, t } from './dom.js';
import { acquire as acquireOverlay, release as releaseOverlay } from './overlay.js';

const TILE_COLORS = ['#0a84ff', '#30b0c7', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2', '#5e5ce6', '#8e8e93', '#64d2ff', '#ac8e68'];

let open = null;
let overlayToken = null;

export function tile(section, big = false) {
    const node = element('span', `imsg-ext-tile${big ? ' imsg-ext-tile-big' : ''}`);
    node.style.background = section.color ?? TILE_COLORS[0];
    if (section.symbol) {
        node.append(glyph(section.symbol));
    } else {
        node.textContent = (section.title.match(/[A-Za-z0-9]/)?.[0] ?? '•').toUpperCase();
    }
    return node;
}

function sections() {
    return open.def.sections().filter((x) => x.available !== false);
}

function nodesOf(section) {
    return (section.nodes?.() ?? []).filter(Boolean);
}

function matches(section, needle) {
    if (!needle) return true;
    if (t(section.title).toLowerCase().includes(needle)) return true;
    return nodesOf(section).some((node) => node.textContent.toLowerCase().includes(needle));
}

function renderSide(side) {
    const list = side.querySelector('.imsg-cn-scroll');
    const needle = open.needle.trim().toLowerCase();
    const groups = new Map();
    for (const section of sections().filter((x) => matches(x, needle))) {
        const name = section.group ?? '';
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(section);
    }
    const boxes = [];
    for (const [name, items] of groups) {
        const box = element('div', 'imsg-cn-section');
        if (name) box.append(element('h3', 'imsg-cn-section-title', t(name)));
        for (const section of items) {
            const row = button(`imsg-cn-row imsg-ext-row${open.key === section.key ? ' imsg-cn-current' : ''}`);
            row.append(tile(section), element('span', 'imsg-cn-row-name', t(section.title)));
            const note = section.note?.();
            if (note) row.append(element('span', 'imsg-cn-row-note', note));
            row.addEventListener('click', () => {
                open.key = section.key;
                open.level = 1;
                render();
            });
            box.append(row);
        }
        boxes.push(box);
    }
    if (!boxes.length) boxes.push(element('p', 'imsg-cn-empty', t('No Results 无结果')));
    const scroll = list.scrollTop;
    list.replaceChildren(...boxes);
    list.scrollTop = scroll;
}

function paneBar(title) {
    const bar = element('header', 'imsg-cn-pane-bar');
    const backLabel = isPhone() || open.def.title.length > 12 ? 'Back 返回' : open.def.title;
    const back = button('imsg-cn-back', backLabel, () => {
        open.level = 0;
        render();
    });
    back.prepend(glyph('chevron-left'));
    
    const done = button('imsg-cn-done', 'Done 完成', close);
    bar.append(back, element('h2', 'imsg-cn-pane-title', title), done);
    return bar;
}

function renderSection(pane, section) {
    releaseAll();
    const body = element('div', 'imsg-cn-form imsg-ext-body imsg-set-body');
    const hostBox = element('div', `imsg-host imsg-ext-host imsg-set-host${section.hideTitle ? ' imsg-set-notitle' : ''}`);
    hostBox.dataset.section = section.key;
    if (section.intro) section.intro(body, () => render());
    body.append(hostBox);
    pane.replaceChildren(paneBar(t(section.title)), body);
    for (const node of nodesOf(section)) {
        host(node, hostBox);
        if (section.show) node.classList.add('imsg-set-show');
    }
    section.opened?.(hostBox);
}

function render() {
    const root = document.getElementById(open?.def.id);
    if (!root) return;
    const all = sections();
    let section = all.find((x) => x.key === open.key);
    if (!section) {
        section = all[0];
        open.key = section?.key;
    }
    if (section) renderSection(root.querySelector('.imsg-cn-detail'), section);
    renderSide(root.querySelector('.imsg-cn-side'));
    root.classList.toggle('imsg-cn-has-detail', open.level >= 1);
    
    if (isPhone()) {
        const side = root.querySelector('.imsg-cn-side');
        const detail = root.querySelector('.imsg-cn-detail');
        const inDetail = open.level >= 1;
        if (side) side.style.display = inDetail ? 'none' : '';
        if (detail) {
            detail.style.display = inDetail ? '' : 'none';
            detail.style.transform = 'none';
            detail.style.visibility = 'visible';
        }
    }
}

export function redrawPanes() {
    if (open) render();
}

function close() {
    if (overlayToken) {
        releaseOverlay(overlayToken);
        overlayToken = null;
    }
    for (const node of document.querySelectorAll('.imsg-set-show')) node.classList.remove('imsg-set-show');
    releaseAll();
    if (open) {
        document.getElementById(open.def.id)?.remove();
        open.def.closed?.();
    }
    open = null;
    document.removeEventListener('keydown', onKey, true);
}

function onKey(event) {
    if (event.key !== 'Escape' || overlayOpen()) return;
    if (event.target instanceof HTMLElement && event.target.closest('.imsg-set-host') && event.target.matches('input, textarea, select')) {
        event.target.blur();
        event.stopPropagation();
        return;
    }
    event.stopPropagation();
    if (open?.level > 0) {
        open.level = 0;
        render();
    } else {
        close();
        // 如果按 Esc 也要返回到菜单，可以解开下面这行的注释
        // reopenMenu(); 
    }
}

export function openPanes(def, start = null) {
    close();
    const phone = isPhone();
    open = { def, key: start, level: start || !phone ? 1 : 0, needle: '' };

    const root = element('div', `imsg-cn imsg-ext imsg-set ${def.className ?? ''}`);
    root.id = def.id;
    const win = element('div', 'imsg-cn-window');
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'true');
    win.setAttribute('aria-label', t(def.title));
    const side = element('div', 'imsg-cn-side');
    const bar = element('header', 'imsg-cn-bar');
    let more = element('span');
    if (def.menu) {
        more = button('imsg-sym-button imsg-cn-add-menu');
        more.setAttribute('aria-label', t('More 更多'));
        more.append(glyph('ellipsis'));
        more.addEventListener('click', () => toggleMenu(more, def.menu()));
    }
    
    // ★ 关键改动：第一级返回键关闭面板后，调用 reopenMenu() 弹出下拉菜单
    const backBtn = button('imsg-cn-back', 'Back 返回', () => {
        close();
        reopenMenu(); 
    });
    backBtn.prepend(glyph('chevron-left'));
    
    const doneBtn = button('imsg-cn-done', 'Done 完成', close);
    bar.append(backBtn, element('h1', 'imsg-cn-title', t(def.title)), doneBtn);
    
    const searchBox = element('label', 'imsg-search imsg-cn-search');
    searchBox.append(glyph('search'));
    const search = element('input');
    search.type = 'search';
    search.placeholder = t('Search 搜索');
    search.setAttribute('aria-label', search.placeholder);
    search.addEventListener('input', () => {
        open.needle = search.value;
        renderSide(side);
    });
    searchBox.append(search);
    const listWrap = element('div', 'imsg-cn-listwrap');
    listWrap.append(element('div', 'imsg-cn-scroll'));
    side.append(bar, searchBox, listWrap);
    const detail = element('section', 'imsg-cn-detail imsg-ext-detail');
    win.append(side, detail);
    root.append(win);
    root.addEventListener('mousedown', (event) => {
        if (event.target === root) close(); 
    });
    document.body.append(root);
    document.addEventListener('keydown', onKey, true);
    overlayToken = acquireOverlay(def.id || 'panes');
    render();
}

onStop(close);