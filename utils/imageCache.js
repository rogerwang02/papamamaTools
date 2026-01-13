// 图片缓存工具类
// 支持本地图片、云存储图片和网络图片的缓存

/**
 * 判断是否为合法的本地路径（微信小程序中的本地路径标识）
 * @param {string} path - 路径
 * @returns {boolean} 是否为本地路径
 */
function isLocalPath(path) {
  if (!path) return false;
  // 微信小程序中的本地路径标识
  if (path.startsWith('http://usr/') || path.startsWith('http://tmp/') || path.startsWith('wxfile://')) {
    return true;
  }
  // 其他本地路径（不以协议开头或相对路径）
  if (!path.startsWith('http://') && !path.startsWith('https://') && !path.startsWith('cloud://')) {
    return true;
  }
  return false;
}

/**
 * 获取缓存键名
 * @param {string} url - 图片URL或路径
 * @returns {string} 缓存键名
 */
function getCacheKey(url) {
  // 如果是云存储路径，提取文件名作为key
  if (url.startsWith('cloud://')) {
    const matches = url.match(/\/([^\/]+\.(jpg|jpeg|png|gif|webp))$/i);
    if (matches) {
      return `cloud_${matches[1]}`;
    }
    // 如果没有文件名，使用整个路径的hash
    return `cloud_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  
  // 如果是本地路径，提取文件名
  if (url.includes('/')) {
    const fileName = url.split('/').pop();
    return `local_${fileName}`;
  }
  
  // 网络URL，使用整个URL的hash
  return `url_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * 获取图片的本地缓存路径
 * @param {string} cacheKey - 缓存键名
 * @returns {string} 本地文件路径
 */
function getLocalCachePath(cacheKey) {
  return `${wx.env.USER_DATA_PATH}/image_cache/${cacheKey}`;
}

/**
 * 图片缓存工具类
 */
class ImageCache {
  constructor() {
    this.fs = wx.getFileSystemManager();
    this.cacheDir = `${wx.env.USER_DATA_PATH}/image_cache`;
    
    // 确保缓存目录存在
    try {
      this.fs.mkdirSync(this.cacheDir, true);
    } catch (e) {
      console.warn('创建缓存目录失败:', e);
    }
  }

  /**
   * 检查缓存是否存在且有效
   * @param {string} localPath - 本地文件路径
   * @returns {boolean} 是否存在
   */
  checkCacheExists(localPath) {
    try {
      this.fs.accessSync(localPath);
      // 额外检查文件大小，确保文件不为空
      const stat = this.fs.statSync(localPath);
      return stat.size > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * 从云存储下载图片并缓存
   * @param {string} cloudPath - 云存储路径 (cloud://...)
   * @returns {Promise<string>} 本地文件路径
   */
  async downloadFromCloud(cloudPath) {
    try {
      const res = await wx.cloud.downloadFile({
        fileID: cloudPath
      });

      if (res.statusCode === 200 && res.tempFilePath) {
        // 验证返回的是本地路径（包括微信小程序的本地路径格式）
        const tempPath = res.tempFilePath;
        // 使用 isLocalPath 函数判断，允许 http://usr/、http://tmp/、wxfile:// 等本地路径
        if (!isLocalPath(tempPath)) {
          throw new Error(`下载返回的路径不是本地路径: ${tempPath}`);
        }
        console.log('✅ 云存储下载成功，临时路径:', tempPath.substring(tempPath.length - 40));
        return tempPath;
      }
      throw new Error(`下载失败，status: ${res.statusCode || 'UNKNOWN'}`);
    } catch (err) {
      console.error('❌ 从云存储下载失败:', cloudPath, err);
      throw err;
    }
  }

  /**
   * 从网络下载图片并缓存
   * @param {string} url - 图片URL
   * @returns {Promise<string>} 本地文件路径
   */
  async downloadFromUrl(url) {
    try {
      const res = await wx.downloadFile({
        url: url,
        header: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        }
      });

      if (res.statusCode === 200 && res.tempFilePath) {
        return res.tempFilePath;
      }
      throw new Error(`下载失败，status: ${res.statusCode || 'UNKNOWN'}`);
    } catch (err) {
      console.error('从网络下载失败:', url, err);
      throw err;
    }
  }

  /**
   * 保存文件到缓存目录
   * @param {string} tempFilePath - 临时文件路径
   * @param {string} cacheKey - 缓存键名
   * @returns {Promise<string>} 缓存文件路径
   */
  async saveToCache(tempFilePath, cacheKey) {
    // 验证 tempFilePath 是本地路径（包括微信小程序的本地路径格式），不是远程URL
    if (!tempFilePath) {
      throw new Error(`临时文件路径为空`);
    }
    
    // 使用 isLocalPath 函数判断，允许 http://usr/、http://tmp/、wxfile:// 等本地路径
    if (!isLocalPath(tempFilePath)) {
      throw new Error(`临时文件路径无效（不是本地路径）: ${tempFilePath}`);
    }
    
    const cachePath = getLocalCachePath(cacheKey);
    
    try {
      // 确保目录存在
      const dir = cachePath.substring(0, cachePath.lastIndexOf('/'));
      try {
        this.fs.mkdirSync(dir, true);
      } catch (e) {
        // 目录可能已存在，忽略错误
      }

      // 验证临时文件是否存在
      if (!this.checkCacheExists(tempFilePath)) {
        throw new Error(`临时文件不存在: ${tempFilePath}`);
      }

      // 保存文件
      this.fs.saveFileSync(tempFilePath, cachePath);
      
      // 验证保存后的文件是否存在
      if (!this.checkCacheExists(cachePath)) {
        throw new Error(`保存后文件验证失败: ${cachePath}`);
      }
      
      console.log('✅ 图片已缓存:', cacheKey, '->', cachePath);
      return cachePath;
    } catch (err) {
      console.error('❌ 保存缓存失败:', cacheKey, err);
      // 不再返回 tempFilePath，而是抛出错误，避免返回URL
      throw new Error(`保存缓存失败: ${err.message}`);
    }
  }

  /**
   * 获取图片路径（优先从缓存读取）
   * @param {string} imageUrl - 图片URL或路径（支持本地路径、云存储路径、网络URL）
   * @returns {Promise<string>} 本地文件路径
   */
  async getImagePath(imageUrl) {
    if (!imageUrl) {
      throw new Error('图片URL不能为空');
    }

    // 如果已经是本地路径（包括微信小程序的本地路径格式），直接返回
    if (isLocalPath(imageUrl)) {
      // 检查本地路径是否存在
      if (this.checkCacheExists(imageUrl)) {
        console.log('📦 本地路径已存在:', imageUrl.substring(imageUrl.length - 40));
        return imageUrl;
      }
      // 如果本地路径不存在，也返回（可能是相对路径，让系统处理）
      return imageUrl;
    }

    const cacheKey = getCacheKey(imageUrl);
    const cachePath = getLocalCachePath(cacheKey);

    // 1. 检查缓存映射（快速查找，优先使用）
    try {
      const cacheMap = wx.getStorageSync('image_cache_map') || {};
      const mappedPath = cacheMap[imageUrl];
      if (mappedPath) {
        // 严格验证：映射路径必须是本地路径（包括微信小程序的本地路径格式）
        if (!isLocalPath(mappedPath)) {
          console.warn('⚠️ 映射表中的路径无效（是远程路径），清除并重新下载:', mappedPath);
          // 清除无效的映射
          delete cacheMap[imageUrl];
          wx.setStorageSync('image_cache_map', cacheMap);
        } else if (this.checkCacheExists(mappedPath)) {
          // 路径有效且文件存在
          console.log('📦 [缓存命中-映射]', imageUrl.substring(imageUrl.length - 20), '->', mappedPath.substring(mappedPath.length - 40));
          return mappedPath;
        } else {
          // 路径有效但文件不存在，清除映射
          console.warn('⚠️ 映射表中的文件不存在，清除映射:', mappedPath);
          delete cacheMap[imageUrl];
          wx.setStorageSync('image_cache_map', cacheMap);
        }
      }
    } catch (e) {
      // 忽略读取映射失败的错误
      console.warn('读取缓存映射失败:', e);
    }

    // 2. 检查缓存文件是否存在
    if (this.checkCacheExists(cachePath)) {
      console.log('📦 [缓存命中-文件]', cacheKey, '->', cachePath);
      // 更新映射表，方便下次快速查找
      try {
        const cacheMap = wx.getStorageSync('image_cache_map') || {};
        cacheMap[imageUrl] = cachePath;
        wx.setStorageSync('image_cache_map', cacheMap);
      } catch (e) {
        // 忽略保存映射失败
      }
      return cachePath;
    }

    // 3. 缓存不存在，需要下载
    console.log('⬇️ [缓存未命中] 下载图片:', imageUrl);
    let tempFilePath;

    try {
      if (imageUrl.startsWith('cloud://')) {
        // 云存储图片
        tempFilePath = await this.downloadFromCloud(imageUrl);
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // 检查是否是微信小程序的本地路径格式
        if (isLocalPath(imageUrl)) {
          // 这是本地路径，不应该尝试下载
          console.log('📦 识别为本地路径，直接返回:', imageUrl.substring(imageUrl.length - 40));
          return imageUrl;
        }
        // 真正的网络图片
        tempFilePath = await this.downloadFromUrl(imageUrl);
      } else {
        // 本地图片（assets目录等），直接返回
        // 检查文件是否存在
        if (this.checkCacheExists(imageUrl)) {
          return imageUrl;
        }
        // 如果本地文件不存在，尝试作为相对路径处理
        return imageUrl;
      }

      // 3. 验证临时文件路径是本地路径
      if (!isLocalPath(tempFilePath)) {
        console.error('❌ 临时文件路径无效（不是本地路径）:', tempFilePath);
        throw new Error('临时文件路径无效');
      }

      // 4. 保存到缓存
      const savedPath = await this.saveToCache(tempFilePath, cacheKey);
      
      // 5. 最终验证：确保返回的是本地路径（包括微信小程序的本地路径格式）
      if (!isLocalPath(savedPath)) {
        console.error('❌ 缓存保存后路径仍然是远程路径:', savedPath);
        throw new Error('缓存路径无效');
      }
      
      // 6. 验证保存的文件确实存在且是本地文件
      if (!this.checkCacheExists(savedPath)) {
        console.error('❌ 缓存文件验证失败，文件不存在:', savedPath);
        throw new Error('缓存文件不存在');
      }
      
      // 7. 保存缓存映射到本地存储（用于快速查找）
      // 再次验证 savedPath 是本地路径（包括微信小程序的本地路径格式），确保不会保存远程URL
      if (!isLocalPath(savedPath)) {
        console.error('❌ 保存映射前验证失败，路径仍然是远程路径:', savedPath);
        throw new Error('缓存路径无效，无法保存映射');
      }
      
      try {
        const cacheMap = wx.getStorageSync('image_cache_map') || {};
        // 再次验证，确保不会覆盖为无效路径
        const oldPath = cacheMap[imageUrl];
        if (oldPath && (oldPath.startsWith('http://') || oldPath.startsWith('https://') || oldPath.startsWith('cloud://'))) {
          console.warn('⚠️ 发现旧的无效映射，清除:', oldPath);
        }
        cacheMap[imageUrl] = savedPath;
        wx.setStorageSync('image_cache_map', cacheMap);
        console.log('✅ [缓存已保存]', imageUrl.substring(imageUrl.length - 20), '->', savedPath.substring(savedPath.length - 40));
      } catch (e) {
        console.warn('保存缓存映射失败:', e);
      }
      
      return savedPath;
    } catch (err) {
      console.error('❌ 获取图片缓存失败:', imageUrl, err);
      
      // 如果下载失败，抛出错误而不是返回原始URL
      // 这样可以避免使用原始URL导致网络请求
      throw err;
    }
  }

  /**
   * 批量获取图片路径
   * @param {string[]} imageUrls - 图片URL数组
   * @returns {Promise<string[]>} 本地文件路径数组
   */
  async getImagePaths(imageUrls) {
    const promises = imageUrls.map(url => this.getImagePath(url));
    return Promise.allSettled(promises).then(results => {
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.warn(`图片加载失败: ${imageUrls[index]}`, result.reason);
          return imageUrls[index]; // 失败时返回原URL
        }
      });
    });
  }

  /**
   * 清除所有缓存
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      const files = this.fs.readdirSync(this.cacheDir);
      for (const file of files) {
        const filePath = `${this.cacheDir}/${file}`;
        try {
          this.fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('删除缓存文件失败:', filePath, e);
        }
      }
      
      // 清除缓存映射
      wx.removeStorageSync('image_cache_map');
      
      console.log('✅ 缓存已清除');
    } catch (err) {
      console.error('清除缓存失败:', err);
    }
  }

  /**
   * 获取缓存大小（字节）
   * @returns {Promise<number>} 缓存大小
   */
  async getCacheSize() {
    try {
      const files = this.fs.readdirSync(this.cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = `${this.cacheDir}/${file}`;
        try {
          const stat = this.fs.statSync(filePath);
          totalSize += stat.size;
        } catch (e) {
          // 忽略错误
        }
      }
      
      return totalSize;
    } catch (err) {
      console.error('获取缓存大小失败:', err);
      return 0;
    }
  }
}

// 导出单例
const imageCache = new ImageCache();

module.exports = imageCache;
