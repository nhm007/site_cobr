import { Router } from 'express';
import { db } from '../db.js';
import { clientSchema } from '../validators.js';
import { nowISO } from '../utils.js';

export const clientsRoutes = Router();

function addressLine(c) {
  const parts = [c.rua, c.numero, c.bairro, c.cidade, c.uf, c.cep].filter(Boolean);
  return parts.join(' • ');
}

clientsRoutes.get('/summary', (req, res) => {
  const q = String(req.query.q || '').trim();
  const showHidden = String(req.query.showHidden || '0') === '1';
  const where = [];
  const params = {};
  if (!showHidden) where.push('c.oculto_lista=0');
  if (q) { where.push('(c.nome LIKE @q OR c.cpf LIKE @q)'); params.q = `%${q}%`; }

  const sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM loans l WHERE l.client_id=c.id AND l.ativo=1) as emprestimos_ativos,
      (SELECT IFNULL(SUM(l.valor_emprestimo),0) FROM loans l WHERE l.client_id=c.id AND l.ativo=1) as total_emprestado_ativo,
      (SELECT IFNULL(SUM(l.juros_mensal),0) FROM loans l WHERE l.client_id=c.id AND l.ativo=1) as total_juros_mensal_ativo,
      (SELECT IFNULL(SUM(p.valor_pago),0) FROM payments p JOIN loans l ON l.id=p.loan_id WHERE l.client_id=c.id) as total_recebido,
      (SELECT COUNT(*) FROM agreements a JOIN loans l ON l.id=a.loan_id WHERE l.client_id=c.id AND a.active=1) as acordos_ativos,
      (SELECT stored_name FROM client_files f WHERE f.client_id=c.id AND f.kind='photo' ORDER BY f.id DESC LIMIT 1) as photo
    FROM clients c
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY c.nome ASC
  `;

  const rows = db.prepare(sql).all(params).map(r => ({
    id: r.id,
    cpf: r.cpf,
    nome: r.nome,
    telefone: r.telefone,
    endereco: addressLine(r),
    optin_whatsapp: !!r.optin_whatsapp,
    oculto_lista: !!r.oculto_lista,
    emprestimos_ativos: Number(r.emprestimos_ativos || 0),
    total_emprestado_ativo: Number(r.total_emprestado_ativo || 0),
    total_juros_mensal_ativo: Number(r.total_juros_mensal_ativo || 0),
    total_recebido: Number(r.total_recebido || 0),
    acordos_ativos: Number(r.acordos_ativos || 0),
    photo: r.photo || null
  }));

  res.json(rows);
});

clientsRoutes.post('/', (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const d = parsed.data;
  const ts = nowISO();

  try {
    const info = db.prepare(`
      INSERT INTO clients (cpf,nome,telefone,cep,rua,numero,bairro,cidade,uf,indicacao,obs,optin_whatsapp,oculto_lista,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.cpf, d.nome, d.telefone,
      d.cep ?? null, d.rua ?? null, d.numero ?? null, d.bairro ?? null, d.cidade ?? null, d.uf ?? null,
      d.indicacao ?? null, d.obs ?? null,
      d.optin_whatsapp === false ? 0 : 1,
      d.oculto_lista ? 1 : 0,
      ts, ts
    );

    const created = db.prepare('SELECT * FROM clients WHERE id=?').get(info.lastInsertRowid);
    res.status(201).json({ ...created, optin_whatsapp: !!created.optin_whatsapp, oculto_lista: !!created.oculto_lista });
  } catch (e) {
    res.status(400).json({ error: 'Falha ao criar (CPF pode estar duplicado)', details: String(e.message || e) });
  }
});
