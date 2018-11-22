const net = require('net')
const crypto = require('crypto')

// websocket握手
function webSocketHandShake(data, socket) {
  // 这是算法中要用到的固定字符串
  const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
  // 获取请求内容中的Sec-WebSocket-Key
  const secWebSocketKeyMatch = data.toString().match(/Sec-WebSocket-Key:\s?(\S*)\r\n/i)
  const secWebSocketKey = secWebSocketKeyMatch ? secWebSocketKeyMatch[1] : null
  // 如果没有这个头 断开tcp连接
  if (secWebSocketKey == null) {
    socket.end()
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
  // 标识websocket已建立连接
  socket._webSocketConnect = true
}

function decodeDataFrame(e) {
  let i = 0, j, s, frame = {
    FIN: e[i]>>7,
    Opcode: e[i++]&15,
    Mask: e[i]>>7,
    PayloadLength: e[i++]&0x7F
  }
  // https://juejin.im/entry/5a012eab518825297a0e27f0
  console.log(e[2]>>7)
}

const server = net.createServer(socket => {
	socket.on('end', () => {
		console.log('客户端关闭连接')
	})

  socket.on('data', (data) => {
    if (!socket._webSocketConnect) {
      webSocketHandShake(data, socket)
    } else {
      decodeDataFrame(data)
    }
  })
}).on('error', (err) => {
  throw err
})

server.listen(9998, () => {
	console.log('server is listening')
})
