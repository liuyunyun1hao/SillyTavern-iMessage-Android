// Customize panel: theme variables (tokens) laid over the light or dark palette, a few switches
// (flags) and the user's own CSS, previewed live.
//
// Saved as settings.customize = { tokens: { '--name': 'value' }, flags: { name: true }, css: '' }.
// Export/Import use { themeId: 'imessage', version: 1, tokens, flags, css }, shared with the
// other themes.

import { getSettings, saveSettings } from './config.js';
import { isOn, onStart, onStop, whenOn } from './power.js';
import { element, t, within } from './dom.js';

const PANEL_ID = 'imsg-customize';
const STYLE_ID = 'imsg-custom-style';
const THEME_ID = 'imessage';
const VERSION = 1;

const FONTS = [
    ['', 'San Francisco (system) 系统字体'],
    ['"Inter", system-ui, sans-serif', 'Inter'],
    ['"Helvetica Neue", Helvetica, Arial, sans-serif', 'Helvetica'],
    ['ui-rounded, "SF Pro Rounded", system-ui, sans-serif', 'Rounded 圆体'],
    ['Georgia, "New York", "Times New Roman", serif', 'Serif 衬线'],
    ['ui-monospace, "SF Mono", Menlo, Consolas, monospace', 'Monospace 等宽'],
];


/**
 * One-tap colour schemes, taken from the chat screenshots people keep sending me:
 * pale pink and sky blue bubbles floating on a photo, or the plain iOS blue.
 * Each one only owns the bubble tokens below, so it never fights the other controls.
 */
const PRESET_KEYS = [
    '--imsg-bubble-out',
    '--imsg-bubble-out-fg',
    '--imsg-bubble-in',
    '--imsg-bubble-in-fg',
    '--imsg-bubble-alpha',
    '--imsg-bubble-blur',
    '--imsg-focus',
];

const PRESETS = [
    {
        name: 'classic',
        label: '经典蓝 Classic',
        swatch: ['#0a84ff', '#e6e6e6'],
        tokens: {},
        settings: {},
        flags: {},
    },
    {
        name: 'blush',
        label: '柔粉 Blush',
        swatch: ['#f7c6d4', '#f2e6e9'],
        tokens: {
            '--imsg-bubble-out': '#f7c6d4',
            '--imsg-bubble-out-fg': '#6e3a47',
            '--imsg-bubble-in': '#f2e6e9',
            '--imsg-bubble-in-fg': '#3b2c31',
            '--imsg-bubble-alpha': '90%',
            '--imsg-bubble-blur': '10px',
            '--imsg-focus': 'rgba(247, 198, 212, 0.55)',
        },
        settings: { appearance: 'light', wallpaper: true, wallpaperBlur: 10, wallpaperDim: 16 },
        flags: {},
    },
    {
        name: 'sky',
        label: '天蓝 Sky',
        swatch: ['#8fd3f4', '#ffffff'],
        tokens: {
            '--imsg-bubble-out': '#8fd3f4',
            '--imsg-bubble-out-fg': '#0c3b4e',
            '--imsg-bubble-in': '#ffffff',
            '--imsg-bubble-in-fg': '#1c1c1e',
            '--imsg-bubble-alpha': '86%',
            '--imsg-bubble-blur': '8px',
            '--imsg-focus': 'rgba(143, 211, 244, 0.55)',
        },
        settings: { appearance: 'light', wallpaper: true, wallpaperBlur: 8, wallpaperDim: 10 },
        flags: {},
    },
    {
        name: 'night',
        label: '夜航 Night',
        swatch: ['#0a84ff', '#2a2a2e'],
        tokens: {
            '--imsg-bubble-out': '#0a84ff',
            '--imsg-bubble-out-fg': '#ffffff',
            '--imsg-bubble-in': '#2a2a2e',
            '--imsg-bubble-in-fg': '#ffffff',
            '--imsg-bubble-alpha': '92%',
            '--imsg-bubble-blur': '12px',
            '--imsg-focus': 'rgba(10, 132, 255, 0.5)',
        },
        settings: { appearance: 'dark', wallpaper: true, wallpaperBlur: 12, wallpaperDim: 42 },
        flags: {},
    },
];

