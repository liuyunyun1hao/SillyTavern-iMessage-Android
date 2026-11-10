// Contacts window: a searchable list (favorites, groups, A to Z with a letter index) beside the
// selected contact's card and an edit form, for characters, groups and personas. New Message uses
// the same list as a picker. Saving goes through ST's own API, functions and slash commands.

import * as personas from '../../../../personas.js';
import { default_user_avatar, setUserName } from '../../../../../script.js';
import { events, onStop } from './power.js';
import { acquire as acquireOverlay, release as releaseOverlay } from './overlay.js';
import { enter as enterEntry, exit as exitEntry } from './history.js';
import { monogramize, buildMonogram } from './monograms.js';
import { buildGroupAvatar, clickOption, toggleMenu } from './shell.js';
import { button, context, element, escapeHtml, glyph, isPhone, overlayOpen, setPicture, t } from './dom.js';
import { recentTimes } from './list.js';

const ROOT_ID = 'imsg-contacts';
const ABOUT_LIMIT = 160;
const DEFAULT_GROUP_AVATAR = 'img/ai4.png';

/** The fields of the Edit form, in order, each with where it lives on the character */
const FIELDS = [
    { key: 'creator_notes', label: 'About', hint: 'A line about them, shown on their card.', rows: 2 },
    { key: 'description', label: 'Description', hint: 'Who they are. Always sent with the conversation.', rows: 8 },
    { key: 'personality', label: 'Personality', rows: 3 },
    { key: 'scenario', label: 'Scenario', rows: 3 },
    { key: 'first_mes', label: 'First Message', hint: 'How they start a new conversation.', rows: 5 },
    { key: 'mes_example', label: 'Example Messages', hint: 'Start each example with <START>.', rows: 6 },
];
const ADVANCED = [
    { key: 'system_prompt', label: 'System Prompt', hint: 'Used in place of the main prompt, if the connection allows it.', rows: 4 },
    { key: 'post_history_instructions', label: 'After the Conversation', hint: 'Sent after the messages (post-history instructions).', rows: 3 },
    { key: 'depth_prompt', label: 'Character’s Note', hint: 'Slipped into the conversation a few messages from the end.', rows: 3 },
    { key: 'creator', label: 'Creator', rows: 1 },
    { key: 'character_version', label: 'Version', rows: 1 },
];
const STRATEGIES = [
    [0, 'Natural (whoever is mentioned or most talkative)'],
    [1, 'In order (list)'],
    [3, 'Pooled (everyone gets a turn)'],
    [2, 'Manual (only when you ask)'],
];
const GENERATION_MODES = [
    [0, 'Each member answers with their own card'],
    [1, 'All cards combined'],
    [2, 'All cards combined, muted ones too'],
];

/** Every contacts window (the page, the modal, the picker, a sheet), each with its own root and view. */
const windows = new Map();
/** The window being used right now: its view/root are what the sync code paths read. */
let active = null;
let view = { key: null, mode: 'card', pick: false, sheet: false, page: false, needle: '', tag: null, sort: 'name', onClose: null };
let activeRoot = null;
/** The sort the user picked last; shared on purpose, it's a preference, not per-window state. */
let lastSort = 'name';
/** One render's cache of the contact list. */
let itemsCache = null;

/*
 * The window is a real modal: the page underneath keeps its state (chat scroll, Me scroll) instead
 * of being hidden and rebuilt, the page itself can't scroll while the window is up, and the tab bar
 * is moved inside the window so there is only ever one of them on screen.
 */
const OPEN_CLASS = 'imsg-cn-open';
let scrollLocked = false;
let pageScrollY = 0;

function lockPage() {
    if (scrollLocked) {
        return;
    }
    scrollLocked = true;
    pageScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add(OPEN_CLASS);
    document.body.classList.add(OPEN_CLASS);
}

function unlockPage() {
    if (!scrollLocked) {
        return;
    }
    scrollLocked = false;
    document.documentElement.classList.remove(OPEN_CLASS);
    document.body.classList.remove(OPEN_CLASS);
    // put the page back exactly where it was; overflow:hidden on its own drops the position
    if (pageScrollY) {
        window.scrollTo(0, pageScrollY);
    }
}

/** Plain text, without markup or macros, cut to a length. */
function plain(text, limit) {
    const { name1 } = context();
    const value = String(text ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\{\{user\}\}/gi, name1 ?? 'You')
        .replace(/\s+/g, ' ')
        .trim();
    return limit && value.length > limit ? `${value.slice(0, limit).replace(/\s+\S*$/, '')}…` : value;
}

function keyOf(item) {
    return item.group ? `g:${item.group.id}` : `c:${item.character.avatar}`;
}

function nameOf(item) {
    return item.group ? item.group.name : item.character.name;
}

function find(key) {
    const { characters, groups } = context();
    if (!key) {
        return null;
    }
    if (key.startsWith('p:')) {
        const avatar = key.slice(2);
        return avatar in (context().powerUserSettings.personas ?? {}) ? { persona: avatar } : null;
    }
    if (key.startsWith('g:')) {
        const group = groups.find((x) => String(x.id) === key.slice(2));
        return group ? { group } : null;
    }
    const character = characters.find((x) => x.avatar === key.slice(2));
    return character ? { character } : null;
}

function field(character, key) {
    if (key === 'depth_prompt') {
        return character.data?.extensions?.depth_prompt?.prompt ?? '';
    }
    return character.data?.[key] ?? character[key] ?? '';
}

function tagsOf(key) {
    const { tags, tagMap } = context();
    return (tagMap?.[key] ?? []).map((id) => tags.find((tag) => tag.id === id)).filter(Boolean);
}

function picture(item, size) {
    if (item.persona) {
        return personaPicture(item.persona, size);
    }
    const holder = element('span', 'imsg-avatar imsg-cn-pic');
    holder.style.setProperty('--imsg-cn-pic', `${size}px`);
    if (item.group) {
        holder.append(buildGroupAvatar(item.group, size));
    } else {
        const img = element('img');
        img.alt = '';
        img.loading = 'lazy';
        setPicture(img, 'avatar', item.character.avatar, size);
        holder.append(img);
        monogramize(img, item.character.name);
    }
    return holder;
}

/** Everyone, sorted by name, with what a search looks at. Cached until the next render. */
function allItems() {
    if (itemsCache) {
        return itemsCache;
    }
    const { characters, groups } = context();
    const items = [
        ...groups.map((group) => ({ group })),
        ...characters.map((character) => ({ character })),
    ];
    for (const item of items) {
        const key = item.group ? item.group.id : item.character.avatar;
        const members = item.group ? (item.group.members ?? []).map((avatar) => characters.find((x) => x.avatar === avatar)?.name).filter(Boolean) : [];
        item.key = keyOf(item);
        item.name = nameOf(item);
        item.tags = tagsOf(key);
        item.fav = item.group ? !!item.group.fav : (item.character.fav === true || item.character.fav === 'true' || item.character.data?.extensions?.fav === true);
        item.search = [item.name, ...members, ...item.tags.map((tag) => tag.name), item.character ? field(item.character, 'creator_notes') : ''].join('\n').toLowerCase();
    }
    if (view.sort === 'recent') {
        const times = recentTimes();
        const when = (item) => times.get(item.group ? `g_${item.group.id}` : `c_${item.character.avatar}`) ?? -1;
        itemsCache = items.sort((a, b) => when(b) - when(a) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        return itemsCache;
    }
    itemsCache = items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return itemsCache;
}

function letterOf(name) {
    const first = name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(first) ? first : '#';
}

// ── Doing things ──

/** Tells the tab bar the app just moved into a conversation (it highlights Chat). */
function wentToChat() {
    document.body.dataset.imsgTab = 'chat';
    window.dispatchEvent(new CustomEvent('imsg:tab', { detail: { key: 'chat' } }));
}

async function openConversation(item) {
    const ctx = context();
    const instance = active;
    if (instance?.page) {
        hideContactsPage();
        wentToChat();
    } else {
        close('pick');
    }
    if (item.group) {
        if (String(ctx.groupId) === String(item.group.id)) {
            return;
        }
        // the app opens a group from a click on its card; a stand-in reaches the same handlers
        const card = element('div', 'group_select imsg-hidden-card');
        card.setAttribute('data-grid', item.group.id);
        document.body.append(card);
        card.click();
        card.remove();
        wentToChat();
        return;
    }
    const id = ctx.characters.findIndex((x) => x.avatar === item.character.avatar);
    if (id !== -1 && String(ctx.characterId) !== String(id)) {
        await ctx.selectCharacterById(id, { switchMenu: false });
    }
    wentToChat();
}

async function afterOpening(item, run) {
    const ctx = context();
    const instance = active;
    const current = item.group ? String(ctx.groupId) === String(item.group.id) : ctx.characters[ctx.characterId]?.avatar === item.character.avatar;
    if (!current) {
        const changed = new Promise((resolve) => {
            ctx.eventSource.once(ctx.eventTypes.CHAT_CHANGED, resolve);
            setTimeout(resolve, 5000);
        });
        await openConversation(item);
        await changed;
    } else if (instance?.page) {
        hideContactsPage();
        wentToChat();
    } else {
        close();
    }
    setTimeout(run, 100);
}

function slashValue(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function mergeCharacter(avatar, update) {
    const ctx = context();
    const response = await fetch('/api/characters/merge-attributes', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ avatar, ...update }),
    });
    if (!response.ok) {
        const reason = await response.json().catch(() => ({}));
        throw new Error(reason.message || `${response.status}`);
    }
}

