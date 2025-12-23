// pages/guide/list/index.js

const app = getApp();

Page({
  data: {
    list: []
  },

  onLoad(options) {
    // 从全局数据获取急救指南列表
    this.setData({
      list: app.globalData.firstAidData
    });
  },

  // 跳转到详情页
  toDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/guide/detail/index?id=${id}`
    });
  }
});

