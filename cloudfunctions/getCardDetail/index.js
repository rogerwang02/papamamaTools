// cloudfunctions/getCardDetail/index.js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { cardId } = event;

  if (!cardId) {
    return { 
      code: -1, 
      msg: 'No Card ID provided' 
    };
  }

  try {
    // 🔒 安全核心：这里是服务端，拥有最高权限
    // 我们只执行 doc(id).get()，绝不执行 collection.get()
    const res = await db.collection('emergency_cards').doc(cardId).get();
    
    // 检查数据是否存在
    if (!res.data) {
      return {
        code: 404,
        msg: 'Not Found'
      };
    }
    
    // 检查卡片是否激活
    if (!res.data.is_active) {
      return {
        code: 404,
        msg: 'Card is not active'
      };
    }

    return {
      code: 0,
      data: res.data // 只返回这一条数据
    };
  } catch (err) {
    console.error('getCardDetail error:', err);
    // 如果查不到或出错，返回空，不要把底层错误暴露给前端
    return {
      code: 404,
      msg: 'Not Found'
    };
  }
};

