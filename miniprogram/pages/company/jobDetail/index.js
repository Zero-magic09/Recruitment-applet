// 企业端岗位详情页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    jobId: '',
    job: null,
    company: null,
    showVideoModal: false,
    currentVideoUrl: '',
    markers: [],
    latitude: 0,
    longitude: 0,
  },

  onLoad(options) {
    console.log('企业端岗位详情页加载, jobId:', options.id)
    this.setData({ jobId: options.id })
    this.getJobDetail()
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
        company: {
          companyName: job.companyName,
          _id: job.companyId,
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

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.job.title} - ${this.data.job.companyName}`,
      path: `/pages/company/jobDetail/index?id=${this.data.jobId}`
    }
  }
})
