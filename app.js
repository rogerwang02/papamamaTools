// app.js
App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'cloud1-0gum144f4caaf976',
        traceUser: true,
      });
    }
  },
  globalData: {
    userInfo: null,
    firstAidData: [
      {
        id: 'cpr',
        title: '心肺复苏 (CPR)',
        icon: '💓',
        color: '#FFEBEE',
        intro: '当发现有人倒地，意识丧失且呼吸停止时，立即进行CPR可挽救生命。',
        judge: ['拍打双肩呼唤，看有无反应', '观察胸部有无起伏(不超过10秒)', '如无反应无呼吸，即判定心脏骤停'],
        action: ['立即拨打120，寻找AED', '胸外按压：两乳头连线中点', '深度5-6cm，频率100-120次/分', '30次按压配合2次人工呼吸'],
        videoUrl: 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets/xinfeifusu.mp4'
      },
      {
        id: 'heimlich',
        title: '海姆立克急救法',
        icon: '🗣️',
        color: '#E3F2FD',
        intro: '用于异物卡喉导致的呼吸道梗阻，是抢救气管异物窒息的标准方法。',
        judge: ['不由自主用"V"字手型抓颈部', '无法说话、咳嗽或呼吸', '面色青紫'],
        action: ['站位：站在患者身后，环抱腰部', '握拳：拇指侧顶住肚脐上方两横指', '冲击：向内向上快速冲击腹部', '重复直到异物排出'],
        videoUrl: 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets/haimulike.mp4'
      },
      {
        id: 'stroke',
        title: '脑卒中 (中风)',
        icon: '🧠',
        color: '#F3E5F5',
        intro: '脑卒中救治要在"黄金窗口期"内，快速识别是关键。',
        judge: ['FAST口诀：', 'F(Face)：口角歪斜', 'A(Arm)：单侧手臂无力', 'S(Speech)：言语不清', 'T(Telephone)：拨打急救电话'],
        action: ['立即拨打120', '让患者平卧，头偏向一侧', '解开衣领保持呼吸通畅', '禁止喂水喂药'],
        videoUrl: 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets/naozhongfeng.mp4'
      },
      {
        id: 'heatstroke',
        title: '中暑急救',
        icon: '☀️',
        color: '#FFF3E0',
        intro: '高温环境下出现的体温调节功能障碍。',
        judge: ['头晕、口渴、多汗', '皮肤干热无汗、体温>40℃', '意识模糊或昏迷'],
        action: ['迅速移至通风阴凉处', '解衣、用湿毛巾擦拭降温', '清醒者喝淡盐水', '昏迷者禁止喂水，立即送医'],
        videoUrl: 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets/zhongshu.mp4'
      },
      {
        id: 'bleeding',
        title: '外伤止血',
        icon: '🩸',
        color: '#FFEBEE',
        intro: '快速有效的止血能防止休克。',
        judge: ['鲜红喷射状(动脉出血)', '暗红涌出(静脉出血)'],
        action: ['指压法：压迫伤口近心端动脉', '加压包扎：纱布覆盖用力按压', '抬高受伤肢体', '有异物千万不要拔出'],
        videoUrl: 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets/chuxue.mp4'
      },
      {
        id: 'burns',
        title: '烧伤烫伤',
        icon: '🔥',
        color: '#FBE9E7',
        intro: '正确及时的冷疗能有效减轻疼痛和深部组织损伤。',
        judge: ['皮肤发红、疼痛(I度)', '红肿、起水泡(II度)', '皮肤焦黑或苍白(III度)'],
        action: ['冲：流动冷水冲洗伤口15-30分钟', '脱：在水中小心剪开粘连衣物', '泡：冷水中浸泡缓解疼痛', '盖：覆盖干净纱布，【禁止】涂牙膏/酱油'],
        videoUrl: 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets/shaoshang.mp4'
      },
      {
        id: 'bites',
        title: '动物咬伤',
        icon: '🐕',
        color: '#EFEBE9',
        intro: '猫狗咬伤需预防狂犬病和破伤风感染。',
        judge: ['皮肤被动物牙齿刺破', '有抓痕或出血', '动物疑似有狂犬病症状'],
        action: ['冲：用肥皂水和流动清水交替冲洗15分钟', '消：用碘伏或酒精消毒伤口', '不包扎：伤口敞开，不要包扎', '苗：尽快去医院接种狂犬疫苗'],
        videoUrl: 'cloud://cloud1-0gum144f4caaf976.636c-cloud1-0gum144f4caaf976-1258603821/assets/dongwuyaoshang.mp4'
      }
    ]
  }
});