const SECTIONS = [
    {
        id: 'colors', title: 'Colors 颜色', controls: [
            { token: '--imsg-blue', label: 'Accent 强调色', type: 'color', also: ['--imsg-blue-pressed', '--imsg-selected', '--imsg-bubble-out'] },
            { token: '--imsg-window', label: 'Conversation 对话背景', type: 'color' },
            { token: '--imsg-sidebar', label: 'Sidebar 侧边栏', type: 'color' },
            { token: '--imsg-sheet', label: 'Sheets and menus 弹窗和菜单', type: 'color', also: ['--imsg-menu'] },
            { token: '--imsg-fg', label: 'Text 文字', type: 'color' },
            { token: '--imsg-fg-2', label: 'Secondary text 次要文字', type: 'color', also: ['--imsg-label'] },
            { token: '--imsg-line', label: 'Lines 线条', type: 'color', also: ['--imsg-line-strong'] },
            { token: '--imsg-selected', label: 'Selected conversation 选中对话', type: 'color' },
        ],
    },
    {
        id: 'text', title: 'Text 文字', controls: [
            { token: '--imsg-font', label: 'Font 字体', type: 'select', options: FONTS, also: ['--imsg-font-display'] },
            { token: '--imsg-font', label: 'Other font 其他字体', type: 'text', placeholder: '"My Font", sans-serif', also: ['--imsg-font-display'] },
            { token: '--imsg-text-bubble', label: 'Message size 消息字号', type: 'range', min: 11, max: 26, step: 1, unit: 'px' },
            { token: '--imsg-bubble-lh', label: 'Line spacing 行距', type: 'range', min: 1, max: 2, step: 0.02, unit: '' },
            { token: '--imsg-text', label: 'Interface size 界面字号', type: 'range', min: 11, max: 18, step: 1, unit: 'px', also: ['--mainFontSize'] },
        ],
    },
    {
        id: 'shape', title: 'Shape 形状', controls: [
            { token: '--imsg-bubble-radius', label: 'Bubble corners 气泡圆角', type: 'range', min: 0, max: 30, step: 1, unit: 'px' },
            { token: '--imsg-radius-lg', label: 'Panel corners 面板圆角', type: 'range', min: 0, max: 24, step: 1, unit: 'px', also: ['--imsg-radius-md'] },
            { flag: 'noTail', label: 'Hide bubble tails 隐藏气泡尾巴', type: 'toggle' },
            { flag: 'narrowBubbles', label: 'Narrow bubbles 气泡贴文字（关掉宽气泡）', type: 'toggle' },
            {
                flag: 'avatar', label: 'Pictures 头像形状', type: 'select', options: [['', 'Circle 圆形'], ['rounded', 'Rounded square 圆角方形'], ['square', 'Square 方形']],
            },
        ],
    },
    {
        id: 'spacing', title: 'Spacing 间距', controls: [
            { token: '--imsg-mes-gap', label: 'Space between messages 消息间距', type: 'range', min: 0, max: 12, step: 1, unit: 'px' },
            { token: '--imsg-bubble-pad-x', label: 'Bubble padding, sides 气泡水平内边距', type: 'range', min: 6, max: 24, step: 1, unit: 'px' },
            { token: '--imsg-bubble-pad-y', label: 'Bubble padding, top 气泡垂直内边距', type: 'range', min: 3, max: 16, step: 1, unit: 'px' },
            { token: '--imsg-room', label: 'Bubble width 气泡宽度', type: 'range', min: 50, max: 95, step: 1, unit: '%', invert: true, target: '#chat' },
            { token: '--imsg-side-w', label: 'Sidebar width 侧边栏宽度', type: 'range', min: 240, max: 480, step: 10, unit: 'px', wide: true },
        ],
    },
    {
        id: 'layout', title: 'Layout 布局', controls: [
            { setting: 'windowButtons', label: 'Window buttons 窗口按钮', type: 'toggle' },
            { flag: 'hidePins', label: 'Hide pinned conversations 隐藏置顶对话', type: 'toggle' },
            { flag: 'hideSearch', label: 'Hide search 隐藏搜索', type: 'toggle' },
            { flag: 'hidePreviews', label: 'Hide message previews in the list 隐藏消息预览', type: 'toggle' },
            { flag: 'hideVideo', label: 'Hide the video button 隐藏视频按钮', type: 'toggle' },
            { flag: 'hideStamps', label: 'Hide times between messages 隐藏时间戳', type: 'toggle' },
            { flag: 'hideNames', label: 'Hide names in groups 隐藏群组名字', type: 'toggle' },
            { flag: 'hideTapbacks', label: 'Hide tapbacks 隐藏表情回应', type: 'toggle' },
            { flag: 'hideJump', label: 'Hide the jump to latest button 隐藏跳转按钮', type: 'toggle' },
            { setting: 'receipts', label: 'Delivered and Read 已送达和已读', type: 'toggle' },
            { setting: 'typing', label: 'Typing bubble 输入气泡', type: 'toggle' },
        ],
    },
    {
        id: 'messages', title: 'Messages 消息', controls: [
            { token: '--imsg-bubble-out', label: 'Your bubbles 你的气泡', type: 'color' },
            { token: '--imsg-bubble-out-fg', label: 'Your text 你的文字', type: 'color' },
            { token: '--imsg-bubble-in', label: 'Their bubbles 对方气泡', type: 'color' },
            { token: '--imsg-bubble-in-fg', label: 'Their text 对方文字', type: 'color' },
            { token: '--imsg-bubble-alpha', label: 'Bubble opacity 气泡透明度', type: 'range', min: 10, max: 100, step: 1, unit: '%' },
            { token: '--imsg-bubble-blur', label: 'Bubble blur 气泡模糊', type: 'range', min: 0, max: 40, step: 1, unit: 'px' },
            { flag: 'acrylic', label: 'Acrylic glass 亚克力效果', type: 'toggle' },
            { flag: 'bubbleShadow', label: 'Bubble shadow 气泡阴影', type: 'toggle' },
            { setting: 'splitReplies', label: 'Split long replies 分段显示长回复', type: 'toggle' },
            { setting: 'imageLinks', label: 'Show image links as pictures 图片链接显示为图片', type: 'toggle' },
        ],
    },
    {
        id: 'background', title: 'Chat background 聊天背景', controls: [
            { setting: 'wallpaper', label: 'Show the chosen background 显示背景图', type: 'toggle' },
            { run: 'pickBackground', label: 'Choose Background… 选择背景…', type: 'button' },
            { setting: 'wallpaperBlur', label: 'Blur 模糊', type: 'range', min: 0, max: 40, step: 1, unit: 'px' },
            { setting: 'wallpaperDim', label: 'Tint 暗化', type: 'range', min: 0, max: 90, step: 1, unit: '%' },
        ],
    },
    {
        id: 'motion', title: 'Motion 动画', controls: [
            { flag: 'still', label: 'Turn off animations 关闭动画', type: 'toggle' },
            { flag: 'noReveal', label: 'Show split replies all at once 一次显示所有分段', type: 'toggle' },
            { setting: 'sounds', label: 'Sounds 声音', type: 'toggle' },
        ],
    },
    {
        id: 'advanced', title: 'Advanced 高级', controls: [
            { css: true, label: 'Your CSS 自定义CSS', type: 'css' },
        ],
    },
];

