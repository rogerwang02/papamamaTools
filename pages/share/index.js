// pages/share/index.js
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
    // 默认壁纸图片路径（从 pages/share/ 到 assets/ 的相对路径）
    defaultWallpapers: [
      '../../assets/p1.jpg',
      '../../assets/p2.jpg',
      '../../assets/p3.jpg'
    ],
    // 二维码 widget 位置（Canvas 坐标系）
    qrWidgetX: null, // Canvas 坐标系的 X
    qrWidgetY: null, // Canvas 坐标系的 Y
    // 二维码 widget 浮动层位置（屏幕坐标系）
    qrWidgetOverlayLeft: 0, // 浮动层的左边距（px）
    qrWidgetOverlayTop: 0, // 浮动层的上边距（px）
    qrWidgetOverlayWidth: 280, // 浮动层的宽度（px）
    qrWidgetOverlayHeight: 330, // 浮动层的高度（px）
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
    lastQRCodePath: '' // 上次加载的二维码路径
  },

  // 实例变量：缓存图片对象（不能存储在 data 中，因为 setData 无法序列化 Native Image 对象）
  bgImageCache: null, // 缓存的背景图片对象
  qrImageCache: null, // 缓存的二维码图片对象
  // 节流定时器和缓存
  redrawTimer: null, // Canvas 重绘的定时器（用于节流）
  canvasRectCache: null, // 缓存的 Canvas 位置信息

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
        bgImage = this.data.defaultWallpapers[0];
        this.setData({
          selectedBgPath: bgImage,
          selectedBgIndex: 0
        });
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
      
      // === FIX: 切换到壁纸模式时，如果二维码位置未初始化，默认位置设置为左上角 ===
      if (mode === 'wallpaper') {
        if (this.data.qrWidgetX === null || this.data.qrWidgetY === null) {
          // 默认位置：左上角（安全区域）
          const defaultX = 40;
          const defaultY = 40;
          
          // 计算屏幕像素位置（用于 overlay）
          const sysInfo = wx.getSystemInfoSync();
          const rpx2px = (rpx) => (sysInfo.windowWidth / 750) * rpx;
          const overlayLeftPx = 40 * rpx2px(1); // 近似值，实际会在 initOverlayPosition 中重新计算
          const overlayTopPx = 40 * rpx2px(1);
          
          this.setData({
            qrWidgetX: defaultX,
            qrWidgetY: defaultY,
            // 临时设置 overlay 位置，会在 initOverlayPosition 中根据实际 canvas 尺寸重新计算
            qrWidgetOverlayLeft: overlayLeftPx,
            qrWidgetOverlayTop: overlayTopPx
          });
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
      // --- 布局配置（根据横版/竖版使用不同的缩放比例） ---
      // 检测图片是横版还是竖版
      let isLandscape = false;
      if (bgImagePath && !bgImagePath.startsWith('#')) {
        try {
          // 获取图片信息判断横竖版
          const imgInfo = await wx.getImageInfo({ src: bgImagePath });
          isLandscape = imgInfo.width > imgInfo.height;
        } catch(e) {
          // 如果获取失败，默认按竖版处理
          isLandscape = false;
        }
      }
      
      // 横版和竖版使用不同的缩放比例
      // 横版：进一步缩小（0.88），因为保存后还是稍大
      // 竖版：进一步缩小（0.78），因为保存后还是偏大
      const previewScale = isLandscape ? 0.95 : 0.9;
      
      // 竖版使用更大的基础尺寸（匹配 CSS 中增大的二维码）
      const baseWidgetWidth = isLandscape ? 280 : 320;      // 竖版增大
      const baseQrImgSize = isLandscape ? 230 : 280;        // 竖版增大，匹配 CSS 320rpx
      const basePadding = 20;           // 基础内边距
      
      // 高度需要根据二维码尺寸和文字区域精确计算
      if (isLandscape) {
        // 横版：20 (padding) + 230 (二维码) + 28 (间距) + 24*2 + 10 (两行文字，约60) + 20 (padding) ≈ 366
        var baseWidgetHeight = 366;
      } else {
        // 竖版精确计算：20 (padding) + 280 (二维码) + 28 (textGap) + 26 (第一行) + 34 (lineHeight包含间距) + 20 (padding) = 408
        var baseWidgetHeight = 408;
      }
      
      // 应用预览缩放，使保存图片中的 widget 和预览一致
      const widgetWidth = baseWidgetWidth * previewScale;
      const qrImgSize = baseQrImgSize * previewScale;
      const padding = basePadding * previewScale;
      const widgetHeight = baseWidgetHeight * previewScale;

      // 坐标
      let cardX = this.data.qrWidgetX;
      let cardY = this.data.qrWidgetY;
      
      // 安全回退
      if (cardX === null || cardY === null) {
        cardX = 40;
        cardY = 40;
      }

      // A. 绘制卡片背景（圆角 + 阴影）
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;

      const gradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + widgetHeight);
      gradient.addColorStop(0, '#FFFFFF'); 
      gradient.addColorStop(1, '#FFF0E5');
      ctx.fillStyle = gradient;

      const borderRadius = 20 * previewScale; // 圆角也应用缩放
      this.drawRoundRect(ctx, cardX, cardY, widgetWidth, widgetHeight, borderRadius);
      ctx.fill();
      ctx.restore(); // 恢复以移除内部元素的阴影

      // B. 绘制二维码
      if (qrCodePath) {
        // 保存时强制加载二维码图片（不依赖缓存）
        const qrImage = await this.loadImage(canvas, qrCodePath);
        if (qrImage) {
          // 在卡片内水平居中
          const qrX = cardX + (widgetWidth - qrImgSize) / 2;
          const qrY = cardY + padding; // 顶部内边距
          ctx.drawImage(qrImage, qrX, qrY, qrImgSize, qrImgSize);
        }
      }

      // C. 绘制文字
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top'; // 从顶部向下布局更容易

      const centerX = cardX + widgetWidth / 2;
      const textGap = 28 * previewScale; // 文字间距也应用缩放
      const lineHeight = 34 * previewScale; // 行高也应用缩放
      const textStartY = cardY + padding + qrImgSize + textGap;

      // 字体大小也应用缩放（竖版使用更大的基础字体）
      const baseFontSize = isLandscape ? 24 : 26; // 竖版基础字体更大
      const fontSize = baseFontSize * previewScale;
      ctx.font = `bold ${fontSize}px sans-serif`;
      
      // 竖版需要确保文字不换行，使用单行绘制
      ctx.fillText('请在机主需要帮助时', centerX, textStartY);
      ctx.fillText('扫码查看紧急联系人', centerX, textStartY + lineHeight);
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
        
        // 重置 Widget 位置到背景图左上角（安全区域）
        // Canvas 坐标系：40px 左上角
        this.setData({
          selectedBgPath: tempFilePath,
          selectedBgIndex: -1,
          showDefaultBgSelector: false,
          // 重置到左上角
          qrWidgetX: 40,    // Canvas Coordinate (px)
          qrWidgetY: 40,    // Canvas Coordinate (px)
          // Overlay 位置会在 initOverlayPosition 中根据 canvas 尺寸重新计算
          qrWidgetOverlayLeft: 0,
          qrWidgetOverlayTop: 0
        });
        
        // 如果当前是壁纸模式，需要重新计算 Canvas 尺寸并绘制
        if (this.data.currentMode === 'wallpaper') {
          await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
          // 延迟确保 Canvas 尺寸更新完成（无动画后，150ms 足够）
          setTimeout(() => {
            this.initOverlayPosition();
          }, 150);
        } else if (this.data.qrCodePath && this.data.canvas && this.data.ctx) {
          // 如果不是壁纸模式，切换到壁纸模式
          await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
          setTimeout(() => {
            this.initOverlayPosition();
          }, 150);
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
    const bgImagePath = this.data.defaultWallpapers[index];
    
    // UX: 滚动到顶部，让用户看到画布
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
    
    // 重置 Widget 位置到背景图左上角（安全区域）
    this.setData({
      selectedBgIndex: index,
      selectedBgPath: bgImagePath, // 使用图片路径
      showDefaultBgSelector: false,
      // 重置到左上角
      qrWidgetX: 40,    // Canvas Coordinate (px)
      qrWidgetY: 40,    // Canvas Coordinate (px)
      // Overlay 位置会在 initOverlayPosition 中根据 canvas 尺寸重新计算
      qrWidgetOverlayLeft: 0,
      qrWidgetOverlayTop: 0
    });

    // 如果当前是壁纸模式，需要重新计算 Canvas 尺寸并绘制（自适应高度）
    if (this.data.currentMode === 'wallpaper') {
      await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
      // 延迟确保 Canvas 尺寸更新完成（无动画后，150ms 足够）
      setTimeout(() => {
        this.initOverlayPosition();
      }, 150);
    } else if (this.data.qrCodePath && this.data.canvas && this.data.ctx) {
      // 如果不是壁纸模式，切换到壁纸模式
      await this.onTabChange({ currentTarget: { dataset: { mode: 'wallpaper' } } });
      setTimeout(() => {
        this.initOverlayPosition();
      }, 150);
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
      
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '提示',
          content: '需要授权访问相册才能保存图片',
          showCancel: false
        });
      } else {
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

    // 在保存前，将 DOM overlay 的最终位置同步回 Canvas 坐标
    this.syncDOMToCanvasCoordinates();

    wx.showLoading({ title: '合成中...', mask: true });

    try {
      const canvas = this.data.canvas;
      const ctx = this.data.ctx;

      // 1. 合成模式：绘制背景 + Widget（强制检查图片加载）
      await this.drawWallpaperMode(
        canvas,
        ctx,
        this.data.qrCodePath,
        this.data.selectedBgPath || this.data.defaultWallpapers[0] || '',
        false, // skipImageLoad = false（强制检查）
        false  // onlyBackground = false（绘制 Widget）
      );

      // 2. 保存合成后的 Canvas
      const tempFilePath = await this.canvasToTempFilePath();
      await wx.saveImageToPhotosAlbum({ filePath: tempFilePath });

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });

      // 3. 恢复为仅背景（视觉代理模式）
      await this.drawWallpaperMode(
        canvas,
        ctx,
        this.data.qrCodePath,
        this.data.selectedBgPath || this.data.defaultWallpapers[0] || '',
        true, // skipImageLoad = true（使用缓存）
        true  // onlyBackground = true（只绘制背景）
      );
    } catch (error) {
      console.error('保存失败:', error);
      wx.hideLoading();

      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '提示',
          content: '需要授权访问相册才能保存图片',
          showCancel: false
        });
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
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

      // Widget 尺寸（匹配 CSS 中增大的二维码尺寸 320rpx）
      // 使用竖版的较大尺寸，确保预览显示正确（横版会自动缩放适配）
      // 高度计算：20 (padding) + 280 (二维码) + 28 (textGap) + 26 (第一行) + 34 (lineHeight) + 20 (padding) = 408
      const widgetWidth = 320;
      const qrImgSize = 280;
      const widgetHeight = 408; // 精确计算的高度，确保文字不出框

      // 将 Canvas 坐标转换为屏幕坐标（使用统一的缩放比例）
      const overlayLeft = rect.left + this.data.qrWidgetX * scaleX;
      const overlayTop = rect.top + this.data.qrWidgetY * scaleY;
      // 使用统一的 scale 来保持宽高比
      const overlayWidth = widgetWidth * scale;
      const overlayHeight = widgetHeight * scale;

      this.setData({
        qrWidgetOverlayLeft: overlayLeft,
        qrWidgetOverlayTop: overlayTop,
        qrWidgetOverlayWidth: overlayWidth,
        qrWidgetOverlayHeight: overlayHeight
      });
    }).exec();
  },

  // Helper: 将 DOM overlay 的像素坐标同步回 Canvas 逻辑坐标
  syncDOMToCanvasCoordinates() {
    const sysInfo = wx.getSystemInfoSync();
    const windowWidth = sysInfo.windowWidth;

    // Canvas 逻辑宽度是 750，对应屏幕宽度 windowWidth
    // rpx2px = windowWidth / 750，因此 px2rpx（或逻辑单位）= 750 / windowWidth
    const scale = 750 / windowWidth;

    const domLeft = this.data.qrWidgetOverlayLeft || 0;
    const domTop = this.data.qrWidgetOverlayTop || 0;

    const newCanvasX = domLeft * scale;
    const newCanvasY = domTop * scale;

    console.log('syncDOMToCanvasCoordinates:', {
      domLeft,
      domTop,
      scale,
      newCanvasX,
      newCanvasY
    });

    this.setData({
      qrWidgetX: newCanvasX,
      qrWidgetY: newCanvasY
    });
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

    // 更新 overlay 的 CSS 位置
    const newOverlayLeft = this.data.startOverlayLeft + deltaX;
    const newOverlayTop = this.data.startOverlayTop + deltaY;

    // 边界检查（相对于 canvas-container）
    const query = wx.createSelectorQuery().in(this);
    query.select('#preview-canvas').boundingClientRect((rect) => {
      if (!rect) return;

      const minLeft = rect.left;
      const minTop = rect.top;
      const maxLeft = rect.right - this.data.qrWidgetOverlayWidth;
      const maxTop = rect.bottom - this.data.qrWidgetOverlayHeight;

      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, newOverlayLeft));
      const clampedTop = Math.max(minTop, Math.min(maxTop, newOverlayTop));

      this.setData({
        qrWidgetOverlayLeft: clampedLeft,
        qrWidgetOverlayTop: clampedTop
      });
    }).exec();
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

      // 计算缩放比例
      const scaleX = this.data.canvasWidth / rect.width;
      const scaleY = this.data.canvasHeight / rect.height;

      // 将屏幕坐标转换为 Canvas 坐标
      const canvasX = (this.data.qrWidgetOverlayLeft - rect.left) * scaleX;
      const canvasY = (this.data.qrWidgetOverlayTop - rect.top) * scaleY;

      // 边界检查（Canvas 坐标系）
      const widgetWidth = 320; // 匹配增大的尺寸
      const widgetHeight = 408; // 精确计算的高度，确保文字不出框
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

      // 检查触摸点是否在二维码 widget 区域内
      const widgetWidth = 280;
      const widgetHeight = 280 - 40 + 100; // qrSize + 100（与绘制逻辑一致）
      
      let cardX = this.data.qrWidgetX;
      let cardY = this.data.qrWidgetY;
      
      // 如果没有保存的位置，使用默认位置
      if (cardX === null || cardY === null) {
        cardX = this.data.canvasWidth - widgetWidth - 40;
        cardY = this.data.canvasHeight - widgetHeight - 240;
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
    
    // 边界检查
    const widgetWidth = 320; // 匹配增大的尺寸
    const widgetHeight = 408; // 精确计算的高度，确保文字不出框
    
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
