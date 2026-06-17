/**
 * 将指定用户设置为管理员
 * 用法: node set-admin.js <用户名>
 * 示例: node set-admin.js admin
 */

const db = require('./database');
const username = process.argv[2];

if (!username) {
  console.log('用法: node set-admin.js <用户名>');
  console.log('示例: node set-admin.js admin');
  process.exit(1);
}

db.getReady().then(() => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (user) {
    if (user.role === 'admin') {
      console.log(`✓ 用户 "${username}" 已经是管理员`);
    } else {
      db.prepare('UPDATE users SET role = ? WHERE username = ?').run('admin', username);
      console.log(`✓ 用户 "${username}" 已设置为管理员`);
    }
    console.log(`  显示名: ${user.display_name || '未设置'}`);
    console.log(`  手机号: ${user.phone || '未设置'}`);
  } else {
    console.log(`✗ 用户 "${username}" 不存在`);
    console.log('可用的用户列表:');
    const users = db.prepare('SELECT username, role FROM users').all();
    users.forEach(u => console.log(`  ${u.username} (${u.role})`));
  }
});
