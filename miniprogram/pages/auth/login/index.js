// 登录页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    role: '',
    phone: '',
    password: ''
  },

  onLoad(options) {
    const role = options.role || 'candidate'
    this.setData({ role })
    
    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: role === 'candidate' ? '求职者登录' : '企业登录'
    })
  },

  onShow() {
    // 从注册页面返回时，重置表单数据
    this.setData({
      phone: '',
      password: ''
    })
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  // 账号密码登录
  accountLogin() {
    if (!this.data.phone) {
      wx.showToast({ icon: 'none', title: '请输入手机号' })
      return
    }
    if (!this.data.password) {
      wx.showToast({ icon: 'none', title: '请输入密码' })
      return
    }

    wx.showLoading({ title: '登录中' })

    // 查询用户
    db.collection('users').where({
      phone: this.data.phone,
      password: this.data.password,
      role: this.data.role
    }).get().then(res => {
      wx.hideLoading()
      if (res.data.length > 0) {
        // 登录成功，取第一条记录
        const user = res.data[0]
        if (this.data.role === 'company' && (!user.avatar || user.avatar === '/images/用户.png')) {
          db.collection('users').doc(user._id).update({
            data: { avatar: '/images/企业头像.png', updatedAt: Date.now() }
          }).then(() => {
            user.avatar = '/images/企业头像.png'
          }).catch(err => {
            console.warn('更新默认头像失败:', err)
          })
        }
        this.loginWithUser(user)
      } else {
        wx.showToast({ icon: 'none', title: '手机号或密码错误' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('登录失败:', err)
      wx.showToast({ icon: 'none', title: '登录失败' })
    })
  },

  // 跳转到注册页面
  goToRegister() {
    wx.navigateTo({
      url: `/pages/auth/register/index?role=${this.data.role}`
    })
  },

  // 忘记密码
  onForgetPwd() {
    wx.showModal({
      title: '提示',
      content: '请联系管理员重置密码',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#2563eb'
    })
  },

  // 返回首页
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  },

  // 执行登录
  loginWithUser(user) {
    // 保存用户信息到全局
    app.globalData.user = {
      userId: user._id,
      role: this.data.role,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone
    }
    
    wx.showToast({ title: '登录成功' })
    setTimeout(() => {
      this.navigateToHome()
    }, 1500)
  },

  // 跳转到首页
  navigateToHome() {
    if (this.data.role === 'candidate') {
      wx.reLaunch({ url: '/pages/candidate/home/index' })
    } else {
      wx.reLaunch({ url: '/pages/company/home/index' })
    }
  }
})
