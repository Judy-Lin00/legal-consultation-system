import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  messages: [],
  loading: false,
  error: null,
  sessions: [],
  currentSessionId: null,
  sessionsRefetchTrigger: 0,
  currentComplaintId: null,
  caseSessionState: null, // { case_status, case_summary, action_options } 从会话加载
}

export const consultationSlice = createSlice({
  name: 'consultation',
  initialState,
  reducers: {
    setSessions: (state, action) => {
      state.sessions = action.payload
    },
    setCurrentSession: (state, action) => {
      const { sessionId, messages, caseSessionState } = action.payload
      state.currentSessionId = sessionId
      state.messages = messages || []
      state.currentComplaintId = null
      state.caseSessionState = caseSessionState || null
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload)
    },
    updateLastMessageContent: (state, action) => {
      if (state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'assistant') {
        state.messages[state.messages.length - 1].content = action.payload
      }
    },
    setCurrentSessionId: (state, action) => {
      state.currentSessionId = action.payload
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
    },
    clearMessages: (state) => {
      state.messages = []
      state.error = null
      state.currentSessionId = null
      state.currentComplaintId = null
      state.caseSessionState = null
    },
    newConversation: (state) => {
      state.messages = []
      state.currentSessionId = null
      state.currentComplaintId = null
      state.caseSessionState = null
      state.error = null
    },
    setCurrentComplaintId: (state, action) => {
      state.currentComplaintId = action.payload
    },
    setCaseSessionState: (state, action) => {
      state.caseSessionState = action.payload
    },
    triggerSessionsRefetch: (state) => {
      state.sessionsRefetchTrigger += 1
    },
  },
})

export const getCurrentMessages = (state) => state.consultation.messages

export const {
  setSessions,
  setCurrentSession,
  addMessage,
  updateLastMessageContent,
  setCurrentSessionId,
  setLoading,
  setError,
  clearMessages,
  newConversation,
  triggerSessionsRefetch,
  setCurrentComplaintId,
  setCaseSessionState,
} = consultationSlice.actions
export default consultationSlice.reducer