async function uploadPicture(avatar, file) {
    const ctx = context();
    const form = new FormData();
    form.append('avatar', file, file.name || 'avatar.png');
    form.append('avatar_url', avatar);
    const response = await fetch('/api/characters/edit-avatar', {
        method: 'POST',
        headers: ctx.getRequestHeaders({ omitContentType: true }),
        body: form,
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const thumbnail = ctx.getThumbnailUrl('avatar', avatar);
    await fetch(thumbnail, { cache: 'reload' }).catch(() => {});
    await fetch(`/characters/${encodeURIComponent(avatar)}`, { cache: 'reload' }).catch(() => {});
    document.querySelectorAll(`img[src^="${CSS.escape(thumbnail)}"], img[src^="${thumbnail}"]`).forEach((img) => {
        const { src, srcset } = img;
        img.srcset = '';
        img.src = '';
        img.src = src;
        img.srcset = srcset;
    });
}

/** After a change: the app reloads its lists, then this one redraws. */
async function reloadAll(instance = active) {
    try {
        await context().getCharacters();
    } catch (error) {
        console.warn('[iMessage] 刷新角色列表失败，可能是套壳网络拦截，正在重试...', error);
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            await context().getCharacters();
        } catch (retryError) {
            console.error('[iMessage] 重试依然失败，强制刷新页面', retryError);
            location.reload();
            return;
        }
    }
    renderInstance(instance);
}

async function toggleFavorite(item) {
    const instance = active;
    const fav = !item.fav;
    try {
        if (item.group) {
            await saveGroup({ ...item.group, fav });
        } else {
            await mergeCharacter(item.character.avatar, { fav, data: { extensions: { fav } } });
            await context().getOneCharacter(item.character.avatar);
        }
        await reloadAll(instance);
    } catch (error) {
        toastr.error(String(error.message ?? error), t('Couldn’t change Favorites'));
    }
}

async function exportCharacter(item, format) {
    const ctx = context();
    const response = await fetch('/api/characters/export', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({ format, avatar_url: item.character.avatar }),
    });
    if (!response.ok) {
        toastr.error(t('The card couldn’t be exported.'));
        return;
    }
    const link = element('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = item.character.avatar.replace(/\.png$/i, `.${format}`);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

async function duplicate(item) {
    const instance = active;
    const result = await context().executeSlashCommandsWithOptions(`/char-duplicate char=${slashValue(item.character.avatar)}`, { handleParserErrors: true, handleExecutionErrors: true });
    await reloadAll(instance);
    const avatar = String(result?.pipe ?? '');
    if (avatar && instance?.root?.isConnected) {
        activate(instance);
        select(`c:${avatar}`);
    }
}

async function deleteContact(item) {
    const ctx = context();
    const instance = active;
    if (item.group) {
        // the app's own delete tidies away a group's open conversation too
        await afterOpening(item, () => document.getElementById('rm_group_delete')?.click());
        return;
    }
    const ALL = 3;
    const answer = await ctx.callGenericPopup(
        `<h3>${t('Delete')} ${ctx.substituteParams ? '' : ''}${escapeHtml(item.character.name)}?</h3><p>${t('Their conversations stay unless you delete them too. This can’t be undone.')}</p>`,
        ctx.POPUP_TYPE.CONFIRM, '',
        { okButton: t('Delete'), cancelButton: t('Cancel'), customButtons: [{ text: t('Delete with Conversations'), result: ALL, classes: ['imsg-danger'] }] },
    );
    if (answer !== ctx.POPUP_RESULT.AFFIRMATIVE && answer !== ALL) {
        return;
    }
    await ctx.executeSlashCommandsWithOptions(`/char-delete char=${slashValue(item.character.avatar)} silent=true deleteChats=${answer === ALL}`, { handleParserErrors: true, handleExecutionErrors: true });
    if (instance?.root?.isConnected) {
        instance.view.key = null;
        instance.view.mode = 'card';
    }
    await reloadAll(instance);
}

async function saveGroup(group) {
    const response = await fetch('/api/groups/edit', {
        method: 'POST',
        headers: context().getRequestHeaders(),
        body: JSON.stringify(group),
    });
    if (!response.ok) {
        throw new Error(`${response.status}`);
    }
}

async function importFromUrl() {
    const ctx = context();
    const instance = active;
    const url = await ctx.callGenericPopup(t('Paste a link to a character card, or a Chub, JanitorAI, Pygmalion or RisuRealm page.'), ctx.POPUP_TYPE.INPUT, '', { okButton: t('Import'), cancelButton: t('Cancel') });
    if (!url || typeof url !== 'string') {
        return;
    }
    try {
        await ctx.importFromExternalUrl(url.trim());
        await reloadAll(instance);
    } catch (error) {
        toastr.error(String(error.message ?? error), t('Couldn’t import'));
    }
}

function importFromFile() {
    // the app's own file picker does the import
    document.getElementById('character_import_file')?.click();
}

// ── The list ──

function buildRow(item) {
    const row = button(`imsg-cn-row${item.key === view.key ? ' imsg-cn-current' : ''}`);
    row.dataset.key = item.key;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(item.key === view.key));
    const name = element('span', 'imsg-cn-row-name');
    // the last word bold, as Contacts sorts a name
    const words = item.name.split(' ');
    if (words.length > 1 && !item.group) {
        name.append(`${words.slice(0, -1).join(' ')} `, element('b', '', words.at(-1)));
    } else {
        name.append(element('b', '', item.name));
    }
    row.append(picture(item, 30), name);
    if (item.group) {
        row.append(element('span', 'imsg-cn-row-note', `${item.group.members?.length ?? 0}`));
    }
    row.addEventListener('click', () => {
        // iOS Contacts: a tap opens the person's card, and the card's Message action starts
        // the chat. A picker ("New Message") goes straight to the conversation.
        if (view.pick) {
            openConversation(item);
            return;
        }
        select(item.key);
    });
    row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        select(item.key);
    });
    return row;
}

function section(title, items, id) {
    const box = element('div', 'imsg-cn-section');
    if (id) {
        box.dataset.letter = id;
    }
    box.append(element('h3', 'imsg-cn-section-title', title), ...items.map(buildRow));
    return box;
}

function myCard() {
    const ctx = context();
    const avatar = personas.user_avatar;
    const row = button(`imsg-cn-row imsg-cn-me${view.key?.startsWith('p:') ? ' imsg-cn-current' : ''}`);
    const holder = element('span', 'imsg-avatar imsg-cn-pic');
    holder.style.setProperty('--imsg-cn-pic', '44px');
    if (avatar) {
        const img = element('img');
        img.alt = '';
        setPicture(img, 'persona', avatar, 44);
        holder.append(img);
        monogramize(img, ctx.name1);
    } else {
        holder.append(buildMonogram(ctx.name1 ?? ''));
    }
    const text = element('span', 'imsg-cn-me-text');
    text.append(element('b', '', ctx.name1 ?? t('You')), element('small', '', t('My Card')));
    row.append(holder, text);
    row.addEventListener('click', () => select(`p:${avatar}`));
    return row;
}

