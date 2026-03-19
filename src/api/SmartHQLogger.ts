/**
 * Log handler function signature for SmartHQLogger.
 * @param module - Module name (e.g., 'SmartHQDevice')
 * @param event - Event description
 * @param details - Optional event details
 */
export type SmartHQLogHandler = (module: string, event: string, details?: any) => void

let customLogHandler: SmartHQLogHandler | undefined

/**
 * Set a custom log handler for SmartHQ logging.
 * @param handler - Custom log handler function
 */
export function setSmartHQLogHandler(handler: SmartHQLogHandler) {
  customLogHandler = handler
}

/**
 * Centralized logger for SmartHQ modules. Uses a custom handler if set, otherwise logs to console.
 * @param module - Module name (e.g., 'SmartHQDevice')
 * @param event - Event description
 * @param details - Optional event details
 */
export function SmartHQLogger(module: string, event: string, details?: any) {
  if (customLogHandler) {
    customLogHandler(module, event, details)
  } else {
    if (details !== undefined) {
      console.log(`[${module}] ${event}`, details)
    } else {
      console.log(`[${module}] ${event}`)
    }
  }
}
