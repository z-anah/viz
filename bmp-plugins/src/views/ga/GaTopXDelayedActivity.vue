<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import { numericValue } from '@/utils/tableauHelpers'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

const delayedActivities = ref([
    { activity: 'A&CI Assessment', delay: '123 Days' },
    { activity: 'Path Weeding – Chemical', delay: '66 Days' },
    { activity: 'Urea', delay: '56 Days' },
    { activity: 'Trench Maintenance', delay: '48 Days' },
    { activity: 'Gupon (1:25)', delay: '47 Days' },
    { activity: 'Pruning', delay: '45 Days' },
    { activity: 'Foot Bridges', delay: '43 Days' },
    { activity: 'Spot Spraying (Imperata)', delay: '37 Days' },
    { activity: 'Rodent Pest Census', delay: '35 Days' },
    { activity: 'Circle Weeding – Manual', delay: '31 Days' }
])

let worksheet = null
let eventHandler = null

onMounted(async () => {
    await nextTick()

    if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== "function") {
        loading.value = false
        hasData.value = true
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
                const parsedRows = []
                data.forEach((row) => {
                    let activity = ''
                    let delay = '—'

                    for (let c = 0; c < columns.length; c++) {
                        const colName = String(columns[c].fieldName || columns[c].caption || '').toLowerCase()
                        const rawVal = row[c] ? (row[c].formattedValue ?? row[c].value) : null
                        const strVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim() : ''

                        if (colName.includes('activity') || colName.includes('name') || (c === 0 && !activity)) {
                            if (strVal && isNaN(strVal)) activity = strVal
                        }
                        if (colName.includes('delay') || colName.includes('days') || (c === 1 && delay === '—')) {
                            if (typeof rawVal === 'number') {
                                delay = `${rawVal} Days`
                            } else if (strVal) {
                                delay = strVal.toLowerCase().includes('day') ? strVal : `${strVal} Days`
                            }
                        }
                    }

                    if (!activity && row[0]) activity = String(row[0].formattedValue ?? row[0].value ?? '').trim()
                    if (delay === '—' && row[1]) {
                        const raw = row[1].formattedValue ?? row[1].value
                        if (typeof raw === 'number') {
                            delay = `${raw} Days`
                        } else {
                            const str = String(raw ?? '').trim()
                            if (str) delay = str.toLowerCase().includes('day') ? str : `${str} Days`
                        }
                    }

                    if (activity) {
                        parsedRows.push({ activity, delay })
                    }
                })

                if (parsedRows.length > 0) {
                    delayedActivities.value = parsedRows
                    hasData.value = true
                    loading.value = false
                    return
                }
            }

            hasData.value = false
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
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Top 10 Delayed Activity">
        <div class="flex flex-col justify-between h-full w-full">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-wide">Top 10 Delayed Activity</h3>
                <span class="bg-[#F1F5F9] text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded">illustrative data</span>
            </div>

            <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
                <span class="text-[10px] text-slate-400">Please drag activity and delay measures into marks.</span>
            </div>

            <div v-show="hasData" class="flex-1 border border-[#E2E8F0] rounded overflow-y-auto min-h-0">
                <table class="w-full text-left border-collapse text-[10px]">
                    <thead class="bg-[#F8FAFC] text-slate-600 border-b border-[#E2E8F0] sticky top-0">
                        <tr>
                            <th class="p-2 font-bold w-[60%]">Activity</th>
                            <th class="p-2 font-bold text-center">Delay</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#E2E8F0]">
                        <tr v-for="(item, index) in delayedActivities" :key="index" class="hover:bg-[#F8FAFC]">
                            <td class="p-2 font-bold text-slate-800">{{ item.activity }}</td>
                            <td class="p-2 text-center font-bold text-[#EF4444]">{{ item.delay }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="text-[8px] text-slate-400 italic mt-1.5 flex-shrink-0">
                Delay = days since planned due date (OMS) without realization · example figures for the mock-up.
            </div>
        </div>
    </PluginLayout>
</template>