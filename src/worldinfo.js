// World Info window, laid out like Notes: lorebooks, the open book's entries and the entry
// editor. Reads and writes go through ST's world-info.js so its cache and events stay in step;
// rename and duplicate use ST's hidden editor, which also updates linked characters and chats.

import * as wi from '../../../../world-info.js';
import { events, onStop } from './power.js';
import { toggleMenu, reopenMenu } from './shell.js';
import { button, context, element, escapeHtml, glyph, isPhone, overlayOpen, t } from './dom.js';

const ROOT_ID = 'imsg-worldinfo';
const SETTINGS = '__settings__';

const POSITIONS = [
    [0, 'Before the character 在角色之前'],
    [1, 'After the character 在角色之后'],
    [5, 'Before the examples 在示例之前'],
    [6, 'After the examples 在示例之后'],
    [2, "Before the Author's Note 在作者注释之前"],
    [3, "After the Author's Note 在作者注释之后"],
    [4, 'In the conversation, at a depth 在对话中，指定深度'],
    [7, 'Outlet (only where a macro asks for it) 出口（仅在宏请求时）'],
];
const ROLES = [[0, 'System 系统'], [1, 'User 用户'], [2, 'Assistant 助手']];
const LOGIC = [
    [0, 'and any of these 且任意一个'],
    [3, 'and all of these 且全部'],
    [2, 'and none of these 且都不'],
    [1, 'and not all of these 且非全部'],
];
const STRATEGIES = [[0, 'Sorted evenly 均匀排序'], [1, "Character's books first 角色书优先"], [2, 'Global books first 全局书优先']];
const TRIGGERS = [['normal', 'Normal 普通'], ['continue', 'Continue 继续'], ['impersonate', 'Impersonate 扮演'], ['swipe', 'Swipe 滑动'], ['regenerate', 'Regenerate 重新生成'], ['quiet', 'Quiet 静默']];

const SCAN_SETTINGS = [
    { id: 'world_info_depth', label: '扫描深度', hint: '最近多少条消息参与关键词扫描。', min: 0, max: 100 },
    { id: 'world_info_budget', label: '上下文占比', hint: '世界书最多占用的上下文比例。', min: 1, max: 100, unit: '%' },
    { id: 'world_info_budget_cap', label: '令牌上限', hint: '0 表示不限制。', min: 0, max: 65536, step: 64 },
    { id: 'world_info_min_activations', label: '最少条目', hint: '0 表示关闭。', min: 0, max: 100 },
    { id: 'world_info_min_activations_depth_max', label: '最远扫描', hint: '0 表示不限制。', min: 0, max: 100 },
    { id: 'world_info_max_recursion_steps', label: '递归步数', hint: '0 表示不限制。', min: 0, max: 10 },
];
const SCAN_FLAGS = [
    { id: 'world_info_include_names', label: 'Include names when scanning 扫描时包含名称' },
    { id: 'world_info_recursive', label: 'Entries can trigger other entries 条目可触发其他条目' },
    { id: 'world_info_case_sensitive', label: 'Case-sensitive keywords 区分大小写' },
    { id: 'world_info_match_whole_words', label: 'Match whole words only 仅匹配完整单词' },
    { id: 'world_info_use_group_scoring', label: 'Score groups 按组评分' },
    { id: 'world_info_overflow_alert', label: 'Warn when budget runs out 预算用尽警告' },
];

let view = { book: null, uid: null, level: 0, needle: '' };
let bookData = null;
let saveTimer = 0;

function select(options, value) {
    const node = element('select');
    for (const [key, label] of options) {
        const option = element('option', '', t(label));
        option.value = String(key);
        node.append(option);
    }
    node.value = String(value);
    return node;
}

function field(label, control, hint) {
    const box = element('label', 'imsg-cn-field');
    box.append(element('span', 'imsg-cn-field-label', t(label)), control);
    if (hint) box.append(element('small', 'imsg-cn-hint', t(hint)));
    return box;
}

function input(type, value) {
    const node = element('input');
    node.type = type;
    node.value = value ?? '';
    return node;
}

function check(label, checked) {
    const box = element('label', 'imsg-cn-check');
    const box1 = element('input');
    box1.type = 'checkbox';
    box1.checked = !!checked;
    box.append(box1, element('span', '', t(label)));
    return { box, input: box1 };
}

