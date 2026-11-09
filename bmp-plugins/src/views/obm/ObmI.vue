<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const kpi = ref({
    bmpScore: 0,
    sumatraScore: 0,
    kalimantanScore: 0,
    sumatraMoM: '0.0',
    kalimantanMoM: '0.0',
    momOverall: '0.0'
})

const requiredMarks = [
    { fieldName: 'Cf Bmp Score', target: 'Measure', description: 'Overall BMP Score' },
    { fieldName: 'Cf Sumatra Score', target: 'Measure', description: 'Sumatra Regional Score' },
    { fieldName: 'Cf Kalimantan Score', target: 'Measure', description: 'Kalimantan Regional Score' },
    { fieldName: 'Cf Sumatra MoM', target: 'Measure', description: 'Sumatra MoM change' },
    { fieldName: 'Cf Kalimantan MoM', target: 'Measure', description: 'Kalimantan MoM change' },
    { fieldName: 'Cf Mom Overall', target: 'Measure', description: 'Overall MoM change in pp' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())

    const bmpIdx = colNames.findIndex(c => /bmp score/i.test(c))
    const sumatraIdx = colNames.findIndex(c => /sumatra score/i.test(c))
    const kalimantanIdx = colNames.findIndex(c => /kalimantan score/i.test(c))
    const sumatraMomIdx = colNames.findIndex(c => /sumatra mom/i.test(c))
    const kalimantanMomIdx = colNames.findIndex(c => /kalimantan mom/i.test(c))
    const momOverallIdx = colNames.findIndex(c => /mom overall|mom/i.test(c))

    if (data[0]) {
        const row = data[0]
        const getVal = (idx) => (idx >= 0 && row[idx] ? Number(row[idx].value ?? row[idx].formattedValue) : null)

        const bmp = getVal(bmpIdx)
        const sumatra = getVal(sumatraIdx)
        const kalimantan = getVal(kalimantanIdx)
        const sumMom = getVal(sumatraMomIdx)
        const kalMom = getVal(kalimantanMomIdx)
        const overallMom = getVal(momOverallIdx)

        kpi.value = {
            bmpScore: bmp !== null && !isNaN(bmp) ? Number((bmp > 1 ? bmp : bmp * 100).toFixed(1)) : 78.1,
            sumatraScore: sumatra !== null && !isNaN(sumatra) ? Number((sumatra > 1 ? sumatra : sumatra * 100).toFixed(1)) : 84.2,
            kalimantanScore: kalimantan !== null && !isNaN(kalimantan) ? Number((kalimantan > 1 ? kalimantan : kalimantan * 100).toFixed(1)) : 73.3,
            sumatraMoM: sumMom !== null && !isNaN(sumMom) ? sumMom.toFixed(1) : '1.0',
            kalimantanMoM: kalMom !== null && !isNaN(kalMom) ? kalMom.toFixed(1) : '0.8',
            momOverall: overallMom !== null && !isNaN(overallMom) ? overallMom.toFixed(1) : '0.5'
        }
    }
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
        kpi.value = {
            bmpScore: 78.1,
            sumatraScore: 84.2,
            kalimantanScore: 73.3,
            sumatraMoM: '1.0',
            kalimantanMoM: '0.8',
            momOverall: '0.5'
        }
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
        kpi.value = {
            bmpScore: 78.1,
            sumatraScore: 84.2,
            kalimantanScore: 73.3,
            sumatraMoM: '1.0',
            kalimantanMoM: '0.8',
            momOverall: '0.5'
        }
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
    <PluginLayout :loading="loading" :error="error" title="BMP Score TM" bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/obm-i" />

        <div v-else class="bg-white p-4 shadow-2xs flex flex-col justify-between w-full h-full overflow-hidden">
            <div class="text-[11px] font-bold text-[#00463E] uppercase tracking-tight">BMP Score TM</div>
            <div class="flex items-baseline justify-between my-1">
                <span class="text-3xl font-extrabold text-[#F59E0B] tracking-tight">{{ kpi.bmpScore }}%</span>
                <div class="text-right space-y-0.5 text-[11px] font-bold">
                    <div class="text-[#000000]">Sumatra <span class="font-black text-[#006D65] ml-1">{{ kpi.sumatraScore
                            }}%</span> <span class="text-[#10B981] text-[10px] ml-0.5"><i class="fas fa-caret-up"></i>
                            {{ kpi.sumatraMoM }}</span></div>
                    <div class="text-[#000000]">Kalimantan <span class="font-black text-[#006D65] ml-1">{{
                            kpi.kalimantanScore }}%</span> <span class="text-[#10B981] text-[10px] ml-0.5"><i
                                class="fas fa-caret-up"></i> {{ kpi.kalimantanMoM }}</span></div>
                </div>
            </div>
            <div class="pt-1.5 border-t border-[#E2E8F0] flex items-center">
                <span class="text-[10px] font-bold bg-[#D1FAE5] text-[#10B981] px-2 py-0.5 rounded-full"><i
                        class="fas fa-caret-up"></i> {{ kpi.momOverall }} pp MoM</span>
            </div>
        </div>
    </PluginLayout>
</template>