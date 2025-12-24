// pages/guide/detail/index.js

const app = getApp();
const fs = wx.getFileSystemManager();

Page({
  data: {
    id: '',
    info: {},
    videoSrc: '', // 实际播放的URL（本地或云端）
    isDownloading: false
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

    this.setData({
      id: id,
      info: item
    });

    // 如果有视频URL，启动智能加载逻辑
    if (item.videoUrl) {
      this.loadVideo(id, item.videoUrl);
    }
  },

  // [优化] 智能加载：立即播放，后台缓存
  async loadVideo(id, cloudUrl) {
    const fileName = `${id}_v1.mp4`; // 版本号便于后续更新视频
    const localPath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    try {
      // 1. 尝试访问本地缓存
      fs.accessSync(localPath);
      console.log('🎉 命中本地缓存，离线播放:', localPath);
      this.setData({ videoSrc: localPath });
    } catch (e) {
      // 2. 如果是 cloud:// 格式，需要转换为临时 HTTP URL（安卓兼容性）
      let videoUrl = cloudUrl;
      if (cloudUrl && cloudUrl.startsWith('cloud://')) {
        try {
          console.log('🔄 转换 cloud:// 格式为临时 URL...');
          const tempFileRes = await wx.cloud.getTempFileURL({
            fileList: [cloudUrl]
          });
          if (tempFileRes.fileList && tempFileRes.fileList.length > 0 && tempFileRes.fileList[0].tempFileURL) {
            videoUrl = tempFileRes.fileList[0].tempFileURL;
            console.log('✅ 转换成功，使用临时 URL 播放');
          } else {
            console.warn('⚠️ 转换失败，尝试直接使用 cloud:// URL');
          }
        } catch (err) {
          console.error('❌ 获取视频临时URL失败:', err);
          // 如果转换失败，尝试直接使用 cloud://（某些情况下可能可以工作）
          videoUrl = cloudUrl;
        }
      }
      
      // 3. 设置视频源并开始播放
      console.log('🚀 启用云端流式播放 (边下边播)');
      this.setData({ videoSrc: videoUrl });

      // 4. 后台悄悄下载，为"下次"做好准备
      this.downloadAndCache(cloudUrl, localPath);
    }
  },

  // 后台静默缓存（不影响当前播放）
  downloadAndCache(cloudUrl, localPath) {
    if (this.data.isDownloading) return;
    this.setData({ isDownloading: true });

    console.log('💾 开始后台静默缓存...');
    wx.cloud.downloadFile({
      fileID: cloudUrl,
      success: res => {
        // 保存临时文件到永久路径
        fs.saveFile({
          tempFilePath: res.tempFilePath,
          filePath: localPath,
          success: (saveRes) => {
            console.log('✅ 缓存成功 (下次打开生效):', saveRes.savedFilePath);
            // 注意：这里不要 setData videoSrc，否则会打断当前正在看的视频
            this.setData({ isDownloading: false });
          },
          fail: (err) => {
            console.error('保存缓存文件失败:', err);
            this.setData({ isDownloading: false });
          }
        });
      },
      fail: (err) => {
        console.error('后台缓存失败 (不影响当前观看):', err);
        this.setData({ isDownloading: false });
      }
    });
  },

  // 复制更多急救知识链接
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