function toggle(checked, label) {
    const node = element('input', 'imsg-wi-switch');
    node.type = 'checkbox';
    node.checked = !!checked;
    node.setAttribute('role', 'switch');
    node.setAttribute('aria-label', label);
    return node;
}

function names() {
    return [...(wi.world_names ?? [])].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function isGlobal(name) {
    return (wi.selected_world_info ?? []).includes(name);
}

function chatBook() {
    return context().chatMetadata?.[wi.METADATA_KEY] ?? null;
}

function characterBook() {
    const ctx = context();
    return ctx.characters[ctx.characterId]?.data?.extensions?.world ?? null;
}

function setGlobal(name, on) {
    const $ = window.$;
    const index = wi.world_names.indexOf(name);
    const option = $(`#world_info option[value="${index}"]`);
    if (!option.length) return;
    option.prop('selected', on);
    $('#world_info').trigger('change');
}

async function setChatBook(name) {
    const ctx = context();
    if (!ctx.getCurrentChatId?.()) {
        toastr.info(t('Open a conversation first.'));
        return;
    }
    if (name) ctx.chatMetadata[wi.METADATA_KEY] = name;
    else delete ctx.chatMetadata[wi.METADATA_KEY];
    await ctx.saveMetadata();
    render();
}

async function setCharacterBook(name) {
    const ctx = context();
    if (ctx.characterId === undefined || ctx.groupId) {
        toastr.info(t('Open a conversation with one character first.'));
        return;
    }
    await wi.charUpdatePrimaryWorld(name ?? '');
    render();
}

function appEditor(name, buttonId) {
    const $ = window.$;
    const index = wi.world_names.indexOf(name);
    $('#world_editor_select').val(index).trigger('change');
    setTimeout(() => document.getElementById(buttonId)?.click(), 150);
}

async function newBook() {
    const ctx = context();
    const name = await ctx.callGenericPopup(t('Name the new lorebook:'), ctx.POPUP_TYPE.INPUT, wi.getFreeWorldName?.() ?? '', { okButton: t('Create'), cancelButton: t('Cancel') });
    if (!name || typeof name !== 'string') return;
    if (await wi.createNewWorldInfo(name.trim(), { interactive: true }) !== false) {
        await openBook(name.trim());
    }
}

async function deleteBook(name) {
    const ctx = context();
    const ok = await ctx.callGenericPopup(`<h3>${t('Delete')} "${escapeHtml(name)}"?</h3><p>${t("Every entry in it goes too. This can't be undone.")}</p>`, ctx.POPUP_TYPE.CONFIRM, '', { okButton: t('Delete'), cancelButton: t('Cancel') });
    if (ok !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
    await wi.deleteWorldInfo(name);
    if (view.book === name) {
        view = { ...view, book: null, uid: null, level: 0 };
        bookData = null;
    }
    render();
}

async function exportBook(name) {
    const data = await wi.loadWorldInfo(name);
    if (!data) return;
    const link = element('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' }));
    link.download = `${name}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

function bookMenu(name, anchor, point) {
    const chat = chatBook() === name;
    const character = characterBook() === name;
    toggleMenu(anchor, [
        { label: 'On for Every Chat 对所有对话启用', checked: isGlobal(name), run: () => { setGlobal(name, !isGlobal(name)); render(); } },
        { label: 'On for This Chat 对此对话启用', checked: chat, run: () => setChatBook(chat ? null : name) },
        { label: "Character's Lorebook 角色的世界书", checked: character, run: () => setCharacterBook(character ? null : name) },
        {},
        { label: 'Rename… 重命名…', run: () => appEditor(name, 'world_popup_name_button') },
        { label: 'Duplicate… 复制…', run: () => appEditor(name, 'world_duplicate') },
        { label: 'Export 导出', run: () => exportBook(name) },
        {},
        { label: 'Delete Lorebook… 删除世界书…', danger: true, run: () => deleteBook(name) },
    ], point);
}

async function openBook(name) {
    view = { ...view, book: name, uid: null, level: 1, needle: '' };
    bookData = await wi.loadWorldInfo(name);
    render();
}

function entries() {
    return Object.values(bookData?.entries ?? {}).sort((a, b) => (a.displayIndex ?? a.uid) - (b.displayIndex ?? b.uid));
}

function entryTitle(entry) {
    return entry.comment?.trim() || entry.key?.join(', ') || t('Untitled');
}

function saveSoon() {
    clearTimeout(saveTimer);
    const name = view.book;
    const data = bookData;
    saveTimer = setTimeout(async () => {
        await wi.saveWorldInfo(name, structuredClone(data), true);
        wi.reloadEditor?.(name);
    }, 400);
}

function addEntry() {
    const entry = wi.createWorldInfoEntry(view.book, bookData);
    if (!entry) return;
    entry.comment = '';
    saveSoon();
    view = { ...view, uid: entry.uid, level: 2 };
    render();
    document.querySelector(`#${ROOT_ID} .imsg-wi-title-input`)?.focus();
}

