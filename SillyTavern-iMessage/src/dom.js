// Small helpers shared by the theme's modules.

/** Below this width the theme uses its phone layout (keep in step with css/mobile.css). */
export const PHONE_QUERY = '(max-width: 1000px)';

export function context() {
    return SillyTavern.getContext();
}


/** 主题自己写死、酒馆自带翻译又没覆盖到的英文短标签。先查这张表，避免 "New" 被译成 "最新"。 */
const LABELS = {
    'A contact needs a name.': '联系人需要一个名字。',
    'A persona needs a name.': '人设需要一个名字。',
    'About Me': '关于我',
    'Add a First Message': '添加开场白',
    'Add at least one member.': '至少添加一名成员。',
    'Add Photos': '添加图片',
    'Add someone…': '添加成员…',
    'Add': '添加',
    'Advanced': '高级',
    'Always': '始终',
    'Backgrounds': '背景',
    'Built In': '内置',
    'Cancel': '取消',
    'Reset': '重置',
    'Character': '角色',
    'Click a picture to use it everywhere. Right-click for more.': '点击图片全局使用，右键查看更多选项。',
    'Click a picture to use it.': '点击图片使用。',
    'Contacts': '联系人',
    'Messages': '信息',
    'Reset all customization?': '重置全部自定义设置？',
    "Colors, spacing, switches and your own CSS go back to the theme's defaults. This can't be undone.": '颜色、间距、开关和自定义 CSS 都会恢复为主题默认值，此操作无法撤销。',

    'Content': '内容',
    'Conversations': '对话',
    'Could not delete that conversation. See the console for details.': '无法删除该对话，详情见控制台。',
    'Could not open that conversation. See the console for details.': '无法打开该对话，详情见控制台。',
    'Couldn’t change Favorites': '无法更改收藏',
    'Couldn’t import': '导入失败',
    'Couldn’t save the group': '无法保存群组',
    'Couldn’t save': '无法保存',
    'Create': '新建',
    'Default': '默认',
    'Delete Persona…': '删除人设…',
    'Delete this conversation?': '删除此对话？',
    'Delete these conversations?': '删除这些对话？',
    'Delete this entry?': '删除此条目？',
    'Delete with Conversations': '连同对话一起删除',
    'Delete': '删除',
    'Delivered': '已送达',
    'Done': '完成',
    'Edit Contact': '编辑联系人',
    'Edit Group': '编辑群组',
    'Edit My Card': '编辑我的名片',
    'Edit': '编辑',
    'Entry': '条目',
    'Every chat': '所有对话',
    'Extensions': '扩展',
    'Favorites': '收藏',
    'Folders': '文件夹',
    'Group Name': '群组名称',
    'Groups': '群组',
    'Group': '群组',
    'Image': '图片',
    'Images': '张图片',
    'Import from File…': '从文件导入…',
    'Import from Link…': '从链接导入…',
    'In Use': '使用中',
    'In use': '使用中',
    'Index': '索引',
    'Let someone answer themselves': '让对方自己回复',
    'Library': '媒体库',
    'Lock to Chat': '锁定到当前对话',
    'Manage Extensions': '管理扩展',
    'Me': '我',
    'Members': '成员',
    'More': '更多',
    'Move Up': '上移',
    'Muted': '已静音',
    'My Backgrounds': '我的背景',
    'My Card': '我的名片',
    'My Other Cards': '其他名片',
    'Name the new lorebook:': '新世界书名称：',
    'Name': '名字',
    'New Contact': '新建联系人',
    'New Group': '新建群组',
    'New Message': '新信息',
    'New Persona': '新建人设',
    'New': '新建',
    'No Backgrounds': '无背景',
    'No Contact Selected': '未选择联系人',
    'No Contacts': '无联系人',
    'No Conversations': '无对话',
    'No description yet. Edit to tell them who you are.': '还没有简介。编辑一下，告诉大家你是谁。',
    'No Results': '无结果',
    'No pictures for this chat yet': '本对话暂无图片',
    'Open a conversation first.': '请先打开一个对话。',
    'Open a conversation with one character first.': '请先和一个角色开始对话。',
    'Other First Messages': '其他开场白',
    'Photo': '照片',
    'Read': '已读',
    'Replies': '回复',
    'Search Entries': '搜索条目',
    'Search': '搜索',
    'Secondary keywords': '次要关键词',
    'Select an entry': '选择一个条目',
    'Sent as': '发送身份',
    'The card couldn’t be exported.': '无法导出角色卡。',
    'Their conversations stay unless you delete them too. This can’t be undone.': '除非同时删除对话，否则对话会保留。此操作无法撤销。',
    'Their picture and description go too. This can’t be undone.': '头像和简介也会一并删除。此操作无法撤销。',
    'This Chat': '本对话',
    'This chat has its own background.': '本对话有专属背景。',
    'This conversation will be deleted. This can\'t be undone.': '此对话将被删除。此操作无法撤销。',
    'Title (optional)': '标题（可选）',
    'To': '收件人',
    'Today': '今天',
    'Typing': '正在输入',
    'Unlock Chat': '取消对话锁定',
    'Untitled': '未命名',
    'Use': '使用',
    'Waiting in the queue': '排队中',
    'Where it goes': '归属位置',
    'Yesterday': '昨天',
    'You': '你',
    'About': '关于',
    'Description': '描述',
    'Personality': '性格',
    'Scenario': '场景',
    'First Message': '开场白',
    'Example Messages': '示例消息',
    'System Prompt': '系统提示',
    'After the Conversation': '对话后指令',
    'Character’s Note': '角色备注',
    'Creator': '作者',
    'Version': '版本',
    'Message': '发消息',
    'History': '历史',
    'Favorite': '收藏',
    'Delete Group…': '删除群组…',
    'Export as PNG': '导出为 PNG',
    'Export as JSON': '导出为 JSON',
    'Duplicate': '复制',
    'Delete Contact…': '删除联系人…',
    'Talkativeness in Groups': '群聊活跃度',
    'Tags': '标签',
    'Depth': '深度',
    'Title': '标题',
    'A line about them, shown on their card.': '一句话简介，显示在名片上。',
    'Who they are. Always sent with the conversation.': '角色设定，每次对话都会发送。',
    'How they start a new conversation.': '新对话的开场白。',
    'Start each example with <START>.': '每段示例以 <START> 开头。',
    'Used in place of the main prompt, if the connection allows it.': '连接支持时，用它替代主提示词。',
    'Sent after the messages (post-history instructions).': '在消息之后发送（对话后指令）。',
    'Slipped into the conversation a few messages from the end.': '插入到对话末尾前几条消息中。',
    'Separated by commas.': '用逗号分隔。',
    'Shown under your name only.': '只显示在你的名字下方。',
    'Who you are, sent with the conversation.': '你的设定，随对话发送。',
    'How many messages from the end.': '距离对话末尾的消息数。',
    'With the description (in the prompt)': '随描述（在提示词中）',
    'Before the Author’s Note': '作者注之前',
    'After the Author’s Note': '作者注之后',
    'In the conversation, at a depth': '插入对话中（指定深度）',
    'Nowhere (not sent)': '不发送',
    'To: name or group': '收件人：姓名或群组',
    'System': '系统',
    'User': '用户',
    'Assistant': '助手',
};

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
const WORD = /^[A-Za-z][A-Za-z'’&\/.\-…:]*$/;

/**
 * 界面上「English 中文」的双语标签，中文环境下只留中文：'Edit 编辑' → '编辑'。
 * 全大写缩写（API、JSON、PNG）和 iMessage 这类品牌词不动。
 */
function chineseOnly(text) {
    if (typeof text !== 'string' || !CJK.test(text) || text.toLowerCase().includes('imessage')) {
        return text;
    }
    const words = text.split(' ');
    let cut = 0;
    while (cut < words.length) {
        const word = words[cut];
        if (!WORD.test(word) || (word.length > 1 && word === word.toUpperCase())) {
            break;
        }
        cut += 1;
    }
    if (!cut || cut >= words.length) {
        return text;
    }
    const rest = words.slice(cut).join(' ');
    return CJK.test(rest) ? rest : text;
}

export function t(text) {
    if (typeof text === 'string' && Object.hasOwn(LABELS, text)) {
        return LABELS[text];
    }
    return chineseOnly(context().translate(text));
}

/**
 * 酒馆自带表单里有些 <option> / placeholder 没走翻译；只对词典里精确命中的文本替换，
 * 避免动到用户输入或第三方内容。
 */
export function watchNativeLabels() {
    const fix = (node) => {
        if (!(node instanceof Element)) return;
        const targets = [];
        if (node.matches('option')) targets.push(node);
        if (node.matches('input[placeholder], textarea[placeholder]') && !node.value) targets.push(node);
        targets.push(...node.querySelectorAll('option, input[placeholder], textarea[placeholder]'));
        for (const el of targets) {
            const text = (el.tagName === 'OPTION' ? el.textContent : el.placeholder)?.trim();
            if (!text || !Object.hasOwn(LABELS, text)) continue;
            if (el.tagName === 'OPTION') {
                el.textContent = LABELS[text];
            } else {
                el.placeholder = LABELS[text];
            }
        }
    };
    const observer = new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.addedNodes) fix(node);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    fix(document.body);
}

