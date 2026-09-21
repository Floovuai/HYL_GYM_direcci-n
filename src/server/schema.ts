import { all, exec, get, run, saveDb } from "./db";

async function ensureColumn(table: string, column: string, definition: string) {
  const columns = await all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function migrateMemberEvolutionDaily() {
  const table = await get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type='table' AND name='member_evolution'");
  const columns = await all<{ name: string }>("PRAGMA table_info(member_evolution)");
  const hasDay = columns.some((item) => item.name === "day");
  const hasCutoffDate = columns.some((item) => item.name === "cutoff_date");
  const hasMonthlyUnique = Boolean(table?.sql?.includes("UNIQUE(year, month, branch_id)"));
  if (hasDay && hasCutoffDate && !hasMonthlyUnique) {
    await run("DROP INDEX IF EXISTS idx_member_evolution_period");
    await run("DROP INDEX IF EXISTS idx_member_evolution_branch_period");
    await run("CREATE INDEX IF NOT EXISTS idx_member_evolution_period ON member_evolution(year, month, day)");
    await run("CREATE INDEX IF NOT EXISTS idx_member_evolution_branch_period ON member_evolution(branch_id, year, month, day)");
    return;
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS member_evolution_daily_migration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL DEFAULT 0,
      cutoff_date TEXT,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      active_start INTEGER NOT NULL DEFAULT 0,
      new_members INTEGER NOT NULL DEFAULT 0,
      renewed INTEGER NOT NULL DEFAULT 0,
      reinscriptions INTEGER NOT NULL DEFAULT 0,
      returned_from_suspension INTEGER NOT NULL DEFAULT 0,
      total_entries INTEGER NOT NULL DEFAULT 0,
      cancellations INTEGER NOT NULL DEFAULT 0,
      expired INTEGER NOT NULL DEFAULT 0,
      not_renewed INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      total_exits INTEGER NOT NULL DEFAULT 0,
      active_end INTEGER NOT NULL DEFAULT 0,
      net_evolution INTEGER NOT NULL DEFAULT 0,
      net_evolution_rate REAL NOT NULL DEFAULT 0,
      source_file TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month, day, branch_id)
    );

    INSERT OR REPLACE INTO member_evolution_daily_migration (
      id, year, month, day, cutoff_date, branch_id, active_start, new_members, renewed,
      reinscriptions, returned_from_suspension, total_entries, cancellations, expired,
      not_renewed, suspended, total_exits, active_end, net_evolution, net_evolution_rate,
      source_file, updated_at
    )
    SELECT
      id,
      year,
      month,
      ${hasDay ? "COALESCE(day, 0)" : "0"},
      ${hasCutoffDate ? "cutoff_date" : "NULL"},
      branch_id,
      active_start,
      new_members,
      renewed,
      reinscriptions,
      returned_from_suspension,
      total_entries,
      cancellations,
      expired,
      not_renewed,
      suspended,
      total_exits,
      active_end,
      net_evolution,
      net_evolution_rate,
      source_file,
      updated_at
    FROM member_evolution;

    DROP TABLE member_evolution;
    ALTER TABLE member_evolution_daily_migration RENAME TO member_evolution;
  `);
  await run("DROP INDEX IF EXISTS idx_member_evolution_period");
  await run("DROP INDEX IF EXISTS idx_member_evolution_branch_period");
  await run("CREATE INDEX IF NOT EXISTS idx_member_evolution_period ON member_evolution(year, month, day)");
  await run("CREATE INDEX IF NOT EXISTS idx_member_evolution_branch_period ON member_evolution(branch_id, year, month, day)");
}

// Modulo Competencia: ubicacion de sedes, seguimiento de competidores y precios observados.
async function migrateCompetition() {
  await ensureColumn("branches", "address", "TEXT DEFAULT ''");
  await ensureColumn("branches", "maps_url", "TEXT DEFAULT ''");
  await ensureColumn("branches", "latitude", "REAL");
  await ensureColumn("branches", "longitude", "REAL");
  await ensureColumn("branches", "radius_m", "INTEGER DEFAULT 1500");
  await ensureColumn("branches", "location_status", "TEXT DEFAULT 'pendiente'");

  await ensureColumn("competitors", "latitude", "REAL");
  await ensureColumn("competitors", "longitude", "REAL");
  await ensureColumn("competitors", "distance_m", "INTEGER");
  await ensureColumn("competitors", "website", "TEXT DEFAULT ''");
  await ensureColumn("competitors", "pricing_url", "TEXT DEFAULT ''");
  await ensureColumn("competitors", "instagram", "TEXT DEFAULT ''");
  await ensureColumn("competitors", "facebook", "TEXT DEFAULT ''");
  await ensureColumn("competitors", "whatsapp", "TEXT DEFAULT ''");
  await ensureColumn("competitors", "phone", "TEXT DEFAULT ''");
  await ensureColumn("competitors", "competitor_type", "TEXT DEFAULT 'directo'");
  await ensureColumn("competitors", "chain", "TEXT DEFAULT ''");
  await ensureColumn("competitors", "status", "TEXT DEFAULT 'confirmado'");
  await ensureColumn("competitors", "source", "TEXT DEFAULT 'manual'");
  await ensureColumn("competitors", "osm_id", "TEXT");
  await ensureColumn("competitors", "verified_at", "TEXT");
  await ensureColumn("competitors", "last_checked_at", "TEXT");
  await ensureColumn("competitors", "last_check_note", "TEXT DEFAULT ''");

  await exec(`
    CREATE TABLE IF NOT EXISTS competitor_price_obs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL REFERENCES competitors(id),
      plan_name TEXT NOT NULL,
      price REAL,
      period TEXT DEFAULT '',
      monthly_price REAL,
      enrollment_fee REAL,
      promo TEXT DEFAULT '',
      valid_until TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      source_url TEXT DEFAULT '',
      confidence TEXT NOT NULL DEFAULT 'media',
      evidence TEXT DEFAULT '',
      is_current INTEGER NOT NULL DEFAULT 1,
      observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_competitor_price_obs_current ON competitor_price_obs(competitor_id, is_current);

    CREATE TABLE IF NOT EXISTS competitor_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL REFERENCES competitors(id),
      kind TEXT NOT NULL,
      plan_name TEXT DEFAULT '',
      old_value TEXT DEFAULT '',
      new_value TEXT DEFAULT '',
      source TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_competitor_changes_created ON competitor_changes(created_at DESC);

    CREATE TABLE IF NOT EXISTS competition_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',
      summary TEXT DEFAULT '',
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_competition_runs_kind ON competition_runs(kind, finished_at);

    CREATE TABLE IF NOT EXISTS competitor_brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      aliases TEXT DEFAULT '[]',
      website TEXT DEFAULT '',
      pricing_url TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      facebook TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      segment TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      prices TEXT DEFAULT '[]',
      locations TEXT DEFAULT '[]',
      source TEXT DEFAULT 'semilla',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function migrate() {
  await exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS advisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      normalized_name TEXT NOT NULL UNIQUE,
      branch_id INTEGER REFERENCES branches(id),
      active INTEGER NOT NULL DEFAULT 1,
      excluded_from_commissions INTEGER NOT NULL DEFAULT 0,
      inactive_since TEXT,
      inactive_reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

    CREATE TABLE IF NOT EXISTS access_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL DEFAULT 'evo_checkins',
      entry_key TEXT NOT NULL UNIQUE,
      branch_id INTEGER REFERENCES branches(id),
      member_external_id TEXT,
      prospect_external_id TEXT,
      product TEXT,
      status TEXT,
      aggregator TEXT,
      checked_in_at TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      hour INTEGER NOT NULL,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_access_entries_period ON access_entries(year, month, day, hour);
    CREATE INDEX IF NOT EXISTS idx_access_entries_branch_period ON access_entries(branch_id, year, month, day);

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

    CREATE TABLE IF NOT EXISTS query_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL,
      normalized_username TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      advisor_id INTEGER REFERENCES advisors(id),
      branch_id INTEGER REFERENCES branches(id),
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      pin_plain TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_query_users_username ON query_users(normalized_username);

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

    CREATE TABLE IF NOT EXISTS member_evolution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL DEFAULT 0,
      cutoff_date TEXT,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      active_start INTEGER NOT NULL DEFAULT 0,
      new_members INTEGER NOT NULL DEFAULT 0,
      renewed INTEGER NOT NULL DEFAULT 0,
      reinscriptions INTEGER NOT NULL DEFAULT 0,
      returned_from_suspension INTEGER NOT NULL DEFAULT 0,
      total_entries INTEGER NOT NULL DEFAULT 0,
      cancellations INTEGER NOT NULL DEFAULT 0,
      expired INTEGER NOT NULL DEFAULT 0,
      not_renewed INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      total_exits INTEGER NOT NULL DEFAULT 0,
      active_end INTEGER NOT NULL DEFAULT 0,
      net_evolution INTEGER NOT NULL DEFAULT 0,
      net_evolution_rate REAL NOT NULL DEFAULT 0,
      source_file TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month, day, branch_id)
    );

    CREATE TABLE IF NOT EXISTS evolution_monthly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      active_start INTEGER NOT NULL DEFAULT 0,
      new_members INTEGER NOT NULL DEFAULT 0,
      renewed INTEGER NOT NULL DEFAULT 0,
      reinscriptions INTEGER NOT NULL DEFAULT 0,
      returned_from_suspension INTEGER NOT NULL DEFAULT 0,
      total_entries INTEGER NOT NULL DEFAULT 0,
      cancellations INTEGER NOT NULL DEFAULT 0,
      expired INTEGER NOT NULL DEFAULT 0,
      not_renewed INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      total_exits INTEGER NOT NULL DEFAULT 0,
      active_end INTEGER NOT NULL DEFAULT 0,
      net_evolution INTEGER NOT NULL DEFAULT 0,
      net_evolution_rate REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'upload',
      source_file TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month, branch_id)
    );

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

    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT DEFAULT '',
      zone TEXT NOT NULL DEFAULT '',
      branch_id INTEGER REFERENCES branches(id),
      segment TEXT DEFAULT 'Low cost',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS competitor_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL REFERENCES competitors(id),
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      monthly_price REAL,
      enrollment_fee REAL,
      promo TEXT DEFAULT '',
      services TEXT DEFAULT '',
      source TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(competitor_id, year, month)
    );

    CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_period ON competitor_snapshots(year, month);
    CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_competitor ON competitor_snapshots(competitor_id, year, month);

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

    CREATE TABLE IF NOT EXISTS app_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      area TEXT NOT NULL DEFAULT 'platform',
      user_message TEXT NOT NULL,
      technical_message TEXT NOT NULL,
      method TEXT DEFAULT '',
      path TEXT DEFAULT '',
      status_code INTEGER NOT NULL DEFAULT 500,
      details TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_app_errors_created ON app_errors(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_errors_code ON app_errors(code);
  `);

  await migrateMemberEvolutionDaily();
  await migrateCompetition();

  await ensureColumn("branches", "updated_at", "TEXT");
  await run("UPDATE branches SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)");
  await ensureColumn("advisors", "inactive_since", "TEXT");
  await ensureColumn("advisors", "inactive_reason", "TEXT DEFAULT ''");
  await ensureColumn("advisors", "updated_at", "TEXT");
  await run("UPDATE advisors SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)");
  await ensureColumn("query_users", "pin_plain", "TEXT");
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
  // Indices de cobertura: las agregaciones del estado (anual por asesor, medios de pago,
  // mensual) se resuelven leyendo solo el indice, sin volver a la tabla.
  await run("CREATE INDEX IF NOT EXISTS idx_sales_year_advisor_value ON sales(year, advisor_id, value)");
  await run("CREATE INDEX IF NOT EXISTS idx_sales_period_payment_value ON sales(year, month, payment_method, value)");
  await run(`
    UPDATE advisors
    SET active = 0,
        inactive_since = COALESCE(inactive_since, '2026-08-01'),
        inactive_reason = COALESCE(NULLIF(inactive_reason, ''), 'Retirado antes de configurar DashCom'),
        updated_at = CURRENT_TIMESTAMP
    WHERE normalized_name IN (
      'XIOMARA OCHOA',
      'VALENTINA VARGAS',
      'JEFERSON RODRIGUEZ',
      'ANGELA VIVIANA GUTIERREZ GAMBOA',
      'SARA VALENTINA MESA RODRIGUEZ'
    )
  `);
  await run(`
    UPDATE advisors
    SET inactive_since = COALESCE(inactive_since, date('now')),
        inactive_reason = COALESCE(NULLIF(inactive_reason, ''), 'Marcado inactivo antes de registrar fecha de corte'),
        updated_at = CURRENT_TIMESTAMP
    WHERE active = 0
  `);
  await saveDb();
}
