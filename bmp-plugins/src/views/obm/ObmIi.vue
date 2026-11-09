<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const production = ref({
    yieldYtd: '16.10',
    budget: '15.99',
    target: '25.61',
    vsBudget: '100.7',
    vsBudgetPp: '2.0'
})

const requiredMarks = [
    { fieldName: 'Cf Yield Ytd', target: 'Measure', description: 'Yield YTD actual' },
    { fieldName: 'Cf Budget Ytd', target: 'Measure', description: 'Budget YTD' },
    { fieldName: 'Cf Target Yield', target: 'Measure', description: 'Target annual yield' },
    { fieldName: 'Cf Real Vs Budget', target: 'Measure', description: 'Realization vs Budget ratio' },
    { fieldName: 'Cf Vs Budget Pp', target: 'Measure', description: 'Difference in percentage points' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())

    const yieldIdx = colNames.findIndex(c => /yield ytd|cf yield ytd/i.test(c))
    const budgetIdx = colNames.findIndex(c => /budget ytd|cf budget ytd/i.test(c))
    const targetIdx = colNames.findIndex(c => /target yield|cf target yield/i.test(c))
    const vsBudgetIdx = colNames.findIndex(c => /real vs budget|vs budget/i.test(c))
    const ppIdx = colNames.findIndex(c => /vs budget pp|pp/i.test(c))

    if (data[0]) {
        const row = data[0]
        const getVal = (idx) => (idx >= 0 && row[idx] ? Number(row[idx].value ?? row[idx].formattedValue) : null)

        const yVal = getVal(yieldIdx)
        const bVal = getVal(budgetIdx)
        const tVal = getVal(targetIdx)
        const vVal = getVal(vsBudgetIdx)
        const pVal = getVal(ppIdx)

        production.value = {
            yieldYtd: yVal !== null && !isNaN(yVal) ? yVal.toFixed(2) : '16.10',
            budget: bVal !== null && !isNaN(bVal) ? bVal.toFixed(2) : '15.99',
            target: tVal !== null && !isNaN(tVal) ? tVal.toFixed(2) : '25.61',
            vsBudget: vVal !== null && !isNaN(vVal) ? (vVal > 10 ? vVal.toFixed(1) : (vVal * 100).toFixed(1)) : '100.7',
            vsBudgetPp: pVal !== null && !isNaN(pVal) ? (Math.abs(pVal) > 10 ? pVal.toFixed(1) : (pVal * 100).toFixed(1)) : '2.0'
        }
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
        production.value = {
            yieldYtd: '16.10',
            budget: '15.99',
            target: '25.61',
            vsBudget: '100.7',
            vsBudgetPp: '2.0'
        }
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
        production.value = {
            yieldYtd: '16.10',
            budget: '15.99',
            target: '25.61',
            vsBudget: '100.7',
            vsBudgetPp: '2.0'
        }
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
    <PluginLayout :loading="loading" :error="error" title="Production · Yield YTD" bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-ii" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight">Production · Yield YTD</div>
            <div class="flex items-center justify-between my-1">
                <div>
                    <div class="text-2xl font-black text-[#000000] leading-none">{{ production.yieldYtd }} <span
                            class="text-xs font-normal text-[#00463E]/70">t/ha</span></div>
                    <div class="text-[10px] text-[#00463E] font-medium mt-1">Budget {{ production.budget }} t/ha</div>
                    <div class="text-[9px] text-[#00463E]/60">Target 2026 {{ production.target }} t/ha</div>
                </div>
                <div class="text-center">
                    <div
                        class="text-base font-black text-[#006D65] leading-none bg-[#D1FAE5] px-3 py-1.5 rounded border border-[#10B981]">
                        {{ production.vsBudget }}%</div>
                    <div class="text-[8px] text-[#00463E]/70 mt-0.5">vs budget</div>
                    <div class="text-[9px] font-bold text-[#EF4444] mt-0.5 bg-[#FEE2E2] px-1 rounded"><i
                            class="fas fa-caret-down"></i> {{ production.vsBudgetPp }} pp</div>
                </div>
            </div>
        </div>
    </PluginLayout>
</template>