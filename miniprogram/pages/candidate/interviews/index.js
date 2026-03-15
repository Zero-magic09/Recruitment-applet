// 面试列表页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    interviews: [],
    loading: false,
    jobId: '', // 用于筛选特定岗位的面试
    jobTitle: '', // 岗位名称
    statusMap: {
      pending: '待确认',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消'
    },
    startX: 0,
    startY: 0,
    longPressTimer: null,
    canSwipe: false,
    deleteThreshold: -250,
    longPressDuration: 300 // 长按时间300ms
  },

  onLoad(options) {
    // 如果传入了jobId，则只显示该岗位的面试
    if (options.jobId) {
      this.setData({ jobId: options.jobId })
    }
    this.getInterviews()
  },

  onShow() {
    // 刷新时保持jobId筛选
    this.getInterviews()
  },

  getInterviews() {
    const userId = app.globalData.user?.userId
    if (!userId) {
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })
    
    // 构建查询条件
    let whereCondition = {
      candidateId: userId
    }
    
    // 如果有jobId，添加筛选条件
    if (this.data.jobId) {
      whereCondition.jobId = this.data.jobId
    }
    
    db.collection('interviews').where(whereCondition)
      .orderBy('createTime', 'desc').get().then(res => {
      this.setData({ 
        interviews: res.data,
        loading: false 
      })
    }).catch(err => {
      console.error('获取面试列表失败', err)
      this.setData({ loading: false })
    })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/candidate/interviewDetail/index?id=${id}`
    })
  },

  onPullDownRefresh() {
    this.getInterviews()
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
          [`interviews[${index}].translateX`]: translateX
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
        [`interviews[${index}].translateX`]: 0
      })
      return
    }

    const translateX = this.data.interviews[index]?.translateX || 0
    
    // 获取屏幕宽度，计算三分之一
    const systemInfo = wx.getSystemInfoSync()
    const screenWidth = systemInfo.windowWidth
    const oneThird = -(screenWidth / 3) // 左滑为负值

    console.log('滑动距离:', translateX, '阈值:', oneThird)

    // 如果左滑超过三分之一，检查状态并弹出删除确认框
    if (translateX < oneThird) {
      // 先复位卡片
      this.setData({ 
        [`interviews[${index}].translateX`]: 0,
        canSwipe: false
      })

      // 检查面试状态
      const status = this.data.interviews[index]?.status
      console.log('当前面试状态:', status)

      // 只有"已确认"、"已完成"、"已取消"状态才可以删除
      if (status === 'confirmed' || status === 'completed' || status === 'cancelled') {
        // 弹出确认对话框
        wx.showModal({
          title: '确认删除',
          content: '确定要删除这条面试记录吗？',
          confirmText: '取消',
          cancelText: '确定',
          confirmColor: '#666',
          cancelColor: '#ff6b6b',
          success: (res) => {
            if (res.cancel) {
              // 用户点击确定（左侧按钮），执行删除
              this.deleteInterview(id, index)
            }
            // 点击取消（右侧按钮）什么也不做，卡片已经复位
          }
        })
      } else {
        // 状态不允许删除，提示用户
        wx.showToast({
          title: '面试信息正在处理',
          icon: 'none',
          duration: 2000
        })
      }
    } else {
      // 滑动距离不够，复位
      this.setData({
        [`interviews[${index}].translateX`]: 0,
        canSwipe: false
      })
    }
  },

  // 删除面试记录
  deleteInterview(id, index) {
    console.log('开始删除面试记录, id:', id, 'index:', index)
    wx.showLoading({ title: '删除中...' })
    
    // 删除数据库记录
    db.collection('interviews').doc(id).remove().then((res) => {
      console.log('数据库删除成功:', res)
      wx.hideLoading()
      wx.showToast({ title: '删除成功', icon: 'success' })
      
      // 从列表中移除
      const interviews = this.data.interviews.filter((item, i) => i !== index)
      this.setData({ interviews })
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
