import React from 'react'
import ReactDOM from 'react-dom'
import { DndProvider, useDraggable, useDropTarget } from './react-dnd'

function Box({ type, name }: { type: string; name: string }) {
  const [isDragging, draggingProps] = useDraggable(type, name)

  return (
    <div
      draggable={true}
      {...draggingProps}
      style={{
        width: 50,
        height: 50,
        border: '1px solid red',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      {name}
    </div>
  )
}

function Dustbin({ accepts, name }: { accepts: string[]; name: string }) {
  const [isActive, canDrop, droppingProps] = useDropTarget(accepts, item => {
    console.log(`${item.type} - ${item.value} 被拖动到了 ${name} 上`)
  })
  return (
    <div
      style={{
        height: 200,
        width: 200,
        border: '1px solid blue',
        background: isActive ? 'green' : canDrop ? 'orange' : 'none',
      }}
      {...droppingProps}
    >
      <h1>{name}</h1>
      <h2>{accepts.join(', ')}</h2>
    </div>
  )
}

function App() {
  return (
    <DndProvider>
      <div style={{ margin: 32 }}>
        <div style={{ display: 'flex' }}>
          <Dustbin accepts={['cola', 'milk']} name="1号" />
          <Dustbin accepts={['milk']} name="2号" />
        </div>
        <div style={{ height: 20 }} />
        <div style={{ display: 'flex' }}>
          <Box type="cola" name="可乐 1111" />
          <Box type="milk" name="牛奶 2222" />
        </div>
      </div>
    </DndProvider>
  )
}

function render(Component: React.ComponentType) {
  ReactDOM.render(<Component />, document.querySelector('#app'))
}

render(App)
