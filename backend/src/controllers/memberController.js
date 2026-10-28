import { memberRepo } from '../models/memberRepo.js';
import { userRepo } from '../models/userRepo.js';

// POST /api/dorms/:dormId/members  { userId | (code+nickname), role, canInput, canEdit }
export async function addMember(req, res) {
  const dormId = req.params.dormId;
  let user = req.body.userId ? userRepo.byId(req.body.userId) : null;
  if (!user && req.body.code) {
    const crypto = await import('node:crypto');
    const openid = crypto.createHash('sha1').update('mock:' + req.body.code).digest('hex');
    user = userRepo.upsertByOpenid({ openid, nickname: req.body.nickname || '室友' });
  }
  if (!user) {
    const e = new Error('需提供 userId 或 code+nickname');
    e.statusCode = 400;
    throw e;
  }
  const member = memberRepo.add({
    dormId,
    userId: user.id,
    role: req.body.role || 'member',
    canInput: req.body.canInput ?? 1,
    canEdit: req.body.canEdit ?? 0,
  });
  res.status(201).json({ member });
}

// GET /api/dorms/:dormId/members
export async function listMembers(req, res) {
  res.json({ members: memberRepo.listByDorm(req.params.dormId) });
}
