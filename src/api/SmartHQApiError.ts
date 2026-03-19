// Custom error for SmartHQ API
export class SmartHQApiError extends Error {
  status?: number
  code?: string
  details?: any
  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message)
    this.name = 'SmartHQApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}
