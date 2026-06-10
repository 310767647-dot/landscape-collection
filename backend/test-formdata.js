const http = require('http');

async function testFormData() {
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
    
    // 使用正确的multipart/form-data格式发送请求
    console.log('\n=== 测试材料保存 (使用正确的FormData格式) ===');
    
    const boundary = '----WebKitFormBoundary' + Date.now().toString(36);
    
    // 构建正确的multipart数据
    const fields = [
      { name: 'project_name', value: '测试项目' },
      { name: 'material_name', value: '测试材料名称' },
      { name: 'supplier_name', value: '测试供应商' },
      { name: 'specifications', value: '规格型号' },
      { name: 'quantity', value: '100' },
      { name: 'unit', value: '个' },
      { name: 'arrival_time', value: '2024-01-01T12:00:00' }
    ];
    
    let formData = '';
    fields.forEach(field => {
      formData += `--${boundary}\r\n`;
      formData += `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`;
      formData += `${field.value}\r\n`;
    });
    formData += `--${boundary}--\r\n`;
    
    console.log('发送的数据长度:', formData.length);
    
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

testFormData();