function renderList(list, index) {
    const items = allItems();
    const needle = view.needle.trim().toLowerCase();
    const shown = items.filter((item) => (!needle || item.search.includes(needle)) && (!view.tag || item.tags.some((tag) => tag.id === view.tag)));
    // a new search starts at the top; selecting a contact keeps the list where it was
    const seen = active?.lastNeedle ?? '';
    const scroll = view.needle === seen ? list.scrollTop : 0;
    if (active) {
        active.lastNeedle = view.needle;
    }
    const parts = [];
    if (!needle && !view.tag && !view.pick) {
        parts.push(myCard());
    }
    if (!shown.length) {
        parts.push(element('p', 'imsg-cn-none', needle ? t('No Results') : t('No Contacts')));
    }
    const favorites = shown.filter((item) => item.fav);
    if (favorites.length && !needle) {
        parts.push(section(t('Favorites'), favorites));
    }
    const groups = shown.filter((item) => item.group);
    if (groups.length) {
        parts.push(section(t('Groups'), groups));
    }
    // 按最近排序时直接平铺，不再按首字母分组，否则字母分组会把最近顺序重新打乱。
    if (view.sort === 'recent') {
        const people = shown.filter((item) => !item.group);
        if (people.length) {
            parts.push(section(t('最近'), people));
        }
        list.replaceChildren(...parts);
        list.scrollTop = scroll;
        index.replaceChildren();
        index.hidden = true;
        return;
    }
    const letters = new Map();
    for (const item of shown.filter((x) => !x.group)) {
        const letter = letterOf(item.name);
        letters.set(letter, [...(letters.get(letter) ?? []), item]);
    }
    const order = [...letters.keys()].sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));
    for (const letter of order) {
        parts.push(section(letter, letters.get(letter), letter));
    }
    list.replaceChildren(...parts);
    list.scrollTop = scroll;

    // the letter index down the side
    index.replaceChildren(...order.map((letter) => {
        const jump = button('imsg-cn-letter', undefined, () => {
            list.querySelector(`.imsg-cn-section[data-letter="${CSS.escape(letter)}"]`)?.scrollIntoView({ block: 'start' });
        });
        jump.textContent = letter;
        return jump;
    }));
    index.hidden = order.length < 6;
}

function renderTags(bar) {
    const { tags, tagMap } = context();
    const used = new Set(Object.values(tagMap ?? {}).flat());
    const shown = (tags ?? []).filter((tag) => used.has(tag.id));
    bar.hidden = !shown.length;
    bar.replaceChildren(...shown.map((tag) => {
        const chip = button(`imsg-cn-tag${view.tag === tag.id ? ' imsg-cn-tag-on' : ''}`, undefined, () => {
            view.tag = view.tag === tag.id ? null : tag.id;
            render();
        });
        chip.textContent = tag.name;
        chip.setAttribute('aria-pressed', String(view.tag === tag.id));
        return chip;
    }));
}

// ── The card ──

function action(label, symbol, run, on = false) {
    const node = button(`imsg-card-action${on ? ' imsg-cn-on' : ''}`);
    const icon = element('span', 'imsg-card-action-icon');
    icon.append(glyph(symbol));
    node.append(icon, element('span', 'imsg-card-action-label', t(label)));
    node.addEventListener('click', run);
    return node;
}

function listRow(label, run, danger = false) {
    return button(`imsg-card-row${danger ? ' imsg-danger' : ''}`, label, run);
}

function infoBlock(label, text, limit = 420) {
    const value = plain(text);
    if (!value) {
        return null;
    }
    const block = element('div', 'imsg-cn-info');
    block.append(element('h4', '', t(label)));
    const body = element('p', '', value.length > limit ? `${value.slice(0, limit).replace(/\s+\S*$/, '')}…` : value);
    block.append(body);
    if (value.length > limit) {
        const more = button('imsg-cn-more', 'Show more', () => {
            body.textContent = value;
            more.remove();
        });
        block.append(more);
    }
    return block;
}

function renderCard(pane, item) {
    const card = element('div', 'imsg-cn-card');
    card.append(picture(item, 112), element('h2', 'imsg-cn-name', item.name));
    const about = item.group
        ? (item.group.members ?? []).map((avatar) => context().characters.find((x) => x.avatar === avatar)?.name).filter(Boolean).join(', ')
        : plain(field(item.character, 'creator_notes'), ABOUT_LIMIT);
    if (about) {
        card.append(element('p', 'imsg-cn-about', about));
    }
    if (item.tags.length) {
        const tags = element('div', 'imsg-cn-tags-line');
        tags.append(...item.tags.map((tag) => element('span', 'imsg-cn-tag', tag.name)));
        card.append(tags);
    }

    const actions = element('div', 'imsg-card-actions');
    actions.append(
        action('Message', 'send', () => openConversation(item)),
        action('New', 'compose', () => afterOpening(item, () => clickOption('option_start_new_chat'))),
        action('History', 'arrow-clockwise', () => afterOpening(item, () => clickOption('option_select_chat'))),
        action('Favorite', item.fav ? 'star-fill' : 'star', () => toggleFavorite(item), item.fav),
    );
    card.append(actions);

    if (item.group) {
        const members = element('div', 'imsg-cn-members');
        members.append(element('h4', '', t('Members')));
        for (const avatar of item.group.members ?? []) {
            const character = context().characters.find((x) => x.avatar === avatar);
            if (!character) {
                continue;
            }
            const member = { character, key: `c:${avatar}`, name: character.name };
            const row = button('imsg-cn-member', undefined, () => select(member.key));
            row.append(picture(member, 28), element('span', '', character.name));
            if ((item.group.disabled_members ?? []).includes(avatar)) {
                row.append(element('small', '', t('Muted')));
            }
            members.append(row);
        }
        card.append(members);
    } else {
        for (const block of [
            infoBlock('Description', field(item.character, 'description')),
            infoBlock('First Message', field(item.character, 'first_mes'), 280),
        ]) {
            if (block) {
                card.append(block);
            }
        }
        const by = [field(item.character, 'creator'), field(item.character, 'character_version')].filter(Boolean).join(' · ');
        if (by) {
            card.append(element('p', 'imsg-cn-by', by));
        }
    }

    const list = element('div', 'imsg-card-list');
    if (item.group) {
        list.append(listRow('Delete Group…', () => deleteContact(item), true));
    } else {
        list.append(
            listRow('Export as PNG', () => exportCharacter(item, 'png')),
            listRow('Export as JSON', () => exportCharacter(item, 'json')),
            listRow('Duplicate', () => duplicate(item)),
            listRow('Delete Contact…', () => deleteContact(item), true),
        );
    }
    card.append(list);
    pane.replaceChildren(paneBar(item.name, button('imsg-cn-edit', 'Edit', () => {
        view.mode = 'edit';
        render();
    })), card);
}

// ── Editing ──

function formField(label, value, { rows = 1, hint, type = 'text' } = {}) {
    const box = element('label', 'imsg-cn-field');
    box.append(element('span', 'imsg-cn-field-label', t(label)));
    const input = rows > 1 ? element('textarea') : element('input');
    if (rows > 1) {
        input.rows = rows;
    } else {
        input.type = type;
    }
    input.value = value ?? '';
    input.spellcheck = rows > 1;
    box.append(input);
    if (hint) {
        box.append(element('small', 'imsg-cn-hint', t(hint)));
    }
    return { box, input };
}

