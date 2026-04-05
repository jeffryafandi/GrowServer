<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

definePageMeta({
  layout: false // No Header/Footer
})

const route = useRoute()

const growId = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const valKey = route.query.valKey as string

interface LoginResponse {
  success: boolean
  message?: string
  user?: { growId: string }
}

async function handleLogin() {
  if (!growId.value || !password.value) {
    error.value = 'Please enter both GrowID and Password.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: {
        growId: growId.value,
        password: password.value,
        valKey
      }
    })

    if (response.success) {
      success.value = true
    } else {
      error.value = response.message || 'Invalid GrowID or password.'
    }
  } catch (err: any) {
    error.value = err.data?.message || 'An error occurred during login.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-screen bg-[#0f0f0f] text-slate-200 flex items-center justify-center font-sans">
    <div v-if="success" class="text-center px-6">
      <h2 class="text-3xl font-bold text-green-500 mb-4 tracking-tighter">LOGIN SUCCESSFUL</h2>
      <p class="text-slate-500">You may now close this window and return to the game.</p>
    </div>

    <div v-else class="w-full max-w-[320px] px-8">
      <h1 class="text-center text-4xl font-black mb-12 tracking-tighter uppercase italic">LOG IN</h1>

      <form @submit.prevent="handleLogin" class="flex flex-col gap-4">
        <div v-if="error" class="text-red-500 text-xs font-mono text-center mb-2 uppercase">{{ error }}</div>

        <input 
          v-model="growId"
          placeholder="GROWID"
          class="bg-transparent border-b-2 border-slate-800 p-3 text-white placeholder-slate-700 outline-none focus:border-indigo-600 transition-colors uppercase font-bold"
          autofocus
          :disabled="loading"
        />

        <input 
          v-model="password"
          type="password"
          placeholder="PASSWORD"
          class="bg-transparent border-b-2 border-slate-800 p-3 text-white placeholder-slate-700 outline-none focus:border-indigo-600 transition-colors uppercase font-bold"
          :disabled="loading"
        />

        <button 
          type="submit"
          :disabled="loading"
          class="bg-white text-black font-black p-4 mt-8 uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-30"
        >
          {{ loading ? '...' : 'AUTHENTICATE' }}
        </button>
      </form>

      <div class="mt-20 text-center opacity-10 font-bold text-[10px] tracking-widest uppercase">
        GS-DASHBOARD v3.2.0
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Minimal override if needed */
input::placeholder {
  letter-spacing: 0.05em;
}
</style>
