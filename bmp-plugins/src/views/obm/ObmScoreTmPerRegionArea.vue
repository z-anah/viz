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

// Helper to get dynamic rolling 3-month labels ending at a target date
function getDynamicMonths(targetDateStr = 'Aug 2026') {
    const baseDate = new Date(`1 ${targetDateStr}`)
    const months = []
    for (let i = 2; i >= 0; i--) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1)
        months.push({
            name: d.toLocaleString('en-US', { month: 'short' }),
            fullName: d.toLocaleString('en-US', { month: 'long' }),
            year: d.getFullYear()
        })
    }
    return months
}

const activeMonths = getDynamicMonths('Aug 2026')

function initChart(labels, m1Vals, m2Vals, m3Vals) {
    const ctx = document.getElementById('scoreChart')
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
                    label: activeMonths[0].name,
                    data: m1Vals,
                    backgroundColor: '#D1FAE5',
                    barPercentage: 0.7,
                    categoryPercentage: 0.7
                },
                {
                    label: activeMonths[1].name,
                    data: m2Vals,
                    backgroundColor: '#00D0BC',
                    barPercentage: 0.7,
                    categoryPercentage: 0.7
                },
                {
                    label: activeMonths[2].name,
                    data: m3Vals,
                    backgroundColor: '#006D65',
                    barPercentage: 0.7,
                    categoryPercentage: 0.7
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

    if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== "function") {
        loading.value = false
        hasData.value = true
        await nextTick()
        initChart(
            ['SUM-1', 'SUM-2', 'SUM-3', 'SUM-4', 'KAL-1', 'KAL-2', 'KAL-3'],
            [80, 70, 75, 72, 78, 70, 68],
            [83, 72, 73, 71, 79, 72, 70],
            [88, 75, 74, 73, 81, 72, 70]
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
                const m1Vals = []
                const m2Vals = []
                const m3Vals = []

                data.forEach((row) => {
                    let label = ''
                    let v1 = 0
                    let v2 = 0
                    let v3 = 0

                    for (let c = 0; c < columns.length; c++) {
                        const colName = colNames[c].toLowerCase()
                        const rawVal = row[c] ? (row[c].formattedValue ?? row[c].value) : null
                        const cellVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim() : ''
                        const numVal = typeof rawVal === "number" ? rawVal : (rawVal == null || rawVal === "" ? 0 : Number(String(rawVal).replace(/,/g, "").trim()))

                        // Strictly target area/region columns and ignore null or numeric strings
                        if (colName.includes('area') || colName.includes('region') || colName.includes('name')) {
                            if (cellVal && cellVal.toLowerCase() !== 'null' && cellVal !== '' && isNaN(cellVal)) {
                                label = cellVal
                            }
                        }

                        if (colName.includes(activeMonths[0].name.toLowerCase())) v1 = numVal
                        else if (colName.includes(activeMonths[1].name.toLowerCase())) v2 = numVal
                        else if (colName.includes(activeMonths[2].name.toLowerCase())) v3 = numVal
                    }

                    // Only push if a valid non-null label exists
                    if (label && label.toLowerCase() !== 'null') {
                        labels.push(label)
                        m1Vals.push(v1)
                        m2Vals.push(v2)
                        m3Vals.push(v3)
                    }
                })

                const validLabels = labels.filter(l => l !== '' && l.toLowerCase() !== 'null')
                if (validLabels.length > 0) {
                    hasData.value = true
                    loading.value = false
                    await nextTick()
                    initChart(labels, m1Vals, m2Vals, m3Vals)
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
    <PluginLayout :error="error" :loading="loading" title="BMP Score TM per Region–Area">
        <div class="flex flex-col justify-between h-full w-full">
            <div class="flex items-center justify-between mb-1 min-w-0">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase">
                    BMP Score TM per Region–Area · {{ activeMonths[0].name }}–{{ activeMonths[2].name }}
                </h3>
                <div class="flex items-center space-x-2 text-[9px] text-[#00463E]/80 font-medium shrink-0">
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#D1FAE5] mr-1 inline-block rounded-xs"></span>{{ activeMonths[0].name
                            }}</span>
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#00D0BC] mr-1 inline-block rounded-xs"></span>{{ activeMonths[1].name
                            }}</span>
                    <span class="flex items-center"><span
                            class="w-2 h-2 bg-[#006D65] mr-1 inline-block rounded-xs"></span>{{ activeMonths[2].name
                            }}</span>
                </div>
            </div>

            <div v-if="!hasData && !loading"
                class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
                <span class="text-[10px] text-slate-400">Please drag Cf Region and Monthly Score measures into
                    marks.</span>
            </div>

            <div v-show="hasData" class="flex-1 relative min-h-0 w-full h-full">
                <canvas id="scoreChart"></canvas>
            </div>
        </div>
    </PluginLayout>
</template>