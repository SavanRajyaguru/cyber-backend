// Socket.IO bootstrap stub — realtime features can be wired later.
module.exports = (io) => {
  if (!io) return

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {})
  })
}
