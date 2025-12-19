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
    // 页面加载时检查用户身份
    this.checkUserIdentity();
  },

  onShow() {
    // 每次显示页面时检查身份（如果用户删除了卡片，需要重新检查）
    // 注意：如果已经跳转到分享页面，这里不会执行
    this.checkUserIdentity();
  },

  // 检查用户身份（不再跳转，只加载数据）
  async checkUserIdentity() {
    // 直接加载卡片数据，如果有卡片会显示卡片信息，如果没有会显示创建按钮
    // 不再进行自动跳转，让用户可以选择查看或编辑
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

  // 带权限检查的操作处理
  async handleActionWithAuth(nextAction) {
    wx.showLoading({ title: '验证权限...' });

    try {
      // 1. 检查用户是否已经验证过（通过检查是否有已使用的邀请码）
      const res = await wx.cloud.callFunction({
        name: 'verifyInviteCode',
        data: { code: '' } // 发送空码只检查状态
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        // 已经授权 -> 继续执行
        nextAction();
      } else {
        // 未授权 -> 显示邀请码输入对话框
        this.showInviteCodeModal(nextAction);
      }
    } catch (e) {
      wx.hideLoading();
      console.error('验证权限失败:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // 显示邀请码输入对话框
  showInviteCodeModal(successCallback) {
    wx.showModal({
      title: '内测邀请',
      content: '',
      editable: true, // 显示输入框
      placeholderText: '本项目目前处于内测阶段，请输入6位邀请码开启使用。',
      success: async (res) => {
        if (res.confirm) {
          // 获取用户输入的内容
          const inputCode = res.content ? res.content.trim() : '';
          
          // 验证输入
          if (!inputCode) {
            wx.showToast({
              title: '邀请码不能为空',
              icon: 'none',
              duration: 2000
            });
            return;
          }
          
          if (inputCode.length !== 6) {
            wx.showToast({
              title: '邀请码应为6位字符',
              icon: 'none',
              duration: 2000
            });
            return;
          }
          
          // 验证通过，提交邀请码
          this.submitInviteCode(inputCode, successCallback);
        }
      }
    });
  },

  // 提交邀请码
  async submitInviteCode(code, successCallback) {
    console.log('提交邀请码:', code);
    wx.showLoading({ title: '校验中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'verifyInviteCode',
        data: { code: code }
      });
      
      console.log('云函数返回结果:', res);

      wx.hideLoading();

      console.log('邀请码验证结果:', res.result);

      if (res.result && res.result.success) {
        const message = res.result.message || '验证成功';
        wx.showToast({ title: message, icon: 'success' });
        // 继续执行操作
        setTimeout(() => {
          successCallback();
        }, 1500);
      } else {
        wx.showModal({
          title: '验证失败',
          content: res.result?.message || '邀请码无效',
          showCancel: false
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('校验邀请码失败:', e);
      wx.showToast({ title: '校验失败', icon: 'none' });
    }
  },

  // 创建卡片（需要验证邀请码）
  onCreateCard() {
    this.handleActionWithAuth(() => {
      // 原始逻辑：跳转到创建页面
      wx.navigateTo({
        url: '/pages/create/index'
      });
    });
  },

  // 编辑卡片（如果已有卡片，通常不需要再次验证，但为了统一体验也可以验证）
  onEditCard() {
    if (this.data.cardInfo && this.data.cardInfo._id) {
      // 已有卡片，直接编辑（可以不验证）
      wx.navigateTo({
        url: `/pages/create/index?id=${this.data.cardInfo._id}`
      });
    } else {
      // 没有卡片，需要创建，所以要验证
      this.onCreateCard();
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

  // 预览卡片
  onPreviewCard() {
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

