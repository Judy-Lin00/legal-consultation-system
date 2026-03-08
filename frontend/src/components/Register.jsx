import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { api } from '../api/axios'
import { useDispatch } from 'react-redux'
import { setAuth } from '../store/slices/authSlice'
import './Auth.css'

export default function Register() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !username.trim() || !password || !confirmPassword) {
      message.warning('请填写完整信息')
      return
    }
    if (password.length < 6) {
      message.warning('密码至少 6 位')
      return
    }
    if (password !== confirmPassword) {
      message.warning('两次密码不一致')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/register', { email, username, password })
      dispatch(setAuth({ token: data.access_token, user: data.user }))
      message.success('注册成功')
      navigate('/consultation')
    } catch (err) {
      message.error(err.response?.data?.detail || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="grid-pattern" />
      </div>
      <div className="auth-card">
        <Link to="/" className="auth-back" target="_self" rel="noopener">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          返回首页
        </Link>
        <h1 className="auth-title">注册</h1>
        <p className="auth-subtitle">创建账号，开始使用智能法律咨询</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2-32 个字符"
              autoComplete="username"
              minLength={2}
              maxLength={32}
            />
          </div>
          <div className="auth-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoComplete="new-password"
            />
          </div>
          <div className="auth-field">
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="auth-switch">
          已有账号？<Link to="/login" target="_self" rel="noopener">立即登录</Link>
        </p>
      </div>
    </div>
  )
}
