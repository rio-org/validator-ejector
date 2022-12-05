import { makeLogger } from '../logger/index.js'
import { makeRequest } from '../request/index.js'
import { obj, str, arr } from '../validator/index.js'

import { ethers } from 'ethers'
import { lastBlockNumberDTO, logsDTO } from './execution-dto.js'

export const makeExecutionApi = (
  request: ReturnType<typeof makeRequest>,
  logger: ReturnType<typeof makeLogger>,
  {
    EXECUTION_NODE,
    CONTRACT_ADDRESS,
    OPERATOR_ID,
  }: { EXECUTION_NODE: string; CONTRACT_ADDRESS: string; OPERATOR_ID: string }
) => {
  const latestBlockNumber = async () => {
    const res = await request(EXECUTION_NODE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
        id: 1,
      }),
    })
    const {
      data: { number },
    } = lastBlockNumberDTO(await res.json())
    logger.debug('fetched latest block number')
    return ethers.BigNumber.from(number).toNumber()
  }
  const logs = async (fromBlock: number, toBlock: number) => {
    const address = CONTRACT_ADDRESS
    const exitEvent = 'ValidatorExitRequest(uint256,uint256,bytes)'
    const eventTopic = ethers.utils.id(exitEvent)
    const topics = [
      eventTopic,
      null,
      ethers.utils.hexZeroPad(
        ethers.BigNumber.from(OPERATOR_ID).toHexString(),
        32
      ),
    ]
    const res = await request(EXECUTION_NODE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{ fromBlock, toBlock, address, topics }],
        id: 1,
      }),
    })

    const { result } = logsDTO(await res.json())

    return result.map((event) => event.data[0])
  }
  return {
    latestBlockNumber,
    logs,
  }
}
