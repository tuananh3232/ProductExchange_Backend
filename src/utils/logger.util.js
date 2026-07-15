const serializeError = (error) => ({
  name: error?.name,
  message: error?.message,
  stack: error?.stack,
})

const write = (level, event, data = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  }
  const output = JSON.stringify(payload)
  if (level === 'error') console.error(output)
  else if (level === 'warn') console.warn(output)
  else console.log(output)
}

export const logger = {
  info: (event, data) => write('info', event, data),
  warn: (event, data) => write('warn', event, data),
  error: (event, data = {}) => write('error', event, {
    ...data,
    ...(data.error instanceof Error ? { error: serializeError(data.error) } : {}),
  }),
}

export default logger
