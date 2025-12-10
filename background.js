// background.js

// 限制最大并发请求数，防止触发 API Rate Limit
const MAX_CONCURRENT_REQUESTS = 6;
let activeRequests = 0;
const requestQueue = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate_batch") {
    // 将请求加入队列
    processTranslationRequest(request.texts, sendResponse);
    return true; // 保持消息通道开启以进行异步响应
  }
});

async function processTranslationRequest(texts, sendResponse) {
  // 简单的队列与并发锁逻辑
  const execute = async () => {
    try {
      const result = await callDeepSeekAPI(texts);
      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error("Translation Error:", error);
      sendResponse({ success: false, error: error.message });
    } finally {
      activeRequests--;
      checkQueue(); // 释放位置后检查队列
    }
  };

  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    execute();
  } else {
    requestQueue.push(execute);
  }
}

function checkQueue() {
  if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const nextTask = requestQueue.shift();
    activeRequests++;
    nextTask();
  }
}

// background.js 中的 callDeepSeekAPI 函数内部

async function callDeepSeekAPI(textArray) {
  const { apiKey, model } = await chrome.storage.sync.get(['apiKey', 'model']);
  
  if (!apiKey) throw new Error("API Key not configured");

  // 优化：精简 Prompt，减少 Token 消耗，提升响应速度
  // 核心指令：翻译成中文，保持术语，只返回 JSON 数组
  const systemPrompt = `Translate to Chinese. Keep technical terms. Return ONLY a JSON array of strings.`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(textArray) }
      ],
      temperature: 0, // 设为 0，让模型不做发散，最快速度输出
      stream: false
    })
  });

  // ... 后面的代码保持不变 ...

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  try {
    // 解析返回的内容
    let content = data.choices[0].message.content;
    // 清理可能的 Markdown 代码块标记
    content = content.replace(/```json|```/g, '').trim();
    return JSON.parse(content);
  } catch (e) {
    console.error("JSON Parse Error", e);
    // 降级处理：如果解析失败，返回原文本（避免网页崩溃）
    return textArray;
  }
}