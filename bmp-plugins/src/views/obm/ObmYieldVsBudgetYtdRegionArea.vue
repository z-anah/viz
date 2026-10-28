<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import Chart from 'chart.js/auto'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

let chartInstance = null
let worksheet = null
let eventHandler = null

function initChart(labels, values) {
    const ctx = document.getElementById('yieldVsBudgetChart')
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
                    label: 'Yield vs Budget YTD',
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    min: 50,
                    max: 120,
                    ticks: {
                        font: { size: 8 },
                        callback: (value) => `${value}%`
                    },
                    grid: { color: '#F1F5F9' }
                },
                x: {
                    ticks: { font: { size: 8 } },
                    grid: { display: false }
                }
            }
        },
        plugins: [{
            id: 'customDataLabels',
            afterDatasetsDraw(chart) {
                const { ctx, data } = chart
                ctx.save()
                ctx.font = 'bold 9px sans-serif'
                ctx.fillStyle = '#334155'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'bottom'

                chart.getDatasetMeta(0).data.forEach((bar, index) => {
                    const value = data.datasets[0].data[index]
                    const text = `${value}%`
                    ctx.fillText(text, bar.x, bar.y - 4)
                })
                ctx.restore()
            }
        }]
    })
}

onMounted(async () => {
    await nextTick()

    if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== "function") {
        loading.value = false
        hasData.value = true
        await nextTick()
        initChart(
            ['SUM-1', 'SUM-2', 'SUM-3', 'SUM-4', 'KAL-1', 'KAL-2', 'KAL-3'],
            [98, 108, 90, 89, 93, 114, 102]
        )
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
                const colNames = columns.map(col => String(col.fieldName || col.caption || '').trim())
                
                const labels = []
                const values = []

                data.forEach((row) => {
                    let label = ''
                    let val = 0

                    for (let c = 0; c < columns.length; c++) {
                        const colName = colNames[c].toLowerCase()
                        const cellVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim() : ''
                        const rawVal = row[c] ? (row[c].formattedValue ?? row[c].value) : null
                        const numVal = typeof rawVal === "number" ? rawVal : (rawVal == null || rawVal === "" ? 0 : Number(String(rawVal).replace(/,/g, "").trim()))

                        if (colName.includes('area') || colName.includes('region') || colName.includes('name') || c === 0) {
                            if (cellVal && isNaN(cellVal)) label = cellVal
                        }
                        if (colName.includes('yield') || colName.includes('budget') || colName.includes('vs') || c === 1) {
                            if (!isNaN(numVal)) val = numVal
                        }
                    }

                    if (label) {
                        labels.push(label)
                        values.push(val)
                    }
                })

                if (labels.length > 0) {
                    hasData.value = true
                    loading.value = false
                    await nextTick()
                    initChart(labels, values)
                    return
                }
            }

            hasData.value = false
            if (chartInstance) {
                chartInstance.destroy()
                chartInstance = null
            }
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
    if (chartInstance) {
        chartInstance.destroy()
    }
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Yield vs Budget YTD per Region–Area">
        <div class="flex flex-col justify-between h-full w-full">
            <div class="flex items-center justify-between mb-1 min-w-0">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase truncate">Yield vs Budget YTD per Region–Area · Aug</h3>
            </div>

            <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
                <span class="text-[10px] text-slate-400">Please drag Region-Area and Yield vs Budget measures into marks.</span>
            </div>

            <div v-show="hasData" class="flex-1 relative min-h-0 w-full h-full">
                <canvas id="yieldVsBudgetChart"></canvas>
            </div>
        </div>
    </PluginLayout>
</template>