```zsh
printf "JUST SAY OK. Here is my Tableau Vue plugin architecture context:\n\n"

for f in \
  bmp-plugins/package.json \
  bmp-plugins/src/style.css \
  bmp-plugins/src/components/PluginLayout.vue \
  bmp-plugins/src/composables/useTableauData.js \
  bmp-plugins/src/router/index.js \
  bmp-plugins/src/utils/tableauHelpers.js \
  bmp-plugins/src/views/ObmBmpScoreTmPerRegionArea.vue \
  trex-n-data/obm-test-chart-simple.trex \
  trex-n-data/obm-test-chart-simple.txt
do
  if [ -f "$f" ]; then
    printf '### File: %s\n' "$f"
    printf '```%s\n' "${f##*.}"
    cat "$f"
    printf '\n```\n\n'
  else
    printf '### File not found: %s\n\n' "$f"
  fi
done
```
---

JUST SAY OK. Here is my Tableau Vue plugin architecture context:

### File: bmp-plugins/package.json
```json
{
  "name": "bmp-plugins",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 5173",
    "lint": "run-s \"lint:*\"",
    "lint:oxlint": "oxlint . --fix",
    "lint:eslint": "eslint . --fix --cache",
    "format": "prettier --write --experimental-cli src/"
  },
  "dependencies": {
    "@fortawesome/fontawesome-free": "^7.3.1",
    "chart.js": "^4.6.1",
    "vue": "^3.5.42",
    "vue-chartjs": "^5.3.4",
    "vue-router": "^5.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-vue": "^6.0.8",
    "eslint": "^10.10.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-oxlint": "~1.82.0",
    "eslint-plugin-vue": "~10.11.0",
    "globals": "^17.12.0",
    "npm-run-all2": "^9.0.3",
    "oxlint": "~1.82.0",
    "prettier": "3.9.6",
    "tailwindcss": "^4.3.3",
    "vite": "^8.2.2",
    "vite-plugin-vue-devtools": "^8.2.1",
    "vue-eslint-parser": "^10.4.1"
  },
  "engines": {
    "node": "^22.18.0 || >=24.12.0"
  }
}

```

### File: bmp-plugins/src/style.css
```css
@import "tailwindcss";


