export interface SyncResult {
	lastSynced: Date;
	status: 'success' | 'partial' | 'error';
	conflicts: SyncConflict[];
}

export interface SyncConflict {
	id: string;
	localVersion: any;
	remoteVersion: any;
	resolution: 'local' | 'remote' | 'manual';
}

export interface SyncProvider {
	providerId: string; // e.g., 'api'
	
	// Atomic operations for individual records
	saveRecord(collection: string, id: string, data: any): Promise<void>;
	getRecord(collection: string, id: string): Promise<any>;
	deleteRecord(collection: string, id: string): Promise<void>;
	
	// Bulk operations for synchronization
	uploadAll(): Promise<SyncResult>;
	downloadAll(): Promise<SyncResult>;
	
	// Connectivity check
	isAvailable(): Promise<boolean>;
}