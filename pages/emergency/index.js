// pages/emergency/index.js
const db = wx.cloud.database();

Page({
  data: {
    cardId: '',
    cardData: null,
    loading: true,
    qrCodeFileID: '', // 二维码文件ID
    conditionsTags: [] // 病史标签数组
  },

  // 将病史文本解析为标签数组
  parseConditionsToTags(conditions) {
    if (!conditions || !conditions.trim()) {
      return [];
    }
    
    // 按换行符、逗号、分号等分隔符分割
    const separators = /[,\n;，；、]/;
    const tags = conditions
      .split(separators)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    return tags;
  },

  onLoad(options) {
    const id = options.id;
    
    if (!id) {
      this.setData({
        loading: false
      });
      return;
    }

    this.setData({
      cardId: id
    });

    this.loadCardData(id);
  },

  // 加载卡片数据
  async loadCardData(id) {
    // 确保 loading 状态为 true（在加载开始时显示 loading）
    this.setData({
      loading: true,
      cardData: null
    });

    try {
      const res = await db.collection('emergency_cards').doc(id).get();
      
      if (res.data && res.data.is_active) {
        // 处理病史数据，转换为标签数组
        const conditionsTags = this.parseConditionsToTags(res.data.conditions);
        
        this.setData({
          cardData: res.data,
          conditionsTags: conditionsTags,
          loading: false
        });
        // 加载对应的二维码
        this.loadQRCode(id);
      } else {
        this.setData({
          cardData: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      this.setData({
        cardData: null,
        loading: false
      });
    }
  },

  // 拨打电话
  onMakePhoneCall() {
    const phone = this.data.cardData?.contact_phone;
    
    if (!phone) {
      wx.showToast({
        title: '电话号码无效',
        icon: 'none'
      });
      return;
    }

    wx.makePhoneCall({
      phoneNumber: phone,
      fail: (err) => {
        console.error('拨打电话失败:', err);
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载二维码
  async loadQRCode(cardId) {
    try {
      // 根据卡片ID构建二维码云存储路径
      const qrCodePath = `qr_codes/${cardId}.png`;
      
      // 尝试从云存储获取文件URL
      // 如果文件存在，会返回临时URL；如果不存在，会报错但不影响页面
      try {
        const tempFileRes = await wx.cloud.getTempFileURL({
          fileList: [qrCodePath]
        });
        
        if (tempFileRes.fileList && tempFileRes.fileList.length > 0) {
          const fileInfo = tempFileRes.fileList[0];
          if (fileInfo.tempFileURL) {
            // 文件存在，使用临时URL
            this.setData({
              qrCodeFileID: fileInfo.tempFileURL
            });
          } else if (fileInfo.fileID) {
            // 如果返回了 fileID，使用 fileID
            this.setData({
              qrCodeFileID: fileInfo.fileID
            });
          }
        }
      } catch (err) {
        // 文件不存在或获取失败，不显示二维码（不影响页面其他功能）
        console.log('二维码文件不存在或获取失败:', err);
      }
    } catch (error) {
      console.error('加载二维码失败:', error);
      // 二维码加载失败不影响页面显示
    }
  },

  // 返回首页
  onGoBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.redirectTo({
          url: '/pages/home/index'
        });
      }
    });
  }
});

