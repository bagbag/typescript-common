import { normalizeHttpValue } from '#/http/types';
import type { UndefinableJson, UndefinableJsonObject, UndefinableJsonPrimitive } from '../types';
import { memoizeSingle } from './function/memoize';
import { isArray, isDefined, isObject, isUndefined } from './type-guards';

const enum UrlBuilderPartType {
  Literal = 0,
  Parameter = 1
}

type UrlBuilderPart = {
  type: UrlBuilderPartType,
  value: string
};

export type UrlBuilderParameterValue = UndefinableJsonPrimitive;
export type UrlBuilderParameters = UndefinableJsonObject;
export type UrlBuilderOptions = { arraySeparator?: string };
export type UrlBuilderResult = { parsedUrl: string, parametersRest: UrlBuilderParameters };

const urlParseRegex = /([^:]+|:\/+)|:([\w-]+)/ug;
const isFullUrlRegex = /^\w+:\/\//u;

// eslint-disable-next-line max-lines-per-function
export function compileUrlBuilder(url: string): (parameters?: UrlBuilderParameters, options?: UrlBuilderOptions) => UrlBuilderResult {
  const parts: UrlBuilderPart[] = [];
  const isFullUrl = isFullUrlRegex.test(url);

  let parseUrl = url;

  if (isFullUrl) {
    const { origin } = new URL(url);
    parts.push({ type: UrlBuilderPartType.Literal, value: origin });
    parseUrl = url.slice(origin.length);
  }

  const matches = parseUrl.matchAll(urlParseRegex);

  for (const [, literal, parameter] of matches) {
    if (isDefined(literal)) {
      parts.push({ type: UrlBuilderPartType.Literal, value: literal });
    }
    else if (isDefined(parameter)) {
      parts.push({ type: UrlBuilderPartType.Parameter, value: parameter });
    }
  }

  function buildUrlCompiled(parameters: UrlBuilderParameters = {}, { arraySeparator = ',' }: UrlBuilderOptions = {}): UrlBuilderResult {
    let parsedUrl = '';
    let value: UndefinableJson | undefined;
    let parametersRest = parameters;

    for (const part of parts) {
      if (part.type == UrlBuilderPartType.Literal) {
        parsedUrl += part.value;
      }
      else {
        ({ [part.value]: value, ...parametersRest } = parametersRest);

        if (isUndefined(value)) {
          throw new Error(`Url parameter ${part.value} not provided. (${url})`);
        }

        if (isObject(value)) {
          throw new Error(`Url parameter ${part.value} is an object. (${url})`);
        }

        parsedUrl += isArray(value) ? value.map(normalizeHttpValue).join(arraySeparator) : normalizeHttpValue(value);
      }
    }

    return { parsedUrl, parametersRest };
  }

  return buildUrlCompiled;
}

const memoizedCompileUrlBuilder = memoizeSingle(compileUrlBuilder);

export function buildUrl(url: string, parameters: UrlBuilderParameters = {}, options?: UrlBuilderOptions): UrlBuilderResult {
  const builder = memoizedCompileUrlBuilder(url);
  return builder(parameters, options);
}
