// app.js
const { envList } = require('./envList');

App({
  onLaunch: function () {
    this.globalData = {
      // 云开发环境ID - 自动获取envList中的第一个环境
      env: envList && envList.length > 0 ? envList[0].envId : "cloud1-2gkavmfje2c8e8c0",
      // 腾讯位置服务（腾讯地图）Key
      qqmapKey: "KM5BZ-AK4C5-QKAI6-IHS3B-UUXYF-MIBRD",
      user: null,
      role: null // 'candidate' | 'company'
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
