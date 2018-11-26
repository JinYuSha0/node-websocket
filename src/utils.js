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

//   究极蛇皮迭代器队列 demo
//   const queue = window.queue = new Queue(function () {
//   const {value, done} = this.next()
//   if (!done) {
//     console.log(value)
//     setTimeout(() => {
//       this.start()
//     }, 2000)
//   } else {
//     this.stop()
//   }
// })
}

module.exports = {
  IteratorQueue,
}
