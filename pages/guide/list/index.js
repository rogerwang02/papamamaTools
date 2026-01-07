// pages/guide/list/index.js

const app = getApp();

Page({
  data: {
    isElderMode: false, // 长辈模式状态
    list: []
  },

  onLoad(options) {
    // 初始化主题模式
    this.setThemeClass();
    // 从全局数据获取急救指南列表
    this.setData({
      list: app.globalData.firstAidData
    });
  },

  onShow() {
    // 更新主题模式
    this.setThemeClass();
  },

  // 设置主题class到页面根元素
  setThemeClass() {
    const isElder = app.globalData.isElderMode || false;
    this.setData({ isElderMode: isElder });
  },

  // 跳转到详情页
  toDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/guide/detail/index?id=${id}`
    });
  }
});

