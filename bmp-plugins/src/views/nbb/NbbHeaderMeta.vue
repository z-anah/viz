<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'
import { numericValue } from '@/utils/tableauHelpers'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)

const meta = ref({
    estate: 'Waringin',
    block: 'TT 2007',
    plantType: 'Non-BMP',
    yearOfPlanting: '2007',
    areaHa: '32.4',
    plantStatus: 'Mature',
    soilType: 'Sandy',
    topography: 'Flat',
    noOfTrees: '4,406',
    treeDensity: '136/ha',
    score: 60.7,
    templateName: 'TM – Sandy'
})

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
                const colNames = columns.map(col => String(col.fieldName || col.caption || '').toLowerCase())
                const row = data[0]

                const getVal = (colNamePattern) => {
                    const idx = colNames.findIndex(c => c.includes(colNamePattern))
                    if (idx >= 0 && row[idx]) {
                        return String(row[idx].formattedValue ?? row[idx].value ?? '').trim()
                    }
                    return null
                }

                const estate = getVal('estate')
                const block = getVal('block')
                const plantType = getVal('planttype') || getVal('blocktype')
                const yearOfPlanting = getVal('year') || getVal('yop')
                const areaHa = getVal('area')
                const plantStatus = getVal('status') || getVal('plantstatus')
                const soilType = getVal('soil')
                const topography = getVal('topography') || getVal('topo')
                const noOfTrees = getVal('trees') || getVal('nooftrees')
                const treeDensity = getVal('density')
                const rawScore = getVal('score')
                const templateName = getVal('template')

                if (estate) meta.value.estate = estate
                if (block) meta.value.block = block
                if (plantType) meta.value.plantType = plantType
                if (yearOfPlanting) meta.value.yearOfPlanting = yearOfPlanting
                if (areaHa) meta.value.areaHa = areaHa
                if (plantStatus) meta.value.plantStatus = plantStatus
                if (soilType) meta.value.soilType = soilType
                if (topography) meta.value.topography = topography
                if (noOfTrees) meta.value.noOfTrees = noOfTrees
                if (treeDensity) meta.value.treeDensity = treeDensity
                if (templateName) meta.value.templateName = templateName

                if (rawScore) {
                    const parsed = numericValue(rawScore)
                    if (!isNaN(parsed)) meta.value.score = parsed
                }

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
    <PluginLayout :loading="loading" :error="error" title="Non-BMP Block Meta Header">
        <div class="flex items-center justify-between w-full h-full min-w-0">
            <div class="grid grid-cols-10 gap-2 text-[10px] flex-1">
                <div>
                    <span class="text-slate-400 block text-[9px]">Estate</span>
                    <strong class="text-slate-900 text-[13px] font-black">{{ meta.estate }}</strong>
                </div>
                <div class="col-span-2">
                    <span class="text-slate-400 block text-[9px]">Block</span>
                    <div class="flex items-center space-x-1.5">
                        <strong class="text-slate-900 text-[13px] font-black">{{ meta.block }}</strong>
                        <span class="bg-[#00463E] text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded">{{ meta.plantType }}</span>
                    </div>
                </div>
                <div>
                    <span class="text-slate-400 block text-[9px]">Year of Planting</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.yearOfPlanting }}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[9px]">Area (ha)</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.areaHa }}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[9px]">Plant Status</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.plantStatus }}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[9px]">Soil Type</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.soilType }}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[9px]">Topography</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.topography }}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[9px]">No of Trees</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.noOfTrees }}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block text-[9px]">Tree Density</span>
                    <strong class="text-slate-900 text-[11px] font-bold">{{ meta.treeDensity }}</strong>
                </div>
            </div>

            <div class="text-right flex flex-col items-end pl-2 border-l border-[#E2E8F0]">
                <span class="text-slate-400 text-[9px] font-bold">Score</span>
                <span class="text-2xl font-black text-[#EF4444] leading-none">{{ typeof meta.score === 'number' ? meta.score.toFixed(1) : meta.score }}%</span>
            </div>

            <div class="bg-[#00463E]/10 border border-[#006D65]/30 rounded-md p-2 text-center ml-3 min-w-[140px]">
                <span class="text-[8px] font-bold text-slate-500 uppercase block tracking-tight">TEMPLATE LOADED</span>
                <strong class="text-xs font-black text-[#006D65] block">{{ meta.templateName }}</strong>
                <span class="bg-[#00463E] text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full inline-block mt-0.5">Non-BMP · comparison</span>
            </div>
        </div>
    </PluginLayout>
</template>