function pictureEditor(item, onFile) {
    const box = element('div', 'imsg-cn-photo');
    const pic = item ? picture(item, 112) : element('span', 'imsg-avatar imsg-cn-pic imsg-cn-pic-empty');
    pic.style.setProperty('--imsg-cn-pic', '112px');
    if (!item) {
        pic.append(glyph('person'));
    }
    const file = element('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    const change = button('imsg-cn-photo-button', item ? 'Edit' : 'Add Photo', () => file.click());
    file.addEventListener('change', () => {
        const chosen = file.files?.[0];
        if (!chosen) {
            return;
        }
        onFile(chosen);
        const img = element('img');
        img.alt = '';
        img.src = URL.createObjectURL(chosen);
        pic.replaceChildren(img);
        change.textContent = t('Edit');
    });
    box.append(pic, change, file);
    return box;
}

function renderCharacterForm(pane, item) {
    const character = item?.character;
    let photo = null;
    const form = element('form', 'imsg-cn-form');
    form.noValidate = true;
    form.append(pictureEditor(item, (file) => { photo = file; }));
    const name = formField('Name', character?.name ?? '');
    name.input.required = true;
    name.input.autocomplete = 'off';
    name.input.placeholder = t('Name');
    form.append(name.box);

    const inputs = new Map();
    const group = (title, fields) => {
        const box = element('fieldset', 'imsg-cn-group');
        if (title) {
            box.append(element('legend', '', t(title)));
        }
        for (const spec of fields) {
            const made = formField(spec.label, character ? field(character, spec.key) : '', spec);
            inputs.set(spec.key, made.input);
            box.append(made.box);
        }
        return box;
    };
    form.append(group('', FIELDS));

    // alternate greetings: a list you can add to
    const greetings = element('fieldset', 'imsg-cn-group imsg-cn-greetings');
    greetings.append(element('legend', '', t('Other First Messages')));
    const greetingList = element('div', 'imsg-cn-greeting-list');
    const addGreeting = (text = '') => {
        const row = element('div', 'imsg-cn-greeting');
        const area = element('textarea');
        area.rows = 3;
        area.value = text;
        const remove = button('imsg-cn-remove', undefined, () => row.remove());
        remove.setAttribute('aria-label', t('Remove'));
        remove.append(glyph('trash'));
        row.append(area, remove);
        greetingList.append(row);
        return area;
    };
    for (const text of character?.data?.alternate_greetings ?? []) {
        addGreeting(text);
    }
    greetings.append(greetingList, button('imsg-cn-add', 'Add a First Message', () => addGreeting().focus()));
    form.append(greetings);

    const advanced = element('details', 'imsg-cn-advanced');
    advanced.append(element('summary', '', t('Advanced')), group('', ADVANCED));
    const talk = formField('Talkativeness in Groups', String(character?.data?.extensions?.talkativeness ?? character?.talkativeness ?? 0.5), { type: 'range' });
    talk.input.min = '0';
    talk.input.max = '1';
    talk.input.step = '0.05';
    advanced.lastChild.append(talk.box);
    const tags = formField('Tags', (character ? (character.tags ?? character.data?.tags ?? []) : []).join(', '), { hint: 'Separated by commas.' });
    advanced.lastChild.append(tags.box);
    form.append(advanced);

    const cancel = button('imsg-cn-cancel', 'Cancel', () => {
        view.mode = 'card';
        if (!character) {
            view.key = null;
        }
        render();
    });
    const save = button('imsg-cn-save', 'Done');
    save.type = 'submit';
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newName = name.input.value.trim();
        if (!newName) {
            name.input.focus();
            toastr.warning(t('A contact needs a name.'));
            return;
        }
        save.disabled = true;
        const instance = active;
        const values = Object.fromEntries([...inputs].map(([key, input]) => [key, input.value]));
        const alternate = [...greetingList.querySelectorAll('textarea')].map((area) => area.value).filter((text) => text.trim());
        const tagList = tags.input.value.split(',').map((tag) => tag.trim()).filter(Boolean);
        const talkativeness = Number(talk.input.value);
        try {
            const key = character ? await updateCharacter(character, newName, values, alternate, tagList, talkativeness, photo)
                : await createCharacter(newName, values, alternate, tagList, talkativeness, photo);
            if (instance?.root?.isConnected) {
                instance.view.key = key;
                instance.view.mode = 'card';
            }
            await reloadAll(instance);
        } catch (error) {
            toastr.error(String(error.message ?? error), t('Couldn’t save'));
        } finally {
            save.disabled = false;
        }
    });
    pane.replaceChildren(paneBar(character ? t('Edit Contact') : t('New Contact'), save, cancel), form);
    // the bar's Done submits the form
    pane.querySelector('.imsg-cn-pane-bar .imsg-cn-save')?.addEventListener('click', () => form.requestSubmit());
    name.input.focus();
}

async function updateCharacter(character, newName, values, alternate, tagList, talkativeness, photo) {
    const ctx = context();
    const update = { data: { extensions: {} } };
    for (const [key, value] of Object.entries(values)) {
        if (key === 'depth_prompt') {
            update.data.extensions.depth_prompt = { ...(character.data?.extensions?.depth_prompt ?? { depth: 4, role: 'system' }), prompt: value };
            continue;
        }
        update[key] = value;
        update.data[key] = value;
    }
    update.data.alternate_greetings = alternate;
    update.tags = tagList;
    update.data.tags = tagList;
    update.talkativeness = talkativeness;
    update.data.extensions.talkativeness = talkativeness;
    if (newName !== character.name) {
        update.name = newName;
        update.data.name = newName;
    }
    await mergeCharacter(character.avatar, update);
    if (photo) {
        await uploadPicture(character.avatar, photo);
    }
    await ctx.getOneCharacter(character.avatar);
    const id = ctx.characters.findIndex((x) => x.avatar === character.avatar);
    await ctx.eventSource.emit(ctx.eventTypes.CHARACTER_EDITED, { detail: { id: String(id), character: ctx.characters[id] } });
    // the open conversation's character: the app refreshes what it shows of them
    if (String(ctx.characterId) === String(id)) {
        await ctx.selectCharacterById(id, { switchMenu: false });
    }
    return `c:${character.avatar}`;
}

