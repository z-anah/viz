<script setup>
defineProps({
    loading: Boolean,
    error: String,
    title: String,
    bgClass: {
        type: String,
        default: 'bg-transparant'
    }
})
</script>

<template>
    <div :class="['w-full h-full p-1 pb-2 bg-[#F8FAFC]']">
        <div
            :class="['w-full h-full rounded-md p-1 border border-[#E2E8F0] shadow-2xs flex flex-col justify-between min-w-0', bgClass]">
            <div v-if="loading" class="flex items-center justify-center h-full text-slate-500 text-xs font-medium">
                <i class="fas fa-spinner fa-spin mr-2"></i> Loading {{ title }}...
            </div>
            <div v-else-if="error" class="flex items-center justify-center h-full text-red-600 text-xs p-2 text-center">
                {{ error }}
            </div>
            <div v-else class="flex flex-col justify-between h-full w-full min-w-0 overflow-x-auto">
                <slot />
            </div>
        </div>
    </div>
</template>