// options.js
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const model = document.getElementById('model').value;
  chrome.storage.sync.set({ apiKey, model }, () => {
    const status = document.getElementById('status');
    status.textContent = '保存成功！';
    setTimeout(() => status.textContent = '', 2000);
  });
});

// 加载保存的设置
chrome.storage.sync.get(['apiKey', 'model'], (items) => {
  if (items.apiKey) document.getElementById('apiKey').value = items.apiKey;
  if (items.model) document.getElementById('model').value = items.model;
});