import type { ChatMessage } from '../types.js';
// A bounded circular buffer: time retention plus a hard cap against memory growth.
export class ChatBuffer {
  private slots: (ChatMessage | undefined)[];
  private head = 0;
  private size = 0;
  private seen = new Set<string>();
  constructor(private retentionMs = 15 * 60_000, private capacity = 100_000, private now = Date.now) {
    if (capacity < 1 || !Number.isInteger(capacity)) throw new Error('Invalid capacity');
    this.slots = new Array(capacity);
  }
  private remove() {
    const item = this.slots[this.head];
    if (item) this.seen.delete(item.id);
    this.slots[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.size--;
  }
  private prune() {
    while (this.size && this.slots[this.head]!.ts < this.now() - this.retentionMs) this.remove();
  }
  add(message: ChatMessage): boolean {
    this.prune();
    if (message.ts < this.now() - this.retentionMs || this.seen.has(message.id)) return false;
    if (this.size === this.capacity) this.remove();
    this.slots[(this.head + this.size) % this.capacity] = message;
    this.size++;
    this.seen.add(message.id);
    return true;
  }
  recent(since = this.now() - this.retentionMs): ChatMessage[] {
    this.prune();
    return Array.from({length: this.size}, (_, i) => this.slots[(this.head + i) % this.capacity]!).filter(m => m.ts >= since);
  }
}
