import { Module } from '@nestjs/common';
import { PrintPluginController } from './print-plugin.controller';

@Module({
  controllers: [PrintPluginController],
})
export class PrintPluginModule {}
