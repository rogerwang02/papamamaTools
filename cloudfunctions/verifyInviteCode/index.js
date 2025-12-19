const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 万能邀请码
const VIP_CODE = 'pyq666';

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { code } = event;
  
  console.log('收到邀请码验证请求:', { code, openid });

  // 1. Check if user is already authorized (Has a used code)
  const userCheck = await db.collection('invite_codes').where({
    usedBy: openid
  }).get();

  if (userCheck.data.length > 0) {
    return { success: true, message: 'Already authorized' };
  }

  // 2. If no code provided, just return not authorized status
  if (!code) {
    return { success: false, message: '请输入邀请码', authorized: false };
  }

  try {
    // 3. Check if it's the VIP code (case-insensitive comparison)
    // VIP码支持多个用户使用，每个用户使用都会创建一条新记录
    const codeUpper = code.toUpperCase();
    const vipCodeUpper = VIP_CODE.toUpperCase();
    
    if (codeUpper === vipCodeUpper) {
      // VIP code: 支持多个用户使用，每个用户创建一条新记录
      // 先检查该用户是否已经使用过VIP码
      const vipCheck = await db.collection('invite_codes').where({
        code: VIP_CODE,
        usedBy: openid
      }).get();

      if (vipCheck.data.length > 0) {
        // 该用户已经使用过VIP码，直接返回成功
        console.log('用户已使用过VIP码:', openid);
        return { success: true, message: '验证成功（VIP）', isVIP: true };
      }

      // 该用户首次使用VIP码，创建新记录绑定该用户
      // 注意：VIP码可以被多个用户使用，每次使用都会创建一条新记录
      const addResult = await db.collection('invite_codes').add({
        data: {
          code: VIP_CODE,
          status: 'used',
          usedBy: openid,        // 绑定当前用户的openid
          usedAt: db.serverDate(),
          isVIP: true            // 标记为VIP用户
        }
      });

      console.log('VIP码绑定成功，新记录ID:', addResult._id, '用户openid:', openid);
      return { success: true, message: '验证成功（VIP）', isVIP: true };
    }

    // 4. Regular code: Find the code (Must be unused)
    const res = await db.collection('invite_codes').where({
      code: code,
      status: 'unused'
    }).get();

    if (res.data.length === 0) {
      return { success: false, message: '邀请码无效或已被使用' };
    }

    const docId = res.data[0]._id;

    // 5. Atomic Update: Mark as used
    await db.collection('invite_codes').doc(docId).update({
      data: {
        status: 'used',
        usedBy: openid,
        usedAt: db.serverDate()
      }
    });

    return { success: true, message: '验证成功' };
  } catch (err) {
    console.error('验证邀请码失败:', err);
    return { 
      success: false, 
      message: '系统错误',
      error: err.message || err.toString()
    };
  }
};

