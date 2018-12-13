const http = require('http')
const websocket = require('./src/websocket-server')
const fs = require('fs')
const path = require('path')

const port = 9998

const server = new http.createServer()

server.listen(port, () => {
  console.log(`HTTPS中间人代理启动成功，端口${port}`)
})

server.on('error', function (err) {
  console.error(err)
})

websocket(server)
