<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const distribution = ref({
    high: 9,
    mid: 5,
    low: 11
})

const requiredMarks = [
    { fieldName: 'Nama Estate', target: 'Dimension', description: 'Estate level granularity' },
    { fieldName: 'Cf High Estate Count', target: 'Measure', description: 'Count of estates with score >= 80%' },
    { fieldName: 'Cf Mid Estate Count', target: 'Measure', description: 'Count of estates with score 75-80%' },
    { fieldName: 'Cf Low Estate Count', target: 'Measure', description: 'Count of estates with score < 75%' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())

    const highIdx = colNames.findIndex(c => /high estate count|high/i.test(c))
    const midIdx = colNames.findIndex(c => /mid estate count|mid/i.test(c))
    const lowIdx = colNames.findIndex(c => /low estate count|low/i.test(c))
    const estateIdx = colNames.findIndex(c => /nama estate|estate/i.test(c))
    const scoreIdx = colNames.findIndex(c => /estate score lod|score/i.test(c))

    if (highIdx >= 0 || midIdx >= 0 || lowIdx >= 0) {
        if (data[0]) {
            const row = data[0]
            const getVal = (idx) => (idx >= 0 && row[idx] ? Number(row[idx].value ?? row[idx].formattedValue) : 0)
            distribution.value = {
                high: getVal(highIdx),
                mid: getVal(midIdx),
                low: getVal(lowIdx)
            }
        }
        return
    }

    if (estateIdx >= 0 && scoreIdx >= 0) {
        let h = 0, m = 0, l = 0
        data.forEach(row => {
            const sc = Number(row[scoreIdx]?.value ?? row[scoreIdx]?.formattedValue ?? 0)
            const scoreVal = sc > 1 ? sc / 100 : sc
            if (scoreVal >= 0.80) h++
            else if (scoreVal >= 0.75) m++
            else l++
        })
        distribution.value = { high: h, mid: m, low: l }
    }
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
        distribution.value = { high: 9, mid: 5, low: 11 }
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
        distribution.value = { high: 9, mid: 5, low: 11 }
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
    <PluginLayout :loading="loading" :error="error" title="Distribution TM (estates)" bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-iii" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight">Distribution TM (estates)</div>
            <div class="grid grid-cols-3 gap-2 my-1 text-center">
                <div class="bg-[#D1FAE5] p-1 rounded border border-[#10B981]">
                    <div class="text-[10px] font-bold text-[#00463E]">High</div>
                    <div class="text-lg font-black text-[#006D65] leading-none">{{ distribution.high }}<span
                            class="text-[10px] text-[#00463E]/70 font-normal">/25</span></div>
                    <div class="text-[8px] text-[#00463E]/70 mt-0.5">±0 vs Jul</div>
                </div>
                <div class="bg-[#FEF3C7] p-1 rounded border border-[#F59E0B]">
                    <div class="text-[10px] font-bold text-[#F59E0B]">Mid</div>
                    <div class="text-lg font-black text-[#F59E0B] leading-none">{{ distribution.mid }}<span
                            class="text-[10px] text-[#00463E]/70 font-normal">/25</span></div>
                    <div class="text-[8px] text-[#00463E]/70 mt-0.5">±0 vs Jul</div>
                </div>
                <div class="bg-[#FEE2E2] p-1 rounded border border-[#EF4444]">
                    <div class="text-[10px] font-bold text-[#EF4444]">Low</div>
                    <div class="text-lg font-black text-[#EF4444] leading-none">{{ distribution.low }}<span
                            class="text-[10px] text-[#00463E]/70 font-normal">/25</span></div>
                    <div class="text-[8px] text-[#00463E]/70 mt-0.5">±0 vs Jul</div>
                </div>
            </div>
            <div class="text-[8px] text-[#00463E]/60">High ≥ 80% · Mid 75–80% · Low &lt; 75% (usulan)</div>
        </div>
    </PluginLayout>
</template>