// 企业岗位管理页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    jobs: [],
    loading: false
  },

  onLoad() {
    this.getJobs()
  },

  onShow() {
    this.getJobs()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.getJobs()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  getJobs() {
    const userId = app.globalData.user?.userId
    if (!userId) return

    this.setData({ loading: true })

    db.collection('jobs').where({
      companyId: userId
    }).orderBy('createTime', 'desc').get().then(res => {
      this.setData({
        jobs: res.data,
        loading: false
      })
    }).catch(err => {
      this.setData({ loading: false })
      wx.showToast({ icon: 'none', title: '加载失败' })
    })
  },

  goToEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/company/jobPublish/index?id=${id}`
    })
  },

  toggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const newStatus = status === 'active' ? 'inactive' : 'active'

    db.collection('jobs').doc(id).update({
      data: {
        status: newStatus,
        updateTime: db.serverDate()
      }
    }).then(() => {
      wx.showToast({ title: '更新成功' })
      this.getJobs()
    }).catch(err => {
      wx.showToast({ icon: 'none', title: '更新失败' })
    })
  },

  deleteJob(e) {
    const id = e.currentTarget.dataset.id
    const title = e.currentTarget.dataset.title

    wx.showModal({
      title: '确认删除',
      content: `确定要删除岗位「${title}」吗？\n\n删除后将同时删除该岗位的所有投递记录，此操作不可恢复！`,
      confirmText: '确定删除',
      cancelText: '取消',
      confirmColor: '#ff6b6b',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' })
          
          // 先删除该岗位的所有投递记录
          db.collection('applications').where({
            jobId: id
          }).remove().then(() => {
            // 再删除岗位
            return db.collection('jobs').doc(id).remove()
          }).then(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除成功' })
            this.getJobs()
          }).catch(err => {
            console.error('删除失败:', err)
            wx.hideLoading()
            wx.showToast({ icon: 'none', title: '删除失败' })
          })
        }
      }
    })
  },

  viewApplications(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/company/applicationList/index?jobId=${id}`
    })
  }
})
