const http = require('http');

async function testSave() {
  try {
    // 登录
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
    
    console.log('登录响应:', loginResponse);
    const token = loginResponse.body.token;
    
    // 创建项目（如果不存在）
    const projectData = JSON.stringify({ name: '测试项目', description: '测试项目描述' });
    await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5006,
        path: '/api/admin/projects',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(projectData),
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: body }));
      });
      req.write(projectData);
      req.end();
    });
    
    // 测试材料保存
    console.log('\n=== 测试材料保存 ===');
    
    // 使用multipart/form-data格式
    const boundary = '----WebKitFormBoundary' + Date.now().toString(36);
    const formData = `--${boundary}\r\nContent-Disposition: form-data; name="project_name"\r\n\r\n测试项目\r\n--${boundary}\r\nContent-Disposition: form-data; name="material_name"\r\n\r\n测试材料名称\r\n--${boundary}\r\nContent-Disposition: form-data; name="supplier_name"\r\n\r\n测试供应商\r\n--${boundary}\r\nContent-Disposition: form-data; name="specifications"\r\n\r\n规格型号\r\n--${boundary}\r\nContent-Disposition: form-data; name="quantity"\r\n\r\n100\r\n--${boundary}\r\nContent-Disposition: form-data; name="unit"\r\n\r\n个\r\n--${boundary}\r\nContent-Disposition: form-data; name="arrival_time"\r\n\r\n2024-01-01T12:00:00\r\n--${boundary}--\r\n`;
    
    const saveResponse = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5006,
        path: '/api/materials',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
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
      req.write(formData);
      req.end();
    });
    
    console.log('材料保存响应:', saveResponse);
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testSave();