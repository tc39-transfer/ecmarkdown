import type { Node } from './node-types';

const childKeys = {
  opaqueTag: [],
  tag: [],
  comment: [],
  algorithm: ['contents'],
  text: [],
  'double-brackets': [],
  star: ['contents'],
  underscore: [],
  tick: ['contents'],
  tilde: ['contents'],
  pipe: [],
  ul: ['contents'],
  ol: ['contents'],
  'ordered-list-item': ['contents', 'sublist'],
  'unordered-list-item': ['contents', 'sublist'],
};

export type Observer = {
  enter?: (node: Node) => void;
  exit?: (node: Node) => void;
};

export function visit(node: Node | Node[], observer: Observer) {
  if (Array.isArray(node)) {
    node.forEach(n => visit(n, observer));
    return;
  }
  observer.enter?.(node);
  // @ts-ignore
  for (let childKey of childKeys[node.name]) {
    // @ts-ignore
    let child: Node | Node[] | null = node[childKey];
    if (child === null) {
      continue;
    }
    if (Array.isArray(child)) {
      for (let c of child) {
        visit(c, observer);
      }
    } else {
      visit(child, observer);
    }
  }
  observer.exit?.(node);
}
