/**
 * DeepSeek Translator Content Script
 * 特性：
 * 1. 0延迟缓存回填 (React/Vue 兼容)
 * 2. 批量 API 请求
 * 3. 动态内容监听 (MutationObserver)
 */

// ==========================================
// 1. 全局状态管理
// ==========================================

// 全局翻译缓存：Map<原文Hash/String, 译文String>
// 使用 Map 获得 O(1) 的读取速度，是 0 延迟滚动的关键
const translationCache = new Map();

// 待处理节点队列 (Set 保证节点不重复添加)
let pendingNodes = new Set();

// 是否已开启翻译模式
let isTranslateEnabled = false;

// 批处理配置
const BATCH_CHAR_LIMIT = 500; // 每批次字符上限
const DEBOUNCE_DELAY = 200;    // 防抖延迟 (ms)
let debounceTimer = null;

// ==========================================
// 2. 核心：DOM 遍历与筛选
// ==========================================

// 忽略的标签和类名
const IGNORE_TAGS = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'];
const IGNORE_CLASSES = ['ds-trans-node', 'ds-original-hidden'];

function shouldTranslate(node) {
  // 必须是文本节点
  if (node.nodeType !== Node.TEXT_NODE) return false;
  
  const content = node.nodeValue.trim();
  // 忽略空文本、纯数字、短符号
  if (content.length < 2 || /^\d+$/.test(content)) return false;

  const parent = node.parentNode;
  if (!parent) return false;

  // 忽略特定标签
  if (IGNORE_TAGS.includes(parent.tagName)) return false;
  
  // 忽略不可见元素 (简单判断，提升性能)
  // 注意：getComputedStyle 比较耗性能，这里作为兜底，主要靠标签过滤
  // if (parent.checkVisibility && !parent.checkVisibility()) return false; // Chrome 105+

  // 检查是否已经处理过 (防止重复插入)
  if (parent.classList.contains('ds-translated-wrapper') || 
      (node.nextSibling && node.nextSibling.classList && node.nextSibling.classList.contains('ds-trans-node'))) {
    return false;
  }

  return true;
}

// 遍历 DOM树 收集节点
function walkDOM(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    if (shouldTranslate(node)) {
      pendingNodes.add(node);
    }
  }
}

// ==========================================
// 3. 核心：Safe DOM 操作 (React/SPA 兼容)
// ==========================================

/**
 * 无损挂载翻译结果
 * 原理：不修改 node.nodeValue，而是在其后插入 <font>，
 * 并通过修改 node.nodeValue 为空字符串但在对象上备份原文本来“隐藏”它。
 * 为什么置空而不是 display:none？
 * 1. 文本节点不能应用 CSS。
 * 2. 给父元素加 wrap 会破坏 React 的 DOM 结构引用。
 * 3. 置空 nodeValue 是对 React 影响最小的方法，React 重新渲染时会把字填回去，
 * 这时我们的 Observer 会再次触发，并瞬间从 Cache 恢复。
 */
function applyTranslation(node, translation) {
  if (!node.parentNode) return; // 节点可能已被移除

  // 1. 检查是否已经有翻译节点跟随 (处理 React 重绘造成的竞态)
  const nextSibling = node.nextSibling;
  if (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.classList.contains('ds-trans-node')) {
    // 如果已有且内容不同，更新它；否则跳过
    if (nextSibling.textContent !== translation) {
        nextSibling.textContent = translation;
    }
    // 确保原文被“隐藏”
    if (node.nodeValue.trim() !== '') {
        node._originalText = node.nodeValue; // 备份
        node.nodeValue = ''; 
    }
    return;
  }

  // 2. 创建翻译节点
  const transNode = document.createElement('font');
  transNode.className = 'ds-trans-node';
  transNode.textContent = translation;

  // 3. 备份原文 (挂载在 DOM 对象上，内存中保留)
  node._originalText = node.nodeValue;

  // 4. 插入翻译节点
  node.parentNode.insertBefore(transNode, node.nextSibling);

  // 5. “隐藏”原文：置空内容
  // 这会让页面布局使用 transNode 的尺寸，实现完美替换
  node.nodeValue = ''; 
  
  // 标记父节点（可选，用于辅助 CSS 或调试）
  // node.parentNode.classList.add('ds-translated-wrapper');
}

