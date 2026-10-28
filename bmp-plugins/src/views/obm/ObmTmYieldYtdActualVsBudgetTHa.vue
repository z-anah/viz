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

function initChart(labels, actVals, bgtVals) {
    const ctx = document.getElementById('yieldChart')
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
                    label: 'Budget',
                    data: bgtVals,
                    backgroundColor: '#CBD5E1',
                    barPercentage: 0.6,
                    categoryPercentage: 0.6
                },
                {
                    label: 'Actual',
                    data: actVals,
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
        initChart(
            ['SUM Jun', 'SUM Jul', 'SUM Aug', 'KAL Jun', 'KAL Jul', 'KAL Aug'],
            [11.90, 15.20, 17.20, 10.90, 13.25, 15.30],
            [11.80, 15.09, 17.15, 10.87, 13.19, 15.27]
        )
        return
    }

    try {
        await tableau.extensions.initializeAsync()
        await new Promise(resolve => setTimeout(resolve, 1500))

        const dashboard = tableau.extensions.dashboardContent?.dashboard
        if (dashboard) {
            const worksheets = dashboard.worksheets
            worksheet = worksheets.find(w => w.name === tableau.extensions.settings.get('worksheet')) || worksheets[0]
        }
        if (!worksheet && tableau.extensions.worksheetContent) {
            worksheet = tableau.extensions.worksheetContent.worksheet
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
                const row = data[0]

                const labels = ['SUM Jun', 'SUM Jul', 'SUM Aug', 'KAL Jun', 'KAL Jul', 'KAL Aug']
                const actVals = [0, 0, 0, 0, 0, 0]
                const bgtVals = [0, 0, 0, 0, 0, 0]
                let matchedCount = 0

                colNames.forEach((name, index) => {
                    const rawVal = row[index] ? (row[index].formattedValue ?? row[index].value) : null
                    const val = typeof rawVal === "number" ? rawVal : (rawVal == null || rawVal === "" ? 0 : Number(String(rawVal).replace(/,/g, "").trim()))
                    const lowerName = name.toLowerCase()

                    const isBudget = lowerName.includes('budget') || lowerName.includes('bgt')
                    const isKal = lowerName.includes('kal')

                    let targetIndex = -1
                    if (lowerName.includes('jun')) {
                        targetIndex = isKal ? 3 : 0
                    } else if (lowerName.includes('jul')) {
                        targetIndex = isKal ? 4 : 1
                    } else if (lowerName.includes('aug')) {
                        targetIndex = isKal ? 5 : 2
                    }

                    if (targetIndex !== -1) {
                        matchedCount++
                        if (isBudget) {
                            bgtVals[targetIndex] = val
                        } else {
                            actVals[targetIndex] = val
                        }
                    }
                })

                if (matchedCount > 0) {
                    hasData.value = true
                    loading.value = false
                    await nextTick()
                    initChart(labels, actVals, bgtVals)
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

        worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, eventHandler)

    } catch (err) {
        error.value = `Error: ${err.message}`
        hasData.value = false
        loading.value = false
    }
})

onBeforeUnmount(() => {
    if (worksheet && eventHandler) {
        worksheet.removeEventListener(tableau.TableauEventType.SummaryDataChanged, eventHandler)
    }
    if (chartInstance) {
        chartInstance.destroy()
    }
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Yield Chart Data">
        <div class="flex flex-col justify-between h-full w-full">
            <div class="flex items-center justify-between mb-1 min-w-0">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase">TM Yield YTD · Actual vs Budget
                    (t/ha)</h3>
                <div class="flex items-center space-x-2 text-[9px] text-[#00463E]/80 font-medium shrink-0">
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#CBD5E1] border border-slate-300 mr-1 inline-block rounded-xs"></span>Budget</span>
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#006D65] mr-1 inline-block rounded-xs"></span>Actual</span>
                </div>
            </div>

            <div v-if="!hasData && !loading"
                class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
                <span class="text-[10px] text-slate-400">Please drag measures/dimensions into the worksheet
                    marks.</span>
            </div>

            <div v-show="hasData" class="flex-1 relative min-h-0 w-full h-full">
                <canvas id="yieldChart"></canvas>
            </div>
        </div>
    </PluginLayout>
</template>