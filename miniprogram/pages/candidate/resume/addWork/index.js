// 添加/编辑工作经历
Page({
  data: {
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    description: '',
    isEdit: false,
    editIndex: -1
  },

  onLoad(options) {
    // 如果是编辑模式，加载原有数据
    if (options.edit && options.data) {
      try {
        const data = JSON.parse(decodeURIComponent(options.data))
        this.setData({
          company: data.company || '',
          position: data.position || '',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          description: data.description || '',
          isEdit: true,
          editIndex: data.index
        })
        wx.setNavigationBarTitle({ title: '编辑工作经历' })
      } catch (e) {
        console.error('解析编辑数据失败:', e)
      }
    }
  },

  onCompanyInput(e) {
    this.setData({ company: e.detail.value })
  },

  onPositionInput(e) {
    this.setData({ position: e.detail.value })
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value })
  },

  cancel() {
    wx.navigateBack()
  },

  confirm() {
    const { company, position, startDate, endDate, description, isEdit, editIndex } = this.data

    // 验证必填项
    if (!company) {
      wx.showToast({ icon: 'none', title: '请输入公司名称' })
      return
    }
    if (!position) {
      wx.showToast({ icon: 'none', title: '请输入职位' })
      return
    }
    if (!startDate) {
      wx.showToast({ icon: 'none', title: '请选择开始时间' })
      return
    }
    if (!endDate) {
      wx.showToast({ icon: 'none', title: '请选择结束时间' })
      return
    }

    // 获取上一页面实例
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]

    // 将数据传回上一页
    if (prevPage) {
      const experienceData = {
        company,
        position,
        startDate,
        endDate,
        description
      }
      
      if (isEdit) {
        // 编辑模式：传递编辑后的数据
        prevPage.setData({
          editedWorkExperience: {
            ...experienceData,
            index: editIndex
          }
        })
      } else {
        // 新增模式：传递新增的数据
        prevPage.setData({
          newWorkExperience: experienceData
        })
      }
    }

    wx.showToast({ title: isEdit ? '修改成功' : '添加成功' })
    setTimeout(() => {
      wx.navigateBack()
    }, 500)
  }
})
