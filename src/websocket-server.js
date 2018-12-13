const EventEmitter = require('events')
const crypto = require('crypto')
const WebSocket = require('./websocket')

class WebSocketServer extends EventEmitter {
  constructor (server) {
    super()

    this._server = server
    this.clients = new Set()

    this._removeListeners = addListeners(server, {
      listening: this.emit.bind(this, 'listening'),
      error: this.emit.bind(this, 'error'),
      // add upgrade event handler
      upgrade: (req, socket, head) => {
        this.handleUpgrade(req, socket, head, (socket) => {
          this.emit('connection', socket, req)
        })
      }
    })
  }

  // 获取地址
  address () {
    if (!this._server) return null
    return this._server.address()
  }

  // 关闭
  close (cb) {
    if (cb) this.once('close', cb)

    if (this.clients) {
      for (const client of this.clients) client.terminate()
    }

    const server = this._server

    if (server) {
      this._removeListeners()
      this._removeListeners = this._server = null
    }

    process.nextTick(emitClose, this)
  }

  // 判断是否要升级成websocket协议
  handleUpgrade (req, socket, head, successFunc) {
    socket.on('error', socketOnError)

    const version = +req.headers['sec-websocket-version']

    // 判断是否应该握手
    if (
      req.method !== 'GET' ||
      req.headers.upgrade.toLowerCase() !== 'websocket' ||
      !req.headers['sec-websocket-key'] ||
      (version !== 8 && version !== 13)
    ) {
      return socket.destroy()
    }

    // 如果socket不可读不可写 摧毁它
    if (!socket.readable || !socket.writable) return socket.destroy()

    // 完成握手
    this.webSocketHandShake(req.headers['sec-websocket-key'], socket)
    socket.removeListener('error', socketOnError)

    const ws = new WebSocket(socket, head)
    if (this.clients) {
      this.clients.add(ws)
      ws.on('close', () => this.clients.delete(ws))
    }

    successFunc(ws)
  }

  // websocket握手
  webSocketHandShake (secWebSocketKey, socket) {
    // 这是算法中要用到的固定字符串
    const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
    // 如果没有这个头 断开tcp连接
    if (secWebSocketKey == null) {
      socket.destroy()
      return
    }
    // secWebSocketKey 拼接一段固定的字符串 sha1加密 base64编码返回给客户端校验
    const secWebSocketAccept = crypto.createHash('sha1').update(secWebSocketKey + MAGIC).digest('base64')
    // 拼接返回内容
    const handShakePackage =
      'HTTP/1.1 101 Switching Protocols\n' +
      'Connection: Upgrade\n' +
      'Server: beetle websocket server\n' +
      'Upgrade: WebSocket\n' +
      `Date: ${new Date().toGMTString()}\n` +
      'Access-Control-Allow-Credentials: true\n' +
      'Access-Control-Allow-Headers: content-type\n' +
      `Sec-WebSocket-Accept: ${secWebSocketAccept}\r\n\r\n`
    socket.write(handShakePackage)
  }
}

// 添加/移除事件
function addListeners (server, map) {
  for (const event of Object.keys(map)) server.on(event, map[event])

  return function removeListeners() {
    for (const event of Object.keys(map)) {
      server.removeListener(event, map[event])
    }
  }
}

function emitClose (server) {
  server.emit('close')
}

function socketOnError() {
  this.destroy()
}

module.exports = WebSocketServer
