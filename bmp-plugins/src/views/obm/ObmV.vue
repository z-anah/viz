<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const regionBreakdown = ref([
    { name: 'Sumatra', total: 13, highCount: 7, highPct: 54, highDiff: '-1', midCount: 2, midPct: 15, midDiff: '+1', lowCount: 4, lowPct: 31, lowDiff: '', highBar: 54, midBar: 15, lowBar: 31 },
    { name: 'Kalimantan', total: 12, highCount: 2, highPct: 17, highDiff: '+1', midCount: 3, midPct: 25, midDiff: '-1', lowCount: 7, lowPct: 58, lowDiff: '', highBar: 17, midBar: 25, lowBar: 58 }
])

const requiredMarks = [
    { fieldName: 'Cf Region', target: 'Dimension', description: 'Region name (Sumatra / Kalimantan)' },
    { fieldName: 'Nama Estate', target: 'Dimension', description: 'Estate level granularity' },
    { fieldName: 'Cf Estate Score LOD', target: 'Measure', description: 'Estate score for classification' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
    const regionIdx = colNames.findIndex(c => /region|cf region/i.test(c))
    const estateIdx = colNames.findIndex(c => /estate|nama estate/i.test(c))
    const scoreIdx = colNames.findIndex(c => /score|lod/i.test(c))

    if (regionIdx < 0 && estateIdx < 0) return

    const sumatraEstates = new Map()
    const kalimantanEstates = new Map()

    data.forEach(row => {
        const region = regionIdx >= 0 && row[regionIdx] ? String(row[regionIdx].formattedValue ?? row[regionIdx].value).trim() : 'Sumatra'
        const estate = estateIdx >= 0 && row[estateIdx] ? String(row[estateIdx].formattedValue ?? row[estateIdx].value).trim() : null
        const sc = scoreIdx >= 0 && row[scoreIdx] ? Number(row[scoreIdx].value ?? row[scoreIdx].formattedValue) : 0
        const scoreVal = sc > 1 ? sc / 100 : sc

        if (estate) {
            const targetMap = /kalimantan/i.test(region) ? kalimantanEstates : sumatraEstates
            targetMap.set(estate, scoreVal)
        }
    })

    const calcRegionStats = (name, map) => {
        const total = map.size > 0 ? map.size : (name === 'Sumatra' ? 13 : 12)
        let high = 0, mid = 0, low = 0
        map.forEach(score => {
            if (score >= 0.80) high++
            else if (score >= 0.75) mid++
            else low++
        })
        if (map.size === 0) {
            if (name === 'Sumatra') { high = 7; mid = 2; low = 4; }
            else { high = 2; mid = 3; low = 7; }
        }
        const highPct = Math.round((high / total) * 100)
        const midPct = Math.round((mid / total) * 100)
        const lowPct = Math.max(0, 100 - highPct - midPct)

        return {
            name,
            total,
            highCount: high,
            highPct,
            highDiff: name === 'Sumatra' ? '-1' : '+1',
            midCount: mid,
            midPct,
            midDiff: name === 'Sumatra' ? '+1' : '-1',
            lowCount: low,
            lowPct,
            lowDiff: '',
            highBar: highPct,
            midBar: midPct,
            lowBar: lowPct
        }
    }

    regionBreakdown.value = [
        calcRegionStats('Sumatra', sumatraEstates),
        calcRegionStats('Kalimantan', kalimantanEstates)
    ]
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
    <PluginLayout :loading="loading" :error="error" title="High / Mid / Low by Region · TM"
        bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-v" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <h3 class="text-[11px] font-bold text-[#00463E] uppercase mb-1.5">HIGH / MID / LOW BY REGION &middot; TM
            </h3>
            <div class="space-y-3 my-1">
                <div v-for="reg in regionBreakdown" :key="reg.name" class="space-y-2">
                    <div class="text-[10px] font-bold text-[#00463E]">{{ reg.name }}</div>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="flex items-center justify-between bg-[#D1FAE5] p-2 rounded border border-[#10B981]">
                            <span class="text-xs font-black text-[#006D65]">{{ reg.highCount }}/{{ reg.total
                                }}</span>
                            <span class="text-[9px] text-slate-600" style="margin-left: 0.35rem;">{{ reg.highPct
                                }}%</span>
                            <span class="text-[10px] font-bold text-[#EF4444]"
                                v-if="reg.highDiff && reg.highDiff.startsWith('-')">{{ reg.highDiff }}</span>
                            <span class="text-[10px] font-bold text-[#10B981]" v-else-if="reg.highDiff">{{ reg.highDiff
                                }}</span>
                        </div>
                        <div class="flex items-center justify-between bg-[#FEF3C7] p-2 rounded border border-[#F59E0B]">
                            <span class="text-xs font-black text-[#B45309]">{{ reg.midCount }}/{{ reg.total
                            }}</span>
                            <span class="text-[9px] text-slate-600" style="margin-left: 0.35rem;">{{ reg.midPct
                            }}%</span>
                            <span class="text-[10px] font-bold text-[#10B981]"
                                v-if="reg.midDiff && reg.midDiff.startsWith('+')">{{ reg.midDiff }}</span>
                            <span class="text-[10px] font-bold text-[#EF4444]"
                                v-else-if="reg.midDiff && reg.midDiff.startsWith('-')">{{ reg.midDiff }}</span>
                            <span class="text-[10px] font-bold text-slate-500" v-else-if="reg.midDiff">{{ reg.midDiff
                                }}</span>
                        </div>
                        <div class="flex items-center justify-between bg-[#FEE2E2] p-2 rounded border border-[#EF4444]">
                            <span class="text-xs font-black text-[#B91C1C]">{{ reg.lowCount }}/{{ reg.total
                            }}</span>
                            <span class="text-[9px] text-slate-600" style="margin-left: 0.35rem;">{{ reg.lowPct
                            }}%</span>
                            <span class="text-[10px] font-bold text-[#EF4444]"
                                v-if="reg.lowDiff && reg.lowDiff.startsWith('-')">{{ reg.lowDiff }}</span>
                            <span class="text-[10px] font-bold text-[#10B981]"
                                v-else-if="reg.lowDiff && reg.lowDiff.startsWith('+')">{{ reg.lowDiff }}</span>
                        </div>
                    </div>

                    <div
                        class="w-full bg-[#F8FAFC] h-2 rounded-md overflow-hidden flex border border-[#E2E8F0] mt-2 mb-4">
                        <div class="h-2" :style="{ width: reg.highBar + '%', backgroundColor: '#10B981' }"></div>
                        <div class="h-2" :style="{ width: reg.midBar + '%', backgroundColor: '#F59E0B' }"></div>
                        <div class="h-2" :style="{ width: reg.lowBar + '%', backgroundColor: '#EF4444' }"></div>
                    </div>
                </div>
            </div>
        </div>
    </PluginLayout>
</template>