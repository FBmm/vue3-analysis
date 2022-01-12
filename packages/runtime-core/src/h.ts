import {
  VNode,
  VNodeProps,
  createVNode,
  VNodeArrayChildren,
  Fragment,
  Text,
  Comment,
  isVNode
} from './vnode'
import { Teleport, TeleportProps } from './components/Teleport'
import { Suspense, SuspenseProps } from './components/Suspense'
import { isObject, isArray } from '@vue/shared'
import { RawSlots } from './componentSlots'
import {
  FunctionalComponent,
  Component,
  ComponentOptions,
  ConcreteComponent
} from './component'
import { EmitsOptions } from './componentEmits'
import { DefineComponent } from './apiDefineComponent'

// `h` is a more user-friendly version of `createVNode` that allows omitting the
// props when possible. It is intended for manually written render functions.
// Compiler-generated code uses `createVNode` because
// 1. it is monomorphic and avoids the extra call overhead
// 2. it allows specifying patchFlags for optimization

/*
// type only
h('div')

// type + props
h('div', {})

// type + omit props + children
// Omit props does NOT support named slots
h('div', []) // array
h('div', 'foo') // text
h('div', h('br')) // vnode
h(Component, () => {}) // default slot

// type + props + children
h('div', {}, []) // array
h('div', {}, 'foo') // text
h('div', {}, h('br')) // vnode
h(Component, {}, () => {}) // default slot
h(Component, {}, {}) // named slots

// named slots without props requires explicit `null` to avoid ambiguity
h(Component, null, {})
**/

type RawProps = VNodeProps & {
  // used to differ from a single VNode object as children
  __v_isVNode?: never
  // used to differ from Array children
  [Symbol.iterator]?: never
} & Record<string, any>

type RawChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren
  | (() => any)

// fake constructor type returned from `defineComponent`
interface Constructor<P = any> {
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
  new (...args: any[]): { $props: P }
}

// The following is a series of overloads for providing props validation of
// manually written render functions.

// element
export function h(type: string, children?: RawChildren): VNode
export function h(
  type: string,
  props?: RawProps | null,
  children?: RawChildren | RawSlots
): VNode

// text/comment
export function h(
  type: typeof Text | typeof Comment,
  children?: string | number | boolean
): VNode
export function h(
  type: typeof Text | typeof Comment,
  props?: null,
  children?: string | number | boolean
): VNode
// fragment
export function h(type: typeof Fragment, children?: VNodeArrayChildren): VNode
export function h(
  type: typeof Fragment,
  props?: RawProps | null,
  children?: VNodeArrayChildren
): VNode

// teleport (target prop is required)
export function h(
  type: typeof Teleport,
  props: RawProps & TeleportProps,
  children: RawChildren
): VNode

// suspense
export function h(type: typeof Suspense, children?: RawChildren): VNode
export function h(
  type: typeof Suspense,
  props?: (RawProps & SuspenseProps) | null,
  children?: RawChildren | RawSlots
): VNode

// functional component
export function h<P, E extends EmitsOptions = {}>(
  type: FunctionalComponent<P, E>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// catch-all for generic component types
export function h(type: Component, children?: RawChildren): VNode

// concrete component
export function h<P>(
  type: ConcreteComponent | string,
  children?: RawChildren
): VNode
export function h<P>(
  type: ConcreteComponent<P> | string,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren
): VNode

// component without props
export function h(
  type: Component,
  props: null,
  children?: RawChildren | RawSlots
): VNode

// exclude `defineComponent` constructors
export function h<P>(
  type: ComponentOptions<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// fake constructor type returned by `defineComponent` or class component
export function h(type: Constructor, children?: RawChildren): VNode
export function h<P>(
  type: Constructor<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// fake constructor type returned by `defineComponent`
export function h(type: DefineComponent, children?: RawChildren): VNode
export function h<P>(
  type: DefineComponent<P>,
  props?: (RawProps & P) | ({} extends P ? null : never),
  children?: RawChildren | RawSlots
): VNode

// Actual implementation
/**
 * h 方法 - 渲染函数，返回 VNode
 * 官方描述：目的是用于手动编写的渲染函数
 * 个人分析：h 函数主要是在调用 createVNode 方法前做参数扩展与异常处理，封装后暴露给外部人员使用
 * @param type
 * @param propsOrChildren 第二个参数可以是参数对象或者节点
 * @param children
 */
export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  const l = arguments.length
  // 参数兼容
  if (l === 2) {
    // 如果 propsOrChildren 是对象类型并且不是数组类型
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props 区分 vnode
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      // props without children 不是数组当作html标签参数或者VNodeProps
      return createVNode(type, propsOrChildren)
    } else {
      // omit props 当作子节点参数
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    // 处理溢出参数
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2) // 第三个及以后的参数当作子节点
    } else if (l === 3 && isVNode(children)) { // createVNode 第三个入参必须是数组
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
