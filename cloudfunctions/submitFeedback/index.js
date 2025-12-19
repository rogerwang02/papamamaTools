const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { content, userInfo } = event; // userInfo contains nickName, avatarUrl

  try {
    // Save to 'feedbacks' collection
    const result = await db.collection('feedbacks').add({
      data: {
        _openid: openid,
        content: content,
        userInfo: userInfo || {}, // Snapshot of user info at the time of feedback
        createTime: db.serverDate(),
        isRead: false, // For developer management
        deviceInfo: event.deviceInfo || {} // Optional: System info for debugging
      }
    });

    return {
      success: true,
      _id: result._id
    };
  } catch (err) {
    console.error(err);
    return { 
      success: false, 
      errMsg: err.message || err 
    };
  }
};

