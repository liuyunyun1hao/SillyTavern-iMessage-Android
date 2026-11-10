# 安卓专属 iMessage 酒馆主题修复版

> 🍁**重要声明：** 这是一个非官方的魔改版。
> 原作者项目地址：[pervertir/SillyTavern-iMessage](https://github.com/pervertir/SillyTavern-iMessage)
> 本仓库旨在修复原版在安卓设备（特别是使用套壳App或 WebView 浏览器时）出现的各种显示异常和交互 Bug，调整代码使其在安卓设备上也接近苹果的 iMessage 。

🍁由 Claude Opus 4.5、DeepSeek R1 以及120131-yu倾情奉献。

## 🆕 v1.2.0 三个一级页面的视觉系统统一

- **页头同一套规范**：动作行（44px，右上角）→ 34px/700 大标题 → 搜索框（36px 高、10px 圆角）。聊天「信息」、联系人「联系人」、我的「我的」标题现在字号、字重、基线、左右边距完全一致；联系人页从原来的居中 17px 小标题改成大标题，「我的」的「编辑」从标题行移到动作行。
- **动作按钮统一**：聊天写信、联系人 A–Z / 加号都变成 32px 的圆角按钮/胶囊，同一描边与底色；「编辑」保持文字按钮。
- **搜索框统一**：尺寸、圆角、底色、图标大小与聊天页一致（原联系人搜索是 38px 高、12px 圆角、白色描边风格）。
- **列表排版统一**：联系人名字 17px/600；分组标题 13px/500 浅灰；「我的」标签 17px；单行列表行高 64px（聊天两行 76px）。
- **卡片圆角统一**：联系人卡片与「我的」分组卡片都用 14px；联系人卡片左右边距从 12px 对齐到 16px，与搜索框同一条边线。
- **页面归属明确**：聊天是白色消息列表；联系人与我的都是分组灰底列表（iOS 的 Messages / Contacts / Settings 分工），不再出现三种不同的页头风格。

## 🆕 v1.1.2 三个页面底部表现统一

v1.1.0 给联系人页加过一条底部渐隐（为了藏住底栏边上被截断的行），结果联系人页的内容会在底栏一半的位置「消失」，而「我的」是内容从底栏后面穿过去，两页看起来不一样。现在这条渐隐已删除，三个页面的滚动区底部留白统一为同一数值（约 `底栏高度 + 12px`），最后一行都能完整滚到胶囊底栏之上，不再有「一半开始消失」的观感。

## 🆕 v1.1.1 三个一级页面切换完全一致

「我的」页原来带 0.26s 的淡入 + 6px 上移动画（`.imsg-me` 上的 `imsg-g26-page`），而聊天和联系人没有，所以切到「我的」时会感觉像另一套弹窗。现在这条动画已移除，三个页面都是瞬时切换、没有位移或淡入。

## 🆕 v1.1.0 三导航统一：联系人是第三个一级页面

- **手机端**：聊天 / 联系人 / 我的 现在是三个**常驻一级页面**，点底栏瞬时切换，不再有联系人「从下往上弹」的效果；联系人页首次创建后不再销毁，搜索、排序、标签筛选、列表滚动、选中联系人都能保留。
- **联系人弹窗没有删除**：聊天页名片、新消息选择器、我的名片仍然走原来的二级弹窗/选择器/sheet；二级界面打开时统一隐藏底栏，关闭后恢复。
- **底栏只有一条**：`#imsg-tabbar` 永远直接挂在 `document.body` 下，删除了把底栏搬进联系人窗口的整套逻辑。
- **统一 Overlay 管理**：弹窗、选择器、sheet、设置/扩展/背景/世界书面板、美化抽屉都用唯一 token 注册；嵌套关闭不会提前把底栏放出来，主题关闭时注册表清零。
- **返回键逐层退出**：联系人页 → 返回=聊天；联系人详情 → 返回=列表；我的名片 → 返回=原页面。历史条目带唯一 id，程序化关闭不会被误当成用户返回。
- **桌面端保持原样**：应用菜单「联系人」仍打开双栏弹窗，不注入联系人页面。
- 顺带修正美化抽屉层级（3050 → 5100），从「扩展」面板打开时不再被面板盖住。

## 🆕 v1.0.8 修复：加号在重建/被覆盖的发送栏上也能用

v1.0.7 把加号改成开主题自己的菜单，但仍然把监听挂在 `#leftSendForm` 这个节点上。有些整合包/扩展会在启动后重建发送栏，旧节点上的监听随之消失，看起来还是「点了没反应」。

现在监听挂在 `document` 上，用坐标判断这一下是否落在加号范围内，并同时接 `pointerup / touchend / click` 三条通道，节点被换掉、或被别的层盖住都照样有效。另外「我的」页版本号改为读取**实际加载的 JS 常量**，版本显示不会再被浏览器缓存骗到。

## 🆕 v1.0.7（已被 v1.0.8 取代）


加号原来是把酒馆原生的 `#options_button` 透明盖在上面，靠酒馆自己开菜单。但酒馆的菜单有「点完按钮后按 `:hover / :focus` 判断要不要收起」的逻辑，部分安卓浏览器/套壳 WebView 触摸后不保留 `:hover`，同一次点击里菜单刚打开就被收起，看起来就是「点了没反应」；而且这条链路一旦哪一环变了，加号就彻底失效。

现在加号不再经过酒馆的原生按钮：点它直接打开主题自己的菜单，内容就是右上角 ⓘ →「聊天选项…」里的同一份（作者注释、CFG 缩放、Token 概率、对话历史、删除消息……），点空白处收起、再点加号关闭。`pointerup` + `click` 双通道，矮屏上菜单会自动滚动，不会顶出屏幕。

## 🆕 v1.0.6 修复：加号点击被酒馆的 document 监听收起（已被 v1.0.7 取代）

## 🆕 v1.0.5 修复与打磨（真机 + 无头浏览器回归）

这一轮做的是「整个项目再看一遍」，重点修掉容易被当成「页面坏了」的显示问题，并补上交互上的死角：

- **玻璃在关闭模糊时会「透视」**：酒馆的快速 UI 模式会给页面加 `no-blur` 并强制关掉所有 `backdrop-filter`，原来是半透明的面板就变成一层透明膜 —— 「我的」页透出下面的聊天列表、名片弹窗透出设置行，看起来像重影。现在在没有模糊（或浏览器不支持 `backdrop-filter`）时，这些表面自动换成同色系的不透明底色，玻璃质感保留，字不再互相打架。
- **「我的」页不再是半透明浮层**：它盖住的是聊天列表/对话，透出上一页只会变成脏影；现在用不透明的分组底色，卡片仍是玻璃。
- **选中行看不清**：浅灰选中底配了白字。现在选中行用正常文字色，备注用次要文字色。
- **分组标题像灰条**：设置 / 扩展 / 世界书 / 背景里的分组标题原来为了吸顶垫了一条灰底，现在改成 iOS 那样的小字标题，不再是一整条。
- **「我的名片」弹窗拉满全高**：内容只有半屏，下面却空一大块。现在按内容高度居中显示。
- **桌面端「单个版本」的 ‹ › 空箭头**：没有可翻的版本时不再显示两个孤零零的箭头。
- **「美化」抽屉**：手机上是真正的底部抽屉，加了可点的遮罩，点空白处收起；标题居中。
- **名片里的长按钮名**（「锁定本对话」）不再换行压到图标上。
- 成员列表去掉套一层的小圆角卡片。
- **补上了深层页面关不掉的死角**：扩展详情、背景图片网格现在右上角都有「完成」，不用先退回上一级再关。
- 补全中文化：群组编辑里的「谁来说话」「提示词里的角色卡」、四种发言策略、三种角色卡模式、「静音 / 添加照片 / 展开」等。
- 联系人搜索加了去抖（角色多时不再每敲一个字就重建整个列表），搜索时列表自动回到顶部；排序（A–Z / 最近）会记住上次的选择；手机上被名片盖住的列表不再能 Tab / 点到。
- 输入框聚焦时的蓝色粗描边改成细一圈的柔光环。

> 回归方式：本地起一份 SillyTavern 1.19，装本扩展，在 390×844 / 360×640 / 430×932 三种手机尺寸和桌面 1280×800 下逐页截图检查；开关主题跑仓库自带的 `tests/leak-check.js`（无残留、无报错）。暗色、壁纸、无模糊三种模式都过了一遍。

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

## 🆕 v1.0.5 fixes and polish

- **Glass without blur no longer turns into a window**: ST's Fast UI (`body.no-blur`) strips every `backdrop-filter`, which used to leave translucent panes see-through ("Me" showing the chat list, the My Card sheet showing rows behind it). Opaque tints of the same colours now stand in when blur is off or unsupported.
- The **Me** tab and the **My Card sheet** are sized and coloured as real surfaces now (no ghost text, content-height sheet).
- Readable **selected rows** (light grey fill no longer forces white text), plain **group titles** instead of grey bars, no full-height empty sheet, no stray ‹ › for single-version messages, a proper **bottom sheet** for Customize (with a tappable scrim), long action labels no longer overflow, and **Done** is reachable from deep pages (extension details, background grid).
- More Chinese coverage (group reply strategy, Mute, Add Photo, Show more…), debounced contacts search that jumps back to the top, remembered sort order, covered lists marked `inert`, and a softer focus ring on inputs.

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

