// pages/guide/detail/index.js

const app = getApp();

Page({
  data: {
    id: '',
    info: {},
    sceneImage: ''
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 从全局数据查找对应的数据
    const item = app.globalData.firstAidData.find(item => item.id === id);
    if (!item) {
      wx.showToast({
        title: '未找到相关内容',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 根据急救方案ID生成对应的场景图片路径
    // scene1.jpg ~ scene7.jpg 对应 cpr, heimlich, stroke, heatstroke, bleeding, burns, bites
    const sceneMap = {
      'cpr': 1,
      'heimlich': 2,
      'stroke': 3,
      'heatstroke': 4,
      'bleeding': 5,
      'burns': 6,
      'bites': 7
    };
    
    const sceneNum = sceneMap[id];
    let sceneImage = '';
    if (sceneNum && item.videoUrl) {
      // 使用videoUrl的路径，将文件名替换为sceneX.jpg
      // 例如：cloud://.../assets/xinfeifusu.mp4 -> cloud://.../assets/scene1.jpg
      const basePath = item.videoUrl.replace(/\/[^\/]+\.mp4$/, '');
      sceneImage = `${basePath}/scene${sceneNum}.jpg`;
    }

    this.setData({
      id: id,
      info: item,
      sceneImage: sceneImage
    });
  },

  // 跳转到腾讯视频小程序
  jumpToBilibili() {
    // 急救方案ID到腾讯视频ID的映射
    const videoIdMap = {
      'cpr': '9MIZOsQT1eWKWUH',        // 心肺复苏
      'heimlich': 'k352117afk2',   // 海姆立克急救法
      'stroke': 'b3336o8le71',     // 脑卒中
      'heatstroke': 'b3087lp6pky', // 中暑急救
      'bleeding': 'd351624n07j',   // 外伤止血
      'burns': 'z0042qfbfav',      // 烧伤烫伤
      'bites': 'n3151i2tw66'       // 动物咬伤
    };

    const vid = videoIdMap[this.data.id];
    if (!vid) {
      wx.showToast({
        title: '未找到对应视频',
        icon: 'none'
      });
      return;
    }

    // 腾讯视频小程序AppID
    const tencentVideoAppId = 'wxa75efa648b60994b';
    console.log(`#小程序://腾讯视频/${vid}`)
    // 跳转到腾讯视频小程序
    wx.navigateToMiniProgram({
      appId: tencentVideoAppId,
      path: `#小程序://腾讯视频/${vid}`,
      envVersion: 'release',
      success: (res) => {
        console.log('跳转腾讯视频小程序成功', res);
      },
      fail: (err) => {
        console.error('跳转腾讯视频小程序失败', err);
      }
    });
  },

  // 复制更多急救知识链接（保留，以防其他地方使用）
  onOpenMoreInfo() {
    const url = 'https://www.bilibili.com/video/BV12H4y1K7Lm';

    wx.setClipboardData({
      data: url,
      success: function () {
        wx.showToast({
          title: '链接已复制',
          icon: 'success',
          duration: 2000
        });
      }
    });
  }
});

