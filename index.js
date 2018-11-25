const net = require('net')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

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

// https://juejin.im/entry/5a012eab518825297a0e27f0

// 0                   1                   2                   3
// 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
// +-+-+-+-+-------+-+-------------+-------------------------------+
// |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
// |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
// |N|V|V|V|       |S|             |   (if payload len==126/127)   |
// | |1|2|3|       |K|             |                               |
// +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
// |     Extended payload length continued, if payload len == 127  |
// + - - - - - - - - - - - - - - - +-------------------------------+
// |                               |Masking-key, if MASK set to 1  |
// +-------------------------------+-------------------------------+
// | Masking-key (continued)       |          Payload Data         |
// +-------------------------------- - - - - - - - - - - - - - - - +
// :                     Payload Data continued ...                :
// + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
// |                     Payload Data continued ...                |
// +---------------------------------------------------------------+


// |Opcode  | Meaning                             | Reference |
// -+--------+-------------------------------------+-----------|
// | 0      | Continuation Frame                  | RFC 6455  |
// -+--------+-------------------------------------+-----------|
// | 1      | Text Frame                          | RFC 6455  |
// -+--------+-------------------------------------+-----------|
// | 2      | Binary Frame                        | RFC 6455  |
// -+--------+-------------------------------------+-----------|
// | 8      | Connection Close Frame              | RFC 6455  |
// -+--------+-------------------------------------+-----------|
// | 9      | Ping Frame                          | RFC 6455  |
// -+--------+-------------------------------------+-----------|
// | 10     | Pong Frame                          | RFC 6455  |
// -+--------+-------------------------------------+-----------|


// 为什么要这么解析？
// Unit8Array 8位无符号整数值的类型化数组
// 分析第一位字节 e[0] 二进制
// binary Number.prototype.toString.call(e[0], 2)
// 第一位字节十进制为129 二进制为 10000001
// 右移：按二进制形式把所有的数字向右移动对应位移位数，低位移出(舍弃)，高位的空位补符号位，即正数补零，负数补1。
// FIN flag 取第一位所以右移7取到第一位 10000001 右移7 00000001
// &是"与"运算符：同时为1才得1，一个为0就为0 eg：1111 & 0011 = 0011
// Opcode &15 15的8位二进制为00001111 代表取后面4位 10000001 & 00001111 = 0001
// PayloadLength 为第二个字节的后7位 &01111111 | &127 | &0x7F
// websocket划分了三个数据传输界限，PayloadLength 7个bit 最多表示 127byte，有时候这不够用，所以有了拓展PayloadLength
// 当PayloadLength为126时 用2byte表示扩展长度 最大表示65535byte 约等于64kb
// 当PayloadLength为127时 用4byte表示扩展长度 最大表示4294967295byte 等于4gb
// 因此websocket一个数据帧传输数据的最大限制是4gb
// (e[i++] << 8) +  e[i++] 左移是用来将多个字节的数据拼接在一起
// eg: 1111111100000000 + 11111110 = 11111111 11111110
// 掩码
// ^是异或运算符 如果对应为中任一个操作数是1那结果就是1，如果两个操作数是1那么结果是0
// eg: 000000001 ^ 00000011 = 00000010

// 解析数据帧
function decodeDataFrame(e) {
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
    frame.PayloadLength = (e[i++] << 24) + (e[i++] << 16) + (e[i++] << 8) +  e[i++]
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
  s = new Buffer(s)
  if (frame.Opcode == 1) {
    s = s.toString()
  }
  frame.PayloadData = s
  return frame
}

// 封装数据帧
function encodeDataFrame(e) {
  let i, s = [], o = e.PayloadData, l = o.length
  s.push((e.FIN << 7) + (e.Opcode & 0xF))
  if (l < 126) {
    s.push(l & 0x7F)
  } else if (l < 0x10000) {
    s.push(
      126 & 0x7F,
      (l & 0xFF00) >> 8,
      l & 0xFF
    )
  } else {
    s.push(
      127 & 0x7F,
      0, 0, 0, 0,
      (l & 0xFF000000) >> 24,
      (l & 0xFF0000) >> 16,
      (l & 0xFF00) >> 8,
      l & 0xFF
    )
  }
  return Buffer.concat([new Buffer(s), o])
}

// 生成数据帧
//  A server must not mask any frames that it sends to the client.
function generateFrame(PayloadData, Opcode = 1, FIN = 1) {
  if (!PayloadData) throw new Error('PayloadData is null')
  return encodeDataFrame({
    FIN,
    Opcode,
    Mask: 0,
    PayloadData: Object.getPrototypeOf(PayloadData) === Buffer.prototype
      ? PayloadData
      : new Buffer(PayloadData),
  })
}

const server = net.createServer(socket => {
	socket.on('end', () => {
		console.log('客户端关闭连接')
	})

  socket.on('data', (data) => {
    if (!socket._webSocketConnect) {
      webSocketHandShake(data, socket)
    } else {
      data = decodeDataFrame(data)
      switch (data.PayloadData) {
        case 'pic':
          socket.write(generateFrame(fs.readFileSync(path.resolve(__dirname, './pic.jpg')), 2))
          break
        default:
          socket.write(generateFrame('Received: ' + data.PayloadData))
          break
      }
    }
  })
}).on('error', (err) => {
  throw err
})

server.listen(9998, () => {
	console.log('server is listening')
})
