import type { PropertyOf, TypeOf } from '@tstdl/base/types';
import type { BoolQuery, IdsQuery, MatchAllQuery, RangeQuery, RegexQuery, TermQuery, TextQuery } from './types';

export type IdsQueryBody = TypeOf<IdsQuery, 'ids'>;
export type TermQueryBody = PropertyOf<TermQuery, 'term'>;
export type MatchAllQueryBody = PropertyOf<MatchAllQuery, 'matchAll'>;
export type BoolQueryBody = PropertyOf<BoolQuery, 'bool'>;
export type RangeQueryBody = PropertyOf<RangeQuery, 'range'>;
export type TextQueryBody = PropertyOf<TextQuery, 'text'>;
export type RegexQueryBody = PropertyOf<RegexQuery, 'regex'>;
