import React, { useContext, useEffect, useState } from 'react'

const DndContext = React.createContext<{
  item: DraggingItem
  setItem(item: DraggingItem): void
}>(null)

export type DraggingItem = { type: string; value: string }

export function DndProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState(null as DraggingItem)

  return <DndContext.Provider value={{ item, setItem }}>{children}</DndContext.Provider>
}

export function useDraggable<T>(type: string, value: string) {
  const { setItem } = useContext(DndContext)
  const [isDragging, setIsDragging] = useState(false)

  const draggingProps: React.HTMLAttributes<HTMLElement> = {
    draggable: true,
    onDragStart(e: React.DragEvent) {
      e.dataTransfer.setData(type, value)
      setIsDragging(true)
      setItem({ type, value })
    },
    onDragEnd(e: React.DragEvent) {
      setIsDragging(false)
      setItem(null)
    },
    onDrop(e: React.DragEvent) {
      setIsDragging(false)
      setItem(null)
    },
  }
  return [isDragging, draggingProps] as const
}

export function useDropTarget(accepts: string[], onDrop: (item: DraggingItem) => any) {
  const { item } = useContext(DndContext)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (item == null) {
      setCount(0)
    }
  }, [item])

  const canDrop = item != null && accepts.includes(item.type)
  const isActive = canDrop && count > 0
  const droppingProps: React.HTMLAttributes<HTMLElement> = {
    onDragEnter(e: React.DragEvent) {
      setCount(count => count + 1)
    },
    onDragLeave(e: React.DragEvent) {
      setCount(count => count - 1)
    },
    onDragOver(e: React.DragEvent) {
      if (canDrop) {
        e.preventDefault()
      }
    },
    onDrop(e: React.DragEvent) {
      onDrop(item)
    },
  }

  return [isActive, canDrop, droppingProps] as const
}
