import { configureStore } from '@reduxjs/toolkit'
import consultationReducer from './slices/consultationSlice'
import authReducer from './slices/authSlice'

export const store = configureStore({
  reducer: {
    consultation: consultationReducer,
    auth: authReducer,
  },
})
