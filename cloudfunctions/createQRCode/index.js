// cloudfunctions/createQRCode/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { scene, page = 'pages/emergency/index', width = 430 } = event;

  try {
    // 1. 调用微信 OpenAPI 生成小程序码
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: scene, // 场景值，传入数据库记录的 _id（最长32个字符）
      page: page,   // 页面路径
      width: width, // 二维码宽度
      checkPath: false // 不校验页面路径
    });

    if (!result.buffer) {
      throw new Error('生成小程序码失败：未获取到二维码数据');
    }

    // 2. 将 buffer 上传到云存储
    const filePath = `qr_codes/${scene}.png`;
    const uploadResult = await cloud.uploadFile({
      cloudPath: filePath,
      fileContent: result.buffer,
      env: cloud.DYNAMIC_CURRENT_ENV
    });

    if (!uploadResult.fileID) {
      throw new Error('上传二维码到云存储失败');
    }

    // 3. 返回文件 ID
    return {
      success: true,
      fileID: uploadResult.fileID,
      filePath: filePath
    };

  } catch (error) {
    console.error('生成二维码失败:', error);
    return {
      success: false,
      error: error.message || '生成二维码失败',
      errCode: error.errCode || 'UNKNOWN_ERROR'
    };
  }
};

