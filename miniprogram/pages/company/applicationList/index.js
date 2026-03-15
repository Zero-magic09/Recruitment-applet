// 岗位投递列表页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    jobId: '',
    jobTitle: '',
    applications: [],
    loading: false
  },

  onLoad(options) {
    if (options.jobId) {
      this.setData({ jobId: options.jobId })
      this.getApplications()
    }
  },

  onShow() {
    if (this.data.jobId) {
      this.getApplications()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.getApplications()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 获取投递列表
  getApplications() {
    this.setData({ loading: true })

    db.collection('applications').where({
      jobId: this.data.jobId
    }).orderBy('createTime', 'desc').get().then(res => {
      console.log('投递列表:', res.data)
      
      // 格式化时间
      const applications = res.data.map(item => {
        return {
          ...item,
          createTime: this.formatTime(item.createTime)
        }
      })
      
      // 获取岗位标题
      if (applications.length > 0) {
        this.setData({ 
          jobTitle: applications[0].jobTitle,
          applications: applications,
          loading: false 
        })
      } else {
        this.setData({ 
          applications: [],
          loading: false 
        })
      }
    }).catch(err => {
      console.error('获取投递列表失败:', err)
      this.setData({ loading: false })
      wx.showToast({ icon: 'none', title: '加载失败' })
    })
  },

  // 格式化时间
  formatTime(time) {
    if (!time) return ''
    
    let date
    if (typeof time === 'number') {
      // 时间戳
      date = new Date(time)
    } else if (time instanceof Date) {
      // Date 对象
      date = time
    } else if (typeof time === 'object' && time.$date) {
      // 云数据库 serverDate 格式
      date = new Date(time.$date)
    } else {
      return String(time)
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    
    return `${month}-${day} ${hour}:${minute}`
  },

  // 查看简历详情
  viewResume(e) {
    const application = e.currentTarget.dataset.application
    console.log('查看简历，投递信息:', application)
    
    wx.navigateTo({
      url: '/pages/candidate/resume/preview/index',
      success: (res) => {
        res.eventChannel.emit('resumeData', {
          resume: application.resume,
          candidateName: application.candidateName,
          candidateId: application.candidateId
        })
      }
    })
  },

  // 更新投递状态
  updateStatus(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const application = this.data.applications.find(app => app._id === id)
    
    const statusOptions = ['submitted', 'viewed', 'interviewed', 'rejected', 'accepted']
    const statusNames = ['已投递', '已查看', '面试中', '已拒绝', '已录用']
    
    wx.showActionSheet({
      itemList: statusNames,
      success: (res) => {
        const newStatus = statusOptions[res.tapIndex]
        
        db.collection('applications').doc(id).update({
          data: {
            status: newStatus,
            updateTime: db.serverDate()
          }
        }).then(() => {
          wx.showToast({ title: '更新成功' })
          this.getApplications()
        }).catch(err => {
          console.error('更新状态失败:', err)
          wx.showToast({ icon: 'none', title: '更新失败' })
        })
      }
    })
  }
})
