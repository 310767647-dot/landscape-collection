const db = require('./database');
const bcrypt = require('bcryptjs');

db.getReady().then(() => {
  console.log('=== 检查用户数据 ===\n');

  const user = db.prepare('SELECT id, username, display_name, role, permissions FROM users WHERE username = ?').get('zyy6818487');

  if (user) {
    console.log('用户信息:');
    console.log('  ID:', user.id);
    console.log('  Username:', user.username);
    console.log('  Display Name:', user.display_name);
    console.log('  Role:', user.role);
    console.log('  Permissions:', user.permissions);

    console.log('\n=== 验证前端传递的role值 ===');
    console.log('user?.role 的值:', user.role);
    console.log('user?.role || "user" 的值:', user.role || 'user');
    console.log('user?.role !== "admin":', user.role !== 'admin');

    if ((user.role || 'user') !== 'admin') {
      console.log('\n❌ 问题找到了！用户的role不是"admin"，而是:', user.role);
      console.log('这会导致AdminRoute认为该用户不是管理员，从而重定向到首页。');

      // 修复role
      console.log('\n正在修复role...');
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
      console.log('✅ role已修复为admin');
    } else {
      console.log('\n✅ 用户的role是admin');
    }
  } else {
    console.log('❌ 用户不存在');
  }
}).catch(err => {
  console.error('错误:', err);
});