import { SetMetadata } from '@nestjs/common';

export interface AccessControlOptions {
  resource: string;
  action: string;
  condition?: (context: any) => boolean | Promise<boolean>;
}

export const RequirePermission = (options: AccessControlOptions) => 
  SetMetadata('access_control', options);

// Вспомогательные декораторы для частых операций
export const CanCreate = (resource: string) => 
  RequirePermission({ resource, action: 'create' });

export const CanRead = (resource: string) => 
  RequirePermission({ resource, action: 'read' });

export const CanUpdate = (resource: string) => 
  RequirePermission({ resource, action: 'update' });

export const CanDelete = (resource: string) => 
  RequirePermission({ resource, action: 'delete' });

export const CanManage = (resource: string) => 
  RequirePermission({ resource, action: '*' });