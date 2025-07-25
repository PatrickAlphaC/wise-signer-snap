import type { Hex } from '@metamask/utils';
import { MethodRegistry } from 'eth-method-registry';
import { isHexPrefixed } from 'ethereumjs-util';

import fetchWithCache from './fetch-with-cache';

type FourByteResult = {
  created_at: string;
  text_signature: string;
};

type FourByteResponse = {
  results: FourByteResult[];
};

/**
 *
 * @param fourBytePrefix
 */
export async function getMethodFrom4Byte(
  fourBytePrefix: string,
): Promise<string | undefined> {
  const hasTxData = Boolean((fourBytePrefix as Hex).toLowerCase?.() !== '0x');
  if (!hasTxData || stripHexPrefix(fourBytePrefix)?.length < 8) {
    return undefined;
  }

  const fourByteResponse = (await fetchWithCache({
    url: `https://www.4byte.directory/api/v1/signatures/?hex_signature=${fourBytePrefix}`,
    fetchOptions: {
      referrerPolicy: 'no-referrer-when-downgrade',
      body: null,
      method: 'GET',
      mode: 'cors',
    },
    functionName: 'getMethodFrom4Byte',
  })) as FourByteResponse;

  if (!fourByteResponse.results?.length) {
    return undefined;
  }

  fourByteResponse.results.sort((a, b) => {
    return new Date(a.created_at).getTime() < new Date(b.created_at).getTime()
      ? -1
      : 1;
  });

  return fourByteResponse.results[0]!.text_signature;
}

let registry: MethodRegistry | undefined;

type HttpProvider = {
  host: string;
  timeout: number;
};

type MethodRegistryArgs = {
  network: string;
  provider: HttpProvider;
};

/**
 *
 * @param fourBytePrefix
 * @param allow4ByteRequests
 * @param provider
 */
export async function getMethodDataAsync(
  fourBytePrefix: string,
  allow4ByteRequests: boolean,
  provider?: unknown,
) {
  try {
    let fourByteSig = null;
    if (allow4ByteRequests) {
      fourByteSig = await getMethodFrom4Byte(fourBytePrefix).catch((e) => {
        // console.error(e);
        return null;
      });
    }

    if (!registry) {
      registry = new MethodRegistry({
        provider: provider ?? (globalThis as any).ethereumProvider,
      } as MethodRegistryArgs);
    }

    if (!fourByteSig) {
      return {};
    }

    const parsedResult = registry.parse(fourByteSig);

    return {
      name: parsedResult.name,
      params: parsedResult.args,
    };
  } catch (error) {
    // console.error(error);
    return {};
  }
}

/**
 *
 * @param str
 */
export function stripHexPrefix(str: string) {
  if (typeof str !== 'string') {
    return str;
  }
  return isHexPrefixed(str) ? str.slice(2) : str;
}
