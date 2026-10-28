import { choreRepo } from '../models/choreRepo.js';
import { memberRepo } from '../models/memberRepo.js';
import { generateAssignments } from '../services/scheduleService.js';

// POST /api/dorms/:dormId/chores
// { name, cycle, baseDate, rotationMembers?, generate?: { fromDate, toDate } }
export async function createChore(req, res) {
  const dormId = req.params.dormId;
  const b = req.body || {};
  const rotationMembers =
    b.rotationMembers && b.rotationMembers.length
      ? b.rotationMembers
      : memberRepo.listByDorm(dormId).map((m) => m.id);

  const chore = choreRepo.create({
    dormId,
    name: b.name || '值日',
    cycle: b.cycle || 'daily',
    baseDate: b.baseDate || new Date().toISOString().slice(0, 10),
    rotationMembers,
  });

  let assignments = [];
  if (b.generate && b.generate.fromDate && b.generate.toDate) {
    assignments = generateAssignments({
      cycle: chore.cycle,
      baseDate: chore.base_date,
      rotationMembers,
      fromDate: b.generate.fromDate,
      toDate: b.generate.toDate,
    });
    choreRepo.saveAssignments(chore.id, assignments);
  }

  res.status(201).json({ chore, assignments });
}

// GET /api/dorms/:dormId/chores
export async function listChores(req, res) {
  res.json({ chores: choreRepo.listByDorm(req.params.dormId) });
}

// GET /api/chores/:choreId/schedule
export async function getSchedule(req, res) {
  const chore = choreRepo.byId(req.params.choreId);
  if (!chore) {
    const e = new Error('值日项不存在');
    e.statusCode = 404;
    throw e;
  }
  res.json({ chore, assignments: choreRepo.listAssignments(chore.id) });
}