async function removeEntry(uid) {
    const ctx = context();
    const ok = await ctx.callGenericPopup(`<h3>${t('Delete this entry?')}</h3>`, ctx.POPUP_TYPE.CONFIRM, '', { okButton: t('Delete'), cancelButton: t('Cancel') });
    if (ok !== ctx.POPUP_RESULT.AFFIRMATIVE) return;
    delete bookData.entries[uid];
    wi.deleteWIOriginalDataValue?.(bookData, uid);
    saveSoon();
    view = { ...view, uid: null, level: 1 };
    render();
}

function duplicateEntry(uid) {
    const copy = wi.duplicateWorldInfoEntry?.(bookData, uid);
    if (copy) {
        saveSoon();
        view = { ...view, uid: copy.uid, level: 2 };
        render();
    }
}

function renderBooks(side) {
    const list = side.querySelector('.imsg-cn-scroll');
    const parts = [];
    const settingsRow = button(`imsg-cn-row imsg-bg-source${view.book === SETTINGS ? ' imsg-cn-current' : ''}`);
    const icon = element('span', 'imsg-bg-source-icon');
    icon.append(glyph('gear'));
    settingsRow.append(icon, element('span', 'imsg-cn-row-name', t('Scan Settings 扫描设置')));
    settingsRow.addEventListener('click', () => {
        view = { ...view, book: SETTINGS, uid: null, level: 2 };
        render();
    });
    const top = element('div', 'imsg-cn-section');
    top.append(settingsRow);
    parts.push(top);

    const box = element('div', 'imsg-cn-section');
    box.append(element('h3', 'imsg-cn-section-title', t('Lorebooks 世界书')));
    const chat = chatBook();
    const character = characterBook();
    for (const name of names()) {
        const row = button(`imsg-cn-row imsg-bg-source imsg-wi-book${view.book === name ? ' imsg-cn-current' : ''}`);
        const bookIcon = element('span', 'imsg-bg-source-icon');
        bookIcon.append(glyph('book'));
        const text = element('span', 'imsg-cn-row-name');
        text.append(element('span', '', name));
        const where = [isGlobal(name) ? t('Every chat 所有对话') : '', chat === name ? t('This chat 此对话') : '', character === name ? t('Character 角色') : ''].filter(Boolean);
        if (where.length) text.append(element('small', 'imsg-wi-where', where.join(' · ')));
        row.append(bookIcon, text);
        if (isGlobal(name) || chat === name || character === name) row.append(element('span', 'imsg-wi-on'));
        row.addEventListener('click', () => openBook(name));
        row.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            bookMenu(name, row, { x: event.clientX, y: event.clientY });
        });
        box.append(row);
    }
    if (!names().length) box.append(element('p', 'imsg-cn-none', t('No Lorebooks 暂无世界书')));
    parts.push(box);
    const scroll = list.scrollTop;
    list.replaceChildren(...parts);
    list.scrollTop = scroll;
}

