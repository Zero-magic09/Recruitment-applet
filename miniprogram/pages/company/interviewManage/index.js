// 企业面试管理页
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    interviews: [],
    loading: false,
    showConfirmModal: false,
    currentInterviewId: '',
    interviewDate: '',
    interviewTimeValue: '',
    interviewLocation: '',
    interviewNotes: ''
  },

  onLoad() {
    this.getInterviews()
  },

  onShow() {
    this.getInterviews()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.getInterviews()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  getInterviews() {
    const userId = app.globalData.user?.userId
    if (!userId) {
      this.setData({ loading: false })
      return
    }

    this.setData({ loading: true })

    db.collection('interviews').where({
      companyId: userId
    }).orderBy('createTime', 'desc').get().then(res => {
      console.log('面试列表查询结果:', res.data)
      this.setData({
        interviews: res.data,
        loading: false
      })
    }).catch(err => {
      console.error('加载面试列表失败:', err)
      this.setData({ loading: false })
      wx.showToast({ icon: 'none', title: '加载失败' })
    })
  },

  // 确认面试 - 打开弹窗
  confirmInterview(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      currentInterviewId: id,
      showConfirmModal: true,
      interviewDate: '',
      interviewTimeValue: '',
      interviewLocation: '',
      interviewNotes: ''
    })
  },

  // 选择日期
  onDateChange(e) {
    this.setData({ interviewDate: e.detail.value })
  },

  // 选择时间
  onTimeChange(e) {
    this.setData({ interviewTimeValue: e.detail.value })
  },

  // 输入面试地点
  onLocationInput(e) {
    this.setData({ interviewLocation: e.detail.value })
  },

  // 输入备注
  onNotesInput(e) {
    this.setData({ interviewNotes: e.detail.value })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showConfirmModal: false,
      currentInterviewId: '',
      interviewDate: '',
      interviewTimeValue: '',
      interviewLocation: '',
      interviewNotes: ''
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空方法，用于阻止点击事件冒泡
  },

  // 提交确认
  submitConfirm() {
    const { currentInterviewId, interviewDate, interviewTimeValue, interviewLocation, interviewNotes } = this.data

    // 验证
    if (!interviewDate) {
      wx.showToast({ icon: 'none', title: '请选择面试日期' })
      return
    }
    if (!interviewTimeValue) {
      wx.showToast({ icon: 'none', title: '请选择面试时间' })
      return
    }
    if (!interviewLocation) {
      wx.showToast({ icon: 'none', title: '请输入面试地点' })
      return
    }

    // 合并日期和时间
    const interviewTime = `${interviewDate} ${interviewTimeValue}`

    // 先请求订阅消息授权，然后执行确认
    this.requestSubscribeAndConfirm(currentInterviewId, interviewTime, interviewLocation, interviewNotes);
  },

  // 请求订阅消息授权并确认面试
  requestSubscribeAndConfirm(interviewId, interviewTime, location, notes) {
    console.log('准备请求订阅消息授权（面试邀请）...');
    
    // 检查是否支持订阅消息
    if (!wx.requestSubscribeMessage) {
      console.log('当前版本不支持订阅消息，直接执行确认');
      this.executeConfirm(interviewId, interviewTime, location, notes, null);
      return;
    }
    
    // 请求订阅消息授权
    wx.requestSubscribeMessage({
      tmplIds: ['3RgFK63_NUiH-qbTCbPy3THNGmJK5Jw2UHapRQTm63A'],
      success: (res) => {
        console.log('✅ 订阅消息授权成功:', res);
        // 保存授权结果，然后执行确认
        this.executeConfirm(interviewId, interviewTime, location, notes, res);
      },
      fail: (err) => {
        console.log('❌ 订阅消息授权失败:', err);
        // 即使授权失败，也继续执行确认（只是不发送消息）
        this.executeConfirm(interviewId, interviewTime, location, notes, null);
      }
    });
  },

  // 执行面试确认
  executeConfirm(interviewId, interviewTime, location, notes, subscribeResult) {
    wx.showLoading({ title: '处理中...' })

    db.collection('interviews').doc(interviewId).update({
      data: {
        status: 'confirmed',
        interviewTime: interviewTime,
        location: location,
        notes: notes || '请准时参加面试',
        updateTime: db.serverDate()
      }
    }).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '确认成功' })
      this.closeModal()
      this.getInterviews()
      
      // 获取完整的面试信息用于发送通知
      db.collection('interviews').doc(interviewId).get().then(res => {
        if (res.data) {
          // 如果用户授权了订阅消息，则发送通知
          if (subscribeResult && subscribeResult['3RgFK63_NUiH-qbTCbPy3THNGmJK5Jw2UHapRQTm63A'] === 'accept') {
            console.log('用户已授权，发送面试邀请通知');
            this.sendInterviewConfirmNotice(res.data);
          } else {
            console.log('用户未授权或拒绝授权，不发送消息');
          }
        }
      })
    }).catch(err => {
      console.error('确认面试失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '确认失败' })
    })
  },

  // 拒绝面试
  rejectInterview(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '拒绝面试',
      content: '确定要拒绝该面试吗？\n\n拒绝后将取消该面试安排，求职者将收到通知。',
      confirmText: '确定拒绝',
      confirmColor: '#ff6b6b',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 用户确认后，请求订阅消息授权
          this.requestSubscribeAndReject(id);
        }
      }
    })
  },

  // 请求订阅消息授权并拒绝面试
  requestSubscribeAndReject(interviewId) {
    console.log('准备请求订阅消息授权（拒绝面试）...');
    
    // 检查是否支持订阅消息
    if (!wx.requestSubscribeMessage) {
      console.log('当前版本不支持订阅消息，直接执行拒绝');
      this.executeReject(interviewId, null);
      return;
    }
    
    // 请求订阅消息授权
    wx.requestSubscribeMessage({
      tmplIds: ['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'],
      success: (res) => {
        console.log('✅ 订阅消息授权成功:', res);
        // 保存授权结果，然后执行拒绝
        this.executeReject(interviewId, res);
      },
      fail: (err) => {
        console.log('❌ 订阅消息授权失败:', err);
        // 即使授权失败，也继续执行拒绝（只是不发送消息）
        this.executeReject(interviewId, null);
      }
    });
  },

  // 执行拒绝面试
  executeReject(interviewId, subscribeResult) {
    wx.showLoading({ title: '处理中...' })
    
    // 先获取面试记录，获取applicationId
    db.collection('interviews').doc(interviewId).get().then(interviewRes => {
      const interview = interviewRes.data
      const applicationId = interview.applicationId
      
      // 同时更新面试记录和投递记录
      const updateInterview = db.collection('interviews').doc(interviewId).update({
        data: {
          status: 'cancelled',
          updateTime: db.serverDate()
        }
      })
      
      // 更新投递状态为已拒绝
      const updateApplication = db.collection('applications').doc(applicationId).update({
        data: {
          status: 'rejected',
          updateTime: db.serverDate()
        }
      })
      
      // 并行执行两个更新操作
      return Promise.all([updateInterview, updateApplication, Promise.resolve(interview)])
    }).then((results) => {
      const interview = results[2]
      wx.hideLoading()
      wx.showToast({ title: '已拒绝面试' })
      this.getInterviews()
      
      // 如果用户授权了订阅消息，则发送通知
      if (subscribeResult && subscribeResult['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'] === 'accept') {
        console.log('用户已授权，发送拒绝通知');
        this.sendRejectNotice(interview);
      } else {
        console.log('用户未授权或拒绝授权，不发送消息');
      }
    }).catch(err => {
      console.error('拒绝面试失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '操作失败' })
    })
  },

  // 发送拒绝通知
  sendRejectNotice(interview) {
    console.log('===== 开始发送拒绝通知 =====');
    console.log('面试信息:', interview);
    
    // 准备消息数据
    const messageData = {
      thing1: { // 面试职位
        value: (interview.jobTitle || '未知职位').substring(0, 20)
      },
      thing2: { // 公司名称
        value: (interview.companyName || '未知公司').substring(0, 20)
      },
      phrase3: { // 初筛结果
        value: '未通过'
      },
      time4: { // 时间
        value: new Date().toISOString().replace('T', ' ').substring(0, 19)
      },
      thing5: { // 备注
        value: '感谢您的关注，期待下次合作'.substring(0, 20)
      }
    };
    
    console.log('消息数据:', JSON.stringify(messageData));
    console.log('目标用户ID:', interview.candidateId);
    
    // 直接调用云函数发送订阅消息
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'sendSubscribeMessage',
        userId: interview.candidateId,
        templateId: 'EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8',
        page: 'pages/candidate/interviews/index',
        data: messageData
      },
      success: (res) => {
        console.log('✅ 云函数调用成功:', res)
        console.log('云函数返回结果:', JSON.stringify(res.result))
        
        if (res.result && res.result.success) {
          console.log('✅ 拒绝通知发送成功')
          wx.showToast({ title: '拒绝通知已发送', icon: 'success' })
        } else {
          console.error('❌ 拒绝通知发送失败:', res.result ? res.result.errMsg : '未知错误')
        }
      },
      fail: (err) => {
        console.error('❌ 云函数调用失败:', err)
        console.error('错误详情:', JSON.stringify(err))
      }
    })
  },

  // 发送面试确认通知给求职者
  sendInterviewConfirmNotice(interview) {
    console.log('===== 开始发送面试邀请通知 =====');
    console.log('面试信息:', interview);
    
    // 准备消息数据
    const messageData = {
      thing2: { // 岗位名称
        value: (interview.jobTitle || '未知职位').substring(0, 20)
      },
      date3: { // 面试时间
        value: interview.interviewTime || new Date().toISOString().replace('T', ' ').substring(0, 19)
      },
      thing4: { // 面试地址
        value: (interview.location || '请联系企业确认').substring(0, 20)
      },
      thing5: { // 备注
        value: (interview.notes || '请准时参加，祝您面试顺利').substring(0, 20)
      },
      thing6: { // 公司名称
        value: (interview.companyName || '未知公司').substring(0, 20)
      }
    };
    
    console.log('消息数据:', JSON.stringify(messageData));
    console.log('目标用户ID:', interview.candidateId);
    
    // 直接调用云函数发送订阅消息
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'sendSubscribeMessage',
        userId: interview.candidateId,
        templateId: '3RgFK63_NUiH-qbTCbPy3THNGmJK5Jw2UHapRQTm63A',
        page: 'pages/candidate/interviews/index',
        data: messageData
      },
      success: (res) => {
        console.log('✅ 云函数调用成功:', res)
        console.log('云函数返回结果:', JSON.stringify(res.result))
        
        if (res.result && res.result.success) {
          console.log('✅ 面试邀请通知发送成功')
          wx.showToast({ title: '面试通知已发送', icon: 'success' })
        } else {
          console.error('❌ 面试邀请通知发送失败:', res.result ? res.result.errMsg : '未知错误')
        }
      },
      fail: (err) => {
        console.error('❌ 云函数调用失败:', err)
        console.error('错误详情:', JSON.stringify(err))
      }
    })
  },

  updateResult(e) {
    const id = e.currentTarget.dataset.id
    const result = e.currentTarget.dataset.result

    console.log('用户点击评价按钮');
    
    // 先弹窗确认，然后再请求订阅消息授权
    wx.showModal({
      title: '确认操作',
      content: result === 'hired' ? '确定标记为已录用吗？' : '确认标记为拒绝录用吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (modalRes) => {
        if (modalRes.confirm) {
          // 用户确认后，请求订阅消息授权
          this.requestSubscribeAndUpdate(id, result);
        }
      }
    });
  },

  // 请求订阅消息授权并执行更新
  requestSubscribeAndUpdate(id, result) {
    console.log('准备请求订阅消息授权...');
    
    // 检查是否支持订阅消息
    if (!wx.requestSubscribeMessage) {
      console.log('当前版本不支持订阅消息，直接执行更新');
      this.executeUpdate(id, result, null);
      return;
    }
    
    // 请求订阅消息授权
    wx.requestSubscribeMessage({
      tmplIds: ['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'],
      success: (res) => {
        console.log('✅ 订阅消息授权成功:', res);
        // 保存授权结果，然后执行更新
        this.executeUpdate(id, result, res);
      },
      fail: (err) => {
        console.log('❌ 订阅消息授权失败:', err);
        // 即使授权失败，也继续执行更新（只是不发送消息）
        this.executeUpdate(id, result, null);
      }
    });
  },

  // 执行面试结果更新
  executeUpdate(id, result, subscribeResult) {
    wx.showLoading({ title: '处理中...' })
    
    // 先获取面试记录，获取applicationId
    db.collection('interviews').doc(id).get().then(interviewRes => {
      const interview = interviewRes.data
      const applicationId = interview.applicationId
      
      // 同时更新面试记录和投递记录
      const updateInterview = db.collection('interviews').doc(id).update({
        data: {
          result: result,
          status: 'completed',
          updateTime: db.serverDate()
        }
      })
      
      // 根据面试结果更新投递状态
      const newStatus = result === 'hired' ? 'hired' : 'rejected'
      const updateApplication = db.collection('applications').doc(applicationId).update({
        data: {
          status: newStatus,
          updateTime: db.serverDate()
        }
      })
      
      // 并行执行两个更新操作
      return Promise.all([updateInterview, updateApplication, Promise.resolve(interview)])
    }).then((results) => {
      const interview = results[2]
      wx.hideLoading()
      wx.showToast({ title: '更新成功' })
      this.getInterviews()
      
      // 如果用户授权了订阅消息，则发送通知
      if (subscribeResult && subscribeResult['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'] === 'accept') {
        console.log('用户已授权，发送订阅消息');
        this.sendResultNoticeWithoutAuth(interview, result);
      } else {
        console.log('用户未授权或拒绝授权，不发送消息');
      }
    }).catch(err => {
      console.error('更新失败:', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '更新失败' })
    })
  },

  // 发送结果通知（不再请求授权，直接发送）
  sendResultNoticeWithoutAuth(interview, result) {
    console.log('===== 开始发送订阅消息（已授权） =====');
    console.log('面试信息:', interview);
    console.log('评价结果:', result);
    
    // 准备消息数据
    const messageData = {
      thing1: { // 面试职位
        value: (interview.jobTitle || '未知职位').substring(0, 20)
      },
      thing2: { // 公司名称
        value: (interview.companyName || '未知公司').substring(0, 20)
      },
      phrase3: { // 初筛结果
        value: result === 'hired' ? '已通过' : '未通过'
      },
      time4: { // 时间
        value: interview.interviewTime || new Date().toISOString().replace('T', ' ').substring(0, 19)
      },
      thing5: { // 备注
        value: (result === 'hired' ? '恭喜您，请留意后续通知' : '感谢您的参与').substring(0, 20)
      }
    };
    
    console.log('消息数据:', JSON.stringify(messageData));
    console.log('目标用户ID:', interview.candidateId);
    
    // 直接调用云函数发送订阅消息
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'sendSubscribeMessage',
        userId: interview.candidateId,
        templateId: 'EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8',
        page: 'pages/candidate/interviews/index',
        data: messageData
      },
      success: (res) => {
        console.log('✅ 云函数调用成功:', res)
        console.log('云函数返回结果:', JSON.stringify(res.result))
        
        if (res.result && res.result.success) {
          console.log('✅ 订阅消息发送成功')
          wx.showToast({ title: '消息通知已发送', icon: 'success' })
        } else {
          console.error('❌ 订阅消息发送失败:', res.result ? res.result.errMsg : '未知错误')
        }
      },
      fail: (err) => {
        console.error('❌ 云函数调用失败:', err)
        console.error('错误详情:', JSON.stringify(err))
      }
    })
  },


  sendResultNotice(interview, result) {
    console.log('===== 开始发送订阅消息 =====');
    console.log('面试信息:', interview);
    console.log('评价结果:', result);
    
    // 准备消息数据
    const messageData = {
      thing1: { // 面试职位
        value: (interview.jobTitle || '未知职位').substring(0, 20)
      },
      thing2: { // 公司名称
        value: (interview.companyName || '未知公司').substring(0, 20)
      },
      phrase3: { // 初筛结果
        value: result === 'hired' ? '已通过' : '未通过'
      },
      time4: { // 时间
        value: interview.interviewTime || new Date().toISOString().replace('T', ' ').substring(0, 19)
      },
      thing5: { // 备注
        value: (result === 'hired' ? '恭喜您，请留意后续通知' : '感谢您的参与').substring(0, 20)
      }
    };
    
    console.log('消息数据:', JSON.stringify(messageData));
    
    // 检查 wx.requestSubscribeMessage 是否存在
    if (!wx.requestSubscribeMessage) {
      console.error('❌ 当前基础库不支持 requestSubscribeMessage');
      wx.showModal({
        title: '版本过低',
        content: '当前微信版本过低，不支持订阅消息功能，请升级后重试',
        showCancel: false
      });
      return;
    }
    
    // 请求订阅消息授权
    console.log('准备请求订阅消息授权...');
    console.log('模板ID:', 'EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8');
    
    wx.requestSubscribeMessage({
      tmplIds: ['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'],
      success: (res) => {
        console.log('✅ 订阅消息授权成功:', res)
        console.log('授权结果详情:', JSON.stringify(res))
        
        // 检查用户是否同意授权
        if (res['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'] === 'accept') {
          console.log('用户同意授权，开始发送消息');
        } else if (res['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'] === 'reject') {
          console.log('用户拒绝授权，不发送消息');
          wx.showToast({ title: '您拒绝了消息通知', icon: 'none' });
          return;
        } else if (res['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8'] === 'ban') {
          console.log('模板被封禁或删除');
          wx.showToast({ title: '订阅消息模板异常', icon: 'none' });
          return;
        } else {
          console.log('未知授权状态:', res['EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8']);
          return;
        }
        
        // 调用云函数发送订阅消息
        console.log('开始调用云函数发送消息...');
        console.log('目标用户ID:', interview.candidateId);
        
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'sendSubscribeMessage',
            userId: interview.candidateId,
            templateId: 'EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8',
            page: 'pages/candidate/interviews/index',
            data: messageData
          },
          success: (res) => {
            console.log('✅ 云函数调用成功:', res)
            console.log('云函数返回结果:', JSON.stringify(res.result))
            
            if (res.result && res.result.success) {
              console.log('✅ 订阅消息发送成功')
              wx.showToast({ title: '消息通知已发送', icon: 'success' })
            } else {
              console.error('❌ 订阅消息发送失败:', res.result ? res.result.errMsg : '未知错误')
              wx.showToast({ 
                title: '消息发送失败: ' + (res.result ? res.result.errMsg : '未知错误'), 
                icon: 'none',
                duration: 3000
              })
            }
          },
          fail: (err) => {
            console.error('❌ 云函数调用失败:', err)
            console.error('错误详情:', JSON.stringify(err))
            wx.showToast({ 
              title: '云函数调用失败: ' + (err.errMsg || '未知错误'), 
              icon: 'none',
              duration: 3000
            })
          }
        })
      },
      fail: (err) => {
        console.log('❌ 订阅消息授权调用失败:', err)
        console.log('错误码:', err.errCode)
        console.log('错误信息:', err.errMsg)
        console.log('错误详情:', JSON.stringify(err))
        
        let errorMsg = '订阅消息授权失败';
        
        // 根据错误码提供具体提示
        if (err.errMsg && err.errMsg.includes('requestSubscribeMessage:fail')) {
          if (err.errMsg.includes('no template')) {
            errorMsg = '模板不存在，请在微信公众平台添加模板';
          } else if (err.errMsg.includes('template not subscribe')) {
            errorMsg = '模板未订阅，请检查模板配置';
          } else if (err.errMsg.includes('user cancel')) {
            errorMsg = '用户取消了授权';
          } else {
            errorMsg = err.errMsg;
          }
        }
        
        wx.showModal({
          title: '订阅消息失败',
          content: errorMsg,
          showCancel: false
        });
      }
    })
  },

  // 订阅消息成功回调（使用 open-type="subscribe" 方式）
  onSubscribeSuccess(e) {
    console.log('订阅消息授权成功:', e);
    const templateId = 'EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8';
    
    wx.showModal({
      title: '授权成功',
      content: '✅ 用户同意接收订阅消息！\n\n模板ID: ' + templateId,
      showCancel: false
    });
  },

  // 订阅消息失败回调
  onSubscribeError(e) {
    console.error('订阅消息授权失败:', e);
    const errMsg = e.detail && e.detail.errMsg ? e.detail.errMsg : '未知错误';
    
    wx.showModal({
      title: '授权失败',
      content: '❌ 订阅消息授权失败\n\n错误信息: ' + errMsg + '\n\n请检查模板配置是否正确',
      showCancel: false
    });
  },

  // 原测试方法（保留作为备用）
  testSubscribeMessage() {
    console.log('===== 测试订阅消息 =====');
    
    // 检查 API 是否存在
    if (!wx.requestSubscribeMessage) {
      wx.showModal({
        title: '不支持',
        content: '当前微信版本不支持订阅消息功能',
        showCancel: false
      });
      return;
    }
    
    const templateId = 'EfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8';
    console.log('测试模板ID:', templateId);
    console.log('当前AppID:', 'wx9e3d106a68118f81');
    
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: (res) => {
        console.log('✅ 订阅消息授权成功:', res);
        console.log('授权结果:', JSON.stringify(res));
        
        let message = '';
        const status = res[templateId];
        
        if (status === 'accept') {
          message = '✅ 授权成功！用户同意接收消息';
        } else if (status === 'reject') {
          message = '❌ 用户拒绝授权';
        } else if (status === 'ban') {
          message = '⚠️ 模板被封禁或删除';
        } else {
          message = '❓ 未知状态: ' + status;
        }
        
        wx.showModal({
          title: '测试结果',
          content: message + '\n\n模板ID: ' + templateId + '\n授权状态: ' + status,
          showCancel: false
        });
      },
      fail: (err) => {
        console.error('❌ 订阅消息授权失败:', err);
        console.error('错误码:', err.errCode);
        console.error('错误信息:', err.errMsg);
        console.error('错误详情:', JSON.stringify(err));
        
        let errorMsg = err.errMsg || '未知错误';
        let errorCode = err.errCode || '无错误码';
        let suggestion = '';
        
        // 更详细的错误分析
        if (errorMsg.includes('no template') || errorMsg.includes('can not find template')) {
          suggestion = '\n\n原因：模板不存在\n\n解决方案：\n1. 登录 mp.weixin.qq.com\n2. 功能 → 订阅消息 → 我的模板\n3. 检查模板 ID 是否为：\nEfFLZBkHEW6XYmsCPZxOHfMAmMn1aTrM1vk7GCibLk8\n4. 如果不存在，请重新添加模板';
        } else if (errorMsg.includes('user cancel')) {
          suggestion = '\n\n原因：用户点击了取消按钮';
        } else if (errorMsg.includes('template not subscribe')) {
          suggestion = '\n\n原因：模板未订阅\n\n解决方案：\n1. 确认模板在“我的模板”中\n2. 检查模板是否已启用\n3. 确认 AppID 匹配';
        } else if (errorMsg.includes('fail can')) {
          suggestion = '\n\n原因：模板配置错误或AppID不匹配\n\n解决方案：\n1. 确认当前小程序 AppID: wx9e3d106a68118f81\n2. 登录微信公众平台检查订阅消息\n3. 确认模板在此 AppID 下\n4. 模板状态必须为“正常”';
        } else {
          suggestion = '\n\n请将此错误信息截图发给开发者';
        }
        
        wx.showModal({
          title: '授权失败',
          content: '错误码: ' + errorCode + '\n错误信息: ' + errorMsg + suggestion,
          showCancel: false,
          confirmText: '我知道了'
        });
      }
    });
  }
})
