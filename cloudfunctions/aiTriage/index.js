const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// TODO: Replace with your actual DeepSeek or OpenAI-compatible Key
const API_KEY = 'sk-8220591e64e8435480df4219802426c8'; 
const API_URL = 'https://api.deepseek.com/chat/completions'; // Or other provider

exports.main = async (event, context) => {
  const { symptoms } = event;

  if (!symptoms) {
    return { success: false, error: '请输入症状' };
  }

  // 优化的 Prompt，包含严格的意图检测
  const systemPrompt = `
    你是一名专业的医院分诊护士。你的唯一职责是根据用户的【身体/心理症状描述】推荐就诊科室。

    ⚠️ 严格的过滤规则：

    1. 如果用户输入的内容与"生病、疼痛、身体不适、健康咨询、心理问题"无关（例如：问天气、闲聊、写代码、问百科知识等），请务必拒绝回答。

    2. 对于无关内容，返回的 JSON 中 "department" 字段必须为 "无法推荐"，"urgency" 必须为 "无关"。

    请严格按照以下 JSON 格式返回（不要包含 Markdown）：

    {
      "department": "推荐科室 或 无法推荐",
      "reason": "推荐理由 或 拒绝理由（说明为什么无法回答，例如：'这似乎不是医疗健康相关的问题'）",
      "urgency": "普通 / 紧急 / 立即拨打120 / 无关",
      "tips": "就诊贴士 或 引导用户重新描述症状"
    }
  `;

  try {
    console.log('开始调用 DeepSeek API...', { API_URL, symptoms: symptoms.substring(0, 50) });
    
    const response = await axios.post(API_URL, {
      model: "deepseek-chat", // Or "deepseek-v3"
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `用户输入：${symptoms}` }
      ],
      temperature: 0.1, // 降低温度使其更严格
      response_format: { type: 'json_object' } // Force JSON
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      timeout: 30000 // 30秒超时
    });

    console.log('API调用成功，响应状态:', response.status);

    // 检查响应结构
    if (!response || !response.data) {
      throw new Error(`API响应格式错误: 缺少data字段`);
    }

    const responseData = response.data;
    if (!responseData.choices || !responseData.choices[0]) {
      throw new Error(`API响应格式错误: 缺少choices字段 - ${JSON.stringify(responseData).substring(0, 200)}`);
    }

    const result = responseData.choices[0].message.content;
    
    // Attempt to parse JSON strictly
    let data;
    try {
      data = JSON.parse(result);
    } catch (e) {
      // Fallback if AI returns text wrapped in markdown
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleanJson);
    }

    return { success: true, data: data };
  } catch (error) {
    console.error('AI Triage Error:', error);
    console.error('Error Stack:', error.stack);
    console.error('Error Details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // 返回更详细的错误信息用于调试
    let errorMessage = 'AI 服务暂时繁忙，请稍后再试';
    let errorDetail = '';
    
    if (error.response) {
      // axios 响应错误
      errorMessage = `API错误: ${error.response.status} - ${error.response.statusText || '请求失败'}`;
      errorDetail = JSON.stringify(error.response.data || {}).substring(0, 500);
    } else if (error.request) {
      // 请求发出但没有收到响应
      errorMessage = '网络请求失败：未收到服务器响应';
      errorDetail = error.message || error.toString();
    } else if (error.code) {
      // 其他错误（如 ENOTFOUND, ETIMEDOUT 等）
      errorMessage = `网络错误: ${error.code} - ${error.message || '连接失败'}`;
      errorDetail = error.toString();
    } else if (error.message) {
      // 一般错误
      errorMessage = error.message;
      errorDetail = error.stack || error.toString();
    } else {
      errorDetail = error.toString();
    }
    
    return { 
      success: false, 
      error: errorMessage,
      detail: errorDetail.substring(0, 1000) // 限制长度避免过长
    };
  }
};

