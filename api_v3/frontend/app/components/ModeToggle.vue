<template>
  <div class="inline-flex rounded-md bg-gray-100 dark:bg-gray-700/50 p-0.5 text-[10px] font-medium">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="px-2 py-0.5 rounded transition-all leading-tight"
      :class="modelValue === opt.value
        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | boolean
  options: { value: string | boolean; label: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | boolean): void
}>()
</script>
