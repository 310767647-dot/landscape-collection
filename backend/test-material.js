const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testMaterialSave() {
  try {
    console.log('=== 测试登录 ===');
    const loginData = JSON.stringify({ username: 'admin', password: '123456' });
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 5006,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    console.log('登录响应:', loginResponse);
    if (loginResponse.status !== 200) {
      console.log('登录失败，尝试注册新用户');
      const registerData = JSON.stringify({ username: 'admin', password: '123456', display_name: '管理员' });
      const registerResponse = await makeRequest({
        hostname: 'localhost',
        port: 5006,
        path: '/api/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(registerData)
        }
      }, registerData);
      console.log('注册响应:', registerResponse);
      
      // 再次登录
      const loginResponse2 = await makeRequest({
        hostname: 'localhost',
        port: 5006,
        path: '/api/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, loginData);
      console.log('登录响应:', loginResponse2);
    }
    
    const token = loginResponse.data?.token || loginResponse2?.data?.token;
    console.log('Token:', token ? '已获取' : '未获取');
    
    if (token) {
      console.log('\n=== 获取项目列表 ===');
      const projectsResponse = await makeRequest({
        hostname: 'localhost',
        port: 5006,
        path: '/api/public/projects',
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('项目响应:', projectsResponse);
      
      const projectName = projectsResponse.data?.[0]?.name || '测试项目';
      
      console.log('\n=== 测试保存材料 ===');
      const formData = `project_name=${encodeURIComponent(projectName)}&material_name=测试材料&supplier_name=测试供应商&specifications=规格123&quantity=100&unit=个&arrival_time=2024-01-01T12:00:00`;
      
      const saveResponse = await makeRequest({
        hostname: 'localhost',
        port: 5006,
        path: '/api/materials',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formData)
        }
      }, formData);
      
      console.log('保存响应:', saveResponse);
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testMaterialSave();