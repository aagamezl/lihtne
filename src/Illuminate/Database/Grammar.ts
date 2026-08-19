import { Connection } from "./Connection";
import { Expression } from "./Query/Expression";

export abstract class Grammar {
  //   use Macroable;

  // The connection used for escaping values.
  protected connection;

  /**
   * Create a new grammar instance.
   */
  public constructor(connection: Connection) {
    this.connection = connection;
  }

  // /**
  //  * Wrap an array of values.
  //  *
  //  * @param  array<\Illuminate\Contracts\Database\Query\Expression|string>  $values
  //  * @return array<string>
  //  */
  // public function wrapArray(array $values)
  // {
  //     return array_map($this->wrap(...), $values);
  // }

  /**
   * Wrap a table in keyword identifiers.
   *
   * @param  \Illuminate\Contracts\Database\Query\Expression|string  table
   * @param  string|null  prefix
   * @return string | number
   */
  public wrapTable(table: Expression | string, prefix: string | null = null): string | number {
    if (this.isExpression(table)) {
      return this.getValue(table);
    }

    prefix ??= this.connection.getTablePrefix();

    // If the table being wrapped has an alias we'll need to separate the pieces
    // so we can prefix the table and then wrap each of the segments on their
    // own and then join these both back together using the "as" connector.
    if (table.includes(' as ')) {
      return this.wrapAliasedTable(table, prefix);
    }

    // If the table being wrapped has a custom schema name specified, we need to
    // prefix the last segment as the table name then wrap each segment alone
    // and eventually join them both back together using the dot connector.
    if (table.includes('.')) {
      table = table.replace('.' + prefix, '.' + prefix);

      return (new Collection(table.split('.')))
        .map(this.wrapValue.bind(this))
        .implode('.');
    }

    return this.wrapValue(prefix + table);
  }

  // /**
  //  * Wrap a value in keyword identifiers.
  //  *
  //  * @param  \Illuminate\Contracts\Database\Query\Expression|string  $value
  //  * @return string
  //  */
  // public function wrap($value)
  // {
  //     if ($this->isExpression($value)) {
  //         return $this->getValue($value);
  //     }

  //     // If the value being wrapped has a column alias we will need to separate out
  //     // the pieces so we can wrap each of the segments of the expression on its
  //     // own, and then join these both back together using the "as" connector.
  //     if (stripos($value, ' as ') !== false) {
  //         return $this->wrapAliasedValue($value);
  //     }

  //     // If the given value is a JSON selector we will wrap it differently than a
  //     // traditional value. We will need to split this path and wrap each part
  //     // wrapped, etc. Otherwise, we will simply wrap the value as a string.
  //     if ($this->isJsonSelector($value)) {
  //         return $this->wrapJsonSelector($value);
  //     }

  //     return $this->wrapSegments(explode('.', $value));
  // }

  // /**
  //  * Wrap a value that has an alias.
  //  *
  //  * @param  string  $value
  //  * @return string
  //  */
  // protected function wrapAliasedValue($value)
  // {
  //     $segments = preg_split('/\s+as\s+/i', $value);

  //     return $this->wrap($segments[0]).' as '.$this->wrapValue($segments[1]);
  // }

  /**
   * Wrap a table that has an alias.
   *
   * @param  string  $value
   * @param  string|null  $prefix
   * @return string
   */
  protected wrapAliasedTable(value: string, prefix: string | null = null): string {
    const segments = value.split(/\s+as\s+/i);

    prefix ??= this.connection.getTablePrefix();

    return this.wrapTable(segments[0]!, prefix) + ' as ' + this.wrapValue(prefix + segments[1]!);
  }

  // /**
  //  * Wrap the given value segments.
  //  *
  //  * @param  list<string>  $segments
  //  * @return string
  //  */
  // protected function wrapSegments($segments)
  // {
  //     return (new Collection($segments))->map(function ($segment, $key) use ($segments) {
  //         return $key == 0 && count($segments) > 1
  //             ? $this->wrapTable($segment)
  //             : $this->wrapValue($segment);
  //     })->implode('.');
  // }

