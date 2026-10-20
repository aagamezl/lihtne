import { dateFormat } from '@devnetic/utils'

import type { BindingValues } from './Query/Builder'
import type { Processor } from './Query/Processors/Processor'

import { Connection } from './Connection'
import { PostgresGrammar } from './Query/Grammars/PostgresGrammar'
import { PostgresProcessor } from './Query/Processors/PostgresProcessor'

export class PostgresConnection extends Connection {
  /**
   * {@inheritdoc}
   */
  public getDriverTitle (): string {
    return 'PostgreSQL'
  }

  /**
   * Prepare the query bindings for execution.
   *
   * node-postgres sends booleans as PostgreSQL bool parameters, so they stay
   * booleans. Dates are formatted with the grammar's date format.
   *
   * @param  array  $bindings
   * @return array
   */
  public override prepareBindings (bindings: BindingValues): BindingValues {
    const grammar = this.getQueryGrammar()

    for (const [key, value] of bindings.entries()) {
      if (value instanceof Date) {
        bindings[key] = dateFormat(value, grammar.getDateFormat())
      }
    }

    return bindings
  }

  /**
   * Escape a binary value for safe SQL embedding.
   *
   * @param  string  $value
   * @return string
   */
  protected override escapeBinary ($value: string): string {
    const hex = Buffer.from($value).toString('hex')

    return `'\\x${hex}'::bytea`
  }

  /**
   * Escape a bool value for safe SQL embedding.
   *
   * @param  bool  $value
   * @return string
   */
  protected override escapeBool (value: boolean): string {
    return value ? 'true' : 'false'
  }

  /**
   * Determine if the given database exception was caused by a unique constraint violation.
   *
   * @param  \Exception  $exception
   * @return bool
   */
  protected override isUniqueConstraintError (exception: Error): boolean {
    return exception.code === '23505'
  }

  /**
   * Extract the index and columns that caused a unique constraint violation.
   *
   * @param  Exception  $exception
   * @return array{index: string|null, columns: list<string>}
   */
  protected override parseUniqueConstraintViolation (exception: Error): { index: string | null, columns: string[] } {
    let index = null
    let columns: string[] = []

    const message = exception.message
    let matches = /unique constraint "([^"]+)"/i.exec(message)

    if (matches) {
      index = matches[1]
    }

    matches = /Key \(([^)]+)\)=/i.exec(message)
    if (matches) {
      columns = matches[1].split(',').map((column) => column.trim()) ?? []
    }

    return { columns, index }
  }

  /**
   * Determine if the given database exception was caused by an invalid or out of range value.
   */
  protected override isDataTypeError (exception: Error): boolean {
    return [
      '22001', // string_data_right_truncation
      '22003', // numeric_value_out_of_range
      '22007', // invalid_datetime_format
      '22008', // datetime_field_overflow
      '22P02' // invalid_text_representation
    ].includes(exception.code)
  }

  /**
   * Get the default query grammar instance.
   *
   * @return \Illuminate\Database\Query\Grammars\PostgresGrammar
   */
  protected override getDefaultQueryGrammar (): PostgresGrammar {
    return new PostgresGrammar(this)
  }

  /**
   * Get the default post processor instance.
   *
   * @return \Illuminate\Database\Query\Processors\PostgresProcessor
   */
  protected override getDefaultPostProcessor (): Processor {
    return new PostgresProcessor()
  }

  /**
 * Get the default schema grammar instance.
 *
 * @return \Illuminate\Database\Schema\Grammars\PostgresGrammar
 */
  protected override getDefaultSchemaGrammar (): PostgresGrammar {
    return new PostgresGrammar(this)
  }
}
