// "Employee Messages changed" signal, so an open Messages screen can reload
// straight away. Fired by: a push arriving while the app is open, and the
// content-free Realtime broadcast the database sends on every new message.
// It only ever reloads the list; it never opens or shows a message.
type Listener = () => void;
const listeners = new Set<Listener>();
export const messagesChanged = {
  emit() { listeners.forEach((l) => l()); },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};
