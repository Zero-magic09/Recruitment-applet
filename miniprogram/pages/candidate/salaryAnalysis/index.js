// 薪资分析页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: null,
    activeTab: 'industry', // industry | city | experience
    
    // 筛选条件
    selectedIndustry: '',
    selectedCity: '',
    selectedExperience: '不限',
    
    // 行业列表
    industries: ['互联网', '金融', '教育', '医疗', '制造业', '服务业'],
    cities: ['北京', '上海', '深圳', '杭州', '广州', '成都', '济南'],
    experiences: ['不限', '应届生', '1年以下', '1-3年', '2-3年', '3-5年', '5-10年', '10年以上'],
    
    // 分析数据
    salaryDistribution: {
      p25: 0,
      p50: 0,
      p75: 0,
      avg: 0,
      min: 0,
      max: 0
    },
    
    // 对比数据
    comparison: {
      citySalary: 0,
      industrySalary: 0,
      experienceSalary: 0
    },
    
    // 图表数据
    chartData: [],
    
    loading: false
  },

  onLoad(options) {
    // 从岗位详情页携带的参数
    if (options.industry) {
      this.setData({ 
        selectedIndustry: decodeURIComponent(options.industry),
        activeTab: 'industry'
      })
    } else if (options.city) {
      this.setData({ 
        selectedCity: decodeURIComponent(options.city),
        activeTab: 'city'
      })
    } else if (options.experience) {
      this.setData({ 
        selectedExperience: decodeURIComponent(options.experience),
        activeTab: 'experience'
      })
    } else {
      // 默认加载互联网行业数据
      this.setData({ selectedIndustry: '互联网' })
    }
    
    this.loadIndustriesFromJobs()
    this.getUserInfo()
    this.loadSalaryData()
  },

  // 从岗位数据中获取所有存在的行业
  loadIndustriesFromJobs() {
    db.collection('jobs').where({
      status: 'active'
    }).field({
      industry: true
    }).get().then(res => {
      const jobs = res.data
      // 提取所有行业并去重
      const industriesSet = new Set()
      
      // 先添加固定的行业列表
      const fixedIndustries = ['互联网', '金融', '教育', '医疗', '制造业', '服务业']
      fixedIndustries.forEach(industry => industriesSet.add(industry))
      
      // 再添加数据库中的行业
      jobs.forEach(job => {
        if (job.industry) {
          industriesSet.add(job.industry)
        }
      })
      
      // 转换为数组并排序(固定列表优先)
      const dbIndustries = Array.from(industriesSet).filter(ind => !fixedIndustries.includes(ind)).sort()
      const industries = [...fixedIndustries, ...dbIndustries]
      
      // 更新行业列表
      if (industries.length > 0) {
        this.setData({ industries })
      }
    }).catch(err => {
      console.error('加载行业列表失败:', err)
    })
  },

  // 获取用户信息
  getUserInfo() {
    const user = app.globalData.user
    if (!user) return
    
    db.collection('users').where({
      phone: user.phone,
      role: 'candidate'
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.setData({ userInfo: res.data[0] })
        
        // 如果用户有简历，自动设置筛选条件
        const resume = res.data[0].resume
        if (resume) {
          this.setData({
            selectedCity: resume.expectedCity || '',
            selectedExperience: this.mapExperience(resume.workExperiences?.length || 0)
          })
        }
      }
    })
  },

  // 将工作年限映射到经验区间
  mapExperience(years) {
    if (years < 1) return '1年以内'
    if (years <= 3) return '1-3年'
    if (years <= 5) return '3-5年'
    if (years <= 10) return '5-10年'
    return '10年以上'
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadSalaryData()
  },

  // 选择行业
  onIndustryChange(e) {
    this.setData({ 
      selectedIndustry: this.data.industries[e.detail.value]
    })
    this.loadSalaryData()
  },

  // 选择城市
  onCityChange(e) {
    this.setData({ 
      selectedCity: this.data.cities[e.detail.value]
    })
    this.loadSalaryData()
  },

  // 选择经验
  onExperienceChange(e) {
    this.setData({ 
      selectedExperience: this.data.experiences[e.detail.value]
    })
    this.loadSalaryData()
  },

  // 加载薪资数据
  loadSalaryData() {
    this.setData({ loading: true })
    
    const { activeTab, selectedIndustry, selectedCity, selectedExperience } = this.data
    
    // 构建查询条件
    const query = { status: 'active' }
    
    if (activeTab === 'industry' && selectedIndustry) {
      query.industry = selectedIndustry
    } else if (activeTab === 'city' && selectedCity) {
      query.city = db.RegExp({
        regexp: selectedCity,
        options: 'i'
      })
    } else if (activeTab === 'experience' && selectedExperience && selectedExperience !== '不限') {
      // "不限"时不添加经验筛选条件，查询所有岗位
      query.experience = selectedExperience
    }
    
    // 查询岗位数据
    db.collection('jobs').where(query).get().then(res => {
      const jobs = res.data
      
      if (jobs.length === 0) {
        // 没有数据时，清空所有显示内容
        this.setData({
          salaryDistribution: {
            p25: 0,
            p50: 0,
            p75: 0,
            avg: 0,
            min: 0,
            max: 0
          },
          comparison: {
            citySalary: 0,
            industrySalary: 0,
            experienceSalary: 0
          },
          chartData: [],
          loading: false
        })
        wx.showToast({ icon: 'none', title: '暂无数据' })
        return
      }
      
      // 计算薪资分布
      const distribution = this.calculateDistribution(jobs)
      
      // 计算对比数据
      this.calculateComparison(jobs)
      
      // 生成图表数据
      const chartData = this.generateChartData(jobs)
      
      this.setData({
        salaryDistribution: distribution,
        chartData,
        loading: false
      })
    }).catch(err => {
      console.error('加载薪资数据失败:', err)
      // 错误时也要清空数据
      this.setData({
        salaryDistribution: {
          p25: 0,
          p50: 0,
          p75: 0,
          avg: 0,
          min: 0,
          max: 0
        },
        comparison: {
          citySalary: 0,
          industrySalary: 0,
          experienceSalary: 0
        },
        chartData: [],
        loading: false
      })
      wx.showToast({ icon: 'none', title: '加载失败' })
    })
  },

  // 计算薪资分位数（P25/P50/P75）
  calculateDistribution(jobs) {
    // 提取所有薪资范围的平均值
    const salaries = jobs.map(job => (job.salaryMin + job.salaryMax) / 2).sort((a, b) => a - b)
    
    if (salaries.length === 0) {
      return { p25: 0, p50: 0, p75: 0, avg: 0, min: 0, max: 0 }
    }
    
    const n = salaries.length
    
    // 计算分位数
    const p25 = this.percentile(salaries, 0.25)
    const p50 = this.percentile(salaries, 0.50) // 中位数
    const p75 = this.percentile(salaries, 0.75)
    
    // 计算平均值
    const avg = salaries.reduce((sum, val) => sum + val, 0) / n
    
    return {
      p25: Math.round(p25),
      p50: Math.round(p50),
      p75: Math.round(p75),
      avg: Math.round(avg),
      min: Math.round(salaries[0]),
      max: Math.round(salaries[n - 1])
    }
  },

  // 计算百分位数
  percentile(arr, p) {
    const index = (arr.length - 1) * p
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower
    
    if (upper >= arr.length) return arr[lower]
    return arr[lower] * (1 - weight) + arr[upper] * weight
  },

  // 计算对比数据（同城/同行业均值）
  calculateComparison(currentJobs) {
    const { selectedCity, selectedIndustry } = this.data
    
    // 查询同城薪资
    if (selectedCity) {
      db.collection('jobs').where({
        status: 'active',
        city: db.RegExp({ regexp: selectedCity, options: 'i' })
      }).get().then(res => {
        const citySalary = this.calculateAverage(res.data)
        this.setData({ 'comparison.citySalary': citySalary })
      })
    }
    
    // 查询同行业薪资
    if (selectedIndustry) {
      db.collection('jobs').where({
        status: 'active',
        industry: selectedIndustry
      }).get().then(res => {
        const industrySalary = this.calculateAverage(res.data)
        this.setData({ 'comparison.industrySalary': industrySalary })
      })
    }
  },

  // 计算平均薪资
  calculateAverage(jobs) {
    if (jobs.length === 0) return 0
    const salaries = jobs.map(job => (job.salaryMin + job.salaryMax) / 2)
    const avg = salaries.reduce((sum, val) => sum + val, 0) / salaries.length
    return Math.round(avg)
  },

  // 生成图表数据（用于可视化）
  generateChartData(jobs) {
    const { activeTab } = this.data
    
    if (activeTab === 'industry') {
      return this.groupByIndustry(jobs)
    } else if (activeTab === 'city') {
      return this.groupByCity(jobs)
    } else if (activeTab === 'experience') {
      return this.groupByExperience(jobs)
    }
    
    return []
  },

  // 按行业分组
  groupByIndustry(jobs) {
    const groups = {}
    jobs.forEach(job => {
      const industry = job.industry || '其他'
      if (!groups[industry]) {
        groups[industry] = []
      }
      groups[industry].push((job.salaryMin + job.salaryMax) / 2)
    })
    
    return Object.keys(groups).map(industry => ({
      label: industry,
      value: Math.round(groups[industry].reduce((sum, val) => sum + val, 0) / groups[industry].length),
      count: groups[industry].length
    }))
  },

  // 按城市分组
  groupByCity(jobs) {
    const groups = {}
    jobs.forEach(job => {
      const city = job.city || '其他'
      if (!groups[city]) {
        groups[city] = []
      }
      groups[city].push((job.salaryMin + job.salaryMax) / 2)
    })
    
    return Object.keys(groups).map(city => ({
      label: city,
      value: Math.round(groups[city].reduce((sum, val) => sum + val, 0) / groups[city].length),
      count: groups[city].length
    }))
  },

  // 按经验分组
  groupByExperience(jobs) {
    const groups = {}
    jobs.forEach(job => {
      const exp = job.experience || '其他'
      if (!groups[exp]) {
        groups[exp] = []
      }
      groups[exp].push((job.salaryMin + job.salaryMax) / 2)
    })
    
    return Object.keys(groups).map(exp => ({
      label: exp,
      value: Math.round(groups[exp].reduce((sum, val) => sum + val, 0) / groups[exp].length),
      count: groups[exp].length
    }))
  }
})
