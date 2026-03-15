// 企业信息预览页
const app = getApp()

Page({
  data: {
    companyInfo: null,
    certStatus: ''
  },

  onLoad() {
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.on('companyData', (data) => {
      this.setData({ 
        companyInfo: data.companyInfo,
        certStatus: data.certStatus
      })
    })
  }
})
