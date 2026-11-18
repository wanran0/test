Component({
  options: { multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    sub: { type: String, value: '' },
    back: { type: Boolean, value: true },
    tone: { type: String, value: 'pine' }
  },
  data: { sb: 20, nh: 44 },
  lifetimes: {
    attached: function () {
      var app = getApp();
      this.setData({ sb: app.globalData.statusBarHeight, nh: app.globalData.navBarHeight || 44 });
    }
  },
  methods: {
    onBack: function () {
      var pages = getCurrentPages();
      if (pages.length > 1) wx.navigateBack();
      else wx.reLaunch({ url: '/pages/index/index' });
    }
  }
});