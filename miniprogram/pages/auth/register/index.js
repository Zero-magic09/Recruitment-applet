// 注册页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    role: '',
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    showAgreementModal: false,  // 用户协议弹窗
    showPrivacyModal: false  // 隐私政策弹窗
  },

  onLoad(options) {
    const role = options.role || 'candidate'
    this.setData({ role })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: role === 'candidate' ? '求职者注册' : '企业注册'
    })
  },

  // 输入姓名
  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  // 确认密码
  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value })
  },

  // 注册
  register() {
    // 验证
    if (!this.data.name) {
      wx.showToast({ icon: 'none', title: '请填写姓名' })
      return
    }
    if (!this.data.phone) {
      wx.showToast({ icon: 'none', title: '请填写手机号' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(this.data.phone)) {
      wx.showToast({ icon: 'none', title: '手机号格式不正确' })
      return
    }
    if (!this.data.password) {
      wx.showToast({ icon: 'none', title: '请填写密码' })
      return
    }
    if (this.data.password.length < 6) {
      wx.showToast({ icon: 'none', title: '密码至少6位' })
      return
    }
    if (this.data.password !== this.data.confirmPassword) {
      wx.showToast({ icon: 'none', title: '两次密码不一致' })
      return
    }

    wx.showLoading({ title: '注册中' })

    // 检查姓名是否重复
    db.collection('users').where({
      name: this.data.name,
      role: this.data.role
    }).get().then(res => {
      if (res.data.length > 0) {
        wx.hideLoading()
        wx.showToast({ icon: 'none', title: '姓名重复，请重新输入' })
        return Promise.reject('姓名重复')
      }
      
      // 检查手机号是否已注册
      return db.collection('users').where({
        phone: this.data.phone,
        role: this.data.role
      }).get()
    }).then(res => {
      if (res.data.length > 0) {
        wx.hideLoading()
        wx.showToast({ icon: 'none', title: '该手机号已注册' })
        return Promise.reject('手机号已注册')
      }

      // 调用云函数创建用户，获取真实的 openid
      console.log('调用云函数 userInit 创建用户...')
      return wx.cloud.callFunction({
        name: 'userInit',
        data: {
          role: this.data.role,
          forceCreate: true,  // 强制创建新用户
          userInfo: {
            phone: this.data.phone,
            password: this.data.password,
            name: this.data.name,
            avatar: this.data.role === 'company' ? '/images/企业头像.png' : '/images/用户.png'
          }
        }
      })
    }).then(cloudRes => {
      wx.hideLoading()
      console.log('云函数调用成功:', cloudRes)
      
      if (cloudRes.result && cloudRes.result.ok) {
        console.log('注册成功，新用户ID:', cloudRes.result._id)
        console.log('用户 openid:', cloudRes.result.openid)
        wx.showToast({ title: '注册成功' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ icon: 'none', title: '注册失败' })
      }
    }).catch(err => {
      // 如果是验证错误，已经处理过，直接返回
      if (err === '姓名重复' || err === '手机号已注册') {
        return
      }
      wx.hideLoading()
      console.error('注册失败', err)
      wx.showToast({ icon: 'none', title: '注册失败: ' + (err.errMsg || '未知错误') })
    })
  },

  // 显示用户协议
  showAgreement() {
    this.setData({ showAgreementModal: true })
  },

  // 显示隐私政策
  showPrivacy() {
    this.setData({ showPrivacyModal: true })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showAgreementModal: false,
      showPrivacyModal: false
    })
  }
})
