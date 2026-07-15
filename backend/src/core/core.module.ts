import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TenantContextInterceptor, TenantContextService } from "./tenant";

@Global()
@Module({
  providers: [
    TenantContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [TenantContextService],
})
export class CoreModule {}
