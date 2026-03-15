// 岗位详情页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    jobId: '',
    job: null,
    company: null,
    hasApplied: false,
    applicationStatus: '', // 投递状态：submitted, viewed, interviewed, hired, rejected
    userResume: null,
    showVideoModal: false,
    currentVideoUrl: '',
    markers: [],
    latitude: 0,
    longitude: 0,
  },

  onLoad(options) {
    console.log('岗位详情页加载, jobId:', options.id)
    this.setData({ jobId: options.id })
    
    this.getJobDetail()
    this.checkApplyStatus()
    this.getUserResume()
  },

  onShow() {
    // 页面显示时重新获取简历和投递状态
    this.getUserResume()
    this.checkApplyStatus()
  },

  // 获取岗位详情
  getJobDetail() {
    console.log('开始获取岗位详情, jobId:', this.data.jobId)
    wx.showLoading({ title: '加载中' })
    
    db.collection('jobs').doc(this.data.jobId).get().then(res => {
      console.log('岗位详情查询结果:', res)
      const job = res.data
      this.setData({ 
        job,
        // 直接使用岗位数据中的公司信息
        company: {
          companyName: job.companyName,
          _id: job.companyId,
          // 如果岗位数据中包含其他公司字段,也可以添加到这里
          industry: job.industry,
          scale: job.scale,
          description: job.companyDescription,
          address: job.location?.address
        }
      })
      
      // 设置地图标记
      if (job.location && job.location.latitude && job.location.longitude) {
        this.setData({
          latitude: job.location.latitude,
          longitude: job.location.longitude,
          markers: [{
            id: 1,
            latitude: job.location.latitude,
            longitude: job.location.longitude,
            title: job.companyName,
            width: 30,
            height: 30
          }]
        })
      }
      
      wx.hideLoading()
    }).catch(err => {
      console.error('获取岗位详情失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '加载失败: ' + (err.errMsg || '未知错误') })
    })
  },


  // 检查投递状态（获取最新的有效投递记录）
  checkApplyStatus() {
    const userId = app.globalData.user?.userId
    console.log('检查投递状态, userId:', userId)
    if (!userId) return

    // 查询该岗位的所有投递记录，按时间排序
    db.collection('applications').where({
      jobId: this.data.jobId,
      candidateId: userId
    }).orderBy('createTime', 'desc').get().then(res => {
      console.log('投递状态查询结果:', res.data)
      
      if (res.data.length > 0) {
        // 找到最新的有效投递记录（优先显示非拒绝状态）
        let latestApplication = res.data.find(app => app.status !== 'rejected')
        if (!latestApplication) {
          // 如果没有非拒绝的记录，取最新的（可能是拒绝）
          latestApplication = res.data[0]
        }
        
        const status = latestApplication.status
        this.setData({ 
          hasApplied: status !== 'rejected',
          applicationStatus: status
        })
      } else {
        this.setData({ 
          hasApplied: false,
          applicationStatus: ''
        })
      }
    }).catch(err => {
      console.error('查询投递状态失败:', err)
    })
  },

  // 获取用户简历
  getUserResume() {
    const userId = app.globalData.user?.userId
    console.log('获取用户简历, userId:', userId)
    if (!userId) return

    db.collection('users').doc(userId).get().then(res => {
      console.log('用户简历查询结果:', res.data)
      if (res.data && res.data.resume) {
        this.setData({ userResume: res.data.resume })
      }
    }).catch(err => {
      console.error('获取简历失败:', err)
    })
  },

  // 播放视频
  playVideo() {
    if (!this.data.job?.videoUrl) {
      wx.showToast({ icon: 'none', title: '暂无视频介绍' })
      return
    }
    this.setData({ 
      currentVideoUrl: this.data.job.videoUrl,
      showVideoModal: true 
    })
  },

  // 关闭视频
  closeVideo() {
    const videoContext = wx.createVideoContext('companyVideo')
    videoContext.pause()
    
    this.setData({ showVideoModal: false }, () => {
      // 延迟清空视频URL，确保关闭动画流畅
      setTimeout(() => {
        this.setData({ currentVideoUrl: '' })
      }, 300)
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止点击视频容器关闭弹窗
  },

  // 阻止滚动穿透
  preventTouchMove() {
    return false
  },

  // 导航到公司地址
  navigateToLocation() {
    if (!this.data.job?.location) {
      wx.showToast({ icon: 'none', title: '暂无地址信息' })
      return
    }

    const location = this.data.job.location
    wx.openLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      name: this.data.job.companyName,
      address: location.address || '',
      scale: 15
    })
  },

  // 投递简历
  applyJob() {
    // 如果已录用，不允许操作
    if (this.data.applicationStatus === 'hired') {
      wx.showToast({ 
        icon: 'none', 
        title: '您已被该职位录用' 
      })
      return
    }

    // 如果已经投递（非拒绝状态），显示取消投递确认框
    if (this.data.hasApplied && this.data.applicationStatus !== 'rejected') {
      wx.showModal({
        title: '取消投递',
        content: '确定要取消投递该职位吗？',
        confirmText: '确认取消',
        cancelText: '我再想想',
        confirmColor: '#ff6b6b',
        success: (res) => {
          if (res.confirm) {
            this.cancelApplication()
          }
        }
      })
      return
    }

    if (!this.data.userResume) {
      wx.showModal({
        title: '提示',
        content: '请先完善简历',
        confirmText: '去完善',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/candidate/resume/edit/index'
            })
          }
        }
      })
      return
    }

    // 验证简历完整性
    const resume = this.data.userResume
    const missingFields = []
    
    console.log('===== 简历验证 =====')
    console.log('简历数据:', resume)
    
    // 基本信息验证
    if (!resume.name || !resume.name.trim()) {
      console.log('缺失: 姓名')
      missingFields.push('姓名')
    }
    if (!resume.gender || resume.gender === '暂未填写') {
      console.log('缺失: 性别')
      missingFields.push('性别')
    }
    if (!resume.age) {
      console.log('缺失: 年龄')
      missingFields.push('年龄')
    }
    if (!resume.phone || !resume.phone.trim()) {
      console.log('缺失: 手机号')
      missingFields.push('手机号')
    }
    if (!resume.education || resume.education === '暂未填写') {
      console.log('缺失: 学历')
      missingFields.push('学历')
    }
    
    // 求职意向验证
    if (!resume.expectedPosition || !resume.expectedPosition.trim()) {
      console.log('缺失: 期望岗位')
      missingFields.push('期望岗位')
    }
    if (!resume.expectedCity || !resume.expectedCity.trim()) {
      console.log('缺失: 期望城市')
      missingFields.push('期望城市')
    }
    if (!resume.expectedSalaryMin || !resume.expectedSalaryMax) {
      console.log('缺失: 期望薪资, min:', resume.expectedSalaryMin, 'max:', resume.expectedSalaryMax)
      missingFields.push('期望薪资')
    }
    
    // 技能和经历验证
    if (!resume.skills || resume.skills.length === 0) {
      console.log('缺失: 技能标签, skills:', resume.skills)
      missingFields.push('技能标签')
    }
    if (!resume.workExperiences || resume.workExperiences.length === 0) {
      console.log('缺失: 工作经历, workExperiences:', resume.workExperiences)
      missingFields.push('工作经历')
    }
    if (!resume.educationExperiences || resume.educationExperiences.length === 0) {
      console.log('缺失: 教育经历, educationExperiences:', resume.educationExperiences)
      missingFields.push('教育经历')
    }
    if (!resume.selfIntroduction || !resume.selfIntroduction.trim()) {
      console.log('缺失: 自我评价, selfIntroduction:', resume.selfIntroduction)
      missingFields.push('自我评价')
    }

    console.log('缺失字段:', missingFields)

    // 如果有未填写的字段，提示用户完善
    if (missingFields.length > 0) {
      wx.showModal({
        title: '简历信息不完整',
        content: `请先完善以下信息：${missingFields.join('、')}`,
        confirmText: '去完善',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/candidate/resume/edit/index'
            })
          }
        }
      })
      return
    }

    if (this.data.hasApplied) {
      wx.showToast({ icon: 'none', title: '您已投递过该职位' })
      return
    }

    // 检查技能认证
    this.checkSkillCertification()
  },
  
  // 检查技能认证
  checkSkillCertification() {
    const userId = app.globalData.user?.userId
    if (!userId) {
      wx.showToast({ icon: 'none', title: '请先登录' })
      return
    }
  
    wx.showLoading({ title: '检查中...' })
  
    // 查询用户的技能认证
    db.collection('skill_certificates').where({
      userId: userId,
      status: 'valid'
    }).get().then(res => {
      wx.hideLoading()
  
      if (res.data.length === 0) {
        // 没有技能认证，弹窗提示并阻止投递
        wx.showModal({
          title: '无法投递',
          content: '请完成认证，否则无法投递',
          confirmText: '去认证',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 用户选择去认证
              wx.navigateTo({
                url: '/pages/candidate/skillExam/index'
              })
            }
          }
        })
      } else {
        // 有技能认证，直接确认投递
        this.confirmSubmit()
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('检查技能认证失败:', err)
      wx.showToast({ icon: 'none', title: '检查失败' })
    })
  },
  
  // 确认投递
  confirmSubmit() {
    wx.showModal({
      title: '确认投递',
      content: `确定要投递“${this.data.job.title}”吗？`,
      success: (res) => {
        if (res.confirm) {
          this.submitApplication()
        }
      }
    })
  },

  // 提交申请
  submitApplication() {
    wx.showLoading({ title: '投递中' })

    const userId = app.globalData.user?.userId
    const userName = app.globalData.user?.name
    const application = {
      jobId: this.data.jobId,
      jobTitle: this.data.job.title,
      companyId: this.data.job.companyId,
      companyName: this.data.job.companyName,
      candidateId: userId,
      candidateName: this.data.userResume.name || userName,
      candidatePhone: this.data.userResume.phone,
      candidateEmail: this.data.userResume.email || '',
      resume: this.data.userResume,
      status: 'submitted',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    db.collection('applications').add({
      data: application
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '投递成功' })
      this.setData({ 
        hasApplied: true,
        applicationStatus: 'submitted'
      })
    }).catch(err => {
      console.error('投递失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '投递失败: ' + (err.errMsg || '未知错误') })
    })
  },

  // 取消投递
  cancelApplication() {
    wx.showLoading({ title: '取消中' })

    const userId = app.globalData.user?.userId
    
    // 调用云函数删除投递记录
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'cancelApplication',
        jobId: this.data.jobId,
        candidateId: userId
      }
    }).then(res => {
      console.log('云函数返回结果:', res)
      wx.hideLoading()
      
      if (res.result && res.result.success) {
        wx.showToast({ title: '已取消投递', icon: 'success' })
        this.setData({ 
          hasApplied: false,
          applicationStatus: ''
        })
      } else {
        const errMsg = res.result?.errMsg || '未知错误'
        wx.showToast({ icon: 'none', title: '取消失败: ' + errMsg })
      }
    }).catch(err => {
      console.error('取消投递失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '取消失败: ' + (err.errMsg || '未知错误') })
    })
  },

  // 预约面试
  bookInterview() {
    if (!this.data.hasApplied) {
      wx.showToast({ icon: 'none', title: '请先投递简历' })
      return
    }

    const userId = app.globalData.user?.userId
    if (!userId) {
      wx.showToast({ icon: 'none', title: '请先登录' })
      return
    }

    wx.showLoading({ title: '检查中...' })

    // 查询投递记录，检查状态（按时间排序，优先取非rejected状态）
    db.collection('applications').where({
      jobId: this.data.jobId,
      candidateId: userId
    }).orderBy('createTime', 'desc').get().then(res => {
      if (res.data.length === 0) {
        wx.hideLoading()
        wx.showToast({ icon: 'none', title: '未找到投递记录' })
        return
      }

      // 优先取非rejected状态的最新记录
      let application = res.data.find(app => app.status !== 'rejected')
      if (!application) {
        application = res.data[0]
      }
      console.log('bookInterview使用的投递记录:', application)
      
      // 检查是否已被录取
      if (application.status === 'hired' || application.status === 'accepted') {
        wx.hideLoading()
        wx.showModal({
          title: '恭喜您',
          content: '您已被录取，无需重复预约面试',
          showCancel: false
        })
        return
      }
      
      // 检查状态是否为"面试中"
      if (application.status !== 'interviewed') {
        wx.hideLoading()
        const statusText = application.status === 'submitted' ? '已投递' :
                          application.status === 'viewed' ? '已查看' :
                          application.status === 'rejected' ? '已拒绝' :
                          application.status === 'accepted' ? '已录用' : '未知'
        wx.showModal({
          title: '提示',
          content: `当前状态为"${statusText}"，只有企业将您的状态更新为"面试中"后才能预约面试。\n\n请等待企业HR通知。`,
          showCancel: false
        })
        return
      }

      // 状态正确，检查是否已经预约过面试
      db.collection('interviews').where({
        applicationId: application._id,
        candidateId: userId
      }).get().then(interviewRes => {
        wx.hideLoading()
        
        if (interviewRes.data.length > 0) {
          // 已经预约过
          const interview = interviewRes.data[0]
          wx.showModal({
            title: '已预约面试',
            content: `您已预约过该岗位的面试\n\n请在"面试"页面查看详情`,
            confirmText: '去查看',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.navigateTo({
                  url: '/pages/candidate/interviews/index'
                })
              }
            }
          })
        } else {
          // 未预约，创建面试记录
          this.createInterview(application)
        }
      })
    }).catch(err => {
      console.error('查询投递记录失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '查询失败' })
    })
  },

  // 创建面试记录
  createInterview(application) {
    wx.showLoading({ title: '预约中...' })

    const userId = app.globalData.user?.userId
    const interview = {
      applicationId: application._id,
      jobId: this.data.jobId,
      jobTitle: this.data.job.title,
      companyId: this.data.job.companyId,
      companyName: this.data.job.companyName,
      candidateId: userId,
      candidateName: application.candidateName,
      candidatePhone: application.candidatePhone,
      status: 'pending', // pending(待确认), confirmed(已确认), completed(已完成), cancelled(已取消)
      interviewTime: null, // 由企业设置具体时间
      location: this.data.job.location?.address || '',
      notes: '等待企业确认面试时间和地点',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    db.collection('interviews').add({
      data: interview
    }).then(() => {
      wx.hideLoading()
      wx.showModal({
        title: '预约成功',
        content: '面试预约已提交！\n\n企业HR会尽快联系您确认面试时间和地点。您可以在"面试"页面查看面试详情。',
        confirmText: '去查看',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/candidate/interviews/index'
            })
          }
        }
      })
    }).catch(err => {
      console.error('创建面试记录失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '预约失败' })
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.job.title} - ${this.data.job.companyName}`,
      path: `/pages/candidate/jobDetail/index?id=${this.data.jobId}`
    }
  },

  // 跳转到薪资分析页
  goToSalaryAnalysis() {
    const job = this.data.job
    if (!job) return

    // 携带岗位信息跳转，自动设置筛选条件
    const query = []
    if (job.industry) {
      query.push(`industry=${encodeURIComponent(job.industry)}`)
    }
    if (job.city) {
      query.push(`city=${encodeURIComponent(job.city)}`)
    }
    if (job.experience) {
      query.push(`experience=${encodeURIComponent(job.experience)}`)
    }

    const url = query.length > 0 
      ? `/pages/candidate/salaryAnalysis/index?${query.join('&')}`
      : '/pages/candidate/salaryAnalysis/index'

    wx.navigateTo({ url })
  }
})
