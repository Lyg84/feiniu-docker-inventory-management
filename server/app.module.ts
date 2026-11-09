import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ProductModule } from './modules/product/product.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { SalesDeliveryModule } from './modules/sales-delivery/sales-delivery.module';
import { SalesReturnModule } from './modules/sales-return/sales-return.module';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { PurchaseInModule } from './modules/purchase-in/purchase-in.module';
import { PurchaseReturnModule } from './modules/purchase-return/purchase-return.module';
import { PaymentModule } from './modules/payment/payment.module';
import { StockInModule } from './modules/stock-in/stock-in.module';
import { StockOutModule } from './modules/stock-out/stock-out.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    PlatformModule.forRoot(),
    CustomerModule,
    ProductModule,
    SupplierModule,
    SalesDeliveryModule,
    SalesReturnModule,
    ReceiptModule,
    PurchaseInModule,
    PurchaseReturnModule,
    PaymentModule,
    StockInModule,
    StockOutModule,
    FinanceModule,
    WarehouseModule,
    SystemModule,
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
