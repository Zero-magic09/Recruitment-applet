// 投递记录页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    applications: [],
    loading: false,
    statusMap: {
      submitted: '已投递',
      viewed: '已查看',
      interviewed: '待面试',
      rejected: '已拒绝',
      hired: '已录用',
      accepted: '已录用'
    },
    startX: 0,
    startY: 0,
    longPressTimer: null,
    canSwipe: false,
    deleteThreshold: -250,
    longPressDuration: 300 // 长按时间改为300ms，提高灵敏度
  },

  onLoad() {
    this.getApplications()
  },

  onShow() {
    this.getApplications()
  },

  getApplications() {
    const userId = app.globalData.user?.userId
    console.log('获取投递记录, userId:', userId)
    if (!userId) {
      console.log('没有userId')
      return
    }

    this.setData({ loading: true })
    
    db.collection('applications').where({
      candidateId: userId
    }).orderBy('createTime', 'desc').get().then(res => {
      console.log('投递记录查询结果:', res.data)
      
      // 获取所有岗位ID
      const jobIds = res.data.map(item => item.jobId).filter(id => id)
      
      if (jobIds.length === 0) {
        this.setData({ 
          applications: [],
          loading: false 
        })
        return
      }
      
      // 查询这些岗位是否还存在
      db.collection('jobs').where({
        _id: db.command.in(jobIds)
      }).get().then(jobsRes => {
        console.log('岗位查询结果:', jobsRes.data)
        
        // 获取存在的岗位ID集合
        const existingJobIds = new Set(jobsRes.data.map(job => job._id))
        
        // 过滤出岗位还存在的投递记录
        const validApplications = res.data.filter(item => existingJobIds.has(item.jobId))
        
        console.log('过滤后的投递记录:', validApplications)
        
        // 格式化时间
        const applications = validApplications.map(item => ({
          ...item,
          createTime: this.formatTime(item.createTime)
        }))
        
        this.setData({ 
          applications,
          loading: false 
        })
      }).catch(err => {
        console.error('查询岗位失败:', err)
        // 如果查询岗位失败，仍然显示所有投递记录
        const applications = res.data.map(item => ({
          ...item,
          createTime: this.formatTime(item.createTime)
        }))
        this.setData({ 
          applications,
          loading: false 
        })
      })
    }).catch(err => {
      console.error('获取投递记录失败:', err)
      this.setData({ loading: false })
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

  goToJobDetail(e) {
    const jobId = e.currentTarget.dataset.jobid
    // 不传递状态，让岗位详情页自己查询最新状态
    wx.navigateTo({
      url: `/pages/candidate/jobDetail/index?id=${jobId}`
    })
  },

  // 跳转到面试页面
  goToInterview(e) {
    const jobId = e.currentTarget.dataset.jobid
    const status = e.currentTarget.dataset.status

    // 跳转到面试页面，传递jobId用于筛选
    wx.navigateTo({
      url: `/pages/candidate/interviews/index?jobId=${jobId}`
    })
  },

  onPullDownRefresh() {
    this.getApplications()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 触摸开始
  touchStart(e) {
    const touch = e.touches[0]
    this.setData({
      startX: touch.clientX,
      startY: touch.clientY,
      canSwipe: false
    })

    // 设置长按定时器（300ms）
    const timer = setTimeout(() => {
      this.setData({ canSwipe: true })
      console.log('长按触发，可以滑动')
    }, this.data.longPressDuration)

    this.setData({ longPressTimer: timer })
  },

  // 触摸移动
  touchMove(e) {
    const touch = e.touches[0]
    const index = e.currentTarget.dataset.index
    const moveX = touch.clientX - this.data.startX
    const moveY = touch.clientY - this.data.startY

    // 只有长按后才能滑动
    if (!this.data.canSwipe) {
      // 如果在长按期间移动了，取消长按（阈值降低为3px）
      if (Math.abs(moveX) > 3 || Math.abs(moveY) > 3) {
        if (this.data.longPressTimer) {
          clearTimeout(this.data.longPressTimer)
          this.setData({ longPressTimer: null })
        }
      }
      return
    }

    // 判断是否为横向滑动（降低阈值，提高灵敏度）
    if (Math.abs(moveX) > Math.abs(moveY) * 0.5) {
      // 只允许左滑
      if (moveX < 0) {
        // 获取屏幕宽度
        const systemInfo = wx.getSystemInfoSync()
        const screenWidth = systemInfo.windowWidth
        const maxSwipe = -(screenWidth / 2) // 允许最大滑动到屏幕一半
        const translateX = Math.max(moveX, maxSwipe)
        this.setData({
          [`applications[${index}].translateX`]: translateX
        })
      }
    }
  },

  // 触摸结束
  touchEnd(e) {
    const index = e.currentTarget.dataset.index
    const id = e.currentTarget.dataset.id

    // 清除长按定时器
    if (this.data.longPressTimer) {
      clearTimeout(this.data.longPressTimer)
      this.setData({ longPressTimer: null })
    }

    // 如果没有长按，直接复位
    if (!this.data.canSwipe) {
      this.setData({ 
        canSwipe: false,
        [`applications[${index}].translateX`]: 0
      })
      return
    }

    const translateX = this.data.applications[index]?.translateX || 0
    
    // 获取屏幕宽度，计算三分之一
    const systemInfo = wx.getSystemInfoSync()
    const screenWidth = systemInfo.windowWidth
    const oneThird = -(screenWidth / 3) // 左滑为负值

    console.log('滑动距离:', translateX, '阈值:', oneThird)

    // 如果左滑超过三分之一，检查状态并弹出删除确认框
    if (translateX < oneThird) {
      // 先复位卡片
      this.setData({ 
        [`applications[${index}].translateX`]: 0,
        canSwipe: false
      })

      // 检查投递状态
      const status = this.data.applications[index]?.status
      console.log('当前投递状态:', status)

      // 只有"已拒绝"或"已录用"状态才可以删除
      if (status === 'rejected' || status === 'hired') {
        // 弹出确认对话框
        wx.showModal({
          title: '确认删除',
          content: '确定要删除这条投递记录吗？',
          confirmText: '取消',
          cancelText: '确定',
          confirmColor: '#666',
          cancelColor: '#ff6b6b',
          success: (res) => {
            if (res.cancel) {
              // 用户点击确定（左侧按钮），执行删除
              this.deleteApplication(id, index)
            }
            // 点击取消（右侧按钮）什么也不做，卡片已经复位
          }
        })
      } else {
        // 状态不允许删除，提示用户
        wx.showToast({
          title: '投递信息正在处理',
          icon: 'none',
          duration: 2000
        })
      }
    } else {
      // 滑动距离不够，复位
      this.setData({
        [`applications[${index}].translateX`]: 0,
        canSwipe: false
      })
    }
  },

  // 删除投递记录
  deleteApplication(id, index) {
    console.log('开始删除投递记录, id:', id, 'index:', index)
    wx.showLoading({ title: '删除中...' })
    
    // 删除数据库记录
    db.collection('applications').doc(id).remove().then((res) => {
      console.log('数据库删除成功:', res)
      wx.hideLoading()
      wx.showToast({ title: '删除成功', icon: 'success' })
      
      // 从列表中移除
      const applications = this.data.applications.filter((item, i) => i !== index)
      this.setData({ applications })
    }).catch(err => {
      console.error('删除失败，详细错误:', err)
      wx.hideLoading()
      wx.showToast({ 
        icon: 'none', 
        title: err.errMsg || '删除失败',
        duration: 2000
      })
    })
  }
})
