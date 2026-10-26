<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
const routes = router.getRoutes().filter(route => route.path !== '/')
</script>

<template>
    <div class="w-full h-full box-border p-4 flex flex-col bg-white overflow-y-auto">
        <h1 class="text-sm font-bold text-[#00463E] uppercase tracking-tight mb-3">
            Available Plugins
        </h1>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <router-link v-for="route in routes" :key="route.path" :to="route.path"
                class="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded hover:border-[#10B981] hover:bg-[#D1FAE5]/20 transition-colors flex flex-col justify-between">
                <span class="text-xs font-black text-[#006D65]">{{ route.name }}</span>
                <span class="text-[10px] text-slate-500 mt-1 font-mono">{{ route.path }}</span>
            </router-link>
        </div>
    </div>
</template>