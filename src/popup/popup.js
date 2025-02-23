import QRCode from 'qrcode';

class QRCodeManager {
  constructor() {
    this.init();
    this.bindEvents();
  }

  async init() {
    this.linkInput = document.getElementById('linkInput');
    this.generateBtn = document.getElementById('generateBtn');
    this.qrCode = document.getElementById('qrCode');
    this.pinnedList = document.getElementById('pinnedList');
    this.historyList = document.getElementById('historyList');

    await this.loadHistory();
    this.renderHistory();

    // 检查是否有待处理的链接
    const { pendingLink } = await chrome.storage.local.get('pendingLink');
    if (pendingLink) {
      this.linkInput.value = pendingLink;
      this.handleGenerate();
      await chrome.storage.local.remove('pendingLink');
    }
  }

  bindEvents() {
    this.generateBtn.addEventListener('click', () => this.handleGenerate());
    this.linkInput.addEventListener('paste', () => {
      setTimeout(() => this.handleGenerate(), 100);
    });

    // 为历史记录列表添加事件委托
    this.pinnedList.addEventListener('click', (e) => this.handleHistoryAction(e));
    this.historyList.addEventListener('click', (e) => this.handleHistoryAction(e));
  }

  handleHistoryAction(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const item = button.closest('.history-item');
    if (!item) return;

    const url = item.dataset.url;
    const index = this.history.findIndex(h => h.url === url);

    switch (button.dataset.action) {
      case 'pin':
        this.togglePin(index);
        break;
      case 'delete':
        this.deleteItem(index);
        break;
      case 'regenerate':
        this.generateQRCode(url);
        break;
    }
  }

  async handleGenerate() {
    const url = this.linkInput.value.trim();
    if (!url) return;

    await this.generateQRCode(url);
    await this.addToHistory(url);
    this.renderHistory();
  }

  async generateQRCode(url) {
    this.qrCode.innerHTML = '';
    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, url, {
        width: 200,
        margin: 2
      });
      this.qrCode.appendChild(canvas);
    } catch (err) {
      console.error('QR Code generation failed:', err);
      this.qrCode.innerHTML = '<p style="color: red;">生成失败，请重试</p>';
    }
  }

  async addToHistory(url) {
    const history = await this.getHistory();
    const existingIndex = history.findIndex(item => item.url === url);
    
    if (existingIndex !== -1) {
      // 如果链接已存在，更新时间戳，保持置顶状态
      const isPinned = history[existingIndex].isPinned;
      history.splice(existingIndex, 1);
      history.unshift({
        url,
        timestamp: Date.now(),
        isPinned
      });
    } else {
      // 新链接，添加到历史记录开头
      history.unshift({
        url,
        timestamp: Date.now(),
        isPinned: false
      });
    }

    // 限制历史记录数量
    await chrome.storage.local.set({ qrHistory: history.slice(0, 50) });
    await this.loadHistory();
    this.renderHistory();
  }

  async togglePin(index) {
    const history = await this.getHistory();
    const item = history[index];
    
    // 如果是在置顶列表中
    if (item.isPinned) {
      item.isPinned = false;
    } else {
      item.isPinned = true;
    }

    await chrome.storage.local.set({ qrHistory: history });
    await this.loadHistory();
    this.renderHistory();
  }

  async deleteItem(index) {
    const history = await this.getHistory();
    history.splice(index, 1);
    await chrome.storage.local.set({ qrHistory: history });
    this.renderHistory();
  }

  async getHistory() {
    const result = await chrome.storage.local.get('qrHistory');
    return result.qrHistory || [];
  }

  async loadHistory() {
    this.history = await this.getHistory();
  }

  renderHistory() {
    // 分离置顶和非置顶项
    const pinnedItems = this.history.filter(item => item.isPinned);
    const unpinnedItems = this.history.filter(item => !item.isPinned);

    // 按时间排序
    pinnedItems.sort((a, b) => b.timestamp - a.timestamp);
    unpinnedItems.sort((a, b) => b.timestamp - a.timestamp);

    // 渲染到不同的容器
    this.pinnedList.innerHTML = this.renderHistoryItems(pinnedItems);
    this.historyList.innerHTML = this.renderHistoryItems(unpinnedItems);
  }

  renderHistoryItems(items) {
    return items.map(item => `
      <div class="history-item ${item.isPinned ? 'pinned' : ''}" data-url="${item.url}">
        <div class="history-item-content">
          <div class="history-item-url" title="${item.url}">${item.url}</div>
          <div class="history-item-time">${new Date(item.timestamp).toLocaleString()}</div>
        </div>
        <div class="history-item-actions">
          <button class="action-btn" data-action="pin" title="${item.isPinned ? '取消置顶' : '置顶'}">
            ${item.isPinned ? '📌' : '📍'}
          </button>
          <button class="action-btn" data-action="delete" title="删除">
            🗑️
          </button>
          <button class="action-btn" data-action="regenerate" title="重新生成">
            🔄
          </button>
        </div>
      </div>
    `).join('');
  }
}

// 创建实例
const qrManager = new QRCodeManager();