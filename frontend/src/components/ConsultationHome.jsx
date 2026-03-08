/**
 * 登录后主页面：仅显示三个功能按钮，点击后跳转对应页面
 */
import { useNavigate } from 'react-router-dom'
import { RobotOutlined, AuditOutlined, FileTextOutlined } from '@ant-design/icons'
import './ConsultationHome.css'

const TABS = [
  { key: 'consult', label: 'AI智能咨询', icon: RobotOutlined, desc: '智能问答，解答法律问题' },
  { key: 'case', label: '案情咨询', icon: AuditOutlined, desc: '案情分析，生成摘要与建议' },
  { key: 'draft', label: '文书起草', icon: FileTextOutlined, desc: '生成起诉状、申请书等文书' },
]

export default function ConsultationHome() {
  const navigate = useNavigate()

  const handleSelect = (key) => {
    navigate(`/consultation?tab=${key}`, { replace: true })
  }

  return (
    <div className="consult-home">
      <p className="consult-home-title">请选择您需要的服务</p>
      <div className="consult-home-grid">
        {TABS.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            type="button"
            className="consult-home-card"
            onClick={() => handleSelect(key)}
          >
            <div className="consult-home-card-icon">
              <Icon />
            </div>
            <span className="consult-home-card-label">{label}</span>
            <span className="consult-home-card-desc">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
