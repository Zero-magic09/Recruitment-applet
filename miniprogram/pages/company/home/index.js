// 企业端首页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    companyInfo: null,
    stats: {
      jobCount: 0,
      applicationCount: 0,
      interviewCount: 0
    },
    jobs: [],
    filteredJobs: [],
    searchKeyword: '',
    activeTab: 'all',
    isSearchMode: false,
    loading: false
  },

  onLoad() {
    this.getCompanyInfo()
    this.getStats()
    this.getJobs()
  },

  onShow() {
    this.getCompanyInfo() // 刷新企业信息(包括认证状态)
    this.getStats()
    this.getJobs()
  },

  getCompanyInfo() {
    const user = app.globalData.user
    if (!user || !user.userId) return

    db.collection('users').doc(user.userId).get().then(res => {
      if (res.data) {
        this.setData({ companyInfo: res.data })
      }
    }).catch(err => {
      console.error('获取企业信息失败:', err)
    })
  },

  getStats() {
    const user = app.globalData.user
    if (!user || !user.userId) return

    // 获取岗位数量
    db.collection('jobs').where({
      companyId: user.userId
    }).count().then(res => {
      this.setData({ 'stats.jobCount': res.total })
    })

    // 获取投递数量
    db.collection('applications').where({
      companyId: user.userId
    }).count().then(res => {
      this.setData({ 'stats.applicationCount': res.total })
    })

    // 获取面试数量
    db.collection('interviews').where({
      companyId: user.userId
    }).count().then(res => {
      this.setData({ 'stats.interviewCount': res.total })
    })
  },

  // 获取岗位列表
  getJobs() {
    const user = app.globalData.user
    if (!user || !user.userId) return

    this.setData({ loading: true })

    db.collection('jobs').where({
      companyId: user.userId
    }).orderBy('createTime', 'desc').get().then(res => {
      // 格式化时间
      const jobs = res.data.map(item => ({
        ...item,
        createTimeStr: this.formatTime(item.createTime)
      }))

      this.setData({ 
        jobs: jobs,
        loading: false
      })
      this.filterJobs()

      // 获取每个岗位的投递数量
      this.getApplicationCounts()
    }).catch(err => {
      console.error('获取岗位列表失败:', err)
      this.setData({ loading: false })
    })
  },

  // 获取投递数量
  getApplicationCounts() {
    const jobs = this.data.jobs
    jobs.forEach((job, index) => {
      db.collection('applications').where({
        jobId: job._id
      }).count().then(res => {
        this.setData({
          [`jobs[${index}].applicationCount`]: res.total
        })
        this.filterJobs()
      })
    })
  },

  // 格式化时间
  formatTime(time) {
    if (!time) return ''
    
    let date
    if (typeof time === 'number') {
      date = new Date(time)
    } else if (time instanceof Date) {
      date = time
    } else if (typeof time === 'object' && time.$date) {
      date = new Date(time.$date)
    } else {
      return String(time)
    }
    
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${month}-${day}`
  },

  // 筛选岗位
  filterJobs() {
    let filtered = this.data.jobs

    // 按状态筛选
    if (this.data.activeTab === 'active') {
      filtered = filtered.filter(job => job.status === 'active')
    } else if (this.data.activeTab === 'inactive') {
      filtered = filtered.filter(job => job.status === 'inactive')
    }

    // 按搜索关键词筛选
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.toLowerCase()
      filtered = filtered.filter(job => 
        job.title.toLowerCase().includes(keyword)
      )
    }

    this.setData({ filteredJobs: filtered })
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  // 执行搜索
  onSearch() {
    this.setData({ isSearchMode: !!this.data.searchKeyword })
    this.filterJobs()
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchKeyword: '',
      isSearchMode: false
    })
    this.filterJobs()
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.filterJobs()
  },

  // 跳转到岗位详情
  goToJobDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/company/jobDetail/index?id=${id}`
    })
  },

  goToJobPublish() {
    wx.navigateTo({
      url: '/pages/company/jobPublish/index'
    })
  },

  goToJobManage() {
    wx.navigateTo({
      url: '/pages/company/jobManage/index'
    })
  },

  goToInterviewManage() {
    wx.navigateTo({
      url: '/pages/company/interviewManage/index'
    })
  },

  goToCertification() {
    wx.navigateTo({
      url: '/pages/company/certification/index'
    })
  },

  goToCompanyEdit() {
    wx.navigateTo({
      url: '/pages/company/companyEdit/index'
    })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmColor: '#667eea',
      success: (res) => {
        if (res.confirm) {
          // 清除用户信息
          app.globalData.user = null
          
          // 跳转到首页
          wx.reLaunch({
            url: '/pages/index/index'
          })
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  }
})
