import type { Flatten, StringMap } from '#/types.js';
import type { Geometry } from '#/types/geo-json.js';

export type LogicalQuery<T = unknown> = LogicalAndQuery<T> | LogicalOrQuery<T> | LogicalNorQuery<T>;
export type LogicalQueryTypes = keyof (LogicalAndQuery & LogicalOrQuery & LogicalNorQuery);
export const allLogicalQueryTypes: LogicalQueryTypes[] = ['$and', '$or', '$nor'];

export type ComparisonQueryBody<T = unknown> = { [P in keyof T]?: ComparisonQueryOrValue<T[P]> } & StringMap<ComparisonQueryOrValue>;
export type ComparisonQueryOrValue<T = unknown> = T | ComparisonQuery<T> | Flatten<T>;

export type ComparisonQuery<T = unknown> = Partial<
  & ComparisonNotQuery<T>
  & ComparisonEqualsQuery<T>
  & ComparisonNotEqualsQuery<T>
  & ComparisonExistsQuery
  & ComparisonItemQuery<T>
  & ComparisonInQuery<T>
  & ComparisonNotInQuery<T>
  & ComparisonAllQuery<T>
  & ComparisonGreaterThanQuery<T>
  & ComparisonGreaterThanOrEqualsQuery<T>
  & ComparisonLessThanQuery<T>
  & ComparisonLessThanOrEqualsQuery<T>
  & ComparisonRegexQuery
  & ComparisonTextQuery
  & ComparisonGeoShapeQuery
  & ComparisonGeoDistanceQuery
>;

export type ComparisonQueryTypes = keyof ComparisonQuery;
export const allComparisonQueryTypes: ComparisonQueryTypes[] = ['$all', '$not', '$eq', '$exists', '$gt', '$gte', '$in', '$item', '$lt', '$lte', '$neq', '$nin', '$regex', '$text', '$geoDistance', '$geoShape'];

export type SpecialQuery<T = unknown> = Partial<TextSpanQuery<T>>;
export type SpecialQueryTypes = keyof SpecialQuery;
export const allSpecialQueryTypes: SpecialQueryTypes[] = ['$textSpan'];

export type Query<T = unknown> = LogicalQuery<T> | (ComparisonQueryBody<T> & SpecialQuery<T>);
export type QueryTypes = LogicalQueryTypes | ComparisonQueryTypes | SpecialQueryTypes;
export const allQueryTypes = [...allLogicalQueryTypes, ...allComparisonQueryTypes, ...allSpecialQueryTypes];

export type Operator = 'and' | 'or';
export const allOperators: Operator[] = ['and', 'or'];

export type LogicalAndQuery<T = unknown> = {
  $and: Query<T>[]
};

export type LogicalOrQuery<T = unknown> = {
  $or: Query<T>[]
};

export type LogicalNorQuery<T = unknown> = {
  $nor: Query<T>[]
};

export type ComparisonValue<T> = T | Flatten<T>;
export type ComparisonValueWithRegex<T> = T extends string
  ? ComparisonValue<T | RegExp>
  : T extends string[]
  ? ComparisonValue<(Flatten<T> | RegExp)[]>
  : (T | Flatten<T>);

export type ComparisonNotQuery<T = unknown> = {
  $not: ComparisonQuery<T>
};

export type ComparisonEqualsQuery<T = unknown> = {
  $eq: ComparisonValueWithRegex<T>
};

export type ComparisonNotEqualsQuery<T = unknown> = {
  $neq: ComparisonValueWithRegex<T>
};

export type ComparisonExistsQuery = {
  $exists: ComparisonValue<boolean>
};

export type ComparisonItemQuery<T = unknown> = {
  $item: T extends (infer U)[]
  ? U extends Record<string | number, unknown>
  ? Query<U>
  : ComparisonQuery<U>
  : never
};

export type ComparisonInQuery<T = unknown> = {
  $in: ComparisonValueWithRegex<T>[]
};

export type ComparisonNotInQuery<T = unknown> = {
  $nin: ComparisonValueWithRegex<T>[]
};

export type ComparisonAllQuery<T = unknown> = {
  $all: ComparisonValueWithRegex<T>[]
};

export type ComparisonGreaterThanQuery<T = unknown> = {
  $gt: ComparisonValue<T>
};

export type ComparisonGreaterThanOrEqualsQuery<T = unknown> = {
  $gte: ComparisonValue<T>
};

export type ComparisonLessThanQuery<T = unknown> = {
  $lt: ComparisonValue<T>
};

export type ComparisonLessThanOrEqualsQuery<T = unknown> = {
  $lte: ComparisonValue<T>
};

export type ComparisonRegexQuery = {
  $regex: string | RegExp | { pattern: string, flags: string }
};

export type ComparisonTextQuery = {
  $text: string | { text: string, operator?: Operator }
};

export type GeoShapeRelation = 'intersects' | 'within' | 'disjoint' | 'contains';

export type ComparisonGeoShapeQuery = {
  $geoShape: {
    geometry: Geometry,
    relation: GeoShapeRelation
  }
};

export type ComparisonGeoDistanceQuery = {
  $geoDistance: {
    longitude: number,
    latitude: number,
    /**
     * maximum distance in meters
     */
    maxDistance?: number,
    /**
     * minimum distance in meters
     */
    minDistance?: number
  }
};

export type TextSpanQueryMode = 'best' | 'most' | 'cross';
export const allTextSpanQueryModes: TextSpanQueryMode[] = ['best', 'most', 'cross'];

export type TextSpanQuery<T = unknown> = {
  $textSpan: {
    fields: (Extract<keyof T, string>)[],
    text: string,
    mode?: TextSpanQueryMode,
    operator?: Operator
  }
};
