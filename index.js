const net = require('net')
const crypto = require('crypto')

// websocket握手
function websocketHandShake(data, socket) {
  // 这是算法中要用到的固定字符串
  const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
  // 获取请求内容中的Sec-WebSocket-Key
  const secWebSocketKey = data.toString().match(/Sec-WebSocket-Key:\s+(\S*)\r\n/)[1]
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
    `Sec-WebSocket-Accept: ${secWebSocketAccept}\n\r\n\r`
  socket.write(handShakePackage)
  // 标识websocket已建立连接
  socket._webSocketConnect = true
}

const server = net.createServer(socket => {
	socket.on('end', () => {
		console.log('客户端关闭连接')
	})

  socket.on('data', (data) => {
    if (!socket._webSocketConnect) {
      websocketHandShake(data, socket)
    } else {
      console.log(data)
    }
  })
}).on('error', (err) => {
  throw err
})

server.listen(9998, () => {
	console.log('server is listening')
})
