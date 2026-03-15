// 简历预览页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    resume: null,
    certificates: [] // 技能证书列表
  },

  onLoad() {
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.on('resumeData', (data) => {
      console.log('接收到的简历数据:', data)
      
      // 处理数据结构
      if (data.resume) {
        // 从投递列表传来的数据
        this.setData({ 
          resume: data.resume,
          candidateName: data.candidateName,
          candidateId: data.candidateId
        })
        // 如果传了 candidateId，则加载该用户的证书
        if (data.candidateId) {
          this.loadCertificates(data.candidateId)
        }
      } else {
        // 直接传来的简历数据
        this.setData({ resume: data })
        this.loadCertificates()
      }
    })
  },

  // 加载用户的技能证书
  loadCertificates(userId) {
    // 如果传了 userId，使用传入的 userId，否则使用当前登录用户的 userId
    const targetUserId = userId || app.globalData.user?.userId
    
    console.log('预览页加载证书，用户ID:', targetUserId)
    
    if (!targetUserId) {
      console.log('没有用户ID，无法加载证书')
      return
    }

    db.collection('skill_certificates').where({
      userId: targetUserId,
      status: 'valid'
    }).orderBy('issueDate', 'desc').get().then(res => {
      console.log('加载到证书数据:', res.data)
      
      // 格式化日期
      const certificates = res.data.map(cert => {
        const issueDate = new Date(cert.issueDate)
        const year = issueDate.getFullYear()
        const month = String(issueDate.getMonth() + 1).padStart(2, '0')
        const day = String(issueDate.getDate()).padStart(2, '0')
        
        return {
          ...cert,
          issueDateStr: `${year}-${month}-${day}`
        }
      })
      
      this.setData({ certificates })
    }).catch(err => {
      console.error('加载证书失败', err)
    })
  },

  // 跳转到技能认证
  goToSkillExam() {
    wx.navigateTo({
      url: '/pages/candidate/skillExam/index?category=计算机与信息技术'
    })
  },

  // 查看证书详情
  viewCertificate(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/candidate/skillCertificate/index?certId=${id}`
    })
  }
})
