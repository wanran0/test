var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
var TYPE = { suggestion: '建议', complaint: '投诉', dispute: '纠纷调解' };
var STATUS = { pending: '待处理', adopted: '已采纳', replied: '已回复', rejected: '已驳回' };
Page({
  data: {
    ok: false, tab: 'ov', stats: null, dorms: [], users: [], fb: [], flags: [],
    sheet: '', editId: '', editName: '', replyText: '', replyAction: 'replied', replyId: ''
  },
  onShow: function () {
    S.init();
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    this.setData({ ok: S.isAdmin() });
    if (S.isAdmin()) this.refresh();
  },
  refresh: function () {
    var st = S.adminStats();
    st.totalStr = F.yuan(st.total);
    var dorms = S.allDorms().map(function (d) {
      var n = 0;
      S.allBills().forEach(function (b) { if (b.dormId === d.id) n++; });
      return { id: d.id, name: d.name, members: d.memberIds.length, bills: n, consent: d.consent, head: (S.userById(d.headId) || {}).name || '—' };
    });
    var users = S.allUsers().filter(function (u) { return u.role !== 'admin'; }).map(function (u) {
      return { id: u.id, name: u.name, hue: u.hue, roleCN: S.roleCN(u.role), dorm: u.dormId ? (S.dormById(u.dormId) || {}).name : '未加入', locked: u.locked };
    });
    var fb = S.allFeedback().map(function (f) {
      return { id: f.id, typeCN: TYPE[f.type] || f.type, content: f.content, user: (S.userById(f.userId) || {}).name || '?', status: f.status, statusCN: STATUS[f.status] || f.status, reply: f.reply, ago: F.timeAgo(f.createdAt) };
    });
    var flags = S.allFlags().map(function (g) {
      return { id: g.id, text: g.text, reason: g.reason, user: (S.userById(g.userId) || {}).name || '?', status: g.status, statusCN: g.status === 'pending' ? '待处理' : g.status === 'removed' ? '已移除' : '已保留' };
    });
    this.setData({ stats: st, dorms: dorms, users: users, fb: fb, flags: flags });
  },
  setTab: function (e) { this.setData({ tab: e.currentTarget.dataset.t }); },
  openRename: function (e) {
    var d = S.dormById(e.currentTarget.dataset.id);
    this.setData({ sheet: 'rename', editId: d.id, editName: d.name });
  },
  onEditName: function (e) { this.setData({ editName: e.detail.value }); },
  saveRename: function () {
    var n = this.data.editName.trim();
    if (!n) return;
    S.updateDorm(this.data.editId, n);
    this.setData({ sheet: '' });
    wx.showToast({ title: '已改名', icon: 'success' });
    this.refresh();
  },
  delDorm: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var d = S.dormById(id);
    wx.showModal({
      title: '删除寝室', content: '删除「' + d.name + '」及其账单/排班数据？4 秒内可撤销。', confirmColor: '#D9482B',
      success: function (r) {
        if (!r.confirm) return;
        var undo = S.deleteDorm(id);
        that.refresh();
        var snack = that.selectComponent('#snack');
        if (snack) snack.show('寝室已删除', '撤销', function () { if (undo) undo(); that.refresh(); });
      }
    });
  },
  toggleLock: function (e) {
    var u = S.userById(e.currentTarget.dataset.id);
    S.lockUser(u.id, !u.locked);
    wx.showToast({ title: u.locked ? '已解锁 ' + u.name : '已锁定 ' + u.name, icon: 'none' });
    this.refresh();
  },
  openReply: function (e) {
    var ds = e.currentTarget.dataset;
    this.setData({ sheet: 'reply', replyId: ds.id, replyAction: ds.act, replyText: '' });
  },
  onReply: function (e) { this.setData({ replyText: e.detail.value }); },
  saveReply: function () {
    S.triageFeedback(this.data.replyId, this.data.replyAction, this.data.replyText.trim());
    this.setData({ sheet: '' });
    wx.showToast({ title: '处理完成', icon: 'success' });
    this.refresh();
  },
  rejectFb: function (e) {
    S.triageFeedback(e.currentTarget.dataset.id, 'rejected', '经核查不予采纳/调解。');
    wx.showToast({ title: '已驳回', icon: 'none' });
    this.refresh();
  },
  resolveFlag: function (e) {
    var ds = e.currentTarget.dataset;
    S.resolveFlag(ds.id, ds.act);
    wx.showToast({ title: ds.act === 'removed' ? '内容已移除' : '内容已保留', icon: 'none' });
    this.refresh();
  },
  closeSheet: function () { this.setData({ sheet: '' }); },
  exitAdmin: function () {
    S.logout();
    wx.reLaunch({ url: '/pages/login/login' });
  },
  goLogin: function () { wx.reLaunch({ url: '/pages/login/login' }); }
});