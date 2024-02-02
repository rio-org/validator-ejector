import {
  bool,
  level_attr,
  makeLogger,
  num,
  str,
  optional,
  log_format,
  json_arr,
} from 'lido-nanolib'
import { readFileSync } from 'fs'

export type ConfigService = ReturnType<typeof makeConfig>

export const makeConfig = ({
  env,
}: {
  logger: ReturnType<typeof makeLogger>
  env: NodeJS.ProcessEnv
}) => {
  const config = {
    EXECUTION_NODE: str(
      env.EXECUTION_NODE,
      'Please, setup EXECUTION_NODE address. Example: http://1.2.3.4:8545'
    ),
    CONSENSUS_NODE: str(
      env.CONSENSUS_NODE,
      'Please, setup CONSENSUS_NODE address. Example: http://1.2.3.4:5051'
    ),
    OPERATOR_REGISTRY_ADDRESS: str(
      env.OPERATOR_REGISTRY_ADDRESS,
      'Please, setup OPERATOR_REGISTRY_ADDRESS address. Example: 0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    ),
    OPERATOR_ID: str(
      env.OPERATOR_ID,
      'Please, setup OPERATOR_ID id. Example: 123'
    ),

    MESSAGES_LOCATION: optional(() => str(env.MESSAGES_LOCATION)),
    VALIDATOR_EXIT_WEBHOOK: optional(() => str(env.VALIDATOR_EXIT_WEBHOOK)),

    MESSAGES_PASSWORD: optional(() => str(envOrFile(env, 'MESSAGES_PASSWORD'))),

    BLOCKS_PRELOAD: optional(() => num(env.BLOCKS_PRELOAD)) ?? 50000, // 7 days of blocks
    BLOCKS_LOOP: optional(() => num(env.BLOCKS_LOOP)) ?? 900, // 3 hours of blocks
    JOB_INTERVAL: optional(() => num(env.JOB_INTERVAL)) ?? 384000, // 1 epoch

    HTTP_PORT: optional(() => num(env.HTTP_PORT)) ?? 8989,
    RUN_METRICS: optional(() => bool(env.RUN_METRICS)) ?? false,
    RUN_HEALTH_CHECK: optional(() => bool(env.RUN_HEALTH_CHECK)) ?? true,

    DRY_RUN: optional(() => bool(env.DRY_RUN)) ?? false,
    PROM_PREFIX: optional(() => str(env.PROM_PREFIX)),
  }

  if (config.MESSAGES_LOCATION && config.VALIDATOR_EXIT_WEBHOOK) {
    throw new Error(
      'Both MESSAGES_LOCATION and VALIDATOR_EXIT_WEBHOOK are defined. Ensure only one is set.'
    )
  }

  if (!config.MESSAGES_LOCATION && !config.VALIDATOR_EXIT_WEBHOOK) {
    throw new Error(
      'Neither MESSAGES_LOCATION nor VALIDATOR_EXIT_WEBHOOK are defined. Please set one of them.'
    )
  }

  return config
}

export const makeLoggerConfig = ({ env }: { env: NodeJS.ProcessEnv }) => {
  const config = {
    LOGGER_LEVEL: optional(() => level_attr(env.LOGGER_LEVEL)) ?? 'info',
    LOGGER_FORMAT: optional(() => log_format(env.LOGGER_FORMAT)) ?? 'simple',
    LOGGER_SECRETS:
      optional(() =>
        json_arr(env.LOGGER_SECRETS, (secrets) => secrets.map(str))
      ) ?? [],
  }

  // Resolve the value of an env var if such exists
  config.LOGGER_SECRETS = config.LOGGER_SECRETS.map(
    (envVar) => envOrFile(env, envVar) ?? envVar
  )

  return config
}

const envOrFile = (env: NodeJS.ProcessEnv, envName: string) => {
  if (env[envName]) return env[envName]

  const extendedName = `${envName}_FILE`
  const extendedNameValue = env[extendedName]
  if (extendedNameValue) {
    try {
      return readFileSync(extendedNameValue, 'utf-8')
    } catch (e) {
      throw new Error(`Unable to load ${extendedName}`, { cause: e })
    }
  }

  return undefined
}
