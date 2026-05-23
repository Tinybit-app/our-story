// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsToggle from '~/components/SettingsToggle.vue'

vi.stubGlobal('useI18n', () => ({ t: (k: string) => k }))

describe('SettingsToggle', () => {
  it('renders with the given modelValue', () => {
    const wrapper = mount(SettingsToggle, {
      props: { modelValue: false },
    })
    expect(wrapper.attributes('aria-checked')).toBe('false')
  })

  it('emits update:modelValue with the inverted boolean on click', async () => {
    const wrapper = mount(SettingsToggle, {
      props: { modelValue: false },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('does not emit when disabled', async () => {
    const wrapper = mount(SettingsToggle, {
      props: { modelValue: false, disabled: true },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
