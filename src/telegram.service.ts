import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { DataSource } from 'typeorm';

@Injectable()
export class TelegramService implements OnApplicationBootstrap {
  private bot: Telegraf;

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap(): any {
    this.bot = new Telegraf(process.env.TG_TOKEN);

    this.bot.start((ctx) => {
      ctx.reply('Hello, world!');
    }).
  }
}
