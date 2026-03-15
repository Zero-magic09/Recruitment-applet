// 企业信息编辑页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    companyInfo: {
      logo: '',
      companyName: '',
      creditCode: '',
      legalPerson: '',
      registeredCapital: '',
      scale: '',
      industry: '',
      address: '',
      contactPhone: '',
      contactEmail: '',
      introduction: '',
      mainBusiness: '',
      culture: '',
      benefits: []
    },
    certStatus: '', // approved, pending, rejected, null
    scaleOptions: ['10人以下', '10-50人', '50-100人', '100-500人', '500-1000人', '1000-5000人', '5000-10000人', '10000人以上'],
    industryOptions: ['互联网', '金融', '教育', '医疗', '制造业', '房地产', '零售', '物流', '文化传媒', '其他'],
    scaleIndex: -1,
    industryIndex: -1,
    benefitInput: ''
  },

  onLoad() {
    this.loadCompanyInfo()
  },

  onShow() {
    // 从其他页面返回时重新加载数据，以获取最新的认证状态
    this.loadCompanyInfo()
  },

  // 加载企业信息
  loadCompanyInfo() {
    const user = app.globalData.user
    if (!user || !user.userId) {
      wx.showToast({ icon: 'none', title: '请先登录' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    wx.showLoading({ title: '加载中' })
    
    db.collection('users').doc(user.userId).get().then(res => {
      wx.hideLoading()
      if (res.data) {
        const data = res.data
        const companyInfo = {
          logo: data.logo || data.avatar || '',
          companyName: data.companyName || '',
          creditCode: data.creditCode || '',
          legalPerson: data.legalPerson || '',
          registeredCapital: data.registeredCapital || '',
          scale: data.scale || '',
          industry: data.industry || '',
          address: data.address || '',
          contactPhone: data.contactPhone || data.phone || '',
          contactEmail: data.contactEmail || '',
          introduction: data.introduction || '',
          mainBusiness: data.mainBusiness || '',
          culture: data.culture || '',
          benefits: data.benefits || []
        }
        
        // 设置选择器索引
        const scaleIndex = data.scale ? this.data.scaleOptions.indexOf(data.scale) : -1
        const industryIndex = data.industry ? this.data.industryOptions.indexOf(data.industry) : -1
        
        this.setData({ 
          companyInfo,
          certStatus: data.certStatus || '',
          scaleIndex,
          industryIndex
        })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('加载企业信息失败:', err)
      wx.showToast({ icon: 'none', title: '加载失败' })
    })
  },

  // 上传Logo
  uploadLogo() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        wx.showLoading({ title: '上传中' })
        
        // 上传到云存储
        const cloudPath = `company-logos/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePath,
          success: uploadRes => {
            wx.hideLoading()
            this.setData({
              'companyInfo.logo': uploadRes.fileID
            })
            wx.showToast({ title: '上传成功' })
          },
          fail: err => {
            wx.hideLoading()
            console.error('上传失败:', err)
            wx.showToast({ icon: 'none', title: '上传失败' })
          }
        })
      }
    })
  },

  // 输入处理
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`companyInfo.${field}`]: e.detail.value
    })
  },

  // 规模选择
  onScaleChange(e) {
    const index = e.detail.value
    this.setData({
      scaleIndex: index,
      'companyInfo.scale': this.data.scaleOptions[index]
    })
  },

  // 行业选择
  onIndustryChange(e) {
    const index = e.detail.value
    this.setData({
      industryIndex: index,
      'companyInfo.industry': this.data.industryOptions[index]
    })
  },

  // 福利标签输入
  onBenefitInput(e) {
    this.setData({ benefitInput: e.detail.value })
  },

  // 添加福利标签
  addBenefit() {
    const benefit = this.data.benefitInput.trim()
    if (!benefit) {
      wx.showToast({ icon: 'none', title: '请输入福利内容' })
      return
    }
    if (this.data.companyInfo.benefits.includes(benefit)) {
      wx.showToast({ icon: 'none', title: '该福利已存在' })
      return
    }
    
    const benefits = [...this.data.companyInfo.benefits, benefit]
    this.setData({
      'companyInfo.benefits': benefits,
      benefitInput: ''
    })
  },

  // 删除福利标签
  removeBenefit(e) {
    const index = e.currentTarget.dataset.index
    const benefits = this.data.companyInfo.benefits.filter((_, i) => i !== index)
    this.setData({
      'companyInfo.benefits': benefits
    })
  },

  // 跳转到企业认证
  goToCertification() {
    wx.navigateTo({
      url: '/pages/company/certification/index'
    })
  },

  // 保存企业信息
  saveCompanyInfo() {
    const { companyInfo } = this.data
    
    // 验证必填项
    if (!companyInfo.companyName) {
      wx.showToast({ icon: 'none', title: '请输入企业名称' })
      return
    }
    if (!companyInfo.contactPhone) {
      wx.showToast({ icon: 'none', title: '请输入联系电话' })
      return
    }
    
    // 验证邮箱格式（如果填写了邮箱）
    if (companyInfo.contactEmail && companyInfo.contactEmail.trim()) {
      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(companyInfo.contactEmail.trim())) {
        wx.showToast({ icon: 'none', title: '请输入正确的邮箱格式' })
        return
      }
    }

    const user = app.globalData.user
    if (!user || !user.userId) {
      wx.showToast({ icon: 'none', title: '请先登录' })
      return
    }

    wx.showLoading({ title: '保存中' })
    
    // 更新数据库
    db.collection('users').doc(user.userId).update({
      data: {
        logo: companyInfo.logo,
        companyName: companyInfo.companyName,
        creditCode: companyInfo.creditCode,
        legalPerson: companyInfo.legalPerson,
        registeredCapital: companyInfo.registeredCapital,
        scale: companyInfo.scale,
        industry: companyInfo.industry,
        address: companyInfo.address,
        contactPhone: companyInfo.contactPhone,
        contactEmail: companyInfo.contactEmail,
        introduction: companyInfo.introduction,
        mainBusiness: companyInfo.mainBusiness,
        culture: companyInfo.culture,
        benefits: companyInfo.benefits,
        updatedAt: Date.now()
      }
    }).then(() => {
      wx.hideLoading()
      
      // 更新全局数据
      app.globalData.user.name = companyInfo.companyName
      app.globalData.user.avatar = companyInfo.logo
      
      wx.showToast({ title: '保存成功' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }).catch(err => {
      wx.hideLoading()
      console.error('保存失败:', err)
      wx.showToast({ icon: 'none', title: '保存失败' })
    })
  },

  // 预览企业信息
  previewCompanyInfo() {
    wx.navigateTo({
      url: '/pages/company/companyPreview/index',
      success: (res) => {
        res.eventChannel.emit('companyData', {
          companyInfo: this.data.companyInfo,
          certStatus: this.data.certStatus
        })
      }
    })
  }
})
