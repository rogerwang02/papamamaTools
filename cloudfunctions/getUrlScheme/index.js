// cloudfunctions/getUrlScheme/index.js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    // 🔗 使用 URL Link 接口 (生成 https://wxaurl.cn/...)
    // 这个接口比 Scheme 更稳定，适合 H5 唤起
    const result = await cloud.openapi.urllink.generate({
      path: '/pages/home/index', // 注意：这里直接写 path，不需要 jumpWxa
      isExpire: true,
      expire_type: 1,
      expire_interval: 30
    });

    return {
      code: 0,
      openlink: result.url_link // 注意：微信返回的字段叫 url_link
    };

  } catch (err) {
    console.error('生成跳转链接失败:', err);
    return {
      code: -1,
      msg: err.message,
      errCode: err.errCode
    };
  }
};