async function createCharacter(name, values, alternate, tagList, talkativeness, photo) {
    const ctx = context();
    const response = await fetch('/api/characters/create', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({
            ch_name: name,
            description: values.description,
            first_mes: values.first_mes,
            personality: values.personality,
            scenario: values.scenario,
            mes_example: values.mes_example,
            creator_notes: values.creator_notes,
            system_prompt: values.system_prompt,
            post_history_instructions: values.post_history_instructions,
            creator: values.creator,
            character_version: values.character_version,
            tags: tagList,
            talkativeness: talkativeness,
            world: '',
            depth_prompt_prompt: values.depth_prompt,
            depth_prompt_depth: 4,
            depth_prompt_role: 'system',
            fav: false,
            alternate_greetings: alternate,
            extensions: '{}',
        }),
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const avatar = await response.text();
    if (photo) {
        await uploadPicture(avatar, photo);
    }
    return `c:${avatar}`;
}

function renderGroupForm(pane, item) {
    const ctx = context();
    const group = item?.group;
    const form = element('form', 'imsg-cn-form');
    form.noValidate = true;
    const picBox = element('div', 'imsg-cn-photo');
    const pic = element('span', 'imsg-avatar imsg-cn-pic');
    pic.style.setProperty('--imsg-cn-pic', '112px');
    picBox.append(pic);
    form.append(picBox);
    const name = formField('Group Name', group?.name ?? '');
    name.input.placeholder = t('Group Name');
    form.append(name.box);

    let members = [...(group?.members ?? [])];
    const muted = new Set(group?.disabled_members ?? []);
    const memberBox = element('fieldset', 'imsg-cn-group');
    memberBox.append(element('legend', '', t('Members')));
    const memberList = element('div', 'imsg-cn-member-list');
    const search = element('input', 'imsg-cn-member-search');
    search.type = 'search';
    search.placeholder = t('Add someone…');
    const suggestions = element('div', 'imsg-cn-suggest');
    const drawPicture = () => {
        pic.replaceChildren(buildGroupAvatar({ members, name: name.input.value }, 112));
    };
    const drawMembers = () => {
        memberList.replaceChildren(...members.map((avatar, index) => {
            const character = ctx.characters.find((x) => x.avatar === avatar);
            const row = element('div', 'imsg-cn-member');
            row.append(picture({ character: character ?? { avatar, name: avatar } }, 28), element('span', '', character?.name ?? avatar));
            const mute = button(`imsg-cn-mute${muted.has(avatar) ? ' imsg-cn-on' : ''}`, muted.has(avatar) ? 'Muted' : 'Mute', () => {
                muted.has(avatar) ? muted.delete(avatar) : muted.add(avatar);
                drawMembers();
            });
            const up = button('imsg-cn-move', undefined, () => {
                [members[index - 1], members[index]] = [members[index], members[index - 1]];
                drawMembers();
            });
            up.textContent = '↑';
            up.disabled = index === 0;
            up.setAttribute('aria-label', t('Move Up'));
            const remove = button('imsg-cn-remove', undefined, () => {
                members = members.filter((x) => x !== avatar);
                muted.delete(avatar);
                drawMembers();
            });
            remove.setAttribute('aria-label', t('Remove'));
            remove.append(glyph('trash'));
            row.append(mute, up, remove);
            return row;
        }));
        drawPicture();
        drawSuggestions();
    };
    const drawSuggestions = () => {
        const needle = search.value.trim().toLowerCase();
        const options = ctx.characters
            .filter((x) => !members.includes(x.avatar) && (!needle || x.name.toLowerCase().includes(needle)))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, needle ? 12 : 6);
        suggestions.replaceChildren(...options.map((character) => {
            const row = button('imsg-cn-member imsg-cn-suggestion', undefined, () => {
                members.push(character.avatar);
                search.value = '';
                drawMembers();
            });
            row.append(picture({ character }, 28), element('span', '', character.name), element('small', 'imsg-cn-plus', '+'));
            return row;
        }));
    };
    search.addEventListener('input', drawSuggestions);
    name.input.addEventListener('input', drawPicture);
    memberBox.append(memberList, search, suggestions);
    form.append(memberBox);

    const behaviour = element('fieldset', 'imsg-cn-group');
    behaviour.append(element('legend', '', t('Replies')));
    const strategy = element('select');
    for (const [value, label] of STRATEGIES) {
        const option = element('option', '', t(label));
        option.value = String(value);
        strategy.append(option);
    }
    strategy.value = String(group?.activation_strategy ?? 0);
    const mode = element('select');
    for (const [value, label] of GENERATION_MODES) {
        const option = element('option', '', t(label));
        option.value = String(value);
        mode.append(option);
    }
    mode.value = String(group?.generation_mode ?? 0);
    const self = element('input');
    self.type = 'checkbox';
    self.checked = !!group?.allow_self_responses;
    const labelled = (label, control) => {
        const box = element('label', 'imsg-cn-field');
        box.append(element('span', 'imsg-cn-field-label', t(label)), control);
        return box;
    };
    const selfBox = element('label', 'checkbox_label imsg-cn-check');
    selfBox.append(self, element('span', '', t('Let someone answer themselves')));
    behaviour.append(labelled('Who answers next', strategy), labelled('Cards in the prompt', mode), selfBox);
    form.append(behaviour);

    const save = button('imsg-cn-save', group ? 'Done' : 'Create');
    save.type = 'submit';
    const cancel = button('imsg-cn-cancel', 'Cancel', () => {
        view.mode = 'card';
        if (!group) {
            view.key = null;
        }
        render();
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!members.length) {
            toastr.warning(t('Add at least one member.'));
            search.focus();
            return;
        }
        const groupName = name.input.value.trim() || `${t('Group')}: ${members.map((avatar) => ctx.characters.find((x) => x.avatar === avatar)?.name).filter(Boolean).join(', ')}`;
        save.disabled = true;
        const instance = active;
        try {
            if (group) {
                await saveGroup({
                    ...group,
                    name: groupName,
                    members,
                    disabled_members: [...muted].filter((avatar) => members.includes(avatar)),
                    activation_strategy: Number(strategy.value),
                    generation_mode: Number(mode.value),
                    allow_self_responses: self.checked,
                });
                if (instance?.root?.isConnected) {
                    instance.view.key = `g:${group.id}`;
                }
            } else {
                const chat = ctx.humanizedDateTime();
                const response = await fetch('/api/groups/create', {
                    method: 'POST',
                    headers: ctx.getRequestHeaders(),
                    body: JSON.stringify({
                        name: groupName,
                        members,
                        avatar_url: DEFAULT_GROUP_AVATAR,
                        allow_self_responses: self.checked,
                        hideMutedSprites: false,
                        activation_strategy: Number(strategy.value),
                        generation_mode: Number(mode.value),
                        disabled_members: [...muted],
                        fav: false,
                        chat_id: chat,
                        chats: [chat],
                        auto_mode_delay: 5,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`${response.status}`);
                }
                const created = await response.json();
                if (instance?.root?.isConnected) {
                instance.view.key = `g:${created.id}`;
            }
            }
            if (instance?.root?.isConnected) {
                instance.view.mode = 'card';
            }
            await reloadAll(instance);
        } catch (error) {
            toastr.error(String(error.message ?? error), t('Couldn’t save the group'));
        } finally {
            save.disabled = false;
        }
    });
    pane.replaceChildren(paneBar(group ? t('Edit Group') : t('New Group'), save, cancel), form);
    pane.querySelector('.imsg-cn-pane-bar .imsg-cn-save')?.addEventListener('click', () => form.requestSubmit());
    drawMembers();
    name.input.focus();
}

/** The bar over the right-hand pane: back (on a phone), the title, and its buttons. */
function paneBar(title, primary, secondary) {
    const bar = element('header', 'imsg-cn-pane-bar');
    // 只留一个箭头，不再带「联系人」三个字；从「我的」进来时返回「我的」，否则退回列表
    const back = button('imsg-cn-back', 'Back 返回', () => {
        // a sheet (My Card over Me) closes; the page keeps its list and closes the detail layer
        if (view.sheet) {
            dismiss();
            return;
        }
        if (active?.page) {
            closeDetail(active);
            return;
        }
        view.key = null;
        view.mode = 'card';
        render();
    });
    back.textContent = '';
    back.prepend(glyph('chevron-left'));
    back.setAttribute('aria-label', t('Back 返回'));
    const heading = element('h2', 'imsg-cn-pane-title', title ?? '');
    // 弹窗里用右上角的「完成」关闭；只有表单才有主按钮（保存）
    if (view.sheet && !primary?.classList?.contains('imsg-cn-save')) {
        const done = button('imsg-cn-done imsg-sheet-done', t('Done 完成'), dismiss);
        bar.append(element('span'), heading, done);
        return bar;
    }
    bar.append(secondary ?? (view.sheet ? element('span') : back), heading, primary ?? element('span'));
    return bar;
}

// ── My Card: your personas ──

const POSITIONS = [
    [0, 'With the description (in the prompt)'],
    [2, 'Before the Author’s Note'],
    [3, 'After the Author’s Note'],
    [4, 'In the conversation, at a depth'],
    [9, 'Nowhere (not sent)'],
];
const ROLES = [
    [0, 'System'],
    [1, 'User'],
    [2, 'Assistant'],
];

function powerUser() {
    return context().powerUserSettings;
}

function personaName(avatar) {
    return powerUser().personas?.[avatar] ?? avatar;
}

function personaPicture(avatar, size) {
    const holder = element('span', 'imsg-avatar imsg-cn-pic');
    holder.style.setProperty('--imsg-cn-pic', `${size}px`);
    const img = element('img');
    img.alt = '';
    img.loading = 'lazy';
    setPicture(img, 'persona', avatar, size);
    holder.append(img);
    monogramize(img, personaName(avatar));
    return holder;
}

/** Every persona, the one in use first, then by name. */
function allPersonas() {
    const current = personas.user_avatar;
    return Object.keys(powerUser().personas ?? {}).sort((a, b) => (b === current) - (a === current) || personaName(a).localeCompare(personaName(b), undefined, { sensitivity: 'base' }));
}

async function usePersona(avatar) {
    const instance = active;
    await personas.setUserAvatar(avatar, { toastPersonaNameChange: false });
    renderInstance(instance);
}

async function toggleChatLock() {
    const instance = active;
    await personas.setPersonaLockState(!personas.isPersonaLocked('chat'), 'chat');
    renderInstance(instance);
}

function toggleDefault(avatar) {
    const instance = active;
    const settings = powerUser();
    settings.default_persona = settings.default_persona === avatar ? null : avatar;
    context().saveSettingsDebounced();
    renderInstance(instance);
}

async function uploadPersonaPicture(avatar, file) {
    const ctx = context();
    const form = new FormData();
    form.append('avatar', file, file.name || 'avatar.png');
    form.append('overwrite_name', avatar);
    const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        headers: ctx.getRequestHeaders({ omitContentType: true }),
        cache: 'no-cache',
        body: form,
    });
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    await fetch(`/User Avatars/${encodeURIComponent(avatar)}`, { cache: 'reload' }).catch(() => {});
    await fetch(ctx.getThumbnailUrl('persona', avatar), { cache: 'reload' }).catch(() => {});
}

