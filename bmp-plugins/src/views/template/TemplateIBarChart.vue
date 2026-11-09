<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const personInfo = ref({
    name: null,
    age: null,
    weight: null
})

const chartDataValues = ref({
    Breakfast: null,
    Lunch: null,
    Dinner: null,
    Snacks: null
})

const requiredMarks = [
    { fieldName: 'Category', target: 'Breakfast, Lunch, Dinner, Snacks', description: 'Dimension for categories' },
    { fieldName: 'Value', target: 'Numeric Value', description: 'Measure for bar height' },
    { fieldName: 'Person Name', target: 'Subject Name (e.g. Mike)', description: 'Dimension / Detail' },
    { fieldName: 'Person Age', target: 'Subject Age (e.g. 8)', description: 'Dimension / Measure' },
    { fieldName: 'Person Weight', target: 'Subject Weight (e.g. 45)', description: 'Dimension / Measure' }
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

    const labels = Object.keys(chartDataValues.value)
    const data = labels.map(label => chartDataValues.value[label] ?? 0)

    chartInstance = new Chart(chartCanvas.value, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Intake / Habits',
                    data: data,
                    backgroundColor: '#006D65',
                    barPercentage: 0.65,
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
                    enabled: isTableauMode.value,
                    callbacks: {
                        label: (context) => `Intake / Habits: ${Math.round(context.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: 8 },
                        stepSize: 1
                    },
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

    personInfo.value = { name: null, age: null, weight: null }
    Object.keys(chartDataValues.value).forEach(k => {
        chartDataValues.value[k] = null
    })

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())

    const categoryColIdx = colNames.findIndex(c => /category|meal|habit/i.test(c))
    const valueColIdx = colNames.findIndex(c => /value|count|intake|amount/i.test(c))
    const nameColIdx = colNames.findIndex(c => /name|person|subject/i.test(c))
    const ageColIdx = colNames.findIndex(c => /age/i.test(c))
    const weightColIdx = colNames.findIndex(c => /weight|kg/i.test(c))

    data.forEach(row => {
        const catRaw = categoryColIdx >= 0 && row[categoryColIdx] ? (row[categoryColIdx].formattedValue ?? row[categoryColIdx].value) : null
        const valRaw = valueColIdx >= 0 && row[valueColIdx] ? (row[valueColIdx].value ?? row[valueColIdx].formattedValue) : null

        if (catRaw && Object.prototype.hasOwnProperty.call(chartDataValues.value, String(catRaw).trim())) {
            chartDataValues.value[String(catRaw).trim()] = Number(valRaw) || 0
        }

        if (nameColIdx >= 0 && !personInfo.value.name && row[nameColIdx]) {
            personInfo.value.name = row[nameColIdx].formattedValue ?? row[nameColIdx].value ?? null
        }
        if (ageColIdx >= 0 && !personInfo.value.age && row[ageColIdx]) {
            personInfo.value.age = row[ageColIdx].formattedValue ?? row[ageColIdx].value ?? null
        }
        if (weightColIdx >= 0 && !personInfo.value.weight && row[weightColIdx]) {
            personInfo.value.weight = row[weightColIdx].formattedValue ?? row[weightColIdx].value ?? null
        }
    })
}

async function refreshTableauData() {
    if (!worksheet) return
    try {
        const table = await worksheet.getSummaryDataAsync()
        processTableauData(table)
        loading.value = false
        await renderChart()
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
        error.value = ''
        loading.value = false
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
    <PluginLayout :loading="loading" :error="error" title="Eating Habits" bgClass="bg-white">
        <!-- Reusable Required Marks Component for Fallback/Standalone Mode -->
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/template-i-bar-chart" />

        <!-- Active Tableau Mode View -->
        <div v-else class="flex flex-col justify-between h-full w-full p-4 box-border overflow-hidden">
            <div class="flex items-center justify-between mb-1 min-w-0">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase">
                    Eating Habits
                </h3>
                <div class="text-right bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs shadow-2xs">
                    <div class="font-semibold text-slate-800">
                        {{ personInfo.name ? personInfo.name : '—' }}
                    </div>
                    <div class="text-slate-500">
                        Age: {{ personInfo.age ? personInfo.age + ' yo' : '_' }} |
                        Weight: {{ personInfo.weight ? personInfo.weight + ' kg' : '_' }}
                    </div>
                </div>
            </div>

            <div class="flex-1 relative min-h-0 w-full h-full my-2">
                <canvas ref="chartCanvas"></canvas>
            </div>

            <div class="flex items-center justify-center gap-6 mt-2 pt-2 border-t border-slate-100 text-xs">
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-full bg-[#006D65]"></span>
                    <span class="text-slate-600">Breakfast: <strong class="text-slate-900">{{ chartDataValues.Breakfast
                        ?? '_' }}</strong></span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-full bg-[#006D65]"></span>
                    <span class="text-slate-600">Lunch: <strong class="text-slate-900">{{ chartDataValues.Lunch ?? '_'
                    }}</strong></span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-full bg-[#006D65]"></span>
                    <span class="text-slate-600">Dinner: <strong class="text-slate-900">{{ chartDataValues.Dinner ?? '_'
                    }}</strong></span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-full bg-[#006D65]"></span>
                    <span class="text-slate-600">Snacks: <strong class="text-slate-900">{{ chartDataValues.Snacks ?? '_'
                    }}</strong></span>
                </div>
            </div>
        </div>
    </PluginLayout>
</template>