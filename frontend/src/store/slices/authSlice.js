import { createSlice } from '@reduxjs/toolkit'

const loadUser = () => {
  try {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    if (token && user) return { token, user: JSON.parse(user) }
  } catch (_) {}
  return { token: null, user: null }
}

const initialState = loadUser()

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action) => {
      const { token, user } = action.payload
      state.token = token
      state.user = user
      if (token) localStorage.setItem('token', token)
      if (user) localStorage.setItem('user', JSON.stringify(user))
    },
    logout: (state) => {
      state.token = null
      state.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
})

export const { setAuth, logout } = authSlice.actions
export default authSlice.reducer
