// 技能认证 - 考试页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    category: '计算机与信息技术',
    questions: [],
    currentIndex: 0,
    userAnswers: {},
    answeredCount: 0, // 已答题目数
    startTime: null,
    timeSpent: 0,
    timer: null,
    isSubmitting: false,
    showResult: false,
    showNavigator: false // 是否显示答题卡
  },

  onLoad(options) {
    this.setData({
      category: options.category || '计算机与信息技术'
    })
    this.loadQuestions()
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
    }
  },

  // 加载题目
  loadQuestions() {
    wx.showLoading({ title: '加载题目中...' })
    
    db.collection('skill_questions').where({
      category: db.command.in(['JavaScript', 'Vue', 'React', 'CSS', 'HTML', '性能优化'])
    }).get().then(res => {
      if (res.data.length === 0) {
        wx.showToast({ icon: 'none', title: '题库暂未开放' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      // 随机抽取10道题
      const allQuestions = res.data
      const selectedQuestions = this.shuffleArray(allQuestions).slice(0, 10)
      
      this.setData({
        questions: selectedQuestions,
        startTime: new Date()
      })
      
      this.startTimer()
      wx.hideLoading()
    }).catch(err => {
      console.error('加载题目失败', err)
      wx.showToast({ icon: 'none', title: '加载失败' })
      wx.hideLoading()
    })
  },

  // 洗牌算法
  shuffleArray(array) {
    const newArray = [...array]
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
    }
    return newArray
  },

  // 开始计时
  startTimer() {
    this.data.timer = setInterval(() => {
      this.setData({
        timeSpent: Math.floor((new Date() - this.data.startTime) / 1000)
      })
    }, 1000)
  },

  // 切换答题卡显示
  toggleNavigator() {
    this.setData({
      showNavigator: !this.data.showNavigator
    })
  },

  // 选择答案
  selectAnswer(e) {
    const { answer } = e.currentTarget.dataset
    const { currentIndex, questions } = this.data
    const questionId = questions[currentIndex]._id
    
    // 创建新对象以触发视图更新
    const userAnswers = { ...this.data.userAnswers }
    userAnswers[questionId] = answer
    
    // 计算已答题目数
    const answeredCount = Object.keys(userAnswers).length
    
    this.setData({ 
      userAnswers: userAnswers,
      answeredCount: answeredCount
    })
    
    console.log(`第${currentIndex + 1}题已答，已答总数: ${answeredCount}/${questions.length}`)
  },

  // 上一题
  prevQuestion() {
    if (this.data.currentIndex > 0) {
      this.setData({
        currentIndex: this.data.currentIndex - 1
      })
    }
  },

  // 下一题
  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({
        currentIndex: this.data.currentIndex + 1
      })
    }
  },

  // 跳转到指定题目
  goToQuestion(e) {
    const { index } = e.currentTarget.dataset
    this.setData({ currentIndex: index })
  },

  // 提交答卷
  submitExam() {
    const answeredCount = Object.keys(this.data.userAnswers).length
    const totalCount = this.data.questions.length

    if (answeredCount < totalCount) {
      wx.showModal({
        title: '题目未答完',
        content: `还有 ${totalCount - answeredCount} 道题未作答，请继续答题`,
        showCancel: false,
        confirmText: '继续答题'
      })
      return
    }

    // 全部答完后二次确认
    wx.showModal({
      title: '确认提交',
      content: '确定要提交答卷吗？提交后将无法修改',
      success: (res) => {
        if (res.confirm) {
          this.doSubmit()
        }
      }
    })
  },

  // 执行提交
  doSubmit() {
    console.log('===== 开始提交考试 =====')
    if (this.data.isSubmitting) {
      console.log('正在提交中，请勿重复点击')
      return
    }
    
    this.setData({ isSubmitting: true })
    clearInterval(this.data.timer)

    wx.showLoading({ title: '评分中...' })

    const user = app.globalData.user
    console.log('用户信息:', user)
    
    if (!user || !user.userId) {
      console.log('用户未登录')
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '请先登录' })
      this.setData({ isSubmitting: false })
      return
    }

    const { questions, userAnswers, startTime, timeSpent } = this.data
    console.log('题目数量:', questions.length)
    console.log('用户答案:', userAnswers)
    
    // 计算得分（每题固定10分，总分100分）
    const scorePerQuestion = 10
    const totalScore = questions.length * scorePerQuestion
    let actualScore = 0
    let correctCount = 0
    const questionResults = []

    questions.forEach(q => {
      const userAnswer = userAnswers[q._id]
      const isCorrect = userAnswer === q.correctAnswer
      
      if (isCorrect) {
        actualScore += scorePerQuestion
        correctCount++
      }

      questionResults.push({
        questionId: q._id,
        question: q.question,
        category: q.category,
        userAnswer: userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: isCorrect,
        score: scorePerQuestion,
        explanation: q.explanation
      })
    })

    const accuracy = Math.round((actualScore / totalScore) * 100)
    const passed = actualScore >= 10 // 答对1题（10分）即可通过
    
    console.log('考试结果:', {
      totalScore,
      actualScore,
      accuracy,
      passed,
      correctCount
    })

    // 保存考试记录
    const examRecord = {
      userId: user.userId,
      userName: user.name || '求职者',
      category: this.data.category,
      startTime: startTime,
      endTime: new Date(),
      duration: timeSpent,
      questions: questionResults,
      totalScore: totalScore,
      actualScore: actualScore,
      accuracy: accuracy,
      correctCount: correctCount,
      totalQuestions: questions.length,
      passed: passed,
      createTime: new Date()
    }

    console.log('准备保存考试记录:', examRecord)
    
    db.collection('skill_exam_records').add({
      data: examRecord
    }).then(res => {
      console.log('考试记录保存成功:', res)
      const examId = res._id

      if (passed) {
        // 生成证书
        this.generateCertificate(examRecord, examId)
      } else {
        // 考试未通过
        wx.hideLoading()
        
        // 获取答题时长
        const minutes = Math.floor(timeSpent / 60)
        const seconds = timeSpent % 60
        const timeText = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
        
        wx.showModal({
          title: '考试未通过',
          content: `您的得分：${actualScore}/${totalScore}\n正确率：${accuracy}%\n答题时间：${timeText}\n至少需要答对1题才能获得证书，请继续努力！`,
          showCancel: true,
          confirmText: '重新考试',
          cancelText: '返回',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 重新考试
              wx.redirectTo({
                url: `/pages/candidate/skillExam/index?category=${this.data.category}`
              })
            } else {
              // 返回上一页
              wx.navigateBack()
            }
          }
        })
      }
    }).catch(err => {
      console.error('保存考试记录失败', err)
      wx.hideLoading()
      wx.showToast({ icon: 'none', title: '提交失败，请重试' })
      this.setData({ isSubmitting: false })
    })
  },

  // 生成证书
  generateCertificate(examRecord, examId) {
    const user = app.globalData.user
    const { accuracy } = examRecord
    
    // 确定等级
    let level = '初级'
    let levelColor = '#52c41a'
    if (accuracy >= 90) {
      level = '高级'
      levelColor = '#faad14'
    } else if (accuracy >= 75) {
      level = '中级'
      levelColor = '#1890ff'
    }

    // 生成证书编号
    const certNumber = `CERT-${new Date().getFullYear()}-FE-${Date.now().toString().slice(-6)}`

    // 提取技能标签
    const skills = [...new Set(examRecord.questions.map(q => q.category))]

    const certificate = {
      userId: user.userId,
      userName: user.name || '求职者',
      category: this.data.category,
      level: level,
      levelColor: levelColor,
      score: examRecord.actualScore,
      accuracy: accuracy,
      totalQuestions: examRecord.totalQuestions,
      correctAnswers: examRecord.correctCount,
      certNumber: certNumber,
      issueDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1个月有效期
      skills: skills,
      examId: examId,
      status: 'valid'
    }

    // 先查询是否已有同等级证书
    db.collection('skill_certificates').where({
      userId: user.userId,
      category: this.data.category,
      level: level,
      status: 'valid'
    }).get().then(existRes => {
      console.log('查询同等级证书:', existRes.data)
      
      if (existRes.data.length > 0) {
        // 找到得分最高的旧证书
        const maxScoreCert = existRes.data.reduce((max, cert) => 
          cert.score > max.score ? cert : max
        )
        
        console.log('现有最高分证书:', maxScoreCert.score, '新证书分数:', certificate.score)
        
        if (certificate.score > maxScoreCert.score) {
          // 新证书得分更高，使旧证书失效
          const updatePromises = existRes.data.map(cert => 
            db.collection('skill_certificates').doc(cert._id).update({
              data: { status: 'replaced' }
            })
          )
          
          Promise.all(updatePromises).then(() => {
            console.log('已将旧证书标记为已替换')
            // 添加新证书
            this.addNewCertificate(certificate, examId)
          })
        } else {
          // 新证书得分不高于现有证书，不生成新证书
          wx.hideLoading()
          wx.showModal({
            title: '提示',
            content: `您已有${level}证书，得分${maxScoreCert.score}分，本次得分${certificate.score}分未超过现有成绩，不生成新证书。`,
            showCancel: false,
            success: () => {
              wx.navigateBack()
            }
          })
        }
      } else {
        // 没有同等级证书，直接添加
        this.addNewCertificate(certificate, examId)
      }
    }).catch(err => {
      console.error('查询证书失败', err)
      // 查询失败仍然添加证书
      this.addNewCertificate(certificate, examId)
    })
  },

  // 添加新证书
  addNewCertificate(certificate, examId) {
    db.collection('skill_certificates').add({
      data: certificate
    }).then(res => {
      const certId = res._id
      
      // 更新考试记录，关联证书
      db.collection('skill_exam_records').doc(examId).update({
        data: {
          certificateId: certId
        }
      })

      wx.hideLoading()
      
      // 获取答题时长
      const duration = this.data.timeSpent
      const minutes = Math.floor(duration / 60)
      const seconds = duration % 60
      const timeText = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
      
      // 显示成功提示
      wx.showModal({
        title: '恭喜通过！',
        content: `您获得了${certificate.level}证书！\n得分：${certificate.score}分\n正确率：${certificate.accuracy}%\n答题时间：${timeText}`,
        showCancel: false,
        confirmText: '查看证书',
        success: (modalRes) => {
          if (modalRes.confirm) {
            // 跳转到证书页面
            wx.redirectTo({
              url: `/pages/candidate/skillCertificate/index?certId=${certId}`
            })
          }
        }
      })
    }).catch(err => {
      console.error('生成证书失败', err)
      wx.hideLoading()
      wx.showModal({
        title: '证书生成失败',
        content: '请稍后在简历页查看您的证书',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    })
  },

  // 格式化时间
  formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
})
