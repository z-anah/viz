<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const majorImprovements = ref([])

const requiredMarks = [
    { fieldName: 'Nama Aktivitas', target: 'Dimension (Category)', description: 'Activity/Category name granularity' },
    { fieldName: 'Cf Gap Pct', target: 'Measure / Percentage', description: 'Gap percentage (Budget vs Actual)' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) {
        majorImprovements.value = []
        return
    }

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
    const catColIdx = colNames.findIndex(c => /aktivitas|activity|category|name/i.test(c))
    const gapColIdx = colNames.findIndex(c => /gap|pct|ratio|rate/i.test(c))

    const itemMap = new Map()

    data.forEach(row => {
        const category = catColIdx >= 0 && row[catColIdx] ? (row[catColIdx].formattedValue ?? row[catColIdx].value) : null
        const gapRaw = gapColIdx >= 0 && row[gapColIdx] ? Number(row[gapColIdx].value ?? row[gapColIdx].formattedValue) : 0
        const gapPct = !isNaN(gapRaw) ? Math.round(gapRaw * 100) : 0
        const gapStr = `${gapPct > 0 ? '+' : ''}${gapPct}%`

        if (category) {
            itemMap.set(category, { category, gap: gapStr })
        }
    })

    majorImprovements.value = Array.from(itemMap.values())
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
        majorImprovements.value = [
            { category: 'Workforce', gap: '-46%' },
            { category: 'Upkeep', gap: '-28%' },
            { category: 'Soil & Water Conservation', gap: '-24%' },
            { category: 'Harvesting Round', gap: '-18%' },
            { category: 'Pest & Disease', gap: '-14%' },
            { category: 'Fertilizer', gap: '-10%' },
            { category: 'Yield (FFB)', gap: '-6%' }
        ]
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
        majorImprovements.value = [
            { category: 'Workforce', gap: '-46%' },
            { category: 'Upkeep', gap: '-28%' },
            { category: 'Soil & Water Conservation', gap: '-24%' },
            { category: 'Harvesting Round', gap: '-18%' },
            { category: 'Pest & Disease', gap: '-14%' },
            { category: 'Fertilizer', gap: '-10%' },
            { category: 'Yield (FFB)', gap: '-6%' }
        ]
        error.value = ''
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
    <PluginLayout :loading="loading" :error="error" title="Major Improvement Opportunity"
        bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/ga-iii" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-xs font-black text-slate-800 uppercase tracking-wide">Major Improvement Opportunity
                    </h3>
                    <span class="bg-[#F1F5F9] text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded">illustrative
                        data</span>
                </div>
                <div class="border border-[#E2E8F0] rounded overflow-hidden">
                    <table class="w-full text-left border-collapse text-[10px]">
                        <thead class="bg-[#F8FAFC] text-slate-600 border-b border-[#E2E8F0]">
                            <tr>
                                <th class="p-2 font-bold w-[60%]">Category</th>
                                <th class="p-2 font-bold text-center">Gap (BGT vs. ACT)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#E2E8F0]">
                            <tr v-for="item in majorImprovements" :key="item.category" class="hover:bg-[#F8FAFC]">
                                <td class="p-2 font-bold text-slate-800">{{ item.category }}</td>
                                <td class="p-2 text-center font-bold text-[#EF4444]">{{ item.gap }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="text-[8px] text-slate-400 italic mt-2">
                Gap = actual vs budget per category (Workforce, Manuring, OMS, SAP) · example figures for the mock-up.
            </div>
        </div>
    </PluginLayout>
</template>