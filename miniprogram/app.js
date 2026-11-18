// 宿舍公共费用管理小程序 · G18
// 数据层为本地种子账本（离线可演示），结构与 backend REST 接口一一对应，
// 后续联调时把 utils/store.js 的读写替换为 wx.request 即可。
var store = require('./utils/store.js');

App({
  globalData: {
    statusBarHeight: 20,
    menuRight: 10,
    menuBottom: 52,
    version: 'V1.1 · 2026-11-18'
  },
  onLaunch: function () {
    var info = null;
    try { info = wx.getWindowInfo(); } catch (e) { info = wx.getSystemInfoSync(); }
    this.globalData.statusBarHeight = info.statusBarHeight || 20;
    try {
      var rect = wx.getMenuButtonBoundingClientRect();
      this.globalData.menuRight = info.windowWidth - rect.right;
      this.globalData.menuBottom = rect.bottom;
      this.globalData.navBarHeight = (rect.top - info.statusBarHeight) * 2 + rect.height;
    } catch (e) {
      this.globalData.navBarHeight = 44;
    }
    store.init();
    this.globalData.store = store; // 供自动化测试/联调调试使用
  }
});