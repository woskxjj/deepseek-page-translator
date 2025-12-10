DeepSeek 网页翻译插件 (DeepSeek Web Translator)
基于 DeepSeek V3 API 的高性能 Chrome 浏览器翻译插件，专为 React/Vue 等现代单页应用 (SPA) 设计。

📖 项目简介
这是一个使用原生 JavaScript 开发的 Chrome 扩展，利用 DeepSeek 强大的语言模型能力对网页进行整页翻译。

与传统翻译插件不同，本项目专注于解决 SPA（单页应用） 的翻译难题。它采用非破坏性的 DOM 操作和高性能的并发控制，完美兼容 Twitter (X)、GitHub、YouTube 等动态复杂的网页，确保在翻译的同时不破坏网页原有的交互逻辑。

✨ 核心特性
⚡ 极致性能:

高并发: 同时发起多个 API 请求，大幅缩短长页面翻译时间。

智能缓存: 内存级缓存 (Map)，滚动页面或重绘时瞬间回填译文，0 延迟，0 Token 消耗。

防抖处理: 智能监听 DOM 变化，避免频繁触发翻译导致页面卡顿。

⚛️ SPA 深度兼容:

Safe DOM: 采用 insertBefore 挂载译文，而非直接修改 nodeValue，避免导致 React/Vue 页面崩溃 (Hydration Error)。

动态监听: 使用 MutationObserver 自动检测无限滚动加载的新内容（如 Twitter 时间流）。

🛡️ 高稳定性:

文本分割策略: 摒弃易报错的 JSON 格式，采用纯文本分隔符策略，彻底杜绝 JSON Parse Error。

自动容错: 即使 API 偶尔返回异常数据，插件也能优雅降级，不会报错。

🎨 原生体验:

译文自动继承原网页字体样式与颜色，视觉体验无缝衔接。

🛠️ 安装指南
由于插件尚未发布到 Chrome 商店，需要通过“开发者模式”安装。

下载代码:

Bash

git clone https://github.com/你的用户名/deepseek-chrome-translator.git
打开 Chrome 扩展管理页:

在浏览器地址栏输入: chrome://extensions/

开启开发者模式:

打开右上角的 "开发者模式" (Developer mode) 开关。

加载插件:

点击左上角的 "加载已解压的扩展程序" (Load unpacked)。

选择本项目所在的文件夹。

⚙️ 配置与使用
获取 API Key:

前往 DeepSeek 开放平台 申请 API Key。

配置插件:

点击浏览器右上角的插件图标。

在弹窗中输入 API Key，选择模型（推荐 deepseek-chat）。

点击 "保存配置"。

开始翻译:

打开任意英文网页（推荐测试 GitHub Readme 或 Twitter）。

点击插件图标 -> "开始整页翻译"。

📂 项目结构
Plaintext

├── manifest.json        # 核心配置文件 (Manifest V3)
├── background.js        # 后台服务：负责 API 请求代理与并发控制
├── contentScript.js     # 注入脚本：DOM 解析、缓存管理、UI 渲染
├── popup.html           # 插件弹窗界面
├── popup.js             # 弹窗逻辑：保存配置、发送指令
└── styles.css           # 译文样式定义
❓ 常见问题 (FAQ)
Q: 为什么点击翻译后报错 "Extension context invalidated"? A: 这通常发生在更新或刷新插件后。Chrome 切断了旧页面与新插件后台的连接。请刷新当前网页 (F5)，然后再试一次即可。

Q: 为什么提示 "无法在当前页面运行"? A: Chrome 出于安全考虑，禁止插件在系统页面（如 chrome://settings）或空白页运行。请打开一个正常的网站（如 GitHub, Wikipedia）进行测试。

Q: 翻译会消耗多少 Token? A: 本插件采用纯文本传输，除了正文内容外，每次请求仅消耗极少量的 System Prompt Token。相比 JSON 格式更节省。

🤝 贡献
欢迎提交 Issue 或 Pull Request 来改进这个项目！

Fork 本仓库

新建 Feat_xxx 分支

提交代码

新建 Pull Request

📄 开源协议
MIT License
