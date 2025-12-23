// pages/toolbox/index.js
Page({
  data: {
    // BMI计算器模态框
    showBMIModal: false,
    bmiHeight: '',
    bmiWeight: '',
    // 医保凭证提示模态框
    showMedicalCardModal: false
  },

  onLoad(options) {
    // 页面加载
  },

  // 1. 一键呼救
  onSOSCall() {
    // 优先使用卡片中的紧急联系人电话，否则使用120
    const emergencyPhone = '120';

    wx.makePhoneCall({
      phoneNumber: emergencyPhone,
      success: () => {
        console.log('Calling SOS:', emergencyPhone);
      },
      fail: (err) => {
        console.error('拨打电话失败:', err);
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  // 2. 打开医保电子凭证 - 显示提示模态框
  onOpenMedicalCard() {
    this.setData({
      showMedicalCardModal: true
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

  // 3. 健康计算器 (BMI) - 显示输入模态框
  onCalculateBMI() {
    // 重置输入值
    this.setData({
      showBMIModal: true,
      bmiHeight: '',
      bmiWeight: ''
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

  // 4. 急救常识 - 跳转到急救指南列表页
  onShowFirstAid() {
    wx.navigateTo({
      url: '/pages/guide/list/index'
    });
  },

  // 5. 智能导诊
  onOpenTriage() {
    wx.navigateTo({
      url: '/pages/triage/index'
    });
  }
});