export function isPhone() {
    return window.matchMedia(PHONE_QUERY).matches;
}

export function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text !== undefined) {
        node.textContent = text;
    }
    return node;
}

/** A button with a translated label. */
export function button(className, label, run) {
    const node = element('button', className, label === undefined ? undefined : t(label));
    node.type = 'button';
    if (run) {
        node.addEventListener('click', run);
    }
    return node;
}

/** One of the SF-style symbols defined in css/tokens.css (--imsg-sym-<name>). */
export function glyph(symbol) {
    const node = element('i', 'imsg-sym');
    node.style.setProperty('--imsg-glyph', `var(--imsg-sym-${symbol})`);
    return node;
}

export function escapeHtml(text) {
    const node = element('span');
    node.textContent = text;
    return node.innerHTML;
}

/** Whether a popup or the theme's menu is open, so Esc belongs to it rather than a window. */
export function overlayOpen() {
    return !!document.querySelector('dialog.popup[open]') || document.getElementById('imsg-menu')?.hidden === false;
}

/** Whether a scroller is within `distance` pixels of its bottom. */
export function nearBottom(scroller, distance) {
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < distance;
}

/** Whether an event started inside an element matching `selector`. */
export function within(event, selector) {
    return Boolean(/** @type {Element} */ (event.target).closest?.(selector));
}

