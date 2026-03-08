/**
 * ConsultationChat.jsx - 法律咨询聊天组件
 *
 * 本文件实现了一个法律咨询聊天界面，包含：
 * 1. AI 智能咨询（用户提问，AI 回答）
 * 2. 文书起草（如离婚起诉状）
 * 3. 语音输入（通过浏览器语音识别 API）
 * 4. 建议问题推荐
 */

// ========== 第一部分：引入依赖 ==========

// 从 React 库引入三个核心 Hook（钩子函数）
// useState：用于在组件中保存和更新数据（状态）
// useRef：用于保存一个在组件整个生命周期内不变的可变引用，常用于 DOM 或实例
// useEffect：用于在组件渲染后执行副作用（如请求数据、订阅事件、清理资源）
import { useState, useRef, useEffect } from 'react'

// 从 antd（Ant Design）组件库引入 message 方法
// message 用于在页面上弹出轻量级提示（成功、警告、错误等）
import { message } from 'antd'

// 从 antd 的图标库引入多个图标组件
// 这些图标会用在按钮、标签等 UI 元素上
import { SendOutlined, SyncOutlined, MessageOutlined, AudioOutlined, StopOutlined, RobotOutlined, FileTextOutlined, AuditOutlined, DownloadOutlined, LoadingOutlined, SoundOutlined } from '@ant-design/icons'

// 从 react-redux 引入两个 Hook
// useDispatch：获取 dispatch 函数，用于向 Redux 仓库派发动作（更新全局状态）
// useSelector：从 Redux 仓库中读取状态数据
import { useDispatch, useSelector } from 'react-redux'

// 从本项目的 consultationSlice 引入多个 action 和选择器
// addMessage：添加一条聊天消息
// setLoading：设置加载状态（true/false）
// setError：设置错误信息
// setCurrentSessionId：设置当前会话 ID
// setCurrentComplaintId：设置当前起诉状 ID
// triggerSessionsRefetch：触发会话列表重新获取
// getCurrentMessages：获取当前会话的消息列表
import { addMessage, updateLastMessageContent, setLoading, setError, setCurrentSessionId, setCurrentComplaintId, setCaseSessionState, triggerSessionsRefetch, getCurrentMessages } from '../store/slices/consultationSlice'

// 引入封装好的 axios 实例，用于发送 HTTP 请求到后端 API
import { api } from '../api/axios'

// 引入本组件的样式文件，定义聊天界面的外观
import './ConsultationChat.css'

// ========== 第二部分：常量定义 ==========

// 离婚起诉状的默认提示模板
// 用户选择「离婚纠纷起诉状」时，输入框会预填这段文字，引导用户填写案情
const DIVORCE_COMPLAINT_PROMPT =
  '我需要你帮我起草一篇民事起诉状，案情概要是【您可以填写具体的案情内容，包括时间、地点、具体事项、金额、争议焦点等】，起草要求是【请说明您的起草要求】'

// 文书模板列表，与后端 document_service 的 DOC_TEMPLATES 对应
const DOCUMENT_TEMPLATES = [
  { id: 1, templateKey: 'divorce', title: '离婚纠纷起诉状', desc: '适用于离婚诉讼，包含财产分割、子女抚养等要素', recent: true },
  { id: 2, templateKey: 'lending', title: '民间借贷起诉状', desc: '适用于民间借贷纠纷，包含借款事实、利息约定等要素', recent: false },
  { id: 3, templateKey: 'labor', title: '劳动仲裁申请书', desc: '适用于劳动争议，包含劳动关系、诉求事项等要素', recent: true },
  { id: 4, templateKey: 'traffic', title: '交通事故赔偿起诉状', desc: '适用于交通事故人身损害赔偿，包含事故经过、损失清单等', recent: false },
]

// 建议问题列表，是一个二维数组
// 每一组包含 3 个建议问题，点击「换一换」会切换到下一组
// 每个问题有 q（问题文本）和 tag（分类标签）
const SUGGESTED_QUESTIONS = [
  [
    { q: '房贷月供简单易懂的计算方法', tag: '办事指南' },
    { q: '房屋租赁纠纷起诉书应包含哪些内容？', tag: '房产问题' },
    { q: '无接触交通事故，责任应如何划分？', tag: '交通运输' },
  ],
  [
    { q: '男子上班途中回微信突发心梗死亡算工伤吗？', tag: '劳动工伤' },
    { q: '骗了电诈团伙骗来的钱，违法吗？', tag: '刑事案件' },
    { q: '劳动合同解除后经济补偿如何计算？', tag: '劳动用工' },
  ],
  [
    { q: '民间借贷利息上限是多少？', tag: '债权债务' },
    { q: '离婚时房产如何分割？', tag: '婚姻家庭' },
    { q: '试用期被辞退有补偿吗？', tag: '劳动用工' },
  ],
]

// 获取浏览器的语音识别 API
// 标准写法是 window.SpeechRecognition，Chrome/Safari 等使用 webkit 前缀：window.webkitSpeechRecognition
// 若浏览器不支持，则 SpeechRecognition 为 undefined
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

