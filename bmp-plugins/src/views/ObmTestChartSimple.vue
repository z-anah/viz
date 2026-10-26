<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import Chart from 'chart.js/auto'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

let chartInstance = null

function initChart(labels, values) {
    const ctx = document.getElementById('simpleTestChart')
    if (!ctx) return

    if (chartInstance) {
        chartInstance.destroy()
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Tableau Data',
                    data: values,
                    backgroundColor: '#006D65',
                    barPercentage: 0.6,
                    categoryPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { font: { size: 8 } }, grid: { color: '#F1F5F9' } },
                x: { ticks: { font: { size: 8 } }, grid: { display: false } }
            }
        }
    })
}

onMounted(async () => {
    await nextTick()

    if (!window.tableau?.extensions || typeof tableau.extensions.initializeAsync !== "function") {
        loading.value = false
        hasData.value = true
        await nextTick()
        initChart(['Fallback A', 'Fallback B', 'Fallback C'], [10, 20, 30])
        return
    }

    try {
        await tableau.extensions.initializeAsync()
        await new Promise(resolve => setTimeout(resolve, 2000))

        let ws = null
        const dashboard = tableau.extensions.dashboardContent?.dashboard
        if (dashboard) {
            const worksheets = dashboard.worksheets
            ws = worksheets.find(w => w.name === tableau.extensions.settings.get('worksheet')) || worksheets[0]
        }
        if (!ws) {
            ws = tableau.extensions.worksheetContent.worksheet
        }

        if (!ws) {
            throw new Error('No Tableau worksheet found.')
        }

        const fetchWorksheetData = async () => {
            const table = await ws.getSummaryDataAsync()
            const columns = table.columns || []
            const data = table.data || []

            if (data.length > 0) {
                const labels = []
                const values = []

                data.forEach((row, i) => {
                    let label = `Item ${i + 1}`
                    let val = 0

                    for (let c = 0; c < columns.length; c++) {
                        const colName = String(columns[c].fieldName || columns[c].caption || '').toLowerCase()
                        const cellVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim() : ''
                        const rawVal = row[c] ? (row[c].formattedValue ?? row[c].value) : null
                        const numVal = typeof rawVal === "number" ? rawVal : (rawVal == null || rawVal === "" ? NaN : Number(String(rawVal).replace(/,/g, "").trim()))

                        if (colName.includes('name') || colName.includes('category') || colName.includes('area') || c === 0) {
                            if (cellVal && isNaN(cellVal)) label = cellVal
                        }
                        if (!isNaN(numVal)) {
                            val = numVal
                        }
                    }

                    labels.push(label)
                    values.push(val)
                })

                if (labels.length > 0) {
                    hasData.value = true
                    loading.value = false
                    await nextTick()
                    await nextTick()
                    initChart(labels, values)
                }
            }
            loading.value = false
        }

        await fetchWorksheetData()

        ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, async () => {
            await fetchWorksheetData()
        })

    } catch (err) {
        error.value = `Error: ${err.message}`
        loading.value = false
    }
})

onBeforeUnmount(() => {
    if (chartInstance) {
        chartInstance.destroy()
    }
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Simple Test Chart">
        <div class="flex items-center justify-between mb-1 min-w-0">
            <h3 class="text-[11px] font-bold text-[#00463E] uppercase truncate">Simple Test Chart</h3>
        </div>

        <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
            <span class="mb-2">Not loaded yet</span>
        </div>

        <div v-show="hasData" class="flex-1 relative min-h-0 w-full h-full">
            <canvas id="simpleTestChart"></canvas>
        </div>
    </PluginLayout>
</template>