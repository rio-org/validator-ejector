import type { LoggerService } from 'lido-nanolib'
import type { ExecutionApiService } from '../execution-api/service.js'
import type { ConfigService } from '../config/service.js'
import type { MessagesProcessorService } from '../messages-processor/service.js'
import type { ConsensusApiService } from '../consensus-api/service.js'
import type { WebhookProcessorService } from '../webhook-caller/service.js'
import type { MetricsService } from '../prom/service.js'
import type { MessageStorage } from './message-storage.js'
import type { MessageReloader } from '../message-reloader/message-reloader.js'
import retry from 'async-retry'

export type ExitMessage = {
  message: {
    epoch: string
    validator_index: string
  }
  signature: string
}

export type ExitMessageWithMetadata = {
  data: ExitMessage
  meta: {
    fileChecksum: string
    filename: string
  }
}

export type JobProcessorService = ReturnType<typeof makeJobProcessor>

export const makeJobProcessor = ({
  logger,
  config,
  messageReloader,
  executionApi,
  consensusApi,
  messagesProcessor,
  webhookProcessor,
  metrics,
}: {
  logger: LoggerService
  config: ConfigService
  messageReloader: MessageReloader
  executionApi: ExecutionApiService
  consensusApi: ConsensusApiService
  messagesProcessor: MessagesProcessorService
  webhookProcessor: WebhookProcessorService
  metrics: MetricsService
}) => {
  const handleJob = async ({
    eventsNumber,
    messageStorage,
  }: {
    eventsNumber: number
    messageStorage: MessageStorage
  }) => {
    logger.info('Job started', {
      operatorId: config.OPERATOR_ID,
      operatorRegistry: config.OPERATOR_REGISTRY_ADDRESS,
    })

    await messageReloader.reloadAndVerifyMessages(messageStorage)

    const toBlock = await executionApi.latestBlockNumber()
    const fromBlock = toBlock - eventsNumber
    logger.info('Fetched the latest block from EL', { latestBlock: toBlock })

    logger.info('Fetching request events from the Operator Registry', {
      eventsNumber,
      fromBlock,
      toBlock,
    })

    const validatorPubkeysForEject = await executionApi.logs(fromBlock, toBlock)

    logger.info('Handling ejection requests', {
      amount: validatorPubkeysForEject.length,
    })

    for (const [ix, validatorPubkey] of validatorPubkeysForEject.entries()) {
      logger.info(
        `Handling exit ${ix + 1}/${validatorPubkeysForEject.length}`,
        validatorPubkey
      )

      try {
        if (await consensusApi.isExiting(validatorPubkey)) {
          logger.info('Validator is already exiting(ed), skipping')
          continue
        }

        if (config.DRY_RUN) {
          logger.info('Not initiating an exit in dry run mode')
          continue
        }

        const { index: validatorIndex } = await retry(
          async () => consensusApi.validatorInfo(validatorPubkey),
          {
            factor: 1.2,
          }
        )
        const validator = {
          validatorPubkey,
          validatorIndex,
        }
        if (config.VALIDATOR_EXIT_WEBHOOK) {
          await webhookProcessor.send(config.VALIDATOR_EXIT_WEBHOOK, validator)
        } else {
          await messagesProcessor.exit(messageStorage, validator)
        }
      } catch (e) {
        logger.error(`Unable to process exit for ${validatorPubkey}`, e)
        metrics.exitActions.inc({ result: 'error' })
      }
    }
    logger.info('Job finished')
  }

  return { handleJob }
}
