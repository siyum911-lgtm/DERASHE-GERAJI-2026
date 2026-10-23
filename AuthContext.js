import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../lib/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'dg-token';

async function readToken() {
  return Platform.OS === 'web' ? globalThis.localStorage?.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);
}

async function saveToken(token) {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(TOKEN_KEY, token);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken() {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    readToken().then(async (savedToken) => {
      if (!savedToken) return;
      try {
        const result = await apiRequest('/auth/me', { token: savedToken });
        if (active) {
          setToken(savedToken);
          setUser(result.user);
        }
      } catch {
        await clearToken();
      }
    }).catch(() => {}).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  const signIn = async (result) => {
    await saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
  };

  const signOut = async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, ready, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}