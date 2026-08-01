export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function createToken(userId: string): Promise<string>;
export type AuthMethod = 'jwt' | 'api_key' | 'none';
export interface AuthResult {
    userId: string | null;
    authMethod: AuthMethod;
}
export declare function authenticate(request: Request): Promise<AuthResult>;
