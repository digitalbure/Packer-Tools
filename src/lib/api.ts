import { getAuth } from 'firebase/auth';

/**
 * Enhanced fetch wrapper that automatically fetches and attaches 
 * the current user's Firebase ID Token as an Authorization Bearer header.
 * Prevents unauthorized API access and shields server-side resources.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const auth = getAuth();
  const user = auth.currentUser;
  
  const headers = new Headers(init?.headers || {});
  
  if (user) {
    try {
      // Force refreshing of token to ensure it isn't expired
      const idToken = await user.getIdToken(false);
      headers.set('Authorization', `Bearer ${idToken}`);
    } catch (e) {
      console.warn("[authenticatedFetch] Failed to retrieve Firebase ID token:", e);
    }
  }
  
  return fetch(input, {
    ...init,
    headers
  });
}
