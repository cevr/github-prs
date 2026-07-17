import { Effect, Option, Schema } from "effect"

export const RuntimeCommand = Schema.Union([
  Schema.Struct({ action: Schema.Literal("checkNow") }),
  Schema.Struct({ action: Schema.Literal("markPRViewed"), prId: Schema.Number }),
  Schema.Struct({ action: Schema.Literal("trackerSettingsChanged") }),
])
export type RuntimeCommand = typeof RuntimeCommand.Type

export const RuntimeEvent = Schema.Union([
  Schema.Struct({ action: Schema.Literal("prSnapshotChanged") }),
  Schema.Struct({ action: Schema.Literal("setupNeeded") }),
])
export type RuntimeEvent = typeof RuntimeEvent.Type

type CommandHandler = (command: RuntimeCommand) => void
type EventHandler = (event: RuntimeEvent) => void

function deliver(message: RuntimeCommand | RuntimeEvent) {
  return Effect.tryPromise({
    try: () => chrome.runtime.sendMessage(message),
    catch: () => undefined,
  }).pipe(Effect.ignore)
}

export const sendRuntimeCommand = (command: RuntimeCommand) => deliver(command)

export const publishRuntimeEvent = (event: RuntimeEvent) => deliver(event)

export function subscribeToRuntimeEvents(handler: EventHandler): () => void {
  const decode = Schema.decodeUnknownOption(RuntimeEvent)
  const listener = (message: unknown) => {
    const event = decode(message)
    if (Option.isSome(event)) handler(event.value)
  }

  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}

export function installRuntimeCommandHandler(handler: CommandHandler): () => void {
  const decode = Schema.decodeUnknownOption(RuntimeCommand)
  const listener = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: () => void,
  ) => {
    const command = decode(message)
    if (Option.isNone(command)) return
    handler(command.value)
    sendResponse()
  }

  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}
