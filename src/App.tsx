import invariant from 'invariant'
import React from 'react'
import { COLORS, FONT } from './constants'
import RelationEditor from './RelationEditor'

const text = `React（有时叫React.js或ReactJS）是一个将数据渲染为HTML视图的开源JavaScript库。React视图通常采用包含以自定义HTML标记规定的其他组件的组件渲染。React为程序员提供了一种子组件不能直接影响外层组件（"data flows down"）的模型，数据改变时对HTML文档的有效更新，和现代单页应用中组件之间干净的分离。它由Facebook、Instagram和一个由个人开发者和企业组成的社群维护。根据JavaScript分析服务Libscore，React当前正在被Netflix、Imgur、Bleacher Report、Feedly、Airbnb、SeatGeek、HelloSign等很多网站的主页使用。截至2015年1月，React和React Native在GitHub上的加星数量是Facebook位列第二的开源项目，也是GitHub有史以来星标第九多的项目。`

const makeEntityFactory = (fulltext: string) => (abbr: string) => {
  const [text, orderStr] = abbr.split('#')
  const order = orderStr ? Number(orderStr) : 1
  let foundCount = 0
  let cursor = -1
  while (foundCount < order) {
    cursor = fulltext.indexOf(text, cursor + 1)
    invariant(cursor !== -1, `Cannot find "${text}" in fulltext`)
    foundCount++
  }
  return { id: abbr, s: cursor, e: cursor + text.length, color: COLORS[0] }
}

export default class App extends React.Component {
  shouldComponentUpdate() {
    return false
  }

  editorDivRef = React.createRef<HTMLDivElement>()

  componentDidMount() {
    const editor = new RelationEditor(this.editorDivRef.current, FONT)
    editor.setText(text)

    const e = makeEntityFactory(text)
    editor.setEntities([
      e('React'),
      e('React.js'),
      e('ReactJS'),
      e('将数据渲染为HTML视图'),
      e('JavaScript'),
      e('React#5'),
      e('程序员'),
      e('子组件不能直接影响外层组件'),
      e('模型'),
      e('它'),
      e('个人开发者和企业'),
      e('社群'),
      e('React#7'),
      e('React Native'),
      e('GitHub'),
      e('加星数量'),
      e('第二'),
    ])
    editor.addLink({ a: 'React', b: 'React.js', label: '别名' })
    editor.addLink({ a: 'React', b: 'ReactJS', label: '别名' })
    editor.addLink({ a: 'React', b: '将数据渲染为HTML视图', label: '作用' })
    editor.addLink({ a: 'React', b: 'JavaScript', label: '所使用的编程语言' })
    editor.addLink({ a: 'React#5', b: '程序员', label: '服务' })
    editor.addLink({ a: '它', b: 'React#5', label: '指代' })
    editor.addLink({ a: '子组件不能直接影响外层组件', b: '模型', label: '具体内容' })
    editor.addLink({ a: '个人开发者和企业', b: '社群', label: '组成部分' })
    editor.addLink({ a: 'React#7', b: 'React Native', label: '并列' })
    editor.addLink({ a: 'React#7', b: 'GitHub', label: '开源' })
    editor.addLink({ a: '加星数量', b: '第二', label: '排名' })
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
