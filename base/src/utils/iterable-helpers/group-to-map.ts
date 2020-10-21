import { FactoryMap } from '../factory-map';
import type { IteratorFunction } from './types';

export function groupToMap<TIn, TGroup>(iterable: Iterable<TIn>, selector: IteratorFunction<TIn, TGroup>): Map<TGroup, TIn[]> {
  const map = new FactoryMap<TGroup, TIn[]>(() => []);

  let index = 0;
  for (const item of iterable) {
    const groupKey = selector(item, index++);
    map.get(groupKey).push(item);
  }

  return map;
}
