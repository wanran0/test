import { getDb } from '../db/index.js';
import { verifyToken } from '../utils/token.js';
import { userRepo } from '../models/userRepo.js';

// 校验 Bearer token，注入 req.user
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const decoded = verifyToken(token);
  const user = decoded && userRepo.byId(decoded.uid);
  if (!user) return res.status(401).json({ error: '未认证或 token 无效' });
  req.user = user;
  next();
}

function getMemberInDorm(dormId, userId) {
  return getDb()
    .prepare('SELECT * FROM dorm_member WHERE dorm_id = ? AND user_id = ?')
    .get(dormId, userId);
}

// 校验当前用户是指定寝室成员（dormId 取自路由参数），注入 req.member
export function requireMember(paramName = 'dormId') {
  return (req, res, next) => {
    const dormId = req.params[paramName];
    if (!dormId) return res.status(400).json({ error: '缺少 dormId' });
    const member = getMemberInDorm(dormId, req.user.id);
    if (!member) return res.status(403).json({ error: '非该寝室成员' });
    req.member = member;
    next();
  };
}

// 要求录入权限（宿舍长或有 can_input 的成员）
export function requireInput(req, res, next) {
  if (!req.member) return res.status(403).json({ error: '需要成员身份' });
  if (req.member.role !== 'dorm_head' && !req.member.can_input) {
    return res.status(403).json({ error: '无录入权限' });
  }
  next();
}
