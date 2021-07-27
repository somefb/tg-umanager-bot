Set.prototype.toJSON = function <T>(): Array<T> {
  return Array.from(this.values());
};
