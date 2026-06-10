const jwt = require('jsonwebtoken');
const JWT_SECRET = 'landscape-collection-secret-key-2024';

const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijg3ZjdkYmQ5LWNlMDItNGM3Yi05Yjk2LWY4NWU5ZGFiMjJkZSIsInVzZXJuYW1lIjoienl5NjgxODQ4NyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc0ODc2MjM2MiwiZXhwIjoxNzQ5MzY3MTYyfQ.5f8xQK0xQK0xQK0xQK0xQK0xQK0xQK0xQK0xQK0xQK0';

try {
  const decoded = jwt.verify(testToken, JWT_SECRET);
  console.log('Token解码成功:');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('');
  console.log('Role:', decoded.role);
  console.log('是否为admin:', decoded.role === 'admin');
} catch (error) {
  console.log('Token验证失败:', error.message);
}