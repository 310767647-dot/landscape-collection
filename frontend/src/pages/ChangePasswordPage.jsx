import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/ConfirmModal'

function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [mode, setMode] = useState('password') // 'password' or 'sms'
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    phone: '',
    code: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const sendSmsCode = async () => {
    if (!formData.phone.trim()) {
      setError('请输入手机号')
      return
    }

    setIsLoading(true)
    try {
      const response = await api.post('/send-sms-code', {
        phone: formData.phone.trim()
      })
      if (response.data.success) {
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        showToast('验证码已发送')
      } else {
        setError(response.data.error || '发送失败')
      }
    } catch (err) {
      setError(err.response?.data?.error || '发送失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.newPassword) {
      setError('请输入新密码')
      return
    }

    if (formData.newPassword.length < 6) {
      setError('密码至少需要6个字符')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setIsLoading(true)

    try {
      let response
      if (mode === 'password') {
        if (!formData.oldPassword) {
          setError('请输入原密码')
          setIsLoading(false)
          return
        }

        response = await api.post('/change-password', {
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        })
      } else {
        if (!formData.code) {
          setError('请输入验证码')
          setIsLoading(false)
          return
        }

        response = await api.post('/change-password-sms', {
          phone: formData.phone.trim(),
          code: formData.code,
          newPassword: formData.newPassword
        })
      }

      if (response.data.success) {
        setShowSuccess(true)
      } else {
        setError(response.data.error || '修改失败')
      }
    } catch (err) {
      console.error('Change password error:', err)
      setError(err.response?.data?.error || '修改失败')
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message) => {
    const toast = document.createElement('div')
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999;
    `
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ padding: '20px', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 14,
            cursor: 'pointer'
          }}
        >
          ← 返回
        </button>
        <h1 style={{ fontSize: 20, textAlign: 'center', flex: 1, margin: 0 }}>修改密码</h1>
        <div style={{ width: 80 }}></div>
      </div>

      <div className="page-content" style={{ flex: 1, paddingTop: 20 }}>
        <div className="form-section">
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => {
                setMode('password')
                setFormData({ oldPassword: '', newPassword: '', confirmPassword: '', phone: '', code: '' })
                setError('')
              }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: mode === 'password' ? '2px solid #667eea' : '1px solid #ddd',
                backgroundColor: mode === 'password' ? '#667eea' : 'white',
                color: mode === 'password' ? 'white' : '#666',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              原密码验证
            </button>
            <button
              onClick={() => {
                setMode('sms')
                setFormData({ oldPassword: '', newPassword: '', confirmPassword: '', phone: '', code: '' })
                setError('')
              }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: mode === 'sms' ? '2px solid #667eea' : '1px solid #ddd',
                backgroundColor: mode === 'sms' ? '#667eea' : 'white',
                color: mode === 'sms' ? 'white' : '#666',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              短信验证
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'password' && (
              <div className="form-row">
                <label className="form-label">原密码 *</label>
                <input
                  type="password"
                  className="form-input"
                  name="oldPassword"
                  value={formData.oldPassword}
                  onChange={handleChange}
                  placeholder="请输入原密码"
                  autoComplete="current-password"
                />
              </div>
            )}

            {mode === 'sms' && (
              <>
                <div className="form-row">
                  <label className="form-label">注册手机号 *</label>
                  <input
                    type="tel"
                    className="form-input"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="请输入注册手机号"
                    defaultValue={user?.phone}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">验证码 *</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      className="form-input"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="请输入验证码"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={sendSmsCode}
                      disabled={isLoading || countdown > 0}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: countdown > 0 ? '#ccc' : '#667eea',
                        color: 'white',
                        fontSize: 14,
                        cursor: countdown > 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="form-row">
              <label className="form-label">新密码 *</label>
              <input
                type="password"
                className="form-input"
                name="newPassword"
                value={formData.newPassword}
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
                placeholder="再次输入新密码"
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
              {isLoading ? '修改中...' : '确认修改'}
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal
        show={showSuccess}
        title="修改成功"
        message="密码修改成功，请重新登录"
        onConfirm={() => {
          logout()
          navigate('/login')
        }}
        onCancel={() => setShowSuccess(false)}
      />
    </div>
  )
}

export default ChangePasswordPage
