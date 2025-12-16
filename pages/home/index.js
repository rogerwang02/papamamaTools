// pages/home/index.js
const db = wx.cloud.database();

Page({
  data: {
    loading: true,
    cardInfo: null,
    reminders: [
      { icon: '💊', text: '记得按时吃药' },
      { icon: '🌡️', text: '天气转凉注意保暖' },
      { icon: '🥗', text: '保持均衡饮食' },
      { icon: '🚶', text: '适度运动有益健康' }
    ]
  },

  onLoad(options) {
    // 页面加载
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadCardData();
  },

  // 格式化病史信息（将所有标点符号和换行统一为逗号，并限制显示长度）
  formatConditions(conditions) {
    if (!conditions || !conditions.trim()) {
      return '';
    }
    // 将所有换行符、分号、顿号等统一替换为逗号
    let formatted = conditions
      .replace(/[\n\r]/g, ',')        // 替换换行符为逗号
      .replace(/[;；、]/g, ',')        // 替换分号、顿号为逗号
      .replace(/[，,]+/g, ',')         // 将多个逗号合并为一个
      .replace(/^\s*,\s*|\s*,\s*$/g, '')  // 去除首尾逗号和空格
      .trim();
    
    // 限制最多显示10个字符，超出部分用省略号
    if (formatted.length > 10) {
      formatted = formatted.substring(0, 10) + '...';
    }
    
    return formatted;
  },

  // 加载卡片数据
  async loadCardData() {
    // 显示导航栏 Loading
    wx.showNavigationBarLoading();

    try {
      // 查询用户创建的急救卡
      // 云开发自带权限控制，默认只能查到自己创建的数据，直接 .get() 即可
      const res = await db.collection('emergency_cards')
        .limit(1)
        .get();

      // 处理查询结果
      if (res.data && res.data.length > 0) {
        // 如果有数据，处理病史信息（将所有标点符号和换行统一为逗号）
        const cardData = res.data[0];
        if (cardData.conditions) {
          cardData.conditions = this.formatConditions(cardData.conditions);
        }
        // 存入 cardInfo
        this.setData({
          cardInfo: cardData,
          loading: false
        });
      } else {
        // 如果没有数据，设置为 null
        this.setData({
          cardInfo: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载卡片数据失败:', error);
      // 查询失败也设置为 null
      this.setData({
        cardInfo: null,
        loading: false
      });
    } finally {
      // 关闭导航栏 Loading
      wx.hideNavigationBarLoading();
    }
  },

  // 创建卡片
  onCreateCard() {
    wx.navigateTo({
      url: '/pages/create/index'
    });
  },

  // 编辑卡片
  onEditCard() {
    if (this.data.cardInfo && this.data.cardInfo._id) {
      wx.navigateTo({
        url: `/pages/create/index?id=${this.data.cardInfo._id}`
      });
    }
  },

  // 展示二维码
  onShowQRCode() {
    if (this.data.cardInfo && this.data.cardInfo._id) {
      wx.navigateTo({
        url: `/pages/share/index?id=${this.data.cardInfo._id}`
      });
    } else {
      wx.showToast({
        title: '卡片信息异常',
        icon: 'none'
      });
    }
  },

  // 删除卡片
  async onDeleteCard() {
    if (!this.data.cardInfo || !this.data.cardInfo._id) {
      wx.showToast({
        title: '卡片信息异常',
        icon: 'none'
      });
      return;
    }

    // 确认删除
    wx.showModal({
      title: '确认删除',
      content: '删除后需要重新创建卡片，确定要删除吗？',
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#FF3B30',
      success: async (res) => {
        if (res.confirm) {
          // 用户确认删除
          wx.showLoading({
            title: '删除中...',
            mask: true
          });

          try {
            // 删除数据库记录
            await db.collection('emergency_cards').doc(this.data.cardInfo._id).remove();

            wx.hideLoading();
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 2000
            });

            // 刷新数据，会显示"未创建卡片"状态
            this.setData({
              cardInfo: null
            });

            // 延迟刷新，让用户看到成功提示
            setTimeout(() => {
              this.loadCardData();
            }, 2000);
          } catch (error) {
            console.error('删除卡片失败:', error);
            wx.hideLoading();
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  // 模拟扫描二维码
  onSimulateScan() {
    if (this.data.cardInfo && this.data.cardInfo._id) {
      wx.navigateTo({
        url: `/pages/emergency/index?id=${this.data.cardInfo._id}`
      });
    } else {
      wx.showToast({
        title: '卡片信息异常',
        icon: 'none'
      });
    }
  }
});

