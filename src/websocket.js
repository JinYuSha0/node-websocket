const EventEmitter = require('events')

const SWebSocket = Symbol('websocket')
const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']

class WebSocket extends EventEmitter {
  constructor (socket, head, req) {
    super()

    this._socket = socket
    this._req = req
    this.readyState = WebSocket.CONNECTING

    socket.setTimeout(0)
    socket.setNoDelay()
    socket[SWebSocket] = this

    if (head.length > 0) { socket.unshift(head) }

    socket.on('close', socketOnClose)
    socket.on('data', socketOnData)
    socket.on('end', socketOnEnd)
    // socket.on('error', )

    this.readyState = WebSocket.OPEN
    this.emit('open')
  }

  emitClose () {
    this.readyState = WebSocket.CLOSED

    if (this._socket) {
      this.emit('close')
    }
  }

  send (data, options = {}, cb) {
    const { PayloadType, Opcode, Mask, Fin } = options
    const frame = this.generateFrame(data, PayloadType, Opcode, Mask, Fin)
    if (this._socket) {
      this._socket.write(frame, cb)
    }
  }

  close () {
    if (this.readyState === WebSocket.CLOSED) return

    this.readyState = WebSocket.CLOSING
    this._socket.end()
    this._socket.destroy()
  }

  terminate () {
    if (this.readyState === WebSocket.CLOSED) return
    if (this._socket) {
      this.readyState = WebSocket.CLOSING
      this._socket.destroy()
    }
  }

  ping () {
    // 注：Ping帧中可能会携带数据
    // 注：在收到Ping帧后，端点必须发送Pong帧响应，除非已经收到了Close帧。在实际中应尽可能快的响应。
    if (this.readyState !== WebSocket.OPEN) {
      const err = new Error(
        `WebSocket is not open: readyState ${this.readyState} ` +
        `(${readyStates[this.readyState]})`
      )

      throw err
    }

    this.send('1', { Opcode: 0x9 })
  }

  pong (data) {
    // 注：在响应Ping帧的的Pong帧中，必须携和被响应的Ping帧中相同的数据。
    if (this.readyState !== WebSocket.OPEN) {
      const err = new Error(
        `WebSocket is not open: readyState ${this.readyState} ` +
        `(${readyStates[this.readyState]})`
      )

      throw err
    }

    this.send(data, { Opcode: 0xA })
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
    return this.encodeDataFrame({
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
  WebSocket[readyStates] = i
})

function socketOnClose() {
  const websocket = this[SWebSocket]

  this.removeListener('close', socketOnClose)
  this.removeListener('end', socketOnEnd)

  websocket.readyState = WebSocket.CLOSING

  this.removeListener('data', socketOnData)
  this[SWebSocket] = undefined

  websocket.emitClose()
}

function socketOnEnd () {
  const websocket = this[SWebSocket]

  websocket.readyState = WebSocket.CLOSING

  this.end()
}

function socketOnData (chunk) {
  const websocket = this[SWebSocket]

  const { FIN, Opcode, Mask, PayloadLength, MaskingKey, PayloadData } = websocket.decodeDataFrame(chunk)

  switch (Opcode) {
    case 1:
      websocket.emit(PayloadData.toString())
      break
    case 2:
      const PayloadType = PayloadData.slice(0, 8).toString().trim()
      const Data = PayloadData.slice(8, PayloadLength).toString()
      websocket.emit(PayloadType, Data)
      break
    case 0x9: // Ping
      websocket.pong(PayloadData)
      break
  }
}

module.exports = WebSocket
