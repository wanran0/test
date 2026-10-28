import crypto from 'node:crypto';
import { userRepo } from '../models/userRepo.js';
import { dormRepo } from '../models/dormRepo.js';
import { memberRepo } from '../models/memberRepo.js';
import { expenseRepo } from '../models/expenseRepo.js';
import { issueToken } from '../utils/token.js';

// POST /api/auth/login  { code, nickname }
// 骨架：用 code 派生一个稳定的 mock openid。
// TODO(正式)：用 WX_APPID/SECRET 调 https://api.weixin.qq.com/sns/jscode2session 换真实 openid。
export async function login(req, res) {
  const { code, nickname } = req.body || {};
  if (!code) {
    const e = new Error('缺少 code');
    e.statusCode = 400;
    throw e;
  }
  const openid = crypto.createHash('sha1').update('mock:' + code).digest('hex');
  const user = userRepo.upsertByOpenid({ openid, nickname: nickname || '宿舍用户' });
  res.json({ token: issueToken(user.id), user });
}

// POST /api/dorms  { name, gender }  —— 创建寝室，创建者自动为宿舍长，预置水电类别
export async function createDorm(req, res) {
  const { name, gender } = req.body || {};
  if (!name) {
    const e = new Error('缺少寝室名称 name');
    e.statusCode = 400;
    throw e;
  }
  const dorm = dormRepo.create({ name, gender, ownerId: req.user.id });
  memberRepo.add({ dormId: dorm.id, userId: req.user.id, role: 'dorm_head', canInput: 1, canEdit: 1 });
  expenseRepo.seedPresetCategories(dorm.id);
  res.status(201).json({ dorm, members: memberRepo.listByDorm(dorm.id) });
}
