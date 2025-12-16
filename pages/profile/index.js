// pages/profile/index.js
Page({
  data: {},

  onLoad(options) {
    // 页面加载
  },

  // 点击菜单项
  onMenuItemClick(e) {
    const item = e.currentTarget.dataset.item;
    
    if (item === 'about') {
      wx.showModal({
        title: '关于我们',
        content: '银发医靠 (SeniorGuard)\n\n一款专为老年人设计的健康急救小程序，帮助家人制作紧急联系卡，关键时刻能救命。',
        showCancel: false,
        confirmText: '知道了'
      });
    } else if (item === 'contact') {
      wx.showModal({
        title: '联系客服',
        content: '如有问题或建议，请联系客服：\n\n客服电话：400-XXX-XXXX\n工作时间：9:00-18:00',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  }
});

