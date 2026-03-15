// 简历编辑页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: null,
    resume: {
      name: '',
      gender: '暂未填写',
      age: '',
      phone: '',
      email: '',
      education: '暂未填写',
      avatar: '',
      expectedPosition: '',
      expectedCity: '',
      expectedSalaryMin: '',
      expectedSalaryMax: '',
      skills: [],
      workExperiences: [],
      educationExperiences: [],
      selfIntroduction: ''
    },
    certificates: [], // 技能证书列表
    skillInput: '',
    genderArray: ['暂未填写', '男', '女'],
    educationArray: ['暂未填写', '高中及以下', '大专', '本科', '硕士', '博士'],
    isFirstShow: true, // 标记是否是首次显示
  },

  onLoad() {
    console.log('简历编辑页面加载')
    console.log('onLoad - 当前用户:', app.globalData.user)
    // onLoad时不加载数据，等到onShow时再加载
    // 这样切换用户后重新进入页面时会加载新用户的数据
  },

  onShow() {
    console.log('简历编辑页面显示')
    console.log('onShow - 当前用户:', app.globalData.user)
    
    // 从添加/编辑经历页面返回后处理数据更新
    // 处理新增工作经历
    if (this.data.newWorkExperience && typeof this.data.newWorkExperience === 'object') {
      console.log('检测到新增工作经历:', this.data.newWorkExperience)
      const experiences = this.data.resume.workExperiences || []
      experiences.push(this.data.newWorkExperience)
      this.setData({ 
        'resume.workExperiences': experiences,
        newWorkExperience: null
      })
      console.log('新增后的工作经历列表:', experiences)
      return // 新增后不重新加载数据
    }
    
    // 处理编辑工作经历（必须有index属性）
    if (this.data.editedWorkExperience && 
        typeof this.data.editedWorkExperience === 'object' && 
        this.data.editedWorkExperience.index !== undefined) {
      console.log('检测到编辑工作经历:', this.data.editedWorkExperience)
      const experiences = [...this.data.resume.workExperiences]
      const index = this.data.editedWorkExperience.index
      experiences[index] = this.data.editedWorkExperience
      this.setData({ 
        'resume.workExperiences': experiences,
        editedWorkExperience: null
      })
      console.log('编辑后的工作经历列表:', experiences)
      return // 编辑后不重新加载数据
    }
    
    // 处理新增教育经历
    if (this.data.newEducationExperience && typeof this.data.newEducationExperience === 'object') {
      console.log('检测到新增教育经历:', this.data.newEducationExperience)
      const experiences = this.data.resume.educationExperiences || []
      experiences.push(this.data.newEducationExperience)
      this.setData({ 
        'resume.educationExperiences': experiences,
        newEducationExperience: null
      })
      console.log('新增后的教育经历列表:', experiences)
      return // 新增后不重新加载数据
    }
    
    // 处理编辑教育经历（必须有index属性）
    if (this.data.editedEducationExperience && 
        typeof this.data.editedEducationExperience === 'object' && 
        this.data.editedEducationExperience.index !== undefined) {
      console.log('检测到编辑教育经历:', this.data.editedEducationExperience)
      const experiences = [...this.data.resume.educationExperiences]
      const index = this.data.editedEducationExperience.index
      experiences[index] = this.data.editedEducationExperience
      this.setData({ 
        'resume.educationExperiences': experiences,
        editedEducationExperience: null
      })
      console.log('编辑后的教育经历列表:', experiences)
      return // 编辑后不重新加载数据
    }
    
    // 每次显示都重新加载用户数据，确保使用最新用户
    console.log('重新加载用户数据')
    this.loadUserData()
  },

  // 加载用户数据
  loadUserData() {
    const user = app.globalData.user
    console.log('===== 简历编辑页面加载用户数据 =====')
    console.log('1. app.globalData.user:', user)
    
    if (!user || !user.userId) {
      console.log('错误：没有用户信息或userId')
      wx.showToast({ icon: 'none', title: '请先登录' })
      return
    }

    console.log('2. 准备查询用户，userId:', user.userId)
    wx.showLoading({ title: '加载中' })
    
    db.collection('users').doc(user.userId).get().then(res => {
      console.log('3. 数据库查询结果:', res)
      console.log('3.1 用户数据:', res.data)
      console.log('3.2 用户_openid:', res.data?._openid)
      
      if (res.data) {
        const userInfo = res.data
        console.log('4. 找到用户信息:', {
          _id: userInfo._id,
          name: userInfo.name,
          phone: userInfo.phone,
          _openid: userInfo._openid,
          hasResume: !!userInfo.resume
        })
        
        // 如果有简历数据，使用简历数据，但同步最新的用户基本信息
        if (userInfo.resume) {
          console.log('5. 使用已有简历数据，并同步最新用户信息')
          const updatedResume = {
            ...userInfo.resume,
            name: userInfo.name || userInfo.resume.name,
            phone: userInfo.phone || userInfo.resume.phone,
            avatar: userInfo.avatar || userInfo.resume.avatar
          }
          this.setData({ 
            userInfo,
            resume: updatedResume
          })
        } else {
          // 如果没有简历数据，使用用户注册信息初始化简历
          console.log('6. 使用用户信息初始化简历')
          const resume = {
            ...this.data.resume,
            name: userInfo.name || '',
            phone: userInfo.phone || '',
            avatar: userInfo.avatar || ''
          }
          this.setData({ 
            userInfo,
            resume
          })
        }
      } else {
        console.log('错误：未找到用户数据')
        wx.showToast({ icon: 'none', title: '用户数据不存在' })
      }
      wx.hideLoading()
    }).catch(err => {
      console.error('数据库查询失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '加载失败' })
    })
    
    // 加载证书数据
    this.loadCertificates()
  },

  // 加载技能证书
  loadCertificates() {
    const user = app.globalData.user
    if (!user || !user.userId) return

    db.collection('skill_certificates').where({
      userId: user.userId,
      status: 'valid'
    }).orderBy('issueDate', 'desc').get().then(res => {
      console.log('加载到证书数据:', res.data)
      this.setData({ 
        certificates: res.data 
      })
    }).catch(err => {
      console.error('加载证书失败:', err)
    })
  },

  // 输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`resume.${field}`]: e.detail.value
    })
  },

  // 选择性别
  onGenderChange(e) {
    this.setData({
      'resume.gender': this.data.genderArray[e.detail.value]
    })
  },

  // 选择学历
  onEducationChange(e) {
    this.setData({
      'resume.education': this.data.educationArray[e.detail.value]
    })
  },

  // 跳转到技能认证
  goToSkillExam() {
    wx.navigateTo({
      url: '/pages/candidate/skillExam/index?category=计算机与信息技术'
    })
  },

  // 查看证书
  viewCertificate(e) {
    const certId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/candidate/skillCertificate/index?certId=${certId}`
    })
  },

  // 上传头像
  uploadAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        wx.showLoading({ title: '上传中' })
        const filePath = res.tempFilePaths[0]
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
        }).then(uploadRes => {
          this.setData({
            'resume.avatar': uploadRes.fileID
          })
          wx.hideLoading()
          wx.showToast({ title: '上传成功' })
        }).catch(err => {
          console.error('上传头像失败', err)
          wx.hideLoading()
          wx.showToast({ icon: 'none', title: '上传失败' })
        })
      }
    })
  },

  // 技能输入
  onSkillInput(e) {
    this.setData({ skillInput: e.detail.value })
  },

  // 添加技能
  addSkill() {
    const skill = this.data.skillInput.trim()
    if (!skill) return

    const skills = this.data.resume.skills || []
    if (skills.includes(skill)) {
      wx.showToast({ icon: 'none', title: '技能已存在' })
      return
    }

    skills.push(skill)
    this.setData({
      'resume.skills': skills,
      skillInput: ''
    })
  },

  // 删除技能
  removeSkill(e) {
    const index = e.currentTarget.dataset.index
    const skills = this.data.resume.skills || []
    skills.splice(index, 1)
    this.setData({ 'resume.skills': skills })
  },

  // 添加工作经历
  addWorkExperience() {
    wx.navigateTo({
      url: '/pages/candidate/resume/addWork/index'
    })
  },

  // 编辑工作经历
  editWorkExperience(e) {
    const index = e.currentTarget.dataset.index
    const experience = this.data.resume.workExperiences[index]
    // 将数据编码后传递
    const encodedData = encodeURIComponent(JSON.stringify({ ...experience, index }))
    wx.navigateTo({
      url: `/pages/candidate/resume/addWork/index?edit=true&data=${encodedData}`
    })
  },

  // 添加教育经历
  addEducationExperience() {
    wx.navigateTo({
      url: '/pages/candidate/resume/addEducation/index'
    })
  },

  // 编辑教育经历
  editEducationExperience(e) {
    const index = e.currentTarget.dataset.index
    const experience = this.data.resume.educationExperiences[index]
    // 将数据编码后传递
    const encodedData = encodeURIComponent(JSON.stringify({ ...experience, index }))
    wx.navigateTo({
      url: `/pages/candidate/resume/addEducation/index?edit=true&data=${encodedData}`
    })
  },

  // 删除工作经历
  removeWorkExperience(e) {
    const index = e.currentTarget.dataset.index
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条工作经历吗？',
      success: (res) => {
        if (res.confirm) {
          const experiences = this.data.resume.workExperiences || []
          experiences.splice(index, 1)
          this.setData({ 'resume.workExperiences': experiences })
        }
      }
    })
  },

  // 删除教育经历
  removeEducationExperience(e) {
    const index = e.currentTarget.dataset.index
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条教育经历吗？',
      success: (res) => {
        if (res.confirm) {
          const experiences = this.data.resume.educationExperiences || []
          experiences.splice(index, 1)
          this.setData({ 'resume.educationExperiences': experiences })
        }
      }
    })
  },

  // 预览简历
  previewResume() {
    wx.navigateTo({
      url: '/pages/candidate/resume/preview/index',
      success: (res) => {
        res.eventChannel.emit('resumeData', this.data.resume)
      }
    })
  },

  // 保存简历
  saveResume() {
    console.log('===== 点击了保存按钮 =====')
    
    // 重新获取最新的用户信息，确保 userId 是最新的
    const user = app.globalData.user
    console.log('1. 当前用户信息:', JSON.stringify(user, null, 2))
    
    if (!user || !user.userId) {
      console.log('错误：没有用户信息或userId')
      wx.showToast({ icon: 'none', title: '请先登录' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/auth/login/index?role=candidate' })
      }, 1500)
      return
    }
    
    console.log('2. 当前简历数据:', JSON.stringify(this.data.resume, null, 2))
    
    // 验证必填项
    if (!this.data.resume.name) {
      wx.showToast({ icon: 'none', title: '请填写姓名' })
      return
    }
    if (!this.data.resume.phone) {
      wx.showToast({ icon: 'none', title: '请填写手机号' })
      return
    }
    
    // 验证邮箱格式（如果填写了邮箱）
    if (this.data.resume.email && this.data.resume.email.trim()) {
      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(this.data.resume.email.trim())) {
        wx.showToast({ icon: 'none', title: '请输入正确的邮箱格式' })
        return
      }
    }

    wx.showLoading({ title: '保存中' })

    const userId = user.userId
    console.log('3. 准备保存到用户ID:', userId)
    console.log('4. 用户ID类型:', typeof userId)
    
    const updateData = {
      resume: this.data.resume,
      name: this.data.resume.name,
      avatar: this.data.resume.avatar,
      updatedAt: Date.now()
    }
    
    console.log('5. 准备保存的数据:', JSON.stringify(updateData, null, 2))
    console.log('6. 先验证文档是否存在...')
    
    // 先查询文档是否存在
    db.collection('users').doc(userId).get().then(getRes => {
      console.log('7. 文档查询结果:', JSON.stringify(getRes, null, 2))
      console.log('7.1 文档data:', getRes.data)
      console.log('7.2 文档_id:', getRes.data?._id)
      console.log('7.3 文档_openid:', getRes.data?._openid)
      
      if (!getRes.data || !getRes.data._id) {
        console.error('❌ 文档不存在！')
        wx.hideLoading()
        wx.showModal({
          title: '保存失败',
          content: '用户数据不存在，请重新登录',
          showCancel: false
        })
        return Promise.reject('文档不存在')
      }
      
      console.log('8. 文档存在，开始执行更新...')
      console.log('8.1 使用的userId:', userId)
      console.log('8.2 数据库中的_id:', getRes.data._id)
      console.log('8.3 userId是否等于_id:', userId === getRes.data._id)
      
      // 更新用户简历
      return db.collection('users').doc(userId).update({
        data: updateData
      })
    }).then((res) => {
      console.log('✅ 保存成功，返回结果:', JSON.stringify(res, null, 2))
      console.log('✅ 更新的文档数量:', res.stats.updated)
      
      // 更新全局用户信息
      app.globalData.user.name = updateData.name
      app.globalData.user.avatar = updateData.avatar
      
      wx.hideLoading()
      wx.showToast({ 
        title: '保存成功',
        icon: 'success',
        duration: 2000
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }).catch(err => {
      console.error('❌ 保存失败，完整错误信息:', JSON.stringify(err, null, 2))
      console.error('❌ 错误代码:', err.errCode)
      console.error('❌ 错误信息:', err.errMsg)
      wx.hideLoading()
      
      let errorMsg = '保存失败'
      if (err.errMsg) {
        errorMsg += ': ' + err.errMsg
      }
      if (err.errCode) {
        errorMsg += ' (code: ' + err.errCode + ')'
      }
      
      wx.showModal({
        title: '保存失败',
        content: errorMsg,
        showCancel: false
      })
    })
  }
})
