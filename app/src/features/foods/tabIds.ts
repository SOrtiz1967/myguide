import type { SearchScope } from './api'

export const RESULTS_PANEL_ID = 'resultados'
export const tabId = (scope: SearchScope) => `pestana-${scope}`
