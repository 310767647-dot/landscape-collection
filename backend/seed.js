/**
 * 超级管理员初始化脚本
 * 用法: node seed.js
 *
 * 首次部署时运行此脚本，创建唯一的超级管理员账号
 * 后续运行时如果超级管理员已存在则跳过
 */

const bcrypt = require('bcryptjs');
const db = require('./database');

const SUPER_ADMIN = {
  username: 'superadmin',
  password: 'Super@Admin888',
  display_name: '超级管理员',
  real_name: '超级管理员',
  phone: '13800000000'
};

async function seed() {
  await db.getReady();

  // 检查是否已存在
  const existing = db.prepare('SELECT id, username, role FROM users WHERE username = ?').get(SUPER_ADMIN.username);

  if (existing) {
    console.log(`ℹ️  超级管理员 "${SUPER_ADMIN.username}" 已存在（角色: ${existing.role || '普通用户'}）`);
    
    if (existing.role !== 'admin') {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', existing.id);
      console.log('✅ 已将该用户提升为管理员');
    }
    return;
  }

  // 创建全新超级管理员
  const { v4: uuidv4 } = require('uuid');
  const hash = await bcrypt.hash(SUPER_ADMIN.password, 10);
  const userId = uuidv4();

  db.prepare(
    'INSERT INTO users (id, username, password, display_name, real_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, SUPER_ADMIN.username, hash, SUPER_ADMIN.display_name, SUPER_ADMIN.real_name, SUPER_ADMIN.phone, 'admin');

  console.log('═══════════════════════════════════════');
  console.log('✅  超级管理员创建成功！');
  console.log('─────────────────────────────────────');
  console.log(`  用户名: ${SUPER_ADMIN.username}`);
  console.log(`  密  码: ${SUPER_ADMIN.password}`);
  console.log('─────────────────────────────────────');
  console.log('  ⚠️  请务必记住以上账号信息！');
  console.log('  如需修改密码，运行: npm run reset-admin');
  console.log('═══════════════════════════════════════');
}

seed().catch(err => {
  console.error('❌ 创建失败:', err.message);
  process.exit(1);
});
