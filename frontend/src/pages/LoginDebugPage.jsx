import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

function LoginDebugPage() {
  const { login, user, token, loading, isAuthenticated } = useAuth()
  const [formData, setFormData] = useState({
    username: 'zyy6818487',
    password: '123456'
  })
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const [loginSuccess, setLoginSuccess] = useState(false)

  const addLog = (msg) => {
    console.log('DEBUG:', msg)
    setLogs(prev => [...prev.slice(-50), `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    addLog('组件挂载')
    addLog(`loading: ${loading}`)
    addLog(`isAuthenticated: ${isAuthenticated}`)
    addLog(`user存在: ${!!user}`)
    addLog(`token存在: ${!!token}`)
    if (user) addLog(`user.role: ${user.role}`)
  }, [])

  useEffect(() => {
    addLog(`状态变化 - isAuthenticated: ${isAuthenticated}`)
  }, [isAuthenticated])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    addLog('=== 开始登录 ===')
    
    try {
      addLog('发送请求到 /api/login')
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      addLog(`响应状态: ${response.status}`)
      const data = await response.json()
      addLog(`响应数据: ${JSON.stringify(data)}`)

      if (data.success) {
        addLog('调用 login() 更新状态')
        await login(data.user, data.token)
        setLoginSuccess(true)
        addLog('登录完成')
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
      addLog(`错误: ${err.message}`)
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h1>🔍 登录状态检查</h1>

      {/* 实时状态 */}
      <div style={{ marginBottom: 20, padding: 15, background: '#f5f5f5', borderRadius: 8 }}>
        <h3>📊 当前状态</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <span style={{ color: '#666' }}>loading:</span>
            <strong style={{ marginLeft: 10 }}>{loading ? 'true' : 'false'}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>isAuthenticated:</span>
            <strong style={{ marginLeft: 10, color: isAuthenticated ? 'green' : 'red' }}>{isAuthenticated ? '✅ true' : '❌ false'}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>user存在:</span>
            <strong style={{ marginLeft: 10 }}>{user ? '✅ true' : '❌ false'}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>token存在:</span>
            <strong style={{ marginLeft: 10 }}>{token ? '✅ true' : '❌ false'}</strong>
          </div>
        </div>
        {user && (
          <div style={{ marginTop: 10, padding: 10, background: '#fff', borderRadius: 4 }}>
            <p><strong>用户名:</strong> {user.username}</p>
            <p><strong>角色:</strong> {user.role}</p>
            <p><strong>是否管理员:</strong> {user.role === 'admin' ? '✅ 是' : '❌ 否'}</p>
          </div>
        )}
      </div>

      {/* 登录表单 */}
      <div style={{ marginBottom: 20 }}>
        <h3>🔐 登录测试</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label>用户名:</label><br/>
            <input
              type="text"
              value={formData.username}
              onChange={e => setFormData(prev => ({...prev, username: e.target.value}))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>密码:</label><br/>
            <input
              type="password"
              value={formData.password}
              onChange={e => setFormData(prev => ({...prev, password: e.target.value}))}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <button 
            type="submit" 
            style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: 10 }}>❌ {error}</p>}
        {loginSuccess && <p style={{ color: 'green', marginTop: 10 }}>✅ 登录成功！请刷新页面后访问首页</p>}
      </div>

      {/* 日志 */}
      <div>
        <h3>📝 操作日志</h3>
        <div style={{ background: '#000', color: '#0f0', padding: 10, height: 200, overflow: 'auto', borderRadius: 4, fontSize: 12 }}>
          {logs.length === 0 ? '点击登录查看日志' : logs.map((log, i) => <p key={i} style={{ margin: 2 }}>{log}</p>)}
        </div>
      </div>

      {/* 操作说明 */}
      <div style={{ marginTop: 20, padding: 15, background: '#fff3cd', borderRadius: 8 }}>
        <h3>📋 测试步骤</h3>
        <ol>
          <li>点击"登录"按钮</li>
          <li>查看"当前状态"中的 isAuthenticated 是否变为 true</li>
          <li>如果变为 true，刷新页面后访问首页</li>
          <li>如果仍为 false，请告诉我日志内容</li>
        </ol>
      </div>
    </div>
  )
}

export default LoginDebugPage