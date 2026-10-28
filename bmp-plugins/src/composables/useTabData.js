import { ref, onMounted, onBeforeUnmount } from 'vue'
import { findColumn, numericValue, extractTableauRow } from '@/utils/tabHelpers'

export function useTabData(initialMockData, fieldMappings, addLog = () => { }) {
    const cardData = ref({ ...initialMockData })
    const loading = ref(true)
    const error = ref('')
    const isTableauMode = ref(false)

    let worksheet = null
    let eventHandler = null

    const formatPercent = (value) => {
        let num = Number(value)
        if (isNaN(num)) return '—'
        if (num > 0 && num <= 1) num = num * 100
        return `${num.toFixed(1)}%`
    }

    const formatMoM = (value) => {
        let num = Number(value)
        if (isNaN(num)) return '0.0'
        return num.toFixed(1)
    }

    async function handleRefresh() {
        try {
            const table = await worksheet.getSummaryDataAsync()
            const columns = table.columns || []
            const data = table.data || []

            if (data.length > 0) {
                extractTableauRow(data[0], columns, cardData, fieldMappings, addLog)
            }
            error.value = ''
        } catch (err) {
            error.value = `Could not read worksheet data: ${err.message}`
            console.error('Tableau Data error:', err)
            addLog(error.value)
        } finally {
            loading.value = false
        }
    }

    onMounted(async () => {
        if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== 'function') {
            isTableauMode.value = false
            loading.value = false
            addLog('Running in standalone/mock mode.')
            return
        }

        try {
            isTableauMode.value = true
            await window.tableau.extensions.initializeAsync()
            addLog('Tableau Extensions initialized successfully.')

            const dashboard = window.tableau.extensions.dashboardContent?.dashboard
            const worksheets = dashboard?.worksheets || []
            worksheet = worksheets.find(w => w.name === window.tableau.extensions.settings.get('worksheet')) || worksheets[0] || window.tableau.extensions.worksheetContent?.worksheet

            if (!worksheet) {
                throw new Error('No Tableau worksheet found.')
            }

            eventHandler = () => handleRefresh()
            worksheet.addEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)

            await handleRefresh()
        } catch (err) {
            isTableauMode.value = false
            error.value = `Tableau init error: ${err.message}`
            addLog(error.value)
        } finally {
            loading.value = false
        }
    })

    onBeforeUnmount(() => {
        if (worksheet && eventHandler && window.tableau?.TableauEventType) {
            worksheet.removeEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)
        }
    })

    return {
        cardData,
        loading,
        error,
        isTableauMode,
        formatPercent,
        formatMoM
    }
}