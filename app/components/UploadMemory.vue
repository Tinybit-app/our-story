<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
      class="hidden"
      @change="onFileSelected"
    />

    <button
      @click="fileInput?.click()"
      class="flex items-center gap-2 bg-primary text-primary-foreground rounded-[12px] px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      <span class="text-base leading-none">+</span>
      Add memory
    </button>

    <!-- Upload sheet -->
    <Teleport to="body">
      <div
        v-if="file"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40" @click="cancel" />

        <!-- Sheet -->
        <div class="relative bg-background rounded-t-2xl sm:rounded-[16px] w-full sm:max-w-md p-6 shadow-xl">

          <!-- Preview -->
          <div class="w-full h-44 rounded-[12px] overflow-hidden bg-secondary mb-5">
            <img
              v-if="previewUrl && !isVideo"
              :src="previewUrl"
              class="w-full h-full object-cover"
            />
            <video
              v-else-if="previewUrl && isVideo"
              :src="previewUrl"
              class="w-full h-full object-cover"
              muted
              playsinline
            />
          </div>

          <!-- Note -->
          <textarea
            v-model="note"
            placeholder="Add a note… (optional)"
            class="w-full bg-card border border-border rounded-[12px] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-3"
            rows="2"
          />

          <!-- Date -->
          <div class="flex items-center justify-between mb-5">
            <label class="text-sm text-muted-foreground">When was this?</label>
            <input
              v-model="memoryDate"
              type="date"
              class="bg-card border border-border rounded-[10px] px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <!-- Progress bar -->
          <div v-if="uploading" class="w-full bg-secondary rounded-full h-1.5 mb-4 overflow-hidden">
            <div
              class="bg-primary h-1.5 rounded-full transition-all duration-150"
              :style="{ width: `${progress}%` }"
            />
          </div>

          <p v-if="errorMsg" class="text-sm text-destructive mb-3 text-center">{{ errorMsg }}</p>

          <div class="flex gap-2.5">
            <button
              @click="cancel"
              class="flex-1 border border-border bg-card rounded-[12px] py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              @click="upload"
              :disabled="uploading"
              class="flex-1 bg-primary text-primary-foreground rounded-[12px] py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {{ uploading ? `${progress}%` : 'Upload' }}
            </button>
          </div>

        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ familyId: string }>()
const emit = defineEmits<{ uploaded: [memoryId: string] }>()

const supabase = useSupabaseClient()
const config = useRuntimeConfig()

const fileInput = ref<HTMLInputElement>()
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const note = ref('')
const memoryDate = ref(new Date().toISOString().split('T')[0])
const uploading = ref(false)
const progress = ref(0)
const errorMsg = ref('')

const isVideo = computed(() => file.value?.type.startsWith('video/') ?? false)

const MAX_PHOTO_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

function onFileSelected(e: Event) {
  const selected = (e.target as HTMLInputElement).files?.[0]
  if (!selected) return

  const maxSize = selected.type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES
  if (selected.size > maxSize) {
    errorMsg.value = selected.type.startsWith('video/')
      ? 'Videos must be under 500 MB'
      : 'Photos must be under 50 MB'
    return
  }

  file.value = selected
  previewUrl.value = URL.createObjectURL(selected)
  memoryDate.value = new Date().toISOString().split('T')[0]
  errorMsg.value = ''
}

async function upload() {
  if (!file.value) return
  uploading.value = true
  progress.value = 0
  errorMsg.value = ''

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    errorMsg.value = 'Session expired — please sign in again'
    uploading.value = false
    return
  }

  const formData = new FormData()
  formData.append('file', file.value)
  formData.append('familyId', props.familyId)
  formData.append('note', note.value)
  formData.append('memoryDate', `${memoryDate.value}T00:00:00Z`)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', `${config.public.supabaseUrl}/functions/v1/upload-media`)
  xhr.setRequestHeader('Authorization', `Bearer ${token}`)

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100)
  }

  xhr.onload = () => {
    uploading.value = false
    const result = JSON.parse(xhr.responseText)
    if (xhr.status === 200) {
      emit('uploaded', result.memoryId)
      cancel()
    } else {
      errorMsg.value = result.error === 'storage_full'
        ? 'Storage full — upgrade to continue uploading'
        : result.error === 'file_too_large'
          ? isVideo.value ? 'Videos must be under 500 MB' : 'Photos must be under 50 MB'
          : 'Upload failed, please try again'
    }
  }

  xhr.onerror = () => {
    uploading.value = false
    errorMsg.value = 'Upload failed, please try again'
  }

  xhr.send(formData)
}

function cancel() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = null
  previewUrl.value = null
  note.value = ''
  errorMsg.value = ''
  uploading.value = false
  progress.value = 0
  if (fileInput.value) fileInput.value.value = ''
}
</script>
