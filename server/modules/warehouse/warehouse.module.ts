import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { MaterialRequisitionController } from './material-requisition.controller';
import { MaterialRequisitionService } from './material-requisition.service';
import { MaterialReturnController } from './material-return.controller';
import { MaterialReturnService } from './material-return.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [
    WarehouseController,
    MaterialRequisitionController,
    MaterialReturnController,
    InventoryController,
  ],
  providers: [
    WarehouseService,
    MaterialRequisitionService,
    MaterialReturnService,
    InventoryService,
  ],
  exports: [WarehouseService, MaterialRequisitionService, MaterialReturnService, InventoryService],
})
export class WarehouseModule {}
