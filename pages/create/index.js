// pages/create/index.js
const db = wx.cloud.database();

Page({
  data: {
    editId: null, // 编辑模式的卡片ID
    formData: {
      name: '',
      age: '',
      blood_type: '',
      conditions: '',
      contact_name: '',
      contact_phone: ''
    },
    bloodTypes: ['A型', 'B型', 'AB型', 'O型', 'RH阴性'],
    bloodTypeIndex: 0,
    isSubmitting: false,
    showQRModal: false,
    qrCodeFileID: '',
    isGeneratingQR: false,
    currentCardId: ''
  },

  onLoad(options) {
    // 检查是否是编辑模式
    if (options.id) {
      // 编辑模式
      this.setData({
        editId: options.id
      });
      wx.setNavigationBarTitle({
        title: '编辑卡片信息'
      });
      // 加载数据并回显
      this.loadCardData(options.id);
    } else {
      // 新建模式
      wx.setNavigationBarTitle({
        title: '制作新安心卡'
      });
    }
  },

  // 加载卡片数据（编辑模式回显）
  async loadCardData(cardId) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    try {
      const res = await db.collection('emergency_cards').doc(cardId).get();
      
      if (res.data) {
        const cardData = res.data;
        // 找到血型在数组中的索引
        const bloodTypeIndex = this.data.bloodTypes.findIndex(
          type => type === cardData.blood_type
        );
        
        // 填充表单数据
        this.setData({
          'formData.name': cardData.name || '',
          'formData.age': String(cardData.age || ''),
          'formData.blood_type': cardData.blood_type || '',
          'formData.conditions': cardData.conditions || '',
          'formData.contact_name': cardData.contact_name || '',
          'formData.contact_phone': cardData.contact_phone || '',
          bloodTypeIndex: bloodTypeIndex >= 0 ? bloodTypeIndex : 0
        });
      } else {
        wx.showToast({
          title: '数据加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载卡片数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  onAgeInput(e) {
    this.setData({
      'formData.age': e.detail.value
    });
  },

  onBloodTypeChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      bloodTypeIndex: index,
      'formData.blood_type': this.data.bloodTypes[index]
    });
  },

  onConditionsInput(e) {
    this.setData({
      'formData.conditions': e.detail.value
    });
  },

  onContactNameInput(e) {
    this.setData({
      'formData.contact_name': e.detail.value
    });
  },

  onContactPhoneInput(e) {
    this.setData({
      'formData.contact_phone': e.detail.value
    });
  },

  // 表单验证
  validateForm() {
    const { name, age, blood_type, contact_name, contact_phone } = this.data.formData;
    
    if (!name || name.trim() === '') {
      wx.showToast({
        title: '请输入老人姓名',
        icon: 'none'
      });
      return false;
    }

    if (!age || age.trim() === '') {
      wx.showToast({
        title: '请输入年龄',
        icon: 'none'
      });
      return false;
    }

    if (isNaN(age) || parseInt(age) < 0 || parseInt(age) > 150) {
      wx.showToast({
        title: '请输入正确的年龄',
        icon: 'none'
      });
      return false;
    }

    if (!blood_type) {
      wx.showToast({
        title: '请选择血型',
        icon: 'none'
      });
      return false;
    }

    if (!contact_name || contact_name.trim() === '') {
      wx.showToast({
        title: '请输入家属称呼',
        icon: 'none'
      });
      return false;
    }

    if (!contact_phone || contact_phone.trim() === '') {
      wx.showToast({
        title: '请输入家属电话',
        icon: 'none'
      });
      return false;
    }

    // 简单的手机号验证
    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(contact_phone)) {
      wx.showToast({
        title: '请输入正确的手机号码',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 提交表单
  async onSubmit() {
    if (this.data.isSubmitting) {
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.setData({
      isSubmitting: true
    });

    try {
      const { name, age, blood_type, conditions, contact_name, contact_phone } = this.data.formData;
      const formDataObj = {
        name: name.trim(),
        age: parseInt(age),
        blood_type: blood_type,
        conditions: conditions.trim() || '',
        contact_name: contact_name.trim(),
        contact_phone: contact_phone.trim()
      };

      // 判断是新建还是编辑模式
      if (this.data.editId) {
        // 编辑模式：更新数据
        await db.collection('emergency_cards').doc(this.data.editId).update({
          data: formDataObj
        });

        wx.showToast({
          title: '修改成功',
          icon: 'success',
          duration: 1500
        });

        // 延迟后返回首页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);

        this.setData({
          isSubmitting: false
        });
      } else {
        // 新建模式：添加数据
        const res = await db.collection('emergency_cards').add({
          data: {
            ...formDataObj,
            is_active: true,
            create_time: new Date()
          }
        });

        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 1500
        });

        // 保存成功后，直接返回首页（首页会自动刷新显示新数据）
        this.setData({
          isSubmitting: false
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }

    } catch (error) {
      console.error('保存失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
      this.setData({
        isSubmitting: false
      });
    }
  },

  // 生成二维码
  async generateQRCode(cardId) {
    this.setData({
      isGeneratingQR: true
    });

    wx.showLoading({
      title: '生成二维码中...',
      mask: true
    });

    try {
      // 调用云函数生成小程序码
      const res = await wx.cloud.callFunction({
        name: 'createQRCode',
        data: {
          scene: cardId, // 场景值，最多32个字符
          page: 'pages/emergency/index',
          width: 430
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        this.setData({
          qrCodeFileID: res.result.fileID,
          currentCardId: cardId,
          showQRModal: true,
          isGeneratingQR: false,
          isSubmitting: false
        });
      } else {
        throw new Error(res.result?.error || '生成二维码失败');
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      wx.hideLoading();

      let errorMsg = '生成二维码失败';
      let showPermissionTip = false;

      if (error.errMsg) {
        if (error.errMsg.includes('-604101') || error.errMsg.includes('permission') || error.errMsg.includes('no permission')) {
          errorMsg = '云函数权限不足，需要配置 API 权限';
          showPermissionTip = true;
        } else if (error.errMsg.includes('functions execute fail')) {
          errorMsg = '云函数执行失败，请检查云函数部署';
        }
      }

      const modalContent = showPermissionTip 
        ? errorMsg + '\n\n解决方案：\n1. 登录微信云开发控制台\n2. 云函数 → createQRCode → 权限设置\n3. 开通"获取小程序码"权限\n\n是否直接查看急救卡？'
        : errorMsg + '，是否直接查看急救卡？';

      wx.showModal({
        title: '提示',
        content: modalContent,
        confirmText: '查看',
        cancelText: '返回',
        success: (modalRes) => {
          this.setData({
            isGeneratingQR: false,
            isSubmitting: false
          });
          if (modalRes.confirm) {
            wx.redirectTo({
              url: `/pages/emergency/index?id=${cardId}`
            });
          } else {
            // 用户选择返回，直接返回首页（首页会自动刷新显示新数据）
            wx.navigateBack();
          }
        }
      });
    }
  },

  // 关闭二维码模态框
  onCloseQRModal() {
    this.setData({
      showQRModal: false
    });
    // 关闭模态框后返回首页
    setTimeout(() => {
      wx.navigateBack();
    }, 300);
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 保存二维码到相册
  async onSaveQRCode() {
    if (!this.data.qrCodeFileID) {
      wx.showToast({
        title: '二维码不存在',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      // 先下载云存储中的图片到临时文件
      const downloadRes = await wx.cloud.downloadFile({
        fileID: this.data.qrCodeFileID
      });

      if (!downloadRes.tempFilePath) {
        throw new Error('下载二维码失败');
      }

      // 保存图片到相册
      await wx.saveImageToPhotosAlbum({
        filePath: downloadRes.tempFilePath
      });

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('保存二维码失败:', error);
      wx.hideLoading();

      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '提示',
          content: '需要授权访问相册才能保存图片',
          showCancel: false
        });
      } else {
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  // 查看急救卡
  onViewEmergencyCard() {
    const cardId = this.data.currentCardId;
    if (cardId) {
      // 关闭模态框，但不返回首页
      this.setData({
        showQRModal: false
      });
      // 直接跳转到急救卡页面
      wx.redirectTo({
        url: `/pages/emergency/index?id=${cardId}`
      });
    } else {
      wx.showToast({
        title: '无法获取卡片信息',
        icon: 'none'
      });
    }
  }
});

