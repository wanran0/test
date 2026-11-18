// 金额与日期格式化：金额一律整数分，显示时才转元
function yuan(cents) {
  var n = Math.round(cents || 0);
  var sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  var y = Math.floor(n / 100);
  var c = n % 100;
  return sign + y + '.' + (c < 10 ? '0' + c : c);
}
function yuanStr(cents) { return '¥' + yuan(cents); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today() { return dstr(new Date()); }
function addDays(s, n) {
  var p = s.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  d.setDate(d.getDate() + n);
  return dstr(d);
}
function md(s) { var p = s.split('-'); return (+p[1]) + '/' + (+p[2]); }
function cnDate(s) { var p = s.split('-'); return (+p[1]) + '月' + (+p[2]) + '日'; }
function monthKey(s) { return s.slice(0, 7); }
function monthCN(key) { var p = key.split('-'); return (+p[0]) + '年' + (+p[1]) + '月'; }
function weekStart(s) {
  var p = s.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  var dow = (d.getDay() + 6) % 7; // 周一为一周起点
  d.setDate(d.getDate() - dow);
  return dstr(d);
}
function timeAgo(ts) {
  var diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  return Math.floor(diff / 86400000) + ' 天前';
}
function hhmm(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
function dowCN(s) { var p = s.split('-'); return '周' + WEEK[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
module.exports = {
  yuan: yuan, yuanStr: yuanStr, dstr: dstr, today: today, addDays: addDays,
  md: md, cnDate: cnDate, monthKey: monthKey, monthCN: monthCN, weekStart: weekStart,
  timeAgo: timeAgo, hhmm: hhmm, dowCN: dowCN, pad: pad
};