// pages/toolbox/index.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    isElderMode: false, // 长辈模式状态
    // BMI计算器模态框
    showBMIModal: false,
    bmiHeight: '',
    bmiWeight: '',
    // 医保凭证提示模态框
    showMedicalCardModal: false,
    // 健康指引功能开关（从全局变量同步）
    showMedicalGuide: false
  },

  onLoad(options) {
    // 初始化主题模式
    this.setThemeClass();
    // 页面加载
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
    // 更新主题模式
    this.setThemeClass();
    // 每次显示页面时，从全局变量同步开关状态
    // 这样即使 app.js 拉取稍微慢一点，用户切一下页面也能刷出来
    this.syncMedicalGuideConfig();
  },

  // 设置主题class到页面根元素
  setThemeClass() {
    const isElder = app.globalData.isElderMode || false;
    this.setData({ isElderMode: isElder });
  },

  // 主动查询健康指引配置（页面级查询，不依赖 app.js 的异步加载）
  fetchMedicalGuideConfig() {
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

  // 1. 一键呼救（需要验证邀请码）
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

  // 3. 健康计算器 (BMI) - 显示输入模态框（需要验证邀请码）
  onCalculateBMI() {
    this.handleActionWithAuth(() => {
      // 重置输入值
      this.setData({
        showBMIModal: true,
        bmiHeight: '',
        bmiWeight: ''
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

  // 5. 科室建议（需要验证邀请码）
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
  }
});
