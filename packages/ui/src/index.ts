// Import styles so they're included when the package is imported
import './styles/globals.css'

// Utils
export * from './utils/cn'

// Components - re-export everything from the components index
export * from './components'

// Hooks - export specific items to avoid conflicts
export { useKaraokeSession } from './hooks/useKaraokeSession'
export type { UseKaraokeSessionOptions, KaraokeResults } from './hooks/useKaraokeSession'

// Services
export * from './services'

// Types - export everything including LineScore
export * from './types/karaoke'

// I18n
export { I18nProvider } from './i18n'

// Re-export KaraokeSession from components to avoid ambiguity
export { KaraokeSession } from './components/karaoke/KaraokeSession'
export type { KaraokeSessionProps } from './components/karaoke/KaraokeSession'