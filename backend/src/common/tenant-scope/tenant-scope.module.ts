import { Global, Module } from '@nestjs/common';
import { TenantScopeService } from './tenant-scope.service';
import { TenantCustomerService } from './tenant-customer.service';

@Global()
@Module({
  providers: [TenantScopeService, TenantCustomerService],
  exports: [TenantScopeService, TenantCustomerService],
})
export class TenantScopeModule {}