  /**
   * Wrap a single string in keyword identifiers.
   *
   * @param  string  value
   * @return string
   */
  protected wrapValue(value: string): string {
    if (value !== '*') {
      return '"' + value.replace('"', '""') + '"';
    }

    return value;
  }

  // /**
  //  * Wrap the given JSON selector.
  //  *
  //  * @param  string  $value
  //  * @return string
  //  *
  //  * @throws \RuntimeException
  //  */
  // protected function wrapJsonSelector($value)
  // {
  //     throw new RuntimeException('This database engine does not support JSON operations.');
  // }

  // /**
  //  * Determine if the given string is a JSON selector.
  //  *
  //  * @param  string  $value
  //  * @return bool
  //  */
  // protected function isJsonSelector($value)
  // {
  //     return str_contains($value, '->');
  // }

  // /**
  //  * Convert an array of column names into a delimited string.
  //  *
  //  * @param  array<\Illuminate\Contracts\Database\Query\Expression|string>  $columns
  //  * @return string
  //  */
  // public function columnize(array $columns)
  // {
  //     return implode(', ', array_map($this->wrap(...), $columns));
  // }

  // /**
  //  * Create query parameter place-holders for an array.
  //  *
  //  * @param  array<mixed>  $values
  //  * @return string
  //  */
  // public function parameterize(array $values)
  // {
  //     return implode(', ', array_map($this->parameter(...), $values));
  // }

  // /**
  //  * Get the appropriate query parameter place-holder for a value.
  //  *
  //  * @param  mixed  $value
  //  * @return string
  //  */
  // public function parameter($value)
  // {
  //     return $this->isExpression($value) ? $this->getValue($value) : '?';
  // }

  // /**
  //  * Quote the given string literal.
  //  *
  //  * @param  string|array<string>  $value
  //  * @return string
  //  */
  // public function quoteString($value)
  // {
  //     if (is_array($value)) {
  //         return implode(', ', array_map([$this, __FUNCTION__], $value));
  //     }

  //     return "'$value'";
  // }

  // /**
  //  * Escapes a value for safe SQL embedding.
  //  *
  //  * @param  string|float|int|bool|null  $value
  //  * @param  bool  $binary
  //  * @return string
  //  */
  // public function escape($value, $binary = false)
  // {
  //     return $this->connection->escape($value, $binary);
  // }

  /**
   * Determine if the given value is a raw expression.
   *
   * @param  mixed  $value
   * @return bool
   */
  public isExpression(value: unknown) {
    return value instanceof Expression;
  }

  /**
   * Transforms expressions to their scalar types.
   *
   * @param {Expression | string | number} expression - The expression to transform.
   * @returns {string | number} - The transformed value.
   */
  public getValue(expression: Expression | string | number): string | number {
    if (this.isExpression(expression)) {
      return this.getValue(expression.getValue(this));
    }

    return expression;
  }

  // /**
  //  * Get the format for database stored dates.
  //  *
  //  * @return string
  //  */
  // public function getDateFormat()
  // {
  //     return 'Y-m-d H:i:s';
  // }

  // /**
  //  * Get the grammar's table prefix.
  //  *
  //  * @deprecated Use DB::getTablePrefix()
  //  *
  //  * @return string
  //  */
  // public function getTablePrefix()
  // {
  //     return $this->connection->getTablePrefix();
  // }

  // /**
  //  * Set the grammar's table prefix.
  //  *
  //  * @deprecated Use DB::setTablePrefix()
  //  *
  //  * @param  string  $prefix
  //  * @return $this
  //  */
  // public function setTablePrefix($prefix)
  // {
  //     $this->connection->setTablePrefix($prefix);

  //     return $this;
  // }
}