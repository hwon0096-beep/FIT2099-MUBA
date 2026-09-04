import { useCallback, useState } from 'react'
import { loadSavedStrategies, persistSavedStrategies, type SavedStrategy } from '../lib/savedStrategies'

export function useSavedStrategies() {
  const [items, setItems] = useState<SavedStrategy[]>(() => loadSavedStrategies())

  const save = useCallback((item: SavedStrategy) => {
    setItems((prev) => {
      const next = [item, ...prev]
      persistSavedStrategies(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((existing) => existing.id !== id)
      persistSavedStrategies(next)
      return next
    })
  }, [])

  return { items, save, remove }
}
