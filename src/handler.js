const EventEmitter = require('events')

const myEvent = new EventEmitter()

myEvent._emit = (eventName, params) => {
  if (myEvent.listeners(eventName).length > 0) {
    myEvent.emit(eventName, params)
  } else {
    throw new Error(`eventName: '${eventName}' not handler`)
  }
}

module.exports = (handlers) => {
  handlers.forEach(handler => {
    myEvent.on(handler.eventName, handler.listener)
  })

  return (socket, data, generateFrame, encodeDataFrame) => {
    try {
      switch (data.Opcode) {
        case 1:
          myEvent._emit(data.PayloadData, { socket, generateFrame, encodeDataFrame })
          break
        case 2:
          myEvent._emit(data.PayloadData.slice(0, 8).toString().trim(), {
            payload: data.PayloadData.slice(8, data.PayloadLength),
            socket,
            generateFrame,
            encodeDataFrame
          })
          break
        case 8:
          socket.end()
          break
        default:
          throw new Error(`Opcode: '${data.Opcode}' not handler`)
      }
    } catch (err) {
      throw err
    }
  }
}
