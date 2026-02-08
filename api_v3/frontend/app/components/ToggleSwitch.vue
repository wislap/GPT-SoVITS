<template>
  <label class="flex items-center gap-2 cursor-pointer select-none">
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      class="relative w-8 h-[18px] rounded-full transition-colors shrink-0"
      :class="modelValue ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        class="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform"
        :class="{ 'translate-x-[14px]': modelValue }"
      />
    </button>
    <span class="text-xs text-gray-600 dark:text-gray-400">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>
