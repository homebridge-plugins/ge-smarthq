import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SmartHQClient } from '../src/api/ge-client'

/**
 * `getDevices()` and `getDevice()` used to answer a 401 by refreshing and then
 * calling themselves again, with no attempt cap and no delay. That is fine when
 * refreshing fixes the 401 and unbounded when it cannot — a revoked token, or
 * credentials the token endpoint rejects outright — and the loop runs as fast
 * as the API will answer.
 *
 * It reached production: a consumer that deliberately bypassed the library's
 * OAuth (having its own valid token) left placeholder client credentials in
 * place, every refresh 401'd, and a single websocket reconnect turned into a
 * sustained flood of requests against GE's auth endpoint.
 *
 * These tests pin the retry at exactly one.
 */
describe('a 401 that refreshing cannot fix', () => {
  let client: SmartHQClient

  const unauthorized = () => Object.assign(new Error('Request failed with status code 401'), {
    response: { status: 401 },
  })

  beforeEach(() => {
    client = new SmartHQClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:8888/callback',
      debug: false,
    })
    // A refresh that "succeeds" without producing a working token is the case
    // that used to recurse; if it threw, the old code would have stopped too.
    vi.spyOn(client as any, 'refreshAccessToken').mockResolvedValue({ access_token: 'still-bad' })
    vi.spyOn(client as any, 'httpHeaders').mockResolvedValue({ Authorization: 'Bearer still-bad' })
  })

  /**
   * Two refreshes, not one: the retry path takes the first, and handleApiError
   * takes another on its way out. That second one is terminal rather than
   * recursive, so it is bounded — but it does mean one rejected request costs
   * two auth calls, which is worth knowing when this is pointed at an API that
   * throttles.
   */
  it('gives up on getDevices after a single retry', async () => {
    const get = vi.spyOn(client.httpClient, 'get').mockRejectedValue(unauthorized())

    await expect(client.getDevices()).rejects.toBeDefined()

    // One original attempt plus exactly one retry — never more.
    expect(get).toHaveBeenCalledTimes(2)
    expect((client as any).refreshAccessToken).toHaveBeenCalledTimes(2)
  })

  it('gives up on getDevice after a single retry', async () => {
    const get = vi.spyOn(client.httpClient, 'get').mockRejectedValue(unauthorized())

    await expect(client.getDevice('some-device-id')).rejects.toBeDefined()

    expect(get).toHaveBeenCalledTimes(2)
    expect((client as any).refreshAccessToken).toHaveBeenCalledTimes(2)
  })

  it('still recovers when the refresh does produce a working token', async () => {
    const get = vi.spyOn(client.httpClient, 'get')
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValueOnce({ data: { devices: [], total: 0 } } as any)

    await expect(client.getDevices()).resolves.toMatchObject({ total: 0 })
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('does not retry a failure that is not a 401', async () => {
    const get = vi.spyOn(client.httpClient, 'get').mockRejectedValue(
      Object.assign(new Error('boom'), { response: { status: 500 } }),
    )

    await expect(client.getDevices()).rejects.toBeDefined()
    expect(get).toHaveBeenCalledTimes(1)
    expect((client as any).refreshAccessToken).not.toHaveBeenCalled()
  })
})
