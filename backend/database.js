const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'landscape_collection.db');

let db = null;
let dbBuffer = null;
let dbReadyResolve = null;
let dbReadyReject = null;

const dbReady = new Promise((resolve, reject) => {
  dbReadyResolve = resolve;
  dbReadyReject = reject;
});

const initDb = async () => {
  try {
    const sqlJs = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      dbBuffer = fs.readFileSync(dbPath);
      db = new sqlJs.Database(dbBuffer);
    } else {
      db = new sqlJs.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'user',
        permissions TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        project_name TEXT,
        material_name TEXT NOT NULL,
        supplier_name TEXT,
        specifications TEXT,
        quantity REAL,
        unit TEXT,
        arrival_time TEXT,
        photo_path TEXT,
        ocr_text TEXT,
        is_synced INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_projects (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        project_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS deleted_users (
        id TEXT PRIMARY KEY,
        username TEXT,
        password TEXT,
        display_name TEXT,
        real_name TEXT,
        phone TEXT,
        role TEXT,
        permissions TEXT,
        deleted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_by TEXT
      );

      CREATE TABLE IF NOT EXISTS deleted_projects (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        user_id TEXT,
        deleted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_by TEXT
      );

      CREATE TABLE IF NOT EXISTS deleted_materials (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        project_name TEXT,
        material_name TEXT,
        supplier_name TEXT,
        specifications TEXT,
        quantity REAL,
        unit TEXT,
        arrival_time TEXT,
        photo_path TEXT,
        ocr_text TEXT,
        deleted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_by TEXT
      );
    `);

    const userColumns = db.exec("PRAGMA table_info(users);")[0]?.values?.map(v => v[1]) || [];
    if (!userColumns.includes('role')) {
      db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';");
    }
    if (!userColumns.includes('permissions')) {
      db.run("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{}';");
    }
    if (!userColumns.includes('updated_at')) {
      db.run("ALTER TABLE users ADD COLUMN updated_at TEXT;");
    }
    if (!userColumns.includes('real_name')) {
      db.run("ALTER TABLE users ADD COLUMN real_name TEXT;");
    }
    if (!userColumns.includes('phone')) {
      db.run("ALTER TABLE users ADD COLUMN phone TEXT;");
    }
    // 微信小程序需要的字段
    if (!userColumns.includes('openid')) {
      db.run("ALTER TABLE users ADD COLUMN openid TEXT;");
    }
    if (!userColumns.includes('session_key')) {
      db.run("ALTER TABLE users ADD COLUMN session_key TEXT;");
    }

    const adminCount = db.exec("SELECT COUNT(*) as count FROM users WHERE role = 'admin';")[0]?.values?.[0]?.[0] || 0;
    const totalUsers = db.exec('SELECT COUNT(*) as count FROM users;')[0]?.values?.[0]?.[0] || 0;
    if (totalUsers > 0 && adminCount === 0) {
      db.run("UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);");
    }

    saveDb();
    dbReadyResolve(db);
    return db;
  } catch (error) {
    dbReadyReject(error);
    throw error;
  }
};

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

const dbWrapper = {
  prepare: (sql) => {
    return {
      run: (...params) => {
        try {
          db.run(sql, params);
          const changes = db.getRowsModified();
          saveDb();
          return { changes };
        } catch (error) {
          console.error('数据库run错误:', error);
          console.error('SQL:', sql);
          console.error('参数:', params);
          throw error;
        }
      },
      get: (...params) => {
        try {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (error) {
          console.error('数据库get错误:', error);
          console.error('SQL:', sql);
          console.error('参数:', params);
          throw error;
        }
      },
      all: (...params) => {
        try {
          const results = [];
          const stmt = db.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (error) {
          console.error('数据库all错误:', error);
          console.error('SQL:', sql);
          console.error('参数:', params);
          throw error;
        }
      }
    };
  },
  exec: (sql) => {
    try {
      db.run(sql);
      saveDb();
    } catch (error) {
      console.error('数据库exec错误:', error);
      console.error('SQL:', sql);
      throw error;
    }
  },
  getReady: () => dbReady,
  waitForDb: async () => {
    await dbReady;
  }
};

initDb().catch(console.error);

module.exports = dbWrapper;