async function deletePersona(avatar) {
    const ctx = context();
    const instance = active;
    const ok = await ctx.callGenericPopup(
        `<h3>${t('Delete')} ${escapeHtml(personaName(avatar))}?</h3><p>${t('Their picture and description go too. This can’t be undone.')}</p>`,
        ctx.POPUP_TYPE.CONFIRM, '', { okButton: t('Delete'), cancelButton: t('Cancel') },
    );
    if (ok !== ctx.POPUP_RESULT.AFFIRMATIVE) {
        return;
    }
    await ctx.executeSlashCommandsWithOptions(`/persona-delete persona=${slashValue(avatar)} silent=true`, { handleParserErrors: true, handleExecutionErrors: true });
    if (instance?.root?.isConnected) {
        instance.view.key = `p:${personas.user_avatar}`;
        instance.view.mode = 'card';
    }
    renderInstance(instance);
}

function renderPersonaCard(pane, avatar) {
    const settings = powerUser();
    const descriptor = settings.persona_descriptions?.[avatar] ?? {};
    const current = avatar === personas.user_avatar;
    const isDefault = settings.default_persona === avatar;
    const card = element('div', 'imsg-cn-card');
    card.append(personaPicture(avatar, 112), element('h2', 'imsg-cn-name', personaName(avatar)));
    const notes = [descriptor.title, current ? t('In use') : '', isDefault ? t('Default') : ''].filter(Boolean);
    if (notes.length) {
        card.append(element('p', 'imsg-cn-about', notes.join(' · ')));
    }

    const actions = element('div', 'imsg-card-actions');
    if (current) {
        const locked = personas.isPersonaLocked('chat');
        actions.append(action(locked ? 'Unlock Chat' : 'Lock to Chat', 'lock', toggleChatLock, locked));
    } else {
        actions.append(action('Use', 'check', () => usePersona(avatar)));
    }
    actions.append(
        action('Default', isDefault ? 'star-fill' : 'star', () => toggleDefault(avatar), isDefault),
        action('Edit', 'pencil', () => {
            view.mode = 'edit';
            render();
        }),
        action('New', 'plus', () => {
            view.key = 'new:p';
            render();
        }),
    );
    card.append(actions);

    const about = infoBlock('About Me', descriptor.description ?? '');
    if (about) {
        card.append(about);
    } else {
        card.append(element('p', 'imsg-cn-by', t('No description yet. Edit to tell them who you are.')));
    }

    const others = allPersonas().filter((x) => x !== avatar);
    if (others.length) {
        const list = element('div', 'imsg-cn-members');
        list.append(element('h4', '', t('My Other Cards')));
        for (const other of others) {
            const row = button('imsg-cn-member', undefined, () => select(`p:${other}`));
            row.append(personaPicture(other, 28), element('span', '', personaName(other)));
            if (other === personas.user_avatar) {
                row.append(element('small', '', t('In use')));
            }
            list.append(row);
        }
        card.append(list);
    }

    const rows = element('div', 'imsg-card-list');
    rows.append(listRow('Delete Persona…', () => deletePersona(avatar), true));
    card.append(rows);
    pane.replaceChildren(paneBar(t('My Card'), button('imsg-cn-edit', 'Edit', () => {
        view.mode = 'edit';
        render();
    })), card);
}

function renderPersonaForm(pane, avatar) {
    const settings = powerUser();
    const descriptor = avatar ? settings.persona_descriptions?.[avatar] ?? {} : {};
    let photo = null;
    const form = element('form', 'imsg-cn-form');
    form.noValidate = true;
    form.append(pictureEditor(avatar ? { persona: avatar } : null, (file) => { photo = file; }));
    const name = formField('Name', avatar ? personaName(avatar) : '');
    name.input.placeholder = t('Name');
    name.input.autocomplete = 'off';
    form.append(name.box);

    const box = element('fieldset', 'imsg-cn-group');
    const title = formField('Title', descriptor.title ?? '', { hint: 'Shown under your name only.' });
    const description = formField('About Me', descriptor.description ?? '', { rows: 8, hint: 'Who you are, sent with the conversation.' });
    const position = element('select');
    for (const [value, label] of POSITIONS) {
        const option = element('option', '', t(label));
        option.value = String(value);
        position.append(option);
    }
    position.value = String(descriptor.position ?? 0);
    const positionBox = element('label', 'imsg-cn-field');
    positionBox.append(element('span', 'imsg-cn-field-label', t('Where it goes')), position);
    const depth = formField('Depth', String(descriptor.depth ?? 2), { type: 'number', hint: 'How many messages from the end.' });
    depth.input.min = '0';
    const role = element('select');
    for (const [value, label] of ROLES) {
        const option = element('option', '', t(label));
        option.value = String(value);
        role.append(option);
    }
    role.value = String(descriptor.role ?? 0);
    const roleBox = element('label', 'imsg-cn-field');
    roleBox.append(element('span', 'imsg-cn-field-label', t('Sent as')), role);
    const showDepth = () => {
        const atDepth = position.value === '4';
        depth.box.hidden = !atDepth;
        roleBox.hidden = !atDepth;
    };
    position.addEventListener('change', showDepth);
    showDepth();
    box.append(title.box, description.box, positionBox, depth.box, roleBox);
    form.append(box);

    const save = button('imsg-cn-save', 'Done');
    save.type = 'submit';
    const cancel = button('imsg-cn-cancel', 'Cancel', () => {
        view.mode = 'card';
        if (!avatar) {
            view.key = `p:${personas.user_avatar}`;
        }
        render();
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newName = name.input.value.trim();
        if (!newName) {
            name.input.focus();
            toastr.warning(t('A persona needs a name.'));
            return;
        }
        save.disabled = true;
        const instance = active;
        const values = {
            description: description.input.value,
            title: title.input.value.trim(),
            position: Number(position.value),
            depth: Math.max(0, Number(depth.input.value) || 0),
            role: Number(role.value),
        };
        try {
            const key = avatar ? await updatePersona(avatar, newName, values, photo) : await createPersona(newName, values, photo);
            if (instance?.root?.isConnected) {
                instance.view.key = `p:${key}`;
                instance.view.mode = 'card';
            }
            renderInstance(instance);
        } catch (error) {
            toastr.error(String(error.message ?? error), t('Couldn’t save'));
        } finally {
            save.disabled = false;
        }
    });
    pane.replaceChildren(paneBar(avatar ? t('Edit My Card') : t('New Persona'), save, cancel), form);
    pane.querySelector('.imsg-cn-pane-bar .imsg-cn-save')?.addEventListener('click', () => form.requestSubmit());
    name.input.focus();
}

async function updatePersona(avatar, newName, values, photo) {
    const ctx = context();
    const settings = powerUser();
    const descriptor = settings.persona_descriptions[avatar] ??= { lorebook: '', connections: [] };
    Object.assign(descriptor, values);
    const oldName = settings.personas[avatar];
    settings.personas[avatar] = newName;
    if (avatar === personas.user_avatar) {
        if (newName !== ctx.name1) {
            setUserName(newName, { toastPersonaNameChange: false });
        }
        settings.persona_description = values.description;
        settings.persona_description_position = values.position;
        settings.persona_description_depth = values.depth;
        settings.persona_description_role = values.role;
        personas.setPersonaDescription();
    }
    ctx.saveSettingsDebounced();
    if (oldName !== newName) {
        await ctx.eventSource.emit(ctx.eventTypes.PERSONA_RENAMED, { avatarId: avatar, oldName, newName });
    }
    if (photo) {
        await uploadPersonaPicture(avatar, photo);
    }
    await personas.getUserAvatars(true, avatar);
    return avatar;
}

