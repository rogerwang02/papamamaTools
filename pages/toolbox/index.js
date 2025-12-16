// pages/toolbox/index.js
Page({
  data: {},

  onLoad(options) {
    // 页面加载
  },

  // 点击工具
  onToolClick(e) {
    const tool = e.currentTarget.dataset.tool;
    const toolNames = {
      torch: '大字手电筒',
      hospital: '医院导航',
      medicine: '药品提醒'
    };

    wx.showToast({
      title: toolNames[tool] + '功能开发中',
      icon: 'none',
      duration: 2000
    });
  }
});

