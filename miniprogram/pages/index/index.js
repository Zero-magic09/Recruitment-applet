// index.js
Page({
  data: {
    loading: false,
    showModalFlag: false,
    modalTitle: '',
    modalContent: '',
    // 弹窗内容配置
    modalData: {
      privacy: {
        title: '隐私政策',
        content: '我们重视您的隐私保护\n\n1. 信息收集：我们仅收集您主动提供的信息，包括简历信息、联系方式等。\n\n2. 信息使用：您的信息仅用于岗位匹配、面试通知等招聘相关服务。\n\n3. 信息安全：我们采用行业标准的加密技术保护您的数据安全。\n\n4. 信息共享：未经您同意，我们不会向第三方分享您的个人信息。\n\n5. 您的权利：您可以随时查看、修改或删除您的个人信息。'
      },
      terms: {
        title: '服务条款',
        content: '欢迎使用职场速约\n\n1. 服务说明：本平台提供智能招聘匹配服务，连接求职者与企业。\n\n2. 用户责任：请确保提供信息的真实性，不得发布虚假岗位或简历。\n\n3. 平台规则：禁止任何形式的恶意行为，包括但不限于骚扰、欺诈等。\n\n4. 免责声明：平台不对招聘结果做任何承诺，仅提供信息匹配服务。\n\n5. 服务变更：我们保留随时修改服务内容的权利。'
      },
      about: {
        title: '关于我们',
        content: '职场速约 - 智能招聘平台\n\n我们致力于打造最高效的招聘匹配平台，让求职者找到理想工作，让企业发现优秀人才。\n\n核心特色：\n• 智能匹配：AI算法精准推荐\n• 附近岗位：LBS定位快速发现\n• 即时沟通：快速响应高效对接\n• 安全可靠：企业认证信息保障\n\n技术支持：微信云开发\n版本：v1.0.0'
      }
    }
  },

  onLoad: function() {
    console.log('职场速约页面加载成功');
  },

  onRoleTap: function(e) {
    const role = e.currentTarget.dataset.role;
    const app = getApp();
    const mappedRole = role === 'seeker' ? 'candidate' : 'company';
    app.globalData.role = mappedRole;
    wx.navigateTo({
      url: `/pages/auth/login/index?role=${mappedRole}`
    });
  },

  // 显示弹窗
  showModal: function(e) {
    const type = e.currentTarget.dataset.type;
    const data = this.data.modalData[type];
    if (data) {
      this.setData({
        showModalFlag: true,
        modalTitle: data.title,
        modalContent: data.content
      });
    }
  },

  // 隐藏弹窗
  hideModal: function() {
    this.setData({
      showModalFlag: false
    });
  },

  // 阻止冒泡
  preventBubble: function() {},

  onShareAppMessage: function() {
    return {
      title: '职场速约 - 你的智能招聘助手',
      path: '/pages/index/index'
    };
  }
});
