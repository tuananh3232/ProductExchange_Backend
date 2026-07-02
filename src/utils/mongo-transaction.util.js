import mongoose from 'mongoose'

const isTransactionUnsupported = (error) => {
  const message = error?.message || ''
  return (
    error?.code === 20 ||
    error?.codeName === 'IllegalOperation' ||
    message.includes('Transaction numbers are only allowed') ||
    message.includes('replica set member or mongos')
  )
}

export const runMongoTransaction = async (operation) => {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await operation(session)
    })
    return result
  } catch (error) {
    if (!isTransactionUnsupported(error)) {
      throw error
    }

    console.warn('MongoDB transactions are not supported by this deployment; running operation without a session.')
    return operation(null)
  } finally {
    await session.endSession()
  }
}
