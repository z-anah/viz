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