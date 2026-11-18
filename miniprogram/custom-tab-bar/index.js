Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: 'home' },
      { pagePath: '/pages/bills/bills', text: '账单', icon: 'ledger' },
      { pagePath: '/pages/duty/duty', text: '值日', icon: 'duty' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: 'mine' }
    ]
  },
  methods: {
    onTap: function (e) {
      var i = e.currentTarget.dataset.i;
      var item = this.data.list[i];
      if (i === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});