async function createPersona(newName, values, photo) {
    // a unique file name, as the app makes one
    const avatar = `${Date.now()}-${newName.replace(/[^a-zA-Z0-9]/g, '')}.png`;
    await personas.initPersona(avatar, newName, values.description, values.title, { position: values.position, depth: values.depth, role: values.role });
    const file = photo ?? new File([await (await fetch(default_user_avatar)).blob()], 'avatar.png', { type: 'image/png' });
    await uploadPersonaPicture(avatar, file);
    await personas.getUserAvatars(true, avatar);
    return avatar;
}

// ── The window ──

function select(key) {
    view.key = key;
    view.mode = 'card';
    rememberDetail(active);
    render();
}

function render(root = activeRoot) {
    if (!root || !root.isConnected) {
        return;
    }
    // the data may have changed since the last pass, so this render builds a fresh list
    itemsCache = null;
    root.classList.toggle('imsg-cn-picking', view.pick);
    renderTags(root.querySelector('.imsg-cn-tags'));
    renderList(root.querySelector('.imsg-cn-scroll'), root.querySelector('.imsg-cn-index'));
    const pane = root.querySelector('.imsg-cn-detail');
    const item = view.key && !view.key.startsWith('new:') ? find(view.key) : null;
    if (view.key && !item && !view.key.startsWith('new:')) {
        view.key = null;
    }
    const detailed = !!view.key || view.sheet;
    root.classList.toggle('imsg-cn-has-detail', detailed);
    // 手机上名片会整张盖住列表，被盖住的列表不该还能 Tab 到、点到
    root.querySelector('.imsg-cn-side')?.toggleAttribute('inert', detailed);
    if (view.key === 'new:c') {
        renderCharacterForm(pane, null);
    } else if (view.key === 'new:p') {
        renderPersonaForm(pane, null);
    } else if (item?.persona) {
        view.mode === 'edit' ? renderPersonaForm(pane, item.persona) : renderPersonaCard(pane, item.persona);
    } else if (view.key === 'new:g') {
        renderGroupForm(pane, null);
    } else if (item && view.mode === 'edit') {
        Object.assign(item, allItems().find((x) => x.key === view.key));
        item.group ? renderGroupForm(pane, item) : renderCharacterForm(pane, item);
    } else if (item) {
        renderCard(pane, allItems().find((x) => x.key === view.key) ?? item);
    } else {
        const empty = element('div', 'imsg-cn-empty', t('No Contact Selected'));
        pane.replaceChildren(empty);
    }
}

/* ── Windows: one instance each for the page, the modal, the picker and the sheet ── */

const PAGE_ID = 'imsg-contacts-page';

function activate(instance) {
    active = instance;
    view = instance.view;
    activeRoot = instance.root;
}

function renderInstance(instance) {
    if (!instance?.root?.isConnected) {
        return;
    }
    activate(instance);
    render(instance.root);
}

function registerWindow(instance) {
    windows.set(instance.id, instance);
    // any interaction with a window makes it the current one, so sync code reads its view
    const grab = () => activate(instance);
    instance.root.addEventListener('pointerdown', grab, true);
    instance.root.addEventListener('focusin', grab, true);
    return instance;
}

/** Removes one window for good (a modal being closed, or the page on theme stop). */
function destroyWindow(instance = active) {
    if (!instance) {
        return;
    }
    clearTimeout(instance.searchTimer);
    if (instance.overlay) {
        releaseOverlay(instance.overlay);
        instance.overlay = null;
    }
    instance.detailEntry = null;
    windows.delete(instance.id);
    if (instance.root?.isConnected) {
        instance.root.remove();
    }
    if (active === instance) {
        active = null;
        activeRoot = null;
    }
}

/** Closes a modal and hands control back to whoever opened it (never the page). */
function close(reason = 'done') {
    const instance = active;
    if (!instance || instance.page) {
        return;
    }
    const leave = instance.view.onClose;
    if (instance.entry) {
        const entry = instance.entry;
        instance.entry = null;
        exitEntry(entry);
    }
    destroyWindow(instance);
    unlockPage();
    leave?.(reason);
}

function dismiss() {
    close('dismiss');
}

/** Closes the card/edit layer inside the contacts page without touching the page itself. */
function closeDetail(instance = active) {
    if (!instance) {
        return;
    }
    instance.view.key = null;
    instance.view.mode = 'card';
    if (instance.detailEntry) {
        const entry = instance.detailEntry;
        instance.detailEntry = null;
        exitEntry(entry);
    }
    renderInstance(instance);
}

/** The page's detail layer gets its own back-stack entry; a modal instance never does. */
function rememberDetail(instance) {
    if (!instance?.page || instance.detailEntry) {
        return;
    }
    instance.detailEntry = enterEntry('contact-detail', () => {
        instance.detailEntry = null;
        instance.view.key = null;
        instance.view.mode = 'card';
        renderInstance(instance);
    });
}

function onKey(event) {
    if (event.key !== 'Escape' || overlayOpen()) {
        return;
    }
    if (!document.body.classList.contains('imessage')) {
        return;
    }
    const instance = active;
    const root = instance?.root;
    if (!instance || !root?.isConnected) {
        return;
    }
    event.stopPropagation();
    if (instance.view.mode === 'edit' || instance.view.key?.startsWith('new:')) {
        root.querySelector('.imsg-cn-pane-bar .imsg-cn-cancel')?.click();
    } else if (instance.view.sheet) {
        dismiss();
    } else if (root.classList.contains('imsg-cn-has-detail') && isPhone()) {
        closeDetail(instance);
    } else if (instance.page) {
        // let the tab bar take the page away
        window.dispatchEvent(new CustomEvent('imsg:contacts-escape'));
    } else {
        close('esc');
    }
}

function createInstance({ id, page = false, pick = false, sheet = false, key = null, edit = false, onClose = null }) {
    return {
        id,
        page,
        pick,
        sheet,
        onClose,
        root: null,
        view: { key, mode: edit ? 'edit' : 'card', pick, sheet, page, needle: '', tag: null, sort: lastSort, onClose },
        lastNeedle: '',
        searchTimer: 0,
        overlay: null,
        entry: null,
        detailEntry: null,
    };
}

