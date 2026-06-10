const http = require('http');

async function testUrlEncoded() {
  try {
    // 登录获取token
    const loginData = JSON.stringify({ username: 'admin', password: '123456' });
    const loginResponse = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5006,
        path: '/api/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      req.write(loginData);
      req.end();
    });
    
    console.log('登录成功, Token:', loginResponse.body.token?.substring(0, 20) + '...');
    const token = loginResponse.body.token;
    
    // 使用application/x-www-form-urlencoded格式发送请求
    console.log('\n=== 测试材料保存 (使用x-www-form-urlencoded格式) ===');
    
    const formData = 'project_name=测试项目&material_name=测试材料名称&supplier_name=测试供应商&specifications=规格型号&quantity=100&unit=个&arrival_time=2024-01-01T12%3A00%3A00';
    
    console.log('发送的数据:', formData);
    
    const saveResponse = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5006,
        path: '/api/materials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formData),
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, body: body });
          }
        });
      });
      
      req.on('error', (err) => {
        console.error('请求错误:', err);
        resolve({ status: 0, body: { error: err.message } });
      });
      
      req.write(formData);
      req.end();
    });
    
    console.log('材料保存响应:', saveResponse);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testUrlEncoded();