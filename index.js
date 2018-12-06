const websocket = require('./src')
const fs = require('fs')
const path = require('path')

const server = websocket(9998, [
  {
    eventName: 'pic',
    listener: ({ payload, socket, generateFrame }) => {
      socket.write(generateFrame(fs.readFileSync(path.resolve(__dirname, './static/pic.jpg')), 'image'))
    }
  }, {
    eventName: 'package',
    listener: ({ payload, socket,  generateFrame, encodeDataFrame }) => {
      socket.write(generateFrame('this is a package', 'text'))
    }
  }
])

server.on('error', function (err) {
  console.error(err)
})
