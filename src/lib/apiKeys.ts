// src/lib/apiKeys.ts
// Client helpers for per-user API keys (Settings) and admin key management.

import { gql } from './api';
import { encodeId, decodeId } from './globalId';

export interface ApiKey {
  id: string;
  userId: string;
  apiKey: string;
  name: string | null;
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

const KEY_FIELDS = `id userId apiKey name createdAt lastUsedAt`;

function normalizeApiKey(k: ApiKey): ApiKey {
  return { ...k, id: decodeId(k.id), userId: decodeId(k.userId) };
}

export async function getMyApiKeys(): Promise<ApiKey[]> {
  const data = await gql<{ myApiKeys: ApiKey[] }>(`query { myApiKeys { ${KEY_FIELDS} } }`);
  return (data?.myApiKeys ?? []).map(normalizeApiKey);
}

export async function createMyApiKey(name?: string): Promise<ApiKey> {
  const data = await gql<{ createMyApiKey: ApiKey }>(
    `mutation ($name: String) { createMyApiKey(name: $name) { ${KEY_FIELDS} } }`,
    { name: name || null },
  );
  return normalizeApiKey(data.createMyApiKey);
}

export async function revokeMyApiKey(id: string): Promise<void> {
  await gql(`mutation ($id: ID!) { revokeMyApiKey(id: $id) }`, { id: encodeId('ApiKey', id) });
}

export async function getUserApiKeys(userId: string): Promise<ApiKey[]> {
  const data = await gql<{ apiKeys: ApiKey[] }>(
    `query ($userId: String) { apiKeys(userId: $userId) { ${KEY_FIELDS} } }`,
    { userId: encodeId('User', userId) },
  );
  return (data?.apiKeys ?? []).map(normalizeApiKey);
}

export async function createUserApiKey(userId: string, name?: string): Promise<ApiKey> {
  const data = await gql<{ createApiKey: ApiKey }>(
    `mutation ($userId: ID!, $name: String) { createApiKey(userId: $userId, name: $name) { ${KEY_FIELDS} } }`,
    { userId: encodeId('User', userId), name: name || null },
  );
  return normalizeApiKey(data.createApiKey);
}

export async function revokeUserApiKey(id: string): Promise<void> {
  await gql(`mutation ($id: ID!) { revokeApiKey(id: $id) }`, { id: encodeId('ApiKey', id) });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
