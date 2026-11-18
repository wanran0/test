var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: {
    dorm: null, me: null, isHead: false, members: [], headName: '',
    code: '', newName: '', rulesText: '', sheet: '', undoId: ''
  },
  onShow: function () {
    S.init();
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    this.refresh();
  },
  refresh: function () {
    var me = S.me(); var dorm = S.myDorm();
    var members = dorm ? S.members(dorm.id).map(function (m) {
      return { id: m.id, name: m.name, hue: m.hue, role: m.role, roleCN: S.roleCN(m.role), isHead: dorm.headId === m.id, isMe: m.id === me.id };
    }) : [];
    this.setData({
      me: me, dorm: dorm, isHead: S.isHead(), members: members,
      headName: dorm ? (S.userById(dorm.headId) || {}).name : '',
      rulesText: dorm ? dorm.rules.join('\n') : ''
    });
  },
  onCode: function (e) { this.setData({ code: e.detail.value }); },
  onNewName: function (e) { this.setData({ newName: e.detail.value }); },
  join: function () {
    var res = S.joinByCode(this.data.code.trim());
    if (!res.ok) { wx.showToast({ title: res.msg, icon: 'none' }); return; }
    wx.showToast({ title: '已加入 ' + res.dorm.name, icon: 'success' });
    this.setData({ code: '' });
    this.refresh();
  },
  create: function () {
    var n = this.data.newName.trim();
    if (!n) { wx.showToast({ title: '请填写寝室名称', icon: 'none' }); return; }
    var res = S.createDorm(n);
    if (!res.ok) { wx.showToast({ title: res.msg, icon: 'none' }); return; }
    wx.showToast({ title: '寝室已创建', icon: 'success' });
    this.setData({ newName: '' });
    this.refresh();
  },
  copyCode: function () {
    var that = this;
    wx.setClipboardData({ data: this.data.dorm.code, success: function () { wx.showToast({ title: '邀请码已复制', icon: 'success' }); } });
  },
  openRules: function () { this.setData({ sheet: 'rules' }); },
  closeSheet: function () { this.setData({ sheet: '' }); },
  onRules: function (e) { this.setData({ rulesText: e.detail.value }); },
  saveRules: function () {
    var rules = this.data.rulesText.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    S.updateRules(this.data.dorm.id, rules);
    this.setData({ sheet: '' });
    wx.showToast({ title: '规则已更新', icon: 'success' });
    this.refresh();
  },
  remove: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var u = S.userById(id);
    wx.showModal({
      title: '移出成员', content: '将 ' + u.name + ' 移出寝室？4 秒内可撤销。', confirmColor: '#D9482B',
      success: function (r) {
        if (!r.confirm) return;
        var undo = S.removeMember(that.data.dorm.id, id);
        that.refresh();
        var snack = that.selectComponent('#snack');
        if (snack) snack.show(u.name + ' 已被移出', '撤销', function () { if (undo) undo(); that.refresh(); });
      }
    });
  },
  leave: function () {
    var that = this;
    wx.showModal({
      title: '退出寝室', content: '退出后将不再看到该寝室的账单与排班。', confirmColor: '#D9482B',
      success: function (r) {
        if (!r.confirm) return;
        var res = S.leaveDorm();
        if (!res.ok) { wx.showToast({ title: res.msg, icon: 'none' }); return; }
        wx.showToast({ title: '已退出', icon: 'none' });
        that.refresh();
      }
    });
  }
});