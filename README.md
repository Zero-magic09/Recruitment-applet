# 职场速约 - 基于微信云开发的智能招聘平台

![WeChat](https://img.shields.io/badge/WECHAT-MINI%20PROGRAM-07C160?style=for-the-badge&logo=wechat&logoColor=white)
![CloudBase](https://img.shields.io/badge/WECHAT-CLOUDBASE-0081ff?style=for-the-badge&logo=icloud&logoColor=white)
![JS](https://img.shields.io/badge/JAVASCRIPT-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Nodejs](https://img.shields.io/badge/NODE.JS-LTS-339933?style=for-the-badge&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/LICENSE-MIT-yellow?style=for-the-badge)
![Status](https://img.shields.io/badge/STATUS-COMPLETED-brightgreen?style=for-the-badge)

## 🎯 项目简介
**"职场速约"** 是一款基于微信云开发（CloudBase）的全栈小程序。项目旨在解决传统招聘平台信息匹配度低、地理位置感知弱的问题，通过 **LBS 地理位置服务** 与 **五维智能匹配算法**，为求职者提供“就近找工作”和“精准岗位推荐”的双重体验。

## 🚀 核心特色
- 🎯 **五维智能匹配**: 自动计算简历与岗位的匹配度。
- 📍 **LBS 就近推荐**: 集成腾讯地图 SDK，优先推荐身边的职位。
- 🏆 **技能认证体系**: 内置在线考试并自动颁发电子等级证书。
- 📹 **视频化展示**: 支持企业上传短视频展示工作环境。
- 📊 **薪资大数据**: 提供多维度的薪资分析统计报告。

## 🛠️ 技术栈
- **前端**: 微信小程序原生框架 (WXML / WXSS / JavaScript)
- **后端**: 微信云开发 (Cloud Functions / Cloud Database / Cloud Storage)
- **地图服务**: 腾讯位置服务 SDK

## 📦 快速开始
1. 导入项目到 **微信开发者工具**。
2. 在 `miniprogram/app.js` 中配置你的 `envId`。
3. 部署 `cloudfunctions` 目录下的云函数。
4. 在云开发控制台创建所需的数据库集合 (`users`, `jobs`, `applications` 等)。

---
*本项目适用于毕业设计、课程设计及微信全栈开发学习参考。*
