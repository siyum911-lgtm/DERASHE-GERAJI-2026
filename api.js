const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
  if (!apiBaseUrl) {
    throw new Error('Set EXPO_PUBLIC_API_URL in mobile/.env to your computer’s network address.');
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(`Could not reach ${apiBaseUrl}. Check the API server and that your phone is on the same Wi-Fi.`);
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data;
}