function renderEntries(column) {
    if (!view.book || view.book === SETTINGS || !bookData) {
        column.replaceChildren(element('div', 'imsg-cn-empty', t('No Lorebook Selected 未选择世界书')));
        return;
    }
    const bar = element('header', 'imsg-cn-pane-bar');
    const back = button('imsg-cn-back', 'Lorebooks 世界书', () => {
        view = { ...view, level: 0 };
        render();
    });
    back.prepend(glyph('chevron-left'));
    
    const done = button('imsg-cn-done', 'Done 完成', close);
    bar.append(back, element('h2', 'imsg-cn-pane-title', view.book), done);

    const globalRow = element('label', 'imsg-wi-global');
    const globalSwitch = toggle(isGlobal(view.book), t('On for every chat 对所有对话启用'));
    globalSwitch.addEventListener('change', () => {
        setGlobal(view.book, globalSwitch.checked);
        render();
    });
    globalRow.append(element('span', '', t('On for every chat 对所有对话启用')), globalSwitch);

    const searchBox = element('label', 'imsg-search imsg-cn-search');
    searchBox.append(glyph('search'));
    const search = element('input');
    search.type = 'search';
    search.placeholder = t('Search Entries 搜索条目');
    search.value = view.needle;
    search.addEventListener('input', () => {
        view.needle = search.value;
        drawList();
    });
    searchBox.append(search);

    const list = element('div', 'imsg-wi-entries');
    const drawList = () => {
        const needle = view.needle.trim().toLowerCase();
        const shown = entries().filter((entry) => !needle || [entry.comment, entry.content, ...(entry.key ?? [])].join('\n').toLowerCase().includes(needle));
        list.replaceChildren(...shown.map(buildEntryRow));
        if (!shown.length) list.append(element('p', 'imsg-cn-none', needle ? t('No Results 无结果') : t('No Entries 暂无条目')));
    };
    drawList();

    const add = button('imsg-wi-new', 'New Entry 新建条目', addEntry);
    add.prepend(glyph('compose'));
    const scroll = column.querySelector('.imsg-wi-entries')?.scrollTop ?? 0;
    column.replaceChildren(bar, globalRow, searchBox, list, add);
    list.scrollTop = scroll;
}

function buildEntryRow(entry) {
    const row = button(`imsg-wi-entry${entry.uid === view.uid ? ' imsg-cn-current' : ''}${entry.disable ? ' imsg-wi-off' : ''}`);
    const head = element('span', 'imsg-wi-entry-head');
    head.append(element('b', '', entryTitle(entry)));
    if (entry.constant) head.append(element('span', 'imsg-wi-pill', t('Always 始终')));
    row.append(head);
    const keys = (entry.key ?? []).join(', ');
    const preview = String(entry.content ?? '').replace(/\s+/g, ' ').trim();
    row.append(element('span', 'imsg-wi-entry-sub', [keys, preview].filter(Boolean).join(' — ') || t('No content 无内容')));
    row.addEventListener('click', () => {
        view = { ...view, uid: entry.uid, level: 2 };
        render();
    });
    row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        toggleMenu(row, [
            { label: entry.disable ? 'Turn On 启用' : 'Turn Off 禁用', run: () => { entry.disable = !entry.disable; saveSoon(); render(); } },
            { label: 'Duplicate 复制', run: () => duplicateEntry(entry.uid) },
            {},
            { label: 'Delete… 删除…', danger: true, run: () => removeEntry(entry.uid) },
        ], { x: event.clientX, y: event.clientY });
    });
    return row;
}

function numberOrNull(value) {
    return value === '' || value === null ? null : Number(value);
}

