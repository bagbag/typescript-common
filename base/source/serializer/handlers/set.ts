import type { Serialized } from '../types';
import type { TryDereference } from '../_internal';

type SetData = Serialized<any>[];

export function serializeSet(set: Set<any>): SetData {
  const data: SetData = [...set.values()];
  return data;
}

export function deserializeSet(data: SetData, tryDereference: TryDereference): Set<any> {
  const set = new Set<unknown>();

  for (const item of data) {
    const has = tryDereference(item, (dereferenced) => {
      set.add(dereferenced);
    });

    if (!has) {
      set.add(item);
    }
  }

  return set;
}
