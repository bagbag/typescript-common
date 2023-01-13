import { InvalidTokenError, UnauthorizedError } from '../error';
import type { BinaryData, OneOrMany, StringMap } from '../types';
import { toArray } from './array/array';
import { decodeBase64Url, encodeBase64Url } from './base64';
import type { HashAlgorithm, Key } from './cryptography';
import { importHmacKey, sign } from './cryptography';
import { encodeUtf8 } from './encoding';
import { binaryEquals } from './equals';

export type JwtTokenAlgorithm = 'HS256' | 'HS384' | 'HS512';

export type JwtTokenHeader<T extends StringMap = StringMap> = {
  alg: JwtTokenAlgorithm,
  typ: 'JWT'
} & T;

export type JwtToken<TPayload = StringMap, THeader extends JwtTokenHeader = JwtTokenHeader> = {
  readonly header: THeader,
  readonly payload: TPayload
};

export type JwtTokenParseResult<T extends JwtToken = JwtToken> = {
  raw: string,
  token: T,
  encoded: {
    header: string,
    payload: string,
    signature: string
  },
  bytes: {
    header: Uint8Array,
    payload: Uint8Array,
    signature: Uint8Array
  },
  string: {
    header: string,
    payload: string
  }
};

export function parseJwtTokenString<T extends JwtToken = JwtToken>(tokenString: string): JwtTokenParseResult<T> {
  const splits = tokenString.split('.');

  if (splits.length != 3) {
    throw new InvalidTokenError('invalid token format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = splits;

  const textDecoder = new TextDecoder();

  const encoded: JwtTokenParseResult['encoded'] = {
    header: encodedHeader!,
    payload: encodedPayload!,
    signature: encodedSignature!
  };

  const bytes: JwtTokenParseResult['bytes'] = {
    header: decodeBase64Url(encodedHeader!),
    payload: decodeBase64Url(encodedPayload!),
    signature: decodeBase64Url(encodedSignature!)
  };

  const string: JwtTokenParseResult['string'] = {
    header: textDecoder.decode(bytes.header),
    payload: textDecoder.decode(bytes.payload)
  };

  const header = JSON.parse(string.header) as T['header'];
  const payload = JSON.parse(string.payload) as T['payload'];

  const token: JwtToken = {
    header,
    payload
  };

  return {
    raw: tokenString,
    token: token as T,
    encoded,
    bytes,
    string
  };
}

export async function createJwtTokenString<T extends JwtToken = JwtToken>(jwtToken: T, key: Key | string): Promise<string> {
  const headerBuffer = encodeUtf8(JSON.stringify(jwtToken.header));
  const payloadBuffer = encodeUtf8(JSON.stringify(jwtToken.payload));

  const encodedHeader = encodeBase64Url(headerBuffer, 0, headerBuffer.byteLength);
  const encodedPayload = encodeBase64Url(payloadBuffer, 0, payloadBuffer.byteLength);

  const headerPayloadDataString = `${encodedHeader}.${encodedPayload}`;
  const headerPayloadData = encodeUtf8(headerPayloadDataString);

  const signature = await getSignature(headerPayloadData, jwtToken.header.alg, key);
  const encodedSignature = encodeBase64Url(signature);

  const tokenString = `${headerPayloadDataString}.${encodedSignature}`;
  return tokenString;
}

export async function parseAndValidateJwtTokenString<T extends JwtToken = JwtToken>(tokenString: string, allowedAlgorithms: OneOrMany<JwtTokenAlgorithm>, key: Key | string): Promise<T> {
  try {
    const { encoded, bytes, token } = parseJwtTokenString<T>(tokenString);

    if (!toArray(allowedAlgorithms).includes(token.header.alg)) {
      throw new UnauthorizedError('Invalid signature algorithm.');
    }

    const calculatedSignature = await getSignature(encodeUtf8(`${encoded.header}.${encoded.payload}`), token.header.alg, key);
    const validSignature = binaryEquals(calculatedSignature, bytes.signature);

    if (!validSignature) {
      throw new UnauthorizedError('Invalid token signature.');
    }

    return token;
  }
  catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new UnauthorizedError('Invalid token.');
  }
}

async function getSignature(data: BinaryData, algorithm: JwtTokenAlgorithm, key: Key | string): Promise<ArrayBuffer> {
  const hashAlgorithm = getHmacHashAlgorithm(algorithm);
  const hmacKey = await importHmacKey(hashAlgorithm, key, false);
  const hmacSignature = sign('HMAC', hmacKey, data);
  return hmacSignature.toBuffer();
}

function getHmacHashAlgorithm(algorithm: JwtTokenAlgorithm): HashAlgorithm {
  return algorithm.replace('HS', 'SHA-') as HashAlgorithm;
}
