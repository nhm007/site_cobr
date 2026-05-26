import { db } from './db.js';

function ensureColumn(table, column, typeSql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some(c => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpf TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      cep TEXT,
      rua TEXT,
      numero TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      indicacao TEXT,
      obs TEXT,
      optin_whatsapp INTEGER NOT NULL DEFAULT 1,
      oculto_lista INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      label TEXT,
      data_emprestimo TEXT NOT NULL,
      data_pagamento_base TEXT NOT NULL,
      dia_pagamento INTEGER NOT NULL,
      valor_emprestimo REAL NOT NULL,
      juros_percent REAL NOT NULL,
      juros_mensal REAL NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      cobrar_auto INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      data_pagamento TEXT NOT NULL,
      valor_pago REAL NOT NULL,
      competencia TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(loan_id) REFERENCES loans(id)
    );

    CREATE TABLE IF NOT EXISTS loan_month_visibility (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      competencia TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(loan_id, competencia),
      FOREIGN KEY(loan_id) REFERENCES loans(id)
    );

    CREATE TABLE IF NOT EXISTS agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      title TEXT,
      first_due_date TEXT,
      due_day INTEGER,
      installment_count INTEGER,
      installment_amount REAL,
      auto_charge INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(loan_id) REFERENCES loans(id)
    );

    CREATE TABLE IF NOT EXISTS agreement_installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agreement_id INTEGER NOT NULL,
      n INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      due_effective TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      paid_date TEXT,
      paid_amount REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(agreement_id, n),
      FOREIGN KEY(agreement_id) REFERENCES agreements(id)
    );

    -- ✅ Arquivos do cliente (foto e documentos)
    CREATE TABLE IF NOT EXISTS client_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      kind TEXT NOT NULL, -- 'photo' | 'doc'
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime TEXT,
      size INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE INDEX IF NOT EXISTS idx_clients_nome ON clients(nome);
    CREATE INDEX IF NOT EXISTS idx_loans_client ON loans(client_id);
    CREATE INDEX IF NOT EXISTS idx_loans_ativo ON loans(ativo);
    CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
    CREATE INDEX IF NOT EXISTS idx_payments_comp ON payments(competencia);
    CREATE INDEX IF NOT EXISTS idx_inst_due ON agreement_installments(due_effective);
    CREATE INDEX IF NOT EXISTS idx_client_files_client ON client_files(client_id);
  `);

  try { ensureColumn('clients', 'optin_whatsapp', 'INTEGER NOT NULL DEFAULT 1'); } catch {}
  try { ensureColumn('clients', 'oculto_lista', 'INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { ensureColumn('loans', 'cobrar_auto', 'INTEGER NOT NULL DEFAULT 1'); } catch {}
}
