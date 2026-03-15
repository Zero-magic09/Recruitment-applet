// 企业岗位发布页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    jobId: null, // 编辑时的岗位ID
    isEdit: false, // 是否为编辑模式
    job: {
      title: '',
      description: '',
      requirements: '',
      salaryMin: '',
      salaryMax: '',
      city: '',
      experience: '不限',
      education: '不限',
      tags: [],
      benefits: [],
      videoUrl: '',
      location: null
    },
    tagInput: '',
    benefitInput: '',
    experienceArray: ['不限', '应届生', '1年以下', '1-3年', '3-5年', '5-10年', '10年以上'],
    educationArray: ['不限', '高中及以下', '大专', '本科', '硕士', '博士']
  },

  onLoad(options) {
    // 验证企业信息完整性和认证状态
    this.checkCompanyPermission().then(canPublish => {
      if (!canPublish) {
        return
      }
      
      // 如果id参数，则为编辑模式
      if (options.id) {
        this.setData({
          jobId: options.id,
          isEdit: true
        })
        // 设置页面标题为编辑岗位
        wx.setNavigationBarTitle({
          title: '编辑岗位'
        })
        this.loadJobData(options.id)
      } else {
        // 设置页面标题为发布岗位
        wx.setNavigationBarTitle({
          title: '发布岗位'
        })
      }
    })
  },

  // 验证企业发布权限
  checkCompanyPermission() {
    return new Promise((resolve) => {
      const user = app.globalData.user
      if (!user || !user.userId) {
        wx.showModal({
          title: '提示',
          content: '请先登录',
          showCancel: false,
          confirmColor: '#667eea',
          success: () => {
            wx.navigateBack()
            resolve(false)
          }
        })
        return
      }

      wx.showLoading({ title: '加载中' })
      
      db.collection('users').doc(user.userId).get().then(res => {
        wx.hideLoading()
        const companyInfo = res.data
        
        // 验证认证状态
        if (companyInfo.certStatus !== 'approved') {
          wx.showModal({
            title: '无法发布岗位',
            content: '请完善企业信息，否则无法发布岗位',
            confirmText: '去完善',
            cancelText: '返回',
            confirmColor: '#667eea',
            success: (res) => {
              if (res.confirm) {
                // 跳转到企业认证页面
                wx.redirectTo({
                  url: '/pages/company/certification/index'
                })
              } else {
                wx.navigateBack()
              }
              resolve(false)
            }
          })
          return
        }
        
        // 验证企业信息完整性
        const missingFields = []
        if (!companyInfo.companyName) missingFields.push('企业名称')
        if (!companyInfo.creditCode) missingFields.push('社会信用代码')
        if (!companyInfo.legalPerson) missingFields.push('法定代表人')
        if (!companyInfo.registeredCapital) missingFields.push('注册资本')
        if (!companyInfo.scale) missingFields.push('企业规模')
        if (!companyInfo.industry) missingFields.push('所属行业')
        if (!companyInfo.address) missingFields.push('企业地址')
        if (!companyInfo.contactPhone) missingFields.push('联系电话')
        if (!companyInfo.contactEmail) missingFields.push('企业邮箱')
        if (!companyInfo.introduction) missingFields.push('企业简介')
        
        if (missingFields.length > 0) {
          wx.showModal({
            title: '无法发布岗位',
            content: '请完善企业信息，否则无法发布岗位',
            confirmText: '去完善',
            cancelText: '返回',
            confirmColor: '#667eea',
            success: (res) => {
              if (res.confirm) {
                // 跳转到企业信息编辑页面
                wx.redirectTo({
                  url: '/pages/company/companyEdit/index'
                })
              } else {
                wx.navigateBack()
              }
              resolve(false)
            }
          })
          return
        }
        
        // 信息完整且已认证，允许发布
        resolve(true)
      }).catch(err => {
        wx.hideLoading()
        console.error('验证企业信息失败:', err)
        wx.showModal({
          title: '错误',
          content: '无法验证企业信息，请稍后重试',
          showCancel: false,
          confirmColor: '#667eea',
          success: () => {
            wx.navigateBack()
            resolve(false)
          }
        })
      })
    })
  },

  // 加载岗位数据
  loadJobData(jobId) {
    wx.showLoading({ title: '加载中' })
    console.log('加载岗位数据, ID:', jobId)
    
    db.collection('jobs').doc(jobId).get().then(res => {
      console.log('岗位数据查询结果:', res)
      
      if (!res.data) {
        throw new Error('岗位数据不存在')
      }
      
      const jobData = res.data
      
      // 验证是否是当前用户的岗位
      const userId = app.globalData.user?.userId
      if (jobData.companyId !== userId) {
        throw new Error('没有权限编辑该岗位')
      }
      
      this.setData({
        job: {
          title: jobData.title || '',
          description: jobData.description || '',
          requirements: jobData.requirements || '',
          salaryMin: jobData.salaryMin?.toString() || '',
          salaryMax: jobData.salaryMax?.toString() || '',
          city: jobData.city || '',
          experience: jobData.experience || '不限',
          education: jobData.education || '不限',
          tags: jobData.tags || [],
          benefits: jobData.benefits || [],
          videoUrl: jobData.videoUrl || '',
          location: jobData.location || null
        }
      })
      wx.hideLoading()
    }).catch(err => {
      console.error('加载岗位失败:', err)
      wx.hideLoading()
      
      wx.showModal({
        title: '加载失败',
        content: err.message || '无法加载岗位数据，请重试',
        showCancel: true,
        confirmText: '重试',
        cancelText: '返回',
        confirmColor: '#667eea',
        success: (res) => {
          if (res.confirm) {
            this.loadJobData(jobId)
          } else {
            wx.navigateBack()
          }
        }
      })
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`job.${field}`]: e.detail.value
    })
  },

  onExperienceChange(e) {
    this.setData({
      'job.experience': this.data.experienceArray[e.detail.value]
    })
  },

  onEducationChange(e) {
    this.setData({
      'job.education': this.data.educationArray[e.detail.value]
    })
  },

  onTagInput(e) {
    this.setData({ tagInput: e.detail.value })
  },

  addTag() {
    const tag = this.data.tagInput.trim()
    if (!tag) return
    const tags = this.data.job.tags || []
    if (!tags.includes(tag)) {
      tags.push(tag)
      this.setData({
        'job.tags': tags,
        tagInput: ''
      })
    }
  },

  removeTag(e) {
    const index = e.currentTarget.dataset.index
    const tags = this.data.job.tags || []
    tags.splice(index, 1)
    this.setData({ 'job.tags': tags })
  },

  onBenefitInput(e) {
    this.setData({ benefitInput: e.detail.value })
  },

  addBenefit() {
    const benefit = this.data.benefitInput.trim()
    if (!benefit) return
    const benefits = this.data.job.benefits || []
    if (!benefits.includes(benefit)) {
      benefits.push(benefit)
      this.setData({
        'job.benefits': benefits,
        benefitInput: ''
      })
    }
  },

  removeBenefit(e) {
    const index = e.currentTarget.dataset.index
    const benefits = this.data.job.benefits || []
    benefits.splice(index, 1)
    this.setData({ 'job.benefits': benefits })
  },

  uploadVideo() {
    wx.chooseVideo({
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      success: (res) => {
        wx.showLoading({ title: '上传中' })
        const cloudPath = `videos/job_${Date.now()}.mp4`
        wx.cloud.uploadFile({
          cloudPath,
          filePath: res.tempFilePath,
        }).then(uploadRes => {
          this.setData({
            'job.videoUrl': uploadRes.fileID
          })
          wx.hideLoading()
          wx.showToast({ title: '上传成功' })
        }).catch(err => {
          wx.hideLoading()
          wx.showToast({ icon: 'none', title: '上传失败' })
        })
      }
    })
  },

  selectLocation() {
    wx.chooseLocation({
      success: (res) => {
        console.log('选择位置成功:', res)
        this.setData({
          'job.location': {
            latitude: res.latitude,
            longitude: res.longitude,
            address: res.address,
            name: res.name
          }
        })
        wx.showToast({ title: '位置选择成功', icon: 'success' })
      },
      fail: (err) => {
        console.error('选择位置失败:', err)
        // 检查是否是权限问题
        if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('authorize') !== -1) {
          wx.showModal({
            title: '提示',
            content: '需要获取你的位置权限，请在设置中开启',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({ 
            icon: 'none', 
            title: '选择位置失败: ' + (err.errMsg || '未知错误')
          })
        }
      }
    })
  },

  publish() {
    const { job } = this.data
    const missingFields = []

    // 验证所有必填字段
    if (!job.title || !job.title.trim()) {
      missingFields.push('职位名称')
    }
    if (!job.city || !job.city.trim()) {
      missingFields.push('工作城市')
    }
    if (!job.salaryMin || !job.salaryMin.toString().trim()) {
      missingFields.push('最低薪资')
    }
    if (!job.salaryMax || !job.salaryMax.toString().trim()) {
      missingFields.push('最高薪资')
    }
    if (!job.description || !job.description.trim()) {
      missingFields.push('职位描述')
    }
    if (!job.requirements || !job.requirements.trim()) {
      missingFields.push('任职要求')
    }
    if (!job.experience || job.experience === '') {
      missingFields.push('经验要求')
    }
    if (!job.education || job.education === '') {
      missingFields.push('学历要求')
    }
    if (!job.tags || job.tags.length === 0) {
      missingFields.push('技能标签')
    }
    if (!job.benefits || job.benefits.length === 0) {
      missingFields.push('福利待遇')
    }
    if (!job.location) {
      missingFields.push('工作地点')
    }

    // 如果有未填写的字段，显示提示
    if (missingFields.length > 0) {
      const message = `请填写以下信息：\n${missingFields.join('、')}`
      wx.showModal({
        title: '信息未填写完整',
        content: message,
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#667eea'
      })
      return
    }

    // 验证薪资范围的合理性
    const salaryMin = parseInt(job.salaryMin)
    const salaryMax = parseInt(job.salaryMax)
    if (isNaN(salaryMin) || isNaN(salaryMax)) {
      wx.showToast({ icon: 'none', title: '薪资必须为数字' })
      return
    }
    if (salaryMin < 0 || salaryMax < 0) {
      wx.showToast({ icon: 'none', title: '薪资不能为负数' })
      return
    }
    if (salaryMin > salaryMax) {
      wx.showToast({ icon: 'none', title: '最低薪资不能高于最高薪资' })
      return
    }

    wx.showLoading({ title: this.data.isEdit ? '保存中' : '发布中' })

    const user = app.globalData.user
    if (!user || !user.userId) {
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '请先登录' })
      return
    }

    // 如果是编辑模式，直接更新
    if (this.data.isEdit) {
      const updateData = {
        title: job.title.trim(),
        description: job.description.trim(),
        requirements: job.requirements.trim(),
        salaryMin: salaryMin,
        salaryMax: salaryMax,
        city: job.city.trim(),
        experience: job.experience,
        education: job.education,
        tags: job.tags || [],
        benefits: job.benefits || [],
        location: job.location || null,
        videoUrl: job.videoUrl || '',
        updateTime: db.serverDate()
      }

      console.log('更新岗位数据:', updateData)
      console.log('岗位ID:', this.data.jobId)

      db.collection('jobs').doc(this.data.jobId).update({
        data: updateData
      }).then(res => {
        console.log('更新成功:', res)
        wx.hideLoading()
        wx.showToast({ title: '更新成功' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }).catch(err => {
        console.error('更新失败详情:', err)
        console.error('错误信息:', err.errMsg)
        console.error('错误代码:', err.errCode)
        wx.hideLoading()
        
        // 更详细的错误提示
        let errorMsg = '更新失败'
        if (err.errMsg) {
          if (err.errMsg.includes('permission')) {
            errorMsg = '没有权限更新该岗位'
          } else if (err.errMsg.includes('not found')) {
            errorMsg = '岗位不存在'
          } else if (err.errMsg.includes('network')) {
            errorMsg = '网络错误，请检查网络连接'
          }
        }
        
        wx.showModal({
          title: '更新失败',
          content: errorMsg + '\n\n' + (err.errMsg || '未知错误'),
          showCancel: false,
          confirmColor: '#667eea'
        })
      })
      return
    }

    // 新建岗位模式
    // 获取企业信息
    db.collection('users').doc(user.userId).get().then(res => {
      const companyInfo = res.data
      
      // 构建完整的岗位数据，与jobs_data.json保持一致
      const jobData = {
        companyId: user.userId,
        companyOpenid: user.openid,
        companyName: companyInfo.companyName || '未填写',
        title: job.title.trim(),
        description: job.description.trim(),
        requirements: job.requirements.trim(),
        salaryMin: salaryMin,
        salaryMax: salaryMax,
        city: job.city.trim(),
        experience: job.experience,
        education: job.education,
        tags: job.tags || [],
        benefits: job.benefits || [],
        status: 'active',
        industry: companyInfo.industry || '互联网',
        scale: companyInfo.scale || '100-500人',
        companyDescription: companyInfo.introduction || '',
        location: job.location || null,
        videoUrl: job.videoUrl || '',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }

      return db.collection('jobs').add({
        data: jobData
      })
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '发布成功' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }).catch(err => {
      console.error('发布失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '发布失败' })
    })
  }
})
