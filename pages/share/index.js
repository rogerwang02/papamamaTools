// pages/share/index.js

// === 云壁纸配置 ===
// FIX: Use Cloud FileID Protocol to avoid 403 Forbidden errors
// Base ID extracted from your error log: 636c-cloud1-0gum144f4caaf976-1258603821
const CLOUD_BASE_ID = 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets'; 
// Note: We'll construct the full ID dynamically: base + / + filename
const REMOTE_BGS = ['bg1.jpg', 'bg2.jpg', 'bg3.jpg'];

// === 屏安签文 ===
const safetyQuotes = [
  "点亮屏幕，许你岁岁屏安。",
  "无论去往哪里，都要平安归来。",
  "您的健康，是我们最大的福气。",
  "别怕麻烦，电话这头，我随时都在。",
  "在这座城市，请照顾好独一无二的自己。",
  "愿你的坚强，都有软肋可依。",
  "慢慢长大，世界等你探索。"
];

Page({
  data: {
    cardId: '',
    qrCodePath: '',
    currentMode: 'print', // 'print' 或 'wallpaper'
    canvasWidth: 300,
    canvasHeight: 450, // 打印模式默认高度 (300 * 1.5)
    canvasStyleWidth: '280px', // 初始值会在 onLoad 中通过 updateCanvasSize 更新为正确的 px 值
    canvasStyleHeight: '405px', // 初始值会在 onLoad 中通过 updateCanvasSize 更新为正确的 px 值
    canvas: null,
    ctx: null,
    selectedBgPath: '',
    showDefaultBgSelector: false,
    selectedBgIndex: -1,
    // 默认壁纸图片路径（初始为空，将通过 initRemoteWallpapers 加载）
    defaultWallpapers: [],
    // 二维码 widget 位置（Canvas 坐标系）
    qrWidgetX: null, // Canvas 坐标系的 X
    qrWidgetY: null, // Canvas 坐标系的 Y
    // 二维码 widget 浮动层位置（屏幕坐标系）
    qrWidgetOverlayLeft: 0, // 浮动层的左边距（px）
    qrWidgetOverlayTop: 0, // 浮动层的上边距（px）
    qrWidgetOverlayWidth: 240, // 浮动层的宽度（px）- 超瘦身版竖版默认
    qrWidgetOverlayHeight: 312, // 浮动层的高度（px）- 超瘦身版竖版默认
    // Canvas 显示尺寸（用于拖拽边界计算）
    canvasDisplayWidth: 0,
    canvasDisplayHeight: 0,
    // 拖拽状态
    isDragging: false, // 是否正在拖拽
    touchStartX: 0, // 触摸开始时的 X 坐标（屏幕坐标）
    touchStartY: 0, // 触摸开始时的 Y 坐标（屏幕坐标）
    startOverlayLeft: 0, // 拖拽开始时 overlay 的左边距
    startOverlayTop: 0, // 拖拽开始时 overlay 的上边距
    startCanvasX: 0, // 拖拽开始时 widget 的 Canvas X 坐标
    startCanvasY: 0, // 拖拽开始时 widget 的 Canvas Y 坐标
    // 图片路径追踪（用于判断是否需要重新加载）
    lastBgImagePath: '', // 上次加载的背景图片路径
    lastQRCodePath: '', // 上次加载的二维码路径
    // 保存状态
    isSaving: false, // 控制保存时的视觉状态，防止双重视觉效果
    // 屏安签文
    selectedQuote: '', // 随机选中的签文
    // 是否已显示壁纸模式提示框
    hasShownWallpaperTip: false
  },

  // 实例变量：缓存图片对象（不能存储在 data 中，因为 setData 无法序列化 Native Image 对象）
  bgImageCache: null, // 缓存的背景图片对象
  qrImageCache: null, // 缓存的二维码图片对象
  // 节流定时器和缓存
  redrawTimer: null, // Canvas 重绘的定时器（用于节流）
  canvasRectCache: null, // 缓存的 Canvas 位置信息

  // 辅助函数：计算二维码Widget右下角默认位置
  getDefaultQRWidgetPosition() {
    const canvasW = this.data.canvasWidth || 750;
    const canvasH = this.data.canvasHeight || 1250;
    const margin = 40; // 边距
    
    // 判断是横版还是竖版（根据canvas宽高比）
    const isLandscape = canvasW > canvasH;
    const widgetWidth = isLandscape ? 220 : 240;
    const widgetHeight = isLandscape ? 292 : 312;
    
    return {
      x: canvasW - widgetWidth - margin,
      y: canvasH - widgetHeight - margin,
      widgetWidth,
      widgetHeight
    };
  },

  // 更新Canvas尺寸（根据模式）
  updateCanvasSize(mode) {
    const sysInfo = wx.getSystemInfoSync();
    const windowWidth = sysInfo.windowWidth;

    // rpx -> px 转换
    const rpx2px = (rpx) => (windowWidth / 750) * rpx;

    // 1. 定义尺寸配置
    // [实体打印版]: 保持原样 (ID卡风格)
    // [手机壁纸版]: 极致铺满 (Full Fill)
    const printConfig = {
        cssW: 540,
        cssH: 810,
        logW: 300,
        logH: 450
    };
    const wallConfig = {
        cssW: 690, 
        cssH: 1150,
        logW: 750,  // 提高内部绘图分辨率
        logH: 1250
    };
    const config = mode === 'print' ? printConfig : wallConfig;

    // 2. 转换为 px 字符串（避免 rpx 动态更新导致的渲染层崩溃）
    const styleWidth = `${rpx2px(config.cssW)}px`;
    const styleHeight = `${rpx2px(config.cssH)}px`;
    
    // 3. 定义内部绘图逻辑尺寸 (用于计算坐标)
    const logicalWidth = config.logW;
    const logicalHeight = config.logH;
    
    // 更新 CSS 样式尺寸（用于 WXML 显示）
    this.setData({
      canvasStyleWidth: styleWidth,
      canvasStyleHeight: styleHeight,
      canvasWidth: logicalWidth,
      canvasHeight: logicalHeight
    });
    
    return { logicalWidth, logicalHeight, styleWidth, styleHeight };
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }

    // 确保默认模式为打印模式（医疗级卡片）
    this.setData({
      cardId: id,
      currentMode: 'print' // 显式设置为打印模式，确保初始视图显示医疗级卡片
    });

    // === 关键：页面一进来，强制初始化为【实体打印版】样式 ===
    // 这样用户看到的第一眼就是带有医疗水印和心电图的高级卡片
    // 初始化 Canvas 尺寸（使用打印模式默认尺寸）
    // 必须在 initCanvas 之前调用，确保样式已设置
    this.updateCanvasSize('print');
    
    // === 初始化远程壁纸（下载并缓存） ===
    this.initRemoteWallpapers();
    
    // 初始化 Canvas
    this.initCanvas().then(() => {
      // 生成二维码
      this.generateQRCode(id);
    });
  },

  // 初始化 Canvas
  async initCanvas() {
    return new Promise((resolve) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#preview-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            console.error('Canvas 初始化失败');
            resolve();
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          const dpr = wx.getSystemInfoSync().pixelRatio;
          // 使用 data 中已设置的尺寸，如果没有则使用打印模式默认值
          const width = this.data.canvasWidth || 300;
          const height = this.data.canvasHeight || 450; // 默认打印模式高度 (300 * 1.5)
          
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
          
          this.setData({
            canvas: canvas,
            ctx: ctx,
            canvasWidth: width,
            canvasHeight: height
          });
          
          resolve();
        });
    });
  },

  // 生成二维码
  async generateQRCode(cardId) {
    wx.showLoading({
      title: '生成二维码...',
      mask: true
    });

    try {
      // 随机选择屏安签文
      const randomQuote = safetyQuotes[Math.floor(Math.random() * safetyQuotes.length)];
      this.setData({ selectedQuote: randomQuote });

      const res = await wx.cloud.callFunction({
        name: 'createQRCode',
        data: {
          scene: cardId,
          page: 'pages/emergency/index',
          width: 430
        }
      });

      if (res.result && res.result.success) {
        // 下载二维码到本地临时文件
        const downloadRes = await wx.cloud.downloadFile({
          fileID: res.result.fileID
        });

        // 获取图片信息，确保图片已下载
        const imageInfo = await wx.getImageInfo({
          src: downloadRes.tempFilePath
        });

        wx.hideLoading();

        this.setData({
          qrCodePath: downloadRes.tempFilePath,
          qrCodeImageInfo: imageInfo
        });

        // 默认绘制打印版
        if (this.data.canvas && this.data.ctx) {
          const width = this.data.canvasWidth || 300;
          const height = this.data.canvasHeight || 450;
          await this.drawPrintableMode(this.data.canvas, this.data.ctx, downloadRes.tempFilePath, width, height);
        }
      } else {
        throw new Error('生成二维码失败');
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '生成二维码失败',
        icon: 'none'
      });
    }
  },

  // Tab 切换并重置画布尺寸（支持自适应高度）
  async onTabChange(e) {
    const mode = e.currentTarget.dataset.mode;
    
    // 默认配置变量
    let cssW = 0;
    let cssH = 0;
    let logW = 0;
    let logH = 0;

    if (mode === 'print') {
      // [打印模式] 固定尺寸 (2:3 比例)
      cssW = 540;
      cssH = 810;
      logW = 300;
      logH = 450;
      
      this.applyCanvasSize(mode, cssW, cssH, logW, logH);

    } else {
      // [壁纸模式] 自适应高度
      cssW = 750; // 全屏宽度
      
      // 根据图片确定高度（如果没有选择背景，默认使用第一张图片）
      let bgImage = this.data.selectedBgPath;
      if (!bgImage || bgImage.startsWith('#')) {
        // 如果没有选择背景或者是颜色值，使用默认第一张图片
        bgImage = this.data.defaultWallpapers && this.data.defaultWallpapers.length > 0 
          ? this.data.defaultWallpapers[0] 
          : '';
        // 只有当有默认壁纸时才设置，避免设置为 undefined
        if (bgImage) {
          this.setData({
            selectedBgPath: bgImage,
            selectedBgIndex: 0
          });
        }
      }
      
      if (bgImage && !bgImage.startsWith('#')) {
        try {
          // 获取图片宽高比
          const imgInfo = await wx.getImageInfo({ src: bgImage });
          const ratio = imgInfo.height / imgInfo.width;
          
          // 计算高度 (宽度 750 * 比例)
          // 限制最大高度以避免超长图片导致崩溃 (例如最大 1600rpx)
          const calcHeight = Math.min(750 * ratio, 1600); 
          
          cssH = calcHeight;
          logW = 750;
          logH = 750 * ratio; // 内部分辨率匹配比例
          
        } catch (e) {
          console.error('获取图片信息失败', e);
          // 如果图片加载失败，回退到默认高比例
          cssH = 1334; 
          logW = 750;
          logH = 1334;
        }
      } else {
        // 如果仍然是颜色值（不应该发生），使用默认高比例
        cssH = 1200;
        logW = 750;
        logH = 1334;
      }

      this.applyCanvasSize(mode, cssW, cssH, logW, logH);
      
      // === FIX: 切换到壁纸模式时，如果二维码位置未初始化，默认位置设置为右下角 ===
      if (mode === 'wallpaper') {
        if (this.data.qrWidgetX === null || this.data.qrWidgetY === null) {
          // 默认位置：右下角（安全区域）
          const defaultPos = this.getDefaultQRWidgetPosition();
          
          // 计算屏幕像素位置（用于 overlay）
          const sysInfo = wx.getSystemInfoSync();
          const rpx2px = (rpx) => (sysInfo.windowWidth / 750) * rpx;
          const overlayLeftPx = defaultPos.x * rpx2px(1); // 近似值，实际会在 initOverlayPosition 中重新计算
          const overlayTopPx = defaultPos.y * rpx2px(1);
          
          this.setData({
            qrWidgetX: defaultPos.x,
            qrWidgetY: defaultPos.y,
            // 临时设置 overlay 位置，会在 initOverlayPosition 中根据实际 canvas 尺寸重新计算
            qrWidgetOverlayLeft: overlayLeftPx,
            qrWidgetOverlayTop: overlayTopPx
          });
        }
        
        // 第一次进入壁纸模式时显示提示框
        if (!this.data.hasShownWallpaperTip) {
          setTimeout(() => {
            wx.showModal({
              title: '提示',
              content: '请移动二维码至合适位置后保存壁纸',
              showCancel: false,
              confirmText: '我知道了',
              confirmColor: '#FF6B00'
            });
            this.setData({
              hasShownWallpaperTip: true
            });
          }, 500); // 延迟500ms，确保页面渲染完成
        }
      }
    }
  },

  // 辅助函数：应用 Canvas 尺寸
  applyCanvasSize(mode, cssW, cssH, logW, logH) {
    const sysInfo = wx.getSystemInfoSync();
    const dpr = sysInfo.pixelRatio;
    const windowWidth = sysInfo.windowWidth;
    const rpx2px = (rpx) => (windowWidth / 750) * rpx;

    const styleWidth = `${rpx2px(cssW)}px`;
    const styleHeight = `${rpx2px(cssH)}px`;

    this.setData({
      currentMode: mode,
      canvasStyleWidth: styleWidth,
      canvasStyleHeight: styleHeight,
      canvasWidth: logW,
      canvasHeight: logH,
      showDefaultBgSelector: false
    }, () => {
      if (this.data.canvas && this.data.ctx) {
        // 重置物理分辨率
        this.data.canvas.width = logW * dpr;
        this.data.canvas.height = logH * dpr;
        this.data.ctx.scale(dpr, dpr);
        
        // 延迟绘制确保布局稳定
        setTimeout(() => {
          const canvas = this.data.canvas;
          const ctx = this.data.ctx;
          const qrCodePath = this.data.qrCodePath;
          const selectedBgPath = this.data.selectedBgPath || '';
          
          if (qrCodePath) {
            if (mode === 'print') {
              this.drawPrintableMode(canvas, ctx, qrCodePath, logW, logH);
            } else {
              this.drawWallpaperMode(canvas, ctx, qrCodePath, selectedBgPath, false, true).then(() => {
                // 初始化 overlay 位置
                this.initOverlayPosition();
              });
            }
          }
        }, 100);
      } else {
        // 如果 Canvas 还未初始化，先初始化再绘制
        const that = this;
        this.initCanvas().then(async () => {
          if (that.data.qrCodePath && that.data.canvas && that.data.ctx) {
            const canvas = that.data.canvas;
            const ctx = that.data.ctx;
            const qrCodePath = that.data.qrCodePath;
            const selectedBgPath = that.data.selectedBgPath || '';
            
            if (mode === 'print') {
              await that.drawPrintableMode(canvas, ctx, qrCodePath, logW, logH);
            } else {
              await that.drawWallpaperMode(canvas, ctx, qrCodePath, selectedBgPath, false, true);
              // 初始化 overlay 位置
              that.initOverlayPosition();
            }
          }
        });
      }
    });
  },

  // 绘制打印版
  async drawPrintableMode(canvas, ctx, qrCodePath, width, height) {
    // 使用传入的参数，避免在异步中访问 this.data
    width = width || 300;
    height = height || 450;

    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 1. 绘制高级医疗背景
    this.drawMedicalBackground(ctx, width, height);

    // 2. 绘制卡片边框 (双线装饰，增加正式感)
    ctx.strokeStyle = '#FF6B00';
    ctx.lineWidth = 2;
    this.drawRoundRect(ctx, 10, 10, width - 20, height - 20, 16);
    ctx.stroke();

    // 3. 绘制标题 (图片 Icon + 文字 居中)
    ctx.font = 'bold 28px sans-serif';
    const textStr = '紧急医疗卡';
    const textWidth = ctx.measureText(textStr).width;
    
    const iconSize = 32; // 图标尺寸
    const gap = 12;      // 间距
    const totalWidth = iconSize + gap + textWidth;
    
    // 计算居中起始点
    const startX = (width - totalWidth) / 2;
    const headerBaseY = 70; // 文字基线 Y（稍微下移以适应新布局）

    // 加载并绘制本地图片 Icon
    try {
      const iconImg = canvas.createImage();
      await new Promise((resolve) => {
        iconImg.onload = resolve;
        iconImg.onerror = (e) => {
          console.error('加载 warn.png 失败', e);
          resolve(); // 失败也要继续画文字
        };
        iconImg.src = '../../assets/warn.png';
      });
      
      // 绘制图片 (垂直居中微调)
      ctx.drawImage(iconImg, startX, headerBaseY - 26, iconSize, iconSize);
    } catch (e) {
      console.error('绘制图标流程出错', e);
    }

    // 绘制文字 (红色)
    ctx.fillStyle = '#FF3B30';
    ctx.textAlign = 'left';
    ctx.fillText(textStr, startX + iconSize + gap, headerBaseY);
    
    // 添加英文副标题
    ctx.fillStyle = '#333333';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMERGENCY MEDICAL CARD', width / 2, headerBaseY + 24);

    // 4. 绘制二维码区域 (加上轻微投影，制造悬浮感)
    const qrSize = width * 0.6;
    const qrX = (width - qrSize) / 2;
    const qrY = (height - qrSize) / 2 - 20; // 稍微上移

    // 白底衬托二维码
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    this.drawRoundRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    if (qrCodePath) {
      try {
        const qrImage = canvas.createImage();
        await new Promise((resolve, reject) => {
          qrImage.onload = resolve;
          qrImage.onerror = reject;
          qrImage.src = qrCodePath;
        });
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      } catch (e) { 
        console.error('绘制二维码失败:', e); 
      }
    }

    // 5. 底部装饰：心电图 + 提示语
    const bottomY = height - 60;
    this.drawECGLine(ctx, 40, bottomY - 30, width - 80);

    ctx.fillStyle = '#666666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('如遇紧急情况，请扫码查看紧急联系人', width / 2, bottomY + 10);
    ctx.fillText('Please scan for emergency contact', width / 2, bottomY + 30);
  },

  // 辅助函数：Promise 化的图片加载器
  loadImage(canvas, src) {
    return new Promise((resolve, reject) => {
      if (!src) return resolve(null);
      const img = canvas.createImage();
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.error('图片加载失败:', src, e);
        resolve(null); // 返回 null 允许绘制继续
      };
      img.src = src;
    });
  },

  // 绘制壁纸版
  async drawWallpaperMode(canvas, ctx, qrCodePath, bgImagePath, skipImageLoad = false, onlyBackground = true) {
    const width = this.data.canvasWidth;
    const height = this.data.canvasHeight;

    // 1. 清除画布
    ctx.clearRect(0, 0, width, height);

    // 背景色
    const defaultBgColor = (bgImagePath && bgImagePath.startsWith('#')) 
                          ? bgImagePath 
                          : '#FFFFFF';
    ctx.fillStyle = defaultBgColor;
    ctx.fillRect(0, 0, width, height);

    // 2. 绘制背景图片
    if (bgImagePath && !bgImagePath.startsWith('#')) {
      try {
        // 使用缓存防止拖拽时闪烁
        let bgImage = this.bgImageCache;
        if (!bgImage || this.data.lastBgImagePath !== bgImagePath) {
          bgImage = await this.loadImage(canvas, bgImagePath);
          this.bgImageCache = bgImage;
          this.setData({ lastBgImagePath: bgImagePath });
        }
        
        // 绘制全屏 (0,0 到 width,height)
        if (bgImage) {
          ctx.drawImage(bgImage, 0, 0, width, height);
        }
      } catch(e) {
        console.error('背景图绘制失败', e);
      }
    }

    // === 3. 绘制 Widget（合成逻辑） ===
    if (!onlyBackground) {
      // --- 布局配置 ---
      // 检测图片是横版还是竖版
      let isLandscape = false;
      if (bgImagePath && !bgImagePath.startsWith('#')) {
        try {
          const imgInfo = await wx.getImageInfo({ src: bgImagePath });
          isLandscape = imgInfo.width > imgInfo.height;
        } catch(e) {
          isLandscape = false;
        }
      }
      
      // === 【最终校准尺寸】 ===
      const widgetWidth = isLandscape ? 220 : 240;
      const qrImgSize = isLandscape ? 180 : 200;
      const padding = 20;   // 内边距
      const textGap = 16;   // 二维码与文字的间距
      const widgetHeight = isLandscape ? 292 : 312;

      // 坐标
      let cardX = this.data.qrWidgetX;
      let cardY = this.data.qrWidgetY;
      
      // 安全回退：使用右下角默认位置
      if (cardX === null || cardY === null) {
        const defaultPos = this.getDefaultQRWidgetPosition();
        cardX = defaultPos.x;
        cardY = defaultPos.y;
      }

      // 边界检查
      const maxX = width - widgetWidth;
      const maxY = height - widgetHeight;
      cardX = Math.max(0, Math.min(cardX, maxX));
      cardY = Math.max(0, Math.min(cardY, maxY));

      // A. 卡片背景
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;

      const gradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + widgetHeight);
      gradient.addColorStop(0, '#FFFFFF'); 
      gradient.addColorStop(1, '#FFF0E5');
      ctx.fillStyle = gradient;

      // 计算圆角值以匹配 CSS 的 40rpx
      // CSS: border-radius: 40rpx，widget 宽度在 CSS 中约为 240rpx
      // CSS 圆角比例: 40rpx / 240rpx = 16.67%
      // 为了在 Canvas 中保持相同的视觉比例，圆角应该为 widgetWidth 的 16.67%
      // Canvas widgetWidth 240px，圆角 = 240 * 0.1667 ≈ 40px
      // 横版 widgetWidth 220px，圆角 = 220 * 0.1667 ≈ 37px
      // 使用较大的值以确保圆角足够圆
      const borderRadius = isLandscape ? 37 : 40; // 匹配 CSS 的 40rpx 比例
      this.drawRoundRect(ctx, cardX, cardY, widgetWidth, widgetHeight, borderRadius);
      ctx.fill();
      ctx.restore(); 

      // B. 绘制二维码
      if (qrCodePath) {
        const qrImage = await this.loadImage(canvas, qrCodePath);
        if (qrImage) {
          const qrX = cardX + (widgetWidth - qrImgSize) / 2;
          const qrY = cardY + padding; 
          ctx.drawImage(qrImage, qrX, qrY, qrImgSize, qrImgSize);
        }
      }

      // C. 文字 (精确排版)
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const centerX = cardX + widgetWidth / 2;
      const fontSize = 22; // 统一字号 22px (匹配 CSS 22rpx)
      ctx.font = `bold ${fontSize}px sans-serif`;

      // 计算精确坐标
      // 第一行文字顶部 Y
      const text1Y = cardY + padding + qrImgSize + textGap;
      // 第二行文字顶部 Y = 第一行Y + 字号 + 间距(8px)
      // 间距 8px 对应 CSS 中的 gap: 6rpx (略微调整以适应 Canvas 渲染特性)
      const text2Y = text1Y + fontSize + 8;

      ctx.fillText('请在机主需要帮助时', centerX, text1Y);
      ctx.fillText('扫码查看紧急联系人', centerX, text2Y);
    }

    // D. 绘制屏安签文（在壁纸最下方，无论是否绘制Widget）
    if (this.data.selectedQuote && !onlyBackground) {
      const quoteFontSize = 16; // 签文字体大小
      const quoteColor = '#666666'; // 深灰色，也可以使用主色调 #FF6B00
      const maxQuoteWidth = width - 40; // 左右各留20px边距
      const bottomMargin = 30; // 距离底部30px
      
      ctx.save();
      ctx.fillStyle = quoteColor;
      ctx.font = `${quoteFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top'; // 使用top对齐，从指定Y坐标向下绘制
      
      // 先计算文本需要的高度（估算）
      const estimatedLines = Math.ceil(this.data.selectedQuote.length / 12); // 每行约12个字符
      const lineHeight = quoteFontSize + 4;
      const totalTextHeight = estimatedLines * lineHeight;
      
      // 从底部向上计算起始Y坐标
      const quoteStartY = height - bottomMargin - totalTextHeight;
      
      // 使用 drawMultilineText 处理长文本自动换行
      this.drawMultilineText(
        ctx,
        this.data.selectedQuote,
        width / 2, // 居中X坐标
        quoteStartY,
        maxQuoteWidth,
        lineHeight
      );
      ctx.restore();
    }
  },


  // 辅助函数：绘制警告图标 (避免真机 Emoji 乱码)
  drawWarningIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    
    // 1. 绘制黄色圆角三角形背景
    ctx.beginPath();
    const h = size * 0.866; // 等边三角形高度
    const r = size * 0.1;   // 圆角半径
    
    // 顶点坐标计算 (简化版圆角三角形)
    ctx.moveTo(0, -h/2 + r); 
    ctx.lineTo(size/2 - r, h/2 - r);
    ctx.quadraticCurveTo(size/2, h/2, size/2 - r * 2, h/2);
    ctx.lineTo(-size/2 + r * 2, h/2);
    ctx.quadraticCurveTo(-size/2, h/2, -size/2 + r, h/2 - r);
    ctx.lineTo(0 - r, -h/2 + r);
    ctx.quadraticCurveTo(0, -h/2, r, -h/2 + r);
    
    ctx.closePath();
    ctx.fillStyle = '#FFCC00'; // 警告黄
    ctx.fill();

    // 2. 绘制感叹号 (黑色)
    ctx.fillStyle = '#000000';
    // 上半部分 (竖条)
    this.drawRoundRect(ctx, -2, -h/2 + 12, 4, 14, 2); 
    ctx.fill();
    // 下半部分 (圆点)
    ctx.beginPath();
    ctx.arc(0, h/2 - 10, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // 绘制多行文本，返回最后一行文字的 Y 坐标
  drawMultilineText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    let currentY = y;

    // 设置对齐方式为居中
    ctx.textAlign = 'center'; 

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, currentY);
        line = words[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    // 绘制最后一行
    ctx.fillText(line, x, currentY);
    
    // 返回最后一行文字的底部Y坐标（加上字体大小的一半，表示文本区域的底部）
    // 使用字体大小来估算文本基线到字符底部的距离
    const fontSize = parseInt(ctx.font.match(/\d+/)[0]);
    return currentY + fontSize * 0.4; // 返回文本区域底部位置
  },

  // 绘制圆角矩形
  drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  },

  // === 绘制医疗背景与水印 ===
  drawMedicalBackground(ctx, width, height) {
    ctx.save();
    
    // A. 柔和渐变背景 (暖白 -> 淡橙红)
    // 这种色调打印出来很显高级，不刺眼
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#FFFFFF'); 
    gradient.addColorStop(1, '#FFF0E5'); // 淡橙色
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // B. 巨型医疗十字水印 (极淡)
    ctx.globalAlpha = 0.03; // 3% 透明度，隐约可见
    ctx.fillStyle = '#FF3B30';
    
    const crossSize = width * 0.6;
    const cx = width / 2;
    const cy = height / 2;
    const barWidth = crossSize / 3;
    
    // 绘制十字
    ctx.beginPath();
    // 竖条
    ctx.rect(cx - barWidth/2, cy - crossSize/2, barWidth, crossSize);
    // 横条
    ctx.rect(cx - crossSize/2, cy - barWidth/2, crossSize, barWidth);
    ctx.fill();

    // C. 恢复透明度
    ctx.globalAlpha = 1.0;
    ctx.restore();
  },

  // === 绘制底部心电图线条 ===
  drawECGLine(ctx, x, y, w) {
    ctx.save();
    ctx.beginPath();
      ctx.strokeStyle = '#FF6B00'; // 橙红色线条
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 绘制心跳波形: 平 -> 起 -> 落 -> 起 -> 平
    const baseH = 20; // 波峰高度
    
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.3, y); // 前段平线
    
    // PQRST 波形模拟
    ctx.lineTo(x + w * 0.35, y - 5);
    ctx.lineTo(x + w * 0.4, y + 5);
    ctx.lineTo(x + w * 0.45, y - baseH); // 高峰
    ctx.lineTo(x + w * 0.5, y + baseH * 0.8); // 低谷
    ctx.lineTo(x + w * 0.55, y); 
    
    ctx.lineTo(x + w, y); // 后段平线
    ctx.stroke();
    ctx.restore();
  },

  // === 初始化远程壁纸（下载并缓存） ===
  async initRemoteWallpapers() {
    const fs = wx.getFileSystemManager();
    const finalPaths = [];
    
    console.log('Starting cloud wallpaper sync...');

    for (const fileName of REMOTE_BGS) {
      const cacheKey = `cached_bg_${fileName}`;
      let localPath = wx.getStorageSync(cacheKey);
      let needDownload = true;

      // 1. Check Cache
      if (localPath) {
        try {
          fs.accessSync(localPath);
          needDownload = false;
          console.log(`Hit cache for ${fileName}`);
        } catch (e) {
          console.log(`Cache invalid for ${fileName}, redownloading...`);
        }
      }

      // 2. Download via Cloud API (Fixes 403)
      if (needDownload) {
        try {
          // Construct FileID: cloud://<env-id>.assets/<filename>
          const fileID = `${CLOUD_BASE_ID}/${fileName}`;
          
          const res = await wx.cloud.downloadFile({
            fileID: fileID
          });

          if (res.statusCode === 200 && res.tempFilePath) {
            const savedFilePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
            fs.saveFileSync(res.tempFilePath, savedFilePath);
            
            localPath = savedFilePath;
            wx.setStorageSync(cacheKey, localPath);
            console.log(`Cloud Downloaded & Cached: ${fileName}`);
          } else {
            // Download failed - skip this file
            console.warn(`⚠️ 背景图下载失败: ${fileName}, status: ${res.statusCode || 'UNKNOWN'}`);
            console.warn('💡 提示：请检查云开发控制台 -> 存储 -> 权限设置，确保文件为"所有用户可读"');
            localPath = null; // Explicitly set to null, don't add to finalPaths
          }
        } catch (err) {
          console.error(`❌ 背景图加载失败: ${fileName}`, err);
          console.warn('💡 提示：请检查云开发控制台 -> 存储 -> 权限设置，确保文件为"所有用户可读"');
          // If download fails, skip this file (don't add undefined to finalPaths)
          localPath = null;
        }
      }
      
      if (localPath) {
        finalPaths.push(localPath);
      }
    }

    // 3. Update Data
    if (finalPaths.length > 0) {
      this.setData({ defaultWallpapers: finalPaths });
    }
  },

  // 上传照片
  async onUploadPhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        // UX: 滚动到顶部，让用户看到画布
        wx.pageScrollTo({
          scrollTop: 0,
          duration: 300
        });
        
        // 更新背景路径
        this.setData({
          selectedBgPath: tempFilePath,
          selectedBgIndex: -1,
          showDefaultBgSelector: false
        });
        
        // 如果当前是壁纸模式，需要重新计算 Canvas 尺寸并绘制
        if (this.data.currentMode === 'wallpaper') {
          await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
          // 延时100毫秒后再重置二维码浮层位置，防止二维码部分被边界遮住
          setTimeout(() => {
            // 重置 Widget 位置到右下角（安全区域）
            const defaultPos = this.getDefaultQRWidgetPosition();
            this.setData({
              qrWidgetX: defaultPos.x,    // Canvas Coordinate (px)
              qrWidgetY: defaultPos.y,    // Canvas Coordinate (px)
              // Overlay 位置会在 initOverlayPosition 中根据 canvas 尺寸重新计算
              qrWidgetOverlayLeft: 0,
              qrWidgetOverlayTop: 0
            });
            this.initOverlayPosition();
          }, 100);
        } else if (this.data.qrCodePath && this.data.canvas && this.data.ctx) {
          // 如果不是壁纸模式，切换到壁纸模式
          await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
          // 延时100毫秒后再重置二维码浮层位置，防止二维码部分被边界遮住
          setTimeout(() => {
            // 重置 Widget 位置到右下角（安全区域）
            const defaultPos = this.getDefaultQRWidgetPosition();
            this.setData({
              qrWidgetX: defaultPos.x,
              qrWidgetY: defaultPos.y,
              qrWidgetOverlayLeft: 0,
              qrWidgetOverlayTop: 0
            });
            this.initOverlayPosition();
          }, 100);
        }
      },
      fail: (err) => {
        console.error('选择照片失败:', err);
      }
    });
  },

  // 选择默认背景
  onSelectDefaultBg() {
    this.setData({
      showDefaultBgSelector: !this.data.showDefaultBgSelector
    });
  },

  // 选择背景
  async onSelectBg(e) {
    const index = e.currentTarget.dataset.index;
    const bgImagePath = this.data.defaultWallpapers && this.data.defaultWallpapers[index] 
      ? this.data.defaultWallpapers[index] 
      : '';
    
    // 如果路径无效，不更新（避免设置为 undefined）
    if (!bgImagePath) {
      console.warn('⚠️ 背景图片路径无效，index:', index);
      return;
    }
    
    // UX: 滚动到顶部，让用户看到画布
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
    
    // 更新背景路径
    this.setData({
      selectedBgIndex: index,
      selectedBgPath: bgImagePath, // 使用图片路径
      showDefaultBgSelector: false
    });

    // 如果当前是壁纸模式，需要重新计算 Canvas 尺寸并绘制（自适应高度）
    if (this.data.currentMode === 'wallpaper') {
      await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
      // 延时100毫秒后再重置二维码浮层位置，防止二维码部分被边界遮住
      setTimeout(() => {
        // 重置 Widget 位置到右下角（安全区域）
        const defaultPos = this.getDefaultQRWidgetPosition();
        this.setData({
          qrWidgetX: defaultPos.x,    // Canvas Coordinate (px)
          qrWidgetY: defaultPos.y,    // Canvas Coordinate (px)
          // Overlay 位置会在 initOverlayPosition 中根据 canvas 尺寸重新计算
          qrWidgetOverlayLeft: 0,
          qrWidgetOverlayTop: 0
        });
        this.initOverlayPosition();
      }, 100);
    } else if (this.data.qrCodePath && this.data.canvas && this.data.ctx) {
      // 如果不是壁纸模式，切换到壁纸模式
      await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
      // 延时100毫秒后再重置二维码浮层位置，防止二维码部分被边界遮住
      setTimeout(() => {
        // 重置 Widget 位置到右下角（安全区域）
        const defaultPos = this.getDefaultQRWidgetPosition();
        this.setData({
          qrWidgetX: defaultPos.x,
          qrWidgetY: defaultPos.y,
          qrWidgetOverlayLeft: 0,
          qrWidgetOverlayTop: 0
        });
        this.initOverlayPosition();
      }, 100);
    }
  },

  // 保存打印图片
  async onSavePrintImage() {
    if (!this.data.qrCodePath) {
      wx.showToast({
        title: '二维码未生成',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      const tempFilePath = await this.canvasToTempFilePath();
      
      await wx.saveImageToPhotosAlbum({
        filePath: tempFilePath
      });

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('保存失败:', error);
      wx.hideLoading();
      
      // FIX: Handle Auth Deny by guiding user to settings
      const errMsg = error.errMsg || '';
      if (errMsg.includes('auth deny') || errMsg.includes('authorize:fail')) {
        wx.showModal({
          title: '权限提示',
          content: '保存图片需要您的相册授权，请在设置中开启',
          confirmText: '去设置',
          showCancel: true,
          success: (res) => {
            if (res.confirm) {
              wx.openSetting({
                success: (settingRes) => {
                  if (settingRes.authSetting['scope.writePhotosAlbum']) {
                    wx.showToast({ title: '授权成功，请重试', icon: 'none' });
                  }
                }
              });
            }
          }
        });
      } else if (!errMsg.includes('cancel')) {
        // Generic error (ignore user cancellation)
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    }
  },

  // 保存壁纸图片
  async onSaveWallpaperImage() {
    if (!this.data.qrCodePath) {
      wx.showToast({
        title: '二维码未生成',
        icon: 'none'
      });
      return;
    }

    // 1. Start Save Mode: Hide DOM
    this.setData({ isSaving: true });
    
    // Wait for view update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Sync positions
    await new Promise((resolve) => {
      this.syncDOMToCanvasCoordinates();
      // 等待 setData 和 query 完成
      setTimeout(resolve, 100);
    });

    wx.showLoading({ title: '合成中...', mask: true });

    try {
      const canvas = this.data.canvas;
      const ctx = this.data.ctx;

      // 2. Draw Widget on Canvas
      await this.drawWallpaperMode(
        canvas,
        ctx,
        this.data.qrCodePath,
        this.data.selectedBgPath || this.data.defaultWallpapers[0] || '',
        false, 
        false  // Draw Widget = TRUE
      );

      // 3. Save
      const tempFilePath = await this.canvasToTempFilePath();
      await wx.saveImageToPhotosAlbum({ filePath: tempFilePath });

      wx.showToast({ title: '保存成功', icon: 'success' });

      // (Note: Cleanup logic removed from here)

    } catch (error) {
      console.error('保存失败:', error);
      
      // FIX: Handle Auth Deny by guiding user to settings
      const errMsg = error.errMsg || '';
      if (errMsg.includes('auth deny') || errMsg.includes('authorize:fail')) {
        wx.showModal({
          title: '权限提示',
          content: '保存图片需要您的相册授权，请在设置中开启',
          confirmText: '去设置',
          showCancel: true,
          success: (res) => {
            if (res.confirm) {
              wx.openSetting({
                success: (settingRes) => {
                  if (settingRes.authSetting['scope.writePhotosAlbum']) {
                    wx.showToast({ title: '授权成功，请重试', icon: 'none' });
                  }
                }
              });
            }
          }
        });
      } else if (!errMsg.includes('cancel')) {
        // Generic error (ignore user cancellation)
        wx.showToast({ 
          title: '保存失败', 
          icon: 'none' 
        });
      }
    } finally {
      wx.hideLoading();

      // === FIX: ALWAYS Cleanup Canvas (Success or Fail) ===
      try {
        const canvas = this.data.canvas;
        const ctx = this.data.ctx;
        // Revert to "Background Only"
        await this.drawWallpaperMode(
          canvas,
          ctx,
          this.data.qrCodePath,
          this.data.selectedBgPath || this.data.defaultWallpapers[0] || '',
          true, // Use cache
          true  // Only Background = TRUE
        );
      } catch (e) {
        console.error('Cleanup failed:', e);
      }

      // 4. End Save Mode: Show DOM overlay
      this.setData({ isSaving: false });
    }
  },

  // Canvas 转临时文件
  canvasToTempFilePath() {
    return new Promise((resolve, reject) => {
      if (!this.data.canvas) {
        reject(new Error('Canvas 未初始化'));
        return;
      }
      
      wx.canvasToTempFilePath({
        canvas: this.data.canvas,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: reject
      }, this);
    });
  },

  // ===== 初始化 Overlay 位置 =====
  initOverlayPosition() {
    if (this.data.currentMode !== 'wallpaper' || this.data.qrWidgetX === null || this.data.qrWidgetY === null) {
      return;
    }

    // 根据 canvas 的宽高比判断是横版还是竖版
    // Canvas 逻辑宽度通常是 750，如果高度小于宽度，可能是横版
    const isLandscape = this.data.canvasWidth > 0 && this.data.canvasHeight > 0 && 
                        this.data.canvasWidth > this.data.canvasHeight;

    const query = wx.createSelectorQuery().in(this);
    query.select('#preview-canvas').boundingClientRect((rect) => {
      if (!rect) return;

      // 计算 Canvas 到屏幕的缩放比例
      const scaleX = rect.width / this.data.canvasWidth;
      const scaleY = rect.height / this.data.canvasHeight;

      // === FIX: 使用统一的缩放比例，保持 overlay 宽高比不变 ===
      // 对于横版和竖版壁纸，使用 scaleX 和 scaleY 中的较小值，确保 overlay 不会被拉伸
      // 这样可以保证 overlay 在任何宽高比的 canvas 上都能保持正确的形状
      const scale = Math.min(scaleX, scaleY);

      // === 【最终校准尺寸】(Ultra Slim) ===
      // 竖版：卡片宽 240，QR 200
      // 横版：卡片宽 220，QR 180
      const baseWidgetWidth = isLandscape ? 220 : 240;
      
      // 高度精确计算: 
      // Pad(20) + QR + Gap(16) + Text(22) + Gap(8) + Text(22) + Pad(24)
      // 竖版 H: 20+200+16+22+8+22+24 = 312
      // 横版 H: 20+180+16+22+8+22+24 = 292
      const baseWidgetHeight = isLandscape ? 292 : 312;

      // === 关键修复：直接缩放，不加 rect.left ===
      // 因为 CSS 是 absolute inside relative，left=0 就是容器左上角
      const overlayLeft = this.data.qrWidgetX * scaleX;
      const overlayTop = this.data.qrWidgetY * scaleY;
      
      const overlayWidth = baseWidgetWidth * scale;
      const overlayHeight = baseWidgetHeight * scale;

      this.setData({
        canvasDisplayWidth: rect.width,
        canvasDisplayHeight: rect.height,
        qrWidgetOverlayLeft: overlayLeft,
        qrWidgetOverlayTop: overlayTop,
        qrWidgetOverlayWidth: overlayWidth,
        qrWidgetOverlayHeight: overlayHeight
      });
    }).exec();
  },

  // Helper: 将 DOM overlay 的像素坐标同步回 Canvas 逻辑坐标
  syncDOMToCanvasCoordinates() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#preview-canvas').boundingClientRect((rect) => {
      if (!rect) return;

      const scaleX = rect.width / this.data.canvasWidth;
      const scaleY = rect.height / this.data.canvasHeight;

      // === 关键修复：直接除以缩放比例，不减 rect.left ===
      // this.data.qrWidgetOverlayLeft 已经是相对于容器的坐标了
      const domLeft = this.data.qrWidgetOverlayLeft || 0;
      const domTop = this.data.qrWidgetOverlayTop || 0;

      const newCanvasX = domLeft / scaleX;
      const newCanvasY = domTop / scaleY;

      console.log('Sync Coords (Relative):', { domLeft, scaleX, newCanvasX });

      this.setData({
        qrWidgetX: newCanvasX,
        qrWidgetY: newCanvasY
      });
    }).exec();
  },

  // ===== 拖拽功能（新的 Overlay 拖拽处理） =====
  // 触摸开始（在 Overlay 上）
  onQRWidgetTouchStart(e) {
    const touch = e.touches[0];
    this.setData({
      isDragging: true,
      // 记录触摸开始的屏幕像素坐标
      touchStartX: touch.pageX,
      touchStartY: touch.pageY,
      // 记录 overlay 开始位置的屏幕像素坐标
      startOverlayLeft: this.data.qrWidgetOverlayLeft,
      startOverlayTop: this.data.qrWidgetOverlayTop
    });
  },

  // 触摸移动（在 Overlay 上）
  onQRWidgetTouchMove(e) {
    if (!this.data.isDragging) return;

    const touch = e.touches[0];
    
    // 计算移动增量（屏幕像素）
    const deltaX = touch.pageX - this.data.touchStartX;
    const deltaY = touch.pageY - this.data.touchStartY;

    // 计算新位置（相对于拖拽开始时的位置）
    // startOverlayLeft/Top 已经是容器相对坐标
    let newOverlayLeft = this.data.startOverlayLeft + deltaX;
    let newOverlayTop = this.data.startOverlayTop + deltaY;

    // === 边界检查（相对于容器，0 到 displaySize - widgetSize） ===
    const minLeft = 0;
    const minTop = 0;
    const maxLeft = this.data.canvasDisplayWidth - this.data.qrWidgetOverlayWidth;
    const maxTop = this.data.canvasDisplayHeight - this.data.qrWidgetOverlayHeight;

    // 限制在容器范围内（已经是相对坐标，直接使用）
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, newOverlayLeft));
    const clampedTop = Math.max(minTop, Math.min(maxTop, newOverlayTop));

    this.setData({
      qrWidgetOverlayLeft: clampedLeft,
      qrWidgetOverlayTop: clampedTop
    });
  },

  // 触摸结束（在 Overlay 上）
  onQRWidgetTouchEnd(e) {
    this.setData({ isDragging: false });
    // 重新计算 Canvas 坐标（用于保存时）
    this.recalcCanvasCoordsFromOverlay();
  },

  // 辅助函数：将 Overlay 屏幕位置同步回 Canvas 坐标
  recalcCanvasCoordsFromOverlay() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#preview-canvas').boundingClientRect((rect) => {
      if (!rect) return;

      const scaleX = rect.width / this.data.canvasWidth;
      const scaleY = rect.height / this.data.canvasHeight;

      // === 关键修复：直接除以缩放比例，不减 rect.left ===
      // this.data.qrWidgetOverlayLeft 已经是相对于容器的坐标了
      const domLeft = this.data.qrWidgetOverlayLeft || 0;
      const domTop = this.data.qrWidgetOverlayTop || 0;

      const canvasX = domLeft / scaleX;
      const canvasY = domTop / scaleY;

      const isLandscape = this.data.canvasWidth > this.data.canvasHeight;
      // === 【最终校准尺寸】 ===
      const widgetWidth = isLandscape ? 220 : 240;
      const widgetHeight = isLandscape ? 292 : 312;

      const clampedX = Math.max(0, Math.min(canvasX, this.data.canvasWidth - widgetWidth));
      const clampedY = Math.max(0, Math.min(canvasY, this.data.canvasHeight - widgetHeight));

      this.setData({
        qrWidgetX: clampedX,
        qrWidgetY: clampedY
      });
    }).exec();
  },

  // ===== 旧版拖拽功能（已废弃，保留以防万一） =====
  // 触摸开始
  onCanvasTouchStart(e) {
    // 只在壁纸模式下启用拖拽
    if (this.data.currentMode !== 'wallpaper') {
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;
    
    // 获取 Canvas 的位置信息
    const query = wx.createSelectorQuery().in(this);
    query.select('#preview-canvas').boundingClientRect((rect) => {
      if (!rect) {
        return;
      }

      // 微信小程序使用 pageX/pageY，如果没有则使用 x/y
      const touchX = touch.pageX || touch.x || 0;
      const touchY = touch.pageY || touch.y || 0;

      // 将屏幕坐标转换为 Canvas 坐标
      const canvasX = (touchX - rect.left) * (this.data.canvasWidth / rect.width);
      const canvasY = (touchY - rect.top) * (this.data.canvasHeight / rect.height);

      // 检查触摸点是否在二维码 widget 区域内（超瘦身版尺寸）
      const isLandscape = this.data.canvasWidth > this.data.canvasHeight;
      const widgetWidth = isLandscape ? 220 : 240;
      const widgetHeight = isLandscape ? 292 : 312;
      
      let cardX = this.data.qrWidgetX;
      let cardY = this.data.qrWidgetY;
      
      // 如果没有保存的位置，使用右下角默认位置
      if (cardX === null || cardY === null) {
        const defaultPos = this.getDefaultQRWidgetPosition();
        cardX = defaultPos.x;
        cardY = defaultPos.y;
        // 立即保存默认位置
        this.setData({
          qrWidgetX: cardX,
          qrWidgetY: cardY
        });
      }

      // 检查是否在 widget 区域内
      const isInWidget = canvasX >= cardX && canvasX <= cardX + widgetWidth &&
                         canvasY >= cardY && canvasY <= cardY + widgetHeight;
      
      console.log('触摸检测:', {
        canvasX: canvasX.toFixed(2),
        canvasY: canvasY.toFixed(2),
        cardX: cardX.toFixed(2),
        cardY: cardY.toFixed(2),
        widgetWidth,
        widgetHeight,
        isInWidget,
        qrWidgetX: this.data.qrWidgetX,
        qrWidgetY: this.data.qrWidgetY,
        canvasWidth: this.data.canvasWidth,
        canvasHeight: this.data.canvasHeight
      });
      
      if (isInWidget) {
        // 开始拖拽
        this.setData({
          isDragging: true,
          touchStartInQRWidget: true,
          touchStartX: touchX,
          touchStartY: touchY,
          qrWidgetStartX: cardX,
          qrWidgetStartY: cardY
        });
        
        // 缓存 rect，避免后续频繁查询
        this.canvasRectCache = rect;
        
        console.log('✅ 开始拖拽成功！位置:', cardX, cardY);
      } else {
        console.log('❌ 不在二维码区域内');
      }
    }).exec();
  },

  // 触摸移动（拖拽二维码）
  onCanvasTouchMove(e) {
    // 只在壁纸模式下处理
    if (this.data.currentMode !== 'wallpaper') {
      return;
    }
    
    // 如果不在拖拽状态，不处理（允许页面滚动）
    if (!this.data.isDragging || !this.data.touchStartInQRWidget) {
      return;
    }
    
    // 在拖拽状态下，阻止页面滚动（小程序事件对象没有 stopPropagation，使用 catchtouchmove 代替）
    
    const touch = e.touches[0];
    if (!touch) {
      console.log('触摸移动：无触摸点');
      return;
    }
    
    const touchX = touch.pageX || touch.x || 0;
    const touchY = touch.pageY || touch.y || 0;
    
    // 使用缓存的 rect
    let rect = this.canvasRectCache;
    
    if (!rect) {
      console.log('触摸移动：rect 缓存不存在，重新查询');
      const query = wx.createSelectorQuery().in(this);
      query.select('#preview-canvas').boundingClientRect((r) => {
        if (!r) {
          console.log('触摸移动：无法获取 Canvas rect');
          return;
        }
        this.canvasRectCache = r;
        this.handleDragMove(touchX, touchY, r);
      }).exec();
    } else {
      this.handleDragMove(touchX, touchY, rect);
    }
  },

  // 处理拖拽移动
  handleDragMove(touchX, touchY, rect) {
    // 计算移动距离
    const deltaX = touchX - this.data.touchStartX;
    const deltaY = touchY - this.data.touchStartY;
    
    // 转换为 Canvas 坐标系的距离
    const canvasDeltaX = deltaX * (this.data.canvasWidth / rect.width);
    const canvasDeltaY = deltaY * (this.data.canvasHeight / rect.height);
    
    // 计算新位置
    let newX = this.data.qrWidgetStartX + canvasDeltaX;
    let newY = this.data.qrWidgetStartY + canvasDeltaY;
    
    // 边界检查（超瘦身版尺寸）
    const isLandscape = this.data.canvasWidth > this.data.canvasHeight;
    const widgetWidth = isLandscape ? 220 : 240;
    const widgetHeight = isLandscape ? 292 : 312;
    
    newX = Math.max(0, Math.min(newX, this.data.canvasWidth - widgetWidth));
    newY = Math.max(0, Math.min(newY, this.data.canvasHeight - widgetHeight));
    
    console.log('拖拽移动:', {
      deltaX, deltaY,
      canvasDeltaX, canvasDeltaY,
      oldX: this.data.qrWidgetX,
      oldY: this.data.qrWidgetY,
      newX, newY
    });
    
    // 更新位置
    this.setData({
      qrWidgetX: newX,
      qrWidgetY: newY
    });
    
    // 节流重绘 Canvas（避免过度重绘导致卡顿）
    if (this.redrawTimer) {
      clearTimeout(this.redrawTimer);
    }
    this.redrawTimer = setTimeout(() => {
      this.redrawWallpaperMode();
    }, 33); // 约 30fps，减少重绘频率以提高性能
  },

  // 触摸结束
  onCanvasTouchEnd(e) {
    if (this.data.isDragging && this.data.touchStartInQRWidget) {
      // 清除定时器
      if (this.redrawTimer) {
        clearTimeout(this.redrawTimer);
        this.redrawTimer = null;
      }
      
      // 最终重绘一次
      this.redrawWallpaperMode();
      
      // 重置状态
      this.setData({
        isDragging: false,
        touchStartInQRWidget: false
      });
    }
  },

  // 重绘壁纸模式（用于拖拽时实时更新）
  async redrawWallpaperMode() {
    if (this.data.currentMode !== 'wallpaper' || !this.data.canvas || !this.data.ctx) {
      return;
    }

    const canvas = this.data.canvas;
    const ctx = this.data.ctx;
    const qrCodePath = this.data.qrCodePath;
    const selectedBgPath = this.data.selectedBgPath || '';

    try {
      // 只绘制背景（Widget 由 DOM overlay 显示）
      await this.drawWallpaperMode(canvas, ctx, qrCodePath, selectedBgPath || this.data.defaultWallpapers[0] || '', true, true);
    } catch (error) {
      console.error('重绘失败:', error);
    }
  }
});
