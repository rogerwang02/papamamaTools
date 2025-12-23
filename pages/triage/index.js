// pages/triage/index.js

Page({
  data: {
    inputText: '',
    loading: false,
    result: null,
    canAnalyze: false
  },

  onInput(e) {
    const value = e.detail.value || '';
    this.setData({ 
      inputText: value,
      canAnalyze: value.trim().length > 0
    });
  },

  async onAnalyze() {
    if (!this.data.inputText.trim()) return;

    this.setData({ loading: true, result: null });

    wx.cloud.callFunction({
      name: 'aiTriage',
      data: { symptoms: this.data.inputText }
    }).then(res => {
      this.setData({ loading: false });
      console.log('云函数响应:', res);
      if (res.result && res.result.success) {
        this.setData({ result: res.result.data });
      } else {
        const errorMsg = res.result?.error || '分析失败，请重试';
        const errorDetail = res.result?.detail || '';
        console.error('云函数返回错误:', res.result);
        console.error('错误详情:', errorDetail);
        
        let content = errorMsg;
        if (errorDetail) {
          content += '\n\n错误详情：\n' + errorDetail;
        }
        content += '\n\n请检查：\n1. 网络连接\n2. API Key 是否正确\n3. 云函数日志';
        
        wx.showModal({
          title: '分析失败',
          content: content,
          showCancel: false,
          confirmText: '知道了'
        });
      }
    }).catch(err => {
      console.error('调用云函数失败:', err);
      this.setData({ loading: false });
      wx.showModal({
        title: '网络错误',
        content: '调用云函数失败：' + (err.errMsg || err.message || '未知错误') + '\n\n请检查：\n1. 云函数是否已部署\n2. 云函数依赖是否已安装',
        showCancel: false,
        confirmText: '知道了'
      });
    });
  }
});

