export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  date: number;
  chat: TelegramChat;
  text?: string;
  entities?: TelegramMessageEntity[];
  reply_to_message?: TelegramMessage;
  caption?: string;
  contact?: unknown;
  location?: unknown;
  venue?: unknown;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance?: string;
  data?: string;
  game_short_name?: string;
}

export interface TelegramInlineQuery {
  id: string;
  from: TelegramUser;
  query: string;
  offset: string;
  chat_type?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  inline_query?: TelegramInlineQuery;
  chosen_inline_result?: unknown;
  callback_query?: TelegramCallbackQuery;
  shipping_query?: unknown;
  pre_checkout_query?: unknown;
  poll?: unknown;
  poll_answer?: unknown;
  my_chat_member?: unknown;
  chat_member?: unknown;
  chat_join_request?: unknown;
}

export interface SendMessageOptions {
  parse_mode?: "HTML" | "MarkdownV2";
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup;
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
}

export interface EditMessageTextOptions {
  parse_mode?: "HTML" | "MarkdownV2";
  reply_markup?: InlineKeyboardMarkup;
  disable_web_page_preview?: boolean;
}

export interface AnswerCallbackQueryOptions {
  text?: string;
  show_alert?: boolean;
  url?: string;
  cache_time?: number;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
}

export interface KeyboardButton {
  text: string;
}

export interface GetUpdatesParams {
  offset?: number;
  limit?: number;
  timeout?: number;
  allowed_updates?: string[];
}

export interface DeleteWebhookParams {
  drop_pending_updates?: boolean;
}

export interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
  error_code?: number;
}