:root,
body,
html {
  color-scheme: light;
  font-family: 'Roboto Mono', sans-serif;
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

[v-cloak] {
  display: none;
}
```

### File: bmp-plugins/src/components/PluginLayout.vue
```vue
<script setup>
defineProps({
    loading: Boolean,
    error: String,
    title: String
})
</script>

<template>
    <div class="w-full h-full box-border p-2 flex flex-col justify-between overflow-hidden bg-white min-w-0">
        <div v-if="loading" class="flex items-center justify-center h-full text-slate-500 text-xs font-medium">
            <i class="fas fa-spinner fa-spin mr-2"></i> Loading {{ title }}...
        </div>
        <div v-else-if="error" class="flex items-center justify-center h-full text-red-600 text-xs p-2 text-center">
            {{ error }}
        </div>
        <div v-else class="flex flex-col justify-between h-full w-full min-w-0">
            <slot />
        </div>
    </div>
</template>
```

### File: bmp-plugins/src/composables/useTableauData.js
```js
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { findColumn, numericValue, extractTableauRow } from '@/utils/tableauHelpers'

export function useTableauData(initialMockData) {
  const cardData = ref({ ...initialMockData })
  const loading = ref(true)
  const error = ref('')
  const isTableauMode = ref(false)

  let worksheet = null
  let eventHandler = null

  const formatPercent = (value) => {
    let num = Number(value)
    if (isNaN(num)) return '—'
    if (num > 100) num = num / 10000
    return `${num.toFixed(1)}%`
  }

  const formatMoM = (value) => {
    let num = Number(value)
    if (isNaN(num)) return '0.0'
    if (Math.abs(num) > 100) num = num / 1000000
    return num.toFixed(1)
  }

  async function handleRefresh(processDataRow) {
    try {
      const table = await worksheet.getSummaryDataAsync()
      const columns = table.columns || []
      const data = table.data || []

      if (data.length > 0) {
        processDataRow(data[0], columns, cardData, { findColumn, numericValue, extractTableauRow })
      }
      error.value = ''
    } catch (err) {
      error.value = `Could not read worksheet data: ${err.message}`
      console.error('Tableau Data error:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    cardData,
    loading,
    error,
    isTableauMode,
    formatPercent,
    formatMoM,
    initTableau: (processDataRow) => {
      onMounted(async () => {
        if (!window.tableau?.extensions || typeof window.tableau.extensions.initializeAsync !== 'function') {
          isTableauMode.value = false
          loading.value = false
          return
        }

        try {
          isTableauMode.value = true
          await window.tableau.extensions.initializeAsync()
          
          // Find worksheet in dashboard context or fall back to worksheetContent
          const dashboard = window.tableau.extensions.dashboardContent?.dashboard
          if (dashboard) {
            const worksheets = dashboard.worksheets
            worksheet = worksheets.find(w => w.name === window.tableau.extensions.settings.get('worksheet')) || worksheets[0]
          }
          if (!worksheet) {
            worksheet = window.tableau.extensions.worksheetContent.worksheet
          }

          eventHandler = () => handleRefresh(processDataRow)

          worksheet.addEventListener(
            window.tableau.TableauEventType.SummaryDataChanged,
            eventHandler
          )

          await handleRefresh(processDataRow)
        } catch (err) {
          isTableauMode.value = false
          error.value = ''
        } finally {
          loading.value = false
        }
      })

      onBeforeUnmount(() => {
        if (worksheet && eventHandler && window.tableau?.TableauEventType) {
          worksheet.removeEventListener(
            window.tableau.TableauEventType.SummaryDataChanged,
            eventHandler
          )
        }
      })
    }
  }
}
```

### File: bmp-plugins/src/router/index.js
```js
import { createRouter, createWebHistory } from 'vue-router'

const modules = import.meta.glob('../views/*.vue')

const kebabCase = (str) =>
  str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

const dynamicRoutes = Object.keys(modules).map((path) => {
  const fileName = path.split('/').pop().replace(/\.vue$/, '')
  const routePath = fileName === 'Home' ? '/' : `/${kebabCase(fileName)}`

  return {
    path: routePath,
    name: fileName,
    component: modules[path]
  }
})

const router = createRouter({
  history: createWebHistory(),
  routes: dynamicRoutes
})

export default router
```

### File: bmp-plugins/src/utils/tableauHelpers.js
```js
export function findColumn(columns, patterns) {
    return columns.findIndex((column) =>
        patterns.some(
            (pattern) =>
                pattern.test(column.fieldName || '') ||
                pattern.test(column.caption || '')
        )
    )
}

export function numericValue(value) {
    if (typeof value === 'number') return value
    if (value == null || value === '') return NaN
    return Number(String(value).replace(/,/g, '').trim())
}

export function extractTableauRow(row, columns, targetDataRef, fieldMappings) {
    Object.entries(fieldMappings).forEach(([key, patterns]) => {
        const idx = findColumn(columns, patterns)
        if (idx >= 0 && row[idx]) {
            const raw = row[idx].formattedValue ?? row[idx].value
            const parsed = numericValue(raw)
            if (!isNaN(parsed)) {
                targetDataRef.value[key] = parsed
            }
        }
    })
}
```

### File: bmp-plugins/src/views/ObmBmpScoreTmPerRegionArea.vue
```vue
<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'

const currentPage = ref('mature')
const pages = [
    { id: 'mature', name: 'OVERVIEW BMP MATURE' },
    { id: 'immature', name: 'OVERVIEW BMP IMMATURE' },
    { id: 'bmp-block', name: 'BMP BLOCK' },
    { id: 'non-bmp', name: 'NON-BMP BLOCK' },
    { id: 'gap-analysis', name: 'GAP ANALYSIS' }
]

const filters = ref({
    region: 'All', pt: 'All', area: 'All', estate: 'All',
    division: 'All', block: 'All', blockType: 'BMP',
    bmpType: 'Mature', period: 'MTD', month: 'Aug 2026', searchEstate: ''
})

const loading = ref(true)
const error = ref('')
const selectedEstate = ref({
    name: 'Waringin', score: 71.5, status: 'low', rank: 19,
    yieldVsBudget: 84.4, blockInfo: 'TT 2007', soil: 'Sandy'
})

const immatureMeta = ref({ lastUpdated: '7 Okt 2026', monthsLoaded: 'Jun · Jul · Aug', delayedEstates: '—', plannedBmpArea: '—' })
const kpi = ref({ bmpScore: 78.1, sumatraScore: 84.2, kalimantanScore: 73.3, sumatraMoM: '1.0', kalimantanMoM: '0.8', momOverall: '0.5' })
const distribution = ref({ high: 9, mid: 5, low: 11 })
const production = ref({ yieldYtd: '16.10', budget: '15.99', target: '25.61', vsBudget: '100.7', vsBudgetPp: '2.0' })
const yieldStatus = ref({ onTrack: 12, atRisk: 7, below: 6 })

const sumatraAreas = ref([
    { areaName: 'Area 1', estates: [{ name: 'Sumber Sawit', score: 91.6, rank: 2, status: 'high', yieldVsBudget: 102.1 }] },
    { areaName: 'Area 2', estates: [{ name: 'Mega Terang', score: 92.3, rank: 1, status: 'high', yieldVsBudget: 108.3 }] }
])
const kalimantanAreas = ref([
    { areaName: 'Area 1', estates: [{ name: 'Waringin', score: 71.5, rank: 19, status: 'low', yieldVsBudget: 84.4 }] }
])

function selectEstate(est) { selectedEstate.value = est }
function getEstateCardClass(status) {
    if (status === 'high') return 'bg-[#006D65] text-white'
    if (status === 'mid') return 'bg-[#F59E0B] text-white'
    return 'bg-[#EF4444] text-white'
}

function initCharts() {
    nextTick(() => {
        const yieldCtx = document.getElementById('yieldChart')
        if (yieldCtx) {
            new Chart(yieldCtx, {
                type: 'bar',
                data: {
                    labels: ['SUM Jun', 'SUM Jul', 'SUM Aug', 'KAL Jun', 'KAL Jul', 'KAL Aug'],
                    datasets: [
                        { label: 'Budget', data: [11.80, 15.09, 17.15, 10.87, 13.19, 15.27], backgroundColor: '#CBD5E1', barPercentage: 0.6, categoryPercentage: 0.6 },
                        { label: 'Actual', data: [11.90, 15.20, 17.20, 10.90, 13.25, 15.30], backgroundColor: '#006D65', barPercentage: 0.6, categoryPercentage: 0.6 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            })
        }
    })
}

onMounted(async () => {
    try {
        if (window.tableau?.extensions) {
            await tableau.extensions.initializeAsync()
            const worksheet = tableau.extensions.worksheetContent.worksheet
            const table = await worksheet.getSummaryDataAsync()
            if (table.data.length > 0) {
                loading.value = false
            }
        }
    } catch (err) {
        error.value = err.message
    } finally {
        loading.value = false
        initCharts()
    }
})

watch(currentPage, () => { initCharts() })
</script>

<template>
    <div id="app" class="w-[1366px] h-[768px] flex flex-col bg-white overflow-hidden font-mono">
        <header class="bg-[#194740] text-white px-6 py-2 flex items-center justify-between shadow-md flex-shrink-0">
            <div class="flex items-center space-x-2 font-bold text-sm">PRIME AGRI RESOURCES · BMP Dashboard</div>
            <nav class="flex items-center space-x-6 font-bold text-xs">
                <button v-for="page in pages" :key="page.id" @click="currentPage = page.id"
                    :class="currentPage === page.id ? 'text-white border-b-2 border-white pb-0.5' : 'text-[#00D0BC] hover:text-white'">
                    {{ page.name }}
                </button>
            </nav>
        </header>

        <div class="flex-1 min-h-0 flex px-1 py-2 bg-[#F8FAFC]">
            <aside
                class="w-[160px] flex-shrink-0 flex flex-col gap-1 text-xs overflow-y-auto p-1 bg-[#00463E] text-white rounded">
                <label class="block uppercase text-[9px] font-bold">REGION</label>
                <select v-model="filters.region" class="w-full bg-[#00463E] border rounded p-1 text-white">
                    <option>All</option>
                </select>
                <label class="block uppercase text-[9px] font-bold mt-2">ESTATE</label>
                <input type="text" v-model="filters.searchEstate" placeholder="Estate..."
                    class="w-full bg-[#00463E] border rounded p-1 text-white placeholder-white/60">
            </aside>

            <main class="flex-1 flex flex-col px-3 gap-2 overflow-y-auto">
                <div v-if="loading" class="text-center py-10 font-bold">Loading Tableau Extension Data...</div>
                <div v-else-if="error" class="text-red-600 font-bold">Error: {{ error }}</div>

                <div v-if="currentPage === 'mature'" class="grid grid-cols-4 gap-2.5 flex-1">
                    <div class="bg-white rounded p-2.5 border shadow-2xs flex flex-col justify-between">
                        <div class="text-[11px] font-bold text-[#00463E] uppercase">BMP Score TM</div>
                        <div class="text-3xl font-extrabold text-[#F59E0B]">{{ kpi.bmpScore }}%</div>
                    </div>
                    <div class="bg-white rounded p-2.5 border shadow-2xs flex flex-col justify-between">
                        <div class="text-[11px] font-bold text-[#00463E] uppercase">Production Yield YTD</div>
                        <div class="text-2xl font-black">{{ production.yieldYtd }} <span class="text-xs">t/ha</span>
                        </div>
                    </div>
                    <div
                        class="col-span-2 row-span-2 bg-white rounded p-2.5 border shadow-2xs flex flex-col justify-between">
                        <h3 class="text-[12px] font-black uppercase">GIS Heatmap · SUM & KAL</h3>
                        <div class="flex-1 relative min-h-[200px]"><canvas id="yieldChart"></canvas></div>
                    </div>
                </div>
            </main>
        </div>
    </div>
</template>

<style scoped>
body {
    background-color: #d1d5db;
    margin: 0;
    padding: 0;
}
</style>
```

### File: trex-n-data/obm-test-chart-simple.trex
```trex
<?xml version="1.0" encoding="utf-8"?>
<manifest manifest-version="0.1" xmlns="http://www.tableau.com/xml/extension_manifest">
  <worksheet-extension id="com.primeagri.obm-test-chart-simple" extension-version="0.1.0">
    <default-locale>en_US</default-locale>
    <name resource-id="name"/>
    <description>obm-test-chart-simple</description>
    <author name="Cybertrend" email="contact@cybertrend-intra.com" organization="Cybertrend" website="https://cybertrend-intra.com/"/>
    <min-api-version>1.11</min-api-version>
    <source-location>
      <url>http://localhost:5173/obm-test-chart-simple</url>
    </source-location>
    <icon/>
  </worksheet-extension>

  <resources>
    <resource id="name">
      <text locale="en_US">obm-test-chart-simple</text>
    </resource>
  </resources>
</manifest>
```

### File: trex-n-data/obm-test-chart-simple.txt
```txt
Category,Value
Area A,75
Area B,82
Area C,68
Area D,90
```

## Task
* Create tabeleau plugin only OVERVIEW BMP MATURE > BMP Score TM per Region–Area part

## Output
* trex and dummy csv files (example name the file: obm-high-mid-low-by-region-tm.trex, obm-high-mid-low-by-region-tm.txt)
* Update useTableauData.js, tableauHelpers.js &  PluginLayout.vue if needed. For these files, only give the code to update. NO full code.
* Give me the full code new view.
* NO comment, NO detail, NO explanation, NO intro, NO outro, NO router, Router already generic.
* Remember me the root/.../file.extension of the code you give.