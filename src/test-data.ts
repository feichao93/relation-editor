import invariant from 'invariant'
import { COLORS } from './constants'
import RelationEditor from './RelationEditor'
import { Entity } from './types'

/** 用来快速设置 link 的测试函数 */
function addLinkFactory(editor: RelationEditor) {
  let entities: Entity[] = []

  const findEntity = (abbr: string) => {
    let [text, orderStr] = abbr.split('#')

    const order = orderStr ? Number(orderStr) : 1
    let foundCount = 0
    let cursor = -1
    while (foundCount < order) {
      cursor = editor.getText().indexOf(text, cursor + 1)
      invariant(cursor !== -1, `Cannot find "${text}" in fulltext`)
      foundCount++
    }
    return { id: abbr, startPos: cursor, endPos: cursor + text.length, color: COLORS[0] }
  }

  function addLink(e1Abbr: string, label: string, e2Abbr: string) {
    const e1 = findEntity(e1Abbr)
    const e2 = findEntity(e2Abbr)
    let needReset = false
    if (!entities.some(e => e.id === e1.id)) {
      entities.push(e1)
      needReset = true
    }
    if (!entities.some(e => e.id === e2.id)) {
      entities.push(e2)
      needReset = true
    }
    if (needReset) {
      editor.setEntities(entities)
    }
    editor.addLink({ id: `${e1Abbr}-${label}-${e2Abbr}`, a: e1.id, b: e2.id, label })
  }

  return addLink
}

export const useReactTestData = (editor: RelationEditor) => {
  const text = `React（有时叫React.js或ReactJS）是一个将数据渲染为HTML视图的开源JavaScript库。React视图通常采用包含以自定义HTML标记规定的其他组件的组件渲染。React为程序员提供了一种子组件不能直接影响外层组件（"data flows down"）的模型，数据改变时对HTML文档的有效更新，和现代单页应用中组件之间干净的分离。它由Facebook、Instagram和一个由个人开发者和企业组成的社群维护。根据JavaScript分析服务Libscore，React当前正在被Netflix、Imgur、Bleacher Report、Feedly、Airbnb、SeatGeek、HelloSign等很多网站的主页使用。截至2015年1月，React和React Native在GitHub上的加星数量是Facebook位列第二的开源项目，也是GitHub有史以来星标第九多的项目。`

  editor.setText(text)

  const addLink = addLinkFactory(editor)
  addLink('React', '@别名', 'React.js')
  addLink('React', '@别名', 'ReactJS')
  addLink('React', '@作用', '将数据渲染为HTML视图')
  addLink('React', '@所使用的编程语言', 'JavaScript')
  addLink('React#5', '@服务', '程序员')
  addLink('它', '@指代', 'React#5')
  addLink('子组件不能直接影响外层组件', '@具体内容', '模型')
  addLink('个人开发者和企业', '@组成部分', '社群')
  addLink('React#7', '@并列', 'React Native')
  addLink('React#7', '@开源', 'GitHub')
  addLink('加星数量', '@排名', '第二')
  
  addLink('Facebook', '@开发', '它')
}
