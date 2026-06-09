let socketServer = null

export const setSocketServer = (io) => {
  socketServer = io
}

export const getSocketServer = () => socketServer

export const userRoom = (userId) => `user:${userId}`

export const conversationRoom = (conversationId) => `conversation:${conversationId}`

export const emitToUser = (userId, event, payload) => {
  if (!socketServer || !userId) {
    return
  }

  socketServer.to(userRoom(userId)).emit(event, payload)
}
