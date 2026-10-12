export interface LockResources {
  attempt?: {
    actorId: string;
    requestId: string;
  };
  unitIds?: string[];
  professionalIds?: string[];
  membershipIds?: string[];
}

export interface UnitOfWorkContext {
  serverTime: Date;
}

export interface ProfessionalMembershipUnitOfWork {
  withLocks<T>(
    resources: LockResources,
    work: (tx: any, context: UnitOfWorkContext) => Promise<T>,
  ): Promise<T>;
}
