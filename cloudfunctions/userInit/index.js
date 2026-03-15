const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 用户初始化/登录建档
// event = { role: 'candidate'|'company', userInfo?: {name, gender, education, phone, email}, forceCreate?: boolean }
exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { role, userInfo, forceCreate } = event || {}
    if (!role) return { ok: false, errMsg: 'role required' }
    const users = db.collection('users')
    const now = Date.now()
    
    // 过滤掉 userInfo 中可能存在的 _openid 字段，防止覆盖
    const safeUserInfo = userInfo ? { ...userInfo } : {}
    delete safeUserInfo._openid
    
    // 如果是企业用户，将注册时的姓名默认设置为法定代表人
    const base = {
      ...safeUserInfo,
      _openid: OPENID,  // 确保 _openid 不被覆盖
      role,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    
    // 如果是企业用户且有姓名，自动设置为法定代表人
    if (role === 'company' && userInfo && userInfo.name) {
      base.legalPerson = userInfo.name
    }
    
    // 如果是强制创建（注册），直接创建新记录
    if (forceCreate) {
      const addRet = await users.add({ data: base })
      return { ok: true, openid: OPENID, _id: addRet._id, role }
    }
    
    // 否则执行 upsert 逻辑（登录）
    const existed = await users.where({ _openid: OPENID }).get()
    if (existed.data.length) {
      const id = existed.data[0]._id
      await users.doc(id).update({ data: { role, updatedAt: now, ...safeUserInfo } })
      return { ok: true, openid: OPENID, _id: id, role }
    } else {
      const addRet = await users.add({ data: base })
      return { ok: true, openid: OPENID, _id: addRet._id, role }
    }
  } catch (e) {
    console.error('userInit 云函数执行失败:', e)
    return { ok: false, errMsg: e.message || '服务器错误' }
  }
}

