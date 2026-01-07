// pages/home/index.js
const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    loading: true,
    cardInfo: null,
    isElderMode: false, // 长辈模式状态
    habits: [
      { id: 1, text: '按时吃药了没？', icon: '💊', done: false },
      { id: 2, text: '测量血压了没？', icon: '🩺', done: false },
      { id: 3, text: '适量运动了没？', icon: '🚶', done: false },
      { id: 4, text: '多喝温水了没？', icon: '💧', done: false }
    ],
    // BMI计算器模态框
    showBMIModal: false,
    bmiHeight: '',
    bmiWeight: '',
    // 医保凭证提示模态框
    showMedicalCardModal: false,
    // 健康指引功能开关（从全局变量同步）
    showMedicalGuide: false,
    // 管理员模式
    isAdmin: false, // 是否显示管理员按钮
    tapCount: 0,    // 连击计数
    lastTapTime: 0  // 上次点击时间
  },

  onLoad(options) {
    // 初始化主题模式
    this.setThemeClass();
    
    // 页面加载时检查用户身份
    this.checkUserIdentity();
    
    // 如果全局变量还是默认值（可能配置还没拉取完成），主动查询一次配置
    if (!app.globalData.enableMedicalGuide) {
      this.fetchMedicalGuideConfig();
    } else {
      // 如果已经有值，直接同步
      this.syncMedicalGuideConfig();
    }
    
    // 延迟多次同步配置状态，确保 fetchConfig 有足够时间完成（针对慢网络）
    setTimeout(() => {
      this.syncMedicalGuideConfig();
    }, 300);
    
    setTimeout(() => {
      this.syncMedicalGuideConfig();
    }, 800);
  },

  onShow() {
    // 更新主题模式（可能在别的页面切换了）
    this.setThemeClass();
    
    // 每次显示页面时检查身份（如果用户删除了卡片，需要重新检查）
    // 注意：如果已经跳转到分享页面，这里不会执行
    this.checkUserIdentity();
    
    // 同步健康指引功能开关状态
    this.syncMedicalGuideConfig();
  },

  // 设置主题class到页面根元素
  setThemeClass() {
    const isElder = app.globalData.isElderMode || false;
    this.setData({ isElderMode: isElder });
  },

  // 切换长辈模式
  toggleElderMode() {
    const newMode = app.toggleThemeMode();
    this.setData({ isElderMode: newMode });
    wx.showToast({
      title: newMode ? '已切换到长辈模式' : '已切换回标准模式',
      icon: 'none',
      duration: 1500
    });
  },

  // 主动查询健康指引配置（页面级查询，不依赖 app.js 的异步加载）
  fetchMedicalGuideConfig() {
    const db = wx.cloud.database();
    db.collection('app_config').where({
      key: 'audit_switch'
    }).get().then(res => {
      if (res.data.length > 0) {
        const enabled = res.data[0].enable_medical_guide === true;
        // 更新全局变量
        app.globalData.enableMedicalGuide = enabled;
        // 同步到页面数据
        this.setData({
          showMedicalGuide: enabled
        });
        console.log('✅ 页面主动拉取配置成功，功能开关:', enabled);
      } else {
        console.log('⚠️ 未找到配置，使用默认关闭状态');
      }
    }).catch(err => {
      console.error('页面拉取配置失败，使用默认关闭状态', err);
    });
  },

  // 同步健康指引功能开关状态（提取为独立方法，便于复用）
  syncMedicalGuideConfig() {
    if (app.globalData.enableMedicalGuide !== this.data.showMedicalGuide) {
      this.setData({
        showMedicalGuide: app.globalData.enableMedicalGuide
      });
    }
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

  // 加载卡片数据（使用云函数，确保只获取当前用户的数据）
  async loadCardData() {
    // 显示导航栏 Loading
    wx.showNavigationBarLoading();

    try {
      // ☁️ 调用云函数：只拿我自己的数据
      const res = await wx.cloud.callFunction({
        name: 'getUserCard'
      });
      
      console.log('My Card Data:', res.result);
      
      if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
        // 找到了我的卡片
        const cardData = res.result.data[0];
        // 处理病史信息（将所有标点符号和换行统一为逗号）
        if (cardData.conditions) {
          cardData.conditions = this.formatConditions(cardData.conditions);
        }
        // 存入 cardInfo
        this.setData({
          cardInfo: cardData,
          loading: false
        });
      } else {
        // 没找到我的卡片（我是新用户，或者我没创建过）
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
    // 1. 先检查本地缓存是否有验证记录
    const cacheKey = 'inviteCodeVerified';
    const cachedAuth = wx.getStorageSync(cacheKey);
    
    if (cachedAuth && cachedAuth.verified === true) {
      // 本地缓存有验证记录，直接执行操作
      console.log('✅ 使用本地缓存验证状态，直接执行操作');
      nextAction();
      return;
    }

    // 2. 本地没有缓存，调用云函数验证
    wx.showLoading({ title: '验证权限...' });

    try {
      // 检查用户是否已经验证过（通过检查是否有已使用的邀请码）
      const res = await wx.cloud.callFunction({
        name: 'verifyInviteCode',
        data: { code: '' } // 发送空码只检查状态
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        // 已经授权 -> 保存到本地缓存，然后继续执行
        wx.setStorageSync(cacheKey, { verified: true, timestamp: Date.now() });
        console.log('✅ 验证成功，已保存到本地缓存');
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
        // 验证成功，保存到本地缓存
        const cacheKey = 'inviteCodeVerified';
        wx.setStorageSync(cacheKey, { verified: true, timestamp: Date.now() });
        console.log('✅ 邀请码验证成功，已保存到本地缓存');
        
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
  },

  // 1. SOS 呼救（需要验证邀请码）
  onSOSCall() {
    this.handleActionWithAuth(() => {
      // 优先使用卡片中的紧急联系人电话，否则使用120
      const emergencyPhone = '120';

      wx.makePhoneCall({
        phoneNumber: emergencyPhone,
        success: () => {
          console.log('Calling SOS:', emergencyPhone);
        },
        fail: (err) => {
          console.error('取消拨打电话:', err);
          wx.showToast({
            title: '取消拨打电话',
            icon: 'none'
          });
        }
      });
    });
  },

  // 2. 打开医保电子凭证 - 显示提示模态框（需要验证邀请码）
  onOpenMedicalCard() {
    this.handleActionWithAuth(() => {
      this.setData({
        showMedicalCardModal: true
      });
    });
  },

  // 关闭医保凭证提示模态框
  onCloseMedicalCardModal() {
    this.setData({
      showMedicalCardModal: false
    });
  },

  // 确认打开医保电子凭证
  onConfirmOpenMedicalCard() {
    // 关闭模态框
    this.setData({
      showMedicalCardModal: false
    });

    // 跳转到腾讯健康小程序
    wx.showLoading({ title: '正在打开...' });

    wx.navigateToMiniProgram({
      appId: 'wxb032bc789053daf4', // Tencent Health
      // path: '', // REMOVED: Do not specify path to avoid white screen errors
      success(res) {
        wx.hideLoading();
      },
      fail(err) {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '无法打开，请重试', icon: 'none' });
      }
    });
  },

  // 3. 智能导诊 - 跳转到智能导诊页面（需要验证邀请码）
  onOpenTriage() {
    // 双重保险：点击时再次确认开关
    if (!app.globalData.enableMedicalGuide) {
      console.log('健康指引功能未启用');
      return;
    }
    
    this.handleActionWithAuth(() => {
      wx.navigateTo({
        url: '/pages/triage/index'
      });
    });
  },

  // 关闭BMI模态框
  onCloseBMIModal() {
    this.setData({
      showBMIModal: false,
      bmiHeight: '',
      bmiWeight: ''
    });
  },

  // 身高输入
  onBMIHeightInput(e) {
    const value = e.detail.value.trim();
    this.setData({
      bmiHeight: value
    });
  },

  // 体重输入
  onBMIWeightInput(e) {
    const value = e.detail.value.trim();
    this.setData({
      bmiWeight: value
    });
  },

  // 确认计算BMI
  onBMIConfirm() {
    const height = parseFloat(this.data.bmiHeight);
    const weight = parseFloat(this.data.bmiWeight);

    // 校验身高
    if (!height || isNaN(height) || height < 50 || height > 250) {
      wx.showToast({ title: '请输入有效的身高(50-250cm)', icon: 'none' });
      return;
    }

    // 校验体重
    if (!weight || isNaN(weight) || weight < 20 || weight > 200) {
      wx.showToast({ title: '请输入有效的体重(20-200kg)', icon: 'none' });
      return;
    }

    // 关闭模态框
    this.onCloseBMIModal();

    // 计算并展示结果
    this.showBMIResult(height, weight);
  },

  // 辅助函数：计算 BMI 并生成建议
  showBMIResult(heightCm, weightKg) {
    // 1. 计算公式：BMI = 体重(kg) / (身高(m) * 身高(m))
    const heightM = heightCm / 100;
    const bmi = (weightKg / (heightM * heightM)).toFixed(1);
    
    // 2. 判断范围 (中国成人标准)
    let status = '';
    let advice = '';
    let icon = '';
    
    if (bmi < 18.5) {
      status = '偏瘦';
      icon = '🥗';
      advice = '您的体重偏轻，请注意营养补充，适当多吃富含蛋白质的食物。';
    } else if (bmi < 24) {
      status = '标准';
      icon = '🌟';
      advice = '太棒了！您的身材非常标准，请继续保持健康的生活习惯。';
    } else if (bmi < 28) {
      status = '偏胖';
      icon = '⚠️';
      advice = '您的体重稍微有点超标，建议适当控制饮食，增加散步等运动。';
    } else {
      status = '肥胖';
      icon = '🚨';
      advice = '为了心血管健康，建议您制定科学的减重计划，必要时咨询医生。';
    }

    // 3. 展示结果弹窗
    wx.showModal({
      title: `${icon} BMI指数：${bmi}`,
      content: `评估结果：【${status}】\n\n💡 健康建议：\n${advice}`,
      showCancel: false,
      confirmText: '我记住了',
      confirmColor: '#FF6B00'
    });
  },

  // 4. 急救常识 - 跳转到急救指南列表页（需要验证邀请码）
  onShowFirstAid() {
    this.handleActionWithAuth(() => {
      wx.navigateTo({
        url: '/pages/guide/list/index'
      });
    });
  },

  // 5. 显示使用指南
  onShowGuide() {
    wx.showModal({
      title: '使用指南',
      content: '1. 点击"编辑信息"完善您的急救卡\n2. 点击"生成二维码"，创建自己的桌面壁纸或打印用的急救卡\n3. 遇到紧急情况点击"一键呼救"\n4. 每日完成健康打卡，关注家人健康',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 6. 跳转到工具箱页面（需要验证邀请码）
  onGoToToolbox() {
    this.handleActionWithAuth(() => {
      wx.switchTab({
        url: '/pages/toolbox/index'
      });
    });
  },

  // 6. 切换健康打卡状态
  onToggleHabit(e) {
    const id = e.currentTarget.dataset.id;
    const habits = this.data.habits.map(item => {
      if (item.id === id) {
        // 修改点：把 { ...item } 换成 Object.assign，解决 babel 报错
        return Object.assign({}, item, { done: !item.done });
      }
      return item;
    });

    this.setData({ habits });

    // 触觉反馈 (加个 try-catch 防止不支持震动的手机报错)
    try {
      wx.vibrateShort({
        type: 'light'
      });
    } catch (err) {
      console.log('Vibration not supported');
    }
  },

  // 1. 隐形开关：标题五连击
  handleSecretTap() {
    const now = new Date().getTime();
    // 如果两次点击间隔小于 500ms，算作连击
    if (now - this.data.lastTapTime < 500) {
      this.data.tapCount++;
    } else {
      this.data.tapCount = 1; // 超时重置
    }

    this.setData({ lastTapTime: now });
    if (this.data.tapCount >= 5) {
      this.setData({ isAdmin: true });
      wx.showToast({ title: '开发者模式已开启', icon: 'none' });
    }
  },

  // 2. 核心功能：生成链接并复制
  async generateUrlLink() {
    wx.showLoading({ title: '正在生成链接...' });

    try {
      // 调用云函数 (urllink.generate)
      const res = await wx.cloud.callFunction({
        name: 'getUrlScheme'
      });
      console.log('Link Result:', res);
      // 注意：urllink.generate 返回的字段是 url_link，不是 openlink
      const url = res.result?.url_link || res.result?.openlink;
      if (res.result && res.result.code === 0 && url) {

        // 复制到剪贴板
        wx.setClipboardData({
          data: url,
          success: () => {
            wx.hideLoading();
            wx.showModal({
              title: '链接已复制',
              content: '请将此链接填入 H5 网页代码中。\n有效期：30天。',
              showCancel: false,
              confirmText: '好的'
            });
          }
        });
      } else {
        throw new Error(res.result?.msg || '生成失败，请检查云函数日志');
      }
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '调用失败: ' + err.message, icon: 'none', duration: 3000 });
    }
  }
});

