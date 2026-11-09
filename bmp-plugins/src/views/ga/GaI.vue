<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const topRiskEstates = ref([])

const requiredMarks = [
    { fieldName: 'Nama Estate', target: 'Dimension (Estate Name)', description: 'Estate level granularity' },
    { fieldName: 'Cf Estate Score LOD', target: 'Measure / Score', description: 'BMP Score per estate' },
    { fieldName: 'Cf Risk Point', target: 'Dimension / Risk Factor', description: 'Main driver risk point' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) {
        topRiskEstates.value = []
        return
    }

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
    const estateColIdx = colNames.findIndex(c => /estate/i.test(c))
    const scoreColIdx = colNames.findIndex(c => /score|bmp/i.test(c))
    const riskColIdx = colNames.findIndex(c => /risk|driver/i.test(c))

    const estateMap = new Map()

    data.forEach(row => {
        const estate = estateColIdx >= 0 && row[estateColIdx] ? (row[estateColIdx].formattedValue ?? row[estateColIdx].value) : null
        const scoreRaw = scoreColIdx >= 0 && row[scoreColIdx] ? Number(row[scoreColIdx].value ?? row[scoreColIdx].formattedValue) : null
        const score = scoreRaw !== null && !isNaN(scoreRaw) ? (scoreRaw <= 1 ? Number((scoreRaw * 100).toFixed(1)) : Number(scoreRaw.toFixed(1))) : 0
        const risk = riskColIdx >= 0 && row[riskColIdx] ? (row[riskColIdx].formattedValue ?? row[riskColIdx].value) : 'Fertilizer Shortage'

        if (estate) {
            estateMap.set(estate, { estate, score, risk })
        }
    })

    const sorted = Array.from(estateMap.values()).sort((a, b) => a.score - b.score).slice(0, 10)
    topRiskEstates.value = sorted
}

async function refreshTableauData() {
    if (!worksheet) return
    try {
        const table = await worksheet.getSummaryDataAsync()
        processTableauData(table)
        loading.value = false
        error.value = ''
    } catch (err) {
        const errMsg = err?.message || err?.toString() || 'Unknown error'
        error.value = `Error loading Tableau data: ${errMsg}`
        loading.value = false
    }
}

onMounted(async () => {
    await nextTick()

    const hasTableauExtensions = typeof window !== 'undefined' &&
        window.tableau?.extensions &&
        typeof window.tableau.extensions.initializeAsync === 'function'

    if (!hasTableauExtensions) {
        isTableauMode.value = false
        topRiskEstates.value = [
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
        ]
        loading.value = false
        error.value = ''
        return
    }

    try {
        isTableauMode.value = true
        await window.tableau.extensions.initializeAsync()
        await new Promise(resolve => setTimeout(resolve, 500))

        const dashboard = window.tableau.extensions.dashboardContent?.dashboard
        if (dashboard) {
            const worksheets = dashboard.worksheets
            worksheet = worksheets.find(w => w.name === window.tableau.extensions.settings.get('worksheet')) || worksheets[0]
        }
        if (!worksheet && window.tableau.extensions.worksheetContent) {
            worksheet = window.tableau.extensions.worksheetContent.worksheet
        }

        if (worksheet) {
            eventHandler = () => refreshTableauData()
            worksheet.addEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)
            await refreshTableauData()
        } else {
            throw new Error('No Tableau worksheet connected.')
        }
    } catch (err) {
        isTableauMode.value = false
        topRiskEstates.value = [
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
        ]
        error.value = ''
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
    <PluginLayout :loading="loading" :error="error" title="Top 10 Risk Estate" bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/ga-i" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <div>
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-wide mb-3">Top 10 Risk Estate</h3>
                <div class="border border-[#E2E8F0] rounded overflow-hidden">
                    <table class="w-full text-left border-collapse text-[10px]">
                        <thead class="bg-[#F8FAFC] text-slate-600 border-b border-[#E2E8F0]">
                            <tr>
                                <th class="p-2 font-bold w-[40%]">Estate</th>
                                <th class="p-2 font-bold text-center">Score</th>
                                <th class="p-2 font-bold text-center">Risk Point</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#E2E8F0]">
                            <tr v-for="item in topRiskEstates" :key="item.estate" class="hover:bg-[#F8FAFC]">
                                <td class="p-2 font-bold text-slate-800">{{ item.estate }}</td>
                                <td class="p-2 text-center font-bold text-[#EF4444]">{{ item.score }}</td>
                                <td class="p-2 text-center text-slate-600">{{ item.risk }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="text-[8px] text-slate-400 italic mt-2">
                Score = BMP TM score Aug (actual). Risk Point = main driver from system data (Manuring, Workforce, OMS);
                current entries are examples.
            </div>
        </div>
    </PluginLayout>
</template>