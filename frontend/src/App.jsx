import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useSearchParams } from 'react-router-dom'
import { Layout, Typography } from 'antd'
import { useDispatch } from 'react-redux'
import { logout } from './store/slices/authSlice'
import { AccessibilityProvider, useAccessibility } from './contexts/AccessibilityContext'
import LandingPage from './components/LandingPage'
import ConsultationChat from './components/ConsultationChat'
import ConsultationSidebar from './components/ConsultationSidebar'
import ConsultationHome from './components/ConsultationHome'
import Login from './components/Login'
import Register from './components/Register'
import './App.css'

function AuthSync() {
  const dispatch = useDispatch()
  useEffect(() => {
    const handler = () => dispatch(logout())
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [dispatch])
  return null
}

const { Header, Content } = Layout
const { Title } = Typography

const VALID_TABS = ['consult', 'case', 'draft']

function ConsultationPage() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const hasTab = tab && VALID_TABS.includes(tab)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { settings, setTextSize } = useAccessibility()

  return (
    <Layout className="consultation-layout" style={{ minHeight: '100vh' }} data-text-size={settings.textSize}>
      <Header className="consultation-header" style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Title level={3} className="consultation-header-title" style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
          法律咨询系统
        </Title>
        <div className="consultation-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span className="consultation-header-font-label" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8125rem' }}>字号：</span>
          {['small', 'medium', 'large'].map((s) => (
            <button
              key={s}
              type="button"
              className="consultation-header-font-btn"
              onClick={() => setTextSize(s)}
              style={{
                padding: '0.125rem 0.5rem',
                fontSize: '0.75rem',
                color: settings.textSize === s ? '#001529' : 'rgba(255,255,255,0.9)',
                background: settings.textSize === s ? '#fff' : 'transparent',
                border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
            </button>
          ))}
          <Link to="/" className="consultation-header-link" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', textDecoration: 'none' }} target="_self" rel="noopener">返回首页</Link>
        </div>
      </Header>
      <Layout
        style={{
          flexDirection: 'row',
          height: 'calc(100vh - 64px)',
          overflow: 'hidden',
        }}
      >
        {hasTab && (
          <ConsultationSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
          />
        )}
        <Content
          className="consultation-content"
          style={{
            padding: 0,
            background: hasTab ? '#f5f7fa' : '#0d1117',
            overflow: hasTab ? 'hidden' : 'auto',
            flex: 1,
            minWidth: 0,
            display: hasTab ? 'flex' : undefined,
            flexDirection: hasTab ? 'column' : undefined,
          }}
        >
          {hasTab ? <ConsultationChat initialTab={tab} /> : <ConsultationHome />}
        </Content>
      </Layout>
    </Layout>
  )
}

function AppRoot({ children }) {
  const { settings } = useAccessibility()
  return <div data-text-size={settings.textSize} style={{ minHeight: '100vh' }}>{children}</div>
}

function App() {
  return (
    <AccessibilityProvider>
    <BrowserRouter>
      <AppRoot>
        <AuthSync />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/consultation" element={<ConsultationPage />} />
        </Routes>
      </AppRoot>
    </BrowserRouter>
    </AccessibilityProvider>
  )
}

export default App
