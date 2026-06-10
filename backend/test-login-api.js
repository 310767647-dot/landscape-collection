const http = require('http');

const postData = JSON.stringify({
  username: 'zyy6818487',
  password: '123456'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('=== 登录响应 ===');
    const response = JSON.parse(data);
    console.log('成功:', response.success);
    console.log('');
    
    if (response.success) {
      console.log('用户信息:');
      console.log('  ID:', response.user.id);
      console.log('  用户名:', response.user.username);
      console.log('  角色:', response.user.role);
      console.log('');
      console.log('Token:', response.token);
      
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = 'landscape-collection-secret-key-2024';
      
      try {
        const decoded = jwt.verify(response.token, JWT_SECRET);
        console.log('');
        console.log('=== Token解码 ===');
        console.log(JSON.stringify(decoded, null, 2));
        console.log('');
        console.log('Token中的role:', decoded.role);
        console.log('是否包含role:', !!decoded.role);
      } catch (error) {
        console.log('Token验证失败:', error.message);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.write(postData);
req.end();