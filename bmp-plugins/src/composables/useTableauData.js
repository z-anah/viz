import { ref, onMounted, onBeforeUnmount } from 'vue'
import { findColumn, numericValue, extractTableauRow } from '@/utils/tableauHelpers'

export function useTableauData(initialMockData) {
  const cardData = ref({ ...initialMockData })
  const loading = ref(true)
  const error = ref('')
  const isTableauMode = ref(false)

  let worksheet = null
  let eventHandler = null

  const formatPercent = (value) => {
    let num = Number(value)
    if (isNaN(num)) return '—'
    if (num > 100) num = num / 10000
    return `${num.toFixed(1)}%`
  }

  const formatMoM = (value) => {
    let num = Number(value)
    if (isNaN(num)) return '0.0'
    if (Math.abs(num) > 100) num = num / 1000000
    return num.toFixed(1)
  }

  async function handleRefresh(processDataRow, onSummaryData) {
    try {
      const table = await worksheet.getSummaryDataAsync()
      const columns = table.columns || []
      const data = table.data || []

      if (onSummaryData) onSummaryData(table)
      if (data.length > 0) {
        processDataRow(data[0], columns, cardData, { findColumn, numericValue, extractTableauRow })
      }
      error.value = ''
    } catch (err) {
      error.value = `Could not read worksheet data: ${err.message}`
      console.error('Tableau Data error:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    cardData,
    loading,
    error,
    isTableauMode,
    formatPercent,
    formatMoM,
    initTableau: (processDataRow) => {
      onMounted(async () => {
        if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== 'function') {
          isTableauMode.value = false
          loading.value = false
          return
        }

        try {
          isTableauMode.value = true
          await window.tableau.extensions.initializeAsync()

          // Find worksheet in dashboard context or fall back to worksheetContent
          const dashboard = window.tableau.extensions.dashboardContent?.dashboard
          if (dashboard) {
            const worksheets = dashboard.worksheets
            worksheet = worksheets.find(w => w.name === window.tableau.extensions.settings.get('worksheet')) || worksheets[0]
          }
          if (!worksheet) {
            worksheet = window.tableau.extensions.worksheetContent.worksheet
          }

          eventHandler = () => handleRefresh(processDataRow)

          worksheet.addEventListener(
            window.tableau.TableauEventType.SummaryDataChanged,
            eventHandler
          )

          await handleRefresh(processDataRow)
        } catch (err) {
          isTableauMode.value = false
          error.value = ''
        } finally {
          loading.value = false
        }
      })

      onBeforeUnmount(() => {
        if (worksheet && eventHandler && window.tableau?.TableauEventType) {
          worksheet.removeEventListener(
            window.tableau.TableauEventType.SummaryDataChanged,
            eventHandler
          )
        }
      })
    }
  }
}