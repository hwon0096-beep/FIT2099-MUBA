import { useCallback, useState } from 'react'
import { loadSavedStrategies, persistSavedStrategies, type SavedStrategy } from '../lib/savedStrategies'

export function useSavedStrategies() {
  const [items, setItems] = useState<SavedStrategy[]>(() => loadSavedStrategies())

  // Re-reads from localStorage right before writing (rather than folding the update into the
  // React state this hook already holds) because more than one component on the same page can
  // mount its own instance of this hook at once (e.g. the Analyze page's own Save button and
  // each Strategy Idea card's Save button) — each instance's `items` is only a snapshot from its
  // own mount time, so writing through stale `items` would silently drop a save made by a sibling
  // instance in between.
  const save = useCallback((item: SavedStrategy) => {
    const next = [item, ...loadSavedStrategies()]
    persistSavedStrategies(next)
    setItems(next)
  }, [])

  const remove = useCallback((id: string) => {
    const next = loadSavedStrategies().filter((existing) => existing.id !== id)
    persistSavedStrategies(next)
    setItems(next)
  }, [])

  return { items, save, remove }
}
