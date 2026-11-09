<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const upkeep = ref({ planned: '9 act.', realized: '5 act.', ach: '52.5%' })
const soilWater = ref({ planned: '2 act.', realized: '2 act.', ach: '75.0%' })
const nutrient = ref({ planned: '6 act.', realized: '5 act.', ach: '51.9%' })
const crop = ref({ planned: '3 act.', realized: '3 act.', ach: '84.9%' })
const pest = ref({ planned: '6 act.', realized: '6 act.', ach: '75.8%' })
const yieldData = ref({ budget: '16.40', bbc: '14.60', actual: '13.84', ach: '89.6%' })

const requiredMarks = [
    { fieldName: 'Cf Bmp Activity Category', target: 'Dimension', description: 'BMP Category name' },
    { fieldName: 'Cf Planned Activity Count', target: 'Measure', description: 'Planned activities count' },
    { fieldName: 'Cf Realized Activity Count', target: 'Measure', description: 'Realized activities count' },
    { fieldName: 'Cf Category Achievement', target: 'Measure', description: 'Category achievement percentage' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
    const catIdx = colNames.findIndex(c => /category|kategori|activity|nama/i.test(c))
    const planIdx = colNames.findIndex(c => /planned|plan|target/i.test(c))
    const realIdx = colNames.findIndex(c => /realized|real|aktual/i.test(c))
    const achIdx = colNames.findIndex(c => /ach|achievement|score/i.test(c))

    data.forEach(row => {
        const cat = catIdx >= 0 && row[catIdx] ? String(row[catIdx].formattedValue ?? row[catIdx].value).toLowerCase() : ''
        const plan = planIdx >= 0 && row[planIdx] ? (row[planIdx].formattedValue ?? row[planIdx].value) : null
        const real = realIdx >= 0 && row[realIdx] ? (row[realIdx].formattedValue ?? row[realIdx].value) : null
        const achVal = achIdx >= 0 && row[achIdx] ? Number(row[achIdx].value ?? row[achIdx].formattedValue) : null
        const achStr = achVal !== null ? (!isNaN(achVal) ? (achVal > 1 ? `${achVal.toFixed(1)}%` : `${(achVal * 100).toFixed(1)}%`) : null) : null

        if (/upkeep/i.test(cat)) {
            if (plan) upkeep.value.planned = `${plan} act.`
            if (real) upkeep.value.realized = `${real} act.`
            if (achStr) upkeep.value.ach = achStr
        } else if (/soil|water|conservation/i.test(cat)) {
            if (plan) soilWater.value.planned = `${plan} act.`
            if (real) soilWater.value.realized = `${real} act.`
            if (achStr) soilWater.value.ach = achStr
        } else if (/nutrient/i.test(cat)) {
            if (plan) nutrient.value.planned = `${plan} act.`
            if (real) nutrient.value.realized = `${real} act.`
            if (achStr) nutrient.value.ach = achStr
        } else if (/crop/i.test(cat)) {
            if (plan) crop.value.planned = `${plan} act.`
            if (real) crop.value.realized = `${real} act.`
            if (achStr) crop.value.ach = achStr
        } else if (/pest|disease/i.test(cat)) {
            if (plan) pest.value.planned = `${plan} act.`
            if (real) pest.value.realized = `${real} act.`
            if (achStr) pest.value.ach = achStr
        } else if (/yield|gap|production/i.test(cat)) {
            if (plan) yieldData.value.budget = String(plan)
            if (real) yieldData.value.actual = String(real)
            if (achStr) yieldData.value.ach = achStr
        }
    })
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
        loading.value = false
        error.value = ''
    }
})

