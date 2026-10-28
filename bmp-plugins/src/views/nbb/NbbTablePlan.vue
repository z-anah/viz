<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

const sections = ref([
    {
        title: 'Upkeep Management · 20%',
        summaryAch: '40.8%',
        items: [
            { activity: 'Circle Weeding – Manual', w: '15', plan: '97.2', real: '64.8', mtd: '0%', ytd: '67%', score: '10.0', bmp: '50%', color: 'text-[#F59E0B]' },
            { activity: 'Inter-row Weeding – Manual', w: '10', plan: '32.4', real: '16.2', mtd: '—', ytd: '50%', score: '5.0', bmp: '50%', color: 'text-[#F59E0B]' },
            { activity: 'Path Cleaning – Manual', w: '10', plan: '97.2', real: '32.4', mtd: '0%', ytd: '33%', score: '3.3', bmp: '0%', color: 'text-[#EF4444]' },
            { activity: 'Circle & Path W. – Chem', w: '15', plan: '64.8', real: '32.4', mtd: '—', ytd: '50%', score: '7.5', bmp: '100%', color: 'text-[#10B981]' },
            { activity: 'Path Weeding – Chemical', w: '5', plan: '32.4', real: '0', mtd: '—', ytd: '0%', score: '0.0', bmp: '0%', color: 'text-[#EF4444]' },
            { activity: 'Selective Weeding – Chemical', w: '10', plan: '32.4', real: '16.2', mtd: '—', ytd: '50%', score: '5.0', bmp: '50%', color: 'text-[#F59E0B]' },
            { activity: 'Spot Spraying (Imperata)', w: '5', plan: '64.8', real: '0', mtd: '0%', ytd: '0%', score: '0.0', bmp: '0%', color: 'text-[#EF4444]' },
            { activity: 'Wiping (Imperata)', w: '10', plan: '64.8', real: '0', mtd: '0%', ytd: '0%', score: '0.0', bmp: '0%', color: 'text-[#EF4444]' },
            { activity: 'Pruning', w: '20', plan: '32.4', real: '16.2', mtd: '50%', ytd: '50%', score: '10.0', bmp: '100%', color: 'text-[#10B981]' }
        ]
    },
    {
        title: 'Soil and Water Conservation · 10%',
        summaryAch: '25.0%',
        items: [
            { activity: 'Foot Bridges', w: '50', plan: '32.4', real: '8.1', mtd: '0%', ytd: '25%', score: '12.5', bmp: '50%', color: 'text-[#F59E0B]' },
            { activity: 'Trench Maintenance', w: '50', plan: '4', real: '1', mtd: '—', ytd: '25%', score: '12.5', bmp: '100%', color: 'text-[#10B981]' }
        ]
    }
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
            const data = table.data || []
            if (data.length > 0) {
                hasData.value = true
                loading.value = false
                return
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
    <PluginLayout :loading="loading" :error="error" title="Table Plan" bgClass="bg-transparent">
        <div class="flex flex-col h-full w-full">
            <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
            </div>

            <div v-show="hasData" class="flex-1 overflow-auto min-h-0 border border-[#00463E] rounded bg-white">
                <table class="w-full text-left border-collapse text-[10px]">
                    <thead class="bg-[#00463E] text-white sticky top-0 z-10">
                        <tr>
                            <th class="p-2 font-bold w-[30%]">Activity</th>
                            <th class="p-2 font-bold text-center w-[6%]">W %</th>
                            <th class="p-2 font-bold text-center w-[9%]">Plan</th>
                            <th class="p-2 font-bold text-center w-[9%]">Real</th>
                            <th class="p-2 font-bold text-center w-[11%]">Ach. MTD</th>
                            <th class="p-2 font-bold text-center w-[11%]">Ach. YTD</th>
                            <th class="p-2 font-bold text-center w-[11%]">Score</th>
                            <th class="p-2 font-bold text-center w-[13%]">Ach. BMP block</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#E2E8F0]">
                        <template v-for="(section, sIndex) in sections" :key="sIndex">
                            <tr class="bg-[#F8FAFC] border-y border-[#E2E8F0]">
                                <td colspan="7" class="p-2 font-black text-[#00463E]">
                                    {{ section.title }}
                                </td>
                                <td class="p-2 font-black text-right text-[#00463E]">
                                    {{ section.summaryAch }}
                                </td>
                            </tr>
                            <tr v-for="(item, iIndex) in section.items" :key="iIndex" class="hover:bg-slate-50">
                                <td class="p-2 text-slate-800 font-medium pl-4">{{ item.activity }}</td>
                                <td class="p-2 text-center text-slate-600">{{ item.w }}</td>
                                <td class="p-2 text-center text-slate-600">{{ item.plan }}</td>
                                <td class="p-2 text-center text-slate-600">{{ item.real }}</td>
                                <td class="p-2 text-center text-slate-600">{{ item.mtd }}</td>
                                <td :class="['p-2 text-center font-bold', item.color]">{{ item.ytd }}</td>
                                <td class="p-2 text-center text-slate-700 font-medium">{{ item.score }}</td>
                                <td :class="['p-2 text-center font-bold', item.color]">{{ item.bmp }}</td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>
    </PluginLayout>
</template>