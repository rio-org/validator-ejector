import { makeLogger } from 'lido-nanolib'
import { makeRequest } from 'lido-nanolib'

import { ethers } from 'ethers'

import { ConfigService } from 'services/config/service.js'

import { syncingDTO, lastBlockNumberDTO, logsDTO } from './dto.js'

export type ExecutionApiService = ReturnType<typeof makeExecutionApi>

export const makeExecutionApi = (
  request: ReturnType<typeof makeRequest>,
  logger: ReturnType<typeof makeLogger>,
  { EXECUTION_NODE, OPERATOR_REGISTRY_ADDRESS, OPERATOR_ID }: ConfigService
) => {
  const normalizedUrl = EXECUTION_NODE.endsWith('/')
    ? EXECUTION_NODE.slice(0, -1)
    : EXECUTION_NODE

  const syncing = async () => {
    const res = await request(normalizedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_syncing',
        params: [],
        id: 1,
      }),
    })
    const json = await res.json()
    const { result } = syncingDTO(json)
    logger.debug('fetched syncing status')
    return result
  }

  const checkSync = async () => {
    if (await syncing()) {
      logger.warn('Execution node is still syncing! Proceed with caution.')
    }
  }

  const latestBlockNumber = async () => {
    const res = await request(normalizedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: ['finalized', false],
        id: 1,
      }),
    })
    const json = await res.json()
    const {
      result: { number },
    } = lastBlockNumberDTO(json)
    logger.debug('fetched latest block number')
    return ethers.BigNumber.from(number).toNumber()
  }

  const splitPublicKeys = (pubKeyBatch: string) => {
    const keys = pubKeyBatch.replace('0x', '').match(/.{96}/g)
    if (!keys) {
      return []
    }
    return keys.map((key) => `0x${key}`)
  }

  const logs = async (fromBlock: number, toBlock: number) => {
    const event = ethers.utils.Fragment.from(
      'event ETHDepositsDeallocated(uint8 indexed operatorId, uint256 depositsDeallocated, bytes pubKeyBatch)'
    )
    const iface = new ethers.utils.Interface([event])
    const eventTopic = iface.getEventTopic(event.name)

    const res = await request(normalizedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [
          {
            fromBlock: ethers.utils.hexStripZeros(
              ethers.BigNumber.from(fromBlock).toHexString()
            ),
            toBlock: ethers.utils.hexStripZeros(
              ethers.BigNumber.from(toBlock).toHexString()
            ),
            address: OPERATOR_REGISTRY_ADDRESS,
            topics: [
              eventTopic,
              ethers.utils.hexZeroPad(
                ethers.BigNumber.from(OPERATOR_ID).toHexString(),
                32
              ),
            ],
          },
        ],
        id: 1,
      }),
    })

    const json = await res.json()

    const { result } = logsDTO(json)

    logger.info('Loaded ETHDepositsDeallocated events', {
      amount: result.length,
    })

    let pubKeysOfValidatorsToEject: string[] = []
    for (const [ix, log] of result.entries()) {
      logger.info(`${ix + 1}/${result.length}`)

      const parsedLog = iface.parseLog(log)
      const { pubKeyBatch } = parsedLog.args as unknown as {
        pubKeyBatch: string
      }
      pubKeysOfValidatorsToEject = pubKeysOfValidatorsToEject.concat(
        splitPublicKeys(pubKeyBatch)
      )
    }
    return pubKeysOfValidatorsToEject
  }

  return {
    syncing,
    checkSync,
    latestBlockNumber,
    logs,
  }
}
