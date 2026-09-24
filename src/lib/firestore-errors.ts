import { auth } from './firebase';

export enum FirestoreOperation {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  List = 'list',
  Get = 'get',
}

export interface FirestoreErrorInfo {
  operation: FirestoreOperation;
  path: string | null;
  message: string;
  auth: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean | null;
    isAnonymous: boolean | null;
    tenantId: string | null;
    providers: Array<{ providerId: string | null; email: string | null }>;
  };
}

export function createFirestoreError(
  error: unknown,
  operation: FirestoreOperation,
  path: string | null
): FirestoreErrorInfo {
  const user = auth.currentUser;

  return {
    operation,
    path,
    message: error instanceof Error ? error.message : String(error),
    auth: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providers:
        user?.providerData.map((p) => ({
          providerId: p.providerId,
          email: p.email ?? null,
        })) ?? [],
    },
  };
}

export function logAndThrowFirestoreError(
  error: unknown,
  operation: FirestoreOperation,
  path: string | null
): never {
  const info = createFirestoreError(error, operation, path);
  console.error('Firestore error:', JSON.stringify(info));
  throw new Error(JSON.stringify(info));
}
