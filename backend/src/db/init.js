import { ensureSchema } from './setup.js';

const { dbPath, added } = ensureSchema();
console.log('[db] schema ready ->', dbPath);
if (added.length) console.log('[db] migrated columns:', added.join(', '));
