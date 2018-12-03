const EventEmitter = require('events')

const myEvent = new EventEmitter()

myEvent._emit = (eventName, { cb }) => {
  if (myEvent.listeners(eventName).length > 0) {
    myEvent.emit(...arguments)
  } else {
    cb()
    throw new Error(`eventName: '${eventName}' not handler`)
  }
}

module.exports = (handlers) => {
  console.log(handlers)
  return (socket, data, cb, generateFrame, encodeDataFrame) => {
    switch (data.Opcode) {
      case 1:
        myEvent._emit(data.PayloadData, { socket, cb, generateFrame, encodeDataFrame })
        break
      case 2:
        myEvent._emit(data.PayloadData.slice(0, 8).toString().trim(), {
          payload: data.PayloadData.slice(8, data.PayloadLength),
          socket,
          cb,
          generateFrame,
          encodeDataFrame
        })
        break
      default:
        cb()
        throw new Error(`Opcode: '${data.Opcode}' not handler`)
    }
  }
}
