/** Parse JSON from a fetch Response; returns null for empty or invalid bodies. */
export async function readResponseJson<T>(
  response: Response,
): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
