// pages/profile/index.js
const db = wx.cloud.database();
const defaultAvatar = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

Page({
  data: {
    avatarUrl: defaultAvatar,
    nickName: '',
    hasChanges: false,
    isUploading: false,
    cardId: null,
    originalAvatarUrl: defaultAvatar,
    originalNickName: ''
  },

  onLoad(options) {
    // 页面加载时获取用户资料
    this.fetchUserProfile();
  },

  // 获取用户资料
  async fetchUserProfile() {
    wx.showLoading({ title: '加载中' });
    try {
      // 查询用户创建的急救卡
      const res = await db.collection('emergency_cards')
        .limit(1)
        .get();

      if (res.data && res.data.length > 0) {
        const cardData = res.data[0];
        const avatarUrl = cardData.avatarUrl || defaultAvatar;
        const nickName = cardData.nickName || '';
        
        this.setData({
          avatarUrl: avatarUrl,
          nickName: nickName,
          cardId: cardData._id,
          originalAvatarUrl: avatarUrl,
          originalNickName: nickName,
          hasChanges: false
        });
      } else {
        // 如果没有卡片，使用默认值
        this.setData({
          avatarUrl: defaultAvatar,
          nickName: '',
          originalAvatarUrl: defaultAvatar,
          originalNickName: '',
          hasChanges: false
        });
      }
    } catch (e) {
      console.error('加载用户资料失败:', e);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 1. 处理头像选择
  onChooseAvatar(e) {
    // 检查是否取消选择或错误
    if (!e.detail || !e.detail.avatarUrl) {
      console.log('用户取消选择头像或选择失败');
      return;
    }

    // 防止在保存过程中选择头像
    if (this.data.isUploading) {
      wx.showToast({
        title: '正在保存中，请稍候',
        icon: 'none'
      });
      return;
    }

    const { avatarUrl } = e.detail;
    // 立即显示本地选择的头像
    const hasChanges = avatarUrl !== this.data.originalAvatarUrl || 
                       this.data.nickName !== this.data.originalNickName;
    this.setData({ 
      avatarUrl, 
      hasChanges
    });
  },

  // 2. 处理昵称输入
  onNicknameChange(e) {
    const val = e.detail.value;
    const hasChanges = val !== this.data.originalNickName || 
                       this.data.avatarUrl !== this.data.originalAvatarUrl;
    this.setData({ 
      nickName: val,
      hasChanges
    });
  },

  // 3. 保存逻辑
  async onSaveProfile() {
    if (this.data.isUploading || !this.data.hasChanges) return;

    // 检查是否有数据需要保存
    if (!this.data.cardId) {
      wx.showModal({
        title: '提示',
        content: '您还没有创建急救卡，是否现在去创建？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/create/index'
            });
          }
        }
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    this.setData({ isUploading: true });

    try {
      let finalAvatarUrl = this.data.avatarUrl;

      // 如果头像是本地临时文件，需要先上传到云存储
      if (finalAvatarUrl && 
          !finalAvatarUrl.startsWith('cloud://') && 
          !finalAvatarUrl.startsWith('http') &&
          !finalAvatarUrl.startsWith('https') &&
          finalAvatarUrl !== defaultAvatar &&
          (finalAvatarUrl.startsWith('wxfile://') || finalAvatarUrl.startsWith('file://') || finalAvatarUrl.startsWith('tmp/'))) {
        // 上传头像到云存储
        const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: finalAvatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      // 更新数据库
      await db.collection('emergency_cards').doc(this.data.cardId).update({
        data: {
          avatarUrl: finalAvatarUrl,
          nickName: this.data.nickName
        }
      });

      this.setData({ 
        avatarUrl: finalAvatarUrl,
        originalAvatarUrl: finalAvatarUrl,
        originalNickName: this.data.nickName,
        hasChanges: false 
      });
      
      wx.showToast({ 
        title: '保存成功', 
        icon: 'success' 
      });
    } catch (error) {
      console.error('保存失败', error);
      wx.showToast({ 
        title: '保存失败，请重试', 
        icon: 'none' 
      });
    } finally {
      wx.hideLoading();
      this.setData({ isUploading: false });
    }
  },

  // 导航到编辑急救信息页面
  onEditCard() {
    if (!this.data.cardId) {
      // 如果没有卡片，跳转到创建页面
      wx.navigateTo({ 
        url: '/pages/create/index' 
      });
    } else {
      // 如果有卡片，跳转到编辑页面
      wx.navigateTo({ 
        url: `/pages/create/index?id=${this.data.cardId}` 
      });
    }
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

