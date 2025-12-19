const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // Check if a card exists for this user
    const res = await db.collection('emergency_cards')
      .where({
        _openid: openid
      })
      .field({
        _id: true // Only need the ID
      })
      .get();

    if (res.data.length > 0) {
      return {
        success: true,
        cardId: res.data[0]._id,
        isOwner: true
      };
    } else {
      return {
        success: true,
        cardId: null,
        isOwner: false
      };
    }
  } catch (err) {
    console.error(err);
    return {
      success: false,
      error: err
    };
  }
};

