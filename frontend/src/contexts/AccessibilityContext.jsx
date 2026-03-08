/**
 * 无障碍设置 - 面向弱势群体
 * 字号：小/中/大
 * 语音旁白：朗读 AI 回复
 */
import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'legal_accessibility'
const defaultSettings = { textSize: 'medium', ttsEnabled: false }

const AccessibilityContext = createContext(null)

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings
    } catch {
      return defaultSettings
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (_) {}
  }, [settings])

  // rem 基准：小=0.75rem(12px)，中=1rem(16px)，大=1.75rem(28px)
  useEffect(() => {
    const px = { small: 12, medium: 16, large: 28 }
    document.documentElement.style.fontSize = `${px[settings.textSize] || 16}px`
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [settings.textSize])

  const setTextSize = (size) => setSettings((s) => ({ ...s, textSize: size }))
  const setTtsEnabled = (v) => setSettings((s) => ({ ...s, ttsEnabled: v }))

  return (
    <AccessibilityContext.Provider value={{ settings, setTextSize, setTtsEnabled }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext)
  return ctx || { settings: defaultSettings, setTextSize: () => {}, setTtsEnabled: () => {} }
}