onBeforeUnmount(() => {
    if (worksheet && eventHandler && window.tableau?.TableauEventType) {
        worksheet.removeEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)
    }
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="BMP Categories & Yield Gap"
        bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/bb-ii" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <!-- Top Headers Row -->
            <div class="flex flex-row gap-2 mb-2 w-full">
                <div style="width: calc(67% - 0.3rem);"
                    class="bg-[#F1F5F9] px-3 py-1.5 rounded border border-[#E2E8F0] flex items-center">
                    <span class="text-[10px] font-black text-[#00463E] uppercase tracking-wider">INPUT &middot; 70%
                        <span class="font-normal text-[9px] text-slate-500">BMP ACTIVITY (5 KATEGORI)</span></span>
                </div>
                <div style="width: calc(33% - 0.3rem);"
                    class="bg-[#F1F5F9] px-3 py-1.5 rounded border border-[#E2E8F0] flex items-center">
                    <span class="text-[10px] font-black text-[#00463E] uppercase tracking-wider">OUTPUT &middot;
                        30%</span>
                </div>
            </div>

            <!-- Cards Column Layout (using flex cols instead of grid) -->
            <div class="flex flex-row gap-2 flex-1 items-stretch w-full">
                <!-- Upkeep Management -->
                <div
                    class="flex-1 bg-white p-3 rounded-lg border border-[#E2E8F0] flex flex-col justify-between shadow-2xs">
                    <div>
                        <h4 class="text-[11px] font-bold text-slate-900 leading-tight">Upkeep Management</h4>
                        <span class="text-[9px] text-slate-400">weight 20%</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-center">
                        <div>
                            <span class="text-[8px] text-slate-400 block">Planned</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ upkeep.planned }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Realized</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ upkeep.realized }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Ach.</span>
                            <strong class="text-[11px] font-black text-[#F59E0B]">{{ upkeep.ach }}</strong>
                        </div>
                    </div>
                    <div class="text-[8px] text-slate-400">activities &middot; weighted ach.</div>
                </div>

                <!-- Soil & Water Conservation -->
                <div
                    class="flex-1 bg-white p-3 rounded-lg border border-[#E2E8F0] flex flex-col justify-between shadow-2xs">
                    <div>
                        <h4 class="text-[11px] font-bold text-slate-900 leading-tight">Soil & Water Conservation</h4>
                        <span class="text-[9px] text-slate-400">weight 10%</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 my-2 text-center">
                        <div>
                            <span class="text-[8px] text-slate-400 block">Planned</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ soilWater.planned }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Realized</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ soilWater.realized }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Ach.</span>
                            <strong class="text-[11px] font-black text-[#F59E0B]">{{ soilWater.ach }}</strong>
                        </div>
                    </div>
                    <div class="text-[8px] text-slate-400">activities &middot; weighted ach.</div>
                </div>

                <!-- Nutrient Management -->
                <div
                    class="flex-1 bg-white p-3 rounded-lg border border-[#E2E8F0] flex flex-col justify-between shadow-2xs">
                    <div>
                        <h4 class="text-[11px] font-bold text-slate-900 leading-tight">Nutrient Management</h4>
                        <span class="text-[9px] text-slate-400">weight 30%</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-center">
                        <div>
                            <span class="text-[8px] text-slate-400 block">Planned</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ nutrient.planned }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Realized</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ nutrient.realized }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Ach.</span>
                            <strong class="text-[11px] font-black text-[#F59E0B]">{{ nutrient.ach }}</strong>
                        </div>
                    </div>
                    <div class="text-[8px] text-slate-400">activities &middot; weighted ach.</div>
                </div>

                <!-- Crop Management -->
                <div
                    class="flex-1 bg-white p-3 rounded-lg border border-[#E2E8F0] flex flex-col justify-between shadow-2xs">
                    <div class="flex items-start justify-between">
                        <div>
                            <h4 class="text-[11px] font-bold text-slate-900 leading-tight">Crop Management</h4>
                            <span class="text-[9px] text-slate-400">weight 30%</span>
                        </div>
                        <span class="bg-[#00463E] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded">A&CI
                            40%</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-center">
                        <div>
                            <span class="text-[8px] text-slate-400 block">Planned</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ crop.planned }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Realized</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ crop.realized }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Ach.</span>
                            <strong class="text-[11px] font-black text-[#F59E0B]">{{ crop.ach }}</strong>
                        </div>
                    </div>
                    <div class="text-[8px] text-slate-400">activities &middot; weighted ach.</div>
                </div>

                <!-- Integrated Pest & Disease -->
                <div
                    class="flex-1 bg-white p-3 rounded-lg border border-[#E2E8F0] flex flex-col justify-between shadow-2xs">
                    <div>
                        <h4 class="text-[11px] font-bold text-slate-900 leading-tight">Integrated Pest & Disease</h4>
                        <span class="text-[9px] text-slate-400">weight 10%</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 my-2 text-center">
                        <div>
                            <span class="text-[8px] text-slate-400 block">Planned</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ pest.planned }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Realized</span>
                            <strong class="text-[11px] font-black text-slate-800">{{ pest.realized }}</strong>
                        </div>
                        <div>
                            <span class="text-[8px] text-slate-400 block">Ach.</span>
                            <strong class="text-[11px] font-black text-[#F59E0B]">{{ pest.ach }}</strong>
                        </div>
                    </div>
                    <div class="text-[8px] text-slate-400">activities &middot; weighted ach.</div>
                </div>

                <!-- Yield Gap Production (Output) -->
                <div
                    class="flex-1 bg-white p-3 rounded-lg border border-[#E2E8F0] flex flex-col justify-between shadow-2xs">
                    <div>
                        <h4 class="text-[11px] font-bold text-slate-900 leading-tight">Yield Gap Production</h4>
                        <span class="text-[9px] text-slate-400">weight 100% (Output)</span>
                    </div>
                    <!-- Switched to flex flex-row to guarantee a single row -->
                    <div class="flex flex-row gap-1 my-2 text-center">
                        <div class="flex-1">
                            <span class="text-[8px] text-slate-400 block">Budget</span>
                            <strong class="text-[10px] font-black text-slate-800">{{ yieldData.budget }}</strong>
                        </div>
                        <div class="flex-1">
                            <span class="text-[8px] text-slate-400 block">BBC</span>
                            <strong class="text-[10px] font-black text-slate-800">{{ yieldData.bbc }}</strong>
                        </div>
                        <div class="flex-1">
                            <span class="text-[8px] text-slate-400 block">Actual</span>
                            <strong class="text-[10px] font-black text-slate-800">{{ yieldData.actual }}</strong>
                        </div>
                        <div class="flex-1">
                            <span class="text-[8px] text-slate-400 block">Ach.</span>
                            <strong class="text-[10px] font-black text-[#F59E0B]">{{ yieldData.ach }}</strong>
                        </div>
                    </div>
                    <div class="text-[8px] text-slate-400">t/ha YTD &middot; Ach. = 50% Bgt + 50% BBC</div>
                </div>
            </div>
        </div>
    </PluginLayout>
</template>