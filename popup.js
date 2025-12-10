// popup.js

// 1. 初始化：打开弹窗时加载已保存的设置
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey', 'model'], (items) => {
    if (items.apiKey) {
      document.getElementById('apiKey').value = items.apiKey;
    }
    if (items.model) {
      document.getElementById('model').value = items.model;
    }
  });
});

// 2. 保存配置功能
document.getElementById('btn-save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('model').value;
  const status = document.getElementById('status');

  if (!apiKey) {
    status.textContent = "请输入 API Key";
    status.classList.add('error');
    return;
  }

  // 保存到 Chrome 存储
  chrome.storage.sync.set({ apiKey, model }, () => {
    status.textContent = "配置已保存！";
    status.classList.remove('error');
    
    // 2秒后清除提示
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  });
});

// 3. 开始翻译功能
document.getElementById('btn-translate').addEventListener('click', async () => {
  const status = document.getElementById('status');
  
  // 先检查是否有 API Key
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);
  
  if (!apiKey) {
    status.textContent = "请先保存 API Key！";
    status.classList.add('error');
    return;
  }

  // 获取当前激活的标签页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    try {
      // 发送消息给 contentScript
      await chrome.tabs.sendMessage(tab.id, { action: "start_translate" });
      // 发送成功后关闭弹窗
      window.close();
    } catch (err) {
      // 如果报错，通常是因为 contentScript 还没注入（比如在 Chrome 设置页或空白页）
      status.textContent = "无法在当前页面运行";
      status.classList.add('error');
      console.error(err);
    }
  }
});