<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

const regions = ref([
    { name: 'Sumatra', total: 13, highCount: 7, highPct: 54, highDiff: '-1', midCount: 2, midPct: 15, midDiff: '+1', lowCount: 4, lowPct: 31, highBar: 54, midBar: 15, lowBar: 31 },
    { name: 'Kalimantan', total: 12, highCount: 2, highPct: 17, highDiff: '+1', midCount: 3, midPct: 25, midDiff: '-1', lowCount: 7, lowPct: 58, highBar: 17, midBar: 25, lowBar: 58 }
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
                const parsedRegions = []
                data.forEach((row) => {
                    let name = 'Region'
                    let total = 10, highCount = 0, highPct = 0, highDiff = '0', midCount = 0, midPct = 0, midDiff = '0', lowCount = 0, lowPct = 0

                    for (let c = 0; c < columns.length; c++) {
                        const colName = String(columns[c].fieldName || columns[c].caption || '').toLowerCase()
                        const rawVal = row[c] ? (row[c].formattedValue ?? row[c].value) : null
                        const numVal = typeof rawVal === "number" ? rawVal : (rawVal == null || rawVal === "" ? 0 : Number(String(rawVal).replace(/,/g, "").trim()))
                        const strVal = row[c] ? String(row[c].formattedValue ?? row[c].value ?? '').trim() : ''

                        if (colName.includes('region') || colName.includes('name') || c === 0) {
                            if (strVal && isNaN(strVal)) name = strVal
                        }
                        if (colName.includes('total')) total = numVal
                        else if (colName.includes('highcount')) highCount = numVal
                        else if (colName.includes('highpct')) highPct = numVal
                        else if (colName.includes('highdiff')) highDiff = strVal
                        else if (colName.includes('midcount')) midCount = numVal
                        else if (colName.includes('midpct')) midPct = numVal
                        else if (colName.includes('middiff')) midDiff = strVal
                        else if (colName.includes('lowcount')) lowCount = numVal
                        else if (colName.includes('lowpct')) lowPct = numVal
                    }

                    const highBar = total > 0 ? (highCount / total) * 100 : 0
                    const midBar = total > 0 ? (midCount / total) * 100 : 0
                    const lowBar = total > 0 ? (lowCount / total) * 100 : 0

                    parsedRegions.push({ name, total, highCount, highPct, highDiff, midCount, midPct, midDiff, lowCount, lowPct, highBar, midBar, lowBar })
                })

                if (parsedRegions.length > 0) {
                    regions.value = parsedRegions
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
    <PluginLayout :loading="loading" :error="error" title="High / Mid / Low by Region · TM">
        <div class="flex flex-col justify-between h-full w-full">
            <div class="flex items-center justify-between mb-2 min-w-0">
                <h3 class="text-[11px] font-bold text-[#00463E] uppercase truncate">High / Mid / Low by Region · TM</h3>
            </div>

            <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-medium">
                <span class="mb-1"><i class="fas fa-info-circle mr-1"></i> No data available</span>
                <span class="text-[10px] text-slate-400">Please drag region and category measures into marks.</span>
            </div>

            <div v-show="hasData" class="flex-1 flex flex-col justify-around min-h-0 w-full">
                <div v-for="reg in regions" :key="reg.name" class="space-y-1.5">
                    <div class="text-[10px] font-bold text-[#00463E]">{{ reg.name }}</div>
                    <div class="grid grid-cols-3 gap-1.5 text-center text-[9px] font-extrabold">
                        <div class="bg-[#D1FAE5] text-[#006D65] py-2 px-2 rounded flex items-center justify-between border border-[#10B981]/20 shadow-2xs">
                            <span class="text-xs font-black">{{ reg.highCount }}<span class="font-normal text-[9px] text-[#00463E]/70">/{{ reg.total }}</span></span>
                            <span class="font-bold text-[10px] text-[#006D65]">{{ reg.highPct }}%</span>
                            <span :class="String(reg.highDiff).includes('+') ? 'text-[#10B981]' : 'text-[#EF4444]'" class="text-[9px] font-bold">{{ reg.highDiff }}</span>
                        </div>
                        <div class="bg-[#FEF3C7] text-[#F59E0B] py-2 px-2 rounded flex items-center justify-between border border-[#F59E0B]/20 shadow-2xs">
                            <span class="text-xs font-black">{{ reg.midCount }}<span class="font-normal text-[9px] text-[#00463E]/70">/{{ reg.total }}</span></span>
                            <span class="font-bold text-[10px] text-[#F59E0B]">{{ reg.midPct }}%</span>
                            <span :class="String(reg.midDiff).includes('+') ? 'text-[#10B981]' : 'text-[#EF4444]'" class="text-[9px] font-bold">{{ reg.midDiff }}</span>
                        </div>
                        <div class="bg-[#FEE2E2] text-[#EF4444] py-2 px-2 rounded flex items-center justify-between border border-[#EF4444]/20 shadow-2xs">
                            <span class="text-xs font-black">{{ reg.lowCount }}<span class="font-normal text-[9px] text-[#00463E]/70">/{{ reg.total }}</span></span>
                            <span class="font-bold text-[10px] text-[#EF4444]">{{ reg.lowPct }}%</span>
                            <span class="text-[9px] font-bold text-slate-500"></span>
                        </div>
                    </div>
                    <div class="w-full bg-[#F8FAFC] h-1.5 rounded-full overflow-hidden flex border border-[#E2E8F0]">
                        <div class="bg-[#10B981] h-full" :style="{ width: reg.highBar + '%' }"></div>
                        <div class="bg-[#F59E0B] h-full" :style="{ width: reg.midBar + '%' }"></div>
                        <div class="bg-[#EF4444] h-full" :style="{ width: reg.lowBar + '%' }"></div>
                    </div>
                </div>
            </div>
        </div>
    </PluginLayout>
</template>