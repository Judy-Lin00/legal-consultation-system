import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../store/slices/authSlice'
import './LandingPage.css'

function LandingPage() {
  const { user } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  const heroRef = useRef(null)
  const featuresRef = useRef(null)
  const [visibleSections, setVisibleSections] = useState({ hero: false, features: false })

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => ({ ...prev, [entry.target.dataset.section]: true }))
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    )

    heroRef.current && observer.observe(heroRef.current)
    featuresRef.current && observer.observe(featuresRef.current)

    setVisibleSections((prev) => ({ ...prev, hero: true }))

    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="header-inner">
          <Link to="/" className="logo" target="_self" rel="noopener">
            <span className="logo-icon">⚖</span>
            <span>法律咨询系统</span>
          </Link>
          {user ? (
            <div className="header-user">
              <span className="header-username">{user.username}</span>
              <button type="button" className="btn-logout" onClick={() => dispatch(logout())}>
                退出
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-login" target="_self" rel="noopener">登录</Link>
          )}
        </div>
      </header>

      <main>
        <section ref={heroRef} data-section="hero" className={`hero ${visibleSections.hero ? 'visible' : ''}`}>
          <div className="hero-bg">
            <div className="gradient-orb orb-1" />
            <div className="gradient-orb orb-2" />
            <div className="grid-pattern" />
          </div>
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="line line-1">智能法律咨询</span>
              <span className="line line-2">触手可及</span>
            </h1>
            <p className="hero-subtitle">
              基于大语言模型的法律助手，为您提供专业、高效的法律问题解答。
              从合同审查到法规解读，让法律知识不再遥不可及。
            </p>
            <Link to="/consultation" className="btn-cta" target="_self" rel="noopener">
              <span>开始咨询</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>

        <section ref={featuresRef} data-section="features" className={`features ${visibleSections.features ? 'visible' : ''}`}>
          <h2 className="features-title">为什么选择我们</h2>
          <div className="features-grid">
            <article className="feature-card" style={{ transitionDelay: '0ms' }}>
              <div className="feature-icon">🤖</div>
              <h3>AI 驱动</h3>
              <p>依托先进的法律大模型，提供准确、专业的法律建议，覆盖多领域法律知识。</p>
            </article>
            <article className="feature-card" style={{ transitionDelay: '100ms' }}>
              <div className="feature-icon">⚡</div>
              <h3>即时响应</h3>
              <p>无需等待，输入问题即可获得解答。支持文字、语音输入，满足多种使用场景。</p>
            </article>
            <article className="feature-card" style={{ transitionDelay: '200ms' }}>
              <div className="feature-icon">🔒</div>
              <h3>安全可靠</h3>
              <p>对话记录本地存储，保护您的隐私。专业级安全架构，让咨询更安心。</p>
            </article>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-content">
            <h2>准备好开始了吗？</h2>
            <p>立即体验智能法律咨询，让专业法律建议随时相伴。</p>
            <Link to="/consultation" className="btn-cta btn-cta-secondary" target="_self" rel="noopener">
              免费开始咨询
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© 2025 法律咨询系统 · 基于 React + FastAPI + 法律大模型</p>
      </footer>
    </div>
  )
}

export default LandingPage
