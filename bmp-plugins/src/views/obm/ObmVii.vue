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
    jun: [],
    jul: [],
    aug: []
})

const requiredMarks = [
    { fieldName: 'Cf Dynamic Granularity', target: 'Dimension', description: 'Region-Area granularity' },
    { fieldName: 'Periode', target: 'Dimension / Filter', description: 'Month period (Jun, Jul, Aug)' },
    { fieldName: 'Cf Bmp Score', target: 'Measure', description: 'BMP Score value' }
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
                    label: 'Jun',
                    data: chartDataValues.value.jun,
                    backgroundColor: '#D1FAE5',
                    barPercentage: 0.7,
                    categoryPercentage: 0.7
                },
                {
                    label: 'Jul',
                    data: chartDataValues.value.jul,
                    backgroundColor: '#00D0BC',
                    barPercentage: 0.7,
                    categoryPercentage: 0.7
                },
                {
                    label: 'Aug',
                    data: chartDataValues.value.aug,
                    backgroundColor: '#006D65',
                    barPercentage: 0.7,
                    categoryPercentage: 0.7
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

    const labelsMap = new Map()

    if (data.length > 0) {
        const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
        const granIdx = colNames.findIndex(c => /granularity|region|area|estate|name/i.test(c))
        const periodIdx = colNames.findIndex(c => /period|month|periode/i.test(c))
        const scoreIdx = colNames.findIndex(c => /score|bmp|value|sum/i.test(c))

        data.forEach(row => {
            const gran = granIdx >= 0 && row[granIdx] ? String(row[granIdx].formattedValue ?? row[granIdx].value) : 'Area'
            const period = periodIdx >= 0 && row[periodIdx] ? String(row[periodIdx].formattedValue ?? row[periodIdx].value).toLowerCase() : 'jun'
            const score = scoreIdx >= 0 && row[scoreIdx] ? Number(row[scoreIdx].value ?? row[scoreIdx].formattedValue) : 0

            if (!labelsMap.has(gran)) {
                labelsMap.set(gran, { jun: 0, jul: 0, aug: 0 })
            }
            const item = labelsMap.get(gran)
            const val = !isNaN(score) ? score : 0

            if (/jun|6/i.test(period)) item.jun = val
            else if (/jul|7/i.test(period)) item.jul = val
            else if (/aug|8/i.test(period)) item.aug = val
        })
    }

    const labels = Array.from(labelsMap.keys())
    const jun = labels.map(l => labelsMap.get(l).jun)
    const jul = labels.map(l => labelsMap.get(l).jul)
    const aug = labels.map(l => labelsMap.get(l).aug)

    chartDataValues.value = { labels, jun, jul, aug }
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
        chartDataValues.value = { labels: [], jun: [], jul: [], aug: [] }
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
        chartDataValues.value = { labels: [], jun: [], jul: [], aug: [] }
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
    <PluginLayout :loading="loading" :error="error" title="BMP Score TM per Region–Area"
        bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-vii" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col w-full h-full overflow-hidden">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase">BMP Score TM per Region–Area · Jun–Aug</h3>
                <div class="flex items-center space-x-2 text-[9px] text-[#00463E]/80 font-medium">
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#D1FAE5] mr-1 inline-block rounded-xs"></span>Jun</span>
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#00D0BC] mr-1 inline-block rounded-xs"></span>Jul</span>
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#006D65] mr-1 inline-block rounded-xs"></span>Aug</span>
                </div>
            </div>
            <div class="flex-1 relative min-h-0 w-full h-full">
                <canvas ref="chartCanvas"></canvas>
            </div>
        </div>
    </PluginLayout>
</template>