const TOKEN_KEYS = new Set(SECTIONS.flatMap((section) => section.controls.filter((c) => c.token).flatMap((c) => [c.token, ...(c.also ?? [])])));
const FLAG_KEYS = new Set(SECTIONS.flatMap((section) => section.controls.filter((c) => c.flag).map((c) => c.flag)));

let options = {
    setSetting: () => {},
    pickBackground: () => {},
};

function state() {
    const settings = getSettings();
    settings.customize ??= {};
    settings.customize.tokens ??= {};
    settings.customize.flags ??= {};
    settings.customize.css ??= '';
    return settings.customize;
}

/** A value safe to put in a CSS declaration: no braces, semicolons or comment marks. */
function clean(value) {
    return String(value ?? '').replace(/[{};<>]|\/\*|\*\//g, '').trim();
}

/** Writes the chosen tokens, switches and CSS into the page. */
export function applyCustomize() {
    if (!isOn()) {
        return;
    }
    const custom = state();
    const tokens = { ...custom.tokens };
    // tokens that follow another unless set themselves
    for (const section of SECTIONS) {
        for (const control of section.controls) {
            if (control.token && control.also && tokens[control.token] !== undefined) {
                for (const key of control.also) {
                    if (custom.tokens[key] === undefined) {
                        tokens[key] = tokens[control.token];
                    }
                }
            }
        }
    }
    const targeted = new Map();
    const wide = [];
    const body = [];
    for (const [key, raw] of Object.entries(tokens)) {
        if (!TOKEN_KEYS.has(key) || raw === '' || raw === undefined) {
            continue;
        }
        const control = SECTIONS.flatMap((s) => s.controls).find((c) => c.token === key);
        const line = `${key}: ${clean(raw)} !important;`;
        if (control?.target) {
            targeted.set(control.target, [...(targeted.get(control.target) ?? []), line]);
        } else if (control?.wide) {
            wide.push(line);
        } else {
            body.push(line);
        }
    }

    const css = [];
    if (body.length) {
        css.push(`body.imessage { ${body.join(' ')} }`);
    }
    for (const [target, lines] of targeted) {
        css.push(`body.imessage ${target} { ${lines.join(' ')} }`);
    }
    if (wide.length) {
        css.push(`@media screen and (min-width: 1001px) { body.imessage { ${wide.join(' ')} } }`);
    }
    // blur, and the acrylic look, go on the bubbles that have a fill of their own
    const blur = parseFloat(tokens['--imsg-bubble-blur']) || 0;
    const acrylic = !!custom.flags.acrylic;
    if (blur > 0 || acrylic) {
        const amount = blur > 0 ? blur : 18;
        const saturate = acrylic ? 1.8 : 1.2;
        css.push(`body.imessage #chat .mes:not(.imsg-split, .imsg-media, .imsg-jumbo) .mes_block, body.imessage #chat .mes .imsg-parts > .imsg-part {
    -webkit-backdrop-filter: blur(${amount}px) saturate(${saturate}); backdrop-filter: blur(${amount}px) saturate(${saturate}); }`);
    }
    // a see-through bubble shows where its tail overlaps it, so glass bubbles go without
    if (blur > 0 || acrylic || (parseFloat(tokens['--imsg-bubble-alpha']) || 100) < 100) {
        css.push('body.imessage #chat .mes :is(.mes_block, .imsg-part)::before { display: none !important; }');
    }
    if (custom.css.trim()) {
        // your own CSS applies only while the theme is on
        css.push(`body.imessage {\n${custom.css.replace(/<\/?style[^>]*>/gi, '')}\n}`);
    }

    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.append(style);
    }
    style.textContent = css.join('\n');

    const classes = document.body.classList;
    for (const flag of FLAG_KEYS) {
        [...classes].filter((name) => name.startsWith(`imsg-c-${flag}`)).forEach((name) => classes.remove(name));
        const value = custom.flags[flag];
        if (value) {
            classes.add(value === true ? `imsg-c-${flag}` : `imsg-c-${flag}-${clean(value)}`);
        }
    }
}

