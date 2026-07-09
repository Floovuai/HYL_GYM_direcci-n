import { all, exec, run, saveDb } from "./db";

async function ensureColumn(table: string, column: string, definition: string) {
  const columns = await all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function migrate() {
  await exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS advisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      normalized_name TEXT NOT NULL UNIQUE,
      branch_id INTEGER REFERENCES branches(id),
      active INTEGER NOT NULL DEFAULT 1,
      excluded_from_commissions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'Plan',
      cash_price REAL,
      card_price REAL,
      cost_per_month REAL,
      source TEXT,
      external_id TEXT,
      membership_type TEXT,
      duration_type TEXT,
      duration INTEGER,
      online_sales_url TEXT,
      description TEXT,
      external_sale_available INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      sale_key TEXT,
      source_file TEXT,
      source_row INTEGER,
      branch_id INTEGER REFERENCES branches(id),
      advisor_id INTEGER REFERENCES advisors(id),
      plan_id INTEGER REFERENCES plans(id),
      client_external_id TEXT,
      client_name TEXT,
      client_last_name TEXT,
      item_type TEXT,
      description TEXT,
      started_at TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      value REAL NOT NULL DEFAULT 0,
      sold_at TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      payment_method TEXT,
      origin TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sales_period ON sales(year, month, day);
    CREATE INDEX IF NOT EXISTS idx_sales_branch_period ON sales(branch_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_sales_advisor_period ON sales(advisor_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_sales_client_period ON sales(client_external_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_sales_plan_period ON sales(plan_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
    CREATE INDEX IF NOT EXISTS idx_sales_source ON sales(source_type, source_key);

    CREATE TABLE IF NOT EXISTS monthly_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      growth_rate REAL NOT NULL DEFAULT 0,
      advisor_activation REAL NOT NULL DEFAULT 0,
      advisor_bronze REAL NOT NULL DEFAULT 0,
      advisor_silver REAL NOT NULL DEFAULT 0,
      advisor_meta1 REAL NOT NULL DEFAULT 0,
      advisor_meta2 REAL NOT NULL DEFAULT 0,
      advisor_meta3 REAL NOT NULL DEFAULT 0,
      advisor_meta4 REAL NOT NULL DEFAULT 0,
      advisor_daily_meta4 REAL NOT NULL DEFAULT 0,
      advisor_weekly_meta4 REAL NOT NULL DEFAULT 0,
      branch_activation REAL NOT NULL DEFAULT 0,
      branch_bronze REAL NOT NULL DEFAULT 0,
      branch_silver REAL NOT NULL DEFAULT 0,
      branch_meta1 REAL NOT NULL DEFAULT 0,
      branch_meta2 REAL NOT NULL DEFAULT 0,
      branch_meta3 REAL NOT NULL DEFAULT 0,
      branch_meta4 REAL NOT NULL DEFAULT 0,
      branch_daily_meta4 REAL NOT NULL DEFAULT 0,
      branch_weekly_meta4 REAL NOT NULL DEFAULT 0,
      source TEXT,
      UNIQUE(year, month, branch_id)
    );

    CREATE TABLE IF NOT EXISTS advisor_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      advisor_id INTEGER NOT NULL REFERENCES advisors(id),
      quality_rating TEXT DEFAULT '',
      admin_rating TEXT DEFAULT '',
      quality_score REAL NOT NULL DEFAULT 0,
      admin_score REAL NOT NULL DEFAULT 0,
      quality_multiplier REAL NOT NULL DEFAULT 1,
      admin_multiplier REAL NOT NULL DEFAULT 1,
      observations TEXT DEFAULT '',
      include_in_score INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month, advisor_id)
    );

    CREATE TABLE IF NOT EXISTS commission_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL UNIQUE,
      condition_text TEXT,
      description TEXT,
      percentage REAL NOT NULL DEFAULT 0,
      fixed_bonus REAL NOT NULL DEFAULT 0,
      objective TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS director_commission_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL UNIQUE,
      condition_text TEXT,
      fixed_bonus REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      source_file TEXT,
      rows_read INTEGER NOT NULL DEFAULT 0,
      rows_inserted INTEGER NOT NULL DEFAULT 0,
      total_value REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      duplicates_skipped INTEGER NOT NULL DEFAULT 0,
      details TEXT,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      secret INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS initiatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Backlog',
      owner TEXT DEFAULT '',
      channel TEXT DEFAULT '',
      budget REAL DEFAULT 0,
      expected_impact TEXT DEFAULT '',
      start_date TEXT,
      end_date TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendiente',
      priority TEXT NOT NULL DEFAULT 'Media',
      owner TEXT DEFAULT '',
      due_date TEXT,
      area TEXT DEFAULT 'Direccion',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS metric_cache (
      cache_key TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      source_version TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_metric_cache_period ON metric_cache(year, month);

    CREATE TABLE IF NOT EXISTS evo_sync_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'evo',
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      last_started_at TEXT,
      last_completed_at TEXT,
      last_status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT DEFAULT '',
      last_rows_inserted INTEGER NOT NULL DEFAULT 0,
      last_duplicates_skipped INTEGER NOT NULL DEFAULT 0,
      last_total_value REAL NOT NULL DEFAULT 0,
      cursor_json TEXT DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source, year, month)
    );

    CREATE TABLE IF NOT EXISTS ai_context_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      snapshot_key TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_period ON ai_context_snapshots(year, month, created_at);

    CREATE TABLE IF NOT EXISTS ai_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      snapshot_id INTEGER REFERENCES ai_context_snapshots(id),
      source TEXT NOT NULL DEFAULT 'groq',
      prompt TEXT NOT NULL,
      answer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Generado',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_insights_period ON ai_insights(year, month, created_at);

    CREATE TABLE IF NOT EXISTS ai_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insight_id INTEGER REFERENCES ai_insights(id),
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pendiente',
      priority TEXT NOT NULL DEFAULT 'Media',
      owner TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureColumn("sales", "sale_key", "TEXT");
  await ensureColumn("plans", "external_id", "TEXT");
  await ensureColumn("plans", "membership_type", "TEXT");
  await ensureColumn("plans", "duration_type", "TEXT");
  await ensureColumn("plans", "duration", "INTEGER");
  await ensureColumn("plans", "online_sales_url", "TEXT");
  await ensureColumn("plans", "description", "TEXT");
  await ensureColumn("plans", "external_sale_available", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("plans", "updated_at", "TEXT");
  await run("UPDATE plans SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)");
  await run("CREATE INDEX IF NOT EXISTS idx_plans_external ON plans(source, external_id)");
  await ensureColumn("import_batches", "duplicates_skipped", "INTEGER NOT NULL DEFAULT 0");
  await run("DROP INDEX IF EXISTS idx_sales_sale_key");
  await run(`
    UPDATE sales
    SET sale_key = COALESCE(branch_id, '') || '|' ||
      COALESCE(advisor_id, '') || '|' ||
      COALESCE(plan_id, '') || '|' ||
      COALESCE(client_external_id, '') || '|' ||
      COALESCE(description, '') || '|' ||
      COALESCE(sold_at, '') || '|' ||
      COALESCE(printf('%.0f', value), '') || '|' ||
      CASE
        WHEN quantity = CAST(quantity AS INTEGER) THEN CAST(CAST(quantity AS INTEGER) AS TEXT)
        ELSE COALESCE(CAST(quantity AS TEXT), '')
      END
  `);
  await run(`
    DELETE FROM sales
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM sales
      GROUP BY sale_key
    )
  `);
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_sale_key ON sales(sale_key) WHERE sale_key IS NOT NULL");
  await saveDb();
}
