import { Controller, Post, Body, Headers, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { TelegramService, TelegramUpdate } from './telegram.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller()
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Inbound Telegram Bot Webhook Endpoint
   * Validates secret token and allowlist, rejects unauthorized messages
   */
  @Post('webhooks/telegram')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.telegramService.handleWebhookUpdate(update, secretToken, traceId);
  }

  /**
   * Internal / Admin notification send endpoint
   */
  @Post('notifications/telegram/send')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendNotification(
    @Body()
    body: {
      occurrenceId?: string;
      recipientChatId: string;
      text: string;
    },
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.telegramService.sendNotification({
      occurrenceId: body.occurrenceId,
      recipientChatId: body.recipientChatId,
      text: body.text,
      traceId,
    });
  }
}