/** A color the browser has worked out, as #rrggbb for the color picker. */
function toHex(color) {
    const match = String(color).match(/rgba?\(([^)]+)\)/);
    if (!match) {
        return /^#[0-9a-f]{6}$/i.test(String(color).trim()) ? String(color).trim() : '#000000';
    }
    const [r, g, b] = match[1].split(/[ ,/]+/).map(Number);
    return `#${[r, g, b].map((n) => Math.round(n || 0).toString(16).padStart(2, '0')).join('')}`;
}

/** What a token is now, from the page, for a control's starting position. */
function currentValue(control) {
    const host = control.target ? document.querySelector(control.target) ?? document.body : document.body;
    const value = getComputedStyle(host).getPropertyValue(control.token).trim();
    if (control.type === 'color') {
        const probe = element('span');
        probe.style.color = value;
        probe.style.display = 'none';
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return toHex(resolved);
    }
    if (control.type === 'range') {
        const number = parseFloat(value);
        if (Number.isNaN(number)) {
            return control.min;
        }
        return control.invert ? 100 - number : number;
    }
    return value;
}

function isSet(control) {
    const custom = state();
    if (control.token) {
        return custom.tokens[control.token] !== undefined;
    }
    if (control.flag) {
        return !!custom.flags[control.flag];
    }
    if (control.css) {
        return !!custom.css.trim();
    }
    return false;
}

