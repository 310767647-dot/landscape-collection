import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    username: '',
    real_name: '',
    phone: '',
    password: '',
    confirmPassword: ''
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
    setError('')

    if (!formData.username.trim()) {
      setError('请输入用户名')
      return
    }

    if (formData.username.length < 3) {
      setError('用户名至少需要3个字符')
      return
    }

    if (!formData.real_name.trim()) {
      setError('请输入真实姓名')
      return
    }

    if (!formData.phone.trim()) {
      setError('请输入手机号')
      return
    }

    if (!/^1[3-9]\d{9}$/.test(formData.phone.trim())) {
      setError('请输入有效的手机号')
      return
    }

    if (!formData.password) {
      setError('请输入密码')
      return
    }

    if (formData.password.length < 6) {
      setError('密码至少需要6个字符')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setIsLoading(true)

    try {
      const response = await axios.post('/api/register', {
        username: formData.username.trim(),
        real_name: formData.real_name.trim(),
        phone: formData.phone.trim(),
        password: formData.password
      }, {
        timeout: 15000
      })

      if (response.data.success) {
        const { user, token } = response.data
        await login(user, token)
        navigate('/')
      }
    } catch (err) {
      console.error('Register error:', err)
      setError(err.response?.data?.error || '注册失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ padding: '40px 20px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>🌿</h1>
        <h1 style={{ fontSize: 24 }}>市政景观数据采集</h1>
        <p>创建新账户</p>
      </div>

      <div className="page-content" style={{ flex: 1, paddingTop: 20 }}>
        <div className="form-section">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="form-label">用户名 *</label>
              <input
                type="text"
                className="form-input"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="至少3个字符"
                autoComplete="username"
              />
            </div>

            <div className="form-row">
              <label className="form-label">真实姓名 *</label>
              <input
                type="text"
                className="form-input"
                name="real_name"
                value={formData.real_name}
                onChange={handleChange}
                placeholder="请输入真实姓名"
              />
            </div>

            <div className="form-row">
              <label className="form-label">手机号 *</label>
              <input
                type="tel"
                className="form-input"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="请输入手机号"
              />
            </div>

            <div className="form-row">
              <label className="form-label">密码 *</label>
              <input
                type="password"
                className="form-input"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="至少6个字符"
                autoComplete="new-password"
              />
            </div>

            <div className="form-row">
              <label className="form-label">确认密码 *</label>
              <input
                type="password"
                className="form-input"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="再次输入密码"
                autoComplete="new-password"
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
              {isLoading ? '注册中...' : '注册'}
            </button>
          </form>

          <div style={{
            textAlign: 'center',
            marginTop: 24,
            fontSize: 14,
            color: '#666'
          }}>
            已有账户？{' '}
            <Link
              to="/login"
              style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}
            >
              立即登录
            </Link>
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 12,
          color: '#999'
        }}>
          <p>注册即表示同意我们的服务条款</p>
          <p style={{ marginTop: 4 }}>您的数据将被安全存储并仅您可访问</p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage