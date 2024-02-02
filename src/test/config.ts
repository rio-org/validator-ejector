import { LoggerService } from 'lido-nanolib'
import { makeConfig } from '../services/config/service.js'

export const configBase = {
  EXECUTION_NODE: 'http://localhost:4445',
  CONSENSUS_NODE: 'http://localhost:4455',
  OPERATOR_REGISTRY_ADDRESS: '0x8Abf8aB35915457219B801a774140f067DdB0705',
  OPERATOR_ID: '123',
  BLOCKS_PRELOAD: 10000,
  HTTP_PORT: 8080,
  RUN_METRICS: true,
  RUN_HEALTH_CHECK: true,
  DRY_RUN: true,
  LOGGER_LEVEL: 'debug',
  LOGGER_PRETTY: true,
}

export const defaultConfig = {
  ...configBase,
  MESSAGES_LOCATION: '/null',
}

export const mockConfig = <T>(logger: LoggerService, configObject?: T) =>
  makeConfig({
    logger,
    env: { ...defaultConfig, ...configObject } as unknown as NodeJS.ProcessEnv,
  })
