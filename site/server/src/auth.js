import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET || 'dev-secret';

export function signToken(payload) {
  return jwt.sign(payload, secret, { expiresIn: '12h' });
}

export function verifyToken(token) {
  return jwt.verify(token, secret);
}

export function checkAdminCredentials(user, pass) {
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}