function setControl(control, value) {
    const custom = state();
    delete custom.preset;
    if (control.token) {
        if (value === null) {
            delete custom.tokens[control.token];
        } else {
            custom.tokens[control.token] = value;
        }
    } else if (control.flag) {
        if (!value) {
            delete custom.flags[control.flag];
        } else {
            custom.flags[control.flag] = value;
        }
        // glass needs something to see through
        if (control.flag === 'acrylic' && value && custom.tokens['--imsg-bubble-alpha'] === undefined) {
            custom.tokens['--imsg-bubble-alpha'] = '72%';
        }
    } else if (control.css) {
        custom.css = value ?? '';
    }
    applyCustomize();
    saveSettings();
}

function resetSection(section) {
    const custom = state();
    delete custom.preset;
    for (const control of section.controls) {
        if (control.token) {
            delete custom.tokens[control.token];
        } else if (control.flag) {
            delete custom.flags[control.flag];
        } else if (control.css) {
            custom.css = '';
        }
    }
    applyCustomize();
    saveSettings();
}

/** Paints a preset: its own bubble tokens and a couple of settings, then leaves everything else alone. */
function applyPreset(preset) {
    const custom = state();
    for (const key of PRESET_KEYS) {
        delete custom.tokens[key];
    }
    Object.assign(custom.tokens, preset.tokens);
    Object.assign(custom.flags, preset.flags);
    custom.preset = preset.name;

    const settings = getSettings();
    for (const [key, value] of Object.entries(preset.settings ?? {})) {
        options.setSetting(key, value);
    }

    applyCustomize();
    saveSettings();
}

