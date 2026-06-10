const db = require('./database');

db.getReady().then(() => {
  const username = 'zyy6818487';
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  console.log('=== 当前用户信息 ===');
  console.log(JSON.stringify(user, null, 2));
  console.log('');

  if (user) {
    if (user.role === 'admin') {
      console.log('✓ 用户 ' + username + ' 已经是管理员');
    } else {
      db.prepare('UPDATE users SET role = ? WHERE username = ?').run('admin', username);
      const updatedUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      console.log('✓ 用户 ' + username + ' 已设置为管理员');
      console.log('更新后的角色:', updatedUser.role);
    }
  } else {
    console.log('✗ 用户 ' + username + ' 不存在');
  }
});