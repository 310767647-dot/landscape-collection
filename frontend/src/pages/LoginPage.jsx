import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.username.trim() || !formData.password) {
      setError('请输入用户名和密码')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await axios.post('/api/login', formData)

      if (response.data.success) {
        const { user, token } = response.data

        // 使用AuthContext的login函数更新状态
        await login(user, token)

        navigate('/')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err.response?.data?.error || '登录失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ padding: '40px 20px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>🌳</h1>
        <h1 style={{ fontSize: 24 }}>市政景观数据采集</h1>
        <p>登录您的账户</p>
      </div>

      <div className="page-content" style={{ flex: 1, paddingTop: 20 }}>
        <div className="form-section">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">用户名</label>
              <input
                type="text"
                className="form-input"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="请输入用户名"
                autoComplete="username"
              />
            </div>

            <div className="form-row">
              <label className="form-label">密码</label>
              <input
                type="password"
                className="form-input"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: 8,
                padding: '12px',
                marginBottom: 16,
                color: '#ff4d4f',
                fontSize: 14
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="action-button primary"
              disabled={isLoading}
              style={{ marginTop: 8 }}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            marginTop: 24,
            fontSize: 14,
            color: '#666'
          }}>
            还没有账户？{' '}
            <Link
              to="/register"
              style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}
            >
              立即注册
            </Link>
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 12,
          color: '#999'
        }}>
          <p>登录后即可使用全部功能</p>
          <p style={{ marginTop: 4 }}>包括数据采集、离线同步和导出功能</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage