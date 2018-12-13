const EventEmitter = require('events')

const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']

class WebSocket extends EventEmitter {
  constructor (socket, head) {
    super()

    this._socket = socket
    this.readyState = WebSocket.CONNECTING

    socket.setTimeout(0)
    socket.setNoDelay()

    if (head.length > 0) { socket.unshift(head) }

    socket.on('close', socketOnClose)
    socket.on('data', )
    socket.on('end', socketOnEnd)
    socket.on('error', )

    this.readyState = WebSocket.OPEN
    this.emit('open')

    // socket.on('end', () => {
    //   console.log('客户端关闭连接')
    // })
		//
    // socket.on('data', (data) => {
    //   // Opcode为8表示断开连接
    //   if (data.Opcode === 8) {
    //     socket.destroy()
    //     return
    //   }
    //   data = this.decodeDataFrame(data)
    // })
  }

  get CONNECTING () {
    return WebSocket.CONNECTING
  }

  get OPEN () {
    return WebSocket.OPEN
  }

  get CLOSING () {
    return WebSocket.CLOSING
  }

  get CLOSED () {
    return CLOSED
  }

  emitClose () {
    this.readyState = WebSocket.CLOSED

    if (this._socket) {
      this.emit('close')
    }
  }

  // 解析数据帧
  decodeDataFrame (e) {
    let i = 0, j, s, frame = {
      FIN: e[i] >> 7,
      Opcode: e[i++] & 15,
      Mask: e[i] >> 7,
      PayloadLength: e[i++] & 0x7F
    }
    // 处理特殊长度 126和127
    if (frame.PayloadLength === 126) {
      frame.PayloadLength = (e[i++] << 8) + e[i++]
    }
    if (frame.PayloadLength === 127) {
      i += 4  //也许是4个字节长度够了 前面4个字节留空
      frame.PayloadLength = (e[i++] << 24) + (e[i++] << 16) + (e[i++] << 8) + e[i++]
    }
    // 判断是否使用掩码
    if (frame.Mask) {
      frame.MaskingKey = [e[i++], e[i++], e[i++], e[i++]]
      for (j = 0, s = []; j < frame.PayloadLength; j++) {
        s.push(e[i + j] ^ frame.MaskingKey[j % 4])
      }
    } else {
      s = e.slice(i, frame.PayloadLength)
    }
    s = Buffer.from(s)
    if (frame.Opcode === 1) {
      s = s.toString()
    }
    frame.PayloadData = s
    return frame
  }

  // 封装数据帧
  encodeDataFrame (e) {
    let s = [], m = [], i, j, o = e.PayloadData, l = o.length
    s.push((e.FIN << 7) + (e.Opcode & 0xF))
    if (l < 126) {
      s.push((e.Mask >> 7) + (l & 0x7F))
    } else if (l < 0x10000) {
      s.push(
        (e.Mask >> 7) + (126 & 0x7F),
        (l & 0xFF00) >> 8,
        l & 0xFF
      )
    } else {
      s.push(
        (e.Mask >> 7) + (127 & 0x7F),
        0, 0, 0, 0,
        (l & 0xFF000000) >> 24,
        (l & 0xFF0000) >> 16,
        (l & 0xFF00) >> 8,
        l & 0xFF
      )
    }
    // 使用掩码
    if (e.Mask) {
      for (i = 0; i < 4; i++) {
        m.push(Math.floor(Math.random() * 255))
      }
      s.concat(m)
      for (j = 0; j < l; j++) {
        o[j] = o[j] ^ m[j % 4]
      }
    }
    return Buffer.concat([Buffer.from(s), o])
  }

  // 生成数据帧
  //  should be set Mask = 0, A server must not mask any frames that it sends to the client.
  generateFrame (PayloadData, PayloadType, Opcode = 1, Mask = 0, FIN = 1) {
    if (!PayloadData) throw new Error('PayloadData is null')
    const isBuffer = Object.getPrototypeOf(PayloadData) === Buffer.prototype
    if (isBuffer) Opcode = 2
    if (PayloadType) {
      Opcode = 2
      if (!PayloadType || !PayloadData) throw new Error('PayloadType or PayloadData is null!')
      if (PayloadType.length > 8) {
        throw new Error('PayloadType length should be less than 8!')
      } else if (PayloadType.length < 8) {
        const repair = 8 - PayloadType.length
        for (let i = 0; i < repair; i++) {
          PayloadType += ' '
        }
      }
    }
    return encodeDataFrame({
      FIN,
      Opcode,
      Mask,
      PayloadData: PayloadType
        // 定义8个字节的长度储存数据类型 PayloadType
        ? Buffer.concat([Buffer.from(PayloadType), isBuffer ? PayloadData : Buffer.from(PayloadData)])
        : isBuffer ? PayloadData : Buffer.from(PayloadData),
    })
  }
}

readyStates.forEach((readyStates, i) => {
  WebSocket[readyStates[i]] = i
})

function socketOnClose() {
  const websocket = this[Symbol('websocket')]

  this.removeListener('close', socketOnClose)
  this.removeListener('end', socketOnEnd)

  websocket.readyState = WebSocket.CLOSING

  websocket.emitClose()
}

function socketOnEnd () {
  const websocket = this[Symbol('websocket')]

  websocket.readyState = WebSocket.CLOSING

}

module.exports = WebSocket
