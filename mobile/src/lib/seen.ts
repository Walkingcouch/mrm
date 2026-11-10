import AsyncStorage from '@react-native-async-storage/async-storage';
import { IdSet, type KV } from './seen-core';

const kv: KV = { get: (k) => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) };

/** Messages whose detail view has actually rendered on this installation. */
export const seenMessages = new IdSet(kv, 'seen-messages-v1');
/** OS notification identifiers already used for navigation. */
export const handledNotifications = new IdSet(kv, 'handled-notifications-v1');
