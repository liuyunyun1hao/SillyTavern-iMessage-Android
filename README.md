# 安卓专属 iMessage 酒馆主题修复版

> 🍁**重要声明：** 这是一个非官方的魔改版。
> 原作者项目地址：[pervertir/SillyTavern-iMessage](https://github.com/pervertir/SillyTavern-iMessage)
> 本仓库旨在修复原版在安卓设备（特别是使用套壳App或 WebView 浏览器时）出现的各种显示异常和交互 Bug，调整代码使其在安卓设备上也接近苹果的 iMessage 。

🍁由 Claude Opus 4.5、DeepSeek R1 以及120131-yu倾情奉献。

## 🎨 新增：一键主题方案（Customize 里）

打开 **扩展设置 → iMessage Theme → Customize 自定义**，最上面多了一排主题卡：

| 方案 | 你的气泡 | 对方气泡 | 说明 |
| --- | --- | --- | --- |
| 经典蓝 Classic | `#0A84FF` 白字 | 浅灰 | iOS 原版 |
| 柔粉 Blush | `#F7C6D4` 深玫字 | 灰粉 | 截图那种粉白手机感，自动开启背景图 + 半透明气泡 |
| 天蓝 Sky | `#8FD3F4` 深青字 | 白 | 清透、像午后 |
| 夜航 Night | `#0A84FF` | 深灰 | 自动切深色 + 背景图压暗 |
| 液态玻璃 | 纯白实色 + 黑字 | 深炭灰实色 + 白字 | iOS 26 风格：全屏壁纸、实色高对比气泡，只有顶栏按钮/名字胶囊/输入条是玻璃 |
| 液态玻璃·浅色 | 纯白实色 + 黑字 | 深炭灰实色 + 白字 | 同一套构图，浅色玻璃控件与更亮的壁纸 |

点一下即刻生效。方案会重置气泡配色、圆角、字号与间距，以及壁纸的模糊/暗化；字体、界面字号和界面色保持你自己的设置。手动再改任一气泡颜色，方案高亮会自动取消。液态玻璃方案的顶栏与输入条玻璃是方案自带的，不额外占用「Messages 消息」里的开关。

## 🎃核心修复内容（真机实测）

### 🎃🎃 输入框彻底重构
1. 彻底解决安卓端输入框上半截被莫名切掉的问题。
2. 把变扁的发送键重写成了完美的正圆形、浅蓝灰底色。
3. 在输入框左侧重构了一个独立的加号，点击呼出聊天选项；扩展菜单仍可从聊天右上角的 ⓘ → 应用… 打开。
4. 去掉点击时自带的奇怪蓝框以及右下角的 `//` 拖拽手柄残留。
5. 重写输入框代码使其更有苹果简洁对称风格，抬升输入框使其不会被手机底部圆角遮挡。

### 🎃🎃 聊天气泡的深度微调（仿苹果 iOS 16）
1. 调整气泡的圆角弧度、距屏幕边缘距离、气泡间距离、换行规则。
2. 重新选择了字体，调整字号、字粗细、字间距、行高以及气泡的内边距（字离气泡上下与左右的距离）。

### 🎃🎃 交互逻辑 Bug 修复
1. 彻底解决了原版在安卓套壳环境（WebView）下，因网络拦截或缓存污染所导致的“新建角色卡时的JSON 报错”问题。修正了发送给服务器的部分数据类型，并为列表刷新增加了异常捕获。
2. 原版点击进 Edit 的任意一级，只有 Done 键无返回键，Done 会直接关掉整个面板，而安卓手机的屏幕右滑是直接退出整个网页。现在修复为正常的逐级返回。
3. 修复触摸穿透，解决了点击消息弹出的操作栏瞬间消失的 Bug。
4. 修复滚动 Bug，删除了原版在安卓上使用后会使屏幕乱闪的“一键划到对话底部”悬浮按钮，改为每次进入对话自动滚动到最新消息。
5. 去掉了酒馆自带的粗黑滚动条。
6. 关闭 Emoji 渲染，优化了安卓端的性能。
### 🎃🎃 中文适配
1. 在原作者纯英文的基础上，手动加入了中文翻译，实现了中英双语显示（要关掉酒馆那个自带的难用中文翻译）。

### 🎃🎃 视觉与色彩
1. 将全局强调色改为了深紫色，气泡和按键颜色重新进行了选择（原作者设置了可在主题内自由调整为喜欢的颜色）。

## 🍁 安装说明

### 方式一：Git URL 一键安装（推荐）

1. 打开酒馆：**扩展（积木图标）→ 安装扩展**。
2. 在「输入扩展程序的 Git URL」里粘贴：

   ```
   https://github.com/liuyunyun1hao/SillyTavern-iMessage-Android
   ```

3. 「分支或标签名」留空（默认 `main`），点 **只给我安装**（或「给所有人安装」）。
4. 安装完成后刷新酒馆，在扩展菜单里勾选 **iMessage Theme** 即可。

后续升级：扩展菜单里点该扩展的 **更新**，或重复上面的地址重新安装。

### 方式二：手动解压

1. 下载最新的 `.zip` 压缩包。
2. 解压得到 `SillyTavern-iMessage-Android` 文件夹（仓库根目录就是扩展本体）。
3. 将它放入酒馆目录：`data/default-user/extensions/third-party/`。
4. 刷新酒馆，在扩展菜单中开启 `iMessage Theme` 即可。

> 🍁🍁 **注意：** 千万别套娃！点进扩展文件夹必须直接看到 `manifest.json`、`css`、`src` 和 `index.js`。

🚫**纯免费分享，严禁倒卖！**

---

# iMessage Theme for SillyTavern - Android Exclusive Fix

> 🍁**Important Notice:** This is an UNOFFICIAL modified fork.
> Original project repository: [pervertir/SillyTavern-iMessage](https://github.com/pervertir/SillyTavern-iMessage)
> This repository aims to fix various display anomalies and interaction bugs in the original version on Android devices (especially when using shell apps or WebView browsers), adjusting the code to make it closer to Apple's iMessage on Android as well.

🍁Proudly crafted with Claude Opus 4.5, DeepSeek R1, and the author.

## 🎃 Core Fixes (Real Device Tested)

### 🎃🎃 Complete Input Box Reconstruction
1. Completely fixed the issue where the top half of the input box was strangely cut off on Android.
2. Rewrote the flattened send button into a perfect circle with a light blue-gray background.
3. Reconstructed an independent plus button on the left side of the input box, which can be clicked to call out the extension menu.
4. Removed the weird blue focus outline when clicking and the `//` drag handle residue in the bottom right corner.
5. Rewrote the input box code to make it more Apple-like, simple, and symmetrical, and raised the input box so it won't be blocked by the rounded corners at the bottom of the phone.

### 🎃🎃 Deep Fine-Tuning of Chat Bubbles (Imitating Apple iOS 16)
1. Adjusted the bubble's corner radius, distance from the screen edge, distance between bubbles, and text wrapping rules.
2. Reselected the font, adjusted the font size, font weight, letter spacing, line height, and the inner padding of the bubble (the distance between the text and the top/bottom/left/right of the bubble).

### 🎃🎃 Interaction Logic & Bug Fixes
1. Completely fixed the "JSON error when creating a new character card" issue in the original version under Android wrapper environments (WebView), which was caused by network interception or cache pollution. Corrected some data types sent to the server and added exception handling for list refreshing.
2. In the original version, clicking into any level of Edit only had a "Done" button but no "Back" button. "Done" would directly close the entire panel, and swiping right on Android would exit the whole page. Now fixed for proper step-by-step back navigation.
3. Fixed touch-through issues and resolved the bug where the action bar instantly disappeared when tapping a message.
4. Fixed scrolling bugs. Removed the "jump to bottom" floating button from the original version (which caused screen flickering on Android), and replaced it with automatically scrolling to the latest message when entering a chat.
5. Removed the default thick black scrollbar from SillyTavern.
6. Disabled Emoji rendering to optimize Android performance.

### 🎃🎃 Chinese Localization
1. Based on the original author's pure English version, manually added Chinese translations to achieve bilingual (Chinese/English) display (Make sure to turn off the hard-to-use built-in Chinese translation in SillyTavern).

### 🎃🎃 Visuals & Colors
1. Changed the global accent color to a deep purple, and reselected the colors for bubbles and buttons (The original author designed it so users can freely adjust to their favorite colors within the theme).

## 🍁 Installation Instructions

### Option A: install from the Git URL (recommended)

1. Open SillyTavern → **Extensions → Install Extension**.
2. Paste this URL:

   ```
   https://github.com/liuyunyun1hao/SillyTavern-iMessage-Android
   ```

3. Leave the branch field empty (defaults to `main`), then click **Install just for me** (or **Install for all users**).
4. Refresh SillyTavern and enable `iMessage Theme` in the extensions menu.

To upgrade later, use the extension's **Update** button.

### Option B: manual zip

1. Download the latest `.zip` archive.
2. Extract it to get the `SillyTavern-iMessage-Android` folder (the repository root IS the extension).
3. Place it into the SillyTavern directory: `data/default-user/extensions/third-party/`.
4. Refresh SillyTavern and enable `iMessage Theme` in the extensions menu.

> 🍁🍁 **Warning:** Do NOT nest the folders! When you click into the extension folder, you must directly see the `manifest.json`, `css`, `src`, and `index.js`.

🚫**Completely free to share, strictly prohibited from reselling!**

