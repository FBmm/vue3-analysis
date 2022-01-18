// shapeFlags 针对 VNode 的 type 进行了更详细的分类，便于在 patch 阶段，根据不同的类型执行相应的逻辑。
export const enum ShapeFlags {
  ELEMENT = 1, // HTML 或 SVG 标签 普通 DOM 元素
  FUNCTIONAL_COMPONENT = 1 << 1, // 函数式组件
  STATEFUL_COMPONENT = 1 << 2, // 普通有状态组件
  TEXT_CHILDREN = 1 << 3, // 子节点是纯文本
  ARRAY_CHILDREN = 1 << 4, // 子节点是数组
  SLOTS_CHILDREN = 1 << 5, // 子节点是插槽
  TELEPORT = 1 << 6, // Teleport
  SUSPENSE = 1 << 7, // Suspense
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 需要被 keep-alive 的有状态组件
  COMPONENT_KEPT_ALIVE = 1 << 9, // 已经被 keep-alive 的有状态组件
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT // 有状态组件和函数组件都是组件，用 COMPONENT 表示
}
