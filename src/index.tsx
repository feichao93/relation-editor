import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

function render(Component: React.ComponentType) {
  ReactDOM.render(
          <Component />
    ,
    document.querySelector('#app'),
  )
}

render(App)

declare global {
  interface NodeModule {
    hot: any
  }
}
if (module.hot) {
  module.hot.accept('./App.tsx', () => {
    const { default: App } = require('./App.tsx')
    render(App)
  })
}
