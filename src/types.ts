export interface Column {
  name: string;
  type: string;
  isPrimary: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
  isNullable: boolean;
  isUnique?: boolean;
  defaultValue?: string;
  checkConstraint?: string;
  comment?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  isUnique?: boolean;
  method?: 'btree' | 'hash' | 'gin' | 'gist';
}

export interface RLSPolicy {
  name: string;
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  roles: string[];
  usingExpression?: string;
  withCheckExpression?: string;
}

export interface TriggerDefinition {
  name: string;
  timing: 'BEFORE' | 'AFTER';
  events: string[];
  functionBody: string;
  description?: string;
}

export interface Table {
  name: string;
  description: string;
  columns: Column[];
  indexes: IndexDefinition[];
  rlsPolicies: RLSPolicy[];
  enableRLS: boolean;
  triggers: TriggerDefinition[];
}

export interface Schema {
  tables: Table[];
  rpcs: {
    name: string;
    description: string;
    arguments: { name: string; type: string }[];
    returnType: string;
    definition: string;
  }[];
}

export interface SchemaEditorState {
  schema: Schema;
  selectedTable: string | null;
  activeTab: 'visual' | 'sql' | 'rls' | 'rpcs';
  highlightedRelation: { fromTable: string; toTable: string; fromCol: string; toCol: string } | null;
  options: {
    includeRLS: boolean;
    includeIndexes: boolean;
    includeRPCs: boolean;
    includeTriggers: boolean;
    includeSupabaseUserSync: boolean;
    useCascadeDelete: boolean;
  };
}