// ========== 第三部分：组件定义 ==========

// 使用 export default 导出组件，这样其他文件可以 import ConsultationChat 使用
export default function ConsultationChat({ initialTab = 'consult' }) {
  // ----- 状态（State）定义 -----
  // 使用 useState 创建可变化的数据，React 会在数据变化时重新渲染组件

  // input：用户输入框中的文字内容
  const [input, setInput] = useState('')

  // suggestIndex：当前显示的建议问题组的索引，用于「换一换」功能
  const [suggestIndex, setSuggestIndex] = useState(0)

  // isRecording：是否正在录音（语音识别中）
  const [isRecording, setIsRecording] = useState(false)

  // activeTab：当前选中的标签页，'consult' 表示 AI 咨询，'draft' 表示文书起草
  const [activeTab, setActiveTab] = useState(initialTab) // 'consult' | 'draft' | 'case'
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  // selectedTemplate：当前选中的文书模板，如 'divorce' 或 null
  const [selectedTemplate, setSelectedTemplate] = useState(null) // 'divorce' | null

  // 文书生成流程状态（按 mermaid 流程图）
  const [docFlowMode, setDocFlowMode] = useState('document') // 'document' | 'complaint'（complaint=从侧边栏起诉状进入）
  const [docStep, setDocStep] = useState('check') // check|select_case|input_case|supplement|select_template|preview|done
  const [docSessions, setDocSessions] = useState([])
  const [docSelectedSessionId, setDocSelectedSessionId] = useState(null)
  const [docCaseInput, setDocCaseInput] = useState('')
  const [docSupplementQuestions, setDocSupplementQuestions] = useState([])
  const [docTemplates, setDocTemplates] = useState([])
  const [docGenerateResult, setDocGenerateResult] = useState(null) // { draft, missing_fields, doc_id, can_download }
  const [docEditableDraft, setDocEditableDraft] = useState('') // 文书初稿可编辑正文
  const [docCurrentTemplateKey, setDocCurrentTemplateKey] = useState('') // 当前文书的模板 key（用于导出 DOCX）

  // recognitionRef：使用 useRef 保存语音识别实例的引用
  // useRef 返回的对象在组件整个生命周期内保持不变，修改 .current 不会触发重新渲染
  const recognitionRef = useRef(null)

  // ----- 从 Redux 读取全局状态 -----

  // messages：当前会话的聊天消息列表
  const messages = useSelector(getCurrentMessages)

  // 从 consultation 状态中解构出 loading、currentSessionId、currentComplaintId
  const { loading, currentSessionId, currentComplaintId, caseSessionState } = useSelector((state) => state.consultation)

  // dispatch：用于派发 action 到 Redux，从而更新全局状态
  const dispatch = useDispatch()

  // suggestions：根据 suggestIndex 取模，循环获取当前要显示的建议问题组
  // 例如 suggestIndex 为 4 时，4 % 3 = 1，取第二组
  const suggestions = SUGGESTED_QUESTIONS[suggestIndex % SUGGESTED_QUESTIONS.length]

  /** 语音旁白：朗读/暂停（再次点击可暂停） */
  const handleReadAloud = () => {
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel()
      message.info('已暂停朗读')
      return
    }
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    let text = (lastAssistant?.content || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n/g, ' ')
      .trim()
    if (!text) {
      message.info('暂无可朗读的内容')
      return
    }
    if (!window.speechSynthesis) {
      message.warning('当前浏览器不支持语音朗读')
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = 0.95
    window.speechSynthesis.speak(u)
    message.success('开始朗读')
  }

  // ========== 第四部分：事件处理函数 ==========

  /**
   * handleSubmit - 提交用户输入（发送消息或创建起诉状）
   * @param {string} [text] - 可选，若传入则使用该文本，否则使用 input 状态
   */
  const handleSubmit = async (text) => {
    // 获取要发送的内容：优先使用传入的 text，否则用 input；trim() 去除首尾空格
    const content = (text || input).trim()

    // 若内容为空，直接返回，不执行后续逻辑
    if (!content) return

    // 派发 setLoading(true)，让界面显示加载状态（如「正在思考...」）
    dispatch(setLoading(true))

    // 清除之前的错误信息
    dispatch(setError(null))

    // 若当前在「文书起草」标签且选中的是离婚起诉状模板
    if (activeTab === 'draft' && selectedTemplate === 'divorce') {
      try {
        // 若已有 currentComplaintId，说明是在已有起诉状上添加新版本
        if (currentComplaintId) {
          // 调用后端 API：POST /api/divorce-complaints/:id/versions，传入 raw_input
          await api.post(`/api/divorce-complaints/${currentComplaintId}/versions`, { raw_input: content })

          // 清空输入框
          setInput('')

          // 清除当前起诉状 ID
          dispatch(setCurrentComplaintId(null))

          // 弹出成功提示
          message.success('已添加新版本')
        } else {
          // 否则是创建新的离婚起诉状
          // POST /api/divorce-complaints，传入 raw_input 和可选的 session_id
          const res = await api.post('/api/divorce-complaints', {
            raw_input: content,
            session_id: currentSessionId || undefined,
          })

          // 清空输入框
          setInput('')

          // 显示成功提示，并展示版本数量
          message.success(`离婚起诉状已创建，共 ${res.data.versions?.length || 1} 个版本`)
        }

        // 触发会话列表重新获取，以便侧边栏显示最新数据
        dispatch(triggerSessionsRefetch())

        // 向 window 派发自定义事件，通知其他组件（如侧边栏）刷新离婚起诉状列表
        window.dispatchEvent(new Event('divorce-complaints:refetch'))
      } catch (err) {
        // 捕获请求失败的错误
        const detail = err?.response?.data?.detail

        // 若状态码为 401，说明未登录
        if (err?.response?.status === 401) {
          message.warning('请先登录后再创建离婚起诉状')
        } else {
          // 其他错误，显示后端返回的 detail 或默认提示
          message.error(detail || '创建失败，请检查网络或 API 配置')
        }
      } finally {
        // 无论成功或失败，都要关闭加载状态
        dispatch(setLoading(false))
      }

      // 文书起草逻辑结束，直接 return，不执行下面的咨询逻辑
      return
    }

    // ----- 案情咨询流程（按流程图） -----
    if (activeTab === 'case') {
      const isConfirmLike = /^(确认|无误|正确|可以|确认无误)$/.test(content.trim()) || (content.includes('确认') && content.length < 20)
      if (isConfirmLike && (caseSessionState?.case_summary || caseSessionState?.case_status === 'summary_pending')) {
        handleCaseAction('确认')
        return
      }
      dispatch(addMessage({ role: 'user', content }))
      setInput('')
      try {
        const res = await api.post('/api/case-consult', {
          user_input: content,
          session_id: currentSessionId || undefined,
        })
        dispatch(addMessage({ role: 'assistant', content: res.data.message }))
        dispatch(setCaseSessionState({
          type: res.data.type,
          case_status: res.data.case_status,
          case_summary: res.data.case_summary,
          case_input: res.data.case_input,
          action_options: res.data.action_options,
          analysis: res.data.analysis,
        }))
        if (res.data.session_id) {
          dispatch(setCurrentSessionId(res.data.session_id))
          dispatch(triggerSessionsRefetch())
        }
      } catch (err) {
        dispatch(setError(err?.message))
        message.error(err?.response?.data?.detail || '请求失败')
      } finally {
        dispatch(setLoading(false))
      }
      return
    }

    // ----- 以下是 AI 咨询逻辑（流式输出，减少等待焦虑） -----

    dispatch(addMessage({ role: 'user', content }))
    setInput('')

    // 先添加空回复占位，流式更新
    dispatch(addMessage({ role: 'assistant', content: '' }))

    try {
      const token = localStorage.getItem('token')
      const baseUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${baseUrl}/api/consult/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: content,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          session_id: currentSessionId || undefined,
        }),
      })
      if (!res.ok) throw new Error(res.statusText)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') continue
            try {
              const data = JSON.parse(raw)
              if (data.content) {
                fullContent += data.content
                dispatch(updateLastMessageContent(fullContent))
              }
              if (data.session_id) {
                dispatch(setCurrentSessionId(data.session_id))
                dispatch(triggerSessionsRefetch())
              }
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      const errMsg = err?.message || '请求失败，请检查网络或 API 配置'
      dispatch(updateLastMessageContent(errMsg))
      message.error('请求失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  /** 案情咨询：用户点击「确认」或选择后续操作（文书生成/行动指引/风险评估） */
  const handleCaseAction = async (action) => {
    if (action === '文书生成') {
      setActiveTab('draft')
      setDocFlowMode('document')
      setDocStep('select_template')
      setDocSelectedSessionId(currentSessionId)
      setDocCaseInput('')
      setDocSupplementQuestions([])
      setDocGenerateResult(null)
      return
    }
    const isConfirm = action === '确认'
    const content = isConfirm ? '确认无误' : action
    dispatch(addMessage({ role: 'user', content }))
    dispatch(setLoading(true))
    try {
      const payload = {
        user_input: content,
        session_id: currentSessionId || undefined,
        action: isConfirm ? undefined : action,
      }
      // 确认时务必传 client_*，便于后端识别为确认而非普通输入（未登录或 DB 未同步时依赖此）
      const inSummaryPending = caseSessionState?.case_status === 'summary_pending' || caseSessionState?.type === 'summary'
      const lastAssistantHasConfirm = messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content?.includes?.('请确认是否准确')
      if (isConfirm && (inSummaryPending || lastAssistantHasConfirm)) {
        payload.client_case_status = 'summary_pending'
        payload.client_case_summary = caseSessionState?.case_summary || (lastAssistantHasConfirm ? messages[messages.length - 1]?.content : '') || ''
        payload.client_case_input = caseSessionState?.case_input || ''
      }
      const res = await api.post('/api/case-consult', payload)
      dispatch(addMessage({ role: 'assistant', content: res.data.message }))
      dispatch(setCaseSessionState({
        type: res.data.type,
        case_status: res.data.case_status,
        case_summary: res.data.case_summary ?? caseSessionState?.case_summary,
        case_input: res.data.case_input ?? caseSessionState?.case_input,
        action_options: res.data.action_options,
        analysis: res.data.analysis,
      }))
      if (res.data.session_id) dispatch(setCurrentSessionId(res.data.session_id))
      dispatch(triggerSessionsRefetch())
    } catch (err) {
      message.error(err?.response?.data?.detail || '请求失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  /** 文书生成：选择已有案情会话 */
  const handleDocSelectSession = (sessionId) => {
    setDocSelectedSessionId(sessionId)
    setDocStep('select_template')
  }

  /** 文书生成：检查案情是否足以支持（无已确认案情时） */
  const handleDocCheckCase = async () => {
    const content = (docCaseInput || input).trim()
    if (!content) {
      message.warning('请输入案情概要')
      return
    }
    setDocCaseInput(content)
    dispatch(setLoading(true))
    try {
      const res = await api.post('/api/document/check-case', { case_input: content })
      if (res.data?.sufficient) {
        setDocStep('select_template')
        setDocSupplementQuestions([])
      } else {
        setDocSupplementQuestions(res.data?.questions || [])
        setDocStep('supplement')
      }
    } catch (err) {
      message.error(err?.response?.data?.detail || '检查失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  /** 文书生成：用户补充信息后再次检查 */
  const handleDocSupplementSubmit = async () => {
    const supplement = input.trim()
    const content = supplement ? `${docCaseInput}\n\n${supplement}`.trim() : docCaseInput
    if (!content) return
    dispatch(setLoading(true))
    try {
      const res = await api.post('/api/document/check-case', { case_input: content })
      if (res.data?.sufficient) {
        setDocCaseInput(content)
        setInput('')
        setDocStep('select_template')
        setDocSupplementQuestions([])
      } else {
        setDocSupplementQuestions(res.data?.questions || [])
      }
    } catch (err) {
      message.error(err?.response?.data?.detail || '检查失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  /** 文书生成：选择模板并生成 */
  const handleDocGenerate = async (templateKey) => {
    dispatch(setLoading(true))
    setDocGenerateResult(null)
    setDocCurrentTemplateKey(templateKey)
    try {
      const payload = {
        template_key: templateKey,
        session_id: docSelectedSessionId || undefined,
        case_input: docCaseInput || undefined,
        case_summary: docCaseInput || undefined,
      }
      const res = await api.post('/api/document/generate', payload)
      setDocGenerateResult(res.data)
      setDocStep('preview')
      window.dispatchEvent(new Event('documents:refetch'))
    } catch (err) {
      message.error(err?.response?.data?.detail || '生成失败')
    } finally {
      dispatch(setLoading(false))
    }
  }

  /** 文书生成：下载 Word（使用用户编辑后的内容转为 DOCX） */
  const handleDocDownload = async () => {
    const text = (docEditableDraft || docGenerateResult?.draft || '').trim()
    if (!text) {
      message.warning('文书内容为空，无法导出')
      return
    }
    try {
      const res = await api.post('/api/document/export-docx', {
        draft_text: text,
        template_key: docCurrentTemplateKey || 'labor',
      }, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `legal_document_${Date.now()}.docx`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('下载完成')
    } catch (err) {
      message.error(err?.response?.data?.detail || '下载失败')
    }
  }

  /** 文书生成：重置流程 */
  const handleDocReset = () => {
    setDocStep('check')
    setDocSessions([])
    setDocSelectedSessionId(null)
    setDocCaseInput('')
    setDocSupplementQuestions([])
    setDocTemplates([])
    setDocGenerateResult(null)
    setDocEditableDraft('')
    setDocCurrentTemplateKey('')
  }

  /**
   * handleKeyDown - 键盘按下事件处理
   * 当用户按下 Cmd+Enter（Mac）或 Ctrl+Enter（Windows）时，触发发送
   */
  const handleKeyDown = (e) => {
    // e.key === 'Enter' 表示按下回车键
    // e.metaKey 在 Mac 上为 Command 键，e.ctrlKey 为 Ctrl 键
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      // 阻止默认行为（如换行），改为发送消息
      e.preventDefault()
      handleSubmit()
    }
  }

  /**
   * handleVoiceToggle - 语音输入开关
   * 点击麦克风按钮时：若未在录音则开始录音，若已在录音则停止
   */
  const handleVoiceToggle = () => {
    // 若浏览器不支持语音识别 API，弹出警告并返回
    if (!SpeechRecognition) {
      message.warning('当前浏览器不支持语音识别，请使用 Chrome 或 Edge')
      return
    }

    // 若当前正在录音，则停止录音并退出
    if (isRecording) {
      try {
        // 调用 recognition 的 stop 方法停止识别
        recognitionRef.current?.stop()
      } catch (_) {
        // 忽略 stop 可能抛出的异常
      }
      setIsRecording(false)
      return
    }

    // ----- 开始语音识别 -----

    // 创建语音识别实例
    const recognition = new SpeechRecognition()

    // 设置识别语言为简体中文
    recognition.lang = 'zh-CN'

    // continuous: true 表示持续识别，不会在用户停顿后自动停止
    recognition.continuous = true

    // interimResults: true 表示返回中间结果（未最终确定的识别结果）
    recognition.interimResults = true

    // onresult：当有识别结果时触发
    recognition.onresult = (e) => {
      let toAdd = ''
      // 遍历本次识别结果，从 resultIndex 开始到 results 末尾
      for (let i = e.resultIndex; i < e.results.length; i++) {
        // 只取最终结果（isFinal 为 true 的），避免重复添加中间结果
        if (e.results[i].isFinal) toAdd += e.results[i][0].transcript
      }
      // 若有新识别的文字，追加到输入框
      // setInput 传入函数时，prev 为上一次的 input 值，可避免闭包问题
      if (toAdd) setInput((prev) => (prev ? prev + toAdd : toAdd))
    }

    // onerror：识别出错时触发
    recognition.onerror = (e) => {
      // 'aborted' 表示用户主动停止，不显示错误
      if (e.error !== 'aborted') message.error('语音识别出错：' + (e.error || '未知'))
      setIsRecording(false)
    }

    // onend：识别结束时触发（如超时、用户停止等）
    recognition.onend = () => setIsRecording(false)

    // 将 recognition 实例保存到 ref，以便后续 stop 时使用
    recognitionRef.current = recognition

    // 开始语音识别
    recognition.start()

    // 更新录音状态，使按钮显示为「停止」图标
    setIsRecording(true)
  }

  // ========== 第五部分：副作用（useEffect） ==========

  // 组件卸载时的清理函数
  // useEffect 的返回值是一个函数，会在组件卸载时执行
  useEffect(() => () => {
    try {
      // 若语音识别还在进行，停止它，避免内存泄漏或后台继续录音
      recognitionRef.current?.stop()
    } catch (_) {}
  }, []) // 空依赖数组 [] 表示只在挂载和卸载时执行

  // 监听自定义事件 'complaint:selected'
  // 当用户从侧边栏选择某个起诉状时，会派发该事件，这里切换标签并填充输入框
  useEffect(() => {
    const handler = (e) => {
      setActiveTab('draft')
      setDocFlowMode('complaint')
      setSelectedTemplate('divorce')
      setInput(e.detail?.lastRawInput || DIVORCE_COMPLAINT_PROMPT)
    }
    window.addEventListener('complaint:selected', handler)
    return () => window.removeEventListener('complaint:selected', handler)
  }, [])

  useEffect(() => {
    const handler = () => setActiveTab('case')
    window.addEventListener('session:case-loaded', handler)
    return () => window.removeEventListener('session:case-loaded', handler)
  }, [])

  // 文书起草：进入 draft 且为 document 模式时，拉取已确认案情会话
  useEffect(() => {
    if (activeTab !== 'draft' || docFlowMode !== 'document') return
    if (docStep === 'select_template' && docSelectedSessionId) return // 从案情跳转，已有 session
    const fetchSessions = async () => {
      try {
        const res = await api.get('/api/document/sessions-with-case')
        const sessions = res.data?.sessions || []
        setDocSessions(sessions)
        if (sessions.length > 0 && docStep === 'check') {
          setDocStep('select_case')
        } else if (sessions.length === 0 && docStep === 'check') {
          setDocStep('input_case')
        }
      } catch (err) {
        if (err?.response?.status === 401) {
          setDocStep('input_case')
          setDocSessions([])
        } else {
          setDocStep('input_case')
          setDocSessions([])
        }
      }
    }
    fetchSessions()
  }, [activeTab, docFlowMode, docStep])

  // 文书起草：有选中 session 时拉取推荐模板
  useEffect(() => {
    if (activeTab !== 'draft' || docFlowMode !== 'document') return
    if (docStep !== 'select_template' || !docSelectedSessionId) return
    const fetchTemplates = async () => {
      try {
        const res = await api.post('/api/document/match-templates', { session_id: docSelectedSessionId })
        setDocTemplates(res.data?.templates || [])
      } catch (err) {
        message.error(err?.response?.data?.detail || '获取模板失败')
        setDocTemplates(DOCUMENT_TEMPLATES.map((t) => ({ key: t.templateKey, title: t.title, score: 0 })))
      }
    }
    fetchTemplates()
  }, [activeTab, docFlowMode, docStep, docSelectedSessionId])

  // 文书起草：从案情跳转时拉取模板（无 session_id 时用 case_summary）
  useEffect(() => {
    if (activeTab !== 'draft' || docFlowMode !== 'document') return
    if (docStep !== 'select_template') return
    if (docSelectedSessionId) return // 上面已处理
    if (!docCaseInput.trim()) return
    const fetchTemplates = async () => {
      try {
        const res = await api.post('/api/document/match-templates', { case_summary: docCaseInput })
        setDocTemplates(res.data?.templates || [])
      } catch (err) {
        setDocTemplates(DOCUMENT_TEMPLATES.map((t) => ({ key: t.templateKey, title: t.title, score: 0 })))
      }
    }
    fetchTemplates()
  }, [docStep, docCaseInput, docSelectedSessionId])

  //  Strip markdown for elderly/low-education users (left edit area also shows plain text)
  const stripMarkdown = (text) =>
    (text || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 文书初稿进入预览时，同步可编辑内容（已去除 Markdown 符号）
  useEffect(() => {
    if (docStep === 'preview' && docGenerateResult?.draft != null) {
      setDocEditableDraft(stripMarkdown(docGenerateResult.draft))
    }
  }, [docStep, docGenerateResult?.draft])

  // ========== 第六部分：渲染逻辑 ==========

  // showWelcome：是否显示欢迎界面（无消息时显示）
  const showWelcome = messages.length === 0

  // return 返回 JSX，描述组件的 UI 结构
  return (
    // 最外层容器，类名 consult-page
    <div className="consult-page">
      {/* 主内容区域，根据 activeTab 和 showWelcome 动态添加 consult-main-draft 类 */}
      <div className={`consult-main ${(activeTab === 'draft' || activeTab === 'case') && showWelcome ? 'consult-main-draft' : ''} ${activeTab === 'draft' && docStep === 'preview' ? 'consult-main-wide' : ''}`}>
        <div className="consult-content">
          {/* 条件渲染：若无消息则显示欢迎区，否则显示消息列表 */}
          {showWelcome ? (
            // 若在咨询/案情标签且无消息，显示欢迎内容；若在起草标签则显示 null（空白）
            activeTab !== 'draft' ? (
              <div className="consult-welcome">
                {/* 头像和问候语 */}
                <div className="consult-avatar-wrap">
                  <div className="consult-avatar">
                    <span className="consult-avatar-icon">⚖</span>
                  </div>
                  <div className="consult-greeting">
                    <p className="consult-greeting-bubble">嗨，有什么我能帮你的~</p>
                  </div>
                </div>
                {/* 介绍文字 */}
                <p className="consult-intro">
                  {activeTab === 'case'
                    ? '请描述您的案情（当事人、时间地点、事实经过、争议焦点等），系统将检查信息完整性，必要时会向您补充提问。信息完整后将生成案情摘要供您确认，确认后进行合规性分析。'
                    : '你好！我是智能法律助手。作为专业法律顾问，我可以解释法律法规、解答法律问题。根据您的问题，我能提供专业的法律意见。您有什么想问的吗？'}
                </p>
                {/* 建议问题区域（案情咨询不显示） */}
                {activeTab !== 'case' && (
                <div className="consult-suggest-wrapper">
                  <div className="consult-suggest">
                    <div className="consult-suggest-header">
                      <MessageOutlined className="consult-suggest-icon" />
                      <span>猜你想问：</span>
                      {/* 换一换按钮，点击后 suggestIndex + 1，切换建议问题组 */}
                      <button
                        type="button"
                        className="consult-refresh"
                        onClick={() => setSuggestIndex((i) => i + 1)}
                      >
                        <SyncOutlined />
                        换一换
                      </button>
                    </div>
                    {/* 建议问题卡片网格 */}
                    <div className="consult-suggest-grid">
                      {suggestions.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          className="consult-suggest-card"
                          onClick={() => handleSubmit(item.q)}
                          disabled={loading}
                        >
                          <span className="consult-suggest-title">{item.q}</span>
                          <span className="consult-suggest-tag">{item.tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                )}
              </div>
          ) : null
          ) : (
            /* 有消息时，显示消息列表 */
            <div className="consult-messages">
              {messages.map((item, i) => (
                <div
                  key={i}
                  className={`consult-msg ${item.role === 'user' ? 'consult-msg-user' : 'consult-msg-assistant'}`}
                >
                  {/* 仅 AI 消息显示头像 */}
                  {item.role === 'assistant' && (
                    <div className="consult-msg-avatar">
                      <span>💬</span>
                    </div>
                  )}
                  <div className="consult-msg-content">
                    {item.role === 'user' && <span className="consult-msg-label">您</span>}
                    <div
                      className="consult-msg-text"
                      dangerouslySetInnerHTML={{
                        __html: (item.content || '')
                          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                          .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                          .replace(/\n/g, '<br/>'),
                      }}
                    />
                  </div>
                </div>
              ))}
              {/* 加载中时显示「正在思考...」（流式输出时已在 assistant 气泡内逐字显示，不重复） */}
              {loading && (!messages.length || messages[messages.length - 1]?.role !== 'assistant') && (
                <div className="consult-msg consult-msg-assistant">
                  <div className="consult-msg-avatar"><span>💬</span></div>
                  <div className="consult-msg-content">
                    <div className="consult-msg-loading">正在思考...</div>
                  </div>
                </div>
              )}
              {/* 案情咨询：摘要确认 / 后续操作按钮 */}
              {activeTab === 'case' && !loading && (caseSessionState || (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content?.includes?.('请确认是否准确'))) && (
                <div className="consult-case-actions">
                  {(caseSessionState?.case_status === 'summary_pending' || caseSessionState?.type === 'summary' || (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content?.includes?.('请确认是否准确'))) && (
                    <>
                      <button type="button" className="consult-case-action-btn primary" onClick={() => handleCaseAction('确认')}>
                        确认无误
                      </button>
                      <span className="consult-case-action-hint">如需修改，请在下方输入框补充说明后发送</span>
                    </>
                  )}
                  {caseSessionState?.case_status === 'analysis_done' && caseSessionState?.action_options?.length > 0 && (
                    <div className="consult-case-action-row">
                      {caseSessionState.action_options.map((opt) => (
                        <button key={opt} type="button" className="consult-case-action-btn" onClick={() => handleCaseAction(opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部输入区域 */}
        <div className={`consult-input-wrap ${activeTab === 'draft' ? 'consult-input-wrap-draft' : ''}`}>
          {/* 无障碍：语音旁白 + 标签切换 */}
          <div className="consult-tab-bar">
            {activeTab !== 'draft' && messages.some((m) => m.role === 'assistant') && (
              <div className="consult-read-aloud-wrap">
                <button
                  type="button"
                  className="consult-read-aloud-btn"
                  onClick={handleReadAloud}
                  title="朗读最新回复"
                >
                  <SoundOutlined /> 朗读
                </button>
              </div>
            )}
            <button
              type="button"
              className={`consult-tab-btn ${activeTab === 'consult' ? 'consult-tab-active' : ''}`}
              onClick={() => { setActiveTab('consult'); setSelectedTemplate(null); dispatch(setCaseSessionState(null)) }}
            >
              <RobotOutlined className="consult-tab-icon" />
              AI智能咨询
            </button>
            <button
              type="button"
              className={`consult-tab-btn ${activeTab === 'case' ? 'consult-tab-active' : ''}`}
              onClick={() => { setActiveTab('case'); setSelectedTemplate(null) }}
            >
              <AuditOutlined className="consult-tab-icon" />
              案情咨询
            </button>
            <button
              type="button"
              className={`consult-tab-btn ${activeTab === 'draft' ? 'consult-tab-active' : ''}`}
              onClick={() => {
                setActiveTab('draft')
                setDocFlowMode('document')
                handleDocReset()
              }}
            >
              <FileTextOutlined className="consult-tab-icon" />
              文书起草
            </button>
          </div>

          {/* 输入框区域：文书起草时不显示对话框 */}
          {activeTab !== 'draft' && (
            <div className="consult-input-area">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentComplaintId ? "修改内容后点击发送，将添加为新版本" :
                  activeTab === 'case'
                    ? (caseSessionState?.case_status === 'gathering' ? '' : "请描述您的案情，包括当事人、时间地点、事实经过、争议焦点等")
                    : "您想咨询什么..."
                }
                rows={2}
                disabled={loading}
              />
              <div className="consult-input-footer">
                <p className="consult-input-hint">通过 Cmd+Enter 换行 · 点击麦克风语音输入</p>
                <div className="consult-input-badge">
                  <span className="consult-model-tag">深度思考 (DeepSeek)</span>
                </div>
                {/* 语音输入按钮，录音时显示停止图标 */}
                <button
                  type="button"
                  className={`consult-voice ${isRecording ? 'consult-voice-active' : ''}`}
                  onClick={handleVoiceToggle}
                  disabled={loading}
                  title={isRecording ? '点击停止语音输入' : '语音输入'}
                >
                  {isRecording ? <StopOutlined /> : <AudioOutlined />}
                </button>
                {/* 发送按钮 */}
                <button
                  type="button"
                  className="consult-send"
                  onClick={() => handleSubmit()}
                  disabled={loading || !input.trim()}
                >
                  <SendOutlined />
                  发送
                </button>
              </div>
            </div>
          )}

          {/* 文书起草模式下，显示文书流程或起诉状卡片 */}
          {activeTab === 'draft' && (
            <div className="consult-doc-cards">
              {docFlowMode === 'document' ? (
                /* 文书生成流程（按 mermaid） */
                <>
                  {docStep === 'check' && (
                    <div className="consult-doc-flow">
                      <p className="consult-doc-flow-hint">正在获取案情信息...</p>
                    </div>
                  )}
                  {docStep === 'select_case' && docSessions.length > 0 && (
                    <div className="consult-doc-flow">
                      <p className="consult-doc-flow-title">选择已有案情</p>
                      <div className="consult-doc-session-list">
                        {docSessions.map((s) => (
                          <button
                            key={s.session_id}
                            type="button"
                            className={`consult-doc-session-btn ${docSelectedSessionId === s.session_id ? 'selected' : ''}`}
                            onClick={() => handleDocSelectSession(s.session_id)}
                          >
                            <span className="consult-doc-session-title">{s.title || '案情咨询'}</span>
                            <span className="consult-doc-session-summary">{s.case_summary?.slice(0, 60)}...</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {docStep === 'input_case' && (
                    <div className="consult-doc-flow">
                      <p className="consult-doc-flow-title">请提交案情概要</p>
                      <p className="consult-doc-flow-hint">请描述当事人、时间地点、事实经过、争议焦点等</p>
                      <textarea
                        className="consult-doc-case-input"
                        value={docCaseInput || input}
                        onChange={(e) => { setDocCaseInput(e.target.value); setInput(e.target.value) }}
                        placeholder="请输入案情概要..."
                        rows={4}
                      />
                      <button type="button" className="consult-doc-flow-btn" onClick={handleDocCheckCase} disabled={loading}>
                        {loading ? '检查中...' : '检查案情'}
                      </button>
                    </div>
                  )}
                  {docStep === 'supplement' && (
                    <div className="consult-doc-flow">
                      <p className="consult-doc-flow-title">请补充以下信息</p>
                      <ul className="consult-doc-questions">
                        {docSupplementQuestions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                      <textarea
                        className="consult-doc-case-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="请补充说明..."
                        rows={4}
                      />
                      <button type="button" className="consult-doc-flow-btn" onClick={handleDocSupplementSubmit} disabled={loading}>
                        {loading ? '检查中...' : '提交补充'}
                      </button>
                    </div>
                  )}
                  {(docStep === 'select_template' || docStep === 'preview') && (
                    <>
                      <div className="consult-doc-template-section">
                        <p className="consult-doc-flow-title">
                          {docStep === 'select_template' ? '选择文书模板' : '文书初稿'}
                        </p>
                        {docStep === 'select_template' && (
                          <>
                            {loading ? (
                              <div className="consult-doc-generating">
                              <LoadingOutlined className="consult-doc-generating-icon" spin />
                              <p className="consult-doc-generating-text">正在生成文书，请稍候...</p>
                              <p className="consult-doc-generating-hint">AI 正在根据案情起草法律文书</p>
                            </div>
                          ) : (
                            <div className="consult-doc-template-grid">
                              {(docTemplates.length ? docTemplates : DOCUMENT_TEMPLATES).map((t) => (
                                <button
                                  key={t.key || t.templateKey}
                                  type="button"
                                  className="consult-doc-card"
                                  onClick={() => handleDocGenerate(t.key || t.templateKey)}
                                  disabled={loading}
                                >
                                  <div className="consult-doc-card-icon"><FileTextOutlined /></div>
                                  <span className="consult-doc-title">{t.title}</span>
                                  <span className="consult-doc-desc">{t.desc || `适用场景：${t.title}`}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          </>
                        )}
                      </div>
                      {docStep === 'preview' && docGenerateResult && (
                        <div className="consult-doc-preview consult-doc-preview-split">
                          {docGenerateResult.missing_fields?.length > 0 && (
                            <div className="consult-doc-missing consult-doc-missing-full">
                              <p>建议补充：</p>
                              <ul>{docGenerateResult.missing_fields.map((m, i) => <li key={i}>{m}</li>)}</ul>
                            </div>
                          )}
                          <div className="consult-doc-split-row">
                            <div className="consult-doc-split-col">
                              <p className="consult-doc-preview-label">左侧：编辑正文</p>
                              <textarea
                                className="consult-doc-draft-edit"
                                value={docEditableDraft}
                                onChange={(e) => setDocEditableDraft(e.target.value)}
                                placeholder="在此修改文书内容..."
                                spellCheck={false}
                              />
                            </div>
                            <div className="consult-doc-split-col">
                              <p className="consult-doc-preview-label">右侧：预览效果</p>
                              <div className="consult-doc-draft-plain">
                                {docEditableDraft ? stripMarkdown(docEditableDraft) : '暂无内容'}
                              </div>
                            </div>
                          </div>
                          <div className="consult-doc-preview-actions">
                            <button
                              type="button"
                              className="consult-doc-flow-btn primary"
                              onClick={handleDocDownload}
                            >
                              <DownloadOutlined /> 下载 Word
                            </button>
                            <button type="button" className="consult-doc-flow-btn" onClick={handleDocReset}>
                              重新生成
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                /* 起诉状模式（从侧边栏进入） */
                DOCUMENT_TEMPLATES.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`consult-doc-card ${selectedTemplate === doc.templateKey ? 'consult-doc-card-selected' : ''}`}
                    onClick={() => {
                      setSelectedTemplate(doc.templateKey)
                      dispatch(setCurrentComplaintId(null))
                      if (doc.templateKey === 'divorce') {
                        setInput(DIVORCE_COMPLAINT_PROMPT)
                      } else {
                        setInput((prev) => prev ? prev + doc.title : doc.title)
                      }
                    }}
                  >
                    <div className="consult-doc-card-icon"><FileTextOutlined /></div>
                    {doc.recent && <span className="consult-doc-badge">最近使用</span>}
                    <span className="consult-doc-title">{doc.title}</span>
                    <span className="consult-doc-desc">{doc.desc}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 页脚 */}
      <footer className="consult-footer">
        内容依据 AI 和相关法律生成，仅供参考 · 《用户隐私协议》《服务协议》
      </footer>
    </div>
  )
}
