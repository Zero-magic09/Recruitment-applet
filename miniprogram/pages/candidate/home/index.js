// 求职者首页
const app = getApp()
const db = wx.cloud.database()

// 引入腾讯地图SDK
const QQMapWX = require('../../../utils/qqmap-wx-jssdk.js')
const TENCENT_MAP_KEY = 'KM5BZ-AK4C5-QKAI6-IHS3B-UUXYF-MIBRD'

// 实例化腾讯地图SDK
const qqmapsdk = new QQMapWX({
  key: TENCENT_MAP_KEY
})

// 本地计算距离（Haversine公式）
function calculateDistanceLocal(lat1, lng1, lat2, lng2) {
  const R = 6371000 // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// 格式化距离
function formatDistance(distance) {
  if (distance < 1000) {
    return Math.round(distance) + 'm'
  } else if (distance < 10000) {
    return (distance / 1000).toFixed(1) + 'km'
  } else {
    return Math.round(distance / 1000) + 'km'
  }
}

// 从地址中提取城市+区县信息
function extractCityDistrict(address) {
  if (!address) return ''

  // 匹配模式：城市名 + 区县名（只匹配第一个区/县）
  // 例如："济南市章丘区明水街道" -> "济南市章丘区"
  //      "济南市章丘区经济开发区" -> "济南市章丘区"（不是"济南市章丘区经济开发区"）
  //      "上海市浦东新区世纪大道" -> "上海市浦东新区"
  //      "深圳市南山区科技园" -> "深圳市南山区"
  // 使用非贪婪匹配 +? 确保只匹配到第一个区/县
  const match = address.match(/([\u4e00-\u9fa5]+市)([\u4e00-\u9fa5]+?(?:区|县))/)
  if (match) {
    return match[1] + match[2]
  }

  // 如果没匹配到，返回城市名
  const cityMatch = address.match(/([\u4e00-\u9fa5]+市)/)
  if (cityMatch) {
    return cityMatch[1]
  }

  return ''
}

Page({
  data: {
    userInfo: null,
    hasResume: false,
    location: null,
    locationDenied: false, // 位置权限被拒绝标记
    nearbyJobs: [],
    recommendJobs: [],
    matchJobs: [],
    filteredJobs: [], // 过滤后的岗位列表（显示给用户）
    activeTab: 'recommend', // nearby | recommend | match
    loading: false,
    searchKeyword: '',
    isSearchMode: false,
  },

  onLoad() {
    this.getUserInfo()
    this.getRecommendJobs() // 首先加载热门推荐
    // 不在页面加载时获取位置，等待用户切换到附近岗位时再获取
  },

  onShow() {
    this.getUserInfo()
  },

  // 获取用户信息
  getUserInfo() {
    const user = app.globalData.user
    console.log('求职者首页加载用户信息')
    console.log('app.globalData.user:', user)

    if (!user || !user.phone) {
      console.log('没有用户信息，请重新登录')
      wx.showModal({
        title: '提示',
        content: '请先登录',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({ url: '/pages/auth/login/index?role=candidate' })
          }
        }
      })
      return
    }

    // 使用 phone 和 role 查询用户
    db.collection('users').where({
      phone: user.phone,
      role: 'candidate'
    }).get().then(res => {
      console.log('数据库查询结果:', res)

      if (res.data && res.data.length > 0) {
        const userInfo = res.data[0]
        console.log('用户信息:', userInfo)

        // 更新 globalData 中的 userId
        app.globalData.user.userId = userInfo._id

        // 查询用户的技能证书
        db.collection('skill_certificates').where({
          userId: userInfo._id,
          status: 'valid'
        }).orderBy('issueDate', 'desc').get().then(certRes => {
          // 确定用户最高等级证书
          let certLevel = null
          if (certRes.data.length > 0) {
            // 优先级：高级 > 中级 > 初级
            const seniorCert = certRes.data.find(cert => cert.level === '高级')
            const intermediateCert = certRes.data.find(cert => cert.level === '中级')
            const juniorCert = certRes.data.find(cert => cert.level === '初级')

            if (seniorCert) {
              certLevel = 'senior'
            } else if (intermediateCert) {
              certLevel = 'intermediate'
            } else if (juniorCert) {
              certLevel = 'junior'
            }
          }

          // 将证书等级添加到userInfo中
          const userInfoWithCert = {
            ...userInfo,
            certLevel: certLevel
          }

          this.setData({
            userInfo: userInfoWithCert,
            hasResume: !!userInfo.resume
          })
          if (userInfo.resume) {
            this.getMatchJobs()
          }
        }).catch(err => {
          console.error('查询证书失败:', err)
          // 即使查询证书失败，也设置用户信息
          this.setData({
            userInfo,
            hasResume: !!userInfo.resume
          })
          if (userInfo.resume) {
            this.getMatchJobs()
          }
        })
      } else {
        console.log('未找到用户数据')
        wx.showModal({
          title: '错误',
          content: '用户信息不存在，请重新登录',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({ url: '/pages/auth/login/index?role=candidate' })
            }
          }
        })
      }
    }).catch(err => {
      console.error('加载用户信息失败:', err)
      wx.showToast({ icon: 'none', title: '加载失败，请重试' })
    })
  },

  // 获取地理位置
  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('✅ 获取位置成功:', res)
        console.log('📍 经纬度:', res.latitude, res.longitude)

        // 使用腾讯地图SDK逆地址解析，获取城市信息
        console.log('🌐 调用SDK逆地址解析')

        qqmapsdk.reverseGeocoder({
          location: {
            latitude: res.latitude,
            longitude: res.longitude
          },
          success: (geoRes) => {
            console.log('🌍 SDK逆地址解析成功:', geoRes)

            // SDK返回的数据结构
            if (geoRes.status === 0 && geoRes.result) {
              const addressComponent = geoRes.result.address_component
              const userCity = addressComponent.city || addressComponent.province

              console.log('✅ 解析成功!')
              console.log('📍 省份:', addressComponent.province)
              console.log('📍 城市:', addressComponent.city)
              console.log('📍 区县:', addressComponent.district)
              console.log('📍 最终使用的城市:', userCity)

              this.setData({
                location: {
                  latitude: res.latitude,
                  longitude: res.longitude,
                  city: userCity,
                  province: addressComponent.province,
                  district: addressComponent.district
                },
                locationDenied: false
              })
              // 不自动调用 getNearbyJobs，等待用户切换到附近岗位标签
            } else {
              console.error('❌ SDK逆地址解析失败!')
              console.error('  - status:', geoRes.status)
              console.error('  - message:', geoRes.message)
              console.error('  - 完整响应:', geoRes)

              // 失败时仅保存经纬度
              this.setData({
                location: {
                  latitude: res.latitude,
                  longitude: res.longitude
                },
                locationDenied: false
              })
              // 不自动调用 getNearbyJobs
            }
          },
          fail: (err) => {
            console.error('❌ SDK逆地址解析请求失败:', err)
            // 失败时仅保存经纬度
            this.setData({
              location: {
                latitude: res.latitude,
                longitude: res.longitude
              },
              locationDenied: false
            })
            this.getNearbyJobs()
          }
        })
      },
      fail: () => {
        // 标记位置权限被拒绝
        console.log('❌ 获取位置失败')
        this.setData({
          locationDenied: true
        })
        // 不自动加载推荐岗位，由用户自己切换标签
      }
    })
  },

  // 获取附近岗位
  getNearbyJobs() {
    if (!this.data.location) {
      this.getRecommendJobs()
      return
    }

    console.log('\n========== 📍 检查用户位置信息 ==========')
    console.log('📍 完整location对象:', JSON.stringify(this.data.location, null, 2))
    console.log('🎯 用户城市:', this.data.location.city)
    console.log('🎯 用户省份:', this.data.location.province)
    console.log('========================================\n')

    this.setData({ loading: true })

    // db.collection('jobs').where({
    //   status: 'active'
    // }).get().then(res => {
    // 改为获取所有岗位
    this.getAllActiveJobs().then(allJobs => {
      // 过滤出有位置信息的岗位
      let jobs = allJobs.filter(job => job.location?.latitude && job.location?.longitude)

      console.log('📋 数据库查询结果:', jobs.length, '个岗位')

      // 如果用户位置包含城市信息，则筛选同城岗位
      if (this.data.location.city) {
        const userCity = this.data.location.city
        const userProvince = this.data.location.province || ''
        console.log(`\n🎯 开始筛选: 只显示 ${userProvince} ${userCity} 的岗位`)
        console.log('📋 筛选前岗位总数:', jobs.length)

        const beforeFilter = jobs.length

        jobs = jobs.filter(job => {
          // 提取岗位地址中的城市信息
          const jobAddress = job.location.address || ''
          const jobCity = job.city || ''

          console.log(`\n🔍 检查岗位: ${job.title}`)
          console.log('  - 岗位地址:', jobAddress)
          console.log('  - 岗位城市:', jobCity)
          console.log('  - 用户省份:', userProvince)
          console.log('  - 用户城市:', userCity)

          // 优先匹配省份+城市，如果省份不存在则只匹配城市
          let isMatch = false

          if (userProvince) {
            // 匹配省份+城市：例如 "山东省济南市" 匹配 "山东省济南市章丘区..."
            const provinceCityPattern = userProvince + userCity
            isMatch = jobAddress.startsWith(provinceCityPattern) || jobCity.startsWith(userCity)
            console.log('  - 省份+城市匹配模式:', provinceCityPattern)
          } else {
            // 只匹配城市：例如 "济南市" 匹配 "济南市章丘区..."
            isMatch = jobAddress.startsWith(userCity) || jobCity.startsWith(userCity)
          }

          console.log('  - 是否匹配:', isMatch ? '✅ 是' : '❌ 否')

          return isMatch
        })

        console.log(`\n📊 筛选结果: ${beforeFilter} 个岗位 → ${jobs.length} 个同城岗位`)
        console.log('✅ 匹配的岗位:', jobs.map(j => j.title).join(', '))
      } else {
        console.log('\n⚠️ 警告: this.data.location.city 为空，跳过筛选，显示所有岗位')
        console.log('⚠️ 请检查逆地址解析是否成功')
      }

      if (jobs.length === 0) {
        console.log('⚠️ 没有找到同城岗位，显示空列表')
        this.setData({
          nearbyJobs: [],
          loading: false
        })
        wx.showToast({
          icon: 'none',
          title: `暂无${this.data.location.province || ''}${this.data.location.city || '附近'}的岗位`
        })
        return
      }

      // 使用腾讯地图SDK计算距离
      console.log('\n========== 📍 开始计算岗位距离 ==========')
      console.log('📍 岗位数量:', jobs.length)
      console.log('📍 用户位置:', this.data.location)
      console.log('📊 使用腾讯地图SDK计算直线距离')
      console.log('========================================\n')

      // 使用SDK计算距离
      const toLocations = jobs.map(job => `${job.location.latitude},${job.location.longitude}`).join(';')

      qqmapsdk.calculateDistance({
        mode: 'straight', // 直线距离
        from: `${this.data.location.latitude},${this.data.location.longitude}`,
        to: toLocations,
        success: (distRes) => {
          console.log('✅ SDK距离计算成功:', distRes)

          if (distRes.status === 0 && distRes.result && distRes.result.elements) {
            const jobsWithDistance = jobs.map((job, index) => {
              const element = distRes.result.elements[index]
              const distance = element.distance // 米

              console.log(`📍 ${job.title} - 距离: ${(distance / 1000).toFixed(2)}km`)

              return {
                ...job,
                displayCity: extractCityDistrict(job.location.address),
                distance: distance / 1000, // 转为公里
                distanceText: formatDistance(distance)
              }
            })

            // 按距离排序
            jobsWithDistance.sort((a, b) => a.distance - b.distance)

            console.log('\n========== 🎉 距离计算完成 ==========')
            console.log('📊 岗位数量:', jobsWithDistance.length)
            console.log('🏆 最近的20个岗位:', jobsWithDistance.slice(0, 20).map(j => `${j.title}(${j.distanceText})`).join(', '))
            console.log('========================================\n')

            this.setData({
              nearbyJobs: jobsWithDistance.slice(0, 20),
              loading: false
            }, () => {
              // 更新过滤后的岗位列表
              this.updateFilteredJobs()
            })
          } else {
            console.error('❌ SDK距离计算失败，使用本地计算')
            this.calculateDistanceLocally(jobs)
          }
        },
        fail: (err) => {
          console.error('❌ SDK距离计算请求失败:', err)
          console.log('⚠️ 降级为本地计算')
          this.calculateDistanceLocally(jobs)
        }
      })
    }).catch(err => {
      console.error('获取附近岗位失败', err)
      this.setData({ loading: false })
    })
  },

  // 本地计算距离（降级方案）
  calculateDistanceLocally(jobs) {
    console.log('📊 使用本地Haversine公式计算距离')

    const jobsWithDistance = jobs.map(job => {
      const distance = calculateDistanceLocal(
        this.data.location.latitude,
        this.data.location.longitude,
        job.location.latitude,
        job.location.longitude
      )

      console.log(`📍 ${job.title} - 距离: ${(distance / 1000).toFixed(2)}km`)

      return {
        ...job,
        displayCity: extractCityDistrict(job.location.address),
        distance: distance / 1000,
        distanceText: formatDistance(distance)
      }
    })

    // 按距离排序
    jobsWithDistance.sort((a, b) => a.distance - b.distance)

    console.log('\n========== 🎉 本地距离计算完成 ==========')
    console.log('📊 岗位数量:', jobsWithDistance.length)
    console.log('🏆 最近的20个岗位:', jobsWithDistance.slice(0, 20).map(j => `${j.title}(${j.distanceText})`).join(', '))
    console.log('========================================\n')

    this.setData({
      nearbyJobs: jobsWithDistance.slice(0, 20),
      loading: false
    }, () => {
      // 更新过滤后的岗位列表
      this.updateFilteredJobs()
    })
  },

  // 获取推荐岗位
  getRecommendJobs() {
    this.setData({ loading: true })

    // db.collection('jobs').where({
    //   status: 'active'
    // }).orderBy('createTime', 'desc').limit(20).get().then(res => {

    // 改为获取所有岗位（虽然推荐可以只取前20，但为了演示效果防止漏掉使用了getAllActiveJobs，
    // 实际生产中推荐接口应该由后端分页返回，这里为了演示简单处理）
    this.getAllActiveJobs().then(allJobs => {
      // 按时间倒序
      const jobs = allJobs.sort((a, b) => {
        const timeA = a.createTime instanceof Date ? a.createTime.getTime() : new Date(a.createTime).getTime()
        const timeB = b.createTime instanceof Date ? b.createTime.getTime() : new Date(b.createTime).getTime()
        return timeB - timeA
      }).slice(0, 50) // 取最新的50条作为推荐
        .map(job => ({
          ...job,
          displayCity: extractCityDistrict(job.location?.address)
        }))
      this.setData({
        recommendJobs: jobs,
        loading: false
      }, () => {
        // 更新过滤后的岗位列表
        this.updateFilteredJobs()
      })
    }).catch(err => {
      console.error('获取推荐岗位失败', err)
      this.setData({ loading: false })
    })
  },

  // 获取匹配岗位（基于简历智能匹配）
  getMatchJobs() {
    if (!this.data.userInfo?.resume) {
      console.log('没有简历信息，无法匹配岗位')
      return
    }

    this.setData({ loading: true })

    const resume = this.data.userInfo.resume
    console.log('===== 开始智能匹配 =====')
    console.log('简历信息:', resume)

    // 首先加载用户的技能证书
    db.collection('skill_certificates').where({
      userId: this.data.userInfo._openid,
      status: 'valid'
    }).get().then(certRes => {
      console.log('用户证书数量:', certRes.data.length)

      // 将证书数据添加到简历中
      const resumeWithCerts = {
        ...resume,
        certificates: certRes.data
      }

      // 获取所有激活的职位
      // return db.collection('jobs').where({
      //   status: 'active'
      // }).get().then(res => {

      // 改为获取所有岗位
      return this.getAllActiveJobs().then(allJobs => {
        console.log('获取到职位数量:', allJobs.length)

        const jobs = allJobs.map(job => {
          const matchScore = this.calculateMatchScore(resumeWithCerts, job)
          return {
            ...job,
            matchScore,
            displayCity: extractCityDistrict(job.location?.address)
          }
        })

        // 按匹配度排序，只显示匹配度大于30%的职位
        const matchedJobs = jobs
          .filter(job => job.matchScore >= 30)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 20)

        console.log('匹配结果:', matchedJobs.map(j => ({ title: j.title, score: j.matchScore })))

        this.setData({
          matchJobs: matchedJobs,
          loading: false
        }, () => {
          // 更新过滤后的岗位列表
          this.updateFilteredJobs()
        })
      })
    }).catch(err => {
      console.error('获取匹配岗位失败:', err)
      this.setData({ loading: false })
    })
  },

  // 计算匹配度（0-100分）
  calculateMatchScore(resume, job) {
    let score = 0
    let totalWeight = 0

    // 1. 期望岗位匹配（权重35%）
    if (resume.expectedPosition && job.title) {
      const positionMatch = this.fuzzyMatch(resume.expectedPosition, job.title)
      score += positionMatch * 35
      totalWeight += 35
      console.log(`岗位匹配: ${resume.expectedPosition} vs ${job.title} = ${positionMatch * 35}分`)
    }

    // 2. 期望城市匹配（权重15%）
    if (resume.expectedCity && job.city) {
      const cityMatch = resume.expectedCity.includes(job.city) || job.city.includes(resume.expectedCity) ? 1 : 0
      score += cityMatch * 15
      totalWeight += 15
      console.log(`城市匹配: ${resume.expectedCity} vs ${job.city} = ${cityMatch * 15}分`)
    }

    // 3. 薪资匹配（权重20%）
    if (resume.expectedSalaryMin && resume.expectedSalaryMax && job.salaryMin && job.salaryMax) {
      const salaryMatch = this.calculateSalaryMatch(
        resume.expectedSalaryMin,
        resume.expectedSalaryMax,
        job.salaryMin,
        job.salaryMax
      )
      score += salaryMatch * 20
      totalWeight += 20
      console.log(`薪资匹配: ${resume.expectedSalaryMin}-${resume.expectedSalaryMax} vs ${job.salaryMin}-${job.salaryMax} = ${salaryMatch * 20}分`)
    }

    // 4. 技能匹配（权重20%）
    if (resume.skills && resume.skills.length > 0 && job.tags && job.tags.length > 0) {
      const skillMatch = this.calculateSkillMatch(resume.skills, job.tags)
      score += skillMatch * 20
      totalWeight += 20
      console.log(`技能匹配: ${resume.skills.join(',')} vs ${job.tags.join(',')} = ${skillMatch * 20}分`)
    }

    // 5. 技能证书匹配（权重10%）⭐ 新增
    if (resume.certificates && resume.certificates.length > 0 && job.tags && job.tags.length > 0) {
      const certMatch = this.calculateCertificateMatch(resume.certificates, job.tags)
      score += certMatch * 10
      totalWeight += 10
      console.log(`证书匹配: ${certMatch * 10}分 (有${resume.certificates.length}个证书)`)
    }

    // 如果总权重不足100，按比例调整
    const finalScore = totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0
    console.log(`${job.title} 最终匹配度: ${finalScore}分`)
    return finalScore
  },

  // 模糊匹配（返回0-1）
  fuzzyMatch(str1, str2) {
    if (!str1 || !str2) return 0

    str1 = str1.toLowerCase()
    str2 = str2.toLowerCase()

    // 完全匹配
    if (str1 === str2) return 1

    // 包含关系
    if (str1.includes(str2) || str2.includes(str1)) return 0.8

    // 计算相似度（简单的字符匹配）
    let matchCount = 0
    const chars1 = str1.split('')
    const chars2 = str2.split('')

    chars1.forEach(char => {
      if (chars2.includes(char)) {
        matchCount++
      }
    })

    return matchCount / Math.max(chars1.length, chars2.length)
  },

  // 计算薪资匹配度（返回0-1）
  calculateSalaryMatch(expectMin, expectMax, jobMin, jobMax) {
    // 将字符串转换为数字
    expectMin = Number(expectMin)
    expectMax = Number(expectMax)
    jobMin = Number(jobMin)
    jobMax = Number(jobMax)

    // 计算重叠区间
    const overlapMin = Math.max(expectMin, jobMin)
    const overlapMax = Math.min(expectMax, jobMax)

    if (overlapMin > overlapMax) {
      // 没有重叠
      const gap = Math.min(
        Math.abs(expectMin - jobMax),
        Math.abs(expectMax - jobMin)
      )
      // 差距越小，匹配度越高
      return Math.max(0, 1 - gap / 50)
    } else {
      // 有重叠，计算重叠比例
      const overlapRange = overlapMax - overlapMin
      const totalRange = Math.max(expectMax - expectMin, jobMax - jobMin)
      return overlapRange / totalRange
    }
  },

  // 计算技能匹配度（返回0-1）
  calculateSkillMatch(resumeSkills, jobTags) {
    if (!resumeSkills || resumeSkills.length === 0 || !jobTags || jobTags.length === 0) {
      return 0
    }

    let matchCount = 0
    resumeSkills.forEach(skill => {
      jobTags.forEach(tag => {
        if (skill.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(skill.toLowerCase())) {
          matchCount++
        }
      })
    })

    return matchCount / Math.max(resumeSkills.length, jobTags.length)
  },

  // 计算技能证书匹配度（返回0-1）⭐ 新增
  calculateCertificateMatch(certificates, jobTags) {
    if (!certificates || certificates.length === 0 || !jobTags || jobTags.length === 0) {
      return 0
    }

    let matchScore = 0

    certificates.forEach(cert => {
      // 证书技能与岗位标签匹配
      if (cert.skills && cert.skills.length > 0) {
        cert.skills.forEach(certSkill => {
          jobTags.forEach(tag => {
            if (certSkill.toLowerCase().includes(tag.toLowerCase()) ||
              tag.toLowerCase().includes(certSkill.toLowerCase())) {
              // 根据证书等级给予不同权重
              if (cert.level === '高级') {
                matchScore += 0.5
              } else if (cert.level === '中级') {
                matchScore += 0.35
              } else {
                matchScore += 0.25
              }
            }
          })
        })
      }
    })

    // 归一化到 0-1
    return Math.min(1, matchScore / jobTags.length)
  },

  // 计算距离（千米）
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  // 格式化距离
  formatDistance(distance) {
    if (distance < 1) {
      return Math.round(distance * 1000) + 'm'
    } else if (distance < 10) {
      return distance.toFixed(1) + 'km'
    } else {
      return Math.round(distance) + 'km'
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    console.log('🔄 切换标签:', tab)
    this.setData({ activeTab: tab })

    // 更新过滤后的岗位列表
    this.updateFilteredJobs()

    if (tab === 'nearby') {
      console.log('📍 切换到附近岗位')

      // 如果还没有获取过位置，现在获取
      if (!this.data.location && !this.data.locationDenied) {
        console.log('📍 首次切换到附近岗位，开始获取位置')
        this.getLocation()
      } else if (this.data.locationDenied) {
        console.log('📍 位置权限被拒绝，尝试重新获取')
        // 如果之前被拒绝，尝试重新获取位置
        this.getLocation()
      } else if (this.data.nearbyJobs.length === 0) {
        console.log('📍 已有位置信息，重新获取附近岗位')
        // 已有位置信息，直接获取附近岗位
        this.getNearbyJobs()
      }
    } else if (tab === 'recommend' && this.data.recommendJobs.length === 0) {
      this.getRecommendJobs()
    } else if (tab === 'match' && this.data.matchJobs.length === 0) {
      this.getMatchJobs()
    }
  },

  // 打开位置权限设置
  openLocationSetting() {
    wx.openSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          // 用户授权了，重新获取位置
          this.getLocation()
        }
      }
    })
  },

  // 搜索
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearch() {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      // 清空搜索，退出搜索模式
      this.setData({
        isSearchMode: false,
        searchKeyword: ''
      })
      this.updateFilteredJobs()
      return
    }

    // 进入搜索模式
    this.setData({
      isSearchMode: true
    })
    this.updateFilteredJobs()
  },

  // 获取所有活跃岗位（解决小程序默认20条限制）
  getAllActiveJobs() {
    return new Promise((resolve, reject) => {
      const MAX_LIMIT = 20
      const jobs = []

      const fetch = (skip = 0) => {
        db.collection('jobs').where({
          status: 'active'
        }).skip(skip).limit(MAX_LIMIT).get().then(res => {
          const list = res.data
          if (list.length > 0) {
            jobs.push(...list)
            // 如果获取的条数等于 limit，说明可能还有下一页
            if (list.length >= MAX_LIMIT) {
              fetch(skip + MAX_LIMIT)
            } else {
              resolve(jobs)
            }
          } else {
            resolve(jobs)
          }
        }).catch(err => {
          console.error('获取岗位数据失败:', err)
          // 即使部分失败，也返回已获取的数据
          resolve(jobs)
        })
      }

      fetch(0)
    })
  },

  // 更新过滤后的岗位列表
  updateFilteredJobs() {
    const { activeTab, isSearchMode, searchKeyword, nearbyJobs, recommendJobs, matchJobs } = this.data

    // 根据当前标签页获取原始岗位列表
    let sourceJobs = []
    if (activeTab === 'nearby') {
      sourceJobs = nearbyJobs
    } else if (activeTab === 'recommend') {
      sourceJobs = recommendJobs
    } else if (activeTab === 'match') {
      sourceJobs = matchJobs
    }

    // 如果是搜索模式，过滤岗位
    if (isSearchMode && searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase()
      const filtered = sourceJobs.filter(job => {
        const title = (job.title || '').toLowerCase()
        const company = (job.companyName || '').toLowerCase()
        return title.includes(keyword) || company.includes(keyword)
      })
      this.setData({ filteredJobs: filtered })
    } else {
      // 非搜索模式，直接显示全部岗位
      this.setData({ filteredJobs: sourceJobs })
    }
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: '',
      isSearchMode: false
    })
    this.updateFilteredJobs()
  },

  // 跳转到岗位详情
  goToJobDetail(e) {
    const jobId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/candidate/jobDetail/index?id=${jobId}`
    })
  },

  // 跳转到简历编辑
  goToResumeEdit() {
    wx.navigateTo({
      url: '/pages/candidate/resume/edit/index'
    })
  },

  // 跳转到投递记录
  goToApplications() {
    wx.navigateTo({
      url: '/pages/candidate/applications/index'
    })
  },

  // 跳转到面试列表
  goToInterviews() {
    wx.navigateTo({
      url: '/pages/candidate/interviews/index'
    })
  },

  // 跳转到薄资分析
  goToSalaryAnalysis() {
    wx.navigateTo({
      url: '/pages/candidate/salaryAnalysis/index'
    })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmColor: '#667eea',
      success: (res) => {
        if (res.confirm) {
          // 清除用户信息
          app.globalData.user = null

          // 跳转到首页
          wx.reLaunch({
            url: '/pages/index/index'
          })

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.getUserInfo()
    // 刷新时也不自动获取位置，只刷新当前标签的数据
    if (this.data.activeTab === 'nearby' && this.data.location) {
      this.getNearbyJobs()
    } else if (this.data.activeTab === 'recommend') {
      this.getRecommendJobs()
    } else if (this.data.activeTab === 'match') {
      this.getMatchJobs()
    }
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})