function renderEntry(column, entry) {
    const bar = element('header', 'imsg-cn-pane-bar');
    const back = button('imsg-cn-back', view.book, () => {
        view = { ...view, uid: null, level: 1 };
        render();
    });
    back.prepend(glyph('chevron-left'));
    
    const done = button('imsg-cn-done', 'Done 完成', close);
    bar.append(back, element('h2', 'imsg-cn-pane-title', t('Entry 条目')), done);

    const body = element('div', 'imsg-wi-body');

    const titleInput = input('text', entry.comment ?? '');
    titleInput.className = 'imsg-wi-title-input';
    titleInput.placeholder = t('Title (optional) 标题（可选）');
    titleInput.addEventListener('input', () => {
        entry.comment = titleInput.value;
        saveSoon();
    });
    body.append(titleInput);

    const modeBox = element('fieldset', 'imsg-cn-group imsg-wi-mode');
    const modeItems = [
        ['当关键词出现时', () => !entry.constant && !entry.vectorized],
        ['始终', () => !!entry.constant],
        ['相关时（向量搜索）', () => !!entry.vectorized],
    ];
    for (const [label, test] of modeItems) {
        const item = element('label', 'imsg-cn-radio');
        const radio = element('input');
        radio.type = 'radio';
        radio.name = `imsg-wi-mode-${entry.uid}`;
        radio.checked = test();
        radio.addEventListener('change', () => {
            entry.constant = label === '始终';
            entry.vectorized = label === '相关时（向量搜索）';
            saveSoon();
            render();
        });
        item.append(radio, element('span', '', t(label)));
        modeBox.append(item);
    }
    body.append(modeBox);

    if (!entry.constant && !entry.vectorized) {
        const keyInput = element('textarea');
        keyInput.className = 'imsg-wi-keys';
        keyInput.rows = 2;
        keyInput.placeholder = t('Keywords 关键词');
        keyInput.value = (entry.key ?? []).join(', ');
        keyInput.addEventListener('input', () => {
            entry.key = keyInput.value.split(',').map((s) => s.trim()).filter(Boolean);
            saveSoon();
        });
        body.append(field('Keywords 关键词', keyInput, '用逗号分隔，/…/ 表示正则表达式'));

        const secInput = element('textarea');
        secInput.className = 'imsg-wi-keys';
        secInput.rows = 2;
        secInput.placeholder = t('Secondary keywords 次要关键词');
        secInput.value = (entry.keysecondary ?? []).join(', ');
        secInput.addEventListener('input', () => {
            entry.keysecondary = secInput.value.split(',').map((s) => s.trim()).filter(Boolean);
            saveSoon();
        });
        const logicSelect = select(LOGIC, entry.selectiveLogic ?? 0);
        logicSelect.addEventListener('change', () => {
            entry.selectiveLogic = Number(logicSelect.value);
            saveSoon();
        });
        const secField = field('Secondary keywords 次要关键词', secInput, '');
        secField.append(logicSelect);
        body.append(secField);
    }

    const contentInput = element('textarea');
    contentInput.className = 'imsg-wi-content';
    contentInput.rows = 8;
    contentInput.placeholder = t('Content 内容');
    contentInput.value = entry.content ?? '';
    contentInput.addEventListener('input', () => {
        entry.content = contentInput.value;
        saveSoon();
    });
    body.append(field('Content 内容', contentInput));

    const enabledRow = element('label', 'imsg-wi-enabled');
    const enabledSwitch = toggle(!entry.disable, t('Entry is on 条目已启用'));
    enabledSwitch.addEventListener('change', () => {
        entry.disable = !enabledSwitch.checked;
        saveSoon();
        render();
    });
    enabledRow.append(element('span', '', t('Entry is on 条目已启用')), enabledSwitch);
    body.append(enabledRow);

    const advanced = element('details', 'imsg-wi-advanced');
    advanced.append(element('summary', '', t('Advanced 高级')));

    const posSelect = select(POSITIONS, entry.position ?? 0);
    posSelect.addEventListener('change', () => {
        entry.position = Number(posSelect.value);
        saveSoon();
        renderAdvanced();
    });
    advanced.append(field('Position 位置', posSelect));

    const depthInput = input('number', entry.depth ?? 4);
    depthInput.min = '0'; depthInput.max = '999';
    depthInput.addEventListener('input', () => { entry.depth = Number(depthInput.value); saveSoon(); });
    const depthRow = field('Depth 深度', depthInput, '从末尾算起的消息数');
    advanced.append(depthRow);

    const roleSelect = select(ROLES, entry.role ?? 0);
    roleSelect.addEventListener('change', () => { entry.role = Number(roleSelect.value); saveSoon(); });
    const roleRow = field('Role 角色', roleSelect);
    advanced.append(roleRow);

    const renderAdvanced = () => {
        depthRow.hidden = entry.position !== 4;
        roleRow.hidden = entry.position !== 4;
    };
    renderAdvanced();

    const orderInput = input('number', entry.order ?? 100);
    orderInput.addEventListener('input', () => { entry.order = Number(orderInput.value); saveSoon(); });
    advanced.append(field('Order 顺序', orderInput, '数值越高越接近对话'));

    const priorityInput = input('number', entry.priority ?? 10);
    priorityInput.addEventListener('input', () => { entry.priority = Number(priorityInput.value); saveSoon(); });
    advanced.append(field('Priority 优先级', priorityInput, '预算紧张时优先保留'));

    const probInput = input('number', entry.probability ?? 100);
    probInput.min = '0'; probInput.max = '100';
    probInput.addEventListener('input', () => { entry.probability = Number(probInput.value); saveSoon(); });
    advanced.append(field('Probability 概率', probInput, '被包含的百分比概率'));

    const groupInput = input('text', entry.group ?? '');
    groupInput.addEventListener('input', () => { entry.group = groupInput.value; saveSoon(); });
    advanced.append(field('Group 组', groupInput, '同一组中只使用一个条目'));

    const weightInput = input('number', entry.groupWeight ?? 100);
    weightInput.addEventListener('input', () => { entry.groupWeight = Number(weightInput.value); saveSoon(); });
    advanced.append(field('Group weight 组权重', weightInput, '在组内被选中的概率'));

    const stickyInput = input('number', entry.sticky ?? '');
    stickyInput.placeholder = t('None 无');
    stickyInput.addEventListener('input', () => { entry.sticky = numberOrNull(stickyInput.value); saveSoon(); });
    advanced.append(field('Sticky 粘滞', stickyInput, '触发后保持的消息数'));

    const cooldownInput = input('number', entry.cooldown ?? '');
    cooldownInput.placeholder = t('None 无');
    cooldownInput.addEventListener('input', () => { entry.cooldown = numberOrNull(cooldownInput.value); saveSoon(); });
    advanced.append(field('Cooldown 冷却', cooldownInput, '再次触发前需要的消息数'));

    const delayInput = input('number', entry.delay ?? '');
    delayInput.placeholder = t('None 无');
    delayInput.addEventListener('input', () => { entry.delay = numberOrNull(delayInput.value); saveSoon(); });
    advanced.append(field('Delay 延迟', delayInput, '首次触发前需要的消息数'));

    body.append(advanced);
    column.replaceChildren(bar, body);
}

