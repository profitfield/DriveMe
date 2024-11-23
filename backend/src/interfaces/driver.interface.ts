import { Driver } from '../entities/driver.entity';

export interface DriverScore {
  driver: Driver;
  score: number;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  updatedAt: Date;
}

export interface DriverStats {
  totalRides: number;
  rating: number;
  completionRate: number;
  revenue: number;
}