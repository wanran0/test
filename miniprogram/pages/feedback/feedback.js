var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
var TYPE = { suggestion: '建议', complaint: '投诉', dispute: '纠纷调解' };
var STATUS = { pending: '待处理', adopted: '已采纳', replied: '已回复', rejected: '已驳回' };
Page({
  data: { type: 'suggestion', content: '', mine: [], types: [{ k: 'suggestion', t: '建议' }, { k: 'complaint', t: '投诉' }, { k: 'dispute', t: '纠纷调解' }] },
  onShow: function () {
    S.init();
    var me = S.me();
    if (!me) { wx.reLaunch({ url: '/pages/login/login' }); return; }
    this.refresh();
  },
  refresh: function () {
    var me = S.me();
    var mine = S.allFeedback().filter(function (f) { return f.userId === me.id; }).map(function (f) {
      return {
        id: f.id, typeCN: TYPE[f.type] || f.type, content: f.content,
        statusCN: STATUS[f.status] || f.status, status: f.status, reply: f.reply, ago: F.timeAgo(f.createdAt)
      };
    });
    this.setData({ mine: mine });
  },
  setType: function (e) { this.setData({ type: e.currentTarget.dataset.k }); },
  onContent: function (e) { this.setData({ content: e.detail.value }); },
  submit: function () {
    var c = this.data.content.trim();
    if (c.length < 5) { wx.showToast({ title: '请至少写 5 个字', icon: 'none' }); return; }
    S.addFeedback(this.data.type, c);
    this.setData({ content: '' });
    wx.showToast({ title: '已提交，等待处理', icon: 'success' });
    this.refresh();
  }
});