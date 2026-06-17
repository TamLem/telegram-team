import type {
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramUser,
  TelegramChat,
  SendMessageOptions,
  EditMessageTextOptions,
  AnswerCallbackQueryOptions,
} from "./types.js";
import type { Bot } from "./bot.js";

export class BotContext {
  update: TelegramUpdate;
  bot: Bot;
  state: Map<string, unknown>;

  constructor(update: TelegramUpdate, bot: Bot) {
    this.update = update;
    this.bot = bot;
    this.state = new Map();
  }

  get message(): TelegramMessage | undefined {
    return this.update.message ?? this.update.callback_query?.message;
  }

  get callbackQuery(): TelegramCallbackQuery | undefined {
    return this.update.callback_query;
  }

  get from(): TelegramUser | undefined {
    return (
      this.update.message?.from ??
      this.update.callback_query?.from ??
      this.update.inline_query?.from
    );
  }

  get chat(): TelegramChat | undefined {
    return (
      this.update.message?.chat ??
      this.update.callback_query?.message?.chat
    );
  }

  get text(): string | undefined {
    return this.update.message?.text;
  }

  get callbackData(): string | undefined {
    return this.update.callback_query?.data;
  }

  get chatId(): number | undefined {
    return this.chat?.id;
  }

  get userId(): number | undefined {
    return this.from?.id;
  }

  async reply(
    text: string,
    options?: SendMessageOptions
  ): Promise<TelegramMessage> {
    const chatId = this.chatId;
    if (!chatId) {
      throw new Error("Cannot reply: no chat context");
    }
    return this.bot.api.sendMessage(chatId, text, options);
  }

  async editMessageText(
    text: string,
    options?: EditMessageTextOptions
  ): Promise<TelegramMessage | true> {
    const chatId = this.chatId;
    const messageId = this.callbackQuery?.message?.message_id;
    if (!chatId || !messageId) {
      throw new Error("Cannot edit message: no message context");
    }
    return this.bot.api.editMessageText(chatId, messageId, text, options);
  }

  async answerCallbackQuery(
    text?: string,
    options?: AnswerCallbackQueryOptions
  ): Promise<true> {
    const callbackQueryId = this.callbackQuery?.id;
    if (!callbackQueryId) {
      throw new Error("Cannot answer: no callback query context");
    }
    return this.bot.api.answerCallbackQuery(callbackQueryId, text, options);
  }

  setState<T>(key: string, value: T): void {
    this.state.set(key, value);
  }

  getState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }
}
