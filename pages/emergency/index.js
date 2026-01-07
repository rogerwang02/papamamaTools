// pages/emergency/index.js
const db = wx.cloud.database();

const app = getApp();

Page({
  data: {
    isElderMode: false, // 长辈模式状态
    cardId: '',
    cardData: null,
    loading: true,
    qrCodeFileID: '', // 二维码文件ID
    conditionsTags: [], // 病史标签数组
    allergyInfo: '', // 过敏信息
    medications: '', // 常用药物（字符串）
    medicationsTags: [] // 常用药物标签数组
  },

  // 从病史中提取过敏信息（包含"过敏""不吃""不服"等相关字样的第一项，去掉关键词，仅保留药物名称，然后加上"等"字）
  extractAllergy(conditions) {
    if (!conditions) return '无已知过敏';
    
    // 查找包含过敏相关关键词的项
    const separators = /[,\n;，；、]/;
    const items = conditions.split(separators).map(item => item.trim()).filter(item => item.length > 0);
    
    const allergyKeywords = ['过敏', '过敏史', '过敏源', '不吃', '不服', '不能吃', '不能服', '禁用', '忌用'];
    
    for (const item of items) {
      if (allergyKeywords.some(keyword => item.includes(keyword))) {
        // 去掉所有关键词，仅保留药物名称
        let cleanedItem = item;
        
        // 去掉各种关键词（按顺序处理，避免冲突）
        // 先去掉较长的词组
        cleanedItem = cleanedItem.replace(/不能吃|不能服|过敏史|过敏源/g, '');
        // 再去掉单个关键词
        cleanedItem = cleanedItem.replace(/过敏/g, '');
        cleanedItem = cleanedItem.replace(/不吃|不服/g, '');
        cleanedItem = cleanedItem.replace(/禁用|忌用/g, '');
        // 去掉"对"和"的"等助词（在开头或结尾）
        cleanedItem = cleanedItem.replace(/^对|^的|的对$|的$|对$/g, '');
        cleanedItem = cleanedItem.trim();
        
        // 如果清理后还有内容，加上"等"字
        if (cleanedItem.length > 0) {
          return cleanedItem + '等';
        }
      }
    }
    
    // 如果没有找到，返回默认值
    return '无已知过敏';
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
    // 初始化主题模式
    this.setThemeClass();
    
    let id = options.id;
    
    // 🟢 FIX: Handle QR Code "scene" parameter
    if (options.scene) {
      // WeChat encodes the scene, so we must decode it
      const scene = decodeURIComponent(options.scene);
      console.log('Scanned Scene:', scene);
      // Assuming scene IS the cardId (e.g., scene="card_123")
      id = scene;
    }
    
    console.log('Final Card ID:', id);
    if (!id) {
      console.error('No valid ID found in options:', options);
      this.setData({ 
        loading: false 
      });
      wx.showToast({ 
        title: '二维码无效', 
        icon: 'none' 
      });
      return;
    }

    this.setData({
      cardId: id
    });

    this.loadCardData(id);
  },

  // 加载卡片数据（使用安全云函数，绕过数据库权限限制）
  async loadCardData(id) {
    // 确保 loading 状态为 true（在加载开始时显示 loading）
    this.setData({
      loading: true,
      cardData: null
    });

    try {
      // 🔄 CHANGE: Call the Secure Cloud Function instead of Direct DB Access
      // This bypasses the "Private" database permission settings because Cloud Functions have admin rights.
      const res = await wx.cloud.callFunction({
        name: 'getCardDetail',
        data: { cardId: id }
      });

      // Check the custom response code from our cloud function
      if (res.result.code !== 0 || !res.result.data) {
        throw new Error(res.result.msg || '信息获取失败或已失效');
      }

      const cardDataRaw = res.result.data;
      
      // 处理病史数据，转换为标签数组
      const conditionsTags = this.parseConditionsToTags(cardDataRaw.conditions);
      // 提取过敏信息
      const allergyInfo = this.extractAllergy(cardDataRaw.conditions);
      // 处理常用药物数据，转换为标签数组
      const medicationsTags = cardDataRaw.medications ? this.parseConditionsToTags(cardDataRaw.medications) : [];
      
      // 格式化更新时间
      let updateTime = '';
      try {
        if (cardDataRaw.update_time) {
          updateTime = this.formatDate(cardDataRaw.update_time);
        } else if (cardDataRaw.create_time) {
          updateTime = this.formatDate(cardDataRaw.create_time);
        }
      } catch (e) {
        console.log('格式化时间失败:', e);
      }
      
      // 处理头像 URL：如果是 cloud:// 格式，需要转换为临时 HTTP URL
      let avatarUrl = cardDataRaw.avatar || null;
      if (avatarUrl && avatarUrl.startsWith('cloud://')) {
        try {
          const tempFileRes = await wx.cloud.getTempFileURL({
            fileList: [avatarUrl]
          });
          if (tempFileRes.fileList && tempFileRes.fileList.length > 0 && tempFileRes.fileList[0].tempFileURL) {
            avatarUrl = tempFileRes.fileList[0].tempFileURL;
          }
        } catch (err) {
          console.error('获取头像临时URL失败:', err);
          avatarUrl = null; // 获取失败则设为 null，显示占位符
        }
      }
      
      // 将头像 URL 添加到数据中
      const cardData = {
        ...cardDataRaw,
        avatar: avatarUrl
      };
      
      this.setData({
        cardData: cardData,
        conditionsTags: conditionsTags,
        allergyInfo: allergyInfo,
        medications: cardDataRaw.medications || '无',
        medicationsTags: medicationsTags,
        updateTime: updateTime,
        loading: false
      });
      // 加载对应的二维码
      this.loadQRCode(id);
    } catch (error) {
      console.error('❌ Data Fetch Error:', error); // Log full error object
      
      let errorMsg = '信息获取失败';
      
      // Handle different error scenarios
      if (error.message && error.message.includes('失效')) {
        errorMsg = '信息获取失败或已失效';
      } else if (error.message && error.message.includes('未找到')) {
        errorMsg = '未找到该急救卡';
      } else if (error.errMsg && error.errMsg.includes('not found')) {
        errorMsg = '未找到该急救卡';
      }
      
      this.setData({
        cardData: null,
        loading: false
      });
      
      wx.showToast({ 
        title: errorMsg, 
        icon: 'none', 
        duration: 3000 
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
        console.error('取消拨打电话:', err);
        wx.showToast({
          title: '取消拨打电话',
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

  // 格式化日期（处理云数据库返回的时间格式）
  formatDate(dateValue) {
    if (!dateValue) return '';
    
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue.seconds) {
      // 云数据库 Timestamp 对象
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue);
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 返回首页
  onGoBack() {
    // 🧹 干净跳转：不带参数，直接切回 Tab 页
    // 由于首页会在 onShow 里自动调用 getUserCard，所以数据会自动刷新为"我的数据"
    wx.switchTab({
      url: '/pages/home/index'
    });
  },

  // 设置主题class到页面根元素
  setThemeClass() {
    const isElder = app.globalData.isElderMode || false;
    this.setData({ isElderMode: isElder });
  },

  onShow() {
    // 更新主题模式
    this.setThemeClass();
  }
});

