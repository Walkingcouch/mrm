// Anonymous per-installation identity. No employee data, no device
// fingerprinting: a random id + secret stored on the device. Reinstalling
// the app creates a new installation (documented limitation).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from './api';

const KEY = 'installation-v1';
export interface Installation { id: string; secret: string }

let cached: Installation | null = null;

export async function getInstallation(): Promise<Installation> {
  if (cached) return cached;
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return (cached = JSON.parse(raw));
  const bytes = await Crypto.getRandomBytesAsync(32);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  cached = { id: Crypto.randomUUID(), secret };
  await AsyncStorage.setItem(KEY, JSON.stringify(cached));
  return cached;
}

export async function registerInstallation(platform: 'ios' | 'android', pushToken: string | null): Promise<void> {
  const inst = await getInstallation();
  const { error } = await supabase.rpc('app_register_installation', {
    p_id: inst.id, p_secret: inst.secret, p_platform: platform,
    p_push_token: pushToken, p_push_enabled: Boolean(pushToken),
  });
  if (error) throw error;
}

export async function getSubscriptions(): Promise<string[]> {
  const inst = await getInstallation();
  const { data, error } = await supabase.rpc('app_get_subscriptions', { p_id: inst.id, p_secret: inst.secret });
  if (error) throw error;
  return (data ?? []) as string[];
}

export async function setSubscriptions(sourceIds: string[]): Promise<void> {
  const inst = await getInstallation();
  const { error } = await supabase.rpc('app_set_subscriptions', { p_id: inst.id, p_secret: inst.secret, p_sources: sourceIds });
  if (error) throw error;
}