/** How wide SillyTavern makes avatar and persona thumbnails (thumbnails.dimensions in its config.yaml) */
const THUMBNAIL_WIDTH = 96;

/**
 * Shows a character's or persona's picture sharp at any size and screen density: the browser takes
 * the small thumbnail while it covers the box, and the original picture once it would be stretched.
 * @param {HTMLImageElement} img
 * @param {'avatar'|'persona'} type
 * @param {string} file The avatar's file name
 * @param {number} size The box's width in CSS pixels
 * @param {number} [phoneSize] Its width in the phone layout, when different
 */
export function setPicture(img, type, file, size, phoneSize = size) {
    const thumbnail = context().getThumbnailUrl(type, file);
    const original = `/${type === 'persona' ? 'User Avatars' : 'characters'}/${encodeURIComponent(file)}`;
    img.src = thumbnail;
    img.sizes = phoneSize === size ? `${size}px` : `${PHONE_QUERY} ${phoneSize}px, ${size}px`;
    // the original's real width doesn't matter, only that it's the larger one
    img.srcset = `${thumbnail} ${THUMBNAIL_WIDTH}w, ${original} ${THUMBNAIL_WIDTH * 8}w`;
    img.addEventListener('error', () => img.removeAttribute('srcset'), { once: true });
}
