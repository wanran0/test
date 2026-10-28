import crypto from 'node:crypto';
import { config } from '../config.js';

// 骨架用 HMAC 签名 token：payloadB64.signature。生产应换成正规 JWT/session。
const b64 = (s) => Buffer.from(s).toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString('utf8');

function sign(payload) {
  return crypto.createHmac('sha256', config.authSecret).update(payload).digest('base64url');
}

export function issueToken(userId) {
  const payload = b64(JSON.stringify({ uid: userId, iat: Date.now() }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(unb64(payload));
  } catch {
    return null;
  }
}
