class Queue {
  constructor() {
    this.songs = [];
  }

  add(song) {
    this.songs.push(song);
  }

  next() {
    return this.songs.shift();
  }

  hasNext() {
    return this.songs.length > 0;
  }

  list() {
    return this.songs;
  }
}

export const queue = new Queue();