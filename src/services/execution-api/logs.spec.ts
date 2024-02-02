import { ExecutionApiService, makeExecutionApi } from './service.js'
import { LoggerService, RequestService, makeRequest } from 'lido-nanolib'
import { logsMock } from './fixtures.js'
import { mockEthServer } from '../../test/mock-eth-server.js'
import { mockLogger } from '../../test/logger.js'
import { mockConfig } from '../../test/config.js'
import { ConfigService } from '../config/service.js'

describe('makeConsensusApi logs', () => {
  let api: ExecutionApiService
  let request: RequestService
  let logger: LoggerService
  let config: ConfigService

  beforeEach(() => {
    request = makeRequest([])
    logger = mockLogger()
    config = mockConfig(logger, {
      EXECUTION_NODE: 'http://localhost:4445',
    })
    api = makeExecutionApi(request, logger, config)
  })

  it('should fetch and parse logs', async () => {
    mockEthServer(logsMock(), config.EXECUTION_NODE)

    api = makeExecutionApi(request, logger, config)

    const res = await api.logs(123, 123)

    expect(res.length).toBe(10)
    for (let i = 0; i < 10; i++) {
      const mockKeyId = (i + 1).toString(16)
      expect(res[i]).toBe(
        `0x000${mockKeyId}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`
      )
    }
  })
})
