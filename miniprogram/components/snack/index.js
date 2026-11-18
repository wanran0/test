var timer = null;
Component({
  data: { visible: false, msg: '', label: '' },
  methods: {
    show: function (msg, label, cb) {
      var that = this;
      if (timer) clearTimeout(timer);
      this._cb = cb || null;
      this.setData({ visible: true, msg: msg, label: label || '' });
      timer = setTimeout(function () { that.setData({ visible: false }); }, 4200);
    },
    onAction: function () {
      if (timer) clearTimeout(timer);
      this.setData({ visible: false });
      if (this._cb) { var cb = this._cb; this._cb = null; cb(); }
    },
    onClose: function () {
      if (timer) clearTimeout(timer);
      this.setData({ visible: false });
    }
  }
});