var S = require('../../utils/store.js');
var F = require('../../utils/fmt.js');
Page({
  data: {
    dorm: null, members: [], cats: [], isHead: false,
    title: '', amountStr: '', categoryId: '', payerId: '', payerName: '', date: '',
    parts: {}, mode: 'equal', ratios: {}, customs: {}, note: '', newCat: '',
    preview: [], previewSum: '0.00', diff: 0, diffStr: '0.00', ok: false, total: 0,
    modeCN: '均摊'
  },
  onLoad: function () {
    S.init();
    var me = S.me(); var dorm = S.myDorm();
    if (!dorm) { wx.showToast({ title: '请先加入寝室', icon: 'none' }); setTimeout(function () { wx.navigateBack(); }, 900); return; }
    var members = S.members(dorm.id);
    var parts = {}, ratios = {}, customs = {};
    members.forEach(function (m) { parts[m.id] = true; ratios[m.id] = '1'; customs[m.id] = ''; });
    var cats = S.cats(dorm.id);
    this.setData({
      dorm: dorm, members: members, cats: cats, isHead: S.isHead(),
      payerId: me.id, payerName: me.name, date: F.today(),
      parts: parts, ratios: ratios, customs: customs,
      categoryId: cats.length ? cats[0].id : ''
    });
    this.calc();
  },
  partIds: function () {
    var p = this.data.parts;
    return this.data.members.filter(function (m) { return p[m.id]; }).map(function (m) { return m.id; });
  },
  calc: function () {
    var d = this.data;
    var total = Math.round((parseFloat(d.amountStr) || 0) * 100);
    var ids = this.partIds();
    var weights = ids.map(function (id) {
      if (d.mode === 'ratio') return Math.max(0, parseFloat(d.ratios[id]) || 0);
      if (d.mode === 'custom') return Math.round((parseFloat(d.customs[id]) || 0) * 100);
      return 1;
    });
    var splits = ids.length && total > 0 ? S.computeSplits(total, ids, d.mode, weights) : [];
    var sum = 0;
    var preview = splits.map(function (s) {
      sum += s.cents;
      var u = S.userById(s.memberId);
      return {
        id: s.memberId, name: u ? u.name : '?', hue: u ? u.hue : '#999',
        str: F.yuan(s.cents), pct: total > 0 ? Math.round(s.cents * 100 / total) : 0
      };
    });
    var diff = total - sum;
    var ok = total > 0 && ids.length > 0 && d.title.trim() !== '' && d.categoryId &&
      (d.mode !== 'ratio' || weights.reduce(function (a, b) { return a + b; }, 0) > 0) &&
      (d.mode !== 'custom' || diff === 0);
    this.setData({
      total: total, totalStr: F.yuan(total), preview: preview, previewSum: F.yuan(sum), diff: diff, diffStr: F.yuan(Math.abs(diff)), ok: ok,
      modeCN: d.mode === 'equal' ? '均摊' : d.mode === 'ratio' ? '比例' : '自定义'
    });
  },
  onTitle: function (e) { this.setData({ title: e.detail.value }); this.calc(); },
  onAmount: function (e) { this.setData({ amountStr: e.detail.value }); this.calc(); },
  onNote: function (e) { this.setData({ note: e.detail.value }); },
  onCat: function (e) { this.setData({ categoryId: e.currentTarget.dataset.id }); this.calc(); },
  onPayer: function (e) {
    var m = this.data.members[+e.detail.value];
    this.setData({ payerId: m.id, payerName: m.name });
  },
  onDate: function (e) { this.setData({ date: e.detail.value }); },
  togglePart: function (e) {
    var id = e.currentTarget.dataset.id;
    var parts = this.data.parts;
    parts[id] = !parts[id];
    this.setData({ parts: parts }); this.calc();
  },
  setMode: function (e) {
    var m = e.currentTarget.dataset.m;
    if (m !== 'equal' && !this.data.isHead) { wx.showToast({ title: '仅寝室长可设定比例/自定义分摊', icon: 'none' }); return; }
    this.setData({ mode: m }); this.calc();
  },
  onRatio: function (e) {
    var r = this.data.ratios; r[e.currentTarget.dataset.id] = e.detail.value;
    this.setData({ ratios: r }); this.calc();
  },
  onCustom: function (e) {
    var c = this.data.customs; c[e.currentTarget.dataset.id] = e.detail.value;
    this.setData({ customs: c }); this.calc();
  },
  onNewCat: function (e) { this.setData({ newCat: e.detail.value }); },
  addCat: function () {
    var n = this.data.newCat.trim();
    if (!n) return;
    var c = S.addCategory(this.data.dorm.id, n);
    this.setData({ cats: S.cats(this.data.dorm.id), categoryId: c.id, newCat: '' });
    wx.showToast({ title: '类别已添加', icon: 'success' });
    this.calc();
  },
  submit: function () {
    if (!this.data.ok) return;
    var d = this.data;
    var ids = this.partIds();
    var ratios = ids.map(function (id) {
      if (d.mode === 'ratio') return Math.max(0, parseFloat(d.ratios[id]) || 0);
      if (d.mode === 'custom') return Math.round((parseFloat(d.customs[id]) || 0) * 100);
      return 1;
    });
    var res = S.addBill({
      dormId: d.dorm.id, title: d.title.trim(), amountCents: d.total, categoryId: d.categoryId,
      payerId: d.payerId, participantIds: ids, splitMode: d.mode, ratios: ratios,
      occurredOn: d.date, note: d.note.trim()
    });
    if (!res.ok) { wx.showToast({ title: res.msg, icon: 'none' }); return; }
    wx.showToast({ title: '已入账 ¥' + F.yuan(d.total), icon: 'success' });
    setTimeout(function () { wx.navigateBack(); }, 700);
  }
});