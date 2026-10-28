<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

const kpis = ref([
    { title: 'Upkeep Management', weight: 'weight 20%', planLabel: 'Planned', planVal: '9 act.', realLabel: 'Realized', realVal: '5 act.', ach: '52.5%', sub: 'activities · weighted ach.', isYield: false },
    { title: 'Soil & Water Conservation', weight: 'weight 10%', planLabel: 'Planned', planVal: '2 act.', realLabel: 'Realized', realVal: '2 act.', ach: '75.0%', sub: 'activities · weighted ach.', isYield: false },
    { title: 'Nutrient Management', weight: 'weight 30%', planLabel: 'Planned', planVal: '6 act.', realLabel: 'Realized', realVal: '5 act.', ach: '51.9%', sub: 'activities · weighted ach.', isYield: false },
    { title: 'Crop Management', weight: 'weight 30%', planLabel: 'Planned', planVal: '3 act.', realLabel: 'Realized', realVal: '3 act.', ach: '84.9%', sub: 'activities · weighted ach.', isYield: false },
    { title: 'Integrated Pest & Disease', weight: 'weight 10%', planLabel: 'Planned', planVal: '6 act.', realLabel: 'Realized', realVal: '6 act.', ach: '75.8%', sub: 'activities · weighted ach.', isYield: false },
    { title: 'Yield Gap Production', weight: 'weight 100% (Output)', planLabel: 'Budget', planVal: '16.40', realLabel: 'Actual', realVal: '13.84', ach: '89.6%', sub: 't/ha YTD · Ach. = 50% Bgt + 50% BBC', isYield: true, bbc: '14.60' }
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
    <PluginLayout :loading="loading" :error="error" title="All KPIs" bgClass="bg-slate-50">
        <div class="flex items-center justify-center h-full w-full min-w-[700px]">
            <div class="grid grid-cols-6 gap-2 w-full h-full">
                <div v-for="(kpi, idx) in kpis" :key="idx" class="bg-white rounded-md p-2 border border-[#10B981]/50 shadow-2xs flex flex-col justify-between">
                    <div>
                        <div class="text-[10px] font-bold text-slate-800 truncate">{{ kpi.title }}</div>
                        <div class="text-[8px] text-slate-400 mb-1.5">{{ kpi.weight }}</div>
                        
                        <div v-if="!kpi.isYield" class="grid grid-cols-3 gap-1 text-center pt-1">
                            <div>
                                <span class="block text-[8px] text-slate-400">{{ kpi.planLabel }}</span>
                                <strong class="text-xs font-black text-slate-800 truncate">{{ kpi.planVal }}</strong>
                            </div>
                            <div>
                                <span class="block text-[8px] text-slate-400">{{ kpi.realLabel }}</span>
                                <strong class="text-xs font-black text-slate-800 truncate">{{ kpi.realVal }}</strong>
                            </div>
                            <div>
                                <span class="block text-[8px] text-slate-400">Ach.</span>
                                <strong class="text-xs font-black text-[#F59E0B] truncate">{{ kpi.ach }}</strong>
                            </div>
                        </div>

                        <div v-else class="grid grid-cols-4 gap-0.5 text-center pt-1">
                            <div>
                                <span class="block text-[8px] text-slate-400">Budget</span>
                                <strong class="text-[10px] font-black text-slate-800 truncate">{{ kpi.planVal }}</strong>
                            </div>
                            <div>
                                <span class="block text-[8px] text-slate-400">BBC</span>
                                <strong class="text-[10px] font-black text-slate-800 truncate">{{ kpi.bbc }}</strong>
                            </div>
                            <div>
                                <span class="block text-[8px] text-slate-400">Actual</span>
                                <strong class="text-[10px] font-black text-slate-800 truncate">{{ kpi.realVal }}</strong>
                            </div>
                            <div>
                                <span class="block text-[8px] text-slate-400">Ach.</span>
                                <strong class="text-[10px] font-black text-[#F59E0B] truncate">{{ kpi.ach }}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="text-[8px] text-slate-400 mt-1 truncate">{{ kpi.sub }}</div>
                </div>
            </div>
        </div>
    </PluginLayout>
</template>