const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// Generate a random 6-digit string
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.main = async (event, context) => {
  const codes = [];
  
  // Generate 100 codes
  for (let i = 0; i < 100; i++) {
    codes.push({
      code: generateCode(),
      status: 'unused',
      createdAt: db.serverDate()
    });
  }

  // Batch insert
  try {
    const tasks = [];
    
    // Split into chunks and insert
    for (const data of codes) {
      const promise = db.collection('invite_codes').add({ data });
      tasks.push(promise);
    }
    
    await Promise.all(tasks);
    
    return { success: true, count: codes.length };
  } catch (e) {
    console.error('生成邀请码失败:', e);
    return { success: false, error: e.message || e };
  }
};