// ==========================================
// 4. 批处理与 API 交互
// ==========================================

async function processQueue() {
  if (pendingNodes.size === 0) return;

  // 快照当前队列
  const nodesToProcess = Array.from(pendingNodes);
  pendingNodes.clear();

  // 1. 优先处理缓存命中 (Performance Optimization)
  // 如果内容在 Cache 中，直接应用，不走 API，实现 0 延迟
  const uncachedNodes = [];
  
  nodesToProcess.forEach(node => {
    // 此时 node.nodeValue 可能是空的(如果是重绘恢复)，需要检查备份
    // 但 MutationObserver 捕获的新节点通常是有值的
    const text = node.nodeValue.trim() || node._originalText;
    
    if (!text) return;

    if (translationCache.has(text)) {
      applyTranslation(node, translationCache.get(text));
    } else {
      // 记录需要翻译的节点和对应文本
      node._pendingText = text; 
      uncachedNodes.push(node);
    }
  });

  if (uncachedNodes.length === 0) return;

  // 2. 打包未缓存的文本
  let currentBatchTexts = [];
  let currentBatchNodes = [];
  let charCount = 0;

  // 辅助函数：发送一批
  const sendBatch = async (nodes, texts) => {
    // 去重发送，节省 Token
    const uniqueTexts = [...new Set(texts)];
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: "translate_batch",
        texts: uniqueTexts
      });

      if (response && response.success) {
        const results = response.data; // 假设返回数组 [trans1, trans2...]
        
        // 更新缓存
        uniqueTexts.forEach((text, index) => {
          if (results[index]) {
            translationCache.set(text, results[index]);
          }
        });

        // 应用翻译到节点
        nodes.forEach(node => {
            const text = node._pendingText;
            if (translationCache.has(text)) {
                applyTranslation(node, translationCache.get(text));
            }
        });
      }
    } catch (err) {
      console.error("Batch translate failed", err);
    }
  };

  // 3. 分块逻辑
  for (let i = 0; i < uncachedNodes.length; i++) {
    const node = uncachedNodes[i];
    const text = node._pendingText;

    if (charCount + text.length > BATCH_CHAR_LIMIT) {
      // 发送当前批次
      sendBatch([...currentBatchNodes], [...currentBatchTexts]);
      // 重置
      currentBatchNodes = [];
      currentBatchTexts = [];
      charCount = 0;
    }

    currentBatchNodes.push(node);
    currentBatchTexts.push(text);
    charCount += text.length;
  }

  // 发送剩余批次
  if (currentBatchNodes.length > 0) {
    sendBatch(currentBatchNodes, currentBatchTexts);
  }
}

function processQueueDebounced() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processQueue();
  }, DEBOUNCE_DELAY);
}

// ==========================================
// 5. 初始化与事件监听
// ==========================================

// 监听来自 Popup 的启动命令
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "start_translate") {
    if (isTranslateEnabled) return;
    isTranslateEnabled = true;
    
    // 初次全页扫描
    walkDOM(document.body);
    processQueue();

    // 开启 MutationObserver 监听动态内容 (Infinite Scroll)
    const observer = new MutationObserver((mutations) => {
      let hasTextChanges = false;
      
      mutations.forEach(mutation => {
        // 忽略我们自己插入的节点变化
        if (mutation.target.classList && mutation.target.classList.contains('ds-trans-node')) return;

        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (shouldTranslate(node)) {
              pendingNodes.add(node);
              hasTextChanges = true;
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 如果插入的是元素（如新推文），递归查找内部文本
            walkDOM(node);
            hasTextChanges = true;
          }
        });
      });

      if (hasTextChanges) {
        processQueueDebounced();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log("DeepSeek Translator: Active");
  }
});