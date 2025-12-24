const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 🔴 再次确认这两个值：
// 1. WXPUSHER_TOKEN 必须是 'AT_' 开头
// 2. ADMIN_UID 必须是 'UID_' 开头 (不是微信OpenID，不是应用ID)
const WXPUSHER_TOKEN = 'AT_mMaCFqpn21I3dyKEkumYICZC8SWxo7MN'; 
const ADMIN_UID = 'UID_CxmHiVhZeplMONj9yIF4MgC3ZRCM'; 

exports.main = async (event, context) => {
  const { content, contact, userInfo } = event;
  const wxContext = cloud.getWXContext();

  if (!content) return { success: false, msg: '内容为空' };

  try {
    // 获取用户昵称
    const nickName = (userInfo && userInfo.nickName) || contact || '未设置昵称';
    
    // 1. 存数据库
    const dbRes = await db.collection('feedbacks').add({
      data: {
        openid: wxContext.OPENID,
        content,
        contact,
        nickName: nickName, // 保存昵称到数据库
        createTime: db.serverDate()
      }
    });

    // 2. 构造消息（包含用户昵称）
    const htmlMsg = `新反馈\n\n用户: ${nickName}\n内容: ${content}`;
    console.log('正在向 WxPusher 发送请求...'); // 日志打点

    // 3. 发送请求并获取"完整响应"
    const response = await axios.post('https://wxpusher.zjiecode.com/api/send/message', {
      appToken: WXPUSHER_TOKEN,
      content: htmlMsg,
      summary: `新反馈 - ${nickName}`,
      contentType: 2,
      uids: [ADMIN_UID]
    });

    // 🔥【关键修改】打印 WxPusher 返回的真实结果
    console.log('WxPusher 响应结果:', JSON.stringify(response.data));

    // 检查业务状态码 (1000 表示成功)
    if (response.data.code === 1000) {
      return { success: true, id: dbRes._id, pushStatus: '发送成功' };
    } else {
      // 如果 HTTP 200 但业务失败 (如 UID 错误)
      return { success: true, id: dbRes._id, pushStatus: '发送失败', pushError: response.data.msg };
    }
  } catch (err) {
    console.error('系统错误:', err);
    return { success: false, error: err.message };
  }
};

