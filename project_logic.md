# 职场速约 - 项目逻辑全解

本文档详细拆解了"职场速约"微信小程序的所有核心业务逻辑、算法实现及数据流转机制。

## 1. 系统架构概述

本项目采用 **Serverless 无服务架构**，依托微信云开发（CloudBase）实现。

- **前端层 (Mini Program)**: 负责界面交互、LBS位置计算、初步业务校验及实时匹配计算。
- **后端层 (Cloud Functions)**: 负责敏感业务逻辑（如User ID生成、消息推送）、复杂数据库操作及核心算法的云端备份。
- **数据层 (Cloud Database)**: NoSQL 文档型数据库，存储所有业务数据。

---

## 2. 核心业务逻辑详解

### 2.1 用户认证与体系 (User Authentication)

**逻辑流程**:
1.  **注册**:
    - 用户在前端 (`pages/auth/register`) 输入手机号、姓名、密码。
    - 前端正则校验手机格式、两次密码一致性。
    - 查询数据库 `users` 集合查重（手机号/姓名）。
    - 调用云函数 `userInit` 创建用户。
2.  **云端初始化 (`userInit`)**:
    - 获取用户 `OPENID`。
    - 强制创建 (`forceCreate`) 模式下，直接插入带有 `role` (candidate/company) 的用户记录。
    - 自动处理企业用户的 `legalPerson` 字段。
    - 返回生成的 `_id` 和 `openid`。
3.  **登录与状态维持**:
    - `app.js` 全局维护 `globalData.user`。
    - 每次启动应用 (`onLaunch`) 初始化云环境。
    - 各页面 `onLoad`/`onShow` 时检查全局用户状态，未登录则跳转登录页。

### 2.2 智能岗位匹配算法 (Smart Matching Algorithm)

本项目实现了**前端实时计算**与**云端计算**两套匹配逻辑，确保用户体验与性能并重。

**涉及文件**:
- 前端: `miniprogram/pages/candidate/home/index.js` (实时反馈)
- 云端: `cloudfunctions/quickstartFunctions/index.js` -> `matchJobs` (API能力)

**五维匹配模型**:
系统将 Resume (简历) 与 Job (岗位) 的匹配度量化为 0-100 分。

| 维度 | 权重 | 匹配逻辑细节 |
| :--- | :--- | :--- |
| **期望岗位** | 35% | 模糊匹配：`fuzzyMatch(期望, JD标题)`。完全一致得1分，包含关系得0.8分，字符重叠度计算0.x分。 |
| **薪资范围** | 20% | IoU (交并比) 思想：计算求职者期望薪资区间与JD薪资区间的重叠率。完全无重叠则根据差距扣分。 |
| **技能标签** | 20% | 标签交集：计算 (双向包含的标签数量 / 最大标签集长度)。 |
| **工作城市** | 15% | 包含匹配：期望城市包含JD城市（或反之）即得分。 |
| **技能证书** | 10% | 加分制：持有高级证书+0.5，中级+0.35，初级+0.25 (归一化后)。 |

### 2.3 LBS 地理位置服务 (Location Based Service)

**逻辑流程**:
1.  **获取位置**: `wx.getLocation` 获取用户当前 GPS 坐标 (GCJ02)。
2.  **逆地址解析**: 调用 `qqmapsdk.reverseGeocoder` 将坐标解析为 "省/市/区" 结构化数据，用于同城筛选。
3.  **距离计算**:
    - **优先方案**: 调用腾讯地图 API `calculateDistance` 批量计算直线距离。
    - **降级方案**: 若 API 失败，前端使用 `calculateDistanceLocal` (Haversine 公式) 本地计算两点间球面距离。
4.  **排序**: 按距离 (m/km) 由近及远排序 `nearbyJobs` 列表。

### 2.4 招聘全流程管理 (Recruitment Flow)

