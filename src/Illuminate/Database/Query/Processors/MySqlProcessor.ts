import { isNumeric } from '@devnetic/utils';
import type { Builder } from '../Builder';
import { Processor } from './Processor';
import { match } from '../../../Support';

type ColumnListingResult = {
  column_name: string;
}

type ColumnResult = {
  name: string;
  type_name: string;
  type: string;
  collation: string | null;
  nullable: 'YES' | 'NO';
  default: string | null;
  extra: string;
  comment: string | null;
  expression: string | null;
}

type IndexResult = {
  name: string;
  columns: string | null;
  type: string;
  unique: number | boolean;
}

type ForeignKeyResult = {
  name: string;
  columns: string;
  foreign_schema: string;
  foreign_table: string;
  foreign_columns: string;
  on_update: string;
  on_delete: string;
}

export type ProcessedColumn = {
  name: string;
  type_name: string;
  type: string;
  collation: string | null;
  nullable: boolean;
  default: string | null;
  auto_increment: boolean;
  comment: string | null;
  generation: {
    type: 'stored' | 'virtual' | null;
    expression: string;
  } | null;
}

export type ProcessedIndex = {
  name: string;
  columns: string[];
  type: string;
  unique: boolean;
  primary: boolean;
}

export type ProcessedForeignKey = {
  name: string;
  columns: string[];
  foreign_schema: string;
  foreign_table: string;
  foreign_columns: string[];
  on_update: string;
  on_delete: string;
}

export class MySqlProcessor extends Processor {
  /**
   * Process the results of a column listing query.
   *
   * @deprecated Will be removed in a future version.
   */
  public processColumnListing(
    results: readonly ColumnListingResult[],
  ): string[] {
    return results.map(result => result.column_name);
  }

  /**
   * Process an "insert get ID" query.
   */
  public async processInsertGetId(
    query: Builder,
    sql: string,
    values: readonly unknown[],
    sequence?: string | null,
  ): Promise<number> {
    await query.getConnection().insert(sql, values, sequence);

    const id = query.getConnection().getDriver().getLastInsertId();

    // return Number(id);
    return isNumeric(id) ? parseInt(id, 10) : id;
  }

  /**
   * Process column metadata.
   */
  public processColumns(
    results: readonly ColumnResult[],
  ): ProcessedColumn[] {
    return results.map(result => ({
      name: result.name,
      type_name: result.type_name,
      type: result.type,
      collation: result.collation,
      nullable: result.nullable === 'YES',
      default: result.default,
      auto_increment: result.extra === 'auto_increment',
      comment: result.comment || null,
      generation: result.expression
        // ? {
        //   type:
        //     result.extra === 'STORED GENERATED'
        //       ? 'stored'
        //       : result.extra === 'VIRTUAL GENERATED'
        //         ? 'virtual'
        //         : null,
        //   expression: result.expression,
        // }
        ? {
          type: match(result.extra, {
            'STORED GENERATED': 'stored',
            'VIRTUAL GENERATED': 'virtual',
            default: null,
          })
        }
        : null,
    }));
  }

  /**
   * Process index metadata.
   */
  public processIndexes(
    results: readonly IndexResult[],
  ): ProcessedIndex[] {
    return results.map(result => {
      const name = result.name.toLowerCase();

      return {
        name,
        columns: result.columns ? result.columns.split(',') : [],
        type: result.type.toLowerCase(),
        unique: Boolean(result.unique),
        primary: name === 'primary',
      };
    });
  }

  /**
   * Process foreign key metadata.
   */
  public processForeignKeys(
    results: readonly ForeignKeyResult[],
  ): ProcessedForeignKey[] {
    return results.map(result => ({
      name: result.name,
      columns: result.columns.split(','),
      foreign_schema: result.foreign_schema,
      foreign_table: result.foreign_table,
      foreign_columns: result.foreign_columns.split(','),
      on_update: result.on_update.toLowerCase(),
      on_delete: result.on_delete.toLowerCase(),
    }));
  }
}
