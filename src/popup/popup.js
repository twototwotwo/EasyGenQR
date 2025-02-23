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
    this.trashList = document.getElementById('trashList');

    // 获取多语言内容
    this.setLocalizedText();

    await this.loadHistory();
    await this.loadTrash();
    this.renderHistory();
    this.renderTrash();

    // 检查是否有待处理的链接
    const { pendingLink } = await chrome.storage.local.get('pendingLink');
    if (pendingLink) {
      this.linkInput.value = pendingLink;
      this.handleGenerate();
      await chrome.storage.local.remove('pendingLink');
    }
  }

  setLocalizedText() {
    console.log(chrome.i18n.getMessage("linkPlaceholder"));
    document.getElementById('extensionName').textContent = chrome.i18n.getMessage("extensionName");
    document.getElementById('historyTitle').textContent = chrome.i18n.getMessage("history");
    document.getElementById('trashTitle').textContent = chrome.i18n.getMessage("trash");
    document.getElementById('generateBtn').textContent = chrome.i18n.getMessage("generateQRCode");
    document.getElementById('linkInput').placeholder = chrome.i18n.getMessage("linkPlaceholder");
  }

  bindEvents() {
    this.generateBtn.addEventListener('click', () => this.handleGenerate());
    this.linkInput.addEventListener('paste', () => {
      setTimeout(() => this.handleGenerate(), 100);
    });

    // 为历史记录和回收站列表添加事件委托
    this.pinnedList.addEventListener('click', (e) => this.handleHistoryAction(e));
    this.historyList.addEventListener('click', (e) => this.handleHistoryAction(e));
    this.trashList.addEventListener('click', (e) => this.handleTrashAction(e));
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
        this.deleteFromHistory(index);
        break;
      case 'regenerate':
        this.generateQRCode(url);
        break;
    }
  }

  handleTrashAction(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const item = button.closest('.history-item');
    if (!item) return;

    const url = item.dataset.url;
    const index = this.trash.findIndex(h => h.url === url);

    switch (button.dataset.action) {
      case 'restore':
        this.restoreToHistory(index);
        break;
      case 'delete':
        this.deleteFromTrash(index);
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
    this.qrCode.innerHTML = ''; // 清空之前的二维码
    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, url, {
        width: 200,
        margin: 2
      });
      this.qrCode.appendChild(canvas); // 将生成的二维码添加到 DOM
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
    if (!this.history || index < 0 || index >= this.history.length) {
      console.error('Invalid history or index:', this.history, index);
      return; // 退出方法
    }
    const item = this.history[index];
    item.isPinned = !item.isPinned; // 切换置顶状态
  
    await chrome.storage.local.set({ qrHistory: this.history });
    await this.loadHistory();
    this.renderHistory();
  }

  async deleteFromHistory(index) {
    const history = await this.getHistory();
    const deletedItem = history.splice(index, 1)[0]; // 删除项并保存
    await chrome.storage.local.set({ qrHistory: history });
    await this.addToTrash(deletedItem); // 添加到回收站
    await this.loadHistory();
    await this.loadTrash();
    this.renderHistory(); // 更新历史记录 UI
    this.renderTrash(); // 更新回收站 UI
  }

  async addToTrash(item) {
    const trash = await this.getTrash();
    trash.push(item);
    await chrome.storage.local.set({ qrTrash: trash });
  }

  async restoreToHistory(index) {
    const trash = await this.getTrash();
    const restoredItem = trash.splice(index, 1)[0]; // 恢复项并删除
    await chrome.storage.local.set({ qrTrash: trash });
    await this.addToHistory(restoredItem.url); // 重新添加到历史记录
    await this.loadHistory();
    await this.loadTrash();
    this.renderHistory(); // 更新历史记录 UI
    this.renderTrash(); // 更新回收站 UI
  }

  async deleteFromTrash(index) {
    const trash = await this.getTrash();
    trash.splice(index, 1); // 从回收站中删除项
    await chrome.storage.local.set({ qrTrash: trash });
    await this.loadHistory();
    await this.loadTrash();
    this.renderTrash(); // 更新回收站 UI
  }

  async getHistory() {
    const result = await chrome.storage.local.get('qrHistory');
    return result.qrHistory || [];
  }

  async getTrash() {
    const result = await chrome.storage.local.get('qrTrash');
    return result.qrTrash || [];
  }

  async loadHistory() {
    this.history = await this.getHistory();
  }

  async loadTrash() {
    this.trash = await this.getTrash();
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

  renderTrash() {
    this.loadTrash().then(() => {
      this.trashList.innerHTML = this.renderTrashItems(this.trash);
    });
  }

  renderTrashItems(items) {
    return items.map((item, index) => `
      <div class="history-item" data-url="${item.url}">
        <div class="history-item-content">
          <div class="history-item-url" title="${item.url}">${item.url}</div>
          <div class="history-item-time">${new Date(item.timestamp).toLocaleString()}</div>
        </div>
        <div class="history-item-actions">
          <button class="action-btn" data-action="restore" title="恢复">
            🔄
          </button>
          <button class="action-btn" data-action="delete" title="彻底删除">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }
}

// 创建实例
const qrManager = new QRCodeManager();