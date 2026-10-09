// Types of contract-runtime.mjs (Augur contract-wrap observation runtime).

/** true / undefined pass; false or a reason string is a violation. */
export type ContractVerdict = boolean | string | undefined | void;

export interface ContractPredicates {
  pre?: (...args: never[]) => ContractVerdict;
  post?: (result: never, ...args: never[]) => ContractVerdict;
  postThrow?: (error: unknown, ...args: never[]) => ContractVerdict;
}

export interface ContractSpec extends ContractPredicates {
  contractId: string;
  id?: string;
  where?: string;
  rule?: string;
  mode?: 'observe' | 'enforce';
  sample?: number;
}

export declare function contract<F extends (...args: never[]) => unknown>(fn: F, spec: ContractSpec): F;
