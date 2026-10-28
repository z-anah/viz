<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import PluginLayout from '@/components/PluginLayout.vue'

const loading = ref(true)
const error = ref('')
const hasData = ref(false)
const showConsole = ref(false)
const consoleLogs = ref([])

const inputWeight = ref('0%')
const outputWeight = ref('0%')

let worksheet = null
let eventHandler = null

const addLog = (msg, type = 'info', dataObj = null) => {
    const time = new Date().toLocaleTimeString()
    consoleLogs.value.unshift({ time, msg, type, dataObj })
}

onMounted(async () => {
    await nextTick()

    if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== "function") {
        loading.value = false
        error.value = 'Tableau environment not detected. Please run inside a Tableau extension.'
        addLog(error.value, 'error')
        return
    }

    try {
        addLog('Initializing Tableau extensions...')
        await window.tableau.extensions.initializeAsync()
        await new Promise(resolve => setTimeout(resolve, 1000))

        const dashboard = window.tableau.extensions.dashboardContent?.dashboard
        if (dashboard) {
            const worksheets = dashboard.worksheets
            worksheet = worksheets.find(w => w.name === window.tableau.extensions.settings.get('worksheet')) || worksheets[0]
            addLog(`Found dashboard worksheet: ${worksheet?.name}`)
        }
        if (!worksheet && window.tableau.extensions.worksheetContent) {
            worksheet = window.tableau.extensions.worksheetContent.worksheet
            addLog('Found worksheet content directly')
        }

        if (!worksheet) {
            throw new Error('No Tableau worksheet found.')
        }

        const fetchWorksheetData = async () => {
            addLog('Fetching summary data from Tableau...')
            const table = await worksheet.getSummaryDataAsync()
            const columns = table.columns || []
            const data = table.data || []

            const columnNames = columns.map(c => c.fieldName || c.caption)
            const rawRows = data.map(row => {
                const obj = {}
                columns.forEach((col, idx) => {
                    const key = col.fieldName || col.caption || `Col_${idx}`
                    obj[key] = row[idx] ? (row[idx].formattedValue ?? row[idx].value) : null
                })
                return obj
            })

            addLog(`Columns received (${columnNames.length}):`, 'info', columnNames)
            addLog(`Total rows received: ${data.length}`, 'info', rawRows)

            if (data.length > 0 && columns.length > 0) {
                let actualCount = 0
                let targetCount = 0

                // Analisis baris berdasarkan Jenis Data
                data.forEach((row) => {
                    columns.forEach((col, cIdx) => {
                        const colName = String(col.fieldName || col.caption || '').toLowerCase()
                        const val = row[cIdx] ? String(row[cIdx].formattedValue ?? row[cIdx].value ?? '').trim().toUpperCase() : ''

                        if (colName.includes('jenis') || colName.includes('data')) {
                            if (val.includes('AKTUAL')) actualCount++
                            if (val.includes('TARGET') || val.includes('KANDIDAT')) targetCount++
                        }
                    })
                })

                // Jika data aktual/target ditemukan, tetapkan nilai proporsi (contoh mapping bobot 70% / 30% atau dinamis)
                if (actualCount > 0 || targetCount > 0) {
                    inputWeight.value = '70%'
                    outputWeight.value = '30%'
                    hasData.value = true
                    error.value = ''
                    addLog(`Parsed successfully: ${actualCount} actuals, ${targetCount} targets found.`)
                } else {
                    // Fallback default jika kolom ada tapi isi baris berbeda
                    inputWeight.value = '70%'
                    outputWeight.value = '30%'
                    hasData.value = true
                    error.value = ''
                    addLog('Columns detected, applying default weight distribution.')
                }
            } else {
                hasData.value = false
                error.value = 'Please drag required columns (Jenis Data, Kode Budget) into the Tableau worksheet.'
                addLog('Table data is empty.', 'warn')
            }
            loading.value = false
        }

        await fetchWorksheetData()

        eventHandler = async () => {
            addLog('SummaryDataChanged event triggered.')
            await fetchWorksheetData()
        }

        worksheet.addEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)

    } catch (err) {
        error.value = `Error: ${err.message}`
        hasData.value = false
        loading.value = false
        addLog(error.value, 'error')
    }
})

onBeforeUnmount(() => {
    if (worksheet && eventHandler && window.tableau?.TableauEventType) {
        worksheet.removeEventListener(window.tableau.TableauEventType.SummaryDataChanged, eventHandler)
    }
})
</script>

<template>
    <PluginLayout :loading="loading" :error="error" title="Input Output Component" bgClass="bg-transparent">
        <div class="relative h-full w-full flex flex-col justify-between">
            <!-- Main Content -->
            <div v-if="hasData" class="flex items-center justify-center h-full w-full min-w-[300px]">
                <div class="grid grid-cols-12 gap-2 w-full">
                    <div class="col-span-10 bg-[#E2E8F0]/40 rounded p-1.5 flex items-center justify-between border border-[#E2E8F0]">
                        <span class="text-[10px] font-black text-[#00463E] uppercase tracking-wider truncate">
                            INPUT &middot; {{ inputWeight }} 
                            <span class="font-normal text-[9px] text-slate-500 ml-1">BMP activities</span>
                        </span>
                    </div>
                    <div class="col-span-2 bg-[#E2E8F0]/40 rounded p-1.5 flex items-center justify-between border border-[#E2E8F0]">
                        <span class="text-[10px] font-black text-[#00463E] uppercase tracking-wider truncate">
                            OUTPUT &middot; {{ outputWeight }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Floating Console Toggle Button -->
            <button @click="showConsole = !showConsole" class="absolute bottom-1 right-1 z-50 bg-[#00463E] text-white text-[9px] px-2 py-1 rounded shadow hover:bg-[#00332D] transition">
                <i class="fas fa-terminal mr-1"></i> {{ showConsole ? 'Hide Console' : 'Console' }}
            </button>

            <!-- Floating Console Drawer -->
            <div v-if="showConsole" class="absolute bottom-7 right-1 left-1 h-48 bg-slate-900/95 text-slate-200 rounded p-2 text-[9px] font-mono flex flex-col z-40 border border-slate-700 shadow-lg backdrop-blur-xs">
                <div class="flex justify-between items-center border-b border-slate-700 pb-1 mb-1">
                    <span class="font-bold text-[#10B981]"><i class="fas fa-bug mr-1"></i> Data_BMP_demo Inspector</span>
                    <button @click="consoleLogs = []" class="text-slate-400 hover:text-white">Clear</button>
                </div>
                <div class="flex-1 overflow-y-auto space-y-1">
                    <div v-for="(log, idx) in consoleLogs" :key="idx" class="leading-tight border-b border-slate-800 pb-1">
                        <div>
                            <span class="text-slate-500">[{{ log.time }}]</span>
                            <span :class="{'text-red-400': log.type === 'error', 'text-yellow-400': log.type === 'warn', 'text-emerald-400': log.type === 'info'}">
                                {{ log.msg }}
                            </span>
                        </div>
                        <div v-if="log.dataObj" class="mt-1 bg-slate-950 p-1 rounded overflow-x-auto text-[8px] text-amber-300">
                            <pre>{{ JSON.stringify(log.dataObj, null, 2) }}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </PluginLayout>
</template>