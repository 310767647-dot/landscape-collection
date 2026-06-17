/**
 * 超级管理员密码重置工具
 * 用法: node reset-admin.js
 *
 * 当忘记超级管理员密码时，运行此脚本重置
 */

const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'landscape_collection.db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function reset() {
  console.log('═══════════════════════════════════════');
  console.log('  超级管理员密码重置工具');
  console.log('═══════════════════════════════════════');

  if (!fs.existsSync(dbPath)) {
    console.log('❌ 数据库文件不存在');
    process.exit(1);
  }

  const sqlJs = await initSqlJs();
  const dbBuffer = fs.readFileSync(dbPath);
  const db = new sqlJs.Database(dbBuffer);

  // 查找所有管理员
  const admins = db.prepare('SELECT id, username, display_name, role FROM users WHERE role = ?').all('admin');

  if (admins.length === 0) {
    console.log('❌ 没有找到任何管理员用户');
    console.log('   请先运行 node seed.js 创建超级管理员');
    process.exit(1);
  }

  console.log('\n当前管理员列表:');
  admins.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.username} (${a.display_name || '无名'})`);
  });

  const choice = await ask('\n选择要重置的管理员编号 (1) 或输入用户名: ');
  let targetUser;

  const idx = parseInt(choice);
  if (!isNaN(idx) && idx >= 1 && idx <= admins.length) {
    targetUser = admins[idx - 1];
  } else {
    targetUser = db.prepare('SELECT * FROM users WHERE username = ?').get(choice.trim());
  }

  if (!targetUser) {
    console.log('❌ 未找到该用户');
    process.exit(1);
  }

  console.log(`\n将重置管理员: ${targetUser.username}`);
  
  const newPassword = await ask('请输入新密码 (至少6位): ');
  if (!newPassword || newPassword.length < 6) {
    console.log('❌ 密码至少6位');
    process.exit(1);
  }

  const confirmPassword = await ask('请再次输入新密码: ');
  if (newPassword !== confirmPassword) {
    console.log('❌ 两次密码不一致');
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  db.run('UPDATE users SET password = ? WHERE id = ?', [hash, targetUser.id]);
  
  // 确保角色为admin
  if (targetUser.role !== 'admin') {
    db.run('UPDATE users SET role = ? WHERE id = ?', ['admin', targetUser.id]);
  }

  // 保存数据库
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('\n✅  密码重置成功！');
  console.log(`  用户名: ${targetUser.username}`);
  console.log(`  新密码: ${newPassword}`);
  console.log('  请牢记新密码！');

  rl.close();
}

reset().catch(err => {
  console.error('❌ 重置失败:', err.message);
  process.exit(1);
});
