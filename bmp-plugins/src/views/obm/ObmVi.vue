<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const chartDataValues = ref({
    labels: [],
    budget: [],
    actual: []
})

const requiredMarks = [
    { fieldName: 'Cf Dynamic Granularity', target: 'Dimension', description: 'Period and Region granularity' },
    { fieldName: 'Cf Yield Ytd', target: 'Measure', description: 'Actual Yield YTD' },
    { fieldName: 'Cf Budget Ytd', target: 'Measure', description: 'Budget Yield YTD' }
]

const chartCanvas = ref(null)
let chartInstance = null
let worksheet = null
let eventHandler = null

async function renderChart() {
    await nextTick()
    if (!chartCanvas.value) return

    if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
    }

    chartInstance = new Chart(chartCanvas.value, {
        type: 'bar',
        data: {
            labels: chartDataValues.value.labels,
            datasets: [
                {
                    label: 'Budget',
                    data: chartDataValues.value.budget,
                    backgroundColor: '#CBD5E1',
                    barPercentage: 0.6,
                    categoryPercentage: 0.6
                },
                {
                    label: 'Actual',
                    data: chartDataValues.value.actual,
                    backgroundColor: '#006D65',
                    barPercentage: 0.6,
                    categoryPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 8 } },
                    grid: { color: '#F1F5F9' }
                },
                x: {
                    ticks: { font: { size: 8 } },
                    grid: { display: false }
                }
            }
        }
    })
}

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    chartDataValues.value = { labels: [], budget: [], actual: [] }

    if (data.length === 0) {
        renderChart()
        return
    }

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
    const labelIdx = colNames.findIndex(c => /granularity|period|region|periode|estate|name/i.test(c))
    const yieldIdx = colNames.findIndex(c => /yield|actual/i.test(c))
    const budgetIdx = colNames.findIndex(c => /budget/i.test(c))

    const labels = []
    const actuals = []
    const budgets = []

    data.forEach(row => {
        const lbl = labelIdx >= 0 && row[labelIdx] ? (row[labelIdx].formattedValue ?? row[labelIdx].value) : 'Period'
        const act = yieldIdx >= 0 && row[yieldIdx] ? Number(row[yieldIdx].value ?? row[yieldIdx].formattedValue) : 0
        const bud = budgetIdx >= 0 && row[budgetIdx] ? Number(row[budgetIdx].value ?? row[budgetIdx].formattedValue) : 0

        labels.push(String(lbl))
        actuals.push(!isNaN(act) ? act : 0)
        budgets.push(!isNaN(bud) ? bud : 0)
    })

    chartDataValues.value = {
        labels,
        budget: budgets,
        actual: actuals
    }

    renderChart()
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
        loading.value = false
        chartDataValues.value = {
            labels: ['Sumatra', 'Kalimantan'],
            budget: [63770916639, 454018465109],
            actual: [238.1, 37.7]
        }
        await renderChart()
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
        loading.value = false
        chartDataValues.value = {
            labels: ['Sumatra', 'Kalimantan'],
            budget: [63770916639, 454018465109],
            actual: [238.1, 37.7]
        }
        await renderChart()
        error.value = ''
    }
})

onBeforeUnmount(() => {
    if (worksheet && eventHandler && window.tableau?.TableauEventType) {
        worksheet.removeEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)
    }
    if (chartInstance) {
        chartInstance.destroy()
    }
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="TM Yield YTD · Actual vs Budget"
        bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-vi" />

        <div v-show="isTableauMode" class="bg-white p-4 shadow-2xs flex flex-col w-full h-full overflow-hidden">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase">TM Yield YTD · Actual vs Budget (t/ha)</h3>
                <div class="flex items-center space-x-2 text-[9px] text-[#00463E]/80 font-medium">
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#E2E8F0] border border-slate-300 mr-1 inline-block rounded-xs"></span>Budget</span>
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#006D65] mr-1 inline-block rounded-xs"></span>Actual</span>
                </div>
            </div>
            <div class="flex-1 relative min-h-0 w-full h-full">
                <canvas ref="chartCanvas"></canvas>
            </div>
        </div>
    </PluginLayout>
</template>