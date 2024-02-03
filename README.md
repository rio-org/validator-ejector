<img src="https://user-images.githubusercontent.com/4752441/209329469-aee5d699-af5e-467b-9213-4d09b1a22012.png" width="50%" height="50%">

# Rio Validator Ejector

A daemon service which loads Rio Network `RioLRTOperatorRegistry` events for validator exits and sends out exit messages when necessary. On start, it will load events from a configurable amount of blocks behind and then poll for new events.

This software is modified from [Lido's Validator Ejector](https://github.com/lidofinance/validator-ejector).

## Requirements

- Folder of pre-signed exit messages as individual JSON files in either [spec format](https://github.com/rio-org/validator-ejector/blob/d2e4db190935239e019618b948a1bd1cea20f88f/src/services/messages-processor/service.ts#L19-L25) (generic) or [ethdo output format](https://github.com/wealdtech/ethdo/blob/master/docs/usage.md#exit)
- Execution node
- Consensus node

This service has to be run in a single instance as it expects to fulfil every request to exit. Each unfulfilled request (no exit message being present for required validator) will log an error.

## Configuration

### Operation Modes

For both modes, Ejector will monitor exit request events, but react to them differently.

#### Messages Mode

In this mode, Ejector will load pre-signed exit messages from .json files on start, validate them, and submit them to a CL node when necessary.

Mode is activated by setting the MESSAGES_LOCATION variable.

#### Webhook Mode

In this mode, Ejector will make a request to a specified endpoint when an exit needs to be made instead of submitting a pre-signed exit message to a CL node.

Mode is activated by setting the VALIDATOR_EXIT_WEBHOOK variable.

This allows NOs to implement JIT approach by offloading exiting logic to an external service and using the Ejector as a secure exit events reader.

On the endpoint, JSON will be POSTed with the following structure:

```json
{
  "validatorIndex": "123",
  "validatorPubkey": "0x123"
}
```

200 response from the endpoint will be counted as a successful exit, non-200 as a fail.

### Environment Variables

Options are configured via environment variables.

| Variable                       | Required | Default/Example       | Description                                                                                                                                                                                                                                             |
|--------------------------------| -------- | --------------------- |---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| EXECUTION_NODE                 | Yes      | http://1.2.3.4:8545   | Ethereum Execution Node endpoint                                                                                                                                                                                                                        |
| CONSENSUS_NODE                 | Yes      | http://1.2.3.4:5051   | Ethereum Consensus Node endpoint                                                                                                                                                                                                                        |
| OPERATOR_REGISTRY_ADDRESS      | Yes      | 0x123                 | Address of the Operator Registry contract: [Goerli](https://goerli.etherscan.io/address/0x8Abf8aB35915457219B801a774140f067DdB0705)                        |
| OPERATOR_ID                    | Yes      | 123                   | Operator ID in the Operator Registry, provided to you by the RioDAO, and available in the Rio Network Subgraph: [Goerli](https://thegraph.com/hosted-service/subgraph/rio-org/rio-network-goerli)                                                                         |
| MESSAGES_LOCATION              | No       | messages              | Local folder or external storage bucket url to load json exit message files from. Required if you are using exit messages mode                                                                                                                          |
| VALIDATOR_EXIT_WEBHOOK         | No       | http://webhook        | POST validator info to an endpoint instead of sending out an exit message in order to initiate an exit. Required if you are using webhook mode                                                                                                          |
| MESSAGES_PASSWORD              | No       | password              | Password to decrypt encrypted exit messages with. Needed only if you encrypt your exit messages                                                                                                                                                         |
| MESSAGES_PASSWORD_FILE         | No       | password_inside.txt   | Path to a file with password inside to decrypt exit messages with. Needed only if you have encrypted exit messages. If used, MESSAGES_PASSWORD (not MESSAGES_PASSWORD_FILE) needs to be added to LOGGER_SECRETS in order to be sanitized                |
| BLOCKS_PRELOAD                 | No       | 50000                 | Amount of blocks to load events from on start. Increase if daemon was not running for some time. Defaults to a week of blocks                                                                                                                           |
| BLOCKS_LOOP                    | No       | 900                   | Amount of blocks to load events from on every poll. Defaults to 3 hours of blocks                                                                                                                                                                       |
| JOB_INTERVAL                   | No       | 384000                | Time interval in milliseconds to run checks. Defaults to time of 1 epoch                                                                                                                                                                                |
| HTTP_PORT                      | No       | 8989                  | Port to serve metrics and health check on                                                                                                                                                                                                               |
| RUN_METRICS                    | No       | false                 | Enable metrics endpoint                                                                                                                                                                                                                                 |
| RUN_HEALTH_CHECK               | No       | true                  | Enable health check endpoint                                                                                                                                                                                                                            |
| LOGGER_LEVEL                   | No       | info                  | Severity level from which to start showing errors eg info will hide debug messages                                                                                                                                                                      |
| LOGGER_FORMAT                  | No       | simple                | Simple or JSON log output: simple/json                                                                                                                                                                                                                  |
| LOGGER_SECRETS                 | No       | ["MESSAGES_PASSWORD"] | JSON string array of either env var keys to sanitize in logs or exact values                                                                                                                                                                            |
| DRY_RUN                        | No       | false                 | Run the service without actually sending out exit messages                                                                                                                                                                                              |

Messages can also be loaded from remote storages: AWS S3 and Google Cloud Storage.

Simply set a url with an appropriate protocol in `MESSAGES_LOCATION`:

- `s3://` for S3
- `gs://` for GCS

Authentication setup: [GCS](https://cloud.google.com/docs/authentication/application-default-credentials#attached-sa), [S3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).

## Preparing Exit Messages

Once you generate and sign exit messages, you can encrypt them for storage safety.

Exit messages are encrypted and decrypted following the [EIP-2335](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-2335.md) spec.

You can check a simple example in JS in `encryptor` folder:

Simply copy JSON exit message files to `encryptor/input`, set encryption password as `MESSAGES_PASSWORD` in `.env` and run:

```bash
yarn encrypt
```

Done, your encrypted files will be in `encryptor/output`.

## Running

Either:

- Use a Docker image from [Docker Hub](https://hub.docker.com/r/rioorg/validator-ejector)
- Clone repo, install dependencies, build and start the service:

```bash
git clone https://github.com/rio-org/validator-ejector.git
cd validator-ejector
yarn
yarn build
yarn start
```

Don't forget env variables in the last command.

## Metrics

Enable metrics endpoint by setting `HTTP_PORT=1234` and `RUN_METRICS=true` environment variables.

Metrics will be available on `$HOST:$HTTP_PORT/metrics`.

Available metrics:

- exit_messages: ['valid'] - Exit messages and their validity: JSON parseability, structure and signature
- exit_actions: ['result'] - Statuses of initiated validator exits
- polling_last_blocks_duration_seconds: ['eventsNumber'] - Duration of pooling last blocks in microseconds
- execution_request_duration_seconds: ['result', 'status', 'domain'] - Execution node request duration in microseconds
- consensus_request_duration_seconds: ['result', 'status', 'domain'] - Consensus node request duration in microseconds
- job_duration_seconds: ['name', 'interval', 'result'] - Duration of Ejector cycle cron job
- job_message_reloader_duration_seconds: ['name', 'interval', 'result'] - Duration of Pre-signed message reloader cron job

## Safety Features

- Encrypted messages allow for secure file storage
- Invalid files in messages folder are noticed
- Exit JSON structure is checked
- Exit signature is fully validated
- Exit event pubkeys are pulled directly from OperatorRegistry contract events
- Node requests are repeated on error or timeouts
- Dry run mode to test setup

## Troubleshooting

When you try to use Rio Validator Ejector on ARM, you may encounter an unexpected
problem related to the inability to install @chainsafe/blst dependencies under darwin arm64.

### Why does it happen?!

It happens because https://www.npmjs.com/package/@chainsafe/blst doesn't provide native C binding to https://github.com/supranational/blst under darwin arm64.
Such as there no native binding, a user has to compile C binding to blst lab manually for darwin arm64.
@chainsafe/blst has compile option but inside itself for downloading dependencies this lib uses Python language.
Historically MacOs uses alias python3 for python. So then @chainsafe/blst fails with an error that it could not install all dependencies.
To fix it on MacOs just create alias python for python3.

```bash
ln -s /opt/homebrew/bin/python3 /usr/local/bin/python
```

More info here - https://github.com/ChainSafe/lodestar/issues/4767#issuecomment-1640631566
