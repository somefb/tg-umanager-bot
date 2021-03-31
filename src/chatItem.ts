export default class ChatItem {
  id: number;
  /** Index from which we need to start deleting messages */
  lastDeleteIndex = 1;
  isGroup = false;

  constructor(id: number) {
    this.id = id;
  }
}
