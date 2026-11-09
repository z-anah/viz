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
    data: []
})

const requiredMarks = [
    { fieldName: 'Cf Dynamic Granularity', target: 'Dimension', description: 'Region-Area granularity' },
    { fieldName: 'Cf Real Vs Budget', target: 'Measure', description: 'Yield vs Budget YTD percentage' }
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
                    label: 'Yield vs Budget YTD (%)',
                    data: chartDataValues.value.data,
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
                        label: (context) => `Yield vs Budget YTD: ${context.raw}%`
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

    const labels = []
    const values = []

    if (data.length > 0) {
        const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
        const granIdx = colNames.findIndex(c => /granularity|region|area|estate|name/i.test(c))
        const valIdx = colNames.findIndex(c => /real vs budget|vs budget|yield|value|agg/i.test(c))

        data.forEach(row => {
            const lbl = granIdx >= 0 && row[granIdx] ? (row[granIdx].formattedValue ?? row[granIdx].value) : 'Area'
            const valCell = valIdx >= 0 && row[valIdx] ? (row[valIdx].value ?? row[valIdx].formattedValue) : (row[row.length - 1] ? (row[row.length - 1].value ?? row[row.length - 1].formattedValue) : 0)
            const val = Number(valCell) || 0

            labels.push(String(lbl))
            values.push(val > 2 ? Number(val.toFixed(1)) : Number((val * 100).toFixed(1)))
        })
    }

    chartDataValues.value = {
        labels,
        data: values
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
        chartDataValues.value = { labels: [], data: [] }
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
        chartDataValues.value = { labels: [], data: [] }
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
    <PluginLayout :loading="loading" :error="error" title="Yield vs Budget YTD per Region–Area"
        bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-viii" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col w-full h-full overflow-hidden">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase">Yield vs Budget YTD per Region–Area · Aug
                </h3>
            </div>
            <div class="flex-1 relative min-h-0 w-full h-full">
                <canvas ref="chartCanvas"></canvas>
            </div>
        </div>
    </PluginLayout>
</template>