function buildControl(control, refresh) {
    const row = element('div', `imsg-cz-row imsg-cz-${control.type}`);
    const label = element('label', 'imsg-cz-label', t(control.label));
    const id = `imsg-cz-${(control.token || control.flag || control.setting || control.run || 'css').replace(/[^a-z0-9]+/gi, '-').replace(/^-+/, '')}-${control.type}`;
    label.htmlFor = id;
    let input;
    let output = null;
    const settings = getSettings();

    switch (control.type) {
        case 'color': {
            input = element('input');
            input.type = 'color';
            input.value = control.token && state().tokens[control.token] ? toHex(state().tokens[control.token]) : currentValue(control);
            input.addEventListener('input', () => setControl(control, input.value));
            break;
        }
        case 'range': {
            input = element('input');
            input.type = 'range';
            input.min = String(control.min);
            input.max = String(control.max);
            input.step = String(control.step);
            const start = control.setting ? Number(settings[control.setting]) : currentValue(control);
            input.value = String(start);
            output = element('output', 'imsg-cz-value');
            const show = () => { output.textContent = `${input.value}${control.unit}`; };
            show();
            input.addEventListener('input', () => {
                show();
                if (control.setting) {
                    options.setSetting(control.setting, Number(input.value));
                    return;
                }
                const number = Number(input.value);
                setControl(control, `${control.invert ? 100 - number : number}${control.unit}`);
            });
            break;
        }
        case 'select': {
            input = element('select');
            for (const [value, text] of control.options) {
                const option = element('option', '', t(text));
                option.value = value;
                input.append(option);
            }
            input.value = control.token ? (state().tokens[control.token] ?? '') : (state().flags[control.flag] ?? '');
            if (input.selectedIndex < 0) {
                input.value = '';
            }
            input.addEventListener('change', () => {
                setControl(control, input.value === '' ? (control.token ? null : false) : input.value);
                refresh();
            });
            break;
        }
        case 'text': {
            input = element('input', 'text_pole');
            input.type = 'text';
            input.placeholder = control.placeholder ?? '';
            const value = state().tokens[control.token] ?? '';
            input.value = control.options || !FONTS.some(([v]) => v === value) ? value : '';
            input.addEventListener('change', () => {
                setControl(control, input.value.trim() ? input.value.trim() : null);
                refresh();
            });
            break;
        }
        case 'toggle': {
            input = element('input');
            input.type = 'checkbox';
            input.checked = control.setting ? !!settings[control.setting] : !!state().flags[control.flag];
            input.addEventListener('input', () => {
                if (control.setting) {
                    options.setSetting(control.setting, input.checked);
                } else {
                    setControl(control, input.checked);
                }
                refresh();
            });
            break;
        }
        case 'button': {
            input = element('button', 'menu_button', t(control.label));
            input.type = 'button';
            input.addEventListener('click', () => options[control.run]?.());
            label.textContent = '';
            break;
        }
        case 'css': {
            input = element('textarea', 'text_pole');
            input.rows = 8;
            input.spellcheck = false;
            input.placeholder = '#chat .mes .mes_block {\n    border: 1px solid hotpink;\n}';
            input.value = state().css;
            let timer = 0;
            input.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(() => setControl(control, input.value), 300);
            });
            break;
        }
    }
    input.id = id;
    row.append(label, input);
    if (output) {
        row.append(output);
    }
    // a reset for anything that's been changed here
    if (control.token || control.flag || control.css) {
        const reset = element('button', 'imsg-cz-reset');
        reset.type = 'button';
        reset.title = t('Reset 重置');
        reset.setAttribute('aria-label', `${t('Reset 重置')} ${t(control.label)}`);
        reset.hidden = !isSet(control);
        reset.addEventListener('click', () => {
            setControl(control, control.token ? null : (control.css ? '' : false));
            refresh();
        });
        row.append(reset);
    }
    return row;
}

function download(name, text) {
    const link = element('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportCustomize() {
    const custom = state();
    const data = { themeId: THEME_ID, version: VERSION, tokens: custom.tokens, flags: custom.flags, css: custom.css };
    download('imessage-theme.json', JSON.stringify(data, null, 2));
}

function importCustomize(refresh) {
    const input = element('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        try {
            const data = JSON.parse(await file.text());
            if (data?.themeId !== THEME_ID || typeof data.version !== 'number' || data.version > VERSION) {
                throw new Error(t('This file is for another theme or a newer version. 这个文件是其他主题或更新版本的。'));
            }
            const custom = state();
            custom.tokens = Object.fromEntries(Object.entries(data.tokens ?? {}).filter(([key, value]) => TOKEN_KEYS.has(key) && typeof value === 'string'));
            custom.flags = Object.fromEntries(Object.entries(data.flags ?? {}).filter(([key, value]) => FLAG_KEYS.has(key) && (typeof value === 'boolean' || typeof value === 'string')));
            custom.css = typeof data.css === 'string' ? data.css : '';
            applyCustomize();
            saveSettings();
            refresh();
            toastr.success(t('Your customizations are loaded. 自定义设置已加载。'), t('Imported 已导入'));
        } catch (error) {
            toastr.error(String(error.message ?? error), t("Couldn't import 无法导入"));
        }
    });
    input.click();
}

