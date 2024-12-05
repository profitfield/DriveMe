// backend/src/config/cache.config.ts

import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CacheConfigService {
   constructor(private configService: ConfigService) {}

   /**
    * Creates cache configuration based on environment settings
    */
   createCacheConfig(): CacheModuleOptions {
       return {
           ttl: this.configService.get('CACHE_TTL', 300), // Default 5 minutes
           max: this.configService.get('CACHE_MAX_ITEMS', 1000),
           isGlobal: true
       };
   }

   /**
    * Get cache TTL (Time To Live) settings for different entity types
    */
   getCacheSettings() {
       return {
           orderDetails: {
               ttl: 300, // 5 minutes 
               prefix: 'order'
           },
           driverLocation: {
               ttl: 60, // 1 minute
               prefix: 'driver:location'
           },
           priceCalculation: {
               ttl: 3600, // 1 hour
               prefix: 'price'
           },
           userProfile: {
               ttl: 1800, // 30 minutes
               prefix: 'user'
           },
           driverStatus: {
               ttl: 60, // 1 minute
               prefix: 'driver:status'
           }
       };
   }
}