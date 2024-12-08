// src/modules/assignment/assignment.interface.ts

import { Driver } from '../../entities/driver.entity';
import { Order } from '../../entities/order.entity';
import { CarClass } from '../../entities/driver.entity';

export interface DriverScore {
    driver: Driver;
    score: number;
    details: {
        ratingScore: number;
        experienceScore: number;
        distanceScore: number;
        completionRateScore: number;
        preferredDriverScore: number;
    };
}

export interface AssignmentCriteria {
    orderId: string;
    carClass: CarClass;
    pickupDatetime: Date;
    location: {
        latitude: number;
        longitude: number;
    };
    preferredDriverId?: string;
    isPreOrder?: boolean;
    clientId?: string;
}

export interface AssignmentResult {
    success: boolean;
    order?: Order;
    driver?: Driver;
    message?: string;
    details?: {
        searchDuration: number;
        driversChecked: number;
        assignmentScore: number;
    };
}

export interface DriverAvailability {
    isAvailable: boolean;
    nextAvailableTime?: Date;
    currentOrder?: {
        id: string;
        completionTime: Date;
    };
}

export interface DriverLocation {
    driverId: string;
    latitude: number;
    longitude: number;
    lastUpdated: Date;
}

export interface AssignmentMetrics {
    totalAssignments: number;
    successfulAssignments: number;
    averageSearchTime: number;
    averageScore: number;
    failureReasons: Record<string, number>;
}