function closePanel() {
    document.getElementById(PANEL_ID)?.remove();
    document.body.classList.remove('imsg-customizing');
}

/** Opens the Customize panel beside the conversation. */
export function openCustomize() {
    if (document.getElementById(PANEL_ID)) {
        return;
    }
    const panel = element('aside');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', t('Customize 自定义'));
    const head = element('header', 'imsg-cz-head');
    const title = element('h2', 'imsg-cz-title', t('Customize 自定义'));
    const done = element('button', 'imsg-cz-done', t('Done 完成'));
    done.type = 'button';
    done.addEventListener('click', closePanel);
    head.append(title, done);
    const body = element('div', 'imsg-cz-body');
    const foot = element('footer', 'imsg-cz-foot');
    panel.append(head, body, foot);

    const open = new Set(['colors', 'messages']);
    const render = () => {
        // keep which sections are open and where the panel was scrolled to
        body.querySelectorAll('details').forEach((details) => (details.open ? open.add(details.dataset.id) : open.delete(details.dataset.id)));
        const scroll = body.scrollTop;
        const bar = element('div', 'imsg-cz-presets');
        bar.append(element('span', 'imsg-cz-presets-title', t('Presets 配色方案')));
        const strip = element('div', 'imsg-cz-presets-strip');
        for (const preset of PRESETS) {
            const chip = element('button', 'imsg-cz-preset');
            chip.type = 'button';
            chip.classList.toggle('is-on', state().preset === preset.name);
            chip.title = t(preset.label.replace(/ [A-Za-z ]+$/, ''));
            const swatch = element('span', 'imsg-cz-swatch');
            for (const color of preset.swatch) {
                const dot = element('i');
                dot.style.background = color;
                swatch.append(dot);
            }
            chip.append(swatch, element('span', 'imsg-cz-preset-name', t(preset.label)));
            chip.addEventListener('click', () => {
                applyPreset(preset);
                render();
            });
            strip.append(chip);
        }
        bar.append(strip);
        body.replaceChildren(bar, ...SECTIONS.map((section) => {
            const details = element('details', 'imsg-cz-section');
            details.dataset.id = section.id;
            details.open = open.has(section.id);
            const summary = element('summary');
            summary.append(element('span', 'imsg-cz-section-title', t(section.title)));
            if (section.controls.some(isSet)) {
                const reset = element('button', 'imsg-cz-section-reset', t('Reset 重置'));
                reset.type = 'button';
                reset.addEventListener('click', (event) => {
                    event.preventDefault();
                    resetSection(section);
                    render();
                });
                summary.append(reset);
            }
            details.append(summary, ...section.controls.map((control) => buildControl(control, render)));
            return details;
        }));
        body.scrollTop = scroll;
    };

    const resetAll = element('button', 'menu_button imsg-cz-reset-all', t('Reset All 全部重置'));
    resetAll.type = 'button';
    resetAll.addEventListener('click', () => {
        const custom = state();
        custom.tokens = {};
        custom.flags = {};
        custom.css = '';
        custom.preset = '';
        applyCustomize();
        saveSettings();
        render();
    });
    const exportButton = element('button', 'menu_button', t('Export 导出'));
    exportButton.type = 'button';
    exportButton.addEventListener('click', exportCustomize);
    const importButton = element('button', 'menu_button', t('Import 导入'));
    importButton.type = 'button';
    importButton.addEventListener('click', () => importCustomize(render));
    foot.append(resetAll, element('span', 'imsg-spacer'), importButton, exportButton);

    render();
    document.body.append(panel);
    document.body.classList.add('imsg-customizing');
    done.focus({ preventScroll: true });
}

export function initCustomize(given) {
    options = { ...options, ...given };
    onStart(applyCustomize);
    onStop(closePanel);
    document.addEventListener('keydown', whenOn((event) => {
        if (event.key === 'Escape' && document.getElementById(PANEL_ID) && !document.querySelector('dialog.popup[open]')
            && !within(event, `#${PANEL_ID} textarea`)) {
            closePanel();
        }
    }));
}