<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const yieldStatus = ref({
    onTrack: 0,
    atRisk: 0,
    below: 0
})

const requiredMarks = [
    { fieldName: 'Nama Estate', target: 'Dimension (Estate Name)', description: 'Estate level granularity' },
    { fieldName: 'Cf Real Vs Budget', target: 'Measure / Status Flag', description: 'Yield performance against budget (≥100% On Track, 85–99% At Risk, <85% Below)' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())

    const estateColIdx = colNames.findIndex(c => /estate/i.test(c))
    const statusColIdx = colNames.findIndex(c => /status|flag|track|risk/i.test(c))
    const realVsBudgetColIdx = colNames.findIndex(c => /real.*budget|achievement|yield.*ratio/i.test(c))

    const onTrackCountColIdx = colNames.findIndex(c => /on track count/i.test(c))
    const atRiskCountColIdx = colNames.findIndex(c => /at risk count/i.test(c))
    const belowCountColIdx = colNames.findIndex(c => /below.*count/i.test(c))

    if (onTrackCountColIdx >= 0 || atRiskCountColIdx >= 0 || belowCountColIdx >= 0) {
        if (data[0]) {
            if (onTrackCountColIdx >= 0 && data[0][onTrackCountColIdx]) {
                yieldStatus.value.onTrack = Number(data[0][onTrackCountColIdx].value ?? data[0][onTrackCountColIdx].formattedValue) || 0
            }
            if (atRiskCountColIdx >= 0 && data[0][atRiskCountColIdx]) {
                yieldStatus.value.atRisk = Number(data[0][atRiskCountColIdx].value ?? data[0][atRiskCountColIdx].formattedValue) || 0
            }
            if (belowCountColIdx >= 0 && data[0][belowCountColIdx]) {
                yieldStatus.value.below = Number(data[0][belowCountColIdx].value ?? data[0][belowCountColIdx].formattedValue) || 0
            }
        }
        return
    }

    const estateMap = new Map()

    data.forEach(row => {
        const estateName = estateColIdx >= 0 && row[estateColIdx] ? (row[estateColIdx].formattedValue ?? row[estateColIdx].value) : null
        const statusVal = statusColIdx >= 0 && row[statusColIdx] ? (row[statusColIdx].formattedValue ?? row[statusColIdx].value) : null
        const ratioVal = realVsBudgetColIdx >= 0 && row[realVsBudgetColIdx] ? Number(row[realVsBudgetColIdx].value ?? row[realVsBudgetColIdx].formattedValue) : null

        const key = estateName || `row_${Math.random()}`

        let category = 'below'
        if (statusVal) {
            const s = String(statusVal).toLowerCase()
            if (s.includes('track') || s.includes('high')) category = 'onTrack'
            else if (s.includes('risk') || s.includes('mid')) category = 'atRisk'
            else category = 'below'
        } else if (ratioVal !== null && !isNaN(ratioVal)) {
            if (ratioVal >= 1.0) category = 'onTrack'
            else if (ratioVal >= 0.85) category = 'atRisk'
            else category = 'below'
        }

        estateMap.set(key, category)
    })

    let countOnTrack = 0
    let countAtRisk = 0
    let countBelow = 0

    estateMap.forEach(cat => {
        if (cat === 'onTrack') countOnTrack++
        else if (cat === 'atRisk') countAtRisk++
        else countBelow++
    })

    yieldStatus.value = {
        onTrack: countOnTrack,
        atRisk: countAtRisk,
        below: countBelow
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
        yieldStatus.value = { onTrack: 12, atRisk: 7, below: 6 }
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
        yieldStatus.value = { onTrack: 12, atRisk: 7, below: 6 }
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
    <PluginLayout :loading="loading" :error="error" title="Yield Status (estates)" bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-i" />

        <div v-else class="p-3 shadow-2xs flex flex-col justify-between w-full h-full">
            <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight">Yield Status (estates)</div>
            <div class="grid grid-cols-3 gap-2 my-2 text-center">
                <div class="bg-[#D1FAE5] p-1.5 rounded border border-[#10B981]">
                    <div class="text-[10px] font-bold text-[#00463E]">On Track</div>
                    <div class="text-xl font-black text-[#006D65] leading-none mt-1">{{ yieldStatus.onTrack }}</div>
                </div>
                <div class="bg-[#FEF3C7] p-1.5 rounded border border-[#F59E0B]">
                    <div class="text-[10px] font-bold text-[#F59E0B]">At Risk</div>
                    <div class="text-xl font-black text-[#F59E0B] leading-none mt-1">{{ yieldStatus.atRisk }}</div>
                </div>
                <div class="bg-[#FEE2E2] p-1.5 rounded border border-[#EF4444]">
                    <div class="text-[10px] font-bold text-[#EF4444]">Below</div>
                    <div class="text-xl font-black text-[#EF4444] leading-none mt-1">{{ yieldStatus.below }}</div>
                </div>
            </div>
            <div class="text-[8px] text-[#00463E]/60">≥100% · 85–99% · &lt; 85% of budget YTD · ton: DIR</div>
        </div>
    </PluginLayout>
</template>