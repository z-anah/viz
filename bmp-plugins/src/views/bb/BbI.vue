<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import RequiredMarks from '@/components/RequiredMarks.vue'

const loading = ref(true)
const error = ref('')
const isTableauMode = ref(false)

const meta = ref({
    estate: 'Waringin',
    block: 'TT 2007 BMP',
    year: '2007',
    area: '—',
    status: 'Mature',
    soil: 'Sandy',
    soilBadge: 'SAR',
    topo: '—',
    trees: '—',
    density: '—',
    score: 71.5,
    template: 'TM – Sandy',
    badge: 'SAR-treated block'
})

const requiredMarks = [
    { fieldName: 'Nama Estate', target: 'Dimension', description: 'Estate name' },
    { fieldName: 'Kode Blok', target: 'Dimension', description: 'Block code' },
    { fieldName: 'Tahun Tanam', target: 'Dimension', description: 'Year of planting' },
    { fieldName: 'Cf Total Area Ha', target: 'Measure', description: 'Total Area in Ha' },
    { fieldName: 'Status Tanaman', target: 'Dimension', description: 'Plant status (Mature / TBM)' },
    { fieldName: 'Jenis Tanah', target: 'Dimension', description: 'Soil type' },
    { fieldName: 'Topografi', target: 'Dimension', description: 'Topography' },
    { fieldName: 'Jumlah Pokok', target: 'Measure', description: 'Number of trees' },
    { fieldName: 'Kerapatan Pokok', target: 'Measure', description: 'Tree density' },
    { fieldName: 'Cf Bmp Score', target: 'Measure', description: 'BMP Score percentage' }
]

let worksheet = null
let eventHandler = null

function processTableauData(table) {
    const columns = table.columns || []
    const data = table.data || []

    if (data.length === 0) return

    const colNames = columns.map(c => String(c.fieldName || c.caption || '').toLowerCase().trim())
    const estateIdx = colNames.findIndex(c => /estate|nama estate/i.test(c))
    const blockIdx = colNames.findIndex(c => /block|blok|kode blok/i.test(c))
    const yearIdx = colNames.findIndex(c => /year|tahun|tanam/i.test(c))
    const areaIdx = colNames.findIndex(c => /area|luas/i.test(c))
    const statusIdx = colNames.findIndex(c => /status|tanaman/i.test(c))
    const soilIdx = colNames.findIndex(c => /soil|tanah/i.test(c))
    const topoIdx = colNames.findIndex(c => /topo|topografi/i.test(c))
    const treesIdx = colNames.findIndex(c => /tree|pokok|jumlah/i.test(c))
    const densityIdx = colNames.findIndex(c => /density|kerapatan/i.test(c))
    const scoreIdx = colNames.findIndex(c => /score|bmp/i.test(c))

    const row = data[0] || []
    if (row.length > 0) {
        meta.value.estate = estateIdx >= 0 && row[estateIdx] ? (row[estateIdx].formattedValue ?? row[estateIdx].value) : meta.value.estate
        meta.value.block = blockIdx >= 0 && row[blockIdx] ? (row[blockIdx].formattedValue ?? row[blockIdx].value) : meta.value.block
        meta.value.year = yearIdx >= 0 && row[yearIdx] ? (row[yearIdx].formattedValue ?? row[yearIdx].value) : meta.value.year
        meta.value.area = areaIdx >= 0 && row[areaIdx] ? (row[areaIdx].formattedValue ?? row[areaIdx].value) : meta.value.area
        meta.value.status = statusIdx >= 0 && row[statusIdx] ? (row[statusIdx].formattedValue ?? row[statusIdx].value) : meta.value.status
        meta.value.soil = soilIdx >= 0 && row[soilIdx] ? (row[soilIdx].formattedValue ?? row[soilIdx].value) : meta.value.soil
        meta.value.topo = topoIdx >= 0 && row[topoIdx] ? (row[topoIdx].formattedValue ?? row[topoIdx].value) : meta.value.topo
        meta.value.trees = treesIdx >= 0 && row[treesIdx] ? (row[treesIdx].formattedValue ?? row[treesIdx].value) : meta.value.trees
        meta.value.density = densityIdx >= 0 && row[densityIdx] ? (row[densityIdx].formattedValue ?? row[densityIdx].value) : meta.value.density

        const sc = scoreIdx >= 0 && row[scoreIdx] ? Number(row[scoreIdx].value ?? row[scoreIdx].formattedValue) : meta.value.score
        meta.value.score = !isNaN(sc) ? (sc > 1 ? Number(sc.toFixed(1)) : Number((sc * 100).toFixed(1))) : meta.value.score
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
    <PluginLayout :loading="loading" :error="error" title="Estate Block BMP Metadata" bgClass="bg-white text-slate-800">
        <RequiredMarks v-if="!isTableauMode" :requiredMarks="requiredMarks" manifestUrl="/bb-i" />

        <div v-else class="bg-white p-4 shadow-2xs flex items-center justify-between w-full h-full overflow-hidden">
            <div class="flex flex-1 text-[10px] space-x-2">
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">Estate</span>
                    <strong class="text-slate-900 text-[13px] font-black">{{ meta.estate }}</strong>
                </div>
                <div class="flex-[2]">
                    <span class="text-slate-400 block text-[9px]">Block</span>
                    <strong class="text-slate-900 text-[13px] font-black">{{ meta.block }}</strong>
                </div>
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">Year of Planting</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.year }}</strong>
                </div>
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">Area</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.area }}</strong>
                </div>
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">Plant Status</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.status }}</strong>
                </div>
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">Soil Type</span>
                    <div class="flex items-center space-x-1">
                        <strong class="text-slate-900 text-[11px] font-bold">{{ meta.soil }}</strong>
                        <span class="bg-[#F59E0B] text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded-full">{{
                            meta.soilBadge }}</span>
                    </div>
                </div>
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">Topography</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.topo }}</strong>
                </div>
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">No of Trees</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.trees }}</strong>
                </div>
                <div class="flex-1">
                    <span class="text-slate-400 block text-[9px]">Tree Density</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.density }}</strong>
                </div>
            </div>

            <div class="text-right flex flex-col items-end pl-2 border-l border-[#E2E8F0]">
                <span class="text-slate-400 text-[9px] font-bold">BMP Score</span>
                <span class="text-2xl font-black text-[#EF4444] leading-none">{{ meta.score }}%</span>
            </div>

            <div class="bg-[#D1FAE5] border border-[#10B981]/30 rounded-md p-2 text-center ml-3 min-w-[140px]">
                <span class="text-[8px] font-bold text-slate-500 uppercase block tracking-tight">TEMPLATE LOADED</span>
                <strong class="text-xs font-black text-[#006D65] block">{{ meta.template }}</strong>
                <span
                    class="bg-[#F59E0B] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full inline-block mt-0.5">{{
                    meta.badge }}</span>
            </div>
        </div>
    </PluginLayout>
</template>