#### 2.4.1 岗位发布 (`pages/company/jobPublish`)
- **权限校验**: 检查 `users` 表中企业用户的 `certStatus` 是否为 `approved`，且企业信息字段完整。
- **数据处理**: 验证薪资合理性 (`salaryMin <= salaryMax`)，添加 `createTime` 和 `updateTime`。
- **媒体上传**: 支持上传介绍视频到云存储，保存 `fileID` 到数据库。

#### 2.4.2 投递与状态机 (`pages/candidate/jobDetail`)
- **简历预检**: 投递前校验简历完整性 (`checkSkillCertification` + 字段非空检查)。
- **状态流转**: `applications` 表 `status` 字段变更：
  `submitted` (已投递) -> `viewed` (已查看) -> `interviewed` (面试中) -> `hired` (录用) / `rejected` (拒绝)。

#### 2.4.3 面试预约 (`pages/candidate/jobDetail` & `pages/company/interviewManage`)
1.  **发起**: 求职者点击“预约面试”，创建状态为 `pending` 的 `interviews` 记录。
2.  **确认**: 企业 HR 收到申请，填写具体时间、地点、备注，状态置为 `confirmed`。
3.  **结果**: 面试后企业标记结果，状态更为 `completed`，并更新关联的 `applications` 状态。

### 2.5 技能认证与考试系统 (`pages/candidate/skillExam`)

**逻辑流程**:
1.  **题库加载**: 从 `skill_questions` 随机抽取 10 道题（洗牌算法）。
2.  **在线考试**: 记录答题时间，实时计算得分。
3.  **判分与发证**:
    - **及格线**: 答对至少 1 题（10分）即可获证（演示逻辑，实际可调）。
    - **等级判定**: 正确率 ≥90% 高级，≥75% 中级，其他初级。
    - **证书去重**: 若用户已有同类证书，仅当新证书得分更高时才替换旧证书。
    - **数据落盘**: 保存 `skill_exam_records` (记录) 和 `skill_certificates` (证书)。

### 2.6 消息订阅通知 (`cloudfunctions/quickstartFunctions`)

利用微信订阅消息能力，实现业务闭环通知。
- **sendSubscribeMessage**: 通用发送接口。
- **场景**:
    - `sendInterviewNotice`: 企业确认面试后 -> 通知求职者。
    - `sendInterviewResult`: 企业反馈面试结果后 -> 通知求职者。 (模板 ID: `EfFLZBk...` / `3RgFK6...`)

---

## 3. 数据库模型设计 (Schema Logic)

系统由以下核心集合构成业务闭环：

1.  **users**: `_id`, `openid`, `role` (Identity), `resume` (Nested Object), `companyInfo` (Nested Object)
    - 逻辑点：单表存储双角色，通过 `role` 字段区分 UI 和权限。
2.  **jobs**: `companyId`, `location` (GeoPoint), `matchTags`, `status`
    - 逻辑点：冗余存储 `companyName` 减少联表查询。
3.  **applications**: `jobId`, `candidateId`, `status`
    - 逻辑点：连接求职者与岗位的中间表，记录生命周期。
4.  **interviews**: `applicationId`, `time`, `result`
    - 逻辑点：从 Application 衍生出的子流程。
5.  **skill_certificates**: `level`, `score`, `validUntil`
    - 逻辑点：作为 Resume 的增强凭证，参与匹配算法加权。

## 4. 关键算法代码片段 (Pseudo/Ref)

### 全量数据获取 (解决20条限制)
在 `home/index.js` 中使用递归或多次拉取逻辑 `getAllActiveJobs`，突破小程序端数据库查询限制，确保本地匹配算法基于全量活跃岗位运行。

```javascript
// 核心逻辑示意
const MATCH_WEIGHTS = {
  position: 0.35,
  salary: 0.20,
  skills: 0.20,
  city: 0.15,
  cert: 0.10
};
// 最终得分 = Σ (维度得分 * 权重)
```
