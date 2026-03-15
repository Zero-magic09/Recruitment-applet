// 企业认证页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    certStatus: null, // null: 未认证, pending: 审核中, approved: 已通过, rejected: 已拒绝
    formData: {
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
      licenseImage: ''
    },
    scaleOptions: ['0-20人', '20-99人', '100-499人', '500-999人', '1000人以上'],
    scaleIndex: -1,
    industryOptions: ['互联网', '金融', '教育', '医疗', '制造业', '服务业', '房地产', '其他'],
    industryIndex: -1
  },

  onLoad() {
    this.getCertificationInfo()
  },

  onShow() {
    this.getCertificationInfo()
  },

  // 获取认证信息
  getCertificationInfo() {
    const user = app.globalData.user
    console.log('🔍 当前用户信息:', user)
    
    if (!user || !user.userId) {
      console.error('❌ 用户信息不完整:', { user })
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    console.log('📱 开始查询用户数据, userId:', user.userId)
    wx.showLoading({ title: '加载中' })

    db.collection('users').doc(user.userId).get().then(res => {
      console.log('✅ 查询成功, 用户数据:', res.data)
      const userInfo = res.data
      
      // 设置认证状态
      this.setData({
        certStatus: userInfo.certStatus || null
      })
      console.log('📋 认证状态:', userInfo.certStatus)

      // 如果有认证信息，填充表单
      if (userInfo.certification) {
        console.log('📝 发现认证信息, 开始填充表单:', userInfo.certification)
        const cert = userInfo.certification
        this.setData({
          formData: {
            companyName: cert.companyName || '',
            creditCode: cert.creditCode || '',
            legalPerson: cert.legalPerson || '',
            registeredCapital: cert.registeredCapital || '',
            scale: cert.scale || '',
            industry: cert.industry || '',
            address: cert.address || '',
            contactPhone: cert.contactPhone || '',
            contactEmail: cert.contactEmail || '',
            introduction: cert.introduction || '',
            licenseImage: cert.licenseImage || ''
          },
          scaleIndex: cert.scale ? this.data.scaleOptions.indexOf(cert.scale) : -1,
          industryIndex: cert.industry ? this.data.industryOptions.indexOf(cert.industry) : -1
        })
        console.log('✅ 表单填充完成')
      } else {
        console.log('ℹ️ 用户暂无认证信息')
      }

      wx.hideLoading()
    }).catch(err => {
      console.error('❌ 获取认证信息失败:', err)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    })
  },

  // 表单输入事件
  onCompanyNameInput(e) {
    this.setData({ 'formData.companyName': e.detail.value })
  },

  onCreditCodeInput(e) {
    this.setData({ 'formData.creditCode': e.detail.value })
  },

  onLegalPersonInput(e) {
    this.setData({ 'formData.legalPerson': e.detail.value })
  },

  onRegisteredCapitalInput(e) {
    this.setData({ 'formData.registeredCapital': e.detail.value })
  },

  onScaleChange(e) {
    const index = e.detail.value
    this.setData({
      scaleIndex: index,
      'formData.scale': this.data.scaleOptions[index]
    })
  },

  onIndustryChange(e) {
    const index = e.detail.value
    this.setData({
      industryIndex: index,
      'formData.industry': this.data.industryOptions[index]
    })
  },

  onAddressInput(e) {
    this.setData({ 'formData.address': e.detail.value })
  },

  onContactPhoneInput(e) {
    this.setData({ 'formData.contactPhone': e.detail.value })
  },

  onContactEmailInput(e) {
    this.setData({ 'formData.contactEmail': e.detail.value })
  },

  onIntroductionInput(e) {
    this.setData({ 'formData.introduction': e.detail.value })
  },

  // 上传营业执照
  uploadLicense() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        
        wx.showLoading({ title: '上传中...' })
        
        // 上传到云存储
        const cloudPath = `license/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: uploadRes => {
            console.log('上传成功:', uploadRes.fileID)
            this.setData({
              'formData.licenseImage': uploadRes.fileID
            })
            wx.hideLoading()
            wx.showToast({
              title: '上传成功',
              icon: 'success'
            })
          },
          fail: err => {
            console.error('上传失败:', err)
            wx.hideLoading()
            wx.showToast({
              title: '上传失败',
              icon: 'none'
            })
          }
        })
      }
    })
  },

  // 预览营业执照
  previewLicense() {
    wx.previewImage({
      urls: [this.data.formData.licenseImage],
      current: this.data.formData.licenseImage
    })
  },

  // 重新上传营业执照
  reuploadLicense() {
    this.uploadLicense()
  },

  // 验证表单
  validateForm() {
    const { 
      companyName, 
      creditCode, 
      legalPerson, 
      registeredCapital,
      scale,
      industry,
      address,
      contactPhone, 
      contactEmail,
      introduction,
      licenseImage 
    } = this.data.formData

    if (!companyName) {
      wx.showToast({ title: '请输入企业名称', icon: 'none' })
      return false
    }

    if (!creditCode) {
      wx.showToast({ title: '请输入统一社会信用代码', icon: 'none' })
      return false
    }

    if (creditCode.length !== 18) {
      wx.showToast({ title: '统一社会信用代码应为18位', icon: 'none' })
      return false
    }

    if (!legalPerson) {
      wx.showToast({ title: '请输入法定代表人', icon: 'none' })
      return false
    }

    if (!registeredCapital) {
      wx.showToast({ title: '请输入注册资本', icon: 'none' })
      return false
    }

    if (!scale) {
      wx.showToast({ title: '请选择企业规模', icon: 'none' })
      return false
    }

    if (!industry) {
      wx.showToast({ title: '请选择所属行业', icon: 'none' })
      return false
    }

    if (!address) {
      wx.showToast({ title: '请输入企业地址', icon: 'none' })
      return false
    }

    if (!contactPhone) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' })
      return false
    }

    if (!contactEmail) {
      wx.showToast({ title: '请输入企业邮箱', icon: 'none' })
      return false
    }

    // 验证邮箱格式
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(contactEmail)) {
      wx.showToast({ title: '请输入正确的邮箱格式', icon: 'none' })
      return false
    }

    if (!introduction) {
      wx.showToast({ title: '请输入企业简介', icon: 'none' })
      return false
    }

    if (!licenseImage) {
      wx.showToast({ title: '请上传营业执照', icon: 'none' })
      return false
    }

    return true
  },

  // 提交认证
  submitCertification() {
    if (!this.validateForm()) return

    const user = app.globalData.user
    if (!user || !user.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '提交认证',
      content: '请确认所填信息真实有效，提交后将无法修改',
      confirmColor: '#8b7eea',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '验证中...' })

          // 先检查信用代码是否已被其他企业使用
          db.collection('users').where({
            'certification.creditCode': this.data.formData.creditCode,
            role: 'company'
          }).get().then(checkRes => {
            // 如果找到记录,检查是否是当前用户
            if (checkRes.data.length > 0) {
              const existingUser = checkRes.data[0]
              if (existingUser._id !== user.userId) {
                // 信用代码已被其他企业使用
                wx.hideLoading()
                wx.showModal({
                  title: '提示',
                  content: `该统一社会信用代码已被企业"${existingUser.certification?.companyName || '其他企业'}"使用,请检查输入是否正确`,
                  showCancel: false,
                  confirmColor: '#8b7eea'
                })
                return Promise.reject('信用代码重复')
              }
            }
            
            wx.showLoading({ title: '提交中...' })
            const submitTime = new Date()

            // 先获取当前用户数据,检查 certification 是否为 null
            return db.collection('users').doc(user.userId).get().then(userRes => {
              const userData = userRes.data
              const _ = db.command
              
              // 准备更新数据
              const updateData = {
                companyName: this.data.formData.companyName,
                certStatus: 'approved',
                certSubmitTime: submitTime,
                certApproveTime: submitTime,
                // 同步认证信息到用户基本信息字段
                creditCode: this.data.formData.creditCode,
                legalPerson: this.data.formData.legalPerson,
                registeredCapital: this.data.formData.registeredCapital,
                scale: this.data.formData.scale,
                industry: this.data.formData.industry,
                address: this.data.formData.address,
                contactPhone: this.data.formData.contactPhone,
                contactEmail: this.data.formData.contactEmail,
                introduction: this.data.formData.introduction
              }
              
              // 如果 certification 是 null,先删除它,然后再设置新值
              if (userData.certification === null) {
                return db.collection('users').doc(user.userId).update({
                  data: {
                    certification: _.remove()
                  }
                }).then(() => {
                  // 删除后,再设置新值
                  updateData.certification = this.data.formData
                  return db.collection('users').doc(user.userId).update({
                    data: updateData
                  })
                })
              } else {
                // 直接更新
                updateData.certification = this.data.formData
                return db.collection('users').doc(user.userId).update({
                  data: updateData
                })
              }
            })
          }).then(() => {
            wx.hideLoading()
            wx.showToast({
              title: '认证成功',
              icon: 'success',
              duration: 2000
            })
            
            setTimeout(() => {
              this.getCertificationInfo()
            }, 2000)
          }).catch(err => {
            if (err === '信用代码重复') {
              // 已经显示了提示,不再重复提示
              return
            }
            console.error('提交失败:', err)
            wx.hideLoading()
            wx.showToast({
              title: '提交失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  // 重新认证
  handleReauth() {
    wx.showModal({
      title: '重新认证',
      content: '重新认证将清空当前认证信息，是否继续？',
      confirmColor: '#8b7eea',
      success: (res) => {
        if (res.confirm) {
          const user = app.globalData.user
          if (!user || !user.userId) return

          wx.showLoading({ title: '处理中...' })

          // 清除认证信息 - 使用 remove() 删除字段而不是设置为 null
          const _ = db.command
          db.collection('users').doc(user.userId).update({
            data: {
              certStatus: _.remove(),
              certification: _.remove(),
              certSubmitTime: _.remove(),
              certApproveTime: _.remove()
            }
          }).then(() => {
            wx.hideLoading()
            wx.showToast({
              title: '已清除认证信息',
              icon: 'success'
            })
            
            // 刷新当前页面
            setTimeout(() => {
              this.getCertificationInfo()
              
              // 获取所有页面栈
              const pages = getCurrentPages()
              // 查找企业首页
              const homePage = pages.find(page => page.route === 'pages/company/home/index')
              if (homePage && homePage.getCompanyInfo) {
                // 如果企业首页在页面栈中,直接调用其刷新方法
                homePage.getCompanyInfo()
              }
            }, 1500)
          }).catch(err => {
            console.error('清除认证信息失败:', err)
            wx.hideLoading()
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            })
          })
        }
      }
    })
  }
})
