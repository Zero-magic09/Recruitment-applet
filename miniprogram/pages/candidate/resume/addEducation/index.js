// 添加/编辑教育经历
Page({
  data: {
    school: '',
    major: '',
    degreeArray: ['高中及以下', '大专', '本科', '硕士', '博士'],
    degreeIndex: 2,
    startDate: '',
    endDate: '',
    isEdit: false,
    editIndex: -1
  },

  onLoad(options) {
    // 如果是编辑模式，加载原有数据
    if (options.edit && options.data) {
      try {
        const data = JSON.parse(decodeURIComponent(options.data))
        const degreeIndex = this.data.degreeArray.indexOf(data.degree) !== -1 
          ? this.data.degreeArray.indexOf(data.degree) 
          : 2
        
        this.setData({
          school: data.school || '',
          major: data.major || '',
          degreeIndex: degreeIndex,
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          isEdit: true,
          editIndex: data.index
        })
        wx.setNavigationBarTitle({ title: '编辑教育经历' })
      } catch (e) {
        console.error('解析编辑数据失败:', e)
      }
    }
  },

  onSchoolInput(e) {
    this.setData({ school: e.detail.value })
  },

  onMajorInput(e) {
    this.setData({ major: e.detail.value })
  },

  onDegreeChange(e) {
    this.setData({ degreeIndex: e.detail.value })
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
  },

  cancel() {
    wx.navigateBack()
  },

  confirm() {
    const { school, major, degreeArray, degreeIndex, startDate, endDate, isEdit, editIndex } = this.data

    // 验证必填项
    if (!school) {
      wx.showToast({ icon: 'none', title: '请输入学校名称' })
      return
    }
    if (!major) {
      wx.showToast({ icon: 'none', title: '请输入专业' })
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
        school,
        major,
        degree: degreeArray[degreeIndex],
        startDate,
        endDate
      }
      
      if (isEdit) {
        // 编辑模式：传递编辑后的数据
        prevPage.setData({
          editedEducationExperience: {
            ...experienceData,
            index: editIndex
          }
        })
      } else {
        // 新增模式：传递新增的数据
        prevPage.setData({
          newEducationExperience: experienceData
        })
      }
    }

    wx.showToast({ title: isEdit ? '修改成功' : '添加成功' })
    setTimeout(() => {
      wx.navigateBack()
    }, 500)
  }
})
