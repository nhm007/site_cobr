import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { db } from '../db.js';
import { nowISO } from '../utils.js';

dotenv.config();

export const filesRoutes = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const maxMb = Number(process.env.MAX_UPLOAD_MB || 15);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, base + ext);
  }
});

const upload = multer({ storage, limits: { fileSize: maxMb * 1024 * 1024 } });

function ensureClient(clientId) {
  const row = db.prepare('SELECT id FROM clients WHERE id=?').get(clientId);
  return !!row;
}

filesRoutes.get('/clients/:id', (req, res) => {
  const clientId = Number(req.params.id);
  if (!ensureClient(clientId)) return res.status(404).json({ error: 'Cliente não encontrado' });

  const rows = db.prepare('SELECT * FROM client_files WHERE client_id=? ORDER BY id DESC').all(clientId);
  res.json(rows.map(r => ({
    id: r.id,
    kind: r.kind,
    original_name: r.original_name,
    mime: r.mime,
    size: r.size,
    created_at: r.created_at
  })));
});

filesRoutes.post('/clients/:id/photo', upload.single('file'), (req, res) => {
  const clientId = Number(req.params.id);
  if (!ensureClient(clientId)) return res.status(404).json({ error: 'Cliente não encontrado' });
  if (!req.file) return res.status(400).json({ error: 'Arquivo ausente' });

  const ts = nowISO();
  db.prepare(`
    INSERT INTO client_files (client_id, kind, stored_name, original_name, mime, size, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(clientId, 'photo', req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, ts);

  res.json({ ok: true });
});

filesRoutes.post('/clients/:id/docs', upload.array('files', 10), (req, res) => {
  const clientId = Number(req.params.id);
  if (!ensureClient(clientId)) return res.status(404).json({ error: 'Cliente não encontrado' });
  const list = req.files || [];
  if (!list.length) return res.status(400).json({ error: 'Arquivos ausentes' });

  const ts = nowISO();
  const stmt = db.prepare(`
    INSERT INTO client_files (client_id, kind, stored_name, original_name, mime, size, created_at)
    VALUES (?,?,?,?,?,?,?)
  `);

  const tx = db.transaction(() => {
    for (const f of list) {
      stmt.run(clientId, 'doc', f.filename, f.originalname, f.mimetype, f.size, ts);
    }
  });
  tx();

  res.json({ ok: true, count: list.length });
});

filesRoutes.get('/:fileId/download', (req, res) => {
  const id = Number(req.params.fileId);
  const row = db.prepare('SELECT * FROM client_files WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: 'Arquivo não encontrado' });

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const full = path.join(uploadDir, row.stored_name);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Arquivo ausente no disco' });

  res.setHeader('Content-Type', row.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.original_name)}"`);
  fs.createReadStream(full).pipe(res);
});
