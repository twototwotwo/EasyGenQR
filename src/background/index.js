let lastCheckedText = '';

// 检查是否是有效的链接
function isValidUrl(text) {
  // 检查是否是标准 URL
  try {
    new URL(text);
    return true;
  } catch (e) {
    // 如果不是标准 URL，检查是否是自定义协议
    const customProtocolRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/.+/;
    return customProtocolRegex.test(text);
  }
}

// 使用 chrome.tabs API 来执行剪贴板读取
async function checkClipboard() {
  try {
    // 获取当前活动标签
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url.startsWith('http')) return; // 确保是有效的网页

    // 在当前标签页中执行剪贴板读取
    if (tab.url.startsWith('chrome://')) {
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return navigator.clipboard.readText().catch(() => null);
      }
    });

    const text = results?.[0]?.result;
    
    if (text && text !== lastCheckedText && isValidUrl(text)) {
      lastCheckedText = text;
      showNotification(text);
    }
  } catch (error) {
    console.error('Failed to read clipboard:', error);
  }
}

function showNotification(text) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon48.svg',
    title: '检测到链接',
    message: '是否需要生成二维码？',
    buttons: [{ title: '生成二维码' }],
    requireInteraction: true
  });

  // 保存当前链接
  chrome.storage.local.set({ pendingLink: text });
}

// 监听通知按钮点击
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.action.openPopup();
  }
});

// 定期检查剪贴板
setInterval(checkClipboard, 2000); 