function IteratorQueue(handler) {
  const Iterator = Array.prototype[Symbol.iterator]
  this.iterator = Iterator.call([])
  this._start = false

  IteratorQueue.prototype.add = function (item) {
    const queue = Array.from(this.iterator)
    queue.push(item)
    this.iterator = Iterator.call(queue)
    if (!this._start) {
      this.start()
    }
  }

  IteratorQueue.prototype.start = function () {
    this._start = true
    handler.call(this)
  }

  IteratorQueue.prototype.stop = function () {
    this._start = false
  }

  IteratorQueue.prototype.next = function () {
    return this.iterator.next()
  }

  IteratorQueue.prototype.callback = function () {
    this.start()
  }
}

module.exports = {
  IteratorQueue,
}
