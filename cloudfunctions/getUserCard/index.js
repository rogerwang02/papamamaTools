// cloudfunctions/getUserCard/index.js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  try {
    // 🔒 核心逻辑：强制只查 _openid 等于当前调用者的记录
    const res = await db.collection('emergency_cards').where({
      _openid: OPENID
    }).get();

    return {
      success: true,
      data: res.data, // 返回查询到的数组
      openid: OPENID  // 顺便把 openid 返回去，前端可能用得着
    };
  } catch (err) {
    console.error('getUserCard error:', err);
    return {
      success: false,
      error: err.message || err,
      data: []
    };
  }
};

