const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 岗位匹配算法
const matchJobs = async (event) => {
  try {
    const { userResume } = event;
    
    // 验证必需参数
    if (!userResume) {
      return {
        success: false,
        errMsg: 'userResume 参数缺失'
      };
    }
    
    // 获取所有激活的岗位
    const jobsResult = await db.collection('jobs').where({
      status: 'active'
    }).get();
    
    const jobs = jobsResult.data;
    
    // 计算匹配度
    const matchedJobs = jobs.map(job => {
      let score = 0;
      let matchCount = 0;
      let totalCount = 0;
      
      // 匹配期望城市
      if (userResume.expectedCity && job.city) {
        totalCount++;
        if (userResume.expectedCity === job.city) {
          score += 30;
          matchCount++;
        }
      }
      
      // 匹配技能标签
      if (userResume.skills && userResume.skills.length > 0 && job.tags && job.tags.length > 0) {
        const skillMatches = userResume.skills.filter(skill => 
          job.tags.some(tag => tag.includes(skill) || skill.includes(tag))
        );
        if (skillMatches.length > 0) {
          score += Math.min(40, skillMatches.length * 10);
          matchCount++;
        }
        totalCount++;
      }
      
      // 匹配薪资期望（添加默认值处理）
      if (userResume.expectedSalaryMin && userResume.expectedSalaryMax) {
        totalCount++;
        const jobSalaryMin = job.salaryMin || 0;
        const jobSalaryMax = job.salaryMax || 0;
        if (jobSalaryMin > 0 && jobSalaryMax > 0) {
          const jobSalaryAvg = (jobSalaryMin + jobSalaryMax) / 2;
          const userSalaryAvg = (userResume.expectedSalaryMin + userResume.expectedSalaryMax) / 2;
          const salaryDiff = Math.abs(jobSalaryAvg - userSalaryAvg);
          if (salaryDiff <= 5) {
            score += 30;
            matchCount++;
          } else if (salaryDiff <= 10) {
            score += 15;
          }
        }
      }
      
      const matchScore = totalCount > 0 ? Math.round(score) : 0;
      
      return {
        ...job,
        matchScore
      };
    });
    
    // 按匹配度排序，只返回匹配度>30的岗位
    const sortedJobs = matchedJobs
      .filter(job => job.matchScore > 30)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);
    
    return {
      success: true,
      jobs: sortedJobs
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message
    };
  }
};

// 发送面试通知（订阅消息）
const sendInterviewNotice = async (event) => {
  try {
    const { openid, templateId, data, page } = event;
    
    // 验证必需参数
    if (!openid) {
      return { success: false, errMsg: 'openid 参数缺失' };
    }
    if (!templateId) {
      return { success: false, errMsg: 'templateId 参数缺失' };
    }
    if (!data) {
      return { success: false, errMsg: 'data 参数缺失' };
    }
    
    // 调用订阅消息接口
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: templateId,
      page: page || 'pages/candidate/interviews/index',
      data: data,
      miniprogramState: 'developer' // developer, trial, formal
    });
    
    return {
      success: true,
      result
    };
  } catch (e) {
    console.error('发送订阅消息失败', e);
    return {
      success: false,
      errMsg: e.message
    };
  }
};

// 删除投递记录
const cancelApplication = async (event) => {
  try {
    const { jobId, candidateId } = event;
    
    // 查找投递记录
    const applications = await db.collection('applications').where({
      jobId: jobId,
      candidateId: candidateId
    }).get();
    
    if (applications.data.length === 0) {
      return {
        success: false,
        errMsg: '未找到投递记录'
      };
    }
    
    // 删除投递记录
    const applicationId = applications.data[0]._id;
    await db.collection('applications').doc(applicationId).remove();
    
    return {
      success: true,
      message: '取消投递成功'
    };
  } catch (e) {
    console.error('取消投递失败', e);
    return {
      success: false,
      errMsg: e.message
    };
  }
};

// 发送面试结果订阅消息
const sendInterviewResult = async (event) => {
  try {
    const { userId, templateId, data, page } = event;
    
    // 获取用户的openid
    // 修正：使用 _id 查询用户
    const userRes = await db.collection('users').doc(userId).get();
    
    if (!userRes.data) {
      console.error('用户不存在:', userId);
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }
    
    const openid = userRes.data._openid;
    console.log('获取到openid:', openid);
    
    // 调用订阅消息 API
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: page || 'pages/candidate/interviews/index',
      data: data,
      templateId: templateId,
      miniprogramState: 'developer' // developer开发版，trial体验版，formal正式版
    });
    
    console.log('订阅消息发送成功:', result);
    return {
      success: true,
      data: result
    };
  } catch (e) {
    console.error('发送订阅消息失败:', e);
    return {
      success: false,
      errMsg: e.errMsg || e.message
    };
  }
};

// 发送通用订阅消息（支持企业和求职者）
const sendSubscribeMessage = async (event) => {
  try {
    console.log('===== 云函数 sendSubscribeMessage 开始执行 =====');
    console.log('接收到的参数:', JSON.stringify(event));
    
    const { userId, templateId, data, page } = event;
    
    // 验证必需参数
    if (!userId) {
      console.error('❌ userId 参数缺失');
      return {
        success: false,
        errMsg: 'userId 参数缺失'
      };
    }
    
    if (!templateId) {
      console.error('❌ templateId 参数缺失');
      return {
        success: false,
        errMsg: 'templateId 参数缺失'
      };
    }
    
    if (!data) {
      console.error('❌ data 参数缺失');
      return {
        success: false,
        errMsg: 'data 参数缺失'
      };
    }
    
    // 获取用户的openid
    console.log('开始查询用户信息, userId:', userId);
    // 修正：使用 _id 查询用户，而不是 userId 字段
    const userRes = await db.collection('users').doc(userId).get();
    
    console.log('用户查询结果:', userRes);
    
    if (!userRes.data) {
      console.error('❌ 用户不存在, userId:', userId);
      return {
        success: false,
        errMsg: '用户不存在: ' + userId
      };
    }
    
    const openid = userRes.data._openid;
    console.log('✅ 获取到openid:', openid);
    console.log('准备发送订阅消息, 参数:', {
      touser: openid,
      templateId: templateId,
      page: page,
      data: data
    });
    
    // 调用订阅消息 API
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: page,
      data: data,
      templateId: templateId,
      miniprogramState: 'developer' // developer开发版，trial体验版，formal正式版
    });
    
    console.log('✅ 订阅消息发送成功, 返回结果:', JSON.stringify(result));
    return {
      success: true,
      data: result
    };
  } catch (e) {
    console.error('❌ 发送订阅消息失败, 错误信息:', e);
    console.error('错误堆栈:', e.stack);
    console.error('错误码:', e.errCode);
    console.error('错误消息:', e.errMsg || e.message);
    return {
      success: false,
      errMsg: e.errMsg || e.message,
      errCode: e.errCode
    };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "matchJobs":
      return await matchJobs(event);
    case "sendInterviewNotice":
      return await sendInterviewNotice(event);
    case "sendInterviewResult":
      return await sendInterviewResult(event);
    case "sendSubscribeMessage":
      return await sendSubscribeMessage(event);
    case "cancelApplication":
      return await cancelApplication(event);
    default:
      return {
        success: false,
        errMsg: `未知的操作类型: ${event.type}`
      };
  }
};
