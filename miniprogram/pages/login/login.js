var S = require('../../utils/store.js');
Page({
  data: { sheet: false, loading: false, identities: [] },
  onShow: function () {
    S.init();
    if (S.me()) { this.go(S.me()); return; }
    var us = S.allUsers().filter(function (u) { return u.id === 'u1' || u.id === 'u2' || u.id === 'u9'; });
    this.setData({
      identities: us.map(function (u) {
        var d = u.dormId ? S.dormById(u.dormId) : null;
        return { id: u.id, name: u.name, hue: u.hue, role: u.role, roleCN: S.roleCN(u.role), dorm: d ? d.name : '平台后台' };
      })
    });
  },
  onLogin: function () {
    var that = this;
    this.setData({ loading: true });
    setTimeout(function () { that.setData({ loading: false, sheet: true }); }, 650);
  },
  onPick: function (e) {
    var id = e.currentTarget.dataset.id;
    S.login(id);
    this.go(S.userById(id));
  },
  go: function (u) {
    if (u.role === 'admin') wx.reLaunch({ url: '/pages/admin/admin' });
    else wx.reLaunch({ url: '/pages/index/index' });
  },
  closeSheet: function () { this.setData({ sheet: false }); }
});