/** Builds one window's DOM. The page and the modal share it; only the shell differs. */
function buildWindow(instance) {
    const { id, page, pick, sheet } = instance;
    const v = instance.view;
    const root = element('div');
    root.id = id;
    root.className = 'imsg-cn';
    root.classList.toggle('imsg-cn-sheet', sheet);
    root.classList.toggle('imsg-cn-page', page);
    const modal = !page && !pick && !sheet;
    // the page reuses the modal's inner layout (bar, search, grouped list); only its shell differs
    root.classList.toggle('imsg-cn-modal', modal || page);
    instance.root = root;

    const backdrop = element('div', 'imsg-cn-backdrop');
    backdrop.addEventListener('click', () => (sheet ? dismiss() : close('backdrop')));
    if (modal || page) {
        backdrop.hidden = true;
    }

    const win = element('div', 'imsg-cn-window');
    if (!page) {
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-modal', 'true');
    }
    win.setAttribute('aria-label', t(pick ? 'New Message' : 'Contacts'));

    const side = element('div', 'imsg-cn-side');
    const bar = element('header', 'imsg-cn-bar');
    const add = button('imsg-sym-button imsg-cn-add-menu');
    add.setAttribute('aria-label', t('Add'));
    add.title = t('Add');
    add.append(glyph('plus'));
    add.addEventListener('click', () => {
        toggleMenu(add, [
            { label: 'New Contact', run: () => { v.key = 'new:c'; rememberDetail(instance); renderInstance(instance); } },
            { label: 'New Group', run: () => { v.key = 'new:g'; rememberDetail(instance); renderInstance(instance); } },
            {},
            { label: 'Import from File…', run: importFromFile },
            { label: 'Import from Link…', run: importFromUrl },
        ]);
    });
    const done = page ? null : button('imsg-cn-done', pick ? 'Cancel' : 'Done', () => close(pick ? 'cancel' : 'done'));
    const sort = button('imsg-cn-sort', v.sort === 'recent' ? '最近' : 'A–Z', () => {
        v.sort = v.sort === 'recent' ? 'name' : 'recent';
        lastSort = v.sort;
        sort.textContent = v.sort === 'recent' ? '最近' : 'A–Z';
        sort.title = t(v.sort === 'recent' ? 'Sort by recent 按最近' : 'Sort by name 按字母');
        root.querySelector('.imsg-cn-scroll').scrollTop = 0;
        renderInstance(instance);
    });
    sort.title = t(v.sort === 'recent' ? 'Sort by recent 按最近' : 'Sort by name 按字母');
    const tools = element('span', 'imsg-cn-tools');
    tools.append(sort, add);
    let head = bar;
    if (page) {
        // same chrome as the other two first-level pages: an action row, then the large title
        head = element('div', 'imsg-page-head');
        const actions = element('div', 'imsg-page-actions');
        actions.append(tools);
        head.append(actions, element('h1', 'imsg-page-title', t('Contacts 联系人')));
    } else {
        bar.append(done, element('h1', 'imsg-cn-title', t(pick ? 'New Message' : 'Contacts')), pick ? element('span') : tools);
    }

    const searchBox = element('label', 'imsg-search imsg-cn-search');
    searchBox.append(glyph('search'));
    const search = element('input');
    search.type = 'search';
    search.placeholder = t(pick ? 'To: name or group' : 'Search');
    search.setAttribute('aria-label', search.placeholder);
    search.addEventListener('input', () => {
        // 联系人很多时，每敲一个字都重建整个列表会卡：停一下再画
        clearTimeout(instance.searchTimer);
        instance.searchTimer = setTimeout(() => {
            v.needle = search.value;
            renderInstance(instance);
        }, 110);
    });
    search.addEventListener('keydown', (event) => {
        // Enter in New Message writes to the first match
        if (event.key === 'Enter' && v.pick) {
            clearTimeout(instance.searchTimer);
            v.needle = search.value;
            renderInstance(instance);
            root.querySelector('.imsg-cn-scroll .imsg-cn-row:not(.imsg-cn-me)')?.click();
        }
    });
    searchBox.append(search);
    const tags = element('div', 'imsg-cn-tags');
    const listWrap = element('div', 'imsg-cn-listwrap');
    const scroll = element('div', 'imsg-cn-scroll');
    scroll.setAttribute('role', 'listbox');
    const index = element('nav', 'imsg-cn-index');
    index.setAttribute('aria-label', t('Index'));
    listWrap.append(scroll, index);
    side.append(head, searchBox, tags, listWrap);

    const detail = element('section', 'imsg-cn-detail');
    win.append(side, detail);
    root.append(win);
    if (!page) {
        root.prepend(backdrop);
    }
    registerWindow(instance);

    if (page) {
        document.body.append(root);
        showContactsPage();
        return instance;
    }

    document.body.append(root);
    lockPage();
    instance.overlay = acquireOverlay(sheet ? 'contacts:sheet' : pick ? 'contacts:picker' : 'contacts:modal');
    if (sheet) {
        instance.entry = enterEntry('persona-sheet', () => {
            instance.entry = null;
            close('back');
        });
    }
    renderInstance(instance);
    // 手机上打开通讯录不自动弹键盘，点搜索框才聚焦；桌面保留直接输入
    if (!instance.view.mode.startsWith('edit') && !isPhone()) {
        search.focus({ preventScroll: true });
    }
    return instance;
}

/** Opens a contacts modal (the secondary surface used from the chat and the app menu). */
export function openContacts({ pick = false, key = null, edit = false, sheet = false, onClose = null } = {}) {
    // one modal at a time; the page is a different window and is never touched here
    for (const instance of [...windows.values()]) {
        if (!instance.page) {
            destroyWindow(instance);
        }
    }
    const instance = createInstance({ id: ROOT_ID, pick, sheet, key, edit, onClose });
    return buildWindow(instance);
}

function ensureContactsPage() {
    let instance = windows.get(PAGE_ID);
    if (!instance || !instance.root?.isConnected) {
        instance = createInstance({ id: PAGE_ID, page: true });
        buildWindow(instance);
    }
    return instance;
}

/** Shows the Contacts first-level page, building it once on first use. */
export function showContactsPage() {
    const instance = ensureContactsPage();
    instance.root.classList.remove('imsg-hidden');
    instance.root.removeAttribute('inert');
    instance.root.setAttribute('aria-hidden', 'false');
    renderInstance(instance);
    return instance;
}

export function hideContactsPage() {
    const instance = windows.get(PAGE_ID);
    if (!instance) {
        return;
    }
    instance.root.classList.add('imsg-hidden');
    instance.root.setAttribute('inert', '');
    instance.root.setAttribute('aria-hidden', 'true');
}

/** Clears the page's card/edit layer without touching its search, sort, scroll or history. */
export function resetContactsDetail() {
    const instance = windows.get(PAGE_ID);
    if (!instance) {
        return;
    }
    instance.detailEntry = null;
    instance.view.key = null;
    instance.view.mode = 'card';
    instance.root?.classList.remove('imsg-cn-has-detail');
}

export function destroyContactsPage() {
    const instance = windows.get(PAGE_ID);
    if (instance) {
        destroyWindow(instance);
    }
}

/** Opens Contacts on My Card, the persona in use. */
/** 从「我的」打开自己的名片；返回时交给调用方决定去哪（现在是回「我的」） */
export function openMyCard({ onClose = null, sheet = false } = {}) {
    openContacts({ key: `p:${personas.user_avatar}`, sheet, onClose });
}

/** Closes the modal from outside (never the page). */
export function closeContacts() {
    const modal = [...windows.values()].find((instance) => !instance.page);
    if (!modal) {
        return false;
    }
    activate(modal);
    close('tab');
    return true;
}

/** Opens the card (or the Edit form) of the open conversation's contact or group. */
export function openCurrentContact({ edit = false } = {}) {
    const ctx = context();
    const key = ctx.groupId ? `g:${ctx.groupId}` : (ctx.characters[ctx.characterId] ? `c:${ctx.characters[ctx.characterId].avatar}` : null);
    openContacts({ key, edit });
}

/** Deletes the open conversation's contact or group, after asking. */
export function deleteCurrentContact() {
    const ctx = context();
    const key = ctx.groupId ? `g:${ctx.groupId}` : (ctx.characters[ctx.characterId] ? `c:${ctx.characters[ctx.characterId].avatar}` : null);
    const item = find(key);
    if (item) {
        deleteContact(item);
    }
}

export function initContacts() {
    const { eventTypes } = context();
    const eventSource = events();
    // the list keeps up with imports, deletes and edits made anywhere
    for (const type of [eventTypes.CHARACTER_PAGE_LOADED, eventTypes.CHARACTER_DELETED, eventTypes.GROUP_UPDATED, eventTypes.CHARACTER_EDITED, eventTypes.PERSONA_CHANGED, eventTypes.PERSONA_DELETED]) {
        if (type) {
            eventSource.on(type, () => {
                const modal = [...windows.values()].find((instance) => !instance.page && instance.root?.isConnected);
                const page = windows.get(PAGE_ID);
                // a form being filled in isn't redrawn under the person typing
                for (const instance of [page, modal]) {
                    if (!instance?.root?.isConnected) {
                        continue;
                    }
                    if (instance.view.mode === 'edit' || instance.view.key?.startsWith('new:')) {
                        continue;
                    }
                    renderInstance(instance);
                }
                if (modal) {
                    activate(modal);
                } else if (page) {
                    activate(page);
                }
            });
        }
    }
}

// one key handler for every window; it always acts on the current (topmost) one
document.addEventListener('keydown', onKey, true);

// turning the theme off closes every window, putting back what it borrowed
onStop(() => {
    for (const instance of [...windows.values()]) {
        destroyWindow(instance);
    }
    unlockPage();
});