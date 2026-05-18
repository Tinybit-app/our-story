export interface Slide {
  id: string
  mediaType: 'photo' | 'video' | 'text'
  url?: string | null
  textContent?: string
  displayOrder: number
}
