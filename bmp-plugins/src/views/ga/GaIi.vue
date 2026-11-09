<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const topDelayedActivities = ref([])

const requiredMarks = [
    { fieldName: 'Nama Aktivitas', target: 'Dimension (Activity Name)', description: 'Activity name granularity' },
    { fieldName: 'Cf Delay Days', target: 'Measure / Delay Days', description: 'Days difference from transaction date' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) {
        topDelayedActivities.value = []
        return
    }

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
    const activityColIdx = colNames.findIndex(c => /aktivitas|activity|name/i.test(c))
    const delayColIdx = colNames.findIndex(c => /delay|day|days/i.test(c))

    const activityMap = new Map()

    data.forEach(row => {
        const activity = activityColIdx >= 0 && row[activityColIdx] ? (row[activityColIdx].formattedValue ?? row[activityColIdx].value) : null
        const delayRaw = delayColIdx >= 0 && row[delayColIdx] ? Number(row[delayColIdx].value ?? row[delayColIdx].formattedValue) : 0
        const delayDays = !isNaN(delayRaw) ? Math.round(delayRaw) : 0

        if (activity) {
            activityMap.set(activity, { activity, delay: `${delayDays} Days` })
        }
    })

    const sorted = Array.from(activityMap.values()).sort((a, b) => parseInt(b.delay) - parseInt(a.delay)).slice(0, 10)
    topDelayedActivities.value = sorted
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
        topDelayedActivities.value = [
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
        topDelayedActivities.value = [
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
    <PluginLayout :loading="loading" :error="error" title="Top 10 Delayed Activity" bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/ga-ii" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-xs font-black text-slate-800 uppercase tracking-wide">Top 10 Delayed Activity</h3>
                    <span class="bg-[#F1F5F9] text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded">illustrative
                        data</span>
                </div>
                <div class="border border-[#E2E8F0] rounded overflow-hidden">
                    <table class="w-full text-left border-collapse text-[10px]">
                        <thead class="bg-[#F8FAFC] text-slate-600 border-b border-[#E2E8F0]">
                            <tr>
                                <th class="p-2 font-bold w-[50%]">Activity</th>
                                <th class="p-2 font-bold text-center">Delay</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#E2E8F0]">
                            <tr v-for="item in topDelayedActivities" :key="item.activity" class="hover:bg-[#F8FAFC]">
                                <td class="p-2 font-bold text-slate-800">{{ item.activity }}</td>
                                <td class="p-2 text-center font-bold text-[#EF4444]">{{ item.delay }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="text-[8px] text-slate-400 italic mt-2">
                Delay = days since transaction date (Tanggal) without realization · example figures for the mock-up.
            </div>
        </div>
    </PluginLayout>
</template>