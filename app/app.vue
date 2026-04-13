<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Auto-apply .dark class based on system preference
const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

watchEffect(() => {
  document.documentElement.classList.toggle('dark', prefersDark.value)
})
</script>
