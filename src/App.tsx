import React from 'react'
import { FONT } from './constants'
import RelationEditor from './RelationEditor'
import { useReactTestData } from './test-data'

export default class App extends React.Component {
  shouldComponentUpdate() {
    return false
  }

  editorDivRef = React.createRef<HTMLDivElement>()

  componentDidMount() {
    const editor = new RelationEditor(this.editorDivRef.current, FONT)
    useReactTestData(editor)
  }

  render() {
    return (
      <div style={{ margin: 20 }}>
        <h1>关系标注</h1>
        <div className="editor" ref={this.editorDivRef} />
      </div>
    )
  }
}
