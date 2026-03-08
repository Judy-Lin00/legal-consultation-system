import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { api } from '../api/axios'
import { useDispatch } from 'react-redux'
import { setAuth } from '../store/slices/authSlice'
import './Auth.css'

const INTRO_TEXT = `智能法律咨询系统，基于大语言模型，为您提供专业、高效的法律问题解答。

从合同审查到法规解读，从劳动纠纷到知识产权，覆盖多领域法律知识。

让法律知识触手可及，让专业建议随时相伴。`

function Typewriter({ text, speed = 50 }) {
  const [display, setDisplay] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index >= text.length) return
    const timer = setTimeout(() => {
      setDisplay((prev) => prev + text[index])
      setIndex((i) => i + 1)
    }, speed)
    return () => clearTimeout(timer)
  }, [index, text, speed])

  return (
    <div className="login-typewriter">
      <span>{display}</span>
      <span className="login-cursor">|</span>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      message.warning('请填写邮箱和密码')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      dispatch(setAuth({ token: data.access_token, user: data.user }))
      message.success('登录成功')
      navigate('/consultation')
    } catch (err) {
      message.error(err.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="grid-pattern" />
      </div>

      <div className="login-layout">
        <aside className="login-left">
          <Link to="/" className="login-back" target="_self" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回首页
          </Link>
          <div className="login-intro">
            <h2 className="login-intro-title">法律咨询系统</h2>
            <Typewriter text={INTRO_TEXT} speed={40} />
          </div>
        </aside>

        <main className="login-right">
          <h1 className="login-title">登录</h1>
          <p className="login-subtitle">使用您的账号登录</p>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱"
                autoComplete="email"
              />
            </div>
            <div className="login-field">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
          <p className="login-switch">
            还没有账号？<Link to="/register" target="_self" rel="noopener">立即注册</Link>
          </p>
        </main>
      </div>
    </div>
  )
}
