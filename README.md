# 安卓专属 iMessage 酒馆主题修复版

> 🍁**重要声明：** 这是一个非官方的魔改版。
> 原作者项目地址：[pervertir/SillyTavern-iMessage](https://github.com/pervertir/SillyTavern-iMessage)
> 本仓库旨在修复原版在安卓设备（特别是使用套壳App或 WebView 浏览器时）出现的各种显示异常和交互 Bug，调整代码使其在安卓设备上也接近苹果的 iMessage 。

🍁由 Claude Opus 4.5、DeepSeek R1 以及120131-yu倾情奉献。

## 🎨 新增：一键配色方案（Customize 里）

打开 **扩展设置 → iMessage Theme → Customize 自定义**，最上面多了一排配色卡：

| 方案 | 你的气泡 | 对方气泡 | 说明 |
| --- | --- | --- | --- |
| 经典蓝 Classic | `#0A84FF` 白字 | 浅灰 | iOS 原版 |
| 柔粉 Blush | `#F7C6D4` 深玫字 | 灰粉 | 截图那种粉白手机感，自动开启背景图 + 半透明气泡 |
| 天蓝 Sky | `#8FD3F4` 深青字 | 白 | 清透、像午后 |
| 夜航 Night | `#0A84FF` | 深灰 | 自动切深色 + 背景图压暗 |

点一下即刻生效，四个预设只改气泡和壁纸相关的那几个变量，不动你自己调过的字号、字体和界面色；手动再改任一气泡颜色，预设高亮会自动取消。

## 🎃核心修复内容（真机实测）

### 🎃🎃 输入框彻底重构
1. 彻底解决安卓端输入框上半截被莫名切掉的问题。
2. 把变扁的发送键重写成了完美的正圆形、浅蓝灰底色。
3. 在输入框左侧重构了一个独立的加号，点击可呼出扩展菜单。
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
1. 下载最新的 `.zip` 压缩包。
2. 解压得到 `SillyTavern-iMessage` 文件夹。
3. 将它放入酒馆目录：`data/default-user/extensions/third-party/`。
4. 刷新酒馆，在扩展菜单中开启 `iMessage Theme` 即可。

> 🍁🍁 **注意：** 千万别套娃！点进 `SillyTavern-iMessage` 文件夹必须直接看到 `css`、`src` 和 `index.js`。

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
1. Download the latest `.zip` archive.
2. Extract it to get the `SillyTavern-iMessage` folder.
3. Place it into the SillyTavern directory: `data/default-user/extensions/third-party/`.
4. Refresh SillyTavern and enable `iMessage Theme` in the extensions menu.

> 🍁🍁 **Warning:** Do NOT nest the folders! When you click into the `SillyTavern-iMessage` folder, you must directly see the `css`, `src`, and `index.js`.

🚫**Completely free to share, strictly prohibited from reselling!**

