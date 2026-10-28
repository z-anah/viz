<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import { numericValue } from '@/utils/tableauHelpers'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

const riskEstates = ref([
    { estate: 'Bukit Raya', score: 58.4, risk: 'Fertilizer Shortage' },
    { estate: 'Tanjung Sari', score: 65.3, risk: 'Workforce Shortage' },
    { estate: 'Bukit Makmur', score: 67.7, risk: 'Fertilizer Shortage' },
    { estate: 'Ulin Agro', score: 69.2, risk: 'Upkeep Shortage' },
    { estate: 'Hikmah Lima', score: 69.7, risk: 'Upkeep Shortage' },
    { estate: 'Kruing Agro', score: 71.2, risk: 'Fertilizer Shortage' },
    { estate: 'Waringin', score: 71.5, risk: 'Workforce Shortage' },
    { estate: 'Jaya Permai', score: 72.6, risk: 'Fertilizer Shortage' },
    { estate: 'Meranti Agro', score: 72.9, risk: 'Fertilizer Shortage' },
    { estate: 'Hikmah Empat', score: 74.0, risk: 'Workforce Shortage' }
])

let worksheet = null
let eventHandler = null

onMounted(async () => {
    await nextTick()

    if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== "function") {
        loading.value = false
        hasData.value = true
        return
    }

    try {
        await window.tableau.extensions.initializeAsync()
        await new Promise(resolve => setTimeout(resolve, 1500))

        const dashboard = window.tableau.extensions.dashboardContent?.dashboard
        if (dashboard) {
            const worksheets = dashboard.worksheets
            worksheet = worksheets.find(w => w.name === window.tableau.extensions.settings.get('worksheet')) || worksheets[0]
        }
        if (!worksheet && window.tableau.extensions.worksheetContent) {
            worksheet = window.tableau.extensions.worksheetContent.worksheet
        }

        if (!worksheet) {
            throw new Error('No Tableau worksheet found.')
        }

        const fetchWorksheetData = async () => {
            const table = await worksheet.getSummaryDataAsync()
            const columns = table.columns || []
            const data = table.data || []

            if (data.length > 0 && columns.length > 0) {
                const parsedRows = []
                data.forEach((row) => {
                    let estate = ''
                    let score = 0.0
                    let risk = '—'

                    for (let c = 0; c < columns.length; c++) {
                        const colName = String(columns[c].fieldName || columns[c].caption || '').toLowerCase()
                        const rawVal = row[c] ? (row[c].formattedValue ?? row[c].value) : null
                        const strVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim() : ''

                        if (colName.includes('estate') || colName.includes('name') || (c === 0 && !estate)) {
                            if (strVal && isNaN(strVal)) estate = strVal
                        }
                        if (colName.includes('score') || colName.includes('value')) {
                            const num = numericValue(rawVal)
                            if (!isNaN(num)) score = num
                        }
                        if (colName.includes('risk') || colName.includes('point') || colName.includes('driver') || (c === 2 && risk === '—')) {
                            if (strVal && isNaN(strVal)) risk = strVal
                        }
                    }

                    if (!estate && row[0]) estate = String(row[0].formattedValue ?? row[0].value ?? '').trim()
                    if (score === 0 && row[1]) {
                        const num = numericValue(row[1].formattedValue ?? row[1].value)
                        if (!isNaN(num)) score = num
                    }
                    if (risk === '—' && row[2]) {
                        const str = String(row[2].formattedValue ?? row[2].value ?? '').trim()
                        if (str) risk = str
                    }

                    if (estate) {
                        parsedRows.push({ estate, score, risk })
                    }
                })

                if (parsedRows.length > 0) {
                    riskEstates.value = parsedRows
                    hasData.value = true
                    loading.value = false
                    return
                }
            }

            hasData.value = false
            loading.value = false
        }

        await fetchWorksheetData()

        eventHandler = async () => {
            await fetchWorksheetData()
        }

        worksheet.addEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)

    } catch (err) {
        error.value = `Error: ${err.message}`
        hasData.value = false
        loading.value = false
    }
})

onBeforeUnmount(() => {
    if (worksheet && eventHandler && window.tableau?.TableauEventType) {
        worksheet.removeEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)
    }
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Top 10 Risk Estate">
        <div class="flex flex-col justify-between h-full w-full">
            <h3 class="text-xs font-black text-slate-800 uppercase tracking-wide mb-2">Top 10 Risk Estate</h3>

            <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
                <span class="text-[10px] text-slate-400">Please drag estate, score, and risk measures into marks.</span>
            </div>

            <div v-show="hasData" class="flex-1 border border-[#E2E8F0] rounded overflow-y-auto min-h-0">
                <table class="w-full text-left border-collapse text-[10px]">
                    <thead class="bg-[#F8FAFC] text-slate-600 border-b border-[#E2E8F0] sticky top-0">
                        <tr>
                            <th class="p-2 font-bold w-[40%]">Estate</th>
                            <th class="p-2 font-bold text-center">Score</th>
                            <th class="p-2 font-bold text-center">Risk Point</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#E2E8F0]">
                        <tr v-for="(item, index) in riskEstates" :key="index" class="hover:bg-[#F8FAFC]">
                            <td class="p-2 font-bold text-slate-800">{{ item.estate }}</td>
                            <td class="p-2 text-center font-bold text-[#EF4444]">{{ typeof item.score === 'number' ? item.score.toFixed(1) : item.score }}</td>
                            <td class="p-2 text-center text-slate-600">{{ item.risk }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="text-[8px] text-slate-400 italic mt-1.5 flex-shrink-0">
                Score = BMP TM score Aug (actual). Risk Point = main driver from system data (Manuring, Workforce, OMS).
            </div>
        </div>
    </PluginLayout>
</template>