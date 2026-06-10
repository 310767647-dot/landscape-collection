const http = require('http');

async function testFullFlow() {
  try {
    console.log('=== 测试材料保存和查询完整流程 ===\n');
    
    // 1. 登录获取token
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
    
    console.log('1. 登录结果:', loginResponse.status);
    console.log('用户ID:', loginResponse.body.user?.id);
    const token = loginResponse.body.token;
    
    // 2. 保存材料
    const materialData = JSON.stringify({
      project_name: '测试项目',
      material_name: '测试材料-' + Date.now(),
      supplier_name: '测试供应商',
      specifications: '规格型号',
      quantity: '50',
      unit: '个',
      arrival_time: '2024-01-01T12:00:00'
    });
    
    const saveResponse = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5006,
        path: '/api/materials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(materialData),
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
      req.write(materialData);
      req.end();
    });
    
    console.log('\n2. 保存材料结果:', saveResponse);
    
    // 3. 查询材料列表
    const listResponse = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5006,
        path: '/api/materials',
        method: 'GET',
        headers: {
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
      req.end();
    });
    
    console.log('\n3. 查询材料列表结果:', listResponse.status);
    console.log('材料总数:', listResponse.body.pagination?.total || 0);
    console.log('材料列表:', JSON.stringify(listResponse.body.materials || [], null, 2));
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testFullFlow();