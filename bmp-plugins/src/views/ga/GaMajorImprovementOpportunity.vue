<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

const improvements = ref([
    { category: 'Workforce', gap: '-46%' },
    { category: 'Upkeep', gap: '-28%' },
    { category: 'Soil & Water Conservation', gap: '-24%' },
    { category: 'Harvesting Round', gap: '-18%' },
    { category: 'Pest & Disease', gap: '-14%' },
    { category: 'Fertilizer', gap: '-10%' },
    { category: 'Yield (FFB)', gap: '-6%' }
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
                    let category = ''
                    let gap = '—'

                    for (let c = 0; c < columns.length; c++) {
                        const colName = String(columns[c].fieldName || columns[c].caption || '').toLowerCase()
                        const rawVal = row[c] ? (row[c].formattedValue ?? row[c].value) : null
                        const strVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim() : ''

                        if (colName.includes('category') || colName.includes('name') || (c === 0 && !category)) {
                            if (strVal && isNaN(strVal)) category = strVal
                        }
                        if (colName.includes('gap') || colName.includes('diff') || colName.includes('value') || (c === 1 && gap === '—')) {
                            if (typeof rawVal === 'number') {
                                gap = `${rawVal}%`
                            } else if (strVal) {
                                gap = strVal.includes('%') ? strVal : `${strVal}%`
                            }
                        }
                    }

                    if (!category && row[0]) category = String(row[0].formattedValue ?? row[0].value ?? '').trim()
                    if (gap === '—' && row[1]) {
                        const raw = row[1].formattedValue ?? row[1].value
                        if (typeof raw === 'number') {
                            gap = `${raw}%`
                        } else {
                            const str = String(raw ?? '').trim()
                            if (str) gap = str.includes('%') ? str : `${str}%`
                        }
                    }

                    if (category) {
                        parsedRows.push({ category, gap })
                    }
                })

                if (parsedRows.length > 0) {
                    improvements.value = parsedRows
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
    <PluginLayout :loading="loading" :error="error" title="Major Improvement Opportunity">
        <div class="flex flex-col justify-between h-full w-full">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-xs font-black text-slate-800 uppercase tracking-wide">Major Improvement Opportunity</h3>
                <span class="bg-[#F1F5F9] text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded">illustrative data</span>
            </div>

            <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
                <span class="text-[10px] text-slate-400">Please drag category and gap measures into marks.</span>
            </div>

            <div v-show="hasData" class="flex-1 border border-[#E2E8F0] rounded overflow-y-auto min-h-0">
                <table class="w-full text-left border-collapse text-[10px]">
                    <thead class="bg-[#F8FAFC] text-slate-600 border-b border-[#E2E8F0] sticky top-0">
                        <tr>
                            <th class="p-2 font-bold w-[60%]">Category</th>
                            <th class="p-2 font-bold text-center">Gap (BGT vs. ACT)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#E2E8F0]">
                        <tr v-for="(item, index) in improvements" :key="index" class="hover:bg-[#F8FAFC]">
                            <td class="p-2 font-bold text-slate-800">{{ item.category }}</td>
                            <td class="p-2 text-center font-bold text-[#EF4444]">{{ item.gap }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="text-[8px] text-slate-400 italic mt-1.5 flex-shrink-0">
                Gap = actual vs budget per category (Workforce, Manuring, OMS, SAP) · example figures for the mock-up.
            </div>
        </div>
    </PluginLayout>
</template>