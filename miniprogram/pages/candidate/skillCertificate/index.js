// 技能证书展示页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    certificate: null,
    isNew: false,
    loading: true
  },

  onLoad(options) {
    const { certId, new: isNew } = options
    this.setData({ isNew: isNew === 'true' })
    
    if (certId) {
      this.loadCertificate(certId)
    }
  },

  onShareAppMessage() {
    return {
      title: `我获得了计算机与信息技术${this.data.certificate?.level}认证！`,
      path: `/pages/candidate/skillCertificate/index?certId=${this.data.certificate._id}`
    }
  },

  loadCertificate(certId) {
    db.collection('skill_certificates').doc(certId).get().then(res => {
      const certificate = res.data
      
      // 格式化日期
      if (certificate.issueDate) {
        const issueDate = new Date(certificate.issueDate)
        certificate.issueDateStr = `${issueDate.getFullYear()}年${issueDate.getMonth() + 1}月${issueDate.getDate()}日`
      }
      
      if (certificate.validUntil) {
        const validDate = new Date(certificate.validUntil)
        certificate.validUntilStr = `${validDate.getFullYear()}年${validDate.getMonth() + 1}月${validDate.getDate()}日`
      }
      
      this.setData({
        certificate: certificate,
        loading: false
      })
    }).catch(err => {
      console.error('加载证书失败', err)
      wx.showToast({ icon: 'none', title: '加载失败' })
      this.setData({ loading: false })
    })
  },

  // 保存证书图片（截图功能）
  saveCertificate() {
    wx.showToast({ icon: 'none', title: '长按证书可保存图片' })
  },

  // 分享证书
  shareCertificate() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 查看详情
  viewDetails() {
    const { certificate } = this.data
    wx.showModal({
      title: '证书详情',
      content: `证书编号：${certificate.certNumber}
等级：${certificate.level}
得分：${certificate.score}分
正确率：${certificate.accuracy}%
题目数：${certificate.totalQuestions}题
正确数：${certificate.correctAnswers}题`,
      showCancel: false
    })
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/candidate/home/index'
    })
  },

  // 查看我的证书列表
  viewMyCertificates() {
    wx.navigateTo({
      url: '/pages/candidate/resume/preview/index'
    })
  }
})
