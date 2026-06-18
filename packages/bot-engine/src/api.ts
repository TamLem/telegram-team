import type {
  TelegramResponse,
  TelegramUpdate,
  TelegramMessage,
  SendMessageOptions,
  EditMessageTextOptions,
  AnswerCallbackQueryOptions,
  GetUpdatesParams,
  DeleteWebhookParams,
  InlineKeyboardMarkup,
  BotCommand,
} from "./types.js";

export interface TelegramApiErrorDetails {
  method: string;
  status?: number;
  errorCode?: number;
  description?: string;
}

export class TelegramApiError extends Error {
  details: TelegramApiErrorDetails;

  constructor(message: string, details: TelegramApiErrorDetails, cause?: unknown) {
    super(message, { cause });
    this.name = "TelegramApiError";
    this.details = details;
  }
}

export class TelegramApi {
  private token: string;
  private baseUrl: string;
  private requestTimeoutMs: number;

  constructor(token: string, config: { requestTimeoutMs?: number } = {}) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 15_000;
  }

  private async request<T>(
    method: string,
    body: Record<string, unknown>,
    options: { timeoutMs?: number } = {}
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.requestTimeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new TelegramApiError(
        `Telegram API request failed before response: ${method}`,
        { method },
        error
      );
    } finally {
      clearTimeout(timeout);
    }

    let data: TelegramResponse<T>;
    try {
      data = (await response.json()) as TelegramResponse<T>;
    } catch (error) {
      throw new TelegramApiError(
        `Telegram API returned an invalid JSON response: ${method}`,
        { method, status: response.status },
        error
      );
    }

    if (!response.ok || !data.ok) {
      throw new TelegramApiError(
        `Telegram API error in ${method}: ${data.description ?? response.statusText ?? "unknown"} (code: ${data.error_code ?? response.status})`,
        {
          method,
          status: response.status,
          errorCode: data.error_code,
          description: data.description,
        }
      );
    }

    return data.result;
  }

  async sendMessage(
    chatId: number,
    text: string,
    options?: SendMessageOptions
  ): Promise<TelegramMessage> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
    };

    if (options?.reply_markup) {
      body.reply_markup = options.reply_markup;
    }
    if (options?.disable_web_page_preview !== undefined) {
      body.disable_web_page_preview = options.disable_web_page_preview;
    }
    if (options?.disable_notification !== undefined) {
      body.disable_notification = options.disable_notification;
    }
    if (options?.reply_to_message_id) {
      body.reply_to_message_id = options.reply_to_message_id;
    }

    return this.request<TelegramMessage>("sendMessage", body);
  }

  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: EditMessageTextOptions
  ): Promise<TelegramMessage | true> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
    };

    if (options?.reply_markup) {
      body.reply_markup = options.reply_markup;
    }
    if (options?.disable_web_page_preview !== undefined) {
      body.disable_web_page_preview = options.disable_web_page_preview;
    }

    return this.request<TelegramMessage | true>("editMessageText", body);
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    options?: AnswerCallbackQueryOptions
  ): Promise<true> {
    const body: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };

    if (text !== undefined) {
      body.text = text;
    }
    if (options?.show_alert !== undefined) {
      body.show_alert = options.show_alert;
    }
    if (options?.url) {
      body.url = options.url;
    }
    if (options?.cache_time !== undefined) {
      body.cache_time = options.cache_time;
    }

    return this.request<true>("answerCallbackQuery", body);
  }

  async getUpdates(params?: GetUpdatesParams): Promise<TelegramUpdate[]> {
    const body: Record<string, unknown> = {};
    if (params?.offset !== undefined) body.offset = params.offset;
    if (params?.limit !== undefined) body.limit = params.limit;
    if (params?.timeout !== undefined) body.timeout = params.timeout;
    if (params?.allowed_updates !== undefined) {
      body.allowed_updates = params.allowed_updates;
    }
    const timeoutMs =
      params?.requestTimeoutMs ??
      (params?.timeout !== undefined ? (params.timeout + 5) * 1000 : undefined);
    return this.request<TelegramUpdate[]>("getUpdates", body, { timeoutMs });
  }

  async setWebhook(url: string, secretToken?: string): Promise<true> {
    const body: Record<string, unknown> = { url };
    if (secretToken) {
      body.secret_token = secretToken;
    }
    return this.request<true>("setWebhook", body);
  }

  async setMyCommands(commands: BotCommand[]): Promise<true> {
    return this.request<true>("setMyCommands", { commands });
  }

  async deleteWebhook(params?: DeleteWebhookParams): Promise<true> {
    const body: Record<string, unknown> = {};
    if (params?.drop_pending_updates !== undefined) {
      body.drop_pending_updates = params.drop_pending_updates;
    }
    return this.request<true>("deleteWebhook", body);
  }

  async getWebhookInfo(): Promise<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
  }> {
    return this.request("getWebhookInfo", {});
  }

  async getMe(): Promise<{
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  }> {
    return this.request("getMe", {});
  }

  async sendInlineKeyboard(
    chatId: number,
    text: string,
    keyboard: InlineKeyboardMarkup,
    options?: SendMessageOptions
  ): Promise<TelegramMessage> {
    return this.sendMessage(chatId, text, {
      ...options,
      reply_markup: keyboard,
    });
  }
}