function renderSettings(column) {
    const bar = element('header', 'imsg-cn-pane-bar');
    const back = button('imsg-cn-back', 'Lorebooks 世界书', () => {
        view = { ...view, book: null, level: 0 };
        render();
    });
    back.prepend(glyph('chevron-left'));
    const done = button('imsg-cn-done', 'Done 完成', close);
    bar.append(back, element('h2', 'imsg-cn-pane-title', t('Scan Settings 扫描设置')), done);

    const body = element('div', 'imsg-wi-body imsg-wi-settings');

    for (const item of SCAN_SETTINGS) {
        const control = document.getElementById(item.id);
        if (!control) continue;
        const current = Number(control.value) || 0;
        const slider = element('input');
        slider.type = 'range';
        slider.min = String(item.min ?? 0); slider.max = String(item.max ?? 100);
        slider.step = String(item.step ?? 1); slider.value = String(current);
        const valueLabel = element('span', 'imsg-wi-value', ` ${current}${item.unit ?? ''}`);
        slider.addEventListener('input', () => {
            control.value = slider.value;
            control.dispatchEvent(new Event('input', { bubbles: true }));
            valueLabel.textContent = ` ${slider.value}${item.unit ?? ''}`;
        });
        const row = field(item.label, slider, item.hint);
        row.querySelector('.imsg-cn-field-label').append(valueLabel);
        body.append(row);
    }

    const flagBox = element('fieldset', 'imsg-cn-group');
    for (const item of SCAN_FLAGS) {
        const control = document.getElementById(item.id);
        if (!control) continue;
        const row = element('label', 'imsg-wi-flag');
        const sw = toggle(control.checked, t(item.label));
        sw.addEventListener('change', () => {
            control.checked = sw.checked;
            control.dispatchEvent(new Event('change', { bubbles: true }));
        });
        row.append(element('span', '', t(item.label)), sw);
        flagBox.append(row);
    }
    body.append(flagBox);

    const strategySelect = select(STRATEGIES, document.getElementById('world_info_character_strategy')?.value ?? 0);
    strategySelect.addEventListener('change', () => {
        const control = document.getElementById('world_info_character_strategy');
        if (control) {
            control.value = strategySelect.value;
            control.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
    body.append(field('Sorting strategy 排序策略', strategySelect));

    const triggersBox = element('fieldset', 'imsg-cn-group');
    triggersBox.append(element('legend', '', t('Apply to these actions 应用于这些操作')));
    for (const [key, label] of TRIGGERS) {
        const control = document.getElementById(`world_info_trigger_${key}`);
        if (!control) continue;
        const { box, input: inp } = check(label, control.checked);
        inp.addEventListener('change', () => {
            control.checked = inp.checked;
            control.dispatchEvent(new Event('change', { bubbles: true }));
        });
        triggersBox.append(box);
    }
    body.append(triggersBox);
    column.replaceChildren(bar, body);
}

function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const side = root.querySelector('.imsg-cn-side');
    const mid = root.querySelector('.imsg-wi-mid');
    const detail = root.querySelector('.imsg-cn-detail');
    renderBooks(side);
    if (view.book === SETTINGS) {
        mid.replaceChildren();
        renderSettings(detail);
    } else if (view.uid !== null && bookData?.entries?.[view.uid]) {
        renderEntries(mid);
        renderEntry(detail, bookData.entries[view.uid]);
    } else {
        renderEntries(mid);
        detail.replaceChildren(element('div', 'imsg-cn-empty', t('Select an entry 选择一个条目')));
    }
    // 桌面三栏始终并列；手机按 level 逐级滑动（侧栏 → 条目 → 条目编辑）。
    root.classList.toggle('imsg-wi-settings', view.book === SETTINGS);
    root.classList.toggle('imsg-wi-level-1', view.level >= 1);
    root.classList.toggle('imsg-wi-level-2', view.level >= 2);
}

function close() {
    clearTimeout(saveTimer);
    document.getElementById(ROOT_ID)?.remove();
    document.removeEventListener('keydown', onKey, true);
    bookData = null;
}

function onKey(event) {
    if (event.key !== 'Escape' || overlayOpen()) return;
    event.stopPropagation();
    if (view.level >= 2) {
        view = { ...view, uid: null, level: 1 };
        render();
    } else if (view.level >= 1) {
        view = { ...view, level: 0 };
        render();
    } else {
        close();
    }
}

export async function openWorldInfo(name = null) {
    close();
    view = { book: name, uid: null, level: name ? 1 : 0, needle: '' };
    bookData = name ? await wi.loadWorldInfo(name) : null;

    const root = element('div', 'imsg-cn imsg-wi');
    root.id = ROOT_ID;
    const win = element('div', 'imsg-cn-window');
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'true');
    win.setAttribute('aria-label', t('World Info 世界书'));

    const side = element('div', 'imsg-cn-side');
    const bar = element('header', 'imsg-cn-bar');
    
    // ★ 第一级顶栏：返回键先关掉面板，再重开菜单
    const backBtn = button('imsg-cn-back', 'Back 返回', () => {
        close();
        reopenMenu();
    }); 
    backBtn.prepend(glyph('chevron-left'));
    const doneBtn = button('imsg-cn-done', 'Done 完成', close);
    bar.append(backBtn, element('h1', 'imsg-cn-title', t('World Info 世界书')), doneBtn);
    
    const listWrap = element('div', 'imsg-cn-listwrap');
    listWrap.append(element('div', 'imsg-cn-scroll'));
    side.append(bar, listWrap);
    const mid = element('section', 'imsg-wi-mid imsg-wi-list');
    const detail = element('section', 'imsg-cn-detail imsg-wi-detail');
    win.append(side, mid, detail);
    root.append(win);
    root.addEventListener('mousedown', (event) => {
        if (event.target === root) close();
    });
    document.body.append(root);
    document.addEventListener('keydown', onKey, true);
    render();
}

export function initWorldInfo() {
    const { eventTypes } = context();
    const eventSource = events();
    eventSource.on(eventTypes.WORLDINFO_UPDATED, () => {
        if (document.getElementById(ROOT_ID) && view.book && view.book !== SETTINGS) {
            wi.loadWorldInfo(view.book).then((data) => {
                bookData = data;
                render();
            });
        }
    });
}

onStop(close);