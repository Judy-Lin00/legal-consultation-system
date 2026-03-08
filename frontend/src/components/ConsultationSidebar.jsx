import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusOutlined, LeftOutlined, RightOutlined, MessageOutlined, ToolOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { api } from '../api/axios'
import {
  newConversation,
  setCurrentSession,
  setSessions,
} from '../store/slices/consultationSlice'
import './ConsultationSidebar.css'

export default function ConsultationSidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { sessions, currentSessionId, sessionsRefetchTrigger } = useSelector((state) => state.consultation)
  const { user } = useSelector((state) => state.auth)
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [historyTab, setHistoryTab] = useState('consult') // 'consult' | 'case' | 'draft'

  const fetchSessions = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await api.get('/api/sessions')
      dispatch(setSessions(res.data.sessions || []))
    } catch {
      dispatch(setSessions([]))
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    if (!user) return
    setDocumentsLoading(true)
    try {
      const res = await api.get('/api/document/list')
      setDocuments(res.data.documents || [])
    } catch {
      setDocuments([])
    } finally {
      setDocumentsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [user, sessionsRefetchTrigger])

  useEffect(() => {
    fetchDocuments()
  }, [user])

  useEffect(() => {
    const handler = () => fetchDocuments()
    window.addEventListener('documents:refetch', handler)
    return () => window.removeEventListener('documents:refetch', handler)
  }, [])

  const handleNewConversation = () => {
    dispatch(newConversation())
  }

  const handleSelectSession = async (sessionId) => {
    if (sessionId === currentSessionId) return
    try {
      const res = await api.get(`/api/sessions/${sessionId}`)
      const caseSessionState = res.data.case_status ? {
        type: res.data.case_status === 'summary_pending' ? 'summary' : res.data.case_status === 'analysis_done' ? 'analysis' : null,
        case_status: res.data.case_status,
        case_summary: res.data.case_summary,
        case_input: res.data.case_input,
        action_options: res.data.action_options,
        analysis: res.data.analysis_result,
      } : null
      dispatch(setCurrentSession({
        sessionId: res.data.session_id,
        messages: res.data.messages || [],
        caseSessionState,
      }))
      if (caseSessionState) {
        window.dispatchEvent(new Event('session:case-loaded'))
      }
    } catch {
      // ignore
    }
  }

  const consultSessions = (sessions || []).filter((s) => !s.case_status)
  const caseSessions = (sessions || []).filter((s) => s.case_status)

  const handleDownloadDocument = async (docId) => {
    try {
      const res = await api.get(`/api/document/download/${docId}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `legal_document_${docId.slice(0, 8)}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // ignore
    }
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      return d.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return ''
    }
  }

  return (
    <aside className={`consult-sidebar ${collapsed ? 'consult-sidebar-collapsed' : ''}`}>
      <div className="consult-sidebar-header">
        <div className="consult-sidebar-logo">
          <span className="consult-sidebar-logo-icon">⚖</span>
          {!collapsed && <span className="consult-sidebar-logo-text">法律咨询系统</span>}
        </div>
        <button
          type="button"
          className="consult-sidebar-toggle"
          onClick={onToggle}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <RightOutlined /> : <LeftOutlined />}
        </button>
      </div>

      {!collapsed && (
        <>
          <button
            type="button"
            className="consult-sidebar-new"
            onClick={handleNewConversation}
          >
            <PlusOutlined />
            新建对话
          </button>

          <nav className="consult-sidebar-nav">
            <button
              type="button"
              className="consult-sidebar-nav-item"
              title="选择法律服务"
              onClick={() => navigate('/consultation')}
            >
              <ToolOutlined />
              <div>
                <span>法律工具</span>
                <small>在线工具帮你解决法律问题</small>
              </div>
            </button>
            <div className="consult-sidebar-nav-item" title="功能开发中">
              <SearchOutlined />
              <div>
                <span>案例检索</span>
                <small>在线为您查找相关的案例</small>
              </div>
            </div>
            <div className="consult-sidebar-nav-item" title="功能开发中">
              <FileTextOutlined />
              <div>
                <span>我的报告</span>
                <small>查看历史产生的所有报告</small>
              </div>
            </div>
          </nav>

          <div className="consult-sidebar-history">
            <div className="consult-sidebar-history-tabs">
              <button
                type="button"
                className={`consult-sidebar-history-tab ${historyTab === 'consult' ? 'active' : ''}`}
                onClick={() => setHistoryTab('consult')}
              >
                咨询记录
              </button>
              <button
                type="button"
                className={`consult-sidebar-history-tab ${historyTab === 'case' ? 'active' : ''}`}
                onClick={() => setHistoryTab('case')}
              >
                案情记录
              </button>
              <button
                type="button"
                className={`consult-sidebar-history-tab ${historyTab === 'draft' ? 'active' : ''}`}
                onClick={() => setHistoryTab('draft')}
              >
                文书记录
              </button>
            </div>
            <div className="consult-sidebar-history-list">
              {!user ? (
                <p className="consult-sidebar-history-empty">请登录后查看历史记录</p>
              ) : historyTab === 'consult' ? (
                loading ? (
                  <p className="consult-sidebar-history-empty">加载中...</p>
                ) : consultSessions.length === 0 ? (
                  <p className="consult-sidebar-history-empty">暂无咨询记录</p>
                ) : (
                  consultSessions.map((s) => (
                    <button
                      key={s.session_id}
                      type="button"
                      className={`consult-sidebar-history-item ${currentSessionId === s.session_id ? 'active' : ''}`}
                      onClick={() => handleSelectSession(s.session_id)}
                    >
                      <MessageOutlined className="consult-sidebar-history-icon" />
                      <div className="consult-sidebar-history-content">
                        <span className="consult-sidebar-history-title-text">{s.title}</span>
                        <span className="consult-sidebar-history-time">{formatTime(s.updated_at || s.created_at)}</span>
                      </div>
                    </button>
                  ))
                )
              ) : historyTab === 'case' ? (
                loading ? (
                  <p className="consult-sidebar-history-empty">加载中...</p>
                ) : caseSessions.length === 0 ? (
                  <p className="consult-sidebar-history-empty">暂无案情记录</p>
                ) : (
                  caseSessions.map((s) => (
                    <button
                      key={s.session_id}
                      type="button"
                      className={`consult-sidebar-history-item ${currentSessionId === s.session_id ? 'active' : ''}`}
                      onClick={() => handleSelectSession(s.session_id)}
                    >
                      <MessageOutlined className="consult-sidebar-history-icon" />
                      <div className="consult-sidebar-history-content">
                        <span className="consult-sidebar-history-title-text">{s.title}</span>
                        <span className="consult-sidebar-history-time">{formatTime(s.updated_at || s.created_at)}</span>
                      </div>
                    </button>
                  ))
                )
              ) : (
                documentsLoading ? (
                  <p className="consult-sidebar-history-empty">加载中...</p>
                ) : documents.length === 0 ? (
                  <p className="consult-sidebar-history-empty">暂无文书记录</p>
                ) : (
                  documents.map((d) => (
                    <button
                      key={d.doc_id}
                      type="button"
                      className="consult-sidebar-history-item"
                      onClick={() => handleDownloadDocument(d.doc_id)}
                    >
                      <FileTextOutlined className="consult-sidebar-history-icon" />
                      <div className="consult-sidebar-history-content">
                        <span className="consult-sidebar-history-title-text">{d.title}</span>
                        <span className="consult-sidebar-history-time">{formatTime(d.created_at)}</span>
                      </div>
                    </button>
                  ))
                )
              )}
            </div>
          </div>

          {!user && (
            <div className="consult-sidebar-login-wrap">
              <Link to="/login" className="consult-sidebar-login-link" target="_self" rel="noopener">
